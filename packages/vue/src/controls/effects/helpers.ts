import type { Effect, SceneNode } from '@open-pencil/core/scene-graph'
import type { Color } from '@open-pencil/core/types'
import type { Editor } from '@open-pencil/core/editor'
import type { Ref } from 'vue'

type EffectType = Effect['type']

const EFFECT_LABELS: Record<string, string> = {
  DROP_SHADOW: 'Drop shadow',
  INNER_SHADOW: 'Inner shadow',
  LAYER_BLUR: 'Layer blur',
  BACKGROUND_BLUR: 'Background blur',
  FOREGROUND_BLUR: 'Foreground blur'
}

export const EFFECT_TYPES = Object.keys(EFFECT_LABELS) as EffectType[]
export const EFFECT_OPTIONS = EFFECT_TYPES.map((t) => ({ value: t, label: EFFECT_LABELS[t] }))

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

export function createEffectEditActions(editor: Editor, effectsBeforeScrub: Ref<Effect[] | null>) {
  function scrubEffect(node: SceneNode | null, index: number, changes: Partial<Effect>) {
    if (!node) return
    if (!effectsBeforeScrub.value) {
      effectsBeforeScrub.value = node.effects.map((e) => ({
        ...e,
        color: { ...e.color },
        offset: { ...e.offset }
      }))
    }
    const effects = [...node.effects]
    effects[index] = { ...effects[index], ...changes }
    editor.updateNode(node.id, { effects })
    editor.requestRender()
  }

  function commitEffect(node: SceneNode | null, index: number, changes: Partial<Effect>) {
    if (!node) return
    const previous = effectsBeforeScrub.value
    effectsBeforeScrub.value = null
    const effects = [...node.effects]
    effects[index] = { ...effects[index], ...changes }
    editor.updateNode(node.id, { effects })
    editor.requestRender()
    if (previous) {
      editor.commitNodeUpdate(node.id, { effects: previous }, 'Change effect')
    }
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

  function handleRemove(removeFn: (index: number) => void, index: number) {
    removeFn(index)
    if (expandedIndex.value === index) expandedIndex.value = null
    else if (expandedIndex.value !== null && expandedIndex.value > index) expandedIndex.value--
  }

  function toggleExpand(index: number) {
    expandedIndex.value = expandedIndex.value === index ? null : index
  }

  return { updateType, updateColor, handleRemove, toggleExpand }
}
