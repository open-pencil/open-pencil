import { documentKindSchema } from '#cloud/contract'
import * as v from 'valibot'

import catalog from './design-tools.json'

const designToolSchema = v.object({
  name: v.string(),
  description: v.string(),
  /** Whether the tool changes the document, so an app needs `documents:write` to call it. */
  mutates: v.boolean(),
  /** Whether it changes nothing at all, not even what the editor shows. */
  readOnly: v.boolean(),
  /** The kinds of document it works on, such as decks for the slide tools, or null for every kind. */
  documentKinds: v.nullable(v.array(documentKindSchema)),
  /** Its input as MCP clients read it, a JSON Schema object; the editor that runs it checks calls. */
  inputSchema: v.looseObject({ properties: v.optional(v.record(v.string(), v.unknown()), {}) })
})
export type DesignTool = v.InferOutput<typeof designToolSchema>

const catalogSchema = v.object({
  /** The local MCP server's words on which design tools read, build, and change a design. */
  instructions: v.string(),
  tools: v.array(designToolSchema)
})

/**
 * Core's design tools as the package's build writes them (`tools/generate/mcp-catalog`): the server
 * holds no editor, so it knows them from this list.
 */
const { instructions, tools } = v.parse(catalogSchema, catalog)

/** The design tools apps run on documents through an editor. */
export const DESIGN_TOOLS: readonly DesignTool[] = tools

/** Which design tools read, build, and change a design, as the local MCP server says it. */
export const DESIGN_TOOLS_INSTRUCTIONS = instructions

const byName = new Map(DESIGN_TOOLS.map((tool) => [tool.name, tool]))

/** The design tool of that name, if there is one. */
export function designTool(name: string): DesignTool | undefined {
  return byName.get(name)
}

/** Whether a tool takes a `path` of its own, as vector tools do. */
export function takesPath(tool: DesignTool): boolean {
  return 'path' in tool.inputSchema.properties
}
