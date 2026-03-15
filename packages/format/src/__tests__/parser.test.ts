import { describe, expect, it } from "bun:test";
import { ParseError, parseDesignDocument } from "../parser.js";

const minimalDoc = JSON.stringify({
  version: "1.0.0",
  meta: { name: "Test", version: "1.0.0", createdAt: "2024-01-01", updatedAt: "2024-01-01" },
  children: [],
});

describe("parseDesignDocument", () => {
  it("parses a minimal valid document", () => {
    const doc = parseDesignDocument(minimalDoc);
    expect(doc.version).toBe("1.0.0");
    expect(doc.meta.name).toBe("Test");
    expect(doc.children).toEqual([]);
  });

  it("parses a document with nodes", () => {
    const input = JSON.stringify({
      version: "1.0.0",
      meta: { name: "Test", version: "1.0.0", createdAt: "2024-01-01", updatedAt: "2024-01-01" },
      children: [
        { id: "r1", type: "rectangle", x: 0, y: 0, width: 100, height: 100 },
        {
          id: "f1",
          type: "frame",
          x: 0,
          y: 0,
          width: 400,
          height: 300,
          children: [{ id: "t1", type: "text", x: 0, y: 0, width: 200, height: 24, content: "Hi" }],
        },
      ],
    });
    const doc = parseDesignDocument(input);
    expect(doc.children.length).toBe(2);
  });

  it("throws ParseError on invalid JSON", () => {
    expect(() => parseDesignDocument("{broken")).toThrow(ParseError);
  });

  it("throws ParseError when version is missing", () => {
    expect(() =>
      parseDesignDocument(JSON.stringify({ meta: { name: "X" }, children: [] }))
    ).toThrow(ParseError);
  });

  it("throws ParseError when meta is missing", () => {
    expect(() =>
      parseDesignDocument(JSON.stringify({ version: "1.0.0", children: [] }))
    ).toThrow(ParseError);
  });

  it("throws ParseError when children is missing", () => {
    expect(() =>
      parseDesignDocument(
        JSON.stringify({ version: "1.0.0", meta: { name: "X", version: "1.0.0", createdAt: "", updatedAt: "" } })
      )
    ).toThrow(ParseError);
  });

  it("throws ParseError for invalid node type", () => {
    expect(() =>
      parseDesignDocument(
        JSON.stringify({
          version: "1.0.0",
          meta: { name: "X", version: "1.0.0", createdAt: "", updatedAt: "" },
          children: [{ id: "x", type: "banana", x: 0, y: 0, width: 10, height: 10 }],
        })
      )
    ).toThrow(ParseError);
  });

  it("throws ParseError for node without id", () => {
    expect(() =>
      parseDesignDocument(
        JSON.stringify({
          version: "1.0.0",
          meta: { name: "X", version: "1.0.0", createdAt: "", updatedAt: "" },
          children: [{ type: "rectangle", x: 0, y: 0, width: 10, height: 10 }],
        })
      )
    ).toThrow(ParseError);
  });
});
