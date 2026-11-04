import * as v from 'valibot'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import type { SceneNode } from '@open-pencil/scene-graph'
import { OPEN_PENCIL_PLUGIN_DATA, withPluginData } from '@open-pencil/scene-graph/plugin-data'
import {
  FIGMA_STATUS_STATE_IDS,
  figmaDevStatusOf,
  type FigmaDevStatus
} from '@open-pencil/scene-graph/statuses'

import { readEffectiveFigmaRawField } from '../source-metadata'
import type { KiwiNodeChange } from './export/context'
import { readNodeChangePluginData } from './plugin-data'

const FIGMA_SECTION_STATUS = { READY_FOR_DEV: 'BUILD', COMPLETED: 'COMPLETED' } as const

const sectionStatusInfoSchema = v.object({
  status: v.fallback(v.picklist(['NONE', 'BUILD', 'COMPLETED']), 'NONE')
})

function figmaStatus(nc: NodeChange): FigmaDevStatus | null {
  const parsed = v.safeParse(sectionStatusInfoSchema, nc.sectionStatusInfo)
  const status = parsed.success ? parsed.output.status : 'NONE'
  if (status === 'BUILD') return 'READY_FOR_DEV'
  if (status === 'COMPLETED') return 'COMPLETED'
  return null
}

/**
 * A record's status. Figma keeps only Ready for dev or Completed in `sectionStatusInfo`;
 * OpenPencil's plugin data names any state. The plugin data counts while Figma's field still
 * agrees with it; once someone changed the status in Figma, Figma's status counts.
 */
export function extractNodeStatus(nc: NodeChange): string | null {
  const figma = figmaStatus(nc)
  const stored = readNodeChangePluginData(nc, OPEN_PENCIL_PLUGIN_DATA.status) ?? null
  if (stored !== null && figmaDevStatusOf(stored) === figma) return stored
  return figma ? FIGMA_STATUS_STATE_IDS[figma] : null
}

/**
 * Writes the status as Figma reads it, where it has a counterpart, and as plugin data. A status
 * unchanged since the file was read keeps the file's own record.
 */
export function serializeNodeStatus(node: SceneNode, nc: KiwiNodeChange): void {
  node.pluginData = withPluginData(
    node.pluginData,
    OPEN_PENCIL_PLUGIN_DATA.status,
    node.status ?? undefined
  )
  if (readEffectiveFigmaRawField(node, 'sectionStatusInfo') !== undefined) return
  const figma = node.status ? figmaDevStatusOf(node.status) : null
  if (figma) nc.sectionStatusInfo = { status: FIGMA_SECTION_STATUS[figma] }
}
