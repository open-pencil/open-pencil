import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags } from '@lezer/highlight'

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
      '.cm-tooltip.cm-tooltip-autocomplete': {
        backgroundColor: 'var(--color-panel)',
        color: 'var(--color-surface)',
        border: 'none',
        borderRadius: '12px',
        boxShadow: '0 0 0 1px var(--color-border), 0 8px 30px rgb(0 0 0 / 0.4)',
        padding: '4px',
        marginTop: '6px'
      },
      '.cm-tooltip.cm-tooltip-autocomplete > ul': {
        fontFamily: 'inherit',
        maxHeight: '15rem',
        minWidth: '14rem',
        maxWidth: '18rem'
      },
      '.cm-tooltip.cm-tooltip-autocomplete > ul > li': {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        minHeight: '28px',
        padding: '0 4px',
        borderRadius: '4px',
        fontSize: '12px'
      },
      '.cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]': {
        backgroundColor: 'var(--color-hover)',
        color: 'var(--color-surface)'
      },
      '.cm-tooltip.cm-tooltip-autocomplete > ul > completion-section': {
        display: 'block',
        padding: '6px 4px 4px',
        border: 'none',
        fontSize: '10px',
        fontWeight: '500',
        letterSpacing: '0.025em',
        textTransform: 'uppercase',
        color: 'var(--color-muted)',
        opacity: '1'
      },
      '.cm-completionLabel': {
        flex: '1',
        minWidth: '0',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      },
      '.cm-completionMatchedText': { textDecoration: 'none', fontWeight: '600' },
      '.cm-completionDetail': {
        marginLeft: 'auto',
        fontStyle: 'normal',
        fontVariantNumeric: 'tabular-nums',
        color: 'var(--color-muted)'
      }
    },
    { dark }
  )
}
