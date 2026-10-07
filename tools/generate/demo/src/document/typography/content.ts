import type { SceneNode } from '@open-pencil/scene-graph'

export const ARTICLE = {
  eyebrow: 'A NOTE ON MAKING THINGS',
  title: 'Leave room for\na better idea.',
  introduction: 'Good typography gives every thought a place.',
  body: 'Start with a clear headline. Give the supporting text enough space to breathe. Keep the details quiet, but never so quiet that they disappear.',
  detail: 'FIELD NOTES / 01 · EDITABLE TEXT, NOT OUTLINES'
}

interface FeatureComparison {
  title: string
  text: string
  font?: string
  enabled: SceneNode['fontFeatures']
  disabled: SceneNode['fontFeatures']
  labels: readonly [string, string]
}

export const FEATURE_COMPARISONS: readonly FeatureComparison[] = [
  {
    title: 'Discretionary ligatures',
    text: 'What!? Really?!',
    font: 'Inter',
    enabled: [{ tag: 'DLIG', enabled: true }],
    disabled: [{ tag: 'DLIG', enabled: false }],
    labels: ['DLIG ON', 'DLIG OFF']
  },
  {
    title: 'Kerning',
    text: 'AVATAR WAVE',
    enabled: [{ tag: 'KERN', enabled: true }],
    disabled: [{ tag: 'KERN', enabled: false }],
    labels: ['KERN ON', 'KERN OFF']
  },
  {
    title: 'Tabular and proportional figures',
    text: '1,111.00 / 8,888.00',
    enabled: [
      { tag: 'TNUM', enabled: true },
      { tag: 'PNUM', enabled: false }
    ],
    disabled: [
      { tag: 'TNUM', enabled: false },
      { tag: 'PNUM', enabled: true }
    ],
    labels: ['TNUM ON · PNUM OFF', 'TNUM OFF · PNUM ON']
  }
]
