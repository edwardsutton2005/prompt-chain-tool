import type { SupabaseClient } from "@supabase/supabase-js";

export async function startExecution(
  supabase: SupabaseClient,
  options: {
    chainKey: string;
    modelIdentifier: string;
    input: string;
    image?: { mimeType: string; size: number };
  }
) {
  const { data, error } = await supabase.rpc("start_generation_request", {
    p_source: "prompt_chain_tool",
    p_request_type: "prompt_chain_execution",
    p_prompt_chain_key: options.chainKey,
    p_provider_key: "google",
    p_model_identifier: options.modelIdentifier,
    p_input_text: options.input,
    p_input_data: {
      input: options.input,
      image: options.image ?? null,
    },
  });
  if (error || typeof data !== "string") {
    throw new Error(error?.message ?? "The execution record could not be created.");
  }
  return data;
}

export async function finishExecution(
  supabase: SupabaseClient,
  requestId: string,
  result: {
    status: "succeeded" | "failed";
    outputData?: Record<string, unknown>;
    errorCode?: string;
    errorMessage?: string;
  }
) {
  const { data, error } = await supabase.rpc("finish_generation_request", {
    p_generation_request_id: requestId,
    p_status: result.status,
    p_output_data: result.outputData ?? {},
    p_error_code: result.errorCode ?? null,
    p_error_message: result.errorMessage ?? null,
  });
  if (error || data !== true) throw new Error(error?.message ?? "The execution could not be finalized.");
}
