import { toolChevron } from './chevron'

export default {
  slots: {
    root: 'rounded-lg border border-dashed border-border',
    trigger:
      'flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-start text-2xs text-muted hover:bg-hover hover:text-surface',
    icon: 'size-3.5 shrink-0 text-primary',
    names: 'min-w-0 flex-1 truncate',
    chevron: toolChevron,
    failed: 'bg-error/15 text-error',
    items: 'space-y-1.5 px-1.5 pb-1.5'
  }
} as const
