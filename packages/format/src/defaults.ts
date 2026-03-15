import type {
  ContextNode,
  DesignDocument,
  DesignNode,
  DocumentMeta,
  EllipseNode,
  FrameNode,
  GroupNode,
  IconFontNode,
  LineNode,
  NodeType,
  NoteNode,
  PathNode,
  PolygonNode,
  RectangleNode,
  RefNode,
  TextNode,
} from "./schema.js";

let idCounter = 0;

function nextId(): string {
  idCounter += 1;
  return `node_${idCounter}`;
}

/** Reset the internal counter (useful for tests). */
export function resetIdCounter(): void {
  idCounter = 0;
}

export function createDefaultFrame(overrides?: Partial<FrameNode>): FrameNode {
  return {
    id: nextId(),
    type: "frame",
    x: 0,
    y: 0,
    width: 400,
    height: 300,
    children: [],
    ...overrides,
    // ensure type is never overridden
    type: "frame",
  } satisfies FrameNode;
}

export function createDefaultRectangle(overrides?: Partial<RectangleNode>): RectangleNode {
  return {
    id: nextId(),
    type: "rectangle",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    ...overrides,
    type: "rectangle",
  } satisfies RectangleNode;
}

export function createDefaultEllipse(overrides?: Partial<EllipseNode>): EllipseNode {
  return {
    id: nextId(),
    type: "ellipse",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    ...overrides,
    type: "ellipse",
  } satisfies EllipseNode;
}

export function createDefaultText(overrides?: Partial<TextNode>): TextNode {
  return {
    id: nextId(),
    type: "text",
    x: 0,
    y: 0,
    width: 200,
    height: 24,
    content: "Text",
    fontSize: 16,
    fontFamily: "Inter",
    fontWeight: 400,
    ...overrides,
    type: "text",
  } satisfies TextNode;
}

export function createDefaultLine(overrides?: Partial<LineNode>): LineNode {
  return {
    id: nextId(),
    type: "line",
    x: 0,
    y: 0,
    width: 100,
    height: 0,
    x2: 100,
    y2: 0,
    ...overrides,
    type: "line",
  } satisfies LineNode;
}

export function createDefaultPath(overrides?: Partial<PathNode>): PathNode {
  return {
    id: nextId(),
    type: "path",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    d: "M0 0",
    ...overrides,
    type: "path",
  } satisfies PathNode;
}

export function createDefaultPolygon(overrides?: Partial<PolygonNode>): PolygonNode {
  return {
    id: nextId(),
    type: "polygon",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    sides: 3,
    ...overrides,
    type: "polygon",
  } satisfies PolygonNode;
}

export function createDefaultGroup(overrides?: Partial<GroupNode>): GroupNode {
  return {
    id: nextId(),
    type: "group",
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    children: [],
    ...overrides,
    type: "group",
  } satisfies GroupNode;
}

export function createDefaultIconFont(overrides?: Partial<IconFontNode>): IconFontNode {
  return {
    id: nextId(),
    type: "icon_font",
    x: 0,
    y: 0,
    width: 24,
    height: 24,
    icon: "star",
    ...overrides,
    type: "icon_font",
  } satisfies IconFontNode;
}

export function createDefaultRef(overrides?: Partial<RefNode>): RefNode {
  return {
    id: nextId(),
    type: "ref",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    refId: "",
    ...overrides,
    type: "ref",
  } satisfies RefNode;
}

export function createDefaultNote(overrides?: Partial<NoteNode>): NoteNode {
  return {
    id: nextId(),
    type: "note",
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    content: "",
    ...overrides,
    type: "note",
  } satisfies NoteNode;
}

export function createDefaultContext(overrides?: Partial<ContextNode>): ContextNode {
  return {
    id: nextId(),
    type: "context",
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    description: "",
    ...overrides,
    type: "context",
  } satisfies ContextNode;
}

export function createDefaultMeta(overrides?: Partial<DocumentMeta>): DocumentMeta {
  const now = new Date().toISOString();
  return {
    name: "Untitled",
    version: "1.0.0",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createDefaultDocument(overrides?: Partial<DesignDocument>): DesignDocument {
  return {
    version: "1.0.0",
    meta: createDefaultMeta(),
    children: [],
    ...overrides,
  };
}

type NodeCreator = (overrides?: Partial<DesignNode>) => DesignNode;

export const defaultNodeCreators: Record<NodeType, NodeCreator> = {
  frame: createDefaultFrame as NodeCreator,
  rectangle: createDefaultRectangle as NodeCreator,
  ellipse: createDefaultEllipse as NodeCreator,
  text: createDefaultText as NodeCreator,
  line: createDefaultLine as NodeCreator,
  path: createDefaultPath as NodeCreator,
  polygon: createDefaultPolygon as NodeCreator,
  group: createDefaultGroup as NodeCreator,
  icon_font: createDefaultIconFont as NodeCreator,
  ref: createDefaultRef as NodeCreator,
  note: createDefaultNote as NodeCreator,
  context: createDefaultContext as NodeCreator,
};
