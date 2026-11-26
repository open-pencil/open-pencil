/**
 * A campaign in the corner prompt, over the usage stats question's layout: its heading carries
 * an icon that follows the campaign's kind, and its body is muted Markdown.
 */
export default {
  slots: {
    heading: 'flex items-center gap-1.5 text-sm font-semibold text-surface',
    icon: 'size-4 shrink-0 text-muted data-[kind=cloud]:text-accent data-[kind=donation]:text-heart data-[kind=donation]:*:fill-current',
    // Markdown's own colors sit outside Tailwind's layers, so the body's override is important.
    body: '[&_.markdown-content]:text-muted! [&_.markdown-content_a]:text-surface! [&_.markdown-content>p:first-child]:mt-0! [&_.markdown-content>p:last-child]:mb-0!'
  }
} as const
