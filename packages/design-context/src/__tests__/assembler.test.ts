import { describe, expect, it } from "bun:test";
import { assembleContext } from "../assembler.js";

describe("assembleContext", () => {
  it("returns all layers without filters", () => {
    const ctx = assembleContext();
    expect(ctx.universal.length).toBeGreaterThan(0);
    expect(ctx.trends.length).toBeGreaterThan(0);
    expect(ctx.references.length).toBeGreaterThan(0);
    expect(ctx.taskTemplate).toBeNull();
  });

  it("filters universal categories", () => {
    const ctx = assembleContext({ universalCategories: ["typography"] });
    expect(ctx.universal.length).toBe(1);
    expect((ctx.universal[0] as Record<string, unknown>)["category"]).toBe("typography");
  });

  it("loads a task template", () => {
    const ctx = assembleContext({ taskType: "dashboard" });
    expect(ctx.taskTemplate).not.toBeNull();
    expect((ctx.taskTemplate as Record<string, unknown>)["taskType"]).toBe("dashboard");
  });

  it("returns null taskTemplate for unknown type", () => {
    const ctx = assembleContext({ taskType: "nonexistent-type" });
    expect(ctx.taskTemplate).toBeNull();
  });

  it("filters reference category", () => {
    const ctx = assembleContext({ referenceCategory: "e-commerce" });
    expect(ctx.references.length).toBe(1);
  });
});
