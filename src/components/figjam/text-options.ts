import { computed } from 'vue'

import {
  isFigJamTypeface,
  type FigJamTextSize,
  type FigJamTypeface
} from '@open-pencil/scene-graph/figjam'
import { useFigJamMessages } from '@open-pencil/vue/i18n'

/** FigJam's text sizes and typefaces as select options, shared by sticky notes and shapes. */
export function useFigJamTextOptions() {
  const figjam = useFigJamMessages()
  const sizeOptions = computed<Array<{ value: FigJamTextSize; label: string }>>(() => [
    { value: 'small', label: figjam.value.textSmall },
    { value: 'medium', label: figjam.value.textMedium },
    { value: 'large', label: figjam.value.textLarge },
    { value: 'extraLarge', label: figjam.value.textExtraLarge },
    { value: 'huge', label: figjam.value.textHuge }
  ])
  const typefaceOptions = computed<Array<{ value: FigJamTypeface; label: string }>>(() => [
    { value: 'simple', label: figjam.value.typefaceSimple },
    { value: 'bookish', label: figjam.value.typefaceBookish },
    { value: 'technical', label: figjam.value.typefaceTechnical },
    { value: 'scribbled', label: figjam.value.typefaceScribbled }
  ])
  return { sizeOptions, typefaceOptions }
}

/**
 * A typeface select's model: the text's typeface, or none for a face FigJam's menu does not
 * offer, which the select then shows by name.
 */
export function typefaceModel(
  typeface: () => FigJamTypeface | null,
  set: (value: FigJamTypeface) => void
) {
  return computed<string>({
    get: () => typeface() ?? '',
    set: (value) => {
      if (isFigJamTypeface(value)) set(value)
    }
  })
}
