import type { ExportSettings } from '@figma/plugin-typings/plugin-api-standalone'

import { OPEN_PENCIL_PLUGIN_DATA, withPluginData } from '@open-pencil/scene-graph/plugin-data'

import {
  graph,
  nodeId,
  raw,
  updateNode,
  type NodeProxyInternals,
  type ProxyThis
} from '#core/figma-api/accessor-utils'
import type { NodeProxyHost } from '#core/figma-api/proxy'

import { exportLayer } from './render'
import { figmaExportSettings, parseExportRequest, parseExportSettings } from './settings'

/**
 * `exportSettings` and `exportAsync` on every layer and page, as Figma's `ExportMixin` has them;
 * the document has neither.
 */
export function installExportAccessors(target: object, internals: NodeProxyInternals): void {
  Object.defineProperty(target, 'exportSettings', {
    get(this: ProxyThis): readonly ExportSettings[] {
      return figmaExportSettings(raw(this, internals).exportSettings)
    },
    set(this: ProxyThis, value: unknown) {
      const node = raw(this, internals)
      const exportSettings = parseExportSettings(value, node.type === 'TEXT')
      // Saved as the Export panel saves them, so a file keeps these rather than those it opened with.
      const pluginData = withPluginData(
        node.pluginData,
        OPEN_PENCIL_PLUGIN_DATA.exportSettings,
        exportSettings.length > 0 ? exportSettings : undefined
      )
      updateNode(this, internals, { exportSettings, pluginData })
    }
  })
  Object.defineProperty(target, 'exportAsync', {
    async value(this: ProxyThis, settings?: unknown): Promise<Uint8Array | string> {
      const request = parseExportRequest(settings)
      const node = graph(this, internals).getNode(nodeId(this, internals))
      if (!node) {
        throw new Error(
          `in exportAsync: The node with id "${nodeId(this, internals)}" does not exist`
        )
      }
      const host = this[internals.api] as NodeProxyHost
      return exportLayer(host, graph(this, internals), node, request)
    }
  })
}
