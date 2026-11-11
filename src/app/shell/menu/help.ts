import { openTourFromMenu } from '@/app/demo/document'
import { donate } from '@/app/donation'
import { openReportDialog, REPORTS_ENABLED } from '@/app/reports/state'
import { APP_VERSION } from '@/app/runtime/version'
import { openSettingsDialog } from '@/app/settings/dialog'
import { detectEnvironment } from '@/app/shell/support/gate'
import { problemReportIssueURL } from '@/app/shell/support/guidance'
import { openExternalLink } from '@/app/shell/ui'
import {
  COMMUNITY_URL,
  DOCS_URL,
  KEYBOARD_SHORTCUTS_URL,
  releaseNotesURL,
  REPOSITORY_URL
} from '@/constants'

function open(url: string) {
  openExternalLink(url).catch((error: unknown) => {
    console.warn('[Menu] Failed to open a link', error)
  })
}

/**
 * Report a Problem: the app's own dialog where the build sends reports, which official releases
 * do; elsewhere, such as a self-hosted Cloud's editor or a build from source, the bug report form
 * on GitHub with the version and platform filled in.
 */
function reportProblem() {
  if (REPORTS_ENABLED) {
    openReportDialog()
    return
  }
  void detectEnvironment().then((env) => open(problemReportIssueURL(env)))
}

/** The Help menu's actions, the same in the web app's menu and the desktop app's. */
export function createHelpMenuActions(): Record<string, () => void> {
  return {
    'help-docs': () => open(DOCS_URL),
    'help-shortcuts': () => open(KEYBOARD_SHORTCUTS_URL),
    'help-whats-new': () => open(releaseNotesURL(APP_VERSION)),
    'open-tour': openTourFromMenu,
    'report-problem': reportProblem,
    diagnostics: () => openSettingsDialog('diagnostics'),
    'help-community': () => open(COMMUNITY_URL),
    'help-github': () => open(REPOSITORY_URL),
    'support-openpencil': () => donate('menu')
  }
}
