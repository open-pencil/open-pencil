import { zipSync, deflateSync, type Zippable } from 'fflate'

import { CANVAS_BG_COLOR, IS_TAURI } from './constants'
import { sceneNodeToKiwi, fractionalPosition, buildFigKiwi, buildFontDigestMap } from './kiwi-serialize'
import { initCodec, getCompiledSchema, getSchemaBytes } from './kiwi/codec'
import { stringToGuid } from './kiwi/kiwi-convert'
import { renderThumbnail } from './render-image'

import type { NodeChange } from './kiwi/codec'
import type { SkiaRenderer } from './renderer'
import type { SceneGraph, VariableValue } from './scene-graph'
import type { CanvasKit } from 'canvaskit-wasm'
import type { GUID } from './types'

const THUMBNAIL_1X1 = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
  ),
  (c) => c.charCodeAt(0)
)

type KiwiNodeChange = NodeChange & Record<string, unknown>

function variableValueToKiwi(
  value: VariableValue,
  type: string
): { value: Record<string, unknown>; dataType: string; resolvedDataType: string } {
  if (typeof value === 'object' && 'aliasId' in value) {
    return {
      value: { alias: { guid: stringToGuid(value.aliasId) } },
      dataType: 'ALIAS',
      resolvedDataType: { COLOR: 'COLOR', BOOLEAN: 'BOOLEAN', STRING: 'STRING' }[type] ?? 'FLOAT'
    }
  }
  if (type === 'COLOR' && typeof value === 'object' && 'r' in value) {
    return {
      value: { colorValue: { r: value.r, g: value.g, b: value.b, a: value.a } },
      dataType: 'COLOR',
      resolvedDataType: 'COLOR'
    }
  }
  if (type === 'BOOLEAN') {
    return { value: { boolValue: !!value }, dataType: 'BOOLEAN', resolvedDataType: 'BOOLEAN' }
  }
  if (type === 'STRING') {
    return { value: { textValue: String(value) }, dataType: 'STRING', resolvedDataType: 'STRING' }
  }
  return { value: { floatValue: Number(value) }, dataType: 'FLOAT', resolvedDataType: 'FLOAT' }
}

function collectImageEntries(graph: SceneGraph): Array<{ name: string; data: Uint8Array }> {
  const entries: Array<{ name: string; data: Uint8Array }> = []
  for (const [hash, data] of graph.images) {
    entries.push({ name: `images/${hash}`, data })
  }
  return entries
}

const THUMBNAIL_WIDTH = 400
const THUMBNAIL_HEIGHT = 225

