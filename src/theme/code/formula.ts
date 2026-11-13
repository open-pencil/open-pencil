import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags } from '@lezer/highlight'

import { completionListStyles } from './completion'

/**
 * A one-line value field in the UI font, without the gutters or panels of the code editor. Its
 * completion list matches the variable picker: a floating surface with compact rows grouped by
 * collection, each value at the row's end.
 */
export function formulaEditorTheme(dark: boolean) {
  return [formulaTheme(dark), formulaHighlighting]
}

/** The code editor's token colours, quieter for a field: operators and brackets recede. */
const formulaHighlighting = syntaxHighlighting(
  HighlightStyle.define([
    { tag: tags.keyword, color: 'var(--color-code-keyword)' },
    { tag: [tags.number, tags.bool, tags.color], color: 'var(--color-code-number)' },
    { tag: tags.string, color: 'var(--color-code-string)' },
    { tag: tags.function(tags.variableName), color: 'var(--color-code-tag)' },
    {
      tag: [tags.operator, tags.punctuation, tags.paren, tags.separator],
      color: 'var(--color-muted)'
    },
    { tag: tags.invalid, color: 'var(--color-error)', textDecoration: 'underline wavy' }
  ])
)

function formulaTheme(dark: boolean) {
  return EditorView.theme(
    {
      '&': { fontSize: '12px' },
      '&.cm-focused': { outline: 'none' },
      // About twelve lines, then the value scrolls inside the field.
      '.cm-scroller': {
        fontFamily: 'inherit',
        lineHeight: '20px',
        maxHeight: '240px',
        overflowX: 'hidden',
        overflowY: 'auto'
      },
      // The content may be narrower than its longest pill, which then truncates, so the field
      // never grows past the inspector.
      '.cm-content': { padding: '0', minWidth: '0', caretColor: 'var(--color-surface)' },
      '.cm-line': { padding: '0' },
      '.cm-placeholder': { color: 'var(--color-muted)' },
      '.cm-formula-button-space': { width: '26px', height: '20px' },
      '.cm-formula-result': {
        paddingLeft: '8px',
        color: 'var(--color-muted)',
        fontVariantNumeric: 'tabular-nums',
        pointerEvents: 'none',
        userSelect: 'none'
      },
      ...completionListStyles
    },
    { dark }
  )
}
