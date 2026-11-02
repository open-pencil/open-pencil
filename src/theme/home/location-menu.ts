/**
 * The home tab's location picker in a narrow window, in place of the sidebar; touch-sized only
 * when the pointer is a finger.
 */
export default {
  slots: {
    trigger:
      'flex h-8 w-full items-center gap-2 rounded-md border border-border bg-panel-field px-2.5 text-left text-xs text-surface outline-none pointer-coarse:h-10 pointer-coarse:rounded-lg pointer-coarse:px-3 pointer-coarse:text-sm hover:bg-panel-field-hover focus-visible:ring-2 focus-visible:ring-accent/50',
    icon: 'size-3.5 shrink-0 text-muted pointer-coarse:size-4',
    label: 'min-w-0 flex-1 truncate font-medium',
    chevron: 'size-3.5 shrink-0 text-muted pointer-coarse:size-4',
    content: 'w-[var(--reka-dropdown-menu-trigger-width)]',
    itemLabel: 'min-w-0 flex-1 truncate',
    count: 'shrink-0 text-[11px] text-muted tabular-nums',
    check: 'size-3.5 shrink-0 text-surface',
    attention: 'size-3.5 shrink-0 text-warning'
  }
} as const
