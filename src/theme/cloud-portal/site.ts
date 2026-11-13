import { focusStyles } from '../focus/styles'

/**
 * The chrome of the server's public site pages, such as its community gallery, as openpencil.dev
 * draws its own: a translucent bar with the mark and wordmark, plain links, and pill buttons; and
 * a footer of link columns under the product's name and line.
 */
export default {
  slots: {
    header:
      'sticky top-0 z-20 border-b border-border/60 bg-canvas/80 backdrop-blur-md supports-[backdrop-filter]:bg-canvas/70',
    headerInner: 'mx-auto flex h-16 w-full max-w-6xl items-center gap-8 px-4 sm:px-6',
    brand: ['flex shrink-0 items-center gap-2 rounded-md', focusStyles.ring],
    brandMark: 'size-6',
    brandName: 'text-base font-semibold tracking-tight',
    nav: 'flex items-center gap-6 max-sm:hidden',
    navLink: [
      'rounded-sm text-sm font-medium text-muted transition-colors hover:text-surface aria-[current=page]:text-surface',
      focusStyles.ring
    ],
    actions: 'ms-auto flex items-center gap-2',
    iconLink: [
      'flex size-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-hover hover:text-surface max-sm:hidden',
      focusStyles.ring
    ],
    footer: 'mt-auto border-t border-border/60',
    footerInner:
      'mx-auto grid w-full max-w-6xl grid-cols-2 gap-x-8 gap-y-10 px-4 pt-12 pb-8 sm:px-6 md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]',
    footerBrand: 'col-span-2 flex flex-col gap-3 md:col-span-1',
    tagline: 'max-w-xs text-sm text-pretty text-muted',
    column: 'flex flex-col gap-3',
    columnTitle: 'text-xs font-semibold text-surface',
    columnLinks: 'flex flex-col gap-2',
    footerLink: [
      'w-fit rounded-sm text-sm text-muted transition-colors hover:text-surface',
      focusStyles.ring
    ],
    footerBottom:
      'col-span-full flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-6 text-xs text-muted'
  }
} as const
