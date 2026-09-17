import { tv } from 'tailwind-variants'

/**
 * Shared content treatment for every collapsible, including the call sites that
 * keep their own header shape and drive Reka directly.
 */
export const collapsibleContentMotion =
  'overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up duration-180 motion-reduce:data-[state=open]:animate-none motion-reduce:data-[state=closed]:animate-none'

export const collapsibleTheme = {
  slots: {
    root: '',
    header: 'flex items-center gap-3',
    trigger:
      'group flex min-w-0 flex-1 items-center gap-2 text-left text-xs text-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
    icon: 'size-3.5 shrink-0 transition-transform group-data-[state=open]:rotate-90 motion-reduce:transition-none',
    label: 'min-w-0',
    actions: 'shrink-0',
    // Padding and borders belong to the slot inside this wrapper so they cannot
    // snap while the measured height animates.
    content: collapsibleContentMotion
  }
} as const

export const collapsible = tv(collapsibleTheme)

export type CollapsibleTheme = typeof collapsibleTheme

export default collapsibleTheme
