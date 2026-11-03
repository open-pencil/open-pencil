import { isEmptyObject, isPlainObject } from 'es-toolkit/predicate'

import type { Effect, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { lineHeightPixels, textLengthPixels } from '@open-pencil/scene-graph/text'
import {
  effectBindingField,
  effectBindingTarget,
  type EffectBindingProperty
} from '@open-pencil/scene-graph/variables'

import { toFigmaEffect } from '#core/figma-api/effects'

import { pathName, placeTokens, tokenPath, tokenReference } from './paths'
import { OPENPENCIL_EXTENSION, type DesignToken, type DesignTokenIssue } from './types'
import { colorTokenValue, dimensionTokenValue, trimNumber } from './values'

/** Where a variable's token sits, for references to it. */
export type TokenReferences = ReadonlyMap<string, readonly string[]>

/** Figma's auto line height, written as the multiplier browsers use for `normal`. */
const AUTO_LINE_HEIGHT = 1.2

const TEXT_BINDING_FIELDS = ['fontFamily', 'fontSize', 'letterSpacing', 'lineHeight'] as const

function bindingReferences(
  node: SceneNode,
  references: TokenReferences
): Partial<Record<(typeof TEXT_BINDING_FIELDS)[number], string>> {
  const bound = TEXT_BINDING_FIELDS.flatMap((field) => {
    const variableId = node.boundVariables[field]
    const path = variableId ? references.get(variableId) : undefined
    return path ? [[field, tokenReference(path)] as const] : []
  })
  return Object.fromEntries(bound)
}

export type TypographyFields = Pick<
  SceneNode,
  'fontFamily' | 'fontSize' | 'fontWeight' | 'lineHeight' | 'letterSpacing'
>

/** A typography token's `$value`: bound fields as references to their variables' tokens. */
export function typographyValue(
  text: TypographyFields,
  bound: Partial<Record<(typeof TEXT_BINDING_FIELDS)[number], string>>
) {
  // A typography token writes a line height as a multiple of the font size.
  const lineHeightPx = lineHeightPixels(text.lineHeight, text.fontSize)
  const lineHeight =
    lineHeightPx === null || text.fontSize <= 0
      ? AUTO_LINE_HEIGHT
      : trimNumber(lineHeightPx / text.fontSize)
  return {
    fontFamily: bound.fontFamily ?? text.fontFamily,
    fontSize: bound.fontSize ?? dimensionTokenValue(text.fontSize),
    fontWeight: text.fontWeight,
    lineHeight,
    letterSpacing:
      bound.letterSpacing ??
      dimensionTokenValue(textLengthPixels(text.letterSpacing, text.fontSize))
  }
}

/** A text style as a typography token; its own fields ride along so OpenPencil reads it back exactly. */
function typographyToken(node: SceneNode, references: TokenReferences): DesignToken {
  const bound = bindingReferences(node, references)
  return {
    $type: 'typography',
    $value: typographyValue(node, bound),
    $extensions: {
      [OPENPENCIL_EXTENSION]: {
        text: {
          fontFamily: node.fontFamily,
          fontWeight: node.fontWeight,
          italic: node.italic,
          fontSize: node.fontSize,
          lineHeight: node.lineHeight,
          letterSpacing: node.letterSpacing,
          textDecoration: node.textDecoration,
          textCase: node.textCase
        },
        ...(isEmptyObject(bound) ? {} : { bindings: bound })
      }
    }
  }
}

export function isShadow(effect: Effect): boolean {
  return effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW'
}

/** A shadow token's field for each effect property a variable binds. */
export const SHADOW_TOKEN_FIELDS = {
  color: 'color',
  offsetX: 'offsetX',
  offsetY: 'offsetY',
  radius: 'blur',
  spread: 'spread'
} as const satisfies Record<EffectBindingProperty, string>

/** A bound effect field's token reference, such as `{shadow.blur}` for `effects/0/radius`. */
export type ShadowReferences = Readonly<Partial<Record<string, string>>>

function shadowValue(effect: Effect, index: number, references: ShadowReferences) {
  const field = (property: EffectBindingProperty) => references[effectBindingField(index, property)]
  return {
    color: field('color') ?? colorTokenValue(effect.color),
    offsetX: field('offsetX') ?? dimensionTokenValue(effect.offset.x),
    offsetY: field('offsetY') ?? dimensionTokenValue(effect.offset.y),
    blur: field('radius') ?? dimensionTokenValue(effect.radius),
    spread: field('spread') ?? dimensionTokenValue(effect.spread),
    ...(effect.type === 'INNER_SHADOW' ? { inset: true } : {})
  }
}

/**
 * A shadow token's `$value`: the visible shadows of `effects`, bound fields as references to their
 * variables' tokens, or undefined when there are none.
 */
export function shadowTokenValue(effects: readonly Effect[], references: ShadowReferences = {}) {
  const values = [...effects.entries()]
    .filter(([, effect]) => isShadow(effect) && effect.visible)
    .map(([index, effect]) => shadowValue(effect, index, references))
  if (values.length === 0) return undefined
  return values.length === 1 ? values[0] : values
}

/** The token references of a layer's bound effect fields, by binding field. */
function effectReferences(node: SceneNode, references: TokenReferences): ShadowReferences {
  return Object.fromEntries(
    Object.entries(node.boundVariables).flatMap(([field, variableId]) => {
      const path = effectBindingTarget(field) ? references.get(variableId) : undefined
      return path ? [[field, tokenReference(path)]] : []
    })
  )
}

/**
 * An effect style's shadows as a shadow token. Effects a shadow token cannot express, such as
 * blurs or hidden shadows, ride along whole in OpenPencil's extension, in the plugin API's shape;
 * a style with no visible shadow has no token.
 */
function shadowToken(node: SceneNode, references: TokenReferences): DesignToken | undefined {
  const bindings = effectReferences(node, references)
  const $value = shadowTokenValue(node.effects, bindings)
  if ($value === undefined) return undefined
  const exact = node.effects.every(
    (effect) =>
      isShadow(effect) &&
      effect.visible &&
      (effect.blendMode ?? 'NORMAL') === 'NORMAL' &&
      effect.showShadowBehindNode !== true
  )
  // Bindings ride along so a file read back binds them where `$value` has no place for them.
  const own: Record<string, unknown> = {}
  if (!exact) own.effects = node.effects.map((effect) => toFigmaEffect(effect))
  if (!isEmptyObject(bindings)) own.bindings = bindings
  if (isEmptyObject(own)) return { $type: 'shadow', $value }
  return { $type: 'shadow', $value, $extensions: { [OPENPENCIL_EXTENSION]: own } }
}

/** Text and effect styles as typography and shadow tokens, nested by their names. */
export function styleTokens(
  graph: SceneGraph,
  references: TokenReferences
): { tokens: Array<{ path: string[]; token: DesignToken }>; issues: DesignTokenIssue[] } {
  const issues: DesignTokenIssue[] = []
  const styles = [...graph.getAllNodes()].filter(
    (node) =>
      (node.sharedStyleType === 'TEXT' || node.sharedStyleType === 'EFFECT') &&
      node.source.id !== null
  )
  const candidates = styles.flatMap((node) => {
    const token =
      node.sharedStyleType === 'TEXT'
        ? typographyToken(node, references)
        : shadowToken(node, references)
    if (!token) {
      issues.push({ kind: 'unsupported-effect', style: node.name })
      return []
    }
    return [{ key: { node, token }, path: tokenPath(node.name) }]
  })
  const { placed, duplicates } = placeTokens(candidates)
  for (const { node } of duplicates)
    issues.push({ kind: 'duplicate-path', collection: 'Styles', token: node.name })
  const tokens = [...placed].map(([{ node, token }, path]) => ({
    path,
    token: withOriginalName(token, node.name, path)
  }))
  return { tokens, issues }
}

/** Keeps a name the token path could not hold, such as one with a `.`, in OpenPencil's extension. */
export function withOriginalName(
  token: DesignToken,
  name: string,
  path: readonly string[]
): DesignToken {
  if (pathName(path) === name) return token
  const own = token.$extensions?.[OPENPENCIL_EXTENSION]
  return {
    ...token,
    $extensions: {
      ...token.$extensions,
      [OPENPENCIL_EXTENSION]: { ...(isPlainObject(own) ? own : {}), name }
    }
  }
}
