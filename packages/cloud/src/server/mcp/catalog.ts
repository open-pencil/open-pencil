import * as v from 'valibot'

import catalog from './design-tools.json'

const designToolSchema = v.object({
  name: v.string(),
  description: v.string(),
  /** Whether the tool changes the document, so an app needs `documents:write` to call it. */
  mutates: v.boolean(),
  /** Whether it changes nothing at all, not even what the editor shows. */
  readOnly: v.boolean(),
  /** Its input as MCP clients read it, a JSON Schema object; the editor that runs it checks calls. */
  inputSchema: v.looseObject({ properties: v.optional(v.record(v.string(), v.unknown()), {}) })
})
export type DesignTool = v.InferOutput<typeof designToolSchema>

/**
 * The design tools apps run on documents through an editor, generated from Core's tools
 * (`bun run generate:mcp-catalog`): the server holds no editor, so it knows them from this list.
 */
export const DESIGN_TOOLS: readonly DesignTool[] = v.parse(v.array(designToolSchema), catalog)

const byName = new Map(DESIGN_TOOLS.map((tool) => [tool.name, tool]))

/** The design tool of that name, if there is one. */
export function designTool(name: string): DesignTool | undefined {
  return byName.get(name)
}

/** Whether a tool takes a `path` of its own, as vector tools do. */
export function takesPath(tool: DesignTool): boolean {
  return 'path' in tool.inputSchema.properties
}
