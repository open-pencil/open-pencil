import { describe, expect, it } from "bun:test";
import type { DesignDocument } from "../schema.js";
import { validateDesignDocument } from "../validator.js";

function makeDoc(overrides?: Partial<DesignDocument>): DesignDocument {
  return {
    version: "1.0.0",
    meta: { name: "Test", version: "1.0.0", createdAt: "2024-01-01", updatedAt: "2024-01-01" },
    children: [],
    ...overrides,
  };
}

describe("validateDesignDocument", () => {
  it("returns no issues for a valid document", () => {
    const doc = makeDoc({
      children: [{ id: "r1", type: "rectangle", x: 0, y: 0, width: 100, height: 100 }],
    });
    const issues = validateDesignDocument(doc);
    expect(issues).toEqual([]);
  });

  it("detects duplicate IDs", () => {
    const doc = makeDoc({
      children: [
        { id: "dup", type: "rectangle", x: 0, y: 0, width: 100, height: 100 },
        { id: "dup", type: "ellipse", x: 0, y: 0, width: 50, height: 50 },
      ],
    });
    const issues = validateDesignDocument(doc);
    expect(issues.some((i) => i.level === "error" && i.message.includes("Duplicate ID"))).toBe(true);
  });

  it("detects broken refs", () => {
    const doc = makeDoc({
      children: [{ id: "ref1", type: "ref", x: 0, y: 0, width: 100, height: 100, refId: "nonexistent" }],
    });
    const issues = validateDesignDocument(doc);
    expect(issues.some((i) => i.level === "error" && i.message.includes("Broken ref"))).toBe(true);
  });

  it("warns about missing variables", () => {
    const doc = makeDoc({
      children: [
        {
          id: "t1",
          type: "text",
          x: 0,
          y: 0,
          width: 200,
          height: 24,
          content: "$greeting",
        },
      ],
    });
    const issues = validateDesignDocument(doc);
    expect(issues.some((i) => i.level === "warning" && i.message.includes("Variable"))).toBe(true);
  });

  it("does not warn for defined variables", () => {
    const doc = makeDoc({
      variables: [{ name: "greeting", value: "Hello", type: "string" }],
      children: [
        {
          id: "t1",
          type: "text",
          x: 0,
          y: 0,
          width: 200,
          height: 24,
          content: "$greeting",
        },
      ],
    });
    const issues = validateDesignDocument(doc);
    expect(issues.filter((i) => i.message.includes("Variable")).length).toBe(0);
  });

  it("returns empty for an empty document", () => {
    const doc = makeDoc();
    const issues = validateDesignDocument(doc);
    expect(issues).toEqual([]);
  });
});
