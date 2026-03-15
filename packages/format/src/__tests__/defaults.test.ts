import { beforeEach, describe, expect, it } from "bun:test";
import {
  createDefaultContext,
  createDefaultDocument,
  createDefaultEllipse,
  createDefaultFrame,
  createDefaultGroup,
  createDefaultIconFont,
  createDefaultLine,
  createDefaultMeta,
  createDefaultNote,
  createDefaultPath,
  createDefaultPolygon,
  createDefaultRectangle,
  createDefaultRef,
  createDefaultText,
  defaultNodeCreators,
  resetIdCounter,
} from "../defaults.js";

beforeEach(() => {
  resetIdCounter();
});

describe("createDefault* functions", () => {
  it("creates a default frame", () => {
    const frame = createDefaultFrame();
    expect(frame.type).toBe("frame");
    expect(frame.children).toEqual([]);
    expect(frame.width).toBe(400);
  });

  it("creates a default rectangle", () => {
    const rect = createDefaultRectangle();
    expect(rect.type).toBe("rectangle");
    expect(rect.width).toBe(100);
  });

  it("creates a default ellipse", () => {
    const ellipse = createDefaultEllipse();
    expect(ellipse.type).toBe("ellipse");
  });

  it("creates a default text node", () => {
    const text = createDefaultText();
    expect(text.type).toBe("text");
    expect(text.content).toBe("Text");
    expect(text.fontSize).toBe(16);
  });

  it("creates a default line", () => {
    const line = createDefaultLine();
    expect(line.type).toBe("line");
    expect(line.x2).toBe(100);
  });

  it("creates a default path", () => {
    const path = createDefaultPath();
    expect(path.type).toBe("path");
    expect(path.d).toBe("M0 0");
  });

  it("creates a default polygon", () => {
    const polygon = createDefaultPolygon();
    expect(polygon.type).toBe("polygon");
    expect(polygon.sides).toBe(3);
  });

  it("creates a default group", () => {
    const group = createDefaultGroup();
    expect(group.type).toBe("group");
    expect(group.children).toEqual([]);
  });

  it("creates a default icon font node", () => {
    const icon = createDefaultIconFont();
    expect(icon.type).toBe("icon_font");
    expect(icon.icon).toBe("star");
  });

  it("creates a default ref node", () => {
    const ref = createDefaultRef();
    expect(ref.type).toBe("ref");
    expect(ref.refId).toBe("");
  });

  it("creates a default note node", () => {
    const note = createDefaultNote();
    expect(note.type).toBe("note");
  });

  it("creates a default context node", () => {
    const ctx = createDefaultContext();
    expect(ctx.type).toBe("context");
  });

  it("generates unique IDs", () => {
    const a = createDefaultRectangle();
    const b = createDefaultRectangle();
    expect(a.id).not.toBe(b.id);
  });

  it("applies overrides", () => {
    const rect = createDefaultRectangle({ width: 999, name: "custom" });
    expect(rect.width).toBe(999);
    expect(rect.name).toBe("custom");
    expect(rect.type).toBe("rectangle");
  });
});

describe("createDefaultMeta", () => {
  it("creates valid meta", () => {
    const meta = createDefaultMeta();
    expect(meta.name).toBe("Untitled");
    expect(meta.createdAt).toBeTruthy();
  });
});

describe("createDefaultDocument", () => {
  it("creates valid document", () => {
    const doc = createDefaultDocument();
    expect(doc.version).toBe("1.0.0");
    expect(doc.children).toEqual([]);
  });
});

describe("defaultNodeCreators", () => {
  it("has all 12 node types", () => {
    expect(Object.keys(defaultNodeCreators).length).toBe(12);
  });

  it("each creator returns correct type", () => {
    for (const [type, creator] of Object.entries(defaultNodeCreators)) {
      const node = creator();
      expect(node.type).toBe(type);
    }
  });
});
