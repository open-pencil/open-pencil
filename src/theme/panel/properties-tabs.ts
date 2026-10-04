import { tv } from 'tailwind-variants'

/**
 * Tabs across the top of the right panel. Tabs with icons show their labels whenever the whole row
 * fits and drop them together when it does not; labels stay available to screen readers. The row
 * clips horizontally rather than scrolls, so focusing a control never shifts the panel.
 */
export const propertiesTabs = tv({
  slots: {
    list: '@container/tabs flex h-10 shrink-0 items-center gap-0.5 overflow-x-clip border-b border-border px-2',
    trigger:
      'relative flex shrink-0 items-center gap-1 rounded px-1.5 py-1 text-[11px] text-muted outline-none hover:text-surface focus-visible:ring-1 focus-visible:ring-panel-focus data-[state=active]:font-semibold data-[state=active]:text-surface after:absolute after:inset-x-1.5 after:-bottom-[9px] after:h-0.5 after:rounded-full after:bg-transparent data-[state=active]:after:bg-accent',
    icon: 'size-3 shrink-0 data-[severity=error]:text-issue-error data-[severity=warning]:text-issue-warning',
    label: 'sr-only @[240px]/tabs:not-sr-only'
  }
})
