import { describe, it, expect } from "bun:test";
import { toDesign, toGraph } from "../converter.js";
import type { DesignDocument, FrameNode, TextNode, RectangleNode } from "../schema.js";

// Helper: create a minimal GraphNode-compatible object
function makeGraphNode(overrides: Record<string, unknown> = {}) {
  return {
    id: "1:1",
    type: "FRAME",
    name: "Test Frame",
    parentId: null,
    childIds: [],
    x: 100, y: 200, width: 300, height: 400, rotation: 0,
    fills: [{ type: "SOLID", color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }],
    strokes: [],
    effects: [],
    opacity: 1,
    cornerRadius: 8, topLeftRadius: 8, topRightRadius: 8, bottomRightRadius: 8, bottomLeftRadius: 8,
    independentCorners: false,
    visible: true, locked: false, clipsContent: false, blendMode: "NORMAL",
    text: "", fontSize: 16, fontFamily: "Inter", fontWeight: 400, italic: false,
    textAlignHorizontal: "LEFT", textAlignVertical: "TOP", textAutoResize: "NONE",
    lineHeight: null, letterSpacing: 0, maxLines: null,
    layoutMode: "VERTICAL", primaryAxisAlign: "MIN", counterAxisAlign: "MIN",
    itemSpacing: 16, paddingTop: 24, paddingRight: 24, paddingBottom: 24, paddingLeft: 24,
    componentId: null, pointCount: 3, arcData: null, boundVariables: {}, vectorNetwork: null,
    ...overrides,
  };
}

describe("toDesign", () => {
  it("converts a simple frame", () => {
    const nodeMap = new Map();
    nodeMap.set("1:1", makeGraphNode());

    const doc = toDesign({ name: "Test", nodeMap });
    expect(doc.version).toBe("0.1.0");
    expect(doc.meta.name).toBe("Test");
    expect(doc.children).toHaveLength(1);

    const frame = doc.children[0] as FrameNode;
    expect(frame.type).toBe("frame");
    expect(frame.x).toBe(100);
    expect(frame.y).toBe(200);
    expect(frame.width).toBe(300);
    expect(frame.height).toBe(400);
    expect(frame.fill).toBe("#ff0000");
    expect(frame.cornerRadius).toBe(8);
    expect(frame.layout).toBe("vertical");
    expect(frame.gap).toBe(16);
  });

  it("converts fills correctly", () => {
    const nodeMap = new Map();
    nodeMap.set("1:1", makeGraphNode({
      fills: [
        { type: "SOLID", color: { r: 0, g: 0.5, b: 1, a: 1 }, opacity: 0.8, visible: true },
      ],
    }));

    const doc = toDesign({ nodeMap });
    const frame = doc.children[0]!;
    expect(frame.fill).toEqual({ type: "color", color: "#0080ff", opacity: 0.8 });
  });

  it("converts strokes", () => {
    const nodeMap = new Map();
    nodeMap.set("1:1", makeGraphNode({
      strokes: [{ color: { r: 1, g: 1, b: 1, a: 1 }, weight: 2, opacity: 1, visible: true, align: "INSIDE" }],
    }));

    const doc = toDesign({ nodeMap });
    expect(doc.children[0]!.stroke).toEqual({
      color: "#ffffff", width: 2, style: "solid", position: "inside", opacity: 1,
    });
  });

  it("converts effects (shadow + blur)", () => {
    const nodeMap = new Map();
    nodeMap.set("1:1", makeGraphNode({
      effects: [
        { type: "DROP_SHADOW", color: { r: 0, g: 0, b: 0, a: 0.5 }, offset: { x: 0, y: 4 }, radius: 8, spread: 0, visible: true },
        { type: "LAYER_BLUR", color: { r: 0, g: 0, b: 0, a: 0 }, offset: { x: 0, y: 0 }, radius: 4, spread: 0, visible: true },
      ],
    }));

    const doc = toDesign({ nodeMap });
    const effects = doc.children[0]!.effect;
    expect(Array.isArray(effects)).toBe(true);
    if (Array.isArray(effects)) {
      expect(effects).toHaveLength(2);
      expect(effects[0]!.type).toBe("shadow");
      expect(effects[1]!.type).toBe("blur");
    }
  });

  it("converts text node", () => {
    const nodeMap = new Map();
    nodeMap.set("1:1", makeGraphNode({
      type: "TEXT",
      text: "Hello World",
      fontSize: 24,
      fontFamily: "Roboto",
      fontWeight: 700,
      textAlignHorizontal: "CENTER",
    }));

    const doc = toDesign({ nodeMap });
    const text = doc.children[0] as TextNode;
    expect(text.type).toBe("text");
    expect(text.content).toBe("Hello World");
    expect(text.fontSize).toBe(24);
    expect(text.fontFamily).toBe("Roboto");
    expect(text.fontWeight).toBe("700");
    expect(text.textAlign).toBe("center");
  });

  it("marks COMPONENT as reusable", () => {
    const nodeMap = new Map();
    nodeMap.set("1:1", makeGraphNode({ type: "COMPONENT" }));

    const doc = toDesign({ nodeMap });
    expect(doc.children[0]!.reusable).toBe(true);
  });

  it("converts INSTANCE to ref node", () => {
    const nodeMap = new Map();
    nodeMap.set("1:1", makeGraphNode({ type: "INSTANCE", componentId: "comp:1" }));

    const doc = toDesign({ nodeMap });
    expect(doc.children[0]!.type).toBe("ref");
    expect((doc.children[0] as { ref: string }).ref).toBe("comp:1");
  });

  it("converts layout properties", () => {
    const nodeMap = new Map();
    nodeMap.set("1:1", makeGraphNode({
      layoutMode: "HORIZONTAL",
      primaryAxisAlign: "SPACE_BETWEEN",
      counterAxisAlign: "CENTER",
      paddingTop: 8, paddingRight: 16, paddingBottom: 8, paddingLeft: 16,
    }));

    const doc = toDesign({ nodeMap });
    const frame = doc.children[0] as FrameNode;
    expect(frame.layout).toBe("horizontal");
    expect(frame.justifyContent).toBe("space-between");
    expect(frame.alignItems).toBe("center");
    expect(frame.padding).toEqual([8, 16]);
  });

  it("handles parent-child relationships", () => {
    const nodeMap = new Map();
    nodeMap.set("1:1", makeGraphNode({ childIds: ["1:2", "1:3"] }));
    nodeMap.set("1:2", makeGraphNode({ id: "1:2", type: "RECTANGLE", parentId: "1:1", name: "Rect" }));
    nodeMap.set("1:3", makeGraphNode({ id: "1:3", type: "TEXT", parentId: "1:1", name: "Label", text: "Hi" }));

    const doc = toDesign({ nodeMap });
    const frame = doc.children[0] as FrameNode;
    expect(frame.children).toHaveLength(2);
    expect(frame.children![0]!.type).toBe("rectangle");
    expect(frame.children![1]!.type).toBe("text");
  });
});

