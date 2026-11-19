import { notificationMessages } from '@/app/i18n/notifications'
import { openSettingsDialog } from '@/app/settings/dialog'
import type { ToastAction } from '@/app/shell/ui'

/**
 * The action for a failure notice whose event the diagnostics log recorded: it opens that log,
 * where it can be copied into a bug report.
 */
export function viewDiagnosticsAction(): ToastAction {
  return {
    label: notificationMessages.get().viewDiagnostics,
    run: () => openSettingsDialog('diagnostics')
  }
}
