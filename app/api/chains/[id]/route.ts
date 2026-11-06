import { requireApiSuperadmin } from "@/lib/admin";
import { configuration, jsonBody, optionalText, textField, UUID_PATTERN } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const admin = await requireApiSuperadmin();
  if (admin.error) return admin.error;
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return Response.json({ error: "Invalid chain id." }, { status: 400 });
  const body = await jsonBody(request);
  if (!body) return Response.json({ error: "Invalid request body." }, { status: 400 });

  const update: Record<string, unknown> = {};
  if ("name" in body) {
    const value = textField(body.name, 120);
    if (!value) return Response.json({ error: "Name is required." }, { status: 400 });
    update.name = value;
  }
  if ("description" in body) update.description = optionalText(body.description, 1000);
  if ("active" in body) update.active = Boolean(body.active);
  if ("default_model_id" in body) {
    const modelId = body.default_model_id;
    if (modelId !== null && (typeof modelId !== "string" || !UUID_PATTERN.test(modelId))) {
      return Response.json({ error: "Invalid model id." }, { status: 400 });
    }
    update.default_model_id = modelId;
  }
  if ("generation_configuration" in body) {
    const value = configuration(body.generation_configuration);
    if (!value) return Response.json({ error: "Generation settings must be an object." }, { status: 400 });
    update.generation_configuration = value;
  }
  if (!Object.keys(update).length) return Response.json({ error: "Nothing to update." }, { status: 400 });

  const { data, error } = await admin.supabase.from("prompt_chains").update(update).eq("id", id).select("*").single();
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ chain: data });
}

export async function DELETE(_request: Request, { params }: Context) {
  const admin = await requireApiSuperadmin();
  if (admin.error) return admin.error;
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return Response.json({ error: "Invalid chain id." }, { status: 400 });

  const { count, error: countError } = await admin.supabase
    .from("generation_requests")
    .select("id", { count: "exact", head: true })
    .eq("prompt_chain_id", id);
  if (countError) return Response.json({ error: countError.message }, { status: 400 });

  const mutation = count
    ? admin.supabase.from("prompt_chains").update({ deleted_at: new Date().toISOString(), active: false }).eq("id", id)
    : admin.supabase.from("prompt_chains").delete().eq("id", id);
  const { error } = await mutation;
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ archived: Boolean(count) });
}
