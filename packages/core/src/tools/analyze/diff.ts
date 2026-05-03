import { colorToHex, parseColor } from '#core/color'
import { defineTool } from '#core/tools/schema'
import { createTwoFilesPatch } from 'diff'

import type { FigmaAPI } from '#core/figma-api'
import type { SceneNode } from '#core/scene-graph'

function serializePaintProps(raw: SceneNode, lines: string[]): void {
  const solidFill = raw.fills.find((f) => f.type === 'SOLID' && f.visible)
  if (solidFill) lines.push(`fill: ${colorToHex(solidFill.color)}`)

  const solidStroke = raw.strokes.find((s) => s.visible)
  if (solidStroke) {
    lines.push(`stroke: ${colorToHex(solidStroke.color)}`)
    if (solidStroke.weight) lines.push(`strokeWeight: ${solidStroke.weight}`)
  }
}

function serializeCornerRadii(raw: SceneNode, lines: string[]): void {
  const tl = raw.topLeftRadius
  const tr = raw.topRightRadius
  const br = raw.bottomRightRadius
  const bl = raw.bottomLeftRadius
  if (tl || tr || br || bl) {
    if (tl === tr && tr === br && br === bl) {
      lines.push(`radius: ${tl}`)
    } else {
      lines.push(`radii: ${tl} ${tr} ${br} ${bl}`)
    }
  }
}

function serializeEffects(raw: SceneNode, lines: string[]): void {
  for (const effect of raw.effects) {
    const parts: string[] = [effect.type]
    parts.push(`r=${effect.radius}`)
    parts.push(`c=${colorToHex(effect.color)}`)
    parts.push(`x=${effect.offset.x} y=${effect.offset.y}`)
    parts.push(`s=${effect.spread}`)
    lines.push(`effect: ${parts.join(' ')}`)
  }
}

function serializeTextProps(raw: SceneNode, lines: string[]): void {
  if (raw.type !== 'TEXT') return
  if (raw.text) lines.push(`text: ${JSON.stringify(raw.text)}`)
  if (raw.fontSize) lines.push(`fontSize: ${raw.fontSize}`)
  if (raw.fontFamily) lines.push(`fontFamily: ${raw.fontFamily}`)
  if (raw.fontWeight) lines.push(`fontWeight: ${raw.fontWeight}`)
}

function serializeNodeProps(raw: SceneNode): string {
  const lines: string[] = []
  lines.push(`type: ${raw.type}`)
  lines.push(`size: ${raw.width} ${raw.height}`)
  lines.push(`pos: ${raw.x} ${raw.y}`)

  serializePaintProps(raw, lines)

  if (raw.opacity !== 1) lines.push(`opacity: ${Math.round(raw.opacity * 100) / 100}`)

  serializeCornerRadii(raw, lines)

  if (raw.blendMode !== 'NORMAL') lines.push(`blendMode: ${raw.blendMode}`)
  if (raw.rotation !== 0) lines.push(`rotation: ${Math.round(raw.rotation * 100) / 100}`)
  if (raw.clipsContent) lines.push(`clipsContent: true`)

  serializeEffects(raw, lines)
  serializeTextProps(raw, lines)

  if (!raw.visible) lines.push(`visible: false`)
  if (raw.locked) lines.push(`locked: true`)

  return lines.join('\n')
}

function collectNodeTree(
  figma: FigmaAPI,
  nodeId: string,
  parentPath: string,
  depth: number,
  maxDepth: number
): Map<string, { path: string; id: string; serialized: string }> {
  const result = new Map<string, { path: string; id: string; serialized: string }>()
  const raw = figma.graph.getNode(nodeId)
  if (!raw) return result

  const path = parentPath ? `${parentPath}/${raw.name}` : `/${raw.name}`
  result.set(path, { path, id: raw.id, serialized: serializeNodeProps(raw) })

  if (depth < maxDepth) {
    for (const childId of raw.childIds) {
      const childNodes = collectNodeTree(figma, childId, path, depth + 1, maxDepth)
      for (const [k, v] of childNodes) result.set(k, v)
    }
  }
  return result
}

function createUnifiedDiff(
  oldFilename: string,
  newFilename: string,
  oldContent: string,
  newContent: string
): string {
  const patch = createTwoFilesPatch(oldFilename, newFilename, oldContent, newContent, '', '')
  return patch
    .split('\n')
    .filter(
      (l) =>
        !l.startsWith('Index:') &&
        l !== '==================================================================='
    )
    .join('\n')
    .trim()
}

// ─── Diff tools ───────────────────────────────────────────────

