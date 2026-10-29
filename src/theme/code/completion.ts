/**
 * CodeMirror's completion list as the app's pickers draw it: a floating surface with compact
 * rows, section headings, and each row's detail at its end. Spread into an editor's theme.
 */
export const completionListStyles = {
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
    maxWidth: '18rem',
    // The desktop WebKit lays the rows out before the scrollbar appears, so the list keeps room
    // for it from the start.
    scrollbarGutter: 'stable'
  },
  // The app's thin scrollbar (`scrollbar-thin`), which takes its own width: macOS's overlay
  // scrollbar would cover the ends of the rows.
  '.cm-tooltip.cm-tooltip-autocomplete > ul::-webkit-scrollbar': { width: '6px' },
  '.cm-tooltip.cm-tooltip-autocomplete > ul::-webkit-scrollbar-track': {
    background: 'transparent'
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul::-webkit-scrollbar-thumb': {
    background: 'var(--color-border)',
    borderRadius: '3px'
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul::-webkit-scrollbar-thumb:hover': {
    background: 'var(--color-muted)'
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
}
