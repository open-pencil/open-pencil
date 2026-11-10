import type { Ref } from 'vue'

import type { Editor } from '@open-pencil/core'
import type { Effect, SceneNode } from '@open-pencil/scene-graph'
import { DEFAULT_GLASS } from '@open-pencil/scene-graph/constants'
import { copyEffects } from '@open-pencil/scene-graph/copy'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { useI18n } from '#vue/i18n/useI18n.js'

type EffectType = Effect['type']

const { panels } = useI18n()

export const EFFECT_TYPES = [
  'DROP_SHADOW',
  'INNER_SHADOW',
  'LAYER_BLUR',
  'BACKGROUND_BLUR',
  'FOREGROUND_BLUR',
  'GLASS'
] as const satisfies readonly EffectType[]

/** Read when asked, so the labels follow the language once its translations load. */
function effectLabels(): Record<(typeof EFFECT_TYPES)[number], string> {
  return {
    DROP_SHADOW: panels.value.dropShadow,
    INNER_SHADOW: panels.value.innerShadow,
    LAYER_BLUR: panels.value.layerBlur,
    BACKGROUND_BLUR: panels.value.backgroundBlur,
    FOREGROUND_BLUR: panels.value.foregroundBlur,
    GLASS: panels.value.glass
  }
}

export function effectOptions() {
  const labels = effectLabels()
  return EFFECT_TYPES.map((value) => ({ value, label: labels[value] }))
}

/**
 * The effect types the row at `index` can switch to: a layer holds one glass effect at most, as
 * in Figma, so glass is offered only to a row that has it or when no other row does. A layer
 * that scripts gave several keeps glass in each of those rows, so none shows a blank type.
 */
export function effectOptionsFor(effects: readonly Effect[], index: number) {
  const options = effectOptions()
  if (effects.at(index)?.type === 'GLASS') return options
  const glassElsewhere = effects.some((effect, i) => i !== index && effect.type === 'GLASS')
  return glassElsewhere ? options.filter((option) => option.value !== 'GLASS') : options
}

export function isShadow(type: string) {
  return type === 'DROP_SHADOW' || type === 'INNER_SHADOW'
}

export function createDefaultEffect(): Effect {
  return {
    type: 'DROP_SHADOW',
    color: { r: 0, g: 0, b: 0, a: 0.25 },
    offset: { x: 0, y: 4 },
    radius: 4,
    spread: 0,
    visible: true
  }
}

export interface EffectEditSnapshot {
  effects: Effect[]
  effectStyleId: string | null
}

/** Effects scrubbed on every selected node, each committed from its own value before the scrub. */
export function createEffectEditActions(
  editor: Editor,
  effectsBeforeScrub: Ref<Map<string, EffectEditSnapshot> | null>
) {
  function apply(nodes: readonly SceneNode[], index: number, changes: Partial<Effect>) {
    for (const node of nodes) {
      const effects = [...node.effects]
      const current = effects.at(index)
      if (!current) continue
      effects[index] = { ...current, ...changes }
      editor.updateNode(node.id, { effects })
    }
    editor.requestRender()
  }

  function snapshot(nodes: readonly SceneNode[]): Map<string, EffectEditSnapshot> {
    return new Map(
      nodes.map((node) => [
        node.id,
        { effects: copyEffects(node.effects), effectStyleId: node.effectStyleId }
      ])
    )
  }

  function scrubEffect(nodes: readonly SceneNode[], index: number, changes: Partial<Effect>) {
    if (nodes.length === 0) return
    effectsBeforeScrub.value ??= snapshot(nodes)
    apply(nodes, index, changes)
  }

  /** Commits a scrub, or a change made in one step such as a checkbox, as one undo step. */
  function commitEffect(nodes: readonly SceneNode[], index: number, changes: Partial<Effect>) {
    if (nodes.length === 0) return
    const previous = effectsBeforeScrub.value ?? snapshot(nodes)
    effectsBeforeScrub.value = null
    apply(nodes, index, changes)
    editor.undo.runBatch('Change effect', () => {
      for (const node of nodes) {
        const before = previous.get(node.id)
        if (!before) continue
        editor.commitNodeUpdate(
          node.id,
          { effects: before.effects, effectStyleId: before.effectStyleId },
          'Change effect'
        )
      }
    })
  }

  return { scrubEffect, commitEffect }
}

export function createEffectControlActions(expandedIndex: Ref<number | null>) {
  function updateType(
    patch: (index: number, changes: Partial<Effect>) => void,
    node: SceneNode | null,
    index: number,
    type: EffectType
  ) {
    if (!node) return
    const changes: Partial<Effect> = { type }
    if (type === 'GLASS') changes.glass = { ...DEFAULT_GLASS }
    else if (node.effects[index].type === 'GLASS') changes.glass = undefined
    if (!isShadow(type)) {
      changes.offset = { x: 0, y: 0 }
      changes.spread = 0
    } else if (!isShadow(node.effects[index].type)) {
      changes.offset = { x: 0, y: 4 }
      changes.spread = 0
    }
    patch(index, changes)
  }

  function updateColor(
    patch: (index: number, changes: Partial<Effect>) => void,
    index: number,
    color: Color
  ) {
    patch(index, { color })
  }

  function adjustExpandedAfterRemove(index: number) {
    if (expandedIndex.value === index) expandedIndex.value = null
    else if (expandedIndex.value !== null && expandedIndex.value > index) expandedIndex.value--
  }

  function handleRemove(removeFn: (index: number) => void, index: number) {
    removeFn(index)
    adjustExpandedAfterRemove(index)
  }

  function toggleExpand(index: number) {
    expandedIndex.value = expandedIndex.value === index ? null : index
  }

  return { updateType, updateColor, handleRemove, adjustExpandedAfterRemove, toggleExpand }
}
