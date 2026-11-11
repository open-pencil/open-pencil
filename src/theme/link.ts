import { focusStyles } from './focus/styles'

const linkTheme = {
  slots: {
    base: [
      'inline-flex w-fit cursor-pointer items-center gap-1 rounded-sm font-medium text-surface underline decoration-muted/60 underline-offset-2 hover:decoration-current',
      focusStyles.ring
    ],
    icon: 'size-3 shrink-0'
  }
}

export default linkTheme
