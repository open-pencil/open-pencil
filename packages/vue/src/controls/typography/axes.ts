import { omit } from 'es-toolkit/object'
import { computed, type ComputedRef } from 'vue'

import type { Editor } from '@open-pencil/core'
import { drawnFontAxes, layerTextStyleChanges, type DrawnFontAxis } from '@open-pencil/core/text'
import type { FontVariation, SceneNode } from '@open-pencil/scene-graph'

import { MIXED, type MixedValue } from '#vue/controls/node-props/use'
import { useUndoBatch } from '#vue/controls/undo-batch/use'

/** An axis of the selected text's variable font, with the value every layer draws it at. */
export interface TypographyAxis extends Omit<DrawnFontAxis, 'value'> {
  value: MixedValue<number>
}

const OPTICAL_SIZE = 'opsz'

function drawnAxes(node: SceneNode): DrawnFontAxis[] | null {
  return drawnFontAxes({
    family: node.fontFamily,
    weight: node.fontWeight,
    italic: node.italic,
    fontSize: node.fontSize,
    variations: node.fontVariations,
    opticalSizeFromFontSize: node.opticalSizeFromFontSize
  })
}

/**
 * The axes a text keeps when it changes style, as a named style draws at its own: none, except an
 * optical size set by hand, which stays set by hand.
 */
export function styleFontVariations(node: SceneNode): FontVariation[] {
  if (node.opticalSizeFromFontSize) return []
  return node.fontVariations.filter(({ axis }) => axis === OPTICAL_SIZE)
}

/** A change to one axis: how it rewrites a list of axes, and what else it sets on the text. */
interface AxisEdit {
  variations: (variations: FontVariation[]) => FontVariation[]
  changes?: Pick<Partial<SceneNode>, 'opticalSizeFromFontSize'>
}

/** `axis` set to `value`; an optical size set by hand no longer follows the size. */
function setAxisEdit(axis: string, value: number): AxisEdit {
  return {
    variations: (variations) => [
      ...variations.filter((variation) => variation.axis !== axis),
      { axis, value }
    ],
    ...(axis === OPTICAL_SIZE ? { changes: { opticalSizeFromFontSize: false } } : {})
  }
}

/**
 * An axis edit on a whole text: on its own axes and on each range's, so a range keeps the other
 * axes it sets, as it keeps its other styles.
 */
function wholeTextAxisChanges(node: SceneNode, edit: AxisEdit): Partial<SceneNode> {
  const styleRuns = node.styleRuns.map((run) =>
    run.style.fontVariations
      ? {
          ...run,
          style: { ...run.style, fontVariations: edit.variations(run.style.fontVariations) }
        }
      : run
  )
  return {
    styleRuns,
    ...layerTextStyleChanges({ ...node, styleRuns }, edit.changes ?? {}),
    fontVariations: edit.variations(node.fontVariations)
  }
}

/**
 * The variation axes of the selected text layers' font, as Figma's Variable type settings list
 * them, and actions that set them. Layers in different families or slants have no shared axes.
 */
