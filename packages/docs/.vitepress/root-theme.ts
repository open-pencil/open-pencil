import { EN, EN_PROG } from './labels'
import { sdkSidebar } from './sdk-sidebar'
import {
  guideSidebar,
  programmableSidebar,
  referenceSidebar,
  userGuideSidebar,
} from './sidebars'

import type { DefaultTheme } from 'vitepress'

export const rootThemeConfig = (): DefaultTheme.Config => ({
  search: { provider: 'local' },

  nav: [
    { text: 'Guide', link: '/guide/getting-started' },
    { text: 'User Guide', link: '/user-guide/' },
    { text: 'Automation', link: '/programmable/' },
    { text: 'SDK', link: '/programmable/sdk/' },
    { text: 'Reference', link: '/reference/keyboard-shortcuts' },
    { text: 'Development', link: '/development/contributing' },
    { text: 'Open App', link: 'https://app.openpencil.dev' },
  ],

  sidebar: {
    '/user-guide/': userGuideSidebar('', EN),
    '/programmable/sdk/': sdkSidebar(''),
    '/programmable/': programmableSidebar('', EN_PROG),
    '/reference/': referenceSidebar('', 'Reference'),
    '/': [
      ...guideSidebar('', EN),
      {
        text: 'Development',
        items: [
          { text: 'Contributing', link: '/development/contributing' },
          { text: 'Testing', link: '/development/testing' },
          { text: 'OpenSpec Workflow', link: '/development/openspec' },
          { text: 'Roadmap', link: '/development/roadmap' },
        ],
      },
    ],
  },

  socialLinks: [{ icon: 'github', link: 'https://github.com/open-pencil/open-pencil' }],

  editLink: {
    pattern: 'https://github.com/open-pencil/open-pencil/edit/main/packages/docs/:path',
  },

  footer: {
    message: 'Released under the MIT License.',
  },
})
