import {
  getFillOkHCL,
  getStrokeOkHCL,
  resolveOkHCLForPreview,
  rgbaToOkHCL,
  setNodeFillOkHCL,
  setNodeStrokeOkHCL
} from '@open-pencil/core/color'

import type { ColorFieldFormat } from '#vue/primitives/ColorPicker/types'
import type { OkHCLColor } from '@open-pencil/core/color'
import type { Editor } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/core/scene-graph'
import type { Ref } from 'vue'

type ColorKind = 'fill' | 'stroke'

function fieldKey(kind: ColorKind, nodeId: string, index: number) {
  return `${kind}:${nodeId}:${index}`
}

export function getFillOkHCLColor(node: SceneNode | null, index: number): OkHCLColor | null {
  return node ? (getFillOkHCL(node, index)?.color ?? null) : null
}

export function getStrokeOkHCLColor(node: SceneNode | null, index: number): OkHCLColor | null {
  return node ? (getStrokeOkHCL(node, index)?.color ?? null) : null
}

function fallbackFillOkHCL(node: SceneNode, index: number) {
  return (
    getFillOkHCLColor(node, index) ??
    rgbaToOkHCL(node.fills[index]?.color ?? { r: 0, g: 0, b: 0, a: 1 })
  )
}

function fallbackStrokeOkHCL(node: SceneNode, index: number) {
  return (
    getStrokeOkHCLColor(node, index) ??
    rgbaToOkHCL(node.strokes[index]?.color ?? { r: 0, g: 0, b: 0, a: 1 })
  )
}

export function createOkHCLActions(editor: Editor) {
  function ensureFillOkHCL(node: SceneNode, index: number) {
    editor.updateNodeWithUndo(
      node.id,
      setNodeFillOkHCL(node, index, fallbackFillOkHCL(node, index)),
      'Update fill color model'
    )
  }

  function ensureStrokeOkHCL(node: SceneNode, index: number) {
    editor.updateNodeWithUndo(
      node.id,
      setNodeStrokeOkHCL(node, index, fallbackStrokeOkHCL(node, index)),
      'Update stroke color model'
    )
  }

  function updateFillOkHCL(node: SceneNode, index: number, patch: Partial<OkHCLColor>) {
    const current = fallbackFillOkHCL(node, index)
    editor.updateNodeWithUndo(
      node.id,
      setNodeFillOkHCL(node, index, { ...current, ...patch }),
      'Change fill OkHCL'
    )
  }

  function updateStrokeOkHCL(node: SceneNode, index: number, patch: Partial<OkHCLColor>) {
    const current = fallbackStrokeOkHCL(node, index)
    editor.updateNodeWithUndo(
      node.id,
      setNodeStrokeOkHCL(node, index, { ...current, ...patch }),
      'Change stroke OkHCL'
    )
  }

  return { ensureFillOkHCL, ensureStrokeOkHCL, updateFillOkHCL, updateStrokeOkHCL }
}

export function createOkHCLPreviewHelpers(editor: Editor) {
  function getPreviewInfo(okhcl: OkHCLColor | null) {
    const documentColorSpace = editor.graph.documentColorSpace
    if (!okhcl) return { previewColorSpace: documentColorSpace, clipped: false }
    const resolved = resolveOkHCLForPreview(okhcl, { documentColorSpace })
    return { previewColorSpace: resolved.targetSpace, clipped: resolved.clipped }
  }

  function getFillPreviewInfo(node: SceneNode | null, index: number) {
    return getPreviewInfo(getFillOkHCLColor(node, index))
  }

  function getStrokePreviewInfo(node: SceneNode | null, index: number) {
    return getPreviewInfo(getStrokeOkHCLColor(node, index))
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
