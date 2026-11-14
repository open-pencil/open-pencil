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
    headerInner: 'mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 sm:gap-8 sm:px-6',
    brand: ['flex min-w-0 items-center gap-2 rounded-md', focusStyles.ring],
    brandMark: 'size-6 shrink-0',
    brandLogo: 'h-7 w-auto max-w-40 shrink-0 object-contain',
    brandName: 'min-w-0 truncate text-base font-semibold tracking-tight',
    nav: 'flex items-center gap-6 max-sm:hidden',
    navLink: [
      'rounded-sm text-sm font-medium text-muted transition-colors hover:text-surface aria-[current=page]:text-surface',
      focusStyles.ring
    ],
    actions: 'ms-auto flex shrink-0 items-center gap-2',
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
    compactFooter:
      'mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6',
    compactLine: 'flex flex-wrap items-center gap-x-4 gap-y-1 text-sm',
    compactName: 'font-medium text-surface',
    poweredBy: [
      'flex w-fit items-center gap-1.5 rounded-sm text-sm text-muted transition-colors hover:text-surface',
      focusStyles.ring
    ],
    poweredMark: 'size-3.5',
    footerBottom:
      'col-span-full flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-6 text-xs text-muted'
  }
} as const
