import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  EditorData,
  Execution,
  GeneratedMedia,
  LlmModel,
  PromptChain,
  PromptChainStep,
  StepRun,
} from "@/lib/types";

export async function loadEditorData(supabase: SupabaseClient): Promise<EditorData> {
  const [chainsResult, stepsResult, modelsResult, executionsResult, mediaResult] = await Promise.all([
    supabase.from("prompt_chains").select("*").is("deleted_at", null).order("updated_at", { ascending: false }),
    supabase.from("prompt_chain_steps").select("*").order("prompt_chain_id").order("position"),
    supabase.from("llm_models").select("*, provider:llm_providers!inner(id,key,name)").eq("enabled", true).eq("llm_providers.key", "google").order("display_name"),
    supabase.from("generation_requests").select("*").eq("source", "prompt_chain_tool").order("created_at", { ascending: false }).limit(50),
    supabase.from("generated_media").select("*").order("created_at", { ascending: false }).limit(100),
  ]);

  const error = chainsResult.error ?? stepsResult.error ?? modelsResult.error ?? executionsResult.error ?? mediaResult.error;
  if (error) throw new Error(`Prompt Chain Tool data could not be loaded: ${error.message}`);

  const chains = (chainsResult.data ?? []) as unknown as PromptChain[];
  const steps = (stepsResult.data ?? []) as unknown as PromptChainStep[];
  const executions = (executionsResult.data ?? []) as unknown as Execution[];
  const executionIds = executions.map((execution) => execution.id);
  let stepRuns: StepRun[] = [];

  if (executionIds.length) {
    const result = await supabase
      .from("prompt_chain_step_runs")
      .select("*")
      .in("generation_request_id", executionIds)
      .order("step_position");
    if (result.error) throw new Error(`Execution steps could not be loaded: ${result.error.message}`);
    stepRuns = (result.data ?? []) as unknown as StepRun[];
  }

  return {
    chains: chains.map((chain) => ({
      ...chain,
      steps: steps.filter((step) => step.prompt_chain_id === chain.id),
    })),
    models: (modelsResult.data ?? []) as unknown as LlmModel[],
    executions: executions.map((execution) => ({
      ...execution,
      step_runs: stepRuns.filter((run) =>
        (run as StepRun & { generation_request_id?: string }).generation_request_id === execution.id
      ),
    })),
    media: (mediaResult.data ?? []) as unknown as GeneratedMedia[],
  };
}
