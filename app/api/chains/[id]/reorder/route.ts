import { requireApiSuperadmin } from "@/lib/admin";
import { jsonBody, UUID_PATTERN } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  const admin = await requireApiSuperadmin();
  if (admin.error) return admin.error;
  const { id } = await params;
  const body = await jsonBody(request);
  const stepIds = Array.isArray(body?.step_ids) ? body.step_ids : [];
  if (!UUID_PATTERN.test(id) || !stepIds.every((value) => typeof value === "string" && UUID_PATTERN.test(value))) {
    return Response.json({ error: "Invalid reorder request." }, { status: 400 });
  }
  const { error } = await admin.supabase.rpc("reorder_prompt_chain_steps", {
    p_chain_id: id,
    p_step_ids: stepIds,
  });
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ reordered: true });
}
