import type { NavLabels, PageLabels, ProgrammableLabels, SidebarLabels } from '#docs/labels.ts'
import { sdkSidebar } from '#docs/sdk/sidebar.ts'
import { developersSidebar, docsSidebar, sectionMatch } from '#docs/sidebars.ts'
import type { DefaultTheme } from 'vitepress'

/** The same edit link as the English pages; a locale's own config replaces the root's. */
const EDIT_PATTERN = 'https://github.com/open-pencil/open-pencil/edit/master/packages/docs/:path'

export const localeThemeConfig = (
  prefix: string,
  nav: NavLabels,
  sidebar: SidebarLabels,
  prog: ProgrammableLabels,
  page: PageLabels
): DefaultTheme.Config => ({
  outline: { label: page.outline },
  docFooter: { prev: page.previous, next: page.next },
  editLink: { pattern: EDIT_PATTERN, text: page.editPage },
  lastUpdated: { text: page.lastUpdated },
  returnToTopLabel: page.returnToTop,
  sidebarMenuLabel: page.menu,
  langMenuLabel: page.language,
  darkModeSwitchLabel: page.theme,
  nav: [
    { text: nav.docs, link: `${prefix}/getting-started`, activeMatch: sectionMatch(prefix).docs },
    {
      text: nav.developers,
      link: `${prefix}/developers/`,
      activeMatch: sectionMatch(prefix).developers
    },
    // English only until translated.
    { text: nav.cloud, link: '/cloud/', activeMatch: '^/cloud/' },
    { text: nav.download, link: `${prefix}/download` }
  ],
  sidebar: {
    [`${prefix}/user-guide/`]: docsSidebar(prefix, nav.reference, sidebar, prog),
    // Before `/reference/`, which has as many segments: VitePress keeps their order.
    [`${prefix}/reference/figma-compatibility`]: docsSidebar(prefix, nav.reference, sidebar, prog),
    [`${prefix}/developers/sdk/`]: sdkSidebar(prefix),
    [`${prefix}/developers/`]: developersSidebar(prefix, nav, sidebar, prog),
    [`${prefix}/reference/`]: developersSidebar(prefix, nav, sidebar, prog),
    [`${prefix}/`]: docsSidebar(prefix, nav.reference, sidebar, prog)
  }
})
