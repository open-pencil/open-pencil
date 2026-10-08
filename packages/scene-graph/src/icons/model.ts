import { readPluginData, withPluginData } from '../plugin-data/field'
import { OPEN_PENCIL_PLUGIN_DATA } from '../plugin-data/fields'
import type { SceneNode } from '../types'
import type { Icon, IconPaint } from './schema'

/** The icon a frame draws, or null when it is not an icon or its data is unreadable. */
export function readIcon(node: SceneNode): Icon | null {
  return readPluginData(node.pluginData, OPEN_PENCIL_PLUGIN_DATA.icon) ?? null
}

/** The node's plugin data with the icon set, or removed when null. */
export function withIcon(node: SceneNode, icon: Icon | null): SceneNode['pluginData'] {
  return withPluginData(node.pluginData, OPEN_PENCIL_PLUGIN_DATA.icon, icon ?? undefined)
}

/** The paints of an icon path that its icon's color sets; none when it keeps its own colors. */
export function readIconTint(node: SceneNode): readonly IconPaint[] {
  return readPluginData(node.pluginData, OPEN_PENCIL_PLUGIN_DATA.iconTint) ?? []
}

/** The path's plugin data with its tinted paints, or removed when there are none. */
export function withIconTint(
  node: SceneNode,
  paints: readonly IconPaint[]
): SceneNode['pluginData'] {
  return withPluginData(
    node.pluginData,
    OPEN_PENCIL_PLUGIN_DATA.iconTint,
    paints.length > 0 ? [...paints] : undefined
  )
}
