/**
 * A campaign as a note inside a settings tab or the share dialog: a quiet bordered block with an
 * icon by the campaign's kind, a title, its Markdown body, an optional action, and a dismiss.
 */
export default {
  slots: {
    root: 'flex items-start gap-2.5 rounded-lg border border-border bg-panel-field p-3 text-xs',
    icon: 'mt-0.5 size-4 shrink-0 text-muted data-[kind=cloud]:text-accent data-[kind=donation]:text-heart data-[kind=donation]:*:fill-current',
    content: 'flex min-w-0 flex-1 flex-col gap-1',
    title: 'text-xs leading-relaxed font-medium text-surface',
    // Markdown's own colors sit outside Tailwind's layers, so the body's override is important.
    body: '[&_.markdown-content]:text-muted! [&_.markdown-content_a]:text-surface! [&_.markdown-content>p:first-child]:mt-0! [&_.markdown-content>p:last-child]:mb-0!',
    actions: 'flex flex-wrap items-center gap-2 pt-1',
    dismiss: '-me-1 -mt-1 shrink-0'
  }
} as const
