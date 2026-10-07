import { motionStyles } from '@/theme/motion/styles'

export default {
  slots: {
    body: 'flex flex-col gap-3 text-xs text-surface',
    help: 'text-xs leading-relaxed text-muted',
    intro: 'rounded-lg border border-accent/25 bg-accent/5 p-4',
    introHeading: 'text-sm font-semibold text-surface',
    introText: 'mt-2 text-xs leading-relaxed text-muted',
    group: 'flex flex-col gap-2',
    groupHeading: 'text-[11px] font-semibold text-muted',
    // Reads as a group heading; the gap below lives inside the animated content.
    moreTrigger: 'py-1.5 text-[11px] font-semibold text-muted transition-colors hover:text-surface',
    moreGroup: 'flex flex-col gap-2 pt-1',
    connection: 'flex flex-col gap-3 rounded-md border border-border p-3',
    connectionHeading: 'flex items-center gap-2 text-xs font-semibold text-surface',
    signIn: 'flex flex-wrap items-center justify-between gap-2 rounded bg-input px-3 py-2',
    signInStatus: 'flex items-center gap-2 text-xs text-surface',
    signInActions: 'flex items-center gap-2',
    signInDetail: 'ml-1 text-muted',
    signedInIcon: 'size-3.5 shrink-0 text-success',
    spinner: `size-3.5 shrink-0 ${motionStyles.spinner}`
  }
}
