import { tv } from 'tailwind-variants'

/** The home tab's location picker on phones, in place of the sidebar. */
export const homeLocationMenu = tv({
  slots: {
    trigger:
      'flex h-10 w-full items-center gap-2 rounded-lg border border-border bg-panel-field px-3 text-left text-sm text-surface outline-none hover:bg-panel-field-hover focus-visible:ring-2 focus-visible:ring-accent/50',
    icon: 'size-4 shrink-0 text-muted',
    label: 'min-w-0 flex-1 truncate font-medium',
    chevron: 'size-4 shrink-0 text-muted',
    content: 'w-[var(--reka-dropdown-menu-trigger-width)]',
    itemLabel: 'min-w-0 flex-1 truncate',
    count: 'shrink-0 text-[11px] text-muted tabular-nums',
    check: 'size-3.5 shrink-0 text-surface',
    attention: 'size-3.5 shrink-0 text-warning-text'
  }
})
