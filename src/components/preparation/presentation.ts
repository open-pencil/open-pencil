import type { useFileMessages } from '@open-pencil/vue/i18n'

import type { EditorPreparation, EditorPreparationProgress } from '@/app/editor/preparation/types'

type FileMessages = ReturnType<typeof useFileMessages>['value']

/** The message naming each preparation phase on the canvas's loading screen. */
const PHASE_MESSAGES = {
  reading: 'preparationReading',
  'rendering-page': 'preparationRenderingPage',
  'loading-files': 'preparationLoadingFiles',
  decoding: 'preparationDecoding',
  styling: 'preparationStyling',
  'naming-icons': 'preparationNamingIcons',
  materializing: 'preparationMaterializing',
  'populating-page': 'preparationPopulatingPage',
  'resolving-fonts': 'preparationResolvingFonts',
  'resolving-fallbacks': 'preparationResolvingFallbacks',
  layout: 'preparationLayout',
  'drawing-shaders': 'preparationDrawingShaders',
  'preparing-render': 'preparationPreparingRender'
} as const satisfies Record<EditorPreparation['phase'], keyof FileMessages>

export function preparationLabel(
  preparation: EditorPreparation | null,
  files: FileMessages
): string {
  return preparation ? files[PHASE_MESSAGES[preparation.phase]] : files.preparing
}

export function preparationPercent(progress: EditorPreparationProgress | null): number | null {
  if (!progress || progress.total <= 0) return null
  return Math.min(100, Math.max(0, Math.round((progress.completed / progress.total) * 100)))
}
