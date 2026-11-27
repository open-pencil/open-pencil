import * as v from 'valibot'

import { effectiveFigmaRawNodeFields } from '@open-pencil/fig'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { isFigmaShaderPaint } from '@open-pencil/scene-graph/paints'

const shaderEffectSchema = v.object({
  type: v.literal('CUSTOM'),
  customEffectId: v.object({
    guid: v.optional(v.object({ sessionID: v.number(), localID: v.number() })),
    assetRef: v.optional(v.object({ key: v.string(), version: v.optional(v.string()) }))
  })
})

interface ShaderReference {
  id?: string
  key?: string
  version?: string
}

/** One key for a shader's library key and version. */
export const shaderAssetKey = (key: string, version = ''): string => `${key}\n${version}`

function rawString(node: SceneNode, field: string): string | undefined {
  const value = effectiveFigmaRawNodeFields(node)[field]
  return typeof value === 'string' ? value : undefined
}

function definitionAssetKey(node: SceneNode): string | undefined {
  const key = rawString(node, 'key')
  return key === undefined ? undefined : shaderAssetKey(key, rawString(node, 'version'))
}

/** The library shaders a document already holds the definitions of. */
export function heldShaderAssets(graph: SceneGraph): Set<string> {
  const held = new Set<string>()
  for (const node of graph.getAllNodes()) {
    const key = node.type === 'CODE_COMPONENT' ? definitionAssetKey(node) : undefined
    if (key !== undefined) held.add(key)
  }
  return held
}

/**
 * The shaders a layer names: in its fills and strokes, its text ranges' and vector regions' fills,
 * and its kept Figma effects.
 */
function shaderReferences(node: SceneNode): ShaderReference[] {
  const references: ShaderReference[] = []
  for (const paint of [
    ...node.fills,
    ...node.strokes,
    ...node.styleRuns.flatMap((run) => run.style.fills ?? []),
    ...(node.vectorNetwork?.regions.flatMap((region) => region.fills ?? []) ?? [])
  ]) {
    if (!isFigmaShaderPaint(paint)) continue
    if (paint.customEffectAssetRef) references.push(paint.customEffectAssetRef)
    else if (paint.customEffectId) references.push({ id: paint.customEffectId })
  }
  const effects = effectiveFigmaRawNodeFields(node).effects
  for (const effect of Array.isArray(effects) ? effects : []) {
    const parsed = v.safeParse(shaderEffectSchema, effect)
    if (!parsed.success) continue
    const { guid, assetRef } = parsed.output.customEffectId
    if (assetRef) references.push(assetRef)
    else if (guid) references.push({ id: guidToString(guid) })
  }
  return references
}

/**
 * Finds the shader definitions a layer names, so a copy carries each to Figma beside the layer, as
 * an instance carries its component. A definition is found by its library key and version, or by
 * the Figma ID a paint read from a file names it by.
 */
export function shaderDefinitionFinder(graph: SceneGraph): (node: SceneNode) => SceneNode[] {
  const byAsset = new Map<string, SceneNode>()
  const byId = new Map<string, SceneNode>()
  for (const node of graph.getAllNodes()) {
    if (node.type !== 'CODE_COMPONENT') continue
    const key = definitionAssetKey(node)
    if (key !== undefined) byAsset.set(key, node)
    byId.set(node.id, node)
    if (node.source.id) byId.set(node.source.id, node)
  }
  if (byId.size === 0) return () => []
  return (node) =>
    shaderReferences(node).flatMap((reference) => {
      const definition =
        reference.key !== undefined
          ? byAsset.get(shaderAssetKey(reference.key, reference.version))
          : byId.get(reference.id ?? '')
      return definition ? [definition] : []
    })
}
