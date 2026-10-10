import type { EditorPreparation, EditorPreparationProgress } from '@/app/editor/preparation/types'

export const preparationPhaseLabels = {
  reading: 'Reading document',
  decoding: 'Decoding Figma document',
  materializing: 'Preparing layers',
  'populating-page': 'Preparing page',
  'resolving-fonts': 'Resolving fonts',
  'resolving-fallbacks': 'Finalizing typography',
  layout: 'Computing layout',
  'drawing-shaders': 'Drawing shaders',
  'preparing-render': 'Preparing canvas'
} satisfies Record<EditorPreparation['phase'], string>

export function preparationLabel(preparation: EditorPreparation | null): string {
  return preparation ? preparationPhaseLabels[preparation.phase] : 'Loading…'
}

export function preparationPercent(progress: EditorPreparationProgress | null): number | null {
  if (!progress || progress.total <= 0) return null
  return Math.min(100, Math.max(0, Math.round((progress.completed / progress.total) * 100)))
}
