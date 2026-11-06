import { requireApiSuperadmin } from "@/lib/admin";
import { configuration, jsonBody, optionalText, textField, UUID_PATTERN } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const admin = await requireApiSuperadmin();
  if (admin.error) return admin.error;
  const { id } = await params;
  const body = await jsonBody(request);
  if (!UUID_PATTERN.test(id) || !body) return Response.json({ error: "Invalid request." }, { status: 400 });
  const update: Record<string, unknown> = {};

  if ("name" in body) update.name = optionalText(body.name, 120);
  if ("template" in body) {
    const value = textField(body.template, 20000);
    if (!value) return Response.json({ error: "Prompt template is required." }, { status: 400 });
    update.template = value;
  }
  if ("role" in body) {
    if (!["system", "user", "assistant"].includes(String(body.role))) return Response.json({ error: "Invalid role." }, { status: 400 });
    update.role = body.role;
  }
  if ("llm_model_id" in body) {
    const modelId = body.llm_model_id;
    if (modelId !== null && (typeof modelId !== "string" || !UUID_PATTERN.test(modelId))) return Response.json({ error: "Invalid model id." }, { status: 400 });
    update.llm_model_id = modelId;
  }
  if ("configuration" in body) {
    const value = configuration(body.configuration);
    if (!value) return Response.json({ error: "Settings must be a JSON object." }, { status: 400 });
    update.configuration = value;
  }

  const { data, error } = await admin.supabase.from("prompt_chain_steps").update(update).eq("id", id).select("*").single();
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ step: data });
}

export async function DELETE(_request: Request, { params }: Context) {
  const admin = await requireApiSuperadmin();
  if (admin.error) return admin.error;
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return Response.json({ error: "Invalid step id." }, { status: 400 });
  const { error } = await admin.supabase.from("prompt_chain_steps").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ deleted: true });
}
