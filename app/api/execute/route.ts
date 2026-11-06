import { requireApiSuperadmin } from "@/lib/admin";
import {
  buildStepInvocation,
  parseInlineImage,
  resolveGenerationSettings,
} from "@/lib/execution";
import { finishExecution, startExecution } from "@/lib/generation-log";
import { generateGeminiText } from "@/lib/gemini";
import { findGif } from "@/lib/giphy";
import { renderTemplate } from "@/lib/template";
import type { LlmModel, PromptChain, PromptChainStep } from "@/lib/types";
import { jsonBody, textField, UUID_PATTERN } from "@/lib/validation";

export async function POST(request: Request) {
  const admin = await requireApiSuperadmin();
  if (admin.error) return admin.error;
  const body = await jsonBody(request);
  const chainId = typeof body?.chain_id === "string" ? body.chain_id : "";
  const input = textField(body?.input, 20000);
  if (!UUID_PATTERN.test(chainId) || !input) {
    return Response.json({ error: "A chain and input are required." }, { status: 400 });
  }

  let image: ReturnType<typeof parseInlineImage>;
  try {
    image = parseInlineImage(body?.image);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Invalid image." }, { status: 400 });
  }

  const [chainResult, stepsResult, modelsResult] = await Promise.all([
    admin.supabase.from("prompt_chains").select("*").eq("id", chainId).is("deleted_at", null).eq("active", true).single(),
    admin.supabase.from("prompt_chain_steps").select("*").eq("prompt_chain_id", chainId).order("position"),
    admin.supabase
      .from("llm_models")
      .select("*, provider:llm_providers!inner(id,key,name)")
      .eq("enabled", true)
      .eq("llm_providers.key", "google"),
  ]);
  const loadError = chainResult.error ?? stepsResult.error ?? modelsResult.error;
  if (loadError) return Response.json({ error: loadError.message }, { status: 400 });

  const chain = chainResult.data as unknown as PromptChain;
  const steps = (stepsResult.data ?? []) as unknown as PromptChainStep[];
  const models = (modelsResult.data ?? []) as unknown as LlmModel[];
  if (!steps.length) return Response.json({ error: "Add at least one step before running this chain." }, { status: 400 });

  const modelFor = (step: PromptChainStep) =>
    models.find((model) => model.id === (step.llm_model_id ?? chain.default_model_id));
  const firstModel = modelFor(steps[0]);
  if (!firstModel) return Response.json({ error: "The first step has no enabled model." }, { status: 400 });

  let requestId: string;
  try {
    requestId = await startExecution(admin.supabase, {
      chainKey: chain.key,
      modelIdentifier: firstModel.model_identifier,
      input,
      image: image ? { mimeType: image.mimeType, size: image.size } : undefined,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Execution could not start." }, { status: 400 });
  }

  const outputs: Array<{ stepId: string; position: number; output: string }> = [];
  let previousOutput = "";

  for (const step of steps) {
    const model = modelFor(step);
    let rendered = "";
    if (!model) {
      const message = `Step ${step.position} has no enabled model.`;
      await finishExecution(admin.supabase, requestId, { status: "failed", errorCode: "MODEL_NOT_FOUND", errorMessage: message });
      return Response.json({ error: message, requestId, outputs }, { status: 400 });
    }

    try {
      rendered = renderTemplate(step.template, { input, previous_output: previousOutput });
      const { temperature, maxOutputTokens } = resolveGenerationSettings(
        step.configuration,
        chain.generation_configuration
      );
      const { systemInstruction, prompt } = buildStepInvocation(
        step.role,
        rendered,
        input,
        previousOutput
      );

      const { data: stepRun, error: insertError } = await admin.supabase
        .from("prompt_chain_step_runs")
        .insert({
          generation_request_id: requestId,
          prompt_chain_step_id: step.id,
          step_position: step.position,
          llm_model_id: model.id,
          rendered_prompt: rendered,
          input_data: { input, previousOutput, hasImage: Boolean(image && step.position === steps[0].position) },
        })
        .select("id")
        .single();
      if (insertError) throw new Error(insertError.message);

      try {
        const generated = await generateGeminiText({
          model: model.model_identifier,
          systemInstruction,
          prompt,
          maxOutputTokens,
          temperature,
          image: step.position === steps[0].position ? image : undefined,
        });
        const { error: updateError } = await admin.supabase
          .from("prompt_chain_step_runs")
          .update({
            output_text: generated.text,
            response_metadata: generated.metadata,
            status: "succeeded",
            completed_at: new Date().toISOString(),
          })
          .eq("id", stepRun.id);
        if (updateError) throw new Error(updateError.message);
        previousOutput = generated.text;
        outputs.push({ stepId: step.id, position: step.position, output: generated.text });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Generation failed.";
        await admin.supabase
          .from("prompt_chain_step_runs")
          .update({ status: "failed", error_message: message, completed_at: new Date().toISOString() })
          .eq("id", stepRun.id);
        throw error;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : `Step ${step.position} failed.`;
      await finishExecution(admin.supabase, requestId, {
        status: "failed",
        outputData: { outputs },
        errorCode: "STEP_FAILED",
        errorMessage: message,
      });
      return Response.json({ error: message, requestId, outputs }, { status: 502 });
    }
  }

  let mediaPayload: Record<string, unknown> = {
    generation_request_id: requestId,
    prompt_chain_id: chain.id,
    media_kind: "text",
    text_content: previousOutput,
    metadata: { chainKey: chain.key, chainVersion: chain.version, stepCount: steps.length },
  };
  if (chain.purpose === "gif_search") {
    try {
      const gif = await findGif(previousOutput);
      mediaPayload = {
        generation_request_id: requestId,
        prompt_chain_id: chain.id,
        media_kind: "gif",
        external_url: gif.url,
        text_content: previousOutput,
        mime_type: "image/gif",
        metadata: { chainKey: chain.key, chainVersion: chain.version, stepCount: steps.length, giphyId: gif.id },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "GIF generation failed.";
      await finishExecution(admin.supabase, requestId, {
        status: "failed",
        outputData: { outputs, finalOutput: previousOutput },
        errorCode: "GIPHY_FAILED",
        errorMessage: message,
      });
      return Response.json({ error: message, requestId, outputs }, { status: 502 });
    }
  }

  const { data: media, error: mediaError } = await admin.supabase
    .from("generated_media")
    .insert(mediaPayload)
    .select("*")
    .single();
  if (mediaError) {
    await finishExecution(admin.supabase, requestId, {
      status: "failed",
      outputData: { outputs, finalOutput: previousOutput },
      errorCode: "MEDIA_PERSIST_FAILED",
      errorMessage: mediaError.message,
    });
    return Response.json({ error: mediaError.message, requestId, outputs }, { status: 500 });
  }

  await finishExecution(admin.supabase, requestId, {
    status: "succeeded",
    outputData: { outputs, finalOutput: previousOutput, mediaId: media.id },
  });

  return Response.json({ requestId, outputs, finalOutput: previousOutput, media });
}
