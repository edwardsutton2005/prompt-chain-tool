import { requireApiSuperadmin } from "@/lib/admin";
import { jsonBody, KEY_PATTERN, optionalText, textField, UUID_PATTERN } from "@/lib/validation";

export async function POST(request: Request) {
  const admin = await requireApiSuperadmin();
  if (admin.error) return admin.error;
  const body = await jsonBody(request);
  const name = textField(body?.name, 120);
  const purpose = textField(body?.purpose, 50);
  const key = textField(body?.key, 80);
  const description = optionalText(body?.description, 1000);
  const defaultModelId = typeof body?.default_model_id === "string" ? body.default_model_id : null;

  if (!name || !purpose || !key || !KEY_PATTERN.test(key)) {
    return Response.json({ error: "Name, purpose, and a lowercase key are required." }, { status: 400 });
  }
  if (defaultModelId && !UUID_PATTERN.test(defaultModelId)) {
    return Response.json({ error: "The default model is invalid." }, { status: 400 });
  }

  const { data, error } = await admin.supabase
    .from("prompt_chains")
    .insert({
      name,
      purpose,
      key,
      description,
      default_model_id: defaultModelId,
      generation_configuration: { temperature: 0.8, maxOutputTokens: 512 },
    })
    .select("*")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ chain: { ...data, steps: [] } }, { status: 201 });
}
