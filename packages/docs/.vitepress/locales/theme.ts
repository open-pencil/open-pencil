import type { NavLabels, ProgrammableLabels, SidebarLabels } from '#docs/labels.ts'
import { sdkSidebar } from '#docs/sdk/sidebar.ts'
import { developersSidebar, docsSidebar, sectionMatch } from '#docs/sidebars.ts'
import type { DefaultTheme } from 'vitepress'

export const localeThemeConfig = (
  prefix: string,
  nav: NavLabels,
  sidebar: SidebarLabels,
  prog: ProgrammableLabels
): DefaultTheme.Config => ({
  // Not every canonical page has a maintained translation. Locale switches return
  // to the locale home instead of inventing a corresponding URL that may 404.
  i18nRouting: false,
  nav: [
    { text: nav.docs, link: `${prefix}/getting-started`, activeMatch: sectionMatch(prefix).docs },
    {
      text: nav.developers,
      link: `${prefix}/programmable/`,
      activeMatch: sectionMatch(prefix).developers
    },
    // English only until translated.
    { text: nav.cloud, link: '/cloud/', activeMatch: '^/cloud/' },
    { text: nav.download, link: `${prefix}/download` }
  ],
  sidebar: {
    [`${prefix}/user-guide/`]: docsSidebar(prefix, nav.reference, sidebar),
    // Before `/reference/`, which has as many segments: VitePress keeps their order.
    [`${prefix}/reference/figma-compatibility`]: docsSidebar(prefix, nav.reference, sidebar),
    [`${prefix}/programmable/sdk/`]: sdkSidebar(prefix),
    [`${prefix}/programmable/`]: developersSidebar(prefix, nav, sidebar, prog),
    [`${prefix}/reference/`]: developersSidebar(prefix, nav, sidebar, prog),
    [`${prefix}/`]: docsSidebar(prefix, nav.reference, sidebar)
  }
})
