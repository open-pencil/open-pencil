import { focusStyles } from '../focus/styles'

/** The account's notification settings: which comments it hears about by email. */
export default {
  slots: {
    section: 'flex max-w-xl flex-col gap-2',
    heading: 'text-sm font-semibold text-surface',
    options: 'flex flex-col gap-1.5',
    option: [
      'group flex w-full items-start gap-2.5 rounded-lg border border-border px-3 py-2.5 text-start hover:bg-hover data-[disabled]:opacity-60 data-[state=checked]:border-panel-focus data-[state=checked]:bg-panel-selected-muted',
      focusStyles.ring
    ],
    optionMark:
      'mt-0.5 size-3.5 shrink-0 rounded-full border border-muted/60 group-data-[state=checked]:border-4 group-data-[state=checked]:border-accent',
    optionLabel: 'block text-xs font-medium text-surface',
    optionDescription: 'mt-0.5 block text-2xs leading-relaxed text-muted'
  }
} as const
