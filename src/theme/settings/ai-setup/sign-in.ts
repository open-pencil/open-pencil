import { motionStyles } from '@/theme/motion/styles'

import { aiSetupSectionStyles } from './section'

export default {
  slots: {
    groupHeading: aiSetupSectionStyles.groupHeading,
    signIn: 'flex flex-wrap items-center justify-between gap-2 rounded bg-input px-3 py-2',
    signInStatus: 'flex items-center gap-2 text-xs text-surface',
    signInActions: 'flex items-center gap-2',
    signInDetail: 'ml-1 text-muted',
    signedInIcon: 'size-3.5 shrink-0 text-success',
    spinner: `size-3.5 shrink-0 ${motionStyles.spinner}`
  }
}
