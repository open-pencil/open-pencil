import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import {
  assertProxyEditable,
  graph,
  raw,
  type NodeProxyInternals,
  type ProxyThis
} from './accessor-utils'

export const OPEN_PENCIL_PLUGIN_DATA_NAMESPACE = 'open-pencil'

type PluginDataEntry = SceneNode['pluginData'][number]

export function isOpenPencilPluginData(entry: PluginDataEntry): boolean {
  return entry.pluginId === OPEN_PENCIL_PLUGIN_DATA_NAMESPACE
}

function encodedSharedKey(entry: PluginDataEntry, namespace: string): string | null {
  const prefix = `${namespace}/`
  if (entry.pluginId !== namespace || !entry.key.startsWith(prefix)) return null
  return entry.key.slice(prefix.length)
}

function isEncodedSharedPluginData(entry: PluginDataEntry): boolean {
  return encodedSharedKey(entry, entry.pluginId) !== null
}

function matchesSharedPluginData(entry: PluginDataEntry, namespace: string, key: string): boolean {
  const encodedKey = encodedSharedKey(entry, namespace)
  if (encodedKey !== null) return encodedKey === key
  if (isOpenPencilPluginData(entry)) return false
  return entry.pluginId === namespace && entry.key === key
}

function sharedPluginDataKey(entry: PluginDataEntry, namespace: string): string | null {
  const encodedKey = encodedSharedKey(entry, namespace)
  if (encodedKey !== null) return encodedKey
  if (isOpenPencilPluginData(entry)) return null
  return entry.pluginId === namespace ? entry.key : null
}

export function getPluginData(node: SceneNode, key: string): string {
  return (
    node.pluginData.find((entry) => isOpenPencilPluginData(entry) && entry.key === key)?.value ?? ''
  )
}

export function setPluginData(
  graph: SceneGraph,
  node: SceneNode,
  key: string,
  value: string
): void {
  const pluginData = node.pluginData.filter(
    (entry) => !(isOpenPencilPluginData(entry) && entry.key === key)
  )
  if (value !== '') {
    pluginData.push({ pluginId: OPEN_PENCIL_PLUGIN_DATA_NAMESPACE, key, value })
  }
  graph.updateNode(node.id, { pluginData })
}

export function getPluginDataKeys(node: SceneNode): string[] {
  return node.pluginData
    .filter((entry) => isOpenPencilPluginData(entry) && !isEncodedSharedPluginData(entry))
    .map((entry) => entry.key)
}

export function getSharedPluginData(node: SceneNode, namespace: string, key: string): string {
  return (
    node.pluginData.find((entry) => matchesSharedPluginData(entry, namespace, key))?.value ?? ''
  )
}

export function setSharedPluginData(
  graph: SceneGraph,
  node: SceneNode,
  namespace: string,
  key: string,
  value: string
): void {
  const pluginData = node.pluginData.filter(
    (entry) => !matchesSharedPluginData(entry, namespace, key)
  )
  if (value !== '') {
    pluginData.push({ pluginId: namespace, key: `${namespace}/${key}`, value })
  }
  graph.updateNode(node.id, { pluginData })
}

export function getSharedPluginDataKeys(node: SceneNode, namespace: string): string[] {
  return node.pluginData.flatMap((entry) => {
    const key = sharedPluginDataKey(entry, namespace)
    return key === null ? [] : [key]
  })
}

/** Figma's plugin data methods, which every node proxy has. */
export interface PluginDataMethods {
  getPluginData(key: string): string
  setPluginData(key: string, value: string): void
  getPluginDataKeys(): string[]
  getSharedPluginData(namespace: string, key: string): string
  setSharedPluginData(namespace: string, key: string, value: string): void
  getSharedPluginDataKeys(namespace: string): string[]
}

export function installPluginDataMethods(prototype: object, internals: NodeProxyInternals): void {
  const methods: {
    [K in keyof PluginDataMethods]: (
      this: ProxyThis,
      ...args: Parameters<PluginDataMethods[K]>
    ) => ReturnType<PluginDataMethods[K]>
  } = {
    getPluginData(key) {
      return getPluginData(raw(this, internals), key)
    },
    setPluginData(key, value) {
      assertProxyEditable(this, internals)
      setPluginData(graph(this, internals), raw(this, internals), key, value)
    },
    getPluginDataKeys() {
      return getPluginDataKeys(raw(this, internals))
    },
    getSharedPluginData(namespace, key) {
      return getSharedPluginData(raw(this, internals), namespace, key)
    },
    setSharedPluginData(namespace, key, value) {
      assertProxyEditable(this, internals)
      setSharedPluginData(graph(this, internals), raw(this, internals), namespace, key, value)
    },
    getSharedPluginDataKeys(namespace) {
      return getSharedPluginDataKeys(raw(this, internals), namespace)
    }
  }
  // Non-enumerable, as class methods are.
  Object.defineProperties(
    prototype,
    Object.fromEntries(Object.entries(methods).map(([name, value]) => [name, { value }]))
  )
}
