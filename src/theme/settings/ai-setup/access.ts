import { aiSetupSectionStyles } from './section'

export default {
  slots: {
    ...aiSetupSectionStyles,
    group: 'flex flex-col gap-2',
    // Reads as a group heading; the gap below lives inside the animated content.
    moreTrigger: 'py-1.5 text-2xs font-semibold text-muted transition-colors hover:text-surface',
    moreGroup: 'flex flex-col gap-2 pt-1'
  }
}
