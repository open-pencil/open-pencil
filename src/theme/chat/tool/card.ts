import { toolChevron } from './chevron'

export default {
  slots: {
    // An undone call's text dims to the muted color, which still reads at 4.5:1.
    root: 'rounded-lg border border-border bg-canvas data-[undone=true]:**:text-muted',
    trigger:
      'flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-start hover:bg-hover disabled:cursor-default disabled:hover:bg-transparent',
    status:
      'flex size-4 shrink-0 items-center justify-center rounded-full data-[state=done]:bg-success/20 data-[state=done]:text-success data-[state=error]:bg-error/15 data-[state=error]:text-error data-[state=pending]:bg-accent/20 data-[state=pending]:text-primary',
    statusIcon: 'size-3',
    // A long title, such as an agent's own "Search …", truncates before the chevron does.
    name: 'min-w-0 truncate text-2xs font-medium text-surface',
    summary: 'min-w-0 flex-1 truncate font-mono text-3xs text-muted',
    undone: 'inline-flex shrink-0 items-center gap-1 text-3xs text-muted',
    undoneIcon: 'size-3',
    chevron: toolChevron,
    body: 'space-y-2 border-t border-border px-2 py-2 text-3xs',
    image:
      'max-h-56 w-auto max-w-full rounded border border-border bg-[repeating-conic-gradient(var(--color-hover)_0_25%,transparent_0_50%)] bg-size-[0.75rem_0.75rem] object-contain'
  }
} as const
