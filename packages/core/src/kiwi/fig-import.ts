import type { VariableType, VariableValue } from '../scene-graph'
import { SceneGraph } from '../scene-graph'

import { guidToString, nodeChangeToProps, sortChildren } from './kiwi-convert'
import { populateAndApplyOverrides } from './instance-overrides'
import type { InstanceNodeChange } from './instance-overrides'

import type { NodeChange } from './codec'

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

  // Remove the default page created by constructor — we'll create pages from the file
  for (const page of graph.getPages(true)) {
    graph.deleteNode(page.id)
  }

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
    if (nodeType === 'DOCUMENT' || nodeType === 'VARIABLE') return

    const node = graph.createNode(nodeType, graphParentId, props)
    guidToNodeId.set(ncId, node.id)

    for (const childId of getChildren(ncId)) {
      createSceneNode(childId, node.id)
    }
  }

  function importVariables() {
    for (const [id, nc] of changeMap) {
      if (nc.type !== 'VARIABLE') continue
      const varData = (
        nc as unknown as {
          variableData?: {
            value?: { boolValue?: boolean; textValue?: string; floatValue?: number }
            dataType?: string
          }
        }
      ).variableData
      if (!varData) continue

      const parentId = parentMap.get(id) ?? ''
      const parentNc = changeMap.get(parentId)
      const collectionName = parentNc?.name ?? 'Variables'
      const collectionId = parentId

      if (!graph.variableCollections.has(collectionId)) {
        graph.addCollection({
          id: collectionId,
          name: collectionName,
          modes: [{ modeId: 'default', name: 'Default' }],
          defaultModeId: 'default',
          variableIds: []
        })
      }

      let type: VariableType = 'FLOAT'
      let value: VariableValue = 0
      const dt = varData.dataType
      const v = varData.value

      if (dt === 'BOOLEAN' || dt === '0') {
        type = 'BOOLEAN'
        value = v?.boolValue ?? false
      } else if (dt === 'STRING' || dt === '2') {
        type = 'STRING'
        value = v?.textValue ?? ''
      } else {
        type = 'FLOAT'
        value = v?.floatValue ?? 0
      }

      graph.addVariable({
        id,
        name: nc.name ?? 'Variable',
        type,
        collectionId,
        valuesByMode: { default: value },
        description: '',
        hiddenFromPublishing: false
      })
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

  importVariables()

  // Remap componentId from original Figma GUIDs to imported node IDs
  for (const node of graph.getAllNodes()) {
    if (node.type !== 'INSTANCE' || !node.componentId) continue
    const remapped = guidToNodeId.get(node.componentId)
    if (remapped) node.componentId = remapped
  }

  populateAndApplyOverrides(
    graph,
    changeMap as unknown as Map<string, InstanceNodeChange>,
    guidToNodeId,
    blobs
  )

  // Ensure at least one page exists
  if (graph.getPages(true).length === 0) {
    graph.addPage('Page 1')
  }

  return graph
}