export const diffCreate = defineTool({
  name: 'diff_create',
  description:
    'Create a structural diff between two node trees. Compares properties (fills, strokes, effects, text, size, position) in unified diff format.',
  params: {
    from: { type: 'string', description: 'Source node ID', required: true },
    to: { type: 'string', description: 'Target node ID', required: true },
    depth: { type: 'number', description: 'Max tree depth (default: 10)' }
  },
  execute: (figma, args) => {
    const maxDepth = args.depth ?? 10
    const fromNode = figma.graph.getNode(args.from)
    const toNode = figma.graph.getNode(args.to)
    if (!fromNode) return { error: `Node "${args.from}" not found` }
    if (!toNode) return { error: `Node "${args.to}" not found` }

    const fromNodes = collectNodeTree(figma, args.from, '', 0, maxDepth)
    const toNodes = collectNodeTree(figma, args.to, '', 0, maxDepth)
    const allPaths = new Set([...fromNodes.keys(), ...toNodes.keys()])

    const patches: string[] = []
    for (const path of allPaths) {
      const fromEntry = fromNodes.get(path)
      const toEntry = toNodes.get(path)

      if (!fromEntry && toEntry) {
        const filename = `${path} #${toEntry.id}`
        const newLines = toEntry.serialized.split('\n')
        patches.push(
          `--- /dev/null\n+++ ${filename}\n@@ -0,0 +1,${newLines.length} @@\n${newLines.map((l) => `+${l}`).join('\n')}`
        )
      } else if (fromEntry && !toEntry) {
        const filename = `${path} #${fromEntry.id}`
        const oldLines = fromEntry.serialized.split('\n')
        patches.push(
          `--- ${filename}\n+++ /dev/null\n@@ -1,${oldLines.length} +0,0 @@\n${oldLines.map((l) => `-${l}`).join('\n')}`
        )
      } else if (fromEntry && toEntry && fromEntry.serialized !== toEntry.serialized) {
        patches.push(
          createUnifiedDiff(
            `${path} #${fromEntry.id}`,
            `${path} #${toEntry.id}`,
            fromEntry.serialized,
            toEntry.serialized
          )
        )
      }
    }

    if (patches.length === 0) return { diff: null, message: 'No differences found' }
    return { diff: patches.join('\n') }
  }
})

export const diffShow = defineTool({
  name: 'diff_show',
  description:
    'Preview what would change if properties were applied to a node. Shows a unified diff of current vs proposed state.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    props: {
      type: 'string',
      description:
        'JSON object of new properties, e.g. \'{"opacity": 1, "fill": "#FF0000", "width": 200}\'',
      required: true
    }
  },
  execute: (figma, args) => {
    const raw = figma.graph.getNode(args.id)
    if (!raw) return { error: `Node "${args.id}" not found` }

    const oldContent = serializeNodeProps(raw)

    let newProps: Record<string, unknown>
    try {
      newProps = JSON.parse(args.props)
    } catch {
      return { error: 'Invalid JSON in props' }
    }

    const modified: SceneNode = structuredClone(raw)
    if (newProps.fill) {
      modified.fills = [
        { type: 'SOLID', color: parseColor(newProps.fill as string), opacity: 1, visible: true }
      ]
    }
    if (newProps.stroke) {
      modified.strokes = [
        {
          color: parseColor(newProps.stroke as string),
          weight: modified.strokes[0]?.weight ?? 1,
          opacity: 1,
          visible: true,
          align: modified.strokes[0]?.align ?? 'INSIDE'
        }
      ]
    }
    if (newProps.opacity !== undefined) modified.opacity = Number(newProps.opacity)
    if (newProps.radius !== undefined) {
      const r = Number(newProps.radius)
      modified.cornerRadius = r
      modified.topLeftRadius = r
      modified.topRightRadius = r
      modified.bottomRightRadius = r
      modified.bottomLeftRadius = r
    }
    if (newProps.width !== undefined) modified.width = Number(newProps.width)
    if (newProps.height !== undefined) modified.height = Number(newProps.height)
    if (newProps.x !== undefined) modified.x = Number(newProps.x)
    if (newProps.y !== undefined) modified.y = Number(newProps.y)
    if (newProps.visible !== undefined) modified.visible = Boolean(newProps.visible)
    if (newProps.locked !== undefined) modified.locked = Boolean(newProps.locked)
    if (newProps.rotation !== undefined) modified.rotation = Number(newProps.rotation)
    if (newProps.text !== undefined) modified.text = newProps.text as string

    const newContent = serializeNodeProps(modified)

    if (oldContent === newContent) return { diff: null, message: 'No changes' }

    const filename = `/${raw.name} #${args.id}`
    return { diff: createUnifiedDiff(filename, filename, oldContent, newContent) }
  }
})
