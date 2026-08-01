const notesPaneTheme = {
  slots: {
    panel: 'flex min-h-0 flex-1 flex-col border-t border-border bg-panel',
    header: 'flex shrink-0 items-center justify-between gap-2 px-3 py-1.5',
    title: 'text-[11px] font-semibold text-surface',
    input:
      'scrollbar-thin min-h-0 flex-1 resize-none border-0 bg-transparent px-3 pb-3 text-[12px] leading-relaxed text-surface outline-none placeholder:text-muted'
  }
}

export type NotesPaneTheme = typeof notesPaneTheme
export default notesPaneTheme
