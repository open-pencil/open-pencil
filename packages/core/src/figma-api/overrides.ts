import { omit, uniq } from 'es-toolkit'
import { isEqual } from 'es-toolkit/predicate'

import type {
  ComponentPropertyReferenceField,
  SceneGraph,
  SceneNode,
  Stroke
} from '@open-pencil/scene-graph'
import { findInstanceAncestor } from '@open-pencil/scene-graph/instances'
import type { InstanceOverrideState } from '@open-pencil/scene-graph/instances/overrides'

import type { NodeProxyInternals, ProxyThis } from './accessor-utils'
import { assertProxyEditable, graph, raw } from './accessor-utils'
import { flushPendingLayout } from './pending-layout'

/** One layer of an instance and the fields an edit changed on it, as Figma's `overrides`. */
export interface FigmaInstanceOverride {
  id: string
  overriddenFields: string[]
}

/**
 * The fields Figma desktop 126 lists for an override of each of ours. Unlisted fields are ones
 * Figma does not report: a layer's own size, size limits, clipping, the layout mode, a swap.
 * Figma spells the top stroke weight `stokeTopWeight`.
 */
const FIGMA_OVERRIDE_FIELDS: Readonly<Partial<Record<string, readonly string[]>>> = {
  // Figma keeps a size as one field, so a changed width or height lists both.
  width: ['height', 'width'],
  height: ['height', 'width'],
  name: ['name'],
  visible: ['visible'],
  locked: ['locked'],
  text: ['characters', 'styledTextSegments'],
  styleRuns: ['styledTextSegments'],
  textParagraphs: ['styledTextSegments'],
  listSpacing: ['styledTextSegments'],
  fontSize: ['fontSize'],
  fontFamily: ['fontName'],
  fontWeight: ['fontName'],
  italic: ['fontName'],
  letterSpacing: ['letterSpacing'],
  lineHeight: ['lineHeight'],
  textCase: ['textCase'],
  textDecoration: ['textDecoration'],
  textDecorationStyle: ['textDecorationStyle'],
  textDecorationThickness: ['textDecorationThickness'],
  textUnderlineOffset: ['textDecorationOffset'],
  textDecorationFills: ['textDecorationColor'],
  textDecorationSkipInk: ['textDecorationSkipInk'],
  textAlignHorizontal: ['textAlignHorizontal'],
  textAlignVertical: ['textAlignVertical'],
  textAutoResize: ['textAutoResize'],
  textTruncation: ['textTruncation'],
  maxLines: ['maxLines'],
  leadingTrim: ['leadingTrim'],
  paragraphSpacing: ['paragraphSpacing'],
  paragraphIndent: ['paragraphIndent'],
  hangingList: ['hangingList'],
  fills: ['fills'],
  strokes: ['strokes'],
  effects: ['effects'],
  opacity: ['opacity'],
  blendMode: ['blendMode'],
  cornerRadius: [
    'bottomLeftRadius',
    'bottomRightRadius',
    'cornerRadius',
    'topLeftRadius',
    'topRightRadius'
  ],
  topLeftRadius: ['topLeftRadius'],
  topRightRadius: ['topRightRadius'],
  bottomRightRadius: ['bottomRightRadius'],
  bottomLeftRadius: ['bottomLeftRadius'],
  cornerSmoothing: ['cornerSmoothing'],
  strokeWeight: [
    'strokeBottomWeight',
    'strokeLeftWeight',
    'strokeRightWeight',
    'stokeTopWeight',
    'strokeWeight'
  ],
  borderTopWeight: ['stokeTopWeight'],
  borderRightWeight: ['strokeRightWeight'],
  borderBottomWeight: ['strokeBottomWeight'],
  borderLeftWeight: ['strokeLeftWeight'],
  strokeAlign: ['strokeAlign'],
  strokeCap: ['strokeCap'],
  strokeJoin: ['strokeJoin'],
  strokeMiterLimit: ['strokeMiterLimit'],
  dashPattern: ['dashPattern'],
  layoutWrap: ['layoutWrap'],
  primaryAxisAlign: ['primaryAxisAlignItems'],
  counterAxisAlign: ['counterAxisAlignItems'],
  primaryAxisSizing: ['primaryAxisSizingMode'],
  counterAxisSizing: ['counterAxisSizingMode'],
  itemSpacing: ['itemSpacing'],
  counterAxisSpacing: ['counterAxisSpacing'],
  paddingTop: ['paddingTop'],
  paddingRight: ['paddingRight'],
  paddingBottom: ['paddingBottom'],
  paddingLeft: ['paddingLeft'],
  gridColumnGap: ['gridColumnGap'],
  gridRowGap: ['gridRowGap'],
  itemReverseZIndex: ['itemReverseZIndex'],
  layoutGrids: ['layoutGrids'],
  layoutGrow: ['layoutGrow'],
  layoutAlignSelf: ['layoutAlign'],
  boundVariables: ['boundVariables'],
  variableModes: ['explicitVariableModes'],
  fillStyleId: ['fillStyleId'],
  strokeStyleId: ['strokeStyleId'],
  textStyleId: ['textStyleId'],
  effectStyleId: ['effectStyleId'],
  gridStyleId: ['gridStyleId']
}

/** Fields a component property sets on a layer, which Figma reports as the property's, not an override. */
const PROPERTY_FIELDS: Record<ComponentPropertyReferenceField, readonly string[]> = {
  TEXT: ['text', 'styleRuns', 'textParagraphs'],
  VISIBLE: ['visible'],
  INSTANCE_SWAP: ['componentId', 'name'],
  SLOT_CONTENT: []
}

function propertyFields(node: SceneNode): Set<string> {
  return new Set(node.componentPropertyReferences.flatMap(({ field }) => PROPERTY_FIELDS[field]))
}

