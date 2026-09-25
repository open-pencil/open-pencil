import type { Ref } from 'vue'

import { BLACK } from '@open-pencil/core/constants'
import type { Editor } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/scene-graph'
import {
  getFillOkHCL,
  getStrokeOkHCL,
  resolveOkHCLForPreview,
  rgbaToOkHCL,
  setNodeFillOkHCL,
  setNodeStrokeOkHCL
} from '@open-pencil/scene-graph/color'
import type { OkHCLColor, OkHCLColorSpace } from '@open-pencil/scene-graph/color'

import type { ColorFieldFormat } from '#vue/controls/color-model/types'

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

function fallbackFillOkHCL(node: SceneNode, index: number, colorSpace: OkHCLColorSpace) {
  return (
    getFillOkHCLColor(node, index) ?? rgbaToOkHCL(node.fills[index]?.color ?? BLACK, colorSpace)
  )
}

function fallbackStrokeOkHCL(node: SceneNode, index: number, colorSpace: OkHCLColorSpace) {
  return (
    getStrokeOkHCLColor(node, index) ?? rgbaToOkHCL(node.strokes[index]?.color ?? BLACK, colorSpace)
  )
}

export function createOkHCLActions(editor: Editor) {
  // Colours are stored in the document's profile, so both directions use it.
  const colorSpace = () => editor.graph.documentColorSpace

  function ensureFillOkHCL(node: SceneNode, index: number) {
    editor.updateNodeWithUndo(
      node.id,
      setNodeFillOkHCL(node, index, fallbackFillOkHCL(node, index, colorSpace()), colorSpace()),
      'Update fill color model'
    )
  }

  function ensureStrokeOkHCL(node: SceneNode, index: number) {
    editor.updateNodeWithUndo(
      node.id,
      setNodeStrokeOkHCL(node, index, fallbackStrokeOkHCL(node, index, colorSpace()), colorSpace()),
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
