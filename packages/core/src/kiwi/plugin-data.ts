import type {
  PluginDataEntry,
  PluginRelaunchDataEntry,
  SharedPluginDataEntry
} from '../scene-graph'
import type { PluginData, PluginRelaunchData } from './codec'

export function mergePluginData(
  pluginData: PluginDataEntry[],
  sharedPluginData: SharedPluginDataEntry[]
): PluginData[] {
  return [
    ...pluginData.map((entry) => ({
      pluginID: entry.pluginId,
      key: entry.key,
      value: entry.value
    })),
    ...sharedPluginData.map((entry) => ({
      pluginID: entry.namespace,
      key: `${entry.namespace}/${entry.key}`,
      value: entry.value
    }))
  ]
}

export function serializePluginRelaunchData(
  entries: PluginRelaunchDataEntry[]
): PluginRelaunchData[] {
  return entries.map((entry) => ({
    pluginID: entry.pluginId,
    command: entry.command,
    message: entry.message,
    isDeleted: entry.isDeleted
  }))
}
