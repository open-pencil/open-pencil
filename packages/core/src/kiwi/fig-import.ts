import type { VariableType, VariableValue } from '../scene-graph'
import { SceneGraph } from '../scene-graph'

import {
  guidToString,
  nodeChangeToProps,
  sortChildren,
  VARIABLE_BINDING_FIELDS_INVERSE
} from './kiwi-convert'
import { populateAndApplyOverrides } from './instance-overrides'
import type { InstanceNodeChange } from './instance-overrides'
import { profileStage, profileStart } from './fig-parse-profile'

import type { NodeChange, VariableDataValuesEntry } from './codec'

interface ChangeMaps {
  changeMap: Map<string, NodeChange>
  parentMap: Map<string, string>
  childrenMap: Map<string, string[]>
}

function buildChangeMaps(nodeChanges: NodeChange[]): ChangeMaps {
  const t0 = profileStart()
  const changeMap = new Map<string, NodeChange>()
  const parentMap = new Map<string, string>()
  const childrenMap = new Map<string, string[]>()

  for (const nc of nodeChanges) {
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
  profileStage('4a_buildChangeMap', t0)

  const t1 = profileStart()
  for (const [parentId, children] of childrenMap) {
    const parentNc = changeMap.get(parentId)
    if (parentNc) sortChildren(children, parentNc, changeMap)
  }
  profileStage('4b_sortChildren', t1)

  return { changeMap, parentMap, childrenMap }
}

function resolveVariableType(resolvedType: string | undefined): VariableType {
  if (resolvedType === 'COLOR') return 'COLOR'
  if (resolvedType === 'BOOLEAN') return 'BOOLEAN'
  if (resolvedType === 'STRING') return 'STRING'
  return 'FLOAT'
}

function resolveVariableValue(entry: VariableDataValuesEntry): VariableValue | undefined {
  const vd = entry.variableData
  if (!vd.value) return undefined

  const dt = vd.dataType ?? vd.resolvedDataType
  if (dt === 'COLOR' && vd.value.colorValue) {
    const c = vd.value.colorValue
    return { r: c.r, g: c.g, b: c.b, a: c.a }
  }
  if (dt === 'BOOLEAN') return vd.value.boolValue ?? false
  if (dt === 'STRING') return vd.value.textValue ?? ''
  if (dt === 'ALIAS' && vd.value.alias?.guid) {
    return { aliasId: guidToString(vd.value.alias.guid) }
  }
  return vd.value.floatValue ?? 0
}

function resolveDefaultValue(type: VariableType): VariableValue {
  if (type === 'BOOLEAN') return false
  if (type === 'STRING') return ''
  if (type === 'COLOR') return { r: 0, g: 0, b: 0, a: 1 }
  return 0
}

function importCollections(
  changeMap: Map<string, NodeChange>,
  graph: SceneGraph
): void {
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

function importVariableEntries(
  changeMap: Map<string, NodeChange>,
  parentMap: Map<string, string>,
  graph: SceneGraph
): void {
  for (const [id, nc] of changeMap) {
    if (nc.type !== 'VARIABLE') continue

    const collectionId = nc.variableSetID?.guid ? guidToString(nc.variableSetID.guid) : (parentMap.get(id) ?? '')

    if (!graph.variableCollections.has(collectionId)) {
      const parentNc = changeMap.get(collectionId)
      graph.addCollection({
        id: collectionId,
        name: parentNc?.name ?? 'Variables',
        modes: [{ modeId: 'default', name: 'Default' }],
        defaultModeId: 'default',
        variableIds: []
      })
    }

    const type = resolveVariableType(nc.variableResolvedType)
    const valuesByMode: Record<string, VariableValue> = {}

    if (nc.variableDataValues?.entries) {
      for (const entry of nc.variableDataValues.entries) {
        const val = resolveVariableValue(entry)
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

function remapComponentIds(
  graph: SceneGraph,
  guidToNodeId: Map<string, string>
): void {
  for (const node of graph.getAllNodes()) {
    if (node.type !== 'INSTANCE' || !node.componentId) continue
    const remapped = guidToNodeId.get(node.componentId)
    if (remapped) node.componentId = remapped
  }
}

export function importNodeChanges(
  nodeChanges: NodeChange[],
  blobs: Uint8Array[] = [],
  images?: Map<string, Uint8Array>
): SceneGraph {
  const graph = new SceneGraph()

  if (images) {
    for (const [hash, data] of images) {
      graph.images.set(hash, data)
    }
  }

  for (const page of graph.getPages(true)) {
    graph.deleteNode(page.id)
  }

  const { changeMap, parentMap, childrenMap } = buildChangeMaps(nodeChanges)

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

    const node = graph.createNode(nodeType, graphParentId, props)
    guidToNodeId.set(ncId, node.id)

    for (const childId of getChildren(ncId)) {
      createSceneNode(childId, node.id)
    }
  }

  const t2 = profileStart()
  importPages(graph, changeMap, parentMap, childrenMap, created, createSceneNode)
  profileStage('4c_createSceneNodes', t2)

  const t3 = profileStart()
  importCollections(changeMap, graph)
  importVariableEntries(changeMap, parentMap, graph)
  importVariableBindings(changeMap, guidToNodeId, graph)
  profileStage('4d_importVariables', t3)

  const t4 = profileStart()
  remapComponentIds(graph, guidToNodeId)
  profileStage('4e_remapComponentIds', t4)

  const t5 = profileStart()
  populateAndApplyOverrides(
    graph,
    changeMap as unknown as Map<string, InstanceNodeChange>,
    guidToNodeId,
    blobs
  )
  profileStage('4f_populateAndApplyOverrides', t5)

  if (graph.getPages(true).length === 0) {
    graph.addPage('Page 1')
  }

  return graph
}
