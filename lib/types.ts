export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type LlmProvider = {
  id: string;
  key: string;
  name: string;
};

export type LlmModel = {
  id: string;
  provider_id: string;
  model_identifier: string;
  display_name: string;
  enabled: boolean;
  configuration: Json;
  provider?: LlmProvider;
};

export type PromptChainStep = {
  id: string;
  prompt_chain_id: string;
  position: number;
  role: "system" | "user" | "assistant";
  name: string | null;
  template: string;
  llm_model_id: string | null;
  configuration: Json;
  created_at: string;
  updated_at: string;
};

export type PromptChain = {
  id: string;
  key: string;
  name: string;
  purpose: string;
  version: number;
  description: string | null;
  default_model_id: string | null;
  generation_configuration: Json;
  active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  steps: PromptChainStep[];
};

export type StepRun = {
  id: string;
  generation_request_id: string;
  step_position: number;
  rendered_prompt: string;
  output_text: string | null;
  status: "pending" | "succeeded" | "failed";
  error_message: string | null;
  response_metadata: Json;
};

export type Execution = {
  id: string;
  prompt_chain_id: string | null;
  input_text: string | null;
  output_data: Json;
  status: "pending" | "succeeded" | "failed";
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
  step_runs?: StepRun[];
};

export type GeneratedMedia = {
  id: string;
  generation_request_id: string;
  prompt_chain_id: string;
  media_kind: "text" | "image" | "gif" | "video" | "audio";
  text_content: string | null;
  external_url: string | null;
  storage_path: string | null;
  mime_type: string | null;
  metadata: Json;
  created_at: string;
};

export type EditorData = {
  chains: PromptChain[];
  models: LlmModel[];
  executions: Execution[];
  media: GeneratedMedia[];
};
