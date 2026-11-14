import { focusStyles } from '@/theme/focus/styles'

/** A link in the site's bar or footer: plain muted text that brightens, or the current page. */
export default {
  base: [
    'w-fit rounded-sm text-sm text-muted transition-colors hover:text-surface aria-[current=page]:text-surface',
    focusStyles.ring
  ],
  variants: {
    place: {
      /** In the bar, beside the name: a little heavier. */
      nav: 'font-medium',
      footer: ''
    }
  },
  defaultVariants: { place: 'footer' as const }
} as const
