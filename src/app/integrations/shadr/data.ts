import type { PluginDataEntry, SceneNode } from '@open-pencil/scene-graph'

import type { EditorStore } from '@/app/editor/active-store'

import type { ShadrNodeData } from './types'

export const SHADR_PLUGIN_ID = 'minecraft'
export const SHADR_DATA_KEY = 'shadr'

/** Reads Shadr metadata from a node's pluginData. */
export function getShadrData(node: SceneNode | null | undefined): ShadrNodeData {
  if (!node?.pluginData) return {}
  const entry = node.pluginData.find((e) => e.pluginId === SHADR_PLUGIN_ID && e.key === SHADR_DATA_KEY)
  if (!entry?.value) return {}
  try {
    return JSON.parse(entry.value) as ShadrNodeData
  } catch {
    return {}
  }
}

/** Updates Shadr metadata on the specified target nodes with undo history. */
export function setShadrData(
  editor: EditorStore,
  targetNodes: SceneNode[],
  patch: Partial<ShadrNodeData>,
  historyLabel = 'Update Shadr properties'
) {
  for (const node of targetNodes) {
    const current = getShadrData(node)
    const next: ShadrNodeData = { ...current, ...patch }

    // Clean out empty/undefined keys
    for (const k of Object.keys(next) as Array<keyof ShadrNodeData>) {
      if (next[k] === undefined || next[k] === '' || (Array.isArray(next[k]) && (next[k] as unknown[]).length === 0)) {
        delete next[k]
      }
    }

    const clean = (node.pluginData ?? []).filter(
      (e) => !(e.pluginId === SHADR_PLUGIN_ID && e.key === SHADR_DATA_KEY)
    )

    const hasData = Object.keys(next).length > 0
    const nextPluginData: PluginDataEntry[] = hasData
      ? [...clean, { pluginId: SHADR_PLUGIN_ID, key: SHADR_DATA_KEY, value: JSON.stringify(next) }]
      : clean

    editor.updateNodeWithUndo(node.id, { pluginData: nextPluginData }, historyLabel)
  }
}
