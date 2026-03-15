import type { DesignDocument } from "./schema.js";

const KEY_ORDER: readonly string[] = [
  "version",
  "meta",
  "designContext",
  "variables",
  "themes",
  "imports",
  "children",
];

function sortKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const sorted: Record<string, unknown> = {};

  // First pass: ordered keys
  for (const key of KEY_ORDER) {
    if (key in obj) {
      sorted[key] = obj[key];
    }
  }

  // Second pass: remaining keys alphabetically
  for (const key of Object.keys(obj).sort()) {
    if (!(key in sorted)) {
      sorted[key] = obj[key];
    }
  }

  return sorted;
}

/**
 * Serialize a DesignDocument to a pretty-printed JSON string
 * with a canonical key ordering.
 */
export function serializeDesignDocument(doc: DesignDocument): string {
  const ordered = sortKeys(doc as unknown as Record<string, unknown>);
  return JSON.stringify(ordered, null, 2);
}

/**
 * Serialize a DesignDocument to a compact (minified) JSON string.
 */
export function serializeDesignDocumentCompact(doc: DesignDocument): string {
  const ordered = sortKeys(doc as unknown as Record<string, unknown>);
  return JSON.stringify(ordered);
}
