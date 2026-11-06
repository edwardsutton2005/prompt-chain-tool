import { describe, expect, it } from "vitest";
import {
  buildStepInvocation,
  parseInlineImage,
  resolveGenerationSettings,
} from "./execution";

describe("execution helpers", () => {
  it("uses step settings over chain defaults", () => {
    expect(
      resolveGenerationSettings(
        { temperature: 0.2, maxOutputTokens: 200 },
        { temperature: 0.9, maxOutputTokens: 900 }
      )
    ).toEqual({ temperature: 0.2, maxOutputTokens: 200 });
  });

  it("falls back when settings are out of range", () => {
    expect(
      resolveGenerationSettings(
        { temperature: 7, maxOutputTokens: -1 },
        { temperature: 0.7, maxOutputTokens: 700 }
      )
    ).toEqual({ temperature: 0.7, maxOutputTokens: 700 });
  });

  it("uses a system template as an instruction", () => {
    expect(buildStepInvocation("system", "Be concise", "input", "prior")).toEqual({
      systemInstruction: "Be concise",
      prompt: "prior",
    });
  });

  it("validates inline image types", () => {
    expect(() => parseInlineImage({ mimeType: "image/gif", data: "abc" })).toThrow(
      "Use a JPEG, PNG, or WebP image."
    );
    expect(
      parseInlineImage({ mimeType: "image/png", data: "data:image/png;base64,YWJj" })
    ).toMatchObject({ mimeType: "image/png", data: "YWJj" });
  });
});
