import { populateAndApplyOverrides } from '#core/kiwi/instance-overrides'
import {
  guidToString,
  nodeChangeToProps,
  sortChildren,
  setVariableColorResolver,
  VARIABLE_BINDING_FIELDS_INVERSE
} from '#core/kiwi/node-change/convert'
import { SceneGraph } from '#core/scene-graph'

import type { NodeChange, VariableDataValuesEntry, Color, GUID } from '#core/kiwi/binary/codec'
import type { InstanceNodeChange } from '#core/kiwi/instance-overrides'
import type { VariableType, VariableValue } from '#core/scene-graph'

type AssetRef = { key: string; version?: string }
type AliasRef = { guid?: GUID; assetRef?: AssetRef }

function assetRefKey(assetRef: AssetRef): string {
  return assetRef.version ? `${assetRef.key}@${assetRef.version}` : assetRef.key
}

function buildAssetRefMap(changeMap: Map<string, NodeChange>): Map<string, string> {
  const refs = new Map<string, string>()
  for (const [id, nc] of changeMap) {
    if (typeof nc.key !== 'string') continue
    refs.set(nc.key, id)
    if (typeof nc.version === 'string')
      refs.set(assetRefKey({ key: nc.key, version: nc.version }), id)
    if (typeof nc.userFacingVersion === 'string') {
      refs.set(assetRefKey({ key: nc.key, version: nc.userFacingVersion }), id)
    }
  }
  return refs
}

function resolveAliasId(alias: AliasRef, assetRefs: Map<string, string>): string | undefined {
  if (alias.guid) return guidToString(alias.guid)
  if (!alias.assetRef) return undefined
  return assetRefs.get(assetRefKey(alias.assetRef)) ?? assetRefs.get(alias.assetRef.key)
}

function buildVariableColorResolver(
  changeMap: Map<string, NodeChange>,
  assetRefs: Map<string, string>
): (alias: AliasRef) => Color | null {
  // Collect variable data: GUID → entries
  const varEntries = new Map<string, VariableDataValuesEntry[]>()
  const varSetId = new Map<string, string>()
  for (const [id, nc] of changeMap) {
    if (nc.type !== 'VARIABLE') continue
    varEntries.set(id, nc.variableDataValues?.entries ?? [])
    const setGuid = nc.variableSetID?.guid ? guidToString(nc.variableSetID.guid) : undefined
    const parentGuid = nc.parentIndex?.guid ? guidToString(nc.parentIndex.guid) : undefined
    if (setGuid) varSetId.set(id, setGuid)
    else if (parentGuid) varSetId.set(id, parentGuid)
  }

  // Collection default modes
  const defaultModes = new Map<string, string>()
  for (const [id, nc] of changeMap) {
    if (nc.type !== 'VARIABLE_SET') continue
    const modes = nc.variableSetModes ?? []
    if (modes.length > 0) defaultModes.set(id, guidToString(modes[0].id))
  }

  function resolveById(
    id: string,
    preferredModeId: string | undefined,
    depth: number
  ): Color | null {
    if (depth > 10) return null
    const entries = varEntries.get(id)
    if (!entries?.length) return null

    const setId = varSetId.get(id)
    const defaultMode = setId ? defaultModes.get(setId) : undefined
    let entry = preferredModeId
      ? entries.find((e) => guidToString(e.modeID) === preferredModeId)
      : undefined
    if (!entry && defaultMode) entry = entries.find((e) => guidToString(e.modeID) === defaultMode)
    if (!entry) entry = entries[0]

    const val = entry.variableData.value
    if (!val) return null
    if (val.colorValue) return val.colorValue
    if (val.alias) {
      const aliasId = resolveAliasId(val.alias, assetRefs)
      if (aliasId) return resolveById(aliasId, guidToString(entry.modeID), depth + 1)
    }
    return null
  }

  return function resolve(alias: AliasRef): Color | null {
    const id = resolveAliasId(alias, assetRefs)
    return id ? resolveById(id, undefined, 0) : null
  }
}

interface ChangeMaps {
  changeMap: Map<string, NodeChange>
  parentMap: Map<string, string>
  childrenMap: Map<string, string[]>
}

function buildChangeMaps(nodeChanges: NodeChange[]): ChangeMaps {
  const changeMap = new Map<string, NodeChange>()
  const parentMap = new Map<string, string>()
  const childrenMap = new Map<string, string[]>()

  for (const nc of nodeChanges) {
    if (!nc.guid) continue
    if (nc.phase === 'REMOVED') continue
    const id = guidToString(nc.guid)
    changeMap.set(id, nc)

    if (nc.parentIndex?.guid) {
      const pid = guidToString(nc.parentIndex.guid)
      parentMap.set(id, pid)
      let siblings = childrenMap.get(pid)
      if (!siblings) {
        siblings = []
        childrenMap.set(pid, siblings)
      }
      siblings.push(id)
    }
  }

  for (const [parentId, children] of childrenMap) {
    const parentNc = changeMap.get(parentId)
    if (parentNc) sortChildren(children, parentNc, changeMap)
  }

  return { changeMap, parentMap, childrenMap }
}

