import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATES_DIR = join(__dirname, "..", "task-templates");

/**
 * Load a task template JSON by type name.
 * Returns the parsed template object or null if not found.
 */
export function getTaskContext(taskType: string): Record<string, unknown> | null {
  try {
    const content = readFileSync(join(TEMPLATES_DIR, `${taskType}.json`), "utf-8");
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}
