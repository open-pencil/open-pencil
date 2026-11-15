import type { Ref } from 'vue'

import type { Editor } from '@open-pencil/core'
import type {
  Effect,
  NoiseEffectParams,
  SceneNode,
  TextureEffectParams
} from '@open-pencil/scene-graph'
import {
  DEFAULT_GLASS,
  DEFAULT_NOISE,
  DEFAULT_NOISE_COLOR,
  DEFAULT_TEXTURE,
  UNSET_NOISE,
  UNSET_TEXTURE
} from '@open-pencil/scene-graph/constants'
import { copyEffects } from '@open-pencil/scene-graph/copy'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { panelMessages } from '#vue/i18n/messages'

type EffectType = Effect['type']

export const EFFECT_TYPES = [
  'DROP_SHADOW',
  'INNER_SHADOW',
  'LAYER_BLUR',
  'BACKGROUND_BLUR',
  'FOREGROUND_BLUR',
  'NOISE',
  'TEXTURE',
  'GLASS'
] as const satisfies readonly EffectType[]

/** Read when asked, so the labels follow the language once its translations load. */
function effectLabels(): Record<(typeof EFFECT_TYPES)[number], string> {
  const panels = panelMessages.get()
  return {
    DROP_SHADOW: panels.dropShadow,
    INNER_SHADOW: panels.innerShadow,
    LAYER_BLUR: panels.layerBlur,
    BACKGROUND_BLUR: panels.backgroundBlur,
    FOREGROUND_BLUR: panels.foregroundBlur,
    NOISE: panels.noise,
    TEXTURE: panels.texture,
    GLASS: panels.glass
  }
}

export function effectOptions() {
  const labels = effectLabels()
  return EFFECT_TYPES.map((value) => ({ value, label: labels[value] }))
}

/** Effect types a layer holds one of at most, as in Figma. */
const ONE_PER_LAYER: ReadonlySet<EffectType> = new Set<EffectType>(['GLASS', 'TEXTURE'])

/**
 * The effect types the row at `index` can switch to: a layer holds one glass and one texture at
 * most, as in Figma, so each is offered only to a row that has it or when no other row does. A
 * layer that scripts or files gave several keeps the type in each of those rows, so none shows a
 * blank type.
 */
export function effectOptionsFor(effects: readonly Effect[], index: number) {
  const current = effects.at(index)?.type
  const taken = new Set(
    effects.flatMap((effect, i) =>
      i !== index && ONE_PER_LAYER.has(effect.type) && effect.type !== current ? [effect.type] : []
    )
  )
  return effectOptions().filter((option) => !taken.has(option.value))
}

export function isShadow(type: string) {
  return type === 'DROP_SHADOW' || type === 'INNER_SHADOW'
}

/** Whether `type` is a layer or background blur, which can be uniform or progressive. */
export function isBlur(type: string) {
  return type === 'LAYER_BLUR' || type === 'FOREGROUND_BLUR' || type === 'BACKGROUND_BLUR'
}

export type BlurKind = 'UNIFORM' | 'PROGRESSIVE'

/**
 * The change that makes a blur uniform or progressive. A blur turned progressive starts as Figma
 * desktop 126 starts it: from no blur at the top centre to its radius at the bottom centre.
 */
export function blurKindChange(kind: BlurKind): Partial<Effect> {
  if (kind === 'UNIFORM') return { progressive: undefined }
  return {
    progressive: { startRadius: 0, startOffset: { x: 0.5, y: 0 }, endOffset: { x: 0.5, y: 1 } }
  }
}

export type NoiseType = NoiseEffectParams['noiseType']

/**
 * A change to one effect: fields to set, or fields made from each selected layer's own effect, so
 * a change to one value of a noise, texture, or glass leaves each layer's other values alone.
 */
export type EffectChange = Partial<Effect> | ((effect: Effect) => Partial<Effect>)

/**
 * The change that makes a noise monotone, duotone, or multitone, as Figma's panel switches it: a
 * duotone's second colour starts white and a multitone's opacity starts at the first colour's
 * opacity, unless the noise already has them.
 */
export function noiseTypeChange(noiseType: NoiseType): EffectChange {
  return (effect) => {
    const noise: NoiseEffectParams = { ...(effect.noise ?? UNSET_NOISE), noiseType }
    if (noiseType === 'DUOTONE') noise.secondaryColor ??= { r: 1, g: 1, b: 1, a: effect.color.a }
    if (noiseType === 'MULTITONE') noise.opacity ??= effect.color.a
    return { noise }
  }
}

/** The change that gives a noise or texture grain of `size` on both axes, as Figma's panel does. */
export function grainSizeChange(size: number): EffectChange {
  const noiseSize = { x: Math.max(size, 0), y: Math.max(size, 0) }
  return (effect) =>
    effect.type === 'TEXTURE'
      ? { texture: { ...(effect.texture ?? UNSET_TEXTURE), noiseSize } }
      : { noise: { ...(effect.noise ?? UNSET_NOISE), noiseSize } }
}

/** A change to some values of a noise's grain, the rest of each layer's kept. */
export function noiseChange(changes: Partial<NoiseEffectParams>): EffectChange {
  return (effect) => ({ noise: { ...(effect.noise ?? UNSET_NOISE), ...changes } })
}

/** A change to some values of a texture's grain, the rest of each layer's kept. */
export function textureChange(changes: Partial<TextureEffectParams>): EffectChange {
  return (effect) => ({ texture: { ...(effect.texture ?? UNSET_TEXTURE), ...changes } })
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
  function apply(nodes: readonly SceneNode[], index: number, changes: EffectChange) {
    for (const node of nodes) {
      const effects = [...node.effects]
      const current = effects.at(index)
      if (!current) continue
      effects[index] = {
        ...current,
        ...(typeof changes === 'function' ? changes(current) : changes)
      }
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

  function scrubEffect(nodes: readonly SceneNode[], index: number, changes: EffectChange) {
    if (nodes.length === 0) return
    effectsBeforeScrub.value ??= snapshot(nodes)
    apply(nodes, index, changes)
  }

  /** Commits a scrub, or a change made in one step such as a checkbox, as one undo step. */
  function commitEffect(nodes: readonly SceneNode[], index: number, changes: EffectChange) {
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
    const was = node.effects[index]
    if (type === 'GLASS') changes.glass = { ...DEFAULT_GLASS }
    else if (was.type === 'GLASS') changes.glass = undefined
    // A new noise or texture starts as Figma's panel starts one, its grain colour included.
    if (type === 'NOISE') {
      changes.noise = structuredClone(DEFAULT_NOISE)
      if (!isShadow(was.type)) changes.color = { ...DEFAULT_NOISE_COLOR }
    } else if (was.type === 'NOISE') changes.noise = undefined
    if (type === 'TEXTURE') changes.texture = structuredClone(DEFAULT_TEXTURE)
    else if (was.type === 'TEXTURE') changes.texture = undefined
    // Only a blur can be progressive; a blur changed to the other kind keeps its ramp.
    if (!isBlur(type) && was.progressive) changes.progressive = undefined
    if (!isShadow(type)) {
      changes.offset = { x: 0, y: 0 }
      changes.spread = 0
    } else if (!isShadow(was.type)) {
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
