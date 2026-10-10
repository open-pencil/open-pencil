import { computed } from 'vue'
import type { ComputedRef } from 'vue'

import type { Editor } from '@open-pencil/core/editor'
import { FONT_WEIGHT_NAMES, weightToStyle } from '@open-pencil/core/text'
import type { SceneNode, TextDecoration } from '@open-pencil/scene-graph'

import { MIXED, type MixedValue } from '#vue/controls/node-props/use'
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

function sharedValue<T>(values: readonly T[]): MixedValue<T> {
  const [first] = values
  return values.every((value) => value === first) ? first : MIXED
}

/** The formatting every node has, so a mixed toggle reads as off. */
function sharedFormatting(nodes: readonly SceneNode[]) {
  if (nodes.length === 0) return []
  const result: string[] = []
  if (nodes.every((n) => n.fontWeight >= 700)) result.push('bold')
  if (nodes.every((n) => n.italic)) result.push('italic')
  if (nodes.every((n) => n.textDecoration === 'UNDERLINE')) result.push('underline')
  if (nodes.every((n) => n.textDecoration === 'STRIKETHROUGH')) result.push('strikethrough')
  return result
}

/**
 * Typography of the selected text layers. With other layers selected too, Figma shows the text's
 * typography and edits only the text, so `nodes` holds just the text layers.
 */
export function createTypographyState(editor: Editor) {
  const nodes = useSceneComputed<SceneNode[]>(() =>
    editor.getSelectedNodes().filter((n) => n.type === 'TEXT')
  )
  const node = computed<SceneNode | null>(() => nodes.value.at(0) ?? null)
  const { missingFonts, hasMissingFonts } = useNodeFontStatus(() => node.value)
  const fontFamily = computed(() => node.value?.fontFamily ?? '')
  const fontWeight = computed(() => node.value?.fontWeight ?? 400)
  const fontSize = computed(() => node.value?.fontSize ?? 16)
  const currentWeightLabel = computed(
    () => FONT_WEIGHT_NAMES[node.value?.fontWeight ?? 400] ?? 'Regular'
  )
  const activeFormatting = computed(() => sharedFormatting(nodes.value))

  /** The value every selected text layer shares, or MIXED when they differ. */
  function merged<K extends keyof SceneNode>(key: K): MixedValue<SceneNode[K]> {
    return sharedValue(nodes.value.map((n) => n[key]))
  }

  /** Whether one OpenType feature is on for every text layer, MIXED when they differ. */
  function fontFeature(tag: string): MixedValue<boolean> {
    return sharedValue(
      nodes.value.map((n) => n.fontFeatures.find((feature) => feature.tag === tag)?.enabled ?? true)
    )
  }

  return {
    node,
    nodes,
    merged,
    fontFeature,
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
  nodes: ComputedRef<SceneNode[]>
  activeFormatting: ComputedRef<string[]>
  options: UseTypographyOptions
}

export function createTypographyActions({
  editor,
  nodes,
  activeFormatting,
  options
}: TypographyActionOptions) {
  type Preview = { value: SceneNode[keyof SceneNode]; textStyleId: string | null }
  let previewKey: keyof SceneNode | undefined
  const beforePreview = new Map<string, Preview>()

  /** Applies one change per text layer in one undo step. */
  function updateEach(label: string, changes: (node: SceneNode) => Partial<SceneNode>) {
    const targets = nodes.value
    if (targets.length === 0) return
    editor.undo.runBatch(label, () => {
      for (const target of targets) editor.updateNodeWithUndo(target.id, changes(target), label)
    })
  }

  function update(label: string, changes: Partial<SceneNode>) {
    updateEach(label, () => changes)
  }

  async function setFamily(family: string) {
    const targets = nodes.value
    if (targets.length === 0) return
    await Promise.all(
      targets.map((target) =>
        options.fontLoader?.load(family, FONT_WEIGHT_NAMES[target.fontWeight] ?? 'Regular')
      )
    )
    update('Change font', { fontFamily: family })
  }

  async function setWeight(weight: number) {
    const targets = nodes.value
    if (targets.length === 0) return
    update('Change font weight', { fontWeight: weight })
    const style = weightToStyle(weight)
    await Promise.all(targets.map((target) => options.fontLoader?.load(target.fontFamily, style)))
  }

  function setAlign(align: TextAlign) {
    update('Change text alignment', { textAlignHorizontal: align })
  }

  function setDirection(direction: TextDirection) {
    update('Change text direction', { textDirection: direction })
  }

  function setVerticalAlign(align: TextVerticalAlign) {
    update('Change vertical text alignment', { textAlignVertical: align })
  }

  function setTextCase(textCase: TextCase) {
    update('Change text case', { textCase })
  }

  function setTruncation(textTruncation: TextTruncation) {
    update('Change text truncation', { textTruncation })
  }

  function setFontFeature(tag: string, enabled: boolean) {
    updateEach(`Change ${tag} feature`, (target) => ({
      fontFeatures: [
        ...target.fontFeatures.filter((feature) => feature.tag !== tag),
        { tag, enabled }
      ]
    }))
  }

  /** Bold unless every text layer already is, as Figma's toggle does for a mixed selection. */
  function toggleBold() {
    const bold = activeFormatting.value.includes('bold')
    void setWeight(bold ? 400 : 700)
  }

  function toggleItalic() {
    update('Toggle italic', { italic: !activeFormatting.value.includes('italic') })
  }

  function toggleDecoration(deco: 'UNDERLINE' | 'STRIKETHROUGH') {
    const on = activeFormatting.value.includes(deco.toLowerCase())
    update(`Toggle ${deco.toLowerCase()}`, {
      textDecoration: (on ? 'NONE' : deco) as TextDecoration
    })
  }

  function onFormattingChange(values: string[]) {
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
    if (previewKey !== key) {
      previewKey = key
      beforePreview.clear()
    }
    for (const target of nodes.value) {
      if (!beforePreview.has(target.id))
        beforePreview.set(target.id, { value: target[key], textStyleId: target.textStyleId })
      editor.updateNode(target.id, { [key]: value } as Partial<SceneNode>)
    }
  }

  function commitProp(
    key: keyof SceneNode,
    _value: number | string | null,
    previous: number | string | null
  ) {
    const targets = nodes.value
    if (targets.length === 0) return
    const snapshots = previewKey === key ? beforePreview : new Map<string, Preview>()
    editor.undo.runBatch(`Change ${String(key)}`, () => {
      for (const target of targets) {
        const snapshot = snapshots.get(target.id)
        editor.commitNodeUpdate(
          target.id,
          {
            [key]: snapshot ? snapshot.value : previous,
            ...(snapshot ? { textStyleId: snapshot.textStyleId } : {})
          } as Partial<SceneNode>,
          `Change ${String(key)}`
        )
      }
    })
    previewKey = undefined
    beforePreview.clear()
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
    toggleBold,
    toggleItalic,
    toggleDecoration,
    onFormattingChange,
    updateProp,
    commitProp
  }
}
