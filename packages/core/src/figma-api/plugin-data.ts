import type { SceneGraph, SceneNode } from '#core/scene-graph'

const OPEN_PENCIL_PLUGIN_DATA_NAMESPACE = 'open-pencil'

export function getPluginData(node: SceneNode, key: string): string {
  return (
    node.pluginData.find(
      (entry) => entry.pluginId === OPEN_PENCIL_PLUGIN_DATA_NAMESPACE && entry.key === key
    )?.value ?? ''
  )
}

export function setPluginData(
  graph: SceneGraph,
  node: SceneNode,
  key: string,
  value: string
): void {
  const pluginData = node.pluginData.filter(
    (entry) => !(entry.pluginId === OPEN_PENCIL_PLUGIN_DATA_NAMESPACE && entry.key === key)
  )
  if (value !== '') {
    pluginData.push({ pluginId: OPEN_PENCIL_PLUGIN_DATA_NAMESPACE, key, value })
  }
  graph.updateNode(node.id, { pluginData })
}

export function getPluginDataKeys(node: SceneNode): string[] {
  return node.pluginData
    .filter((entry) => entry.pluginId === OPEN_PENCIL_PLUGIN_DATA_NAMESPACE)
    .map((entry) => entry.key)
}

export function getSharedPluginData(node: SceneNode, namespace: string, key: string): string {
  return (
    node.sharedPluginData.find((entry) => entry.namespace === namespace && entry.key === key)
      ?.value ?? ''
  )
}

export function setSharedPluginData(
  graph: SceneGraph,
  node: SceneNode,
  namespace: string,
  key: string,
  value: string
): void {
  const sharedPluginData = node.sharedPluginData.filter(
    (entry) => !(entry.namespace === namespace && entry.key === key)
  )
  if (value !== '') {
    sharedPluginData.push({ namespace, key, value })
  }
  graph.updateNode(node.id, { sharedPluginData })
}

export function getSharedPluginDataKeys(node: SceneNode, namespace: string): string[] {
  return node.sharedPluginData
    .filter((entry) => entry.namespace === namespace)
    .map((entry) => entry.key)
}
