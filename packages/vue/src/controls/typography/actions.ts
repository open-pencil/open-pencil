import { useSceneComputed } from '#vue/internal/scene-computed/use'
import { useNodeFontStatus } from '#vue/shared/font-status/use'
import { computed } from 'vue'

import { FONT_WEIGHT_NAMES, weightToStyle } from '@open-pencil/core/text'

import type { UseTypographyOptions } from '#vue/controls/typography/use'
import type { Editor } from '@open-pencil/core/editor'
import type { SceneNode, TextDecoration } from '@open-pencil/core/scene-graph'
import type { ComputedRef } from 'vue'

type TextAlign = 'LEFT' | 'CENTER' | 'RIGHT'
type TextDirection = SceneNode['textDirection']

export const TYPOGRAPHY_WEIGHTS = Object.entries(FONT_WEIGHT_NAMES).map(([value, label]) => ({
  value: Number(value),
  label
}))

export function createTypographyState(editor: Editor) {
  const node = useSceneComputed<SceneNode | null>(() => editor.getSelectedNode() ?? null)
  const { missingFonts, hasMissingFonts } = useNodeFontStatus(() => node.value)
  const fontFamily = computed(() => node.value?.fontFamily ?? '')
  const fontWeight = computed(() => node.value?.fontWeight ?? 400)
  const fontSize = computed(() => node.value?.fontSize ?? 16)
  const currentWeightLabel = computed(
    () => FONT_WEIGHT_NAMES[node.value?.fontWeight ?? 400] ?? 'Regular'
  )
  const activeFormatting = computed(() => {
    const n = node.value
    if (!n) return []
    const result: string[] = []
    if (n.fontWeight >= 700) result.push('bold')
    if (n.italic) result.push('italic')
    if (n.textDecoration === 'UNDERLINE') result.push('underline')
    if (n.textDecoration === 'STRIKETHROUGH') result.push('strikethrough')
    return result
  })

  return {
    node,
    fontFamily,
    fontWeight,
    fontSize,
    currentWeightLabel,
    activeFormatting,
    missingFonts,
    hasMissingFonts
  }
}

type TypographyActionOptions = {
  editor: Editor
  node: ComputedRef<SceneNode | null>
  currentWeightLabel: ComputedRef<string>
  activeFormatting: ComputedRef<string[]>
  options: UseTypographyOptions
}

export function createTypographyActions({
  editor,
  node,
  currentWeightLabel,
  activeFormatting,
  options
}: TypographyActionOptions) {
  async function doLoadFont(family: string, style: string) {
    await options.fontLoader?.load(family, style)
  }

  async function setFamily(family: string) {
    if (!node.value) return
    await doLoadFont(family, currentWeightLabel.value)
    editor.updateNodeWithUndo(node.value.id, { fontFamily: family }, 'Change font')
  }

  async function setWeight(weight: number) {
    if (!node.value) return
    const { id, fontFamily } = node.value
    const style = weightToStyle(weight)
    editor.updateNodeWithUndo(id, { fontWeight: weight }, 'Change font weight')
    await doLoadFont(fontFamily, style)
  }

  function setAlign(align: TextAlign) {
    if (!node.value) return
    editor.updateNodeWithUndo(
      node.value.id,
      { textAlignHorizontal: align },
      'Change text alignment'
    )
  }

  function setDirection(direction: TextDirection) {
    if (!node.value) return
    editor.updateNodeWithUndo(node.value.id, { textDirection: direction }, 'Change text direction')
  }

  function toggleBold() {
    if (!node.value) return
    void setWeight(node.value.fontWeight >= 700 ? 400 : 700)
  }

  function toggleItalic() {
    if (!node.value) return
    editor.updateNodeWithUndo(node.value.id, { italic: !node.value.italic }, 'Toggle italic')
  }

  function toggleDecoration(deco: 'UNDERLINE' | 'STRIKETHROUGH') {
    if (!node.value) return
    const current = node.value.textDecoration
    editor.updateNodeWithUndo(
      node.value.id,
      { textDecoration: (current === deco ? 'NONE' : deco) as TextDecoration },
      `Toggle ${deco.toLowerCase()}`
    )
  }

  function onFormattingChange(values: string[]) {
    if (!node.value) return
    const prev = activeFormatting.value
    const added = values.filter((v) => !prev.includes(v))
    const removed = prev.filter((v) => !values.includes(v))
    for (const item of [...added, ...removed]) {
      if (item === 'bold') toggleBold()
      else if (item === 'italic') toggleItalic()
      else if (item === 'underline') toggleDecoration('UNDERLINE')
      else if (item === 'strikethrough') toggleDecoration('STRIKETHROUGH')
    }
  }

  function updateProp(key: string, value: number | string) {
    if (node.value) editor.updateNode(node.value.id, { [key]: value })
  }

  function commitProp(key: string, _value: number | string, previous: number | string) {
    if (node.value) {
      editor.commitNodeUpdate(
        node.value.id,
        { [key]: previous } as Partial<SceneNode>,
        `Change ${key}`
      )
    }
  }

  return {
    setFamily,
    setWeight,
    setAlign,
    setDirection,
    toggleBold,
    toggleItalic,
    toggleDecoration,
    onFormattingChange,
    updateProp,
    commitProp
  }
}
