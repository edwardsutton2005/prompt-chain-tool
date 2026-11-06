const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
const ALLOWED_VARIABLES = new Set(["input", "previous_output"]);

export function templateVariables(template: string) {
  return [...template.matchAll(VARIABLE_PATTERN)].map((match) => match[1]);
}

export function renderTemplate(
  template: string,
  variables: { input: string; previous_output: string }
) {
  const unknown = [...new Set(templateVariables(template).filter((name) => !ALLOWED_VARIABLES.has(name)))];
  if (unknown.length) {
    throw new Error(`Unknown template variable${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}`);
  }

  const rendered = template.replace(VARIABLE_PATTERN, (_match, name: keyof typeof variables) => variables[name] ?? "").trim();
  if (!rendered) throw new Error("The rendered prompt is empty.");
  return rendered;
}
