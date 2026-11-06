import { requireApiSuperadmin } from "@/lib/admin";
import { configuration, jsonBody, optionalText, textField, UUID_PATTERN } from "@/lib/validation";

export async function POST(request: Request) {
  const admin = await requireApiSuperadmin();
  if (admin.error) return admin.error;
  const body = await jsonBody(request);
  const chainId = typeof body?.prompt_chain_id === "string" ? body.prompt_chain_id : "";
  const template = textField(body?.template, 20000);
  const name = optionalText(body?.name, 120);
  const role = body?.role;
  const modelId = typeof body?.llm_model_id === "string" ? body.llm_model_id : null;
  const config = configuration(body?.configuration) ?? {};
  if (!UUID_PATTERN.test(chainId) || !template || !["system", "user", "assistant"].includes(String(role))) {
    return Response.json({ error: "Chain, role, and prompt template are required." }, { status: 400 });
  }
  if (modelId && !UUID_PATTERN.test(modelId)) return Response.json({ error: "Invalid model id." }, { status: 400 });

  const { data: last } = await admin.supabase
    .from("prompt_chain_steps")
    .select("position")
    .eq("prompt_chain_id", chainId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = Number(last?.position ?? 0) + 1;
  const { data, error } = await admin.supabase
    .from("prompt_chain_steps")
    .insert({ prompt_chain_id: chainId, position, name, role, template, llm_model_id: modelId, configuration: config })
    .select("*")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ step: data }, { status: 201 });
}
