import { defineCommand } from 'citty'

import { loadDocument } from '../headless'
import { isAppMode, requireFile, rpc } from '../app-client'
import { fmtNode, printError, formatType } from '../format'
import { executeRpcCommand, colorToHex } from '@open-pencil/core'

import type { Color, NodeResult } from '@open-pencil/core'

async function getData(file: string | undefined, id: string): Promise<NodeResult | { error: string }> {
  if (isAppMode(file)) return rpc<NodeResult>('node', { id })
  const graph = await loadDocument(requireFile(file))
  return executeRpcCommand(graph, 'node', { id }) as NodeResult | { error: string }
}

export default defineCommand({
  meta: { description: 'Show detailed node properties by ID' },
  args: {
    file: { type: 'positional', description: '.fig file path (omit to connect to running app)', required: false },
    id: { type: 'string', description: 'Node ID', required: true },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    const data = await getData(args.file, args.id)

    if ('error' in data) {
      printError(data.error)
      process.exit(1)
    }

    if (args.json) {
      console.log(JSON.stringify(data, null, 2))
      return
    }

    const nodeData = {
      type: formatType(data.type),
      name: data.name,
      id: data.id,
      width: data.width,
      height: data.height,
      x: data.x,
      y: data.y
    }

    const details: Record<string, unknown> = {}
    if (data.parent) details.parent = `${data.parent.name} (${data.parent.id})`
    if (data.text) details.text = data.text
    if (data.fills.length > 0) {
      const solid = (data.fills as Array<{ type: string; visible: boolean; color: Color; opacity: number }>)
        .find((f) => f.type === 'SOLID' && f.visible)
      if (solid) {
        const hex = colorToHex(solid.color)
        details.fill = solid.opacity < 1 ? `${hex} ${Math.round(solid.opacity * 100)}%` : hex
      }
    }
    if (data.cornerRadius) details.radius = `${data.cornerRadius}px`
    if (data.rotation) details.rotate = `${Math.round(data.rotation)}°`
    if (data.opacity < 1) details.opacity = data.opacity
    if (!data.visible) details.visible = false
    if (data.locked) details.locked = true
    if (data.fontFamily) details.font = `${data.fontSize}px ${data.fontFamily}`
    if (data.layoutMode !== 'NONE') details.layout = data.layoutMode.toLowerCase()
    if (data.children > 0) details.children = data.children
    for (const [field, name] of Object.entries(data.boundVariables)) {
      details[`var:${field}`] = name
    }

    console.log('')
    console.log(fmtNode(nodeData, details))
    console.log('')
  }
})
