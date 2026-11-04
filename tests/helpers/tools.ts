import { FigmaAPI } from '@open-pencil/core/figma-api'
import { ALL_TOOLS, toolFailure } from '@open-pencil/core/tools'
import { SceneGraph } from '@open-pencil/scene-graph'

export { ALL_TOOLS }

import { expectDefined } from './assert'

export interface ToolResult {
  id?: string
  name?: string
  type?: string
  error?: string
  count?: number
  nodes?: Array<{ id?: string; name: string; type: string; text?: string }>
  [key: string]: unknown
}

export function setupToolTest() {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  return { graph, figma }
}

export function getTool(name: string): (typeof ALL_TOOLS)[number] {
  return expectDefined(
    ALL_TOOLS.find((tool) => tool.name === name),
    `tool ${name}`
  )
}

/**
 * Runs a tool as the app's runner does: the fonts its text edits need load first, and one that
 * cannot load is the call's error.
 */
export async function runTool(
  figma: FigmaAPI,
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const tool = getTool(name)
  try {
    await tool.loadFonts(figma, args)
  } catch (error) {
    return toolFailure(error)
  }
  return tool.execute(figma, args)
}