export function createTypographyAxes(editor: Editor, nodes: ComputedRef<SceneNode[]>) {
  const axes = computed<TypographyAxis[]>(() => {
    const first = nodes.value.at(0)
    if (!first) return []
    const same = nodes.value.every(
      (node) => node.fontFamily === first.fontFamily && node.italic === first.italic
    )
    if (!same) return []
    const perNode = nodes.value.map(drawnAxes)
    const axesOfFirst = perNode.at(0)
    if (!axesOfFirst || perNode.some((drawn) => !drawn)) return []
    return axesOfFirst.map((axis, index) => {
      const values = perNode.map((drawn) => drawn?.[index]?.value)
      return { ...axis, value: values.every((value) => value === axis.value) ? axis.value : MIXED }
    })
  })

  /** Whether the optical size follows the font size on every layer, MIXED when they differ. */
  const opticalSizeAuto = computed<MixedValue<boolean>>(() => {
    const first = nodes.value.at(0)
    if (!first) return MIXED
    return nodes.value.every(
      (node) => node.opticalSizeFromFontSize === first.opticalSizeFromFontSize
    )
      ? first.opticalSizeFromFontSize
      : MIXED
  })

  // A drag or a typed value is previewed, then committed as one undo step from the values it
  // started at, as the other typography fields are. While text is edited, the editor applies
  // both to the selected characters, and records the step with what was typed.
  type AxisValues = Pick<
    SceneNode,
    'fontVariations' | 'opticalSizeFromFontSize' | 'styleRuns' | 'textStyleId'
  >
  const beforePreview = new Map<string, AxisValues>()
  // The previews belong to the step the commit records, so undoing it leaves nothing unsaved.
  const batch = useUndoBatch(editor.undo, () => editor.beginInteractiveEdit())

  /**
   * Previews `edit` on every selected text: while text is edited the editor applies it to the
   * selected characters, whose style the panel shows; otherwise to the whole text.
   */
  function previewEach(edit: (shown: SceneNode) => AxisEdit) {
    batch.ensure('typography:axes', 'Change font axes')
    for (const target of nodes.value) {
      // The panel shows a text's characters' style, so what it replaces is read from the layer.
      const own = editor.graph.getNode(target.id) ?? target
      if (!beforePreview.has(target.id)) {
        const { fontVariations, opticalSizeFromFontSize, styleRuns, textStyleId } = own
        beforePreview.set(target.id, {
          fontVariations,
          opticalSizeFromFontSize,
          styleRuns,
          textStyleId
        })
      }
      const axisEdit = edit(target)
      editor.updateNode(
        target.id,
        editor.state.editingTextId === target.id
          ? { fontVariations: axisEdit.variations(target.fontVariations), ...axisEdit.changes }
          : wholeTextAxisChanges(own, axisEdit)
      )
    }
    editor.requestRender()
  }

  function commitPreview(label: string) {
    editor.undo.runBatch(label, () => {
      // While text is edited, the editor records the selected characters' ranges itself.
      for (const [id, before] of beforePreview) {
        const values = omit(before, ['textStyleId'])
        const edited = editor.state.editingTextId === id
        editor.commitNodeUpdate(id, edited ? omit(values, ['styleRuns']) : values, label)
      }
    })
    beforePreview.clear()
    batch.flush()
  }

  /** Draws the text at `value` on `axis` while it is dragged or typed. */
  function previewAxis(axis: string, value: number) {
    previewEach(() => setAxisEdit(axis, value))
  }

  /**
   * Puts back the axes and ranges a cancelled edit previewed. The text style it names goes back
   * too, so the editor restores the layer rather than styling selected characters with it.
   */
  function cancelAxis() {
    for (const [id, before] of beforePreview) editor.updateNode(id, before)
    beforePreview.clear()
    batch.flush()
    editor.requestRender()
  }

  /** Sets `axis` to `value` on every selected text layer in one undo step. */
  function setAxis(axis: string, value: number) {
    previewAxis(axis, value)
    commitPreview(`Change ${axis} axis`)
  }

  /**
   * Lets the optical size follow the font size, or holds it at the size it is drawn at now, as
   * Figma's "Set optical size automatically" does.
   */
  function setOpticalSizeAuto(auto: boolean) {
    previewEach((shown) => {
      const drawn = drawnAxes(shown)?.find((axis) => axis.tag === OPTICAL_SIZE)
      return {
        variations: (variations) => {
          const rest = variations.filter(({ axis }) => axis !== OPTICAL_SIZE)
          return auto || !drawn ? rest : [...rest, { axis: OPTICAL_SIZE, value: drawn.value }]
        },
        changes: { opticalSizeFromFontSize: auto }
      }
    })
    commitPreview('Change optical size')
  }

  return {
    axes,
    opticalSizeAuto,
    previewAxis,
    cancelAxis,
    setAxis,
    setOpticalSizeAuto
  }
}
