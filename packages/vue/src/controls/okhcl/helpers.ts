import type { Ref } from 'vue'

import type { Editor } from '@open-pencil/core'
import { BLACK } from '@open-pencil/core/constants'
import type { SceneNode, ColorProfile } from '@open-pencil/scene-graph'
import {
  getFillOkHCL,
  getStrokeOkHCL,
  okhclInProfile,
  paintOkHCL,
  rememberPaintOkHCL,
  rgbaToOkHCL,
  setNodeFillOkHCL,
  setNodeStrokeOkHCL,
  type OkHCLColor
} from '@open-pencil/scene-graph/color'

import type { ColorFieldFormat } from '#vue/controls/color-model/types'

type ColorKind = 'fill' | 'stroke'

function fieldKey(kind: ColorKind, nodeId: string, index: number) {
  return `${kind}:${nodeId}:${index}`
}

/** The OkHCL color a fill is edited in, while it still makes the fill's stored color. */
export function getFillOkHCLColor(
  node: SceneNode | null,
  index: number,
  profile: ColorProfile
): OkHCLColor | null {
  return node ? paintOkHCL(node, 'fill', index, profile) : null
}

/** The OkHCL color a stroke is edited in, while it still makes the stroke's stored color. */
export function getStrokeOkHCLColor(
  node: SceneNode | null,
  index: number,
  profile: ColorProfile
): OkHCLColor | null {
  return node ? paintOkHCL(node, 'stroke', index, profile) : null
}

function fallbackFillOkHCL(node: SceneNode, index: number, profile: ColorProfile) {
  return (
    getFillOkHCLColor(node, index, profile) ??
    rgbaToOkHCL(node.fills[index]?.color ?? BLACK, profile)
  )
}

function fallbackStrokeOkHCL(node: SceneNode, index: number, profile: ColorProfile) {
  return (
    getStrokeOkHCLColor(node, index, profile) ??
    rgbaToOkHCL(node.strokes[index]?.color ?? BLACK, profile)
  )
}

export function createOkHCLActions(editor: Editor) {
  // Colours are stored in the document's profile, so both directions use it.
  const colorSpace = () => editor.graph.documentColorSpace

  // Picking the OkHCL format keeps the color it starts from without rewriting the paint.
  function ensureFillOkHCL(node: SceneNode, index: number) {
    if (getFillOkHCLColor(node, index, colorSpace())) return
    const color = fallbackFillOkHCL(node, index, colorSpace())
    editor.updateNodeWithUndo(
      node.id,
      rememberPaintOkHCL(node, 'fill', index, color),
      'Update fill color model'
    )
  }

  function ensureStrokeOkHCL(node: SceneNode, index: number) {
    if (getStrokeOkHCLColor(node, index, colorSpace())) return
    const color = fallbackStrokeOkHCL(node, index, colorSpace())
    editor.updateNodeWithUndo(
      node.id,
      rememberPaintOkHCL(node, 'stroke', index, color),
      'Update stroke color model'
    )
  }

  function updateFillOkHCL(node: SceneNode, index: number, patch: Partial<OkHCLColor>) {
    const current = fallbackFillOkHCL(node, index, colorSpace())
    editor.updateNodeWithUndo(
      node.id,
      setNodeFillOkHCL(node, index, { ...current, ...patch }, colorSpace()),
      'Change fill OkHCL'
    )
  }

  function updateStrokeOkHCL(node: SceneNode, index: number, patch: Partial<OkHCLColor>) {
    const current = fallbackStrokeOkHCL(node, index, colorSpace())
    editor.updateNodeWithUndo(
      node.id,
      setNodeStrokeOkHCL(node, index, { ...current, ...patch }, colorSpace()),
      'Change stroke OkHCL'
    )
  }

  return { ensureFillOkHCL, ensureStrokeOkHCL, updateFillOkHCL, updateStrokeOkHCL }
}

/**
 * Whether an OkHCL color shows as itself: `shown` is the profile the canvas presents, so a color
 * past it is clipped there, on a P3 canvas past P3, and in an sRGB fallback past sRGB.
 */
export function createOkHCLPreviewHelpers(editor: Editor, shown: () => ColorProfile) {
  function getPreviewInfo(okhcl: OkHCLColor | null) {
    const previewColorSpace = shown()
    if (!okhcl) return { previewColorSpace, clipped: false }
    return { previewColorSpace, clipped: okhclInProfile(okhcl, previewColorSpace).clipped }
  }

  function getFillPreviewInfo(node: SceneNode | null, index: number) {
    return getPreviewInfo(getFillOkHCLColor(node, index, editor.graph.documentColorSpace))
  }

  function getStrokePreviewInfo(node: SceneNode | null, index: number) {
    return getPreviewInfo(getStrokeOkHCLColor(node, index, editor.graph.documentColorSpace))
  }

  return { getFillPreviewInfo, getStrokePreviewInfo }
}

export function createOkHCLFieldFormats(
  fieldFormats: Ref<Map<string, ColorFieldFormat>>,
  ensureFillOkHCL: (node: SceneNode, index: number) => void,
  ensureStrokeOkHCL: (node: SceneNode, index: number) => void
) {
  function getFieldFormat(node: SceneNode | null, index: number, kind: ColorKind) {
    if (!node) return 'rgb' as const
    const key = fieldKey(kind, node.id, index)
    const stored = fieldFormats.value.get(key)
    if (stored) return stored
    return (kind === 'fill' ? getFillOkHCL(node, index) : getStrokeOkHCL(node, index))
      ? 'okhcl'
      : 'rgb'
  }

  function setFillFieldFormat(node: SceneNode, index: number, format: ColorFieldFormat) {
    fieldFormats.value.set(fieldKey('fill', node.id, index), format)
    if (format === 'okhcl') ensureFillOkHCL(node, index)
  }

  function setStrokeFieldFormat(node: SceneNode, index: number, format: ColorFieldFormat) {
    fieldFormats.value.set(fieldKey('stroke', node.id, index), format)
    if (format === 'okhcl') ensureStrokeOkHCL(node, index)
  }

  return { getFieldFormat, setFillFieldFormat, setStrokeFieldFormat }
}

export const OKHCL_FIELD_OPTIONS = [
  { value: 'rgb' as const, label: 'RGB' },
  { value: 'hsl' as const, label: 'HSL' },
  { value: 'hsb' as const, label: 'HSB' },
  { value: 'okhcl' as const, label: 'OkHCL' }
]
