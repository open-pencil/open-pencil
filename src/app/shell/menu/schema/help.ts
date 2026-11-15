import type { AppMenuGroupSchema } from './types'

/** The Help menu: documentation, the tour, reports and diagnostics, and the community. */
export const HELP_MENU: AppMenuGroupSchema = {
  // Last, where every platform expects it; macOS adds its menu search here (`desktop/src/menu`).
  label: 'Help',
  items: [
    {
      id: 'help-docs',
      label: 'OpenPencil Documentation',
      handler: 'shell',
      palette: { keywords: ['docs', 'guide', 'manual', 'help'] }
    },
    {
      id: 'help-shortcuts',
      label: 'Keyboard Shortcuts',
      handler: 'shell',
      palette: { keywords: ['hotkeys', 'keys', 'shortcuts'] }
    },
    {
      id: 'help-whats-new',
      label: 'What’s New',
      handler: 'shell',
      palette: { keywords: ['release notes', 'changelog', 'version', 'updates'] }
    },
    { id: 'open-tour', label: 'Open the Tour', handler: 'shell' },
    { type: 'separator' },
    {
      id: 'report-problem',
      label: 'Report a Problem…',
      handler: 'shell',
      palette: { keywords: ['bug', 'issue', 'feedback', 'crash', 'support'] }
    },
    {
      id: 'diagnostics',
      label: 'Diagnostics…',
      handler: 'shell',
      palette: { keywords: ['log', 'report', 'bug', 'problem', 'troubleshoot'] }
    },
    { type: 'separator' },
    {
      id: 'help-community',
      label: 'Community on Discord',
      handler: 'shell',
      palette: { keywords: ['discord', 'chat', 'community', 'ask'] }
    },
    {
      id: 'help-github',
      label: 'OpenPencil on GitHub',
      handler: 'shell',
      palette: { keywords: ['github', 'source', 'code', 'repository'] }
    },
    {
      id: 'support-openpencil',
      feature: 'donation',
      label: 'Support OpenPencil…',
      handler: 'shell',
      palette: { keywords: ['donate', 'donation', 'sponsor', 'fund', 'tip'] }
    }
  ]
}
