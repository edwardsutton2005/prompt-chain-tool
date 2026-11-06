import type { InlineImage } from "./gemini";
import { isRecord } from "./validation";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function numberSetting(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max
    ? value
    : fallback;
}

export function parseInlineImage(value: unknown): (InlineImage & { size: number }) | undefined {
  if (value === null || value === undefined) return undefined;
  if (!isRecord(value) || typeof value.mimeType !== "string" || typeof value.data !== "string") {
    throw new Error("The image payload is invalid.");
  }
  if (!IMAGE_TYPES.has(value.mimeType)) throw new Error("Use a JPEG, PNG, or WebP image.");
  const data = value.data.replace(/^data:[^;]+;base64,/, "");
  const size = Math.floor((data.length * 3) / 4);
  if (!data || size > MAX_IMAGE_BYTES) throw new Error("Images must be 5 MB or smaller.");
  return { mimeType: value.mimeType as InlineImage["mimeType"], data, size };
}

export function resolveGenerationSettings(stepValue: unknown, chainValue: unknown) {
  const step = isRecord(stepValue) ? stepValue : {};
  const chain = isRecord(chainValue) ? chainValue : {};
  return {
    temperature: numberSetting(
      step.temperature,
      numberSetting(chain.temperature, 0.8, 0, 2),
      0,
      2
    ),
    maxOutputTokens: numberSetting(
      step.maxOutputTokens,
      numberSetting(chain.maxOutputTokens, 512, 1, 8192),
      1,
      8192
    ),
  };
}

export function buildStepInvocation(
  role: "system" | "user" | "assistant",
  rendered: string,
  input: string,
  previousOutput: string
) {
  if (role === "system") {
    return { systemInstruction: rendered, prompt: previousOutput || input };
  }
  if (role === "assistant") {
    return {
      systemInstruction: undefined,
      prompt: `Continue from this assistant context:\n${rendered}`,
    };
  }
  return { systemInstruction: undefined, prompt: rendered };
}