export async function exportFigFile(
  graph: SceneGraph,
  ck?: CanvasKit,
  renderer?: SkiaRenderer,
  pageId?: string
): Promise<Uint8Array> {
  await initCodec()
  const compiled = getCompiledSchema()
  const schemaDeflated = deflateSync(getSchemaBytes())

  const docGuid = { sessionID: 0, localID: 0 }
  const localIdCounter = { value: 2 }

  const nodeChanges: KiwiNodeChange[] = [
    {
      guid: docGuid,
      type: 'DOCUMENT',
      name: 'Document',
      visible: true,
      opacity: 1,
      phase: 'CREATED',
      transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
      strokeWeight: 1,
      strokeAlign: 'CENTER',
      strokeJoin: 'MITER',
      documentColorProfile: 'SRGB'
    }
  ]

  const blobs: Uint8Array[] = []
  const pages = graph.getPages(true)
  const nodeIdToGuid = new Map<string, GUID>()
  const fontDigestMap = await buildFontDigestMap(graph)
  let internalCanvasGuid: GUID | null = null

  for (let p = 0; p < pages.length; p++) {
    const page = pages[p]
    const canvasLocalID = localIdCounter.value++
    const canvasGuid = { sessionID: 0, localID: canvasLocalID }

    if (page.internalOnly) internalCanvasGuid = canvasGuid

    const canvasNc: KiwiNodeChange = {
      guid: canvasGuid,
      parentIndex: { guid: docGuid, position: fractionalPosition(p) },
      type: 'CANVAS',
      name: page.name,
      visible: true,
      opacity: 1,
      phase: 'CREATED',
      transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
      strokeWeight: 1,
      strokeAlign: 'CENTER',
      strokeJoin: 'MITER',
      backgroundOpacity: 1,
      backgroundColor: { ...CANVAS_BG_COLOR },
      backgroundEnabled: true
    }
    if (page.internalOnly) canvasNc.internalOnly = true
    nodeChanges.push(canvasNc)

    const children = graph.getChildren(page.id)
    for (let i = 0; i < children.length; i++) {
      nodeChanges.push(
        ...sceneNodeToKiwi(children[i], canvasGuid, i, localIdCounter, graph, blobs, nodeIdToGuid, fontDigestMap)
      )
    }
  }

  if (graph.variableCollections.size > 0) {
    if (!internalCanvasGuid) {
      const internalLocalID = localIdCounter.value++
      internalCanvasGuid = { sessionID: 0, localID: internalLocalID }
      nodeChanges.push({
        guid: internalCanvasGuid,
        parentIndex: { guid: docGuid, position: fractionalPosition(pages.length) },
        type: 'CANVAS',
        name: 'Internal Only Canvas',
        visible: true,
        opacity: 1,
        phase: 'CREATED',
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
        strokeWeight: 1,
        strokeAlign: 'CENTER',
        strokeJoin: 'MITER',
        internalOnly: true
      })
    }

    let collIdx = 0
    for (const [colId, col] of graph.variableCollections) {
      const colGuid = stringToGuid(colId)
      const colNc: KiwiNodeChange = {
        guid: colGuid,
        parentIndex: { guid: internalCanvasGuid, position: fractionalPosition(collIdx++) },
        type: 'VARIABLE_SET',
        name: col.name,
        phase: 'CREATED',
        strokeAlign: 'CENTER',
        strokeJoin: 'BEVEL',
        variableSetModes: col.modes.map((m, i) => ({
          id: stringToGuid(m.modeId),
          name: m.name,
          sortPosition: fractionalPosition(i)
        }))
      }
      nodeChanges.push(colNc)

      let varIdx = 0
      for (const varId of col.variableIds) {
        const variable = graph.variables.get(varId)
        if (!variable) continue

        const varGuid = stringToGuid(varId)
        const typeMap: Record<string, string> = { COLOR: 'COLOR', BOOLEAN: 'BOOLEAN', STRING: 'STRING' }
        const resolvedType = typeMap[variable.type] ?? 'FLOAT'

        const entries = Object.entries(variable.valuesByMode).map(([modeId, value]) => ({
          modeID: stringToGuid(modeId),
          variableData: variableValueToKiwi(value, variable.type)
        }))

        const varNc: KiwiNodeChange = {
          guid: varGuid,
          parentIndex: { guid: internalCanvasGuid, position: fractionalPosition(varIdx++) },
          type: 'VARIABLE',
          name: variable.name,
          phase: 'CREATED',
          strokeAlign: 'CENTER',
          strokeJoin: 'BEVEL',
          variableSetID: { guid: colGuid },
          variableResolvedType: resolvedType,
          variableDataValues: { entries },
          variableScopes: ['ALL_SCOPES']
        }
        nodeChanges.push(varNc)
      }
    }
  }

  const msg: Record<string, unknown> = {
    type: 'NODE_CHANGES',
    sessionID: 0,
    ackID: 0,
    nodeChanges
  }

  if (blobs.length > 0) {
    msg.blobs = blobs.map((bytes) => ({ bytes }))
  }

  const kiwiData = compiled.encodeMessage(msg)

  const currentPageId = pageId ?? pages[0]?.id
  const thumbnailPng =
    (ck && renderer && currentPageId
      ? renderThumbnail(ck, renderer, graph, currentPageId, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT)
      : null) ?? THUMBNAIL_1X1

  const metaJson = JSON.stringify({
    version: 1,
    app: 'OpenPencil',
    createdAt: new Date().toISOString()
  })

  const imageEntries = collectImageEntries(graph)

  if (IS_TAURI) {
    const { invoke } = await import('@tauri-apps/api/core')
    return new Uint8Array(
      await invoke<number[]>('build_fig_file', {
        schemaDeflated: Array.from(schemaDeflated),
        kiwiData: Array.from(kiwiData),
        thumbnailPng: Array.from(thumbnailPng),
        metaJson,
        images: imageEntries.map(e => ({ name: e.name, data: Array.from(e.data) }))
      })
    )
  }

  const canvasData = buildFigKiwi(schemaDeflated, kiwiData)
  const zipEntries: Zippable = {
    'canvas.fig': [canvasData, { level: 0 }],
    'thumbnail.png': [thumbnailPng, { level: 0 }],
    'meta.json': new TextEncoder().encode(metaJson)
  }
  for (const entry of imageEntries) {
    zipEntries[entry.name] = [entry.data, { level: 0 }]
  }
  return zipSync(zipEntries)
}
