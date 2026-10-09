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

/** The layer name an icon is placed with: its name in the set, such as `cat` for `mdi:cat`. */
export function iconLayerName(name: string): string {
  return name.slice(name.indexOf(':') + 1)
}

/**
 * Whether `layerName` is the name an icon `name` was placed with, rather than one someone gave
 * it: `cat`, or `Icon / mdi:cat` as icons were named before.
 */
export function isPlacedIconName(layerName: string, name: string): boolean {
  return layerName === iconLayerName(name) || layerName === `Icon / ${name}`
}

/** The names of the icons among `nodes`, each once, in the order they are first met. */
export function iconNames(nodes: Iterable<SceneNode>): string[] {
  const names = new Set<string>()
  for (const node of nodes) {
    const icon = readIcon(node)
    if (icon) names.add(icon.name)
  }
  return [...names]
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
