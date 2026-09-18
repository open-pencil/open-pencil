import type { DefaultTheme } from 'vitepress'

import { EN, EN_PROG } from './labels.ts'
import { sdkSidebar } from './sdk-sidebar.ts'
import {
  developmentSidebar,
  guideSidebar,
  programmableSidebar,
  referenceSidebar,
  userGuideSidebar
} from './sidebars.ts'

export const rootThemeConfig = (): DefaultTheme.Config => ({
  logo: { light: '/brand/mark.svg', dark: '/brand/mark-dark.svg', alt: 'OpenPencil' },
  search: { provider: 'local' },

  nav: [
    { text: 'Overview', link: '/getting-started' },
    { text: 'User Guide', link: '/user-guide/' },
    { text: 'Automation', link: '/programmable/' },
    { text: 'SDK', link: '/programmable/sdk/' },
    { text: 'Reference', link: '/reference/keyboard-shortcuts' },
    { text: 'Development', link: '/development/contributing' },
    { text: 'Open App', link: 'https://app.openpencil.dev' }
  ],

  sidebar: {
    '/user-guide/': userGuideSidebar('', EN),
    '/programmable/sdk/': sdkSidebar(''),
    '/programmable/': programmableSidebar('', EN_PROG),
    '/reference/': referenceSidebar('', 'Reference', EN),
    '/development/': developmentSidebar('', 'Development', EN),
    '/': guideSidebar('', EN)
  },

  socialLinks: [
    { icon: 'github', link: 'https://github.com/open-pencil/open-pencil' },
    { icon: 'discord', link: 'https://discord.gg/4wXc9fuZfm', ariaLabel: 'Discord' }
  ],

  editLink: {
    pattern: 'https://github.com/open-pencil/open-pencil/edit/master/packages/docs/:path'
  },

  footer: {
    message: 'Released under the MIT License.'
  }
})
