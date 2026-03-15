import type { DesignDocument } from "./schema.js";

export const CURRENT_VERSION = "1.0.0";

/**
 * Migrate a DesignDocument to the current version.
 * Currently a no-op since we only have v1.0.0, but this provides
 * a hook for future format migrations.
 */
export function migrateDocument(doc: DesignDocument): DesignDocument {
  // Future migrations will be added here as version checks
  // e.g. if (doc.version === "0.9.0") { ... migrate ... }
  return {
    ...doc,
    version: CURRENT_VERSION,
  };
}