describe("toGraph", () => {
  it("converts a simple .design document to graph nodes", () => {
    const doc: DesignDocument = {
      version: "0.1.0",
      meta: { name: "Test", created: "", modified: "", generator: "test" },
      children: [
        { id: "f1", type: "frame", x: 10, y: 20, width: 100, height: 200, fill: "#ff0000", children: [] } as FrameNode,
      ],
    };

    const nodes = toGraph(doc);
    expect(nodes.length).toBeGreaterThanOrEqual(1);
    const frame = nodes[0]!;
    expect(frame.type).toBe("FRAME");
    expect(frame.x).toBe(10);
    expect(frame.width).toBe(100);
    expect(frame.fills).toHaveLength(1);
    expect(frame.fills[0]!.type).toBe("SOLID");
  });

  it("converts text nodes", () => {
    const doc: DesignDocument = {
      version: "0.1.0",
      meta: { name: "T", created: "", modified: "", generator: "test" },
      children: [
        { id: "t1", type: "text", content: "Hello", fontSize: 24, fontWeight: "700", textAlign: "center" } as TextNode,
      ],
    };

    const nodes = toGraph(doc);
    const text = nodes[0]!;
    expect(text.type).toBe("TEXT");
    expect(text.text).toBe("Hello");
    expect(text.fontSize).toBe(24);
    expect(text.fontWeight).toBe(700);
    expect(text.textAlignHorizontal).toBe("CENTER");
  });

  it("preserves parent-child relationships", () => {
    const doc: DesignDocument = {
      version: "0.1.0",
      meta: { name: "T", created: "", modified: "", generator: "test" },
      children: [
        {
          id: "f1", type: "frame", width: 100, height: 100, children: [
            { id: "r1", type: "rectangle", width: 50, height: 50 } as RectangleNode,
          ],
        } as FrameNode,
      ],
    };

    const nodes = toGraph(doc);
    const frame = nodes.find((n) => n.id === "f1")!;
    const rect = nodes.find((n) => n.id === "r1")!;
    expect(frame.childIds).toContain("r1");
    expect(rect.parentId).toBe("f1");
  });
});

describe("round-trip", () => {
  it("toDesign → toGraph preserves core properties", () => {
    const nodeMap = new Map();
    nodeMap.set("1:1", makeGraphNode({
      fills: [{ type: "SOLID", color: { r: 0.5, g: 0.5, b: 0.5, a: 1 }, opacity: 1, visible: true }],
    }));

    const doc = toDesign({ name: "RT", nodeMap });
    const graphNodes = toGraph(doc);
    const frame = graphNodes[0]!;

    expect(frame.type).toBe("FRAME");
    expect(frame.x).toBe(100);
    expect(frame.y).toBe(200);
    expect(frame.width).toBe(300);
    expect(frame.height).toBe(400);
    expect(frame.fills).toHaveLength(1);
    expect(frame.fills[0]!.type).toBe("SOLID");
  });
});
