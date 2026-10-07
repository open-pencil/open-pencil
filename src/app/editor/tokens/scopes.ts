import type { VariableScope, VariableType } from '@open-pencil/scene-graph'

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
  BOOLEAN: []
}
