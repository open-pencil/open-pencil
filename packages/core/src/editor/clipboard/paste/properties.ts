import { omitBy, pick } from 'es-toolkit/object'

import { materializeFigFragment } from '@open-pencil/fig'
import { parseFigmaClipboard } from '@open-pencil/fig/clipboard'
import type { SceneGraph, SceneNode, StyleRun } from '@open-pencil/scene-graph'
import {
  AUTO_LAYOUT_FIELDS,
  CORNER_FIELDS,
  PAINT_FIELDS,
  STROKE_FIELDS,
  TEXT_STYLE_FIELDS
} from '@open-pencil/scene-graph/fields'
import { STYLE_LINK_FIELDS, sharedStyleRefKey } from '@open-pencil/scene-graph/shared-styles'

import { parseOpenPencilClipboard } from '#core/clipboard'
import { importClipboardDependenciesWithUndo } from '#core/editor/clipboard/dependencies'
import type { ClipboardSnapshot } from '#core/editor/clipboard/snapshot'
import type { EditorContext } from '#core/editor/types'

/**
 * Figma's Paste properties: the look of the one copied layer, applied to others. Position, size,
 * rotation, name, constraints, export settings, content, and structure never move.
 */

const APPEARANCE_FIELDS = [
  ...PAINT_FIELDS,
  ...STROKE_FIELDS,
  sharedStyleRefKey('fill'),
  sharedStyleRefKey('stroke'),
  sharedStyleRefKey('effect')
] as const

/** Auto layout and layout grids, which move only from one frame to another. */
const FRAME_FIELDS = [
  ...AUTO_LAYOUT_FIELDS,
  'itemReverseZIndex',
  'layoutGrids',
  sharedStyleRefKey('grid')
] as const satisfies ReadonlyArray<keyof SceneNode>

/** Text style fields, which move only from one text layer to another. */
const TEXT_FIELDS = [...TEXT_STYLE_FIELDS, sharedStyleRefKey('text')] as const

const NO_APPEARANCE: ReadonlySet<SceneNode['type']> = new Set(['CANVAS', 'SECTION', 'CONNECTOR'])
const FRAME_TYPES: ReadonlySet<SceneNode['type']> = new Set(['FRAME', 'COMPONENT', 'INSTANCE'])

type PastedField =
  | (typeof APPEARANCE_FIELDS)[number]
  | (typeof CORNER_FIELDS)[number]
  | (typeof FRAME_FIELDS)[number]
  | (typeof TEXT_FIELDS)[number]

/** The run overrides that replace a text layer's own value of each pasted field. */
const RUN_OVERRIDES: Readonly<Record<string, readonly string[]>> = {
  fills: ['fills', 'fillStyleId'],
  fillStyleId: ['fills', 'fillStyleId'],
  textStyleId: ['textStyleId']
}

function fieldOf(key: string): string {
  return key.split('/')[0] ?? key
}

/** Fields a text layer's character runs override, which Figma treats as mixed and leaves alone. */
function mixedFields(source: SceneNode): Set<string> {
  const mixed = new Set<string>()
  for (const run of source.styleRuns) {
    for (const key of Object.keys(run.style)) mixed.add(key)
    for (const key of Object.keys(run.style.boundVariables ?? {})) mixed.add(key)
  }
  if (mixed.has('fills') || mixed.has('fillStyleId')) mixed.add('fills').add('fillStyleId')
  return mixed
}

function pastedFields(source: SceneNode, target: SceneNode): PastedField[] {
  const fields: PastedField[] = [...APPEARANCE_FIELDS]
  // A text layer has no corners in Figma.
  if (source.type !== 'TEXT' && target.type !== 'TEXT') fields.push(...CORNER_FIELDS)
  if (FRAME_TYPES.has(source.type) && FRAME_TYPES.has(target.type)) fields.push(...FRAME_FIELDS)
  if (source.type === 'TEXT' && target.type === 'TEXT') fields.push(...TEXT_FIELDS)
  const mixed = source.type === 'TEXT' ? mixedFields(source) : new Set<string>()
  return fields.filter((field) => !mixed.has(field))
}

/** The target's runs without the overrides the pasted fields replace, so they cover all of it. */
function runsWithout(runs: StyleRun[], fields: ReadonlySet<string>): StyleRun[] {
  const overrides = new Set([...fields].flatMap((field) => RUN_OVERRIDES[field] ?? [field]))
  return runs.flatMap((run) => {
    const style = omitBy(run.style, (_, key) => overrides.has(key))
    if (style.boundVariables) {
      const bound = omitBy(style.boundVariables, (_, key) => fields.has(key))
      if (Object.keys(bound).length > 0) style.boundVariables = bound
      else delete style.boundVariables
    }
    return Object.keys(style).length > 0 ? [{ ...run, style }] : []
  })
}

/** Whether `source` is a layer whose look can be pasted. */
export function hasPastableProperties(source: SceneNode): boolean {
  return !NO_APPEARANCE.has(source.type)
}

/**
 * What pasting the look of `source` onto `target` changes, or null when the target takes none (a
 * page, a section, a connector). Locked layers take it, as in Figma.
 */
