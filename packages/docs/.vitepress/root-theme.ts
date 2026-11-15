import type { DefaultTheme } from 'vitepress'

import { EN, EN_PROG } from './labels.ts'
import { sdkSidebar } from './sdk/sidebar.ts'
import {
  cloudSidebar,
  developersSidebar,
  docsSidebar,
  sectionMatch,
  USER_REFERENCE_PAGES
} from './sidebars.ts'

const DEVELOPERS_NAV = { reference: 'Reference', development: 'Contributing' }

export const rootThemeConfig = (): DefaultTheme.Config => ({
  logo: { light: '/brand/mark.svg', dark: '/brand/mark-dark.svg', alt: 'OpenPencil' },
  search: { provider: 'local' },

  nav: [
    { text: 'Docs', link: '/getting-started', activeMatch: sectionMatch('').docs },
    { text: 'Developers', link: '/developers/', activeMatch: sectionMatch('').developers },
    { text: 'Cloud', link: '/cloud/', activeMatch: '^/cloud/' },
    { text: 'Download', link: '/download' }
  ],

  sidebar: {
    '/user-guide/': docsSidebar('', 'Reference', EN, EN_PROG),
    // Before `/reference/`, which has as many segments: VitePress keeps their order.
    ...Object.fromEntries(
      USER_REFERENCE_PAGES.map((page) => [page, docsSidebar('', 'Reference', EN, EN_PROG)])
    ),
    '/developers/sdk/': sdkSidebar(''),
    '/developers/': developersSidebar('', DEVELOPERS_NAV, EN, EN_PROG),
    '/reference/': developersSidebar('', DEVELOPERS_NAV, EN, EN_PROG),
    '/development/': developersSidebar('', DEVELOPERS_NAV, EN, EN_PROG),
    '/cloud/': cloudSidebar(),
    '/': docsSidebar('', 'Reference', EN, EN_PROG)
  },

  socialLinks: [
    { icon: 'github', link: 'https://github.com/open-pencil/open-pencil' },
    { icon: 'discord', link: 'https://discord.gg/4wXc9fuZfm', ariaLabel: 'Discord' }
  ],

  editLink: {
    pattern: 'https://github.com/open-pencil/open-pencil/edit/master/packages/docs/:path'
  }
})
