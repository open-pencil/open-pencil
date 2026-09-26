import { reportBootFailure, runSupportGate } from '@/app/shell/support/gate'

// Keep this module free of the app bundle: it must evaluate on engines that
// cannot run the app so it can explain why (see src/app/shell/support/).
async function start(): Promise<void> {
  if (!(await runSupportGate())) return
  try {
    const { boot } = await import('./boot')
    await boot()
  } catch (error) {
    await reportBootFailure(error)
  }
}

void start()
