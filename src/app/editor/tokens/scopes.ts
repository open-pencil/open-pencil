import type { VariableScope, VariableType } from '@open-pencil/scene-graph'
import type { MessagesOf } from '@open-pencil/vue/i18n'

/** The scopes Figma offers for each variable type; scopes also pick a token's Tailwind namespace. */
export const SCOPES_BY_TYPE: Record<VariableType, readonly VariableScope[]> = {
  COLOR: ['ALL_FILLS', 'FRAME_FILL', 'SHAPE_FILL', 'TEXT_FILL', 'STROKE', 'EFFECT_COLOR'],
  FLOAT: [
    'CORNER_RADIUS',
    'WIDTH_HEIGHT',
    'GAP',
    'STROKE_FLOAT',
    'OPACITY',
    'EFFECT_FLOAT',
    'FONT_STYLE',
    'FONT_SIZE',
    'LINE_HEIGHT',
    'LETTER_SPACING',
    'PARAGRAPH_SPACING',
    'PARAGRAPH_INDENT'
  ],
  STRING: ['TEXT_CONTENT', 'FONT_FAMILY', 'FONT_STYLE'],
  BOOLEAN: [],
  EASING: [],
  TIMING: []
}

/** The message naming each scope, as the inspector's checkboxes label them. */
const SCOPE_MESSAGES: Partial<Record<VariableScope, keyof MessagesOf<'variables/panel'>>> = {
  ALL_FILLS: 'scopeAllFills',
  FRAME_FILL: 'scopeFrameFill',
  SHAPE_FILL: 'scopeShapeFill',
  TEXT_FILL: 'scopeTextFill',
  STROKE: 'scopeStroke',
  EFFECT_COLOR: 'scopeEffectColor',
  CORNER_RADIUS: 'scopeCornerRadius',
  WIDTH_HEIGHT: 'scopeWidthHeight',
  GAP: 'scopeGap',
  STROKE_FLOAT: 'scopeStrokeFloat',
  OPACITY: 'scopeOpacity',
  EFFECT_FLOAT: 'scopeEffectFloat',
  FONT_STYLE: 'scopeFontStyle',
  FONT_SIZE: 'scopeFontSize',
  LINE_HEIGHT: 'scopeLineHeight',
  LETTER_SPACING: 'scopeLetterSpacing',
  PARAGRAPH_SPACING: 'scopeParagraphSpacing',
  PARAGRAPH_INDENT: 'scopeParagraphIndent',
  TEXT_CONTENT: 'scopeTextContent',
  FONT_FAMILY: 'scopeFontFamily'
}

/** A scope's name in the interface's language, or its own name where there is none. */
export function scopeLabel(scope: VariableScope, messages: MessagesOf<'variables/panel'>): string {
  const key = SCOPE_MESSAGES[scope]
  const label = key ? messages[key] : undefined
  return typeof label === 'string' ? label : scope
}
