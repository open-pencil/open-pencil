import { params } from '@nanostores/i18n'

import { i18n } from '#vue/i18n/create'

export const editorMessageDefaults = {
  wideGamutUnavailable:
    'This display or browser cannot show Display-P3 colors, so the canvas previews them in sRGB. The document keeps its color space.',
  toolOptions: params('{tool} options'),
  removeGradientStop: 'Remove gradient stop',
  /** The word before a corner's radius in the label beside a dragged radius handle. */
  cornerRadius: 'Radius',
  /** The word before a polygon's or star's point count beside its dragged handle. */
  pointCount: 'Count',
  /** The word before a star's inner ratio beside its dragged handle. */
  starRatio: 'Ratio',
  /** The word before an ellipse arc's start angle beside its dragged handle. */
  arcStart: 'Start',
  /** The word before an ellipse arc's sweep, in percent of a turn, beside its dragged end handle. */
  arcSweep: 'Sweep',
  /** The word before an ellipse arc's inner ratio beside its dragged handle. */
  arcRatio: 'Ratio',
  /** What an empty sticky note shows in its body on the canvas. */
  stickyPlaceholder: 'Type anything, @mention anyone',
  /** What an empty connector label shows on the canvas while it is typed into. */
  connectorLabelPlaceholder: 'Add text',
  showUI: params('Show UI ({shortcut})'),
  openChat: 'Open AI chat',
  closeChat: 'Close AI chat',
  previewing: 'Previewing',
  startPreview: params('Preview ({shortcut})'),
  resetPreview: 'Reset',
  leavePreview: params('Leave preview ({shortcut})')
} as const

export const editorMessages = i18n('editor', editorMessageDefaults)
