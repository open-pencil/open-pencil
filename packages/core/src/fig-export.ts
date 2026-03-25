import { deflateSync } from 'fflate'

import { CANVAS_BG_COLOR, IS_BROWSER, IS_TAURI } from './constants'
import { compressFigDataSync } from './fig-compress'
import { initCodec, getCompiledSchema, getSchemaBytes } from './kiwi/codec'
import { stringToGuid } from './kiwi/kiwi-convert'
import {
  sceneNodeToKiwi,
  fractionalPosition,
  buildFontDigestMap,
  safeColor,
  makeDocumentNodeChange,
  makeCanvasNodeChange
} from './kiwi/kiwi-serialize'
import { renderThumbnail } from './render-image'

import type { NodeChange } from './kiwi/codec'
import type { SkiaRenderer } from './renderer'
import type { SceneGraph, VariableValue } from './scene-graph'
import type { GUID } from './types'
import type { CanvasKit } from 'canvaskit-wasm'

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
      value: { colorValue: safeColor(value as { r: number; g: number; b: number; a?: number }) },
      dataType: 'COLOR',
      resolvedDataType: 'COLOR'
    }
  }
  if (type === 'BOOLEAN') {
    return { value: { boolValue: !!value }, dataType: 'BOOLEAN', resolvedDataType: 'BOOLEAN' }
  }
  if (type === 'STRING') {
    return {
      value: { textValue: typeof value === 'string' ? value : JSON.stringify(value) },
      dataType: 'STRING',
      resolvedDataType: 'STRING'
    }
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

  const nodeChanges: KiwiNodeChange[] = [makeDocumentNodeChange(docGuid)]

  const blobs: Uint8Array[] = []
  const pages = graph.getPages(true)
  const nodeIdToGuid = new Map<string, GUID>()
  const varIdToGuid = new Map<string, GUID>()
  const fontDigestMap = await buildFontDigestMap(graph)
  let internalCanvasGuid: GUID | null = null

  for (let p = 0; p < pages.length; p++) {
    const page = pages[p]
    const canvasLocalID = localIdCounter.value++
    const canvasGuid = { sessionID: 0, localID: canvasLocalID }

    if (page.internalOnly) internalCanvasGuid = canvasGuid

    const canvasNc = makeCanvasNodeChange(canvasGuid, docGuid, fractionalPosition(p), page.name, {
      backgroundOpacity: 1,
      backgroundColor: { ...CANVAS_BG_COLOR },
      backgroundEnabled: true
    })
    if (page.internalOnly) canvasNc.internalOnly = true
    nodeChanges.push(canvasNc)

    const children = graph.getChildren(page.id)
    for (let i = 0; i < children.length; i++) {
      nodeChanges.push(
        ...sceneNodeToKiwi(
          children[i],
          canvasGuid,
          i,
          localIdCounter,
          graph,
          blobs,
          nodeIdToGuid,
          fontDigestMap,
          varIdToGuid
        )
      )
    }
  }

  if (graph.variableCollections.size > 0) {
    if (!internalCanvasGuid) {
      const internalLocalID = localIdCounter.value++
      internalCanvasGuid = { sessionID: 0, localID: internalLocalID }
      nodeChanges.push(
        makeCanvasNodeChange(
          internalCanvasGuid,
          docGuid,
          fractionalPosition(pages.length),
          'Internal Only Canvas',
          { internalOnly: true }
        )
      )
    }

    const modeIdToGuid = new Map<string, GUID>()

    let collIdx = 0
    for (const [colId, col] of graph.variableCollections) {
      const colGuid = { sessionID: 0, localID: localIdCounter.value++ }
      varIdToGuid.set(colId, colGuid)
      const colNc: KiwiNodeChange = {
        guid: colGuid,
        parentIndex: { guid: internalCanvasGuid, position: fractionalPosition(collIdx++) },
        type: 'VARIABLE_SET',
        name: col.name,
        phase: 'CREATED',
        strokeAlign: 'CENTER',
        strokeJoin: 'BEVEL',
        variableSetModes: col.modes.map((m, i) => {
          const mGuid = { sessionID: 0, localID: localIdCounter.value++ }
          modeIdToGuid.set(m.modeId, mGuid)
          return { id: mGuid, name: m.name, sortPosition: fractionalPosition(i) }
        })
      }
      nodeChanges.push(colNc)

      let varIdx = 0
      for (const varId of col.variableIds) {
        const variable = graph.variables.get(varId)
        if (!variable) continue

        const varGuid = { sessionID: 0, localID: localIdCounter.value++ }
        varIdToGuid.set(varId, varGuid)
        const typeMap: Record<string, string> = {
          COLOR: 'COLOR',
          BOOLEAN: 'BOOLEAN',
          STRING: 'STRING'
        }
        const resolvedType = typeMap[variable.type] ?? 'FLOAT'

        const entries = Object.entries(variable.valuesByMode).map(([modeId, value]) => ({
          modeID: modeIdToGuid.get(modeId) ?? stringToGuid(modeId),
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

  const version = graph.figKiwiVersion ?? undefined

  if (IS_TAURI) {
    const { invoke } = await import('@tauri-apps/api/core')
    return new Uint8Array(
      await invoke<number[]>('build_fig_file', {
        schemaDeflated: Array.from(schemaDeflated),
        kiwiData: Array.from(kiwiData),
        thumbnailPng: Array.from(thumbnailPng),
        metaJson,
        images: imageEntries.map((e) => ({ name: e.name, data: Array.from(e.data) })),
        figKiwiVersion: version
      })
    )
  }

  return compressFigData(schemaDeflated, kiwiData, thumbnailPng, metaJson, imageEntries, version)
}

export { compressFigDataSync } from './fig-compress'

function canUseWorker(): boolean {
  return typeof Worker !== 'undefined' && IS_BROWSER
}

function compressViaWorker(
  schemaDeflated: Uint8Array,
  kiwiData: Uint8Array,
  thumbnailPng: Uint8Array,
  metaJson: string,
  imageEntries: Array<{ name: string; data: Uint8Array }>
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./fig-export-worker.ts', import.meta.url), {
      type: 'module'
    })

    worker.onmessage = (e: MessageEvent<Uint8Array>) => {
      resolve(e.data)
      worker.terminate()
    }
    worker.onerror = (err) => {
      reject(new Error(err.message))
      worker.terminate()
    }

    const imgCopies = imageEntries.map((e) => ({
      name: e.name,
      data: new Uint8Array(e.data)
    }))

    const transferables = [
      schemaDeflated.buffer,
      kiwiData.buffer,
      thumbnailPng.buffer,
      ...imgCopies.map((e) => e.data.buffer)
    ]

    worker.postMessage(
      { schemaDeflated, kiwiData, thumbnailPng, metaJson, images: imgCopies },
      transferables
    )
  })
}

export function compressFigData(
  schemaDeflated: Uint8Array,
  kiwiData: Uint8Array,
  thumbnailPng: Uint8Array,
  metaJson: string,
  imageEntries: Array<{ name: string; data: Uint8Array }>,
  figKiwiVersion?: number
): Promise<Uint8Array> {
  if (canUseWorker()) {
    return compressViaWorker(schemaDeflated, kiwiData, thumbnailPng, metaJson, imageEntries)
  }
  return Promise.resolve(
    compressFigDataSync(
      schemaDeflated,
      kiwiData,
      thumbnailPng,
      metaJson,
      imageEntries,
      figKiwiVersion
    )
  )
}
