import type { DesignJSXLayerLine } from '@/app/code/live-preview'

/**
 * How the code in an editor relates to layers.
 *
 * Generated code emits one element per layer in pre-order, so `order` pairs elements with layer
 * ids by position. Authored code can create many layers from one element (components, `map`)
 * or none, so `lines` names the line and runtime type each rendered layer came from.
 */
export type LayerLinkSource =
  | { kind: 'order'; layerIds: ReadonlyArray<string | null> }
  | { kind: 'lines'; layers: readonly DesignJSXLayerLine[] }
