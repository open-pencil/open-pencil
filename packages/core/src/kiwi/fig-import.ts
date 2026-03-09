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

import type { NodeChange } from './codec'

export function importNodeChanges(
  nodeChanges: NodeChange[],
  blobs: Uint8Array[] = [],
  images?: Map<string, Uint8Array>
): SceneGraph {
  const t0 = profileStart()
  const graph = new SceneGraph()

  if (images) {
    for (const [hash, data] of images) {
      graph.images.set(hash, data)
    }
  }

  // Remove the default page created by constructor — we'll create pages from the file
  for (const page of graph.getPages(true)) {
    graph.deleteNode(page.id)
  }

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

  function getChildren(ncId: string): string[] {
    return childrenMap.get(ncId) ?? []
  }

  const created = new Set<string>()
  const guidToNodeId = new Map<string, string>()

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

  function importVariables() {
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

      let type: VariableType = 'FLOAT'
      const resolvedType = nc.variableResolvedType
      if (resolvedType === 'COLOR') type = 'COLOR'
      else if (resolvedType === 'BOOLEAN') type = 'BOOLEAN'
      else if (resolvedType === 'STRING') type = 'STRING'

      const valuesByMode: Record<string, VariableValue> = {}

      if (nc.variableDataValues?.entries) {
        for (const entry of nc.variableDataValues.entries) {
          const modeId = guidToString(entry.modeID)
          const vd = entry.variableData
          if (!vd.value) continue

          const dt = vd.dataType ?? vd.resolvedDataType
          if (dt === 'COLOR' && vd.value.colorValue) {
            const c = vd.value.colorValue
            valuesByMode[modeId] = { r: c.r, g: c.g, b: c.b, a: c.a }
          } else if (dt === 'BOOLEAN') {
            valuesByMode[modeId] = vd.value.boolValue ?? false
          } else if (dt === 'STRING') {
            valuesByMode[modeId] = vd.value.textValue ?? ''
          } else if (dt === 'ALIAS' && vd.value.alias?.guid) {
            valuesByMode[modeId] = { aliasId: guidToString(vd.value.alias.guid) }
          } else {
            valuesByMode[modeId] = vd.value.floatValue ?? 0
          }
        }
      }

      if (Object.keys(valuesByMode).length === 0) {
        const col = graph.variableCollections.get(collectionId)
        const defaultMode = col?.defaultModeId ?? 'default'
        const defaultValue = type === 'BOOLEAN' ? false : (type === 'STRING' ? '' : null)
        valuesByMode[defaultMode] = defaultValue ?? (type === 'COLOR' ? { r: 0, g: 0, b: 0, a: 1 } : 0)
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

  function importVariableBindings() {
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

  // Find the document node (type=DOCUMENT or guid 0:0)
  let docId: string | null = null
  for (const [id, nc] of changeMap) {
    if (nc.type === 'DOCUMENT' || id === '0:0') {
      docId = id
      break
    }
  }

  const t2 = profileStart()
  if (docId) {
    // Import pages (CANVAS nodes) and their children
    for (const canvasId of getChildren(docId)) {
      const canvasNc = changeMap.get(canvasId)
      if (!canvasNc) continue
      if (canvasNc.type === 'CANVAS') {
        const page = graph.addPage(canvasNc.name ?? 'Page')
        if (canvasNc.internalOnly) page.internalOnly = true
        created.add(canvasId)
        for (const childId of getChildren(canvasId)) {
          createSceneNode(childId, page.id)
        }
      } else {
        createSceneNode(canvasId, graph.getPages()[0]?.id ?? graph.rootId)
      }
    }
  } else {
    // No document structure — treat all roots as children of the first page
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
  profileStage('4c_createSceneNodes', t2)

  const t3 = profileStart()
  importVariables()
  importVariableBindings()
  profileStage('4d_importVariables', t3)

  const t4 = profileStart()
  // Remap componentId from original Figma GUIDs to imported node IDs
  for (const node of graph.getAllNodes()) {
    if (node.type !== 'INSTANCE' || !node.componentId) continue
    const remapped = guidToNodeId.get(node.componentId)
    if (remapped) node.componentId = remapped
  }
  profileStage('4e_remapComponentIds', t4)

  const t5 = profileStart()
  populateAndApplyOverrides(
    graph,
    changeMap as unknown as Map<string, InstanceNodeChange>,
    guidToNodeId,
    blobs
  )
  profileStage('4f_populateAndApplyOverrides', t5)

  // Ensure at least one page exists
  if (graph.getPages(true).length === 0) {
    graph.addPage('Page 1')
  }

  return graph
}
