import { APP_VERSION } from '@/app/runtime/version'
import { openExternalLink } from '@/app/shell/ui'
import { DESKTOP_DOWNLOAD_URL, DOCS_URL, NEW_ISSUE_URL, releaseNotesURL } from '@/constants'

function open(url: string): void {
  openExternalLink(url).catch((error: unknown) => {
    console.error('[Menu] Could not open the link:', error)
  })
}

/** Help's links, shared by the browser main menu and the native Help menu. */
export const HELP_MENU_ACTIONS = {
  'help-docs': () => open(DOCS_URL),
  'help-whats-new': () => open(releaseNotesURL(APP_VERSION)),
  'help-report-issue': () => open(NEW_ISSUE_URL),
  'help-desktop-app': () => open(DESKTOP_DOWNLOAD_URL)
} satisfies Record<string, () => void>
