import { params } from '@nanostores/i18n'

import { i18n } from '#vue/i18n/create'

export const codeMessageDefaults = {
  source: 'Code source',
  sourceDesignJSX: 'Design JSX',
  sourceTailwindJSX: 'Tailwind JSX',
  sourceHTMLCSS: 'HTML/CSS',
  editorDesignLabel: 'Design JSX',
  editorHTMLCSSLabel: 'HTML and CSS',
  updating: 'Updating…',
  updatedLive: 'Updated live',
  previewFailed: 'Preview failed',
  generatedReadOnly: 'Generated, read only',
  reset: 'Reset',
  copyJSXReference: 'Copy JSX prop reference to clipboard',
  jsxUpToDate: 'Up to date',
  canvasChangedExpression: params('The canvas now has {value}; the expression stays as written.'),
  canvasChangedOrder: 'The canvas now orders these layers differently; the code stays as written.',
  noSelection: 'Select a layer to see its code',
  noSelectionDesignJSX: 'Or write Design JSX to add new layers to the page.',
  noSelectionTailwindJSX: 'Tailwind JSX is generated for the selected layers.',
  writeJSX: 'Write JSX'
} as const

export const codeMessages = i18n('code', codeMessageDefaults)
