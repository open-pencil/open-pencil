import { computed } from 'vue'
import type { ComputedRef } from 'vue'

import type { Editor } from '@open-pencil/core'
import { fontManager, nearestFamilyFace } from '@open-pencil/core/text'
import type {
  SceneNode,
  TextDecoration,
  TextLength,
  TextListType,
  TextParagraphSpacingField
} from '@open-pencil/scene-graph'
import { FONT_WEIGHT_NAMES, weightToStyle } from '@open-pencil/scene-graph/font-style'
import { shapeWithTextLabel } from '@open-pencil/scene-graph/generated'

import {
  createTextListActions,
  listTypeOf,
  paragraphSpacingChanges,
  paragraphSpacingOf
} from '#vue/canvas/text-edit/paragraphs'
import { MIXED, type MixedValue } from '#vue/controls/node-props/use'
import { styleFontVariations } from '#vue/controls/typography/axes'
import { useFamilyFaces } from '#vue/controls/typography/faces'
import type { UseTypographyOptions } from '#vue/controls/typography/use'
import { useUndoBatch } from '#vue/controls/undo-batch/use'
import { selectedNodesAsShown } from '#vue/editor/selection-state/nodes'
import { useSceneComputed } from '#vue/internal/scene-computed/use'
import { useNodeFontStatus } from '#vue/shared/font-status/use'

type TextAlign = SceneNode['textAlignHorizontal']
type TextDirection = SceneNode['textDirection']
type TextVerticalAlign = SceneNode['textAlignVertical']
type TextCase = SceneNode['textCase']
type TextTruncation = SceneNode['textTruncation']
/** A value the panel previews and commits on every selected text. */
type PropValue = number | string | TextLength | null

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

/** The text a selected layer's typography edits: its own, or a shape with text's label. */
function typographyTargets(editor: Editor): SceneNode[] {
  return selectedNodesAsShown(editor).flatMap((n) => {
    if (n.type === 'TEXT') return [n]
    const label = shapeWithTextLabel(editor.graph, n)
    return label ? [label] : []
  })
}

/**
 * Typography of the selected text layers and shapes' labels. With other layers selected too,
 * Figma shows the text's typography and edits only the text, so `nodes` holds just the text.
 */
export function createTypographyState(editor: Editor) {
  const nodes = useSceneComputed<SceneNode[]>(() => typographyTargets(editor))
  const node = computed<SceneNode | null>(() => nodes.value.at(0) ?? null)
  const { missingFonts, hasMissingFonts } = useNodeFontStatus(() => node.value)
  const fontFamily = computed(() => node.value?.fontFamily ?? '')
  const fontWeight = computed(() => node.value?.fontWeight ?? 400)
  const fontSize = computed(() => node.value?.fontSize ?? 16)
  const currentWeightLabel = computed(
    () => FONT_WEIGHT_NAMES[node.value?.fontWeight ?? 400] ?? 'Regular'
  )
  const activeFormatting = computed(() => sharedFormatting(nodes.value))
  const { weights, supports } = useFamilyFaces(nodes)
  /**
   * The list style every selected text shares, or that of the paragraphs being edited; `null`
   * when they differ.
   */
  const listType = computed(() => {
    void editor.state.textSelectionVersion
    const shared = sharedValue(nodes.value.map((n) => listTypeOf(editor, n)))
    return shared === MIXED ? null : shared
  })

  /** The value every selected text layer shares, or MIXED when they differ. */
  function merged<K extends keyof SceneNode>(key: K): MixedValue<SceneNode[K]> {
    return sharedValue(nodes.value.map((n) => n[key]))
  }

  /** A spacing every paragraph changes apply to shares, or MIXED when they differ. */
  function paragraphSpacing(field: TextParagraphSpacingField): MixedValue<number> {
    void editor.state.textSelectionVersion
    const values = nodes.value.map((n) => paragraphSpacingOf(editor, n, field))
    const shared = sharedValue(values)
    return shared === null ? MIXED : shared
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
    paragraphSpacing,
    fontFeature,
    fontFamily,
    fontWeight,
    fontSize,
    currentWeightLabel,
    activeFormatting,
    listType,
    weights,
    supports,
    missingFonts,
    hasMissingFonts
  }
}

