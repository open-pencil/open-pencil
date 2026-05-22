import type { Ref } from 'vue'

import type { Editor } from '@open-pencil/core/editor'
import type { Effect, SceneNode, ShadowEffect, BlurEffect } from '@open-pencil/core/scene-graph'
import type { Color } from '@open-pencil/core/types'

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

export function createDefaultEffect(): ShadowEffect {
  return {
    type: 'DROP_SHADOW',
    color: { r: 0, g: 0, b: 0, a: 0.25 },
    offset: { x: 0, y: 4 },
    radius: 4,
    spread: 0,
    visible: true
  }
}

type EffectPatch = Partial<ShadowEffect> | Partial<BlurEffect>

export function createEffectEditActions(editor: Editor, effectsBeforeScrub: Ref<Effect[] | null>) {
  function scrubEffect(node: SceneNode | null, index: number, changes: EffectPatch) {
    if (!node) return
    if (!effectsBeforeScrub.value) {
      effectsBeforeScrub.value = node.effects.map((e) => {
        if (isShadow(e.type)) {
          const s = e as ShadowEffect
          return { ...s, color: { ...s.color }, offset: { ...s.offset } }
        }
        return { ...e }
      })
    }
    const effects: Effect[] = [...node.effects]
    effects[index] = { ...effects[index], ...changes } as Effect
    editor.updateNode(node.id, { effects })
    editor.requestRender()
  }

  function commitEffect(node: SceneNode | null, index: number, changes: EffectPatch) {
    if (!node) return
    const previous = effectsBeforeScrub.value
    effectsBeforeScrub.value = null
    const effects: Effect[] = [...node.effects]
    effects[index] = { ...effects[index], ...changes } as Effect
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
    patch: (index: number, changes: EffectPatch) => void,
    node: SceneNode | null,
    index: number,
    type: EffectType
  ) {
    if (!node) return
    const current = node.effects[index]
    if (!isShadow(type)) {
      const changes: Partial<BlurEffect> = { type }
      if (isShadow(current.type)) {
        changes.radius = current.radius
      }
      patch(index, changes)
    } else if (!isShadow(current.type)) {
      patch(index, {
        type,
        offset: { x: 0, y: 4 },
        spread: 0,
        color: { r: 0, g: 0, b: 0, a: 0.25 }
      })
    } else {
      patch(index, { type })
    }
  }

  function updateColor(
    patch: (index: number, changes: EffectPatch) => void,
    index: number,
    color: Color
  ) {
    patch(index, { color } as Partial<ShadowEffect>)
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
