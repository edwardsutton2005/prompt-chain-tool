export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const KEY_PATTERN = /^[a-z0-9][a-z0-9_-]{0,79}$/;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function jsonBody(request: Request) {
  try {
    const value: unknown = await request.json();
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}

export function textField(value: unknown, max: number) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 && text.length <= max ? text : null;
}

export function optionalText(value: unknown, max: number) {
  if (value === null || value === undefined || value === "") return null;
  return textField(value, max);
}

export function configuration(value: unknown) {
  return isRecord(value) ? value : null;
}
