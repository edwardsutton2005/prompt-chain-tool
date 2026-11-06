import { describe, expect, it } from "vitest";
import { renderTemplate, templateVariables } from "./template";

describe("prompt templates", () => {
  it("renders input and previous output", () => {
    expect(
      renderTemplate("Start: {{ input }}\nPrior: {{previous_output}}", {
        input: "campus",
        previous_output: "draft",
      })
    ).toBe("Start: campus\nPrior: draft");
  });

  it("rejects unknown variables", () => {
    expect(() =>
      renderTemplate("{{secret}}", { input: "", previous_output: "" })
    ).toThrow("Unknown template variable: secret");
  });

  it("lists variables", () => {
    expect(templateVariables("{{input}} {{ previous_output }}")).toEqual([
      "input",
      "previous_output",
    ]);
  });
});
