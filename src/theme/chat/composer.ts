import { EditorView } from '@codemirror/view'

import { completionListStyles } from '@/theme/code/completion'

/**
 * The chat's message field in the UI font, sized as the textarea it replaced: two lines at
 * rest, growing to 160px before it scrolls. Completions list layers, pages, skills, and commands
 * with what each is beside it.
 */
export function chatComposerTheme(dark: boolean) {
  return EditorView.theme(
    {
      '&': { fontSize: '12px', color: 'var(--color-surface)' },
      '&.cm-focused': { outline: 'none' },
      '.cm-scroller': {
        fontFamily: 'inherit',
        lineHeight: '1.625',
        minHeight: '48px',
        maxHeight: '160px',
        overflowX: 'hidden',
        overflowY: 'auto'
      },
      '.cm-content': {
        padding: '10px 12px 4px',
        minWidth: '0',
        caretColor: 'var(--color-surface)'
      },
      '.cm-line': { padding: '0' },
      '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--color-surface)' },
      '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
        backgroundColor: 'color-mix(in srgb, var(--color-accent) 22%, transparent)'
      },
      '.cm-placeholder': { color: 'var(--color-muted)' },
      '.cm-content[aria-disabled="true"]': { opacity: '0.6', cursor: 'not-allowed' },
      ...completionListStyles,
      '.cm-tooltip.cm-tooltip-autocomplete > ul': {
        ...completionListStyles['.cm-tooltip.cm-tooltip-autocomplete > ul'],
        maxHeight: '18rem',
        minWidth: '16rem',
        maxWidth: '22rem'
      },
      // Above the field, the list keeps the same gap from it as it would below.
      '.cm-tooltip.cm-tooltip-autocomplete.cm-tooltip-above': { marginTop: '-6px' },
      '.cm-completionIcon': { display: 'none' },
      '.cm-composer-icon': {
        display: 'inline-flex',
        flex: 'none',
        width: '12px',
        height: '12px',
        color: 'var(--color-muted)'
      },
      '.cm-composer-icon > svg': { width: '12px', height: '12px' },
      '.cm-completionInfo': { display: 'none' }
    },
    { dark }
  )
}
