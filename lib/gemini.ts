type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
};

export type InlineImage = { mimeType: "image/jpeg" | "image/png" | "image/webp"; data: string };

export async function generateGeminiText(options: {
  model: string;
  systemInstruction?: string;
  prompt: string;
  maxOutputTokens: number;
  temperature: number;
  image?: InlineImage;
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");
  if (!/^[a-zA-Z0-9._-]{1,200}$/.test(options.model)) throw new Error("The model identifier is invalid.");

  const startedAt = Date.now();
  const parts: Array<Record<string, unknown>> = [{ text: options.prompt }];
  if (options.image) {
    parts.push({ inline_data: { mime_type: options.image.mimeType, data: options.image.data } });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${options.model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        ...(options.systemInstruction
          ? { system_instruction: { parts: [{ text: options.systemInstruction }] } }
          : {}),
        contents: [{ role: "user", parts }],
        generationConfig: {
          maxOutputTokens: options.maxOutputTokens,
          temperature: options.temperature,
        },
      }),
    }
  );

  const latencyMs = Date.now() - startedAt;
  if (!response.ok) throw new Error(`Gemini returned HTTP ${response.status}.`);

  const data = (await response.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();
  if (!text) throw new Error("Gemini returned no text.");

  return {
    text,
    metadata: {
      finishReason: data.candidates?.[0]?.finishReason ?? null,
      inputTokens: data.usageMetadata?.promptTokenCount ?? null,
      outputTokens: data.usageMetadata?.candidatesTokenCount ?? null,
      latencyMs,
      providerRequestId: response.headers.get("x-request-id"),
    },
  };
}