type TypographyActionOptions = {
  editor: Editor
  nodes: ComputedRef<SceneNode[]>
  activeFormatting: ComputedRef<string[]>
  /** Whether a layer's family has a face; true when nothing says it has not. */
  supports: (node: SceneNode, weight: number, italic: boolean) => boolean
  options: UseTypographyOptions
}

export function createTypographyActions({
  editor,
  nodes,
  activeFormatting,
  supports,
  options
}: TypographyActionOptions) {
  const lists = createTextListActions(editor)
  // A dragged field's previews belong to the step its commit records, so they are not edits of
  // their own that keep the document unsaved after that step is undone.
  const batch = useUndoBatch(editor.undo, () => editor.beginInteractiveEdit())
  type Preview = { value: SceneNode[keyof SceneNode]; textStyleId: string | null }
  let previewKey: keyof SceneNode | undefined
  const beforePreview = new Map<string, Preview>()

  /** Applies one change per text layer in one undo step. */
  function updateEach(
    label: string,
    changes: (node: SceneNode) => Partial<SceneNode>,
    targets = nodes.value
  ) {
    if (targets.length === 0) return
    editor.undo.runBatch(label, () => {
      for (const target of targets) editor.updateNodeWithUndo(target.id, changes(target), label)
    })
  }

  function update(label: string, changes: Partial<SceneNode>) {
    updateEach(label, () => changes)
  }

  /** The newest pending change for each layer and field, by `id:field`. */
  const latestLoadingRequest = new Map<string, symbol>()

  /**
   * Applies each layer's change once its face has loaded, to the layers selected when it was
   * asked for: the selection may change while the load is pending, and a layer may be deleted.
   * `prepare` loads a layer's face and returns its change, or null to leave the layer alone.
   */
  async function updateAfterLoading(
    label: string,
    fields: readonly (keyof SceneNode)[],
    prepare: (target: SceneNode) => Promise<Partial<SceneNode> | null>,
    targets = nodes.value
  ) {
    if (targets.length === 0) return
    const request = Symbol(label)
    const keys = (target: SceneNode) => fields.map((field) => `${target.id}:${field}`)
    for (const target of targets)
      for (const key of keys(target)) latestLoadingRequest.set(key, request)
    const changes = await Promise.all(targets.map(prepare))
    // A later choice for the same field wins, even when its face loaded first.
    const current = targets.filter((target) =>
      keys(target).every((key) => latestLoadingRequest.get(key) === request)
    )
    for (const target of current) for (const key of keys(target)) latestLoadingRequest.delete(key)
    const changed = new Map(targets.map((target, index) => [target.id, changes[index]]))
    const live = current.filter(
      (target) => editor.graph.getNode(target.id) && changed.get(target.id)
    )
    updateEach(label, (target) => changed.get(target.id) ?? {}, live)
  }

  /**
   * Keeps each layer's weight and slant where the family has them, otherwise takes the nearest
   * face, as Figma does: Black goes to Bold in a family that ends at Bold.
   */
  async function setFamily(family: string) {
    const faces = fontManager.familyFaces(family)
    await updateAfterLoading(
      'Change font',
      ['fontFamily', 'fontWeight', 'italic'],
      async (target) => {
        const known = await faces
        const face = known ? nearestFamilyFace(known, target.fontWeight, target.italic) : null
        const fontWeight = face?.weight ?? target.fontWeight
        const italic = face?.italic ?? target.italic
        await options.fontLoader?.load(family, weightToStyle(fontWeight, italic))
        return {
          fontFamily: family,
          fontWeight,
          italic,
          fontVariations: styleFontVariations(target)
        }
      }
    )
  }

  /** Loads the face first, as for a family, so the text is laid out once with it. */
  async function setWeight(weight: number, targets = nodes.value) {
    await updateAfterLoading(
      'Change font weight',
      ['fontWeight'],
      async (target) => {
        await options.fontLoader?.load(target.fontFamily, weightToStyle(weight, target.italic))
        return { fontWeight: weight, fontVariations: styleFontVariations(target) }
      },
      targets
    )
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

  function setListType(listType: TextListType) {
    const targets = nodes.value
    if (targets.length === 0) return
    editor.undo.runBatch('Change list style', () => {
      for (const target of targets) lists.setListType(target, listType)
    })
  }

  type SpacingPreview = Pick<SceneNode, TextParagraphSpacingField | 'textParagraphs'>
  let spacingPreviewField: TextParagraphSpacingField | undefined
  const beforeSpacing = new Map<string, SpacingPreview>()

  function previewParagraphSpacing(field: TextParagraphSpacingField, value: number) {
    if (spacingPreviewField !== field) {
      restoreSpacingPreview()
      spacingPreviewField = field
    }
    for (const target of nodes.value) {
      if (!beforeSpacing.has(target.id)) {
        const { listSpacing, paragraphSpacing, paragraphIndent, textParagraphs } = target
        beforeSpacing.set(target.id, {
          listSpacing,
          paragraphSpacing,
          paragraphIndent,
          textParagraphs
        })
      }
      editor.updateNode(target.id, paragraphSpacingChanges(editor, target, field, value))
    }
    editor.requestRender()
  }

  function restoreSpacingPreview() {
    for (const [id, before] of beforeSpacing) editor.updateNode(id, before)
    beforeSpacing.clear()
    spacingPreviewField = undefined
  }

  /**
   * Sets a spacing for the paragraphs being edited, or for whole text layers, in one undo step;
   * while text is edited the change is a step of its own after what was typed.
   */
  function setParagraphSpacing(field: TextParagraphSpacingField, value: number) {
    restoreSpacingPreview()
    const targets = nodes.value
    if (targets.length === 0) return
    const label = `Change ${field}`
    editor.runTextEditStep(() => {
      editor.undo.runBatch(label, () => {
        for (const target of targets) {
          const current = editor.graph.getNode(target.id) ?? target
          editor.updateNodeWithUndo(
            target.id,
            paragraphSpacingChanges(editor, current, field, value),
            label
          )
        }
      })
    })
    editor.requestRender()
  }

  function setHangingList(hangingList: boolean) {
    update('Change hanging lists', { hangingList })
  }

  /**
   * Bold unless every text layer already is, as Figma's toggle does for a mixed selection. A layer
   * whose family has no such face is left alone, as Figma leaves it.
   */
  function toggleBold() {
    const weight = activeFormatting.value.includes('bold') ? 400 : 700
    void setWeight(
      weight,
      nodes.value.filter((target) => supports(target, weight, target.italic))
    )
  }

  function toggleItalic() {
    const italic = !activeFormatting.value.includes('italic')
    void updateAfterLoading(
      'Toggle italic',
      ['italic'],
      async (target) => {
        await options.fontLoader?.load(target.fontFamily, weightToStyle(target.fontWeight, italic))
        return { italic, fontVariations: styleFontVariations(target) }
      },
      nodes.value.filter((target) => supports(target, target.fontWeight, italic))
    )
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

  function updateProp(key: keyof SceneNode, value: PropValue) {
    batch.ensure(`typography:${String(key)}`, `Change ${String(key)}`)
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

  function commitProp(key: keyof SceneNode, _value: PropValue, previous: PropValue) {
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
    batch.flush()
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
    previewParagraphSpacing,
    setParagraphSpacing,
    setHangingList,
    toggleBold,
    toggleItalic,
    toggleDecoration,
    onFormattingChange,
    updateProp,
    commitProp
  }
}
