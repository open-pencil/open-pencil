import { describe, expect, it } from "bun:test";
import type { DesignDocument } from "../schema.js";
import { serializeDesignDocument, serializeDesignDocumentCompact } from "../serializer.js";

const doc: DesignDocument = {
  version: "1.0.0",
  meta: { name: "Test", version: "1.0.0", createdAt: "2024-01-01", updatedAt: "2024-01-01" },
  variables: [{ name: "primary", value: "#0066ff", type: "color" }],
  children: [{ id: "r1", type: "rectangle", x: 0, y: 0, width: 100, height: 50 }],
};

describe("serializeDesignDocument", () => {
  it("produces valid JSON", () => {
    const json = serializeDesignDocument(doc);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("preserves key ordering (version first)", () => {
    const json = serializeDesignDocument(doc);
    const keys = Object.keys(JSON.parse(json));
    expect(keys[0]).toBe("version");
    expect(keys[1]).toBe("meta");
  });

  it("includes variables before children", () => {
    const json = serializeDesignDocument(doc);
    const keys = Object.keys(JSON.parse(json));
    const varsIndex = keys.indexOf("variables");
    const childrenIndex = keys.indexOf("children");
    expect(varsIndex).toBeLessThan(childrenIndex);
  });

  it("pretty-prints with indentation", () => {
    const json = serializeDesignDocument(doc);
    expect(json).toContain("\n");
    expect(json).toContain("  ");
  });
});

describe("serializeDesignDocumentCompact", () => {
  it("produces compact JSON without newlines", () => {
    const json = serializeDesignDocumentCompact(doc);
    expect(json).not.toContain("\n");
  });

  it("round-trips correctly", () => {
    const json = serializeDesignDocumentCompact(doc);
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe("1.0.0");
    expect(parsed.children.length).toBe(1);
  });
});
