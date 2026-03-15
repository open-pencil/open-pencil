import type { DesignDocument, DesignNode, NodeType } from "./schema.js";

const VALID_NODE_TYPES: ReadonlySet<string> = new Set<NodeType>([
  "frame",
  "rectangle",
  "ellipse",
  "text",
  "line",
  "path",
  "polygon",
  "group",
  "icon_font",
  "ref",
  "note",
  "context",
]);

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}

function validateNode(node: unknown, path: string): void {
  if (typeof node !== "object" || node === null) {
    throw new ParseError(`Invalid node at ${path}: expected an object`);
  }

  const n = node as Record<string, unknown>;

  if (typeof n["id"] !== "string" || n["id"].length === 0) {
    throw new ParseError(`Invalid node at ${path}: missing or empty "id"`);
  }

  if (typeof n["type"] !== "string" || !VALID_NODE_TYPES.has(n["type"])) {
    throw new ParseError(`Invalid node at ${path}: invalid type "${String(n["type"])}"`);
  }

  // Validate children recursively for container nodes
  if (Array.isArray(n["children"])) {
    for (let i = 0; i < n["children"].length; i++) {
      validateNode(n["children"][i], `${path}.children[${i}]`);
    }
  }
}

/**
 * Parse a JSON string into a DesignDocument with structural validation.
 */
export function parseDesignDocument(json: string): DesignDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new ParseError("Invalid JSON: could not parse input");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new ParseError("Invalid document: expected a top-level object");
  }

  const doc = parsed as Record<string, unknown>;

  // Validate version
  if (typeof doc["version"] !== "string") {
    throw new ParseError('Invalid document: missing "version" field');
  }

  // Validate meta
  if (typeof doc["meta"] !== "object" || doc["meta"] === null) {
    throw new ParseError('Invalid document: missing "meta" field');
  }

  const meta = doc["meta"] as Record<string, unknown>;
  if (typeof meta["name"] !== "string") {
    throw new ParseError('Invalid document: meta.name must be a string');
  }

  // Validate children
  if (!Array.isArray(doc["children"])) {
    throw new ParseError('Invalid document: "children" must be an array');
  }

  const children = doc["children"] as unknown[];
  for (let i = 0; i < children.length; i++) {
    validateNode(children[i], `children[${i}]`);
  }

  return parsed as DesignDocument;
}
