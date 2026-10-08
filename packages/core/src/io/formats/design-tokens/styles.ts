import { isEmptyObject, isPlainObject } from 'es-toolkit/predicate'

import type { Effect, SceneGraph, SceneNode } from '@open-pencil/scene-graph'

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
  const lineHeight =
    text.lineHeight === null || text.fontSize <= 0
      ? AUTO_LINE_HEIGHT
      : trimNumber(text.lineHeight / text.fontSize)
  return {
    fontFamily: bound.fontFamily ?? text.fontFamily,
    fontSize: bound.fontSize ?? dimensionTokenValue(text.fontSize),
    fontWeight: text.fontWeight,
    lineHeight,
    letterSpacing: bound.letterSpacing ?? dimensionTokenValue(text.letterSpacing)
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

function shadowValue(effect: Effect) {
  return {
    color: colorTokenValue(effect.color),
    offsetX: dimensionTokenValue(effect.offset.x),
    offsetY: dimensionTokenValue(effect.offset.y),
    blur: dimensionTokenValue(effect.radius),
    spread: dimensionTokenValue(effect.spread),
    ...(effect.type === 'INNER_SHADOW' ? { inset: true } : {})
  }
}

/** A shadow token's `$value`: the visible shadows of `effects`, or undefined when there are none. */
export function shadowTokenValue(effects: readonly Effect[]) {
  const values = effects.filter((effect) => isShadow(effect) && effect.visible).map(shadowValue)
  if (values.length === 0) return undefined
  return values.length === 1 ? values[0] : values
}

/**
 * An effect style's shadows as a shadow token. Effects a shadow token cannot express, such as
 * blurs or hidden shadows, ride along whole in OpenPencil's extension, in the plugin API's shape;
 * a style with no visible shadow has no token.
 */
function shadowToken(node: SceneNode): DesignToken | undefined {
  const $value = shadowTokenValue(node.effects)
  if ($value === undefined) return undefined
  const exact = node.effects.every(
    (effect) =>
      isShadow(effect) &&
      effect.visible &&
      (effect.blendMode ?? 'NORMAL') === 'NORMAL' &&
      effect.showShadowBehindNode !== true
  )
  return {
    $type: 'shadow',
    $value,
    ...(exact
      ? {}
      : { $extensions: { [OPENPENCIL_EXTENSION]: { effects: node.effects.map(toFigmaEffect) } } })
  }
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
      node.sharedStyleType === 'TEXT' ? typographyToken(node, references) : shadowToken(node)
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