function resolveVariableType(resolvedType: string | undefined): VariableType {
  if (resolvedType === 'COLOR') return 'COLOR'
  if (resolvedType === 'BOOLEAN') return 'BOOLEAN'
  if (resolvedType === 'STRING') return 'STRING'
  return 'FLOAT'
}

function resolveVariableValue(
  entry: VariableDataValuesEntry,
  assetRefs: Map<string, string>
): VariableValue | undefined {
  const vd = entry.variableData
  if (!vd.value) return undefined

  const dt = vd.dataType ?? vd.resolvedDataType
  if (dt === 'COLOR' && vd.value.colorValue) {
    const c = vd.value.colorValue
    return { r: c.r, g: c.g, b: c.b, a: c.a }
  }
  if (dt === 'BOOLEAN') return vd.value.boolValue ?? false
  if (dt === 'STRING') return vd.value.textValue ?? ''
  if (dt === 'ALIAS' && vd.value.alias) {
    const aliasId = resolveAliasId(vd.value.alias, assetRefs)
    if (aliasId) return { aliasId }
    return undefined
  }
  return vd.value.floatValue ?? 0
}

function resolveDefaultValue(type: VariableType): VariableValue {
  if (type === 'BOOLEAN') return false
  if (type === 'STRING') return ''
  if (type === 'COLOR') return { r: 0, g: 0, b: 0, a: 1 }
  return 0
}

function importCollections(changeMap: Map<string, NodeChange>, graph: SceneGraph): void {
  for (const [id, nc] of changeMap) {
    if (nc.type !== 'VARIABLE_SET') continue

    const modes = (nc.variableSetModes ?? []).map((m) => {
      const modeId = guidToString(m.id)
      return { modeId, name: m.name }
    })
    if (modes.length === 0) modes.push({ modeId: 'default', name: 'Default' })

    graph.addCollection({
      id,
      name: nc.name ?? 'Variables',
      modes,
      defaultModeId: modes[0].modeId,
      variableIds: []
    })
  }
}

function resolveVariableCollectionId(
  nc: NodeChange,
  id: string,
  parentMap: Map<string, string>,
  assetRefs: Map<string, string>
): string {
  if (nc.variableSetID?.guid) return guidToString(nc.variableSetID.guid)
  const assetRef = nc.variableSetID?.assetRef
  if (assetRef) return assetRefs.get(assetRefKey(assetRef)) ?? assetRefs.get(assetRef.key) ?? ''
  return parentMap.get(id) ?? ''
}

function addFallbackCollection(
  changeMap: Map<string, NodeChange>,
  graph: SceneGraph,
  collectionId: string
): void {
  if (graph.variableCollections.has(collectionId)) return
  const parentNc = changeMap.get(collectionId)
  graph.addCollection({
    id: collectionId,
    name: parentNc?.name ?? 'Variables',
    modes: [{ modeId: 'default', name: 'Default' }],
    defaultModeId: 'default',
    variableIds: []
  })
}

function importVariableEntries(
  changeMap: Map<string, NodeChange>,
  parentMap: Map<string, string>,
  graph: SceneGraph,
  assetRefs: Map<string, string>
): void {
  for (const [id, nc] of changeMap) {
    if (nc.type !== 'VARIABLE') continue

    const collectionId = resolveVariableCollectionId(nc, id, parentMap, assetRefs)
    addFallbackCollection(changeMap, graph, collectionId)

    const type = resolveVariableType(nc.variableResolvedType)
    const valuesByMode: Record<string, VariableValue> = {}

    if (nc.variableDataValues?.entries) {
      for (const entry of nc.variableDataValues.entries) {
        const val = resolveVariableValue(entry, assetRefs)
        if (val !== undefined) {
          valuesByMode[guidToString(entry.modeID)] = val
        }
      }
    }

    if (Object.keys(valuesByMode).length === 0) {
      const col = graph.variableCollections.get(collectionId)
      const defaultMode = col?.defaultModeId ?? 'default'
      valuesByMode[defaultMode] = resolveDefaultValue(type)
    }

    graph.addVariable({
      id,
      name: nc.name ?? 'Variable',
      type,
      collectionId,
      valuesByMode,
      description: '',
      hiddenFromPublishing: false
    })
  }
}

function importPages(
  graph: SceneGraph,
  changeMap: Map<string, NodeChange>,
  parentMap: Map<string, string>,
  childrenMap: Map<string, string[]>,
  created: Set<string>,
  canvasIdToPageId: Map<string, string>,
  createSceneNode: (ncId: string, graphParentId: string) => void
): void {
  let docId: string | null = null
  for (const [id, nc] of changeMap) {
    if (nc.type === 'DOCUMENT' || id === '0:0') {
      docId = id
      break
    }
  }

  if (docId) {
    for (const canvasId of childrenMap.get(docId) ?? []) {
      const canvasNc = changeMap.get(canvasId)
      if (!canvasNc) continue
      if (canvasNc.type === 'CANVAS') {
        const page = graph.addPage(canvasNc.name ?? 'Page')
        canvasIdToPageId.set(canvasId, page.id)
        if (canvasNc.internalOnly) page.internalOnly = true
        created.add(canvasId)
        for (const childId of childrenMap.get(canvasId) ?? []) {
          createSceneNode(childId, page.id)
        }
      } else {
        createSceneNode(canvasId, graph.getPages()[0]?.id ?? graph.rootId)
      }
    }
  } else {
    const roots: string[] = []
    for (const [id] of changeMap) {
      const pid = parentMap.get(id)
      if (!pid || !changeMap.has(pid)) roots.push(id)
    }
    const page = graph.getPages()[0] ?? graph.addPage('Page 1')
    for (const rootId of roots) {
      createSceneNode(rootId, page.id)
    }
  }
}

