import { computed } from 'vue'
import type { ComputedRef } from 'vue'

import type { Editor } from '@open-pencil/core/editor'
import { FONT_WEIGHT_NAMES, weightToStyle } from '@open-pencil/core/text'
import type { SceneNode, TextDecoration, TextListType } from '@open-pencil/scene-graph'

import { createTextListActions, listTypeOf } from '#vue/canvas/text-edit/lists'
import type { UseTypographyOptions } from '#vue/controls/typography/use'
import { useSceneComputed } from '#vue/internal/scene-computed/use'
import { useNodeFontStatus } from '#vue/shared/font-status/use'

type TextAlign = SceneNode['textAlignHorizontal']
type TextDirection = SceneNode['textDirection']
type TextVerticalAlign = SceneNode['textAlignVertical']
type TextCase = SceneNode['textCase']
type TextTruncation = SceneNode['textTruncation']

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
  /** The list style of the text, or of the paragraphs being edited; `null` when mixed. */
  const listType = computed(() => (node.value ? listTypeOf(editor, node.value) : null))
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
    listType,
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
  const lists = createTextListActions(editor)
  let propBeforePreview:
    | { key: keyof SceneNode; value: SceneNode[keyof SceneNode]; textStyleId: string | null }
    | undefined

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

  function setVerticalAlign(align: TextVerticalAlign) {
    if (!node.value) return
    editor.updateNodeWithUndo(
      node.value.id,
      { textAlignVertical: align },
      'Change vertical text alignment'
    )
  }

  function setTextCase(textCase: TextCase) {
    if (!node.value) return
    editor.updateNodeWithUndo(node.value.id, { textCase }, 'Change text case')
  }

  function setTruncation(textTruncation: TextTruncation) {
    if (!node.value) return
    editor.updateNodeWithUndo(node.value.id, { textTruncation }, 'Change text truncation')
  }

  function setFontFeature(tag: string, enabled: boolean) {
    if (!node.value) return
    const fontFeatures = node.value.fontFeatures.filter((feature) => feature.tag !== tag)
    fontFeatures.push({ tag, enabled })
    editor.updateNodeWithUndo(node.value.id, { fontFeatures }, `Change ${tag} feature`)
  }

  function setListType(listType: TextListType) {
    if (!node.value) return
    lists.setListType(node.value, listType)
  }

  function setHangingList(hangingList: boolean) {
    if (!node.value) return
    editor.updateNodeWithUndo(node.value.id, { hangingList }, 'Change hanging lists')
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

  function updateProp(key: keyof SceneNode, value: number | string | null) {
    if (!node.value) return
    if (!propBeforePreview || propBeforePreview.key !== key) {
      propBeforePreview = {
        key,
        value: node.value[key],
        textStyleId: node.value.textStyleId
      }
    }
    editor.updateNode(node.value.id, { [key]: value } as Partial<SceneNode>)
  }

  function commitProp(
    key: keyof SceneNode,
    _value: number | string | null,
    previous: number | string | null
  ) {
    if (!node.value) return
    const snapshot = propBeforePreview?.key === key ? propBeforePreview : undefined
    editor.commitNodeUpdate(
      node.value.id,
      {
        [key]: snapshot ? snapshot.value : previous,
        ...(snapshot ? { textStyleId: snapshot.textStyleId } : {})
      } as Partial<SceneNode>,
      `Change ${String(key)}`
    )
    propBeforePreview = undefined
  }

  return {
    setFamily,
    setWeight,
    setAlign,
    setDirection,
    setVerticalAlign,
    setTextCase,
    setTruncation,
    setFontFeature,
    setListType,
    setHangingList,
    toggleBold,
    toggleItalic,
    toggleDecoration,
    onFormattingChange,
    updateProp,
    commitProp
  }
}
