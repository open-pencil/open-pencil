import { computed } from 'vue'

import type { ShapeWithTextType } from '@open-pencil/scene-graph/shape-with-text'
import { useShapeMessages } from '@open-pencil/vue/i18n'

type ShapeMessages = ReturnType<typeof useShapeMessages>['value']

/** Each kind's name as FigJam's Shapes panel gives it. */
const KIND_LABEL_KEYS = {
  SQUARE: 'square',
  ELLIPSE: 'ellipse',
  DIAMOND: 'diamond',
  TRIANGLE_UP: 'triangleUp',
  TRIANGLE_DOWN: 'triangleDown',
  ROUNDED_RECTANGLE: 'roundedRectangle',
  PARALLELOGRAM_RIGHT: 'parallelogramRight',
  PARALLELOGRAM_LEFT: 'parallelogramLeft',
  ENG_DATABASE: 'engDatabase',
  ENG_QUEUE: 'engQueue',
  ENG_FILE: 'engFile',
  ENG_FOLDER: 'engFolder',
  TRAPEZOID: 'trapezoid',
  PREDEFINED_PROCESS: 'predefinedProcess',
  SHIELD: 'shield',
  DOCUMENT_SINGLE: 'documentSingle',
  DOCUMENT_MULTIPLE: 'documentMultiple',
  MANUAL_INPUT: 'manualInput',
  HEXAGON: 'hexagon',
  CHEVRON: 'chevron',
  PENTAGON: 'pentagon',
  OCTAGON: 'octagon',
  STAR: 'star',
  PLUS: 'plus',
  ARROW_LEFT: 'arrowLeft',
  ARROW_RIGHT: 'arrowRight',
  SUMMING_JUNCTION: 'summingJunction',
  OR: 'or',
  SPEECH_BUBBLE: 'speechBubble',
  INTERNAL_STORAGE: 'internalStorage'
} as const satisfies Record<ShapeWithTextType, keyof ShapeMessages>

/** Each kind's name in the interface language. */
export function useShapeKindLabels() {
  const shapes = useShapeMessages()
  return computed(() => (kind: ShapeWithTextType) => shapes.value[KIND_LABEL_KEYS[kind]])
}