function importVariableBindings(
  changeMap: Map<string, NodeChange>,
  guidToNodeId: Map<string, string>,
  graph: SceneGraph
): void {
  for (const [ncId, nc] of changeMap) {
    if (!nc.variableConsumptionMap?.entries?.length) continue
    const nodeId = guidToNodeId.get(ncId)
    if (!nodeId) continue
    for (const entry of nc.variableConsumptionMap.entries) {
      const varGuid = entry.variableData?.value?.alias?.guid
      if (!varGuid) continue
      const field = VARIABLE_BINDING_FIELDS_INVERSE[entry.variableField ?? '']
      if (field) graph.bindVariable(nodeId, field, guidToString(varGuid))
    }
  }
}

function remapComponentIds(graph: SceneGraph, guidToNodeId: Map<string, string>): void {
  for (const node of graph.getAllNodes()) {
    if (node.type !== 'INSTANCE' || !node.componentId) continue
    const remapped = guidToNodeId.get(node.componentId)
    if (remapped) node.componentId = remapped
  }
}

function parseDocumentColorSpace(nodeChanges: NodeChange[]): 'srgb' | 'display-p3' {
  const documentNode = nodeChanges.find((nc) => nc.type === 'DOCUMENT')
  return documentNode?.documentColorProfile === 'DISPLAY_P3' ? 'display-p3' : 'srgb'
}

export interface FigImportOptions {
  populate?: 'all' | 'first-page'
}

export function importNodeChanges(
  nodeChanges: NodeChange[],
  blobs: Uint8Array[] = [],
  images?: Map<string, Uint8Array>,
  options: FigImportOptions = {}
): SceneGraph {
  const graph = new SceneGraph()
  graph.documentColorSpace = parseDocumentColorSpace(nodeChanges)

  if (images) {
    for (const [hash, data] of images) {
      graph.images.set(hash, data)
    }
  }

  for (const page of graph.getPages(true)) {
    graph.deleteNode(page.id)
  }

  const { changeMap, parentMap, childrenMap } = buildChangeMaps(nodeChanges)
  const assetRefs = buildAssetRefMap(changeMap)
  setVariableColorResolver(buildVariableColorResolver(changeMap, assetRefs))

  const canvasIdToPageId = new Map<string, string>()
  const created = new Set<string>()
  const guidToNodeId = new Map<string, string>()
  const getChildren = (ncId: string): string[] => childrenMap.get(ncId) ?? []

  function createSceneNode(ncId: string, graphParentId: string) {
    if (created.has(ncId)) return
    created.add(ncId)

    const nc = changeMap.get(ncId)
    if (!nc) return

    const { nodeType, ...props } = nodeChangeToProps(nc, blobs)
    if (nodeType === 'DOCUMENT' || nodeType === 'VARIABLE' || nc.type === 'VARIABLE_SET') return

    const parentId = canvasIdToPageId.get(graphParentId) ?? graphParentId
    const node = graph.createNode(nodeType, parentId, props)
    guidToNodeId.set(ncId, node.id)

    for (const childId of getChildren(ncId)) {
      createSceneNode(childId, node.id)
    }
  }

  importPages(graph, changeMap, parentMap, childrenMap, created, canvasIdToPageId, createSceneNode)

  importCollections(changeMap, graph)
  importVariableEntries(changeMap, parentMap, graph, assetRefs)
  importVariableBindings(changeMap, guidToNodeId, graph)
  remapComponentIds(graph, guidToNodeId)

  const firstPageId = graph.getPages()[0]?.id
  const componentPageIds = new Set<string>()
  for (const node of graph.getAllNodes()) {
    if (node.type !== 'COMPONENT' && node.type !== 'COMPONENT_SET') continue
    let current = node.parentId ? graph.getNode(node.parentId) : undefined
    while (current?.parentId && current.type !== 'CANVAS') current = graph.getNode(current.parentId)
    if (current?.type === 'CANVAS') componentPageIds.add(current.id)
  }
  const activeRootIds =
    options.populate === 'first-page'
      ? [firstPageId, ...componentPageIds].filter(Boolean)
      : undefined

  populateAndApplyOverrides(
    graph,
    changeMap as unknown as Map<string, InstanceNodeChange>,
    guidToNodeId,
    blobs,
    activeRootIds
  )

  setVariableColorResolver(null)

  if (graph.getPages(true).length === 0) {
    graph.addPage('Page 1')
  }

  return graph
}
