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
    .filter(
      (entry) => entry.pluginId === OPEN_PENCIL_PLUGIN_DATA_NAMESPACE && !entry.key.includes('/')
    )
    .map((entry) => entry.key)
}

export function getSharedPluginData(node: SceneNode, namespace: string, key: string): string {
  for (const entry of node.pluginData) {
    const slash = entry.key.indexOf('/')
    if (slash === -1) {
      // Guard: entries without namespace/key format and with the open-pencil
      // pluginId are private plugin data — never expose as shared data.
      if (entry.pluginId === OPEN_PENCIL_PLUGIN_DATA_NAMESPACE) continue
      if (entry.pluginId === namespace && entry.key === key) return entry.value
    } else if (
      entry.pluginId === namespace &&
      entry.key.slice(0, slash) === namespace &&
      entry.key.slice(slash + 1) === key
    ) {
      return entry.value
    }
  }
  return ''
}

export function setSharedPluginData(
  graph: SceneGraph,
  node: SceneNode,
  namespace: string,
  key: string,
  value: string
): void {
  const pluginData = node.pluginData.filter((entry) => {
    const slash = entry.key.indexOf('/')
    if (slash === -1) {
      // Guard: preserve private 'open-pencil' plugin data entries.
      // Entries without namespace/key format and with the open-pencil
      // pluginId are private data — never delete via shared data operations.
      if (entry.pluginId === OPEN_PENCIL_PLUGIN_DATA_NAMESPACE) return true
      return !(entry.pluginId === namespace && entry.key === key)
    }
    return !(
      entry.pluginId === namespace &&
      entry.key.slice(0, slash) === namespace &&
      entry.key.slice(slash + 1) === key
    )
  })
  if (value !== '') {
    pluginData.push({ pluginId: namespace, key: `${namespace}/${key}`, value })
  }
  graph.updateNode(node.id, { pluginData })
}

export function getSharedPluginDataKeys(node: SceneNode, namespace: string): string[] {
  const keys: string[] = []
  for (const entry of node.pluginData) {
    const slash = entry.key.indexOf('/')
    if (slash === -1) {
      // Guard: skip private 'open-pencil' plugin data entries.
      if (entry.pluginId === OPEN_PENCIL_PLUGIN_DATA_NAMESPACE) continue
      if (entry.pluginId === namespace) keys.push(entry.key)
    } else if (entry.pluginId === namespace && entry.key.slice(0, slash) === namespace) {
      keys.push(entry.key.slice(slash + 1))
    }
  }
  return keys
}
