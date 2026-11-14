import { focusStyles } from '@/theme/focus/styles'

/** The bar over the site's pages: translucent and sticky, the brand, its links, and actions. */
export default {
  slots: {
    root: 'sticky top-0 z-20 border-b border-border/60 bg-canvas/80 backdrop-blur-md supports-[backdrop-filter]:bg-canvas/70',
    inner: 'mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 sm:gap-8 sm:px-6',
    home: ['flex min-w-0 rounded-md', focusStyles.ring],
    nav: 'flex items-center gap-6 max-sm:hidden',
    actions: 'ms-auto flex shrink-0 items-center gap-2',
    iconLink: [
      'flex size-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-hover hover:text-surface max-sm:hidden',
      focusStyles.ring
    ]
  }
} as const
