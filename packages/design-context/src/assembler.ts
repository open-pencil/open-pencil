import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");

export interface KitContextEntry {
  kitName: string;
  kitDisplayName: string;
  category: string;
  components: Array<{ id: string; name: string; usageContext: string[] }>;
}

export interface AssembledContext {
  universal: Record<string, unknown>[];
  trends: Record<string, unknown>[];
  references: Record<string, unknown>[];
  taskTemplate: Record<string, unknown> | null;
  activeKits: KitContextEntry[];
}

export interface AssembleOptions {
  /** Limit universal categories to include */
  universalCategories?: string[];
  /** Limit trend pattern names to include */
  trendPatterns?: string[];
  /** Reference category to include */
  referenceCategory?: string;
  /** Task template type to include */
  taskType?: string;
  /** Active UI Kit names to include in context */
  activeKitNames?: string[];
}

function loadJsonDir(dir: string, filter?: string[]): Record<string, unknown>[] {
  const fs = require("node:fs") as typeof import("node:fs");
  const results: Record<string, unknown>[] = [];

  let entries: string[];
  try {
    entries = fs.readdirSync(dir).filter((f: string) => f.endsWith(".json"));
  } catch {
    return results;
  }

  for (const entry of entries) {
    const content = readFileSync(join(dir, entry), "utf-8");
    const parsed = JSON.parse(content) as Record<string, unknown>;

    if (filter) {
      const name = (parsed["category"] as string) ?? (parsed["name"] as string) ?? entry.replace(".json", "");
      if (!filter.some((f) => name.toLowerCase().includes(f.toLowerCase()))) {
        continue;
      }
    }

    results.push(parsed);
  }

  return results;
}

/**
 * Assemble design context by merging the 4 layers:
 * 1. Universal design rules
 * 2. Trend patterns
 * 3. Reference designs
 * 4. Task-specific template
 */
export function assembleContext(options?: AssembleOptions): AssembledContext {
  const universal = loadJsonDir(join(ROOT, "universal"), options?.universalCategories);
  const trends = loadJsonDir(join(ROOT, "trends", "patterns"), options?.trendPatterns);
  const references = loadJsonDir(join(ROOT, "trends", "references"), options?.referenceCategory ? [options.referenceCategory] : undefined);

  let taskTemplate: Record<string, unknown> | null = null;
  if (options?.taskType) {
    try {
      const content = readFileSync(join(ROOT, "task-templates", `${options.taskType}.json`), "utf-8");
      taskTemplate = JSON.parse(content) as Record<string, unknown>;
    } catch {
      // Template not found, leave as null
    }
  }

  // Load active kit context
  const activeKits: KitContextEntry[] = [];
  if (options?.activeKitNames && options.activeKitNames.length > 0) {
    const kitsRoot = join(ROOT, "..", "design-kits", "installed");
    for (const kitName of options.activeKitNames) {
      try {
        const kitJson = readFileSync(join(kitsRoot, kitName, "kit.json"), "utf-8");
        const kit = JSON.parse(kitJson) as {
          name: string;
          displayName: string;
          category: string;
          components: Array<{ id: string; name: string; usageContext: string[] }>;
        };
        activeKits.push({
          kitName: kit.name,
          kitDisplayName: kit.displayName,
          category: kit.category,
          components: kit.components.map((c) => ({
            id: c.id,
            name: c.name,
            usageContext: c.usageContext,
          })),
        });
      } catch {
        // Kit not found, skip
      }
    }
  }

  return {
    universal,
    trends,
    references,
    taskTemplate,
    activeKits,
  };
}