/** Figma sorts the names as spelled right, so its misspelled top weight sorts as `strokeTop…`. */
const sortKey = (name: string) => (name === 'stokeTopWeight' ? 'strokeTopWeight' : name)

function figmaFields(fields: Iterable<string>, skipped: Set<string>): string[] {
  const names = new Set<string>()
  for (const field of fields) {
    if (skipped.has(field)) continue
    for (const name of FIGMA_OVERRIDE_FIELDS[field] ?? []) names.add(name)
  }
  return [...names].sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
}

/**
 * The layer of the component a node copies, which its overrides are measured against. A nested
 * instance links to the component's instance it copies, until a swap points it at a component;
 * the enclosing instance then keeps the layer it copied.
 */
function componentLayer(graph: SceneGraph, node: SceneNode, owner: SceneNode | undefined) {
  const linked = node.componentId ? graph.getNode(node.componentId) : undefined
  if (node.type !== 'INSTANCE' || linked?.type === 'INSTANCE') return linked
  const source = owner?.instanceOverrides.descendants.get(node.id)?.get('sourceComponentId')
  return typeof source === 'string' ? graph.getNode(source) : undefined
}

/** Figma keeps stroke weight and alignment on the layer, so a paint differs by its colour alone. */
const paints = (strokes: readonly Stroke[]) =>
  strokes.map((stroke) => omit(stroke, ['weight', 'align']))

function differs(node: SceneNode, source: SceneNode | undefined, field: string): boolean {
  if (!source) return true
  if (field === 'strokes') return !isEqual(paints(node.strokes), paints(source.strokes))
  return !isEqual(Reflect.get(node, field), Reflect.get(source, field))
}

/**
 * The fields recorded as edited on a node that still differ from its component layer: an edit
 * kept in the nearest instance above it, and one kept on the node itself if it is an instance.
 * Figma lists a field as overridden only while it differs.
 */
function editedFields(graph: SceneGraph, node: SceneNode, root: SceneNode): string[] {
  const owner =
    node.id === root.id || !node.parentId ? undefined : findInstanceAncestor(graph, node.parentId)
  const source =
    node.id === root.id ? graph.getNode(root.componentId ?? '') : componentLayer(graph, node, owner)
  const fields = [
    ...(node.type === 'INSTANCE' ? node.instanceOverrides.self.keys() : []),
    ...(owner?.instanceOverrides.descendants.get(node.id)?.keys() ?? [])
  ]
  // The instance's own size counts once it differs, as a layer that grows it makes it.
  if (node.id === root.id) fields.push('width', 'height')
  return uniq(fields).filter((field) => differs(node, source, field))
}

/**
 * Figma's `overrides`: each layer of the instance, itself first and then in layer order, with
 * the fields edited on it, including those inside nested instances. Figma lists no layer's own
 * size but the instance's.
 */
export function instanceOverrides(graph: SceneGraph, root: SceneNode): FigmaInstanceOverride[] {
  const result: FigmaInstanceOverride[] = []
  const visit = (node: SceneNode) => {
    const skipped = propertyFields(node)
    if (node.id !== root.id) skipped.add('width').add('height')
    const overriddenFields = figmaFields(editedFields(graph, node, root), skipped)
    if (overriddenFields.length > 0) result.push({ id: node.id, overriddenFields })
    for (const child of graph.getChildren(node.id)) visit(child)
  }
  visit(root)
  return result
}

/** Clears an override state but what component properties set, which Figma keeps on reset. */
function withoutEdits(graph: SceneGraph, state: InstanceOverrideState): InstanceOverrideState {
  const keep = (nodeId: string, fields: Map<string, unknown>) => {
    const node = graph.getNode(nodeId)
    const driven = node ? propertyFields(node) : new Set<string>()
    return new Map([...fields].filter(([field]) => driven.has(field)))
  }
  const descendants = new Map(
    [...state.descendants]
      .map(([nodeId, fields]) => [nodeId, keep(nodeId, fields)] as const)
      .filter(([, fields]) => fields.size > 0)
  )
  return { self: new Map(), descendants }
}

/**
 * Figma's `resetOverrides`: the instance and every instance inside it go back to their
 * components, keeping the values their component properties set.
 */
function resetInstanceOverrides(graph: SceneGraph, root: SceneNode): void {
  const visit = (node: SceneNode) => {
    if (node.type === 'INSTANCE')
      graph.updateNode(node.id, { instanceOverrides: withoutEdits(graph, node.instanceOverrides) })
    for (const child of graph.getChildren(node.id)) visit(child)
  }
  visit(root)
  // The outermost instance passes its component's content down to the ones inside it.
  let outermost = root
  for (
    let parent = root.parentId ? findInstanceAncestor(graph, root.parentId) : undefined;
    parent;
  ) {
    outermost = parent
    parent = parent.parentId ? findInstanceAncestor(graph, parent.parentId) : undefined
  }
  graph.syncInstance(outermost.id)
}

export function installInstanceOverrideAccessors(
  prototype: object,
  internals: NodeProxyInternals
): void {
  Object.defineProperties(prototype, {
    overrides: {
      get(this: ProxyThis): FigmaInstanceOverride[] | undefined {
        const node = raw(this, internals)
        if (node.type !== 'INSTANCE') return undefined
        // Figma lists the size its layout gives the instance.
        flushPendingLayout(graph(this, internals))
        return instanceOverrides(graph(this, internals), node)
      }
    },
    resetOverrides: {
      value(this: ProxyThis) {
        const node = raw(this, internals)
        if (node.type !== 'INSTANCE')
          throw new TypeError('resetOverrides() can only be called on instances')
        assertProxyEditable(this, internals)
        resetInstanceOverrides(graph(this, internals), node)
      }
    }
  })
}