export function pastedPropertyChanges(
  source: SceneNode,
  target: SceneNode
): Partial<SceneNode> | null {
  if (!hasPastableProperties(source) || NO_APPEARANCE.has(target.type)) return null
  const fields = pastedFields(source, target)
  const changes: Partial<SceneNode> = structuredClone(pick(source, fields))
  const replaced = new Set<string>(fields)
  if (target.type === 'TEXT' && target.styleRuns.length > 0)
    changes.styleRuns = runsWithout(target.styleRuns, replaced)
  // Bindings of the fields being replaced go; the copied ones come in.
  const kept = Object.entries(target.boundVariables).filter(([key]) => !replaced.has(fieldOf(key)))
  const brought = Object.entries(source.boundVariables).filter(([key]) =>
    replaced.has(fieldOf(key))
  )
  changes.boundVariables = Object.fromEntries([...kept, ...brought])
  return changes
}

/**
 * A copied layer from another document, keeping only the style and variable links `graph` can
 * resolve; the copied values stay either way.
 */
export function withResolvableLinks(source: SceneNode, graph: SceneGraph): SceneNode {
  const resolved = structuredClone(source)
  for (const field of STYLE_LINK_FIELDS) {
    const id = resolved[field]
    if (id && !graph.getNode(id)) resolved[field] = null
  }
  resolved.boundVariables = Object.fromEntries(
    Object.entries(resolved.boundVariables).filter(([, id]) => graph.variables.has(id))
  )
  return resolved
}

interface PastedSource {
  node: SceneNode
  images: ReadonlyMap<string, Uint8Array>
}

/** The one layer a clipboard payload from another app or tab holds, or null. */
async function sourceFromHTML(html: string): Promise<PastedSource | null> {
  const openPencil = parseOpenPencilClipboard(html)
  if (openPencil) {
    const { nodes, images } = openPencil
    return nodes.length === 1 ? { node: nodes[0], images } : null
  }
  const figma = await parseFigmaClipboard(html)
  if (!figma) return null
  const fragment = materializeFigFragment(figma.nodes, figma.blobs, {
    missingComponent: 'detach-empty'
  })
  const { rootIds } = fragment
  const node = rootIds.length === 1 ? fragment.graph.getNode(rootIds[0]) : undefined
  return node ? { node, images: fragment.graph.images } : null
}

export function createClipboardPropertiesActions(
  ctx: EditorContext,
  updateNodeWithUndo: (id: string, changes: Partial<SceneNode>, label?: string) => void,
  loadFontsForNodes: (nodeIds: string[]) => Promise<unknown>
) {
  const LABEL = 'Paste properties'

  function targets(): SceneNode[] {
    return [...ctx.state.selectedIds].flatMap((id) => {
      const node = ctx.graph.getNode(id)
      return node && !NO_APPEARANCE.has(node.type) ? [node] : []
    })
  }

  /** Applies the look of `source` to `targets` in the running batch; returns the changed ids. */
  function apply(
    source: SceneNode,
    images: ReadonlyMap<string, Uint8Array>,
    nodes: SceneNode[]
  ): string[] {
    for (const paint of [...source.fills, ...source.strokes]) {
      const bytes = paint.imageHash ? images.get(paint.imageHash) : undefined
      if (paint.imageHash && bytes && !ctx.graph.images.has(paint.imageHash))
        ctx.graph.images.set(paint.imageHash, bytes)
    }
    return nodes.flatMap((target) => {
      const changes = pastedPropertyChanges(source, target)
      if (!changes) return []
      updateNodeWithUndo(target.id, changes, LABEL)
      return [target.id]
    })
  }

  async function finish(changed: string[]): Promise<number> {
    if (changed.length > 0) {
      await loadFontsForNodes(changed)
      ctx.requestRender()
    }
    return changed.length
  }

  /**
   * Paste properties from a copy made in this app: the look of its one layer, with the styles and
   * variables it uses, onto every selected layer in one undo step. Returns how many changed.
   */
  async function pastePropertiesFromSnapshot(snapshot: ClipboardSnapshot): Promise<number> {
    const nodes = targets()
    if (snapshot.nodes.length !== 1 || !hasPastableProperties(snapshot.nodes[0])) return 0
    if (nodes.length === 0) return 0
    const changed = ctx.undo.runBatch(LABEL, () => {
      const [source] = importClipboardDependenciesWithUndo(ctx, snapshot).nodes
      return apply(source, snapshot.images, nodes)
    })
    return finish(changed)
  }

  /** Paste properties from clipboard HTML, such as a Figma copy; links it cannot resolve drop. */
  async function pastePropertiesFromHTML(html: string): Promise<number> {
    const nodes = targets()
    if (nodes.length === 0) return 0
    const source = await sourceFromHTML(html)
    if (!source || !hasPastableProperties(source.node)) return 0
    const resolved = withResolvableLinks(source.node, ctx.graph)
    const changed = ctx.undo.runBatch(LABEL, () => apply(resolved, source.images, nodes))
    return finish(changed)
  }

  return { pastePropertiesFromSnapshot, pastePropertiesFromHTML }
}
