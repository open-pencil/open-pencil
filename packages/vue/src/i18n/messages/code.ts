import { i18n } from '#vue/i18n/create'

export const codeMessageDefaults = {
  codeSource: 'Code source',
  codeSourceDesignJSX: 'Design JSX',
  codeSourceTailwindJSX: 'Tailwind JSX',
  codeSourceHTMLCSS: 'HTML/CSS',
  codeEditorDesignLabel: 'Design JSX',
  codeEditorHTMLCSSLabel: 'HTML and CSS',
  codeUpdating: 'Updating…',
  codeUpdatedLive: 'Updated live',
  codePreviewFailed: 'Preview failed',
  codeGeneratedReadOnly: 'Generated, read only',
  codeReset: 'Reset',
  copyJSXReference: 'Copy JSX prop reference to clipboard',
  jsxUpToDate: 'Up to date'
} as const

export const codeMessages = i18n('code', codeMessageDefaults)
