import { defineVars } from '@open-pencil/core/design-jsx'
import type { SceneGraph } from '@open-pencil/scene-graph'
import { parseColor } from '@open-pencil/scene-graph/color'

export function createAnnouncementTokens(graph: SceneGraph) {
  graph.addCollection({
    id: 'announcement-colors',
    name: 'Announcement / Color',
    modes: [{ modeId: 'default', name: 'Default' }],
    defaultModeId: 'default',
    variableIds: []
  })
  for (const [id, name, hex] of [
    ['announcement-accent', 'Accent', '#4F46E5'],
    ['announcement-surface', 'Surface', '#EEF2FF'],
    ['announcement-ink', 'Text/Primary', '#172554'],
    ['announcement-muted', 'Text/Secondary', '#536487']
  ]) {
    graph.addVariable({
      id,
      name,
      type: 'COLOR',
      collectionId: 'announcement-colors',
      valuesByMode: { default: parseColor(hex) },
      description: '',
      hiddenFromPublishing: false
    })
  }
  graph.addCollection({
    id: 'announcement-spacing',
    name: 'Announcement / Spacing',
    modes: [{ modeId: 'default', name: 'Default' }],
    defaultModeId: 'default',
    variableIds: []
  })
  for (const [id, name, value] of [
    ['announcement-padding', 'Padding', 24],
    ['announcement-gap', 'Content gap', 12]
  ] as const) {
    graph.addVariable({
      id,
      name,
      type: 'FLOAT',
      collectionId: 'announcement-spacing',
      valuesByMode: { default: value },
      description: '',
      hiddenFromPublishing: false
    })
  }
  return defineVars({
    accent: 'announcement-accent',
    surface: 'announcement-surface',
    ink: 'announcement-ink',
    muted: 'announcement-muted',
    padding: 'announcement-padding',
    gap: 'announcement-gap'
  })
}

export type AnnouncementTokens = ReturnType<typeof createAnnouncementTokens>
