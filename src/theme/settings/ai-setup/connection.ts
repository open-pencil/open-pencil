import { aiSetupSectionStyles } from './section'

export default {
  slots: {
    help: aiSetupSectionStyles.help,
    connection: 'flex flex-col gap-3 rounded-md border border-border p-3',
    connectionHeading: 'flex items-center gap-2 text-xs font-semibold text-surface'
  }
}
