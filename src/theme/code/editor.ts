import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags } from '@lezer/highlight'

export function codeEditorTheme(dark: boolean) {
  const palette = dark
    ? {
        keyword: '#c4a7e7',
        tag: '#82aaff',
        string: '#a3d9a5',
        number: '#e5bc8b',
        comment: '#969eaa'
      }
    : {
        keyword: '#7947a7',
        tag: '#145ca4',
        string: '#276b3b',
        number: '#965212',
        comment: '#69727f'
      }

  return [
    EditorView.theme(
      {
        '&': {
          height: '100%',
          backgroundColor: 'var(--color-panel)',
          color: 'var(--color-surface)',
          fontSize: '12px'
        },
        '&.cm-focused': { outline: 'none' },
        '.cm-scroller': {
          overflow: 'auto',
          fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
          lineHeight: '1.65'
        },
        '.cm-content': { padding: '10px 0', caretColor: 'var(--color-accent)' },
        '.cm-line': { padding: '0 8px' },
        '.cm-gutters': {
          backgroundColor: 'var(--color-panel)',
          color: 'var(--color-muted)',
          border: 'none'
        },
        '.cm-lineNumbers .cm-gutterElement': { padding: '0 4px 0 8px', minWidth: '24px' },
        '.cm-foldGutter .cm-gutterElement': { padding: '0 2px' },
        '.cm-activeLine': {
          backgroundColor: 'color-mix(in srgb, var(--color-hover) 45%, transparent)'
        },
        '.cm-activeLineGutter': {
          backgroundColor: 'var(--color-hover)',
          color: 'var(--color-surface)'
        },
        '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--color-accent)' },
        '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
          backgroundColor: 'color-mix(in srgb, var(--color-accent) 22%, transparent)'
        },
        '&.cm-focused .cm-matchingBracket': {
          backgroundColor: 'var(--color-hover)',
          outline: '1px solid var(--color-border)'
        },
        '.cm-tooltip, .cm-panels': {
          backgroundColor: 'var(--color-panel)',
          color: 'var(--color-surface)',
          border: '1px solid var(--color-border)'
        },
        '.cm-tooltip': { borderRadius: '6px', overflow: 'hidden' },
        '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
          backgroundColor: 'var(--color-hover)',
          color: 'var(--color-surface)'
        },
        '.cm-searchMatch': {
          backgroundColor: 'color-mix(in srgb, var(--color-accent) 20%, transparent)',
          outline: '1px solid var(--color-accent)'
        },
        '.cm-searchMatch.cm-searchMatch-selected': {
          backgroundColor: 'color-mix(in srgb, var(--color-accent) 35%, transparent)'
        },
        '.cm-textfield, .cm-button': {
          background: 'var(--color-input)',
          color: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '4px',
          font: 'inherit'
        }
      },
      { dark }
    ),
    syntaxHighlighting(
      HighlightStyle.define([
        { tag: tags.keyword, color: palette.keyword },
        { tag: [tags.tagName, tags.typeName, tags.className], color: palette.tag },
        { tag: [tags.string, tags.attributeValue], color: palette.string },
        { tag: [tags.number, tags.bool, tags.null], color: palette.number },
        { tag: tags.comment, color: palette.comment, fontStyle: 'italic' },
        {
          tag: [tags.attributeName, tags.propertyName, tags.variableName],
          color: 'var(--color-surface)'
        },
        { tag: [tags.punctuation, tags.operator], color: 'var(--color-muted)' }
      ])
    )
  ]
}

/** Compact read-only code in chat tool calls, layered over `codeEditorTheme`. */
export const codeViewerTheme = EditorView.theme({
  '&': { maxHeight: '16rem', fontSize: '10.5px', backgroundColor: 'var(--color-input)' },
  '.cm-scroller': { lineHeight: '1.55' },
  '.cm-content': { padding: '6px 0' },
  '.cm-line': { padding: '0 6px' },
  '.cm-gutters': { backgroundColor: 'var(--color-input)' }
})
