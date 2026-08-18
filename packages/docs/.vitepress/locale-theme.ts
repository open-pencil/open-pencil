import { sdkSidebar } from './sdk-sidebar.ts'
import {
  developmentSidebar,
  guideSidebar,
  programmableSidebar,
  referenceSidebar,
  userGuideSidebar,
} from './sidebars.ts'

import type { NavLabels, ProgrammableLabels, SidebarLabels } from './labels.ts'
import type { DefaultTheme } from 'vitepress'

export const localeThemeConfig = (
  prefix: string,
  nav: NavLabels,
  sidebar: SidebarLabels,
  prog: ProgrammableLabels,
): DefaultTheme.Config => ({
  // Not every canonical page has a maintained translation. Locale switches return
  // to the locale home instead of inventing a corresponding URL that may 404.
  i18nRouting: false,
  nav: [
    { text: nav.overview, link: `${prefix}/getting-started` },
    { text: nav.userGuide, link: `${prefix}/user-guide/` },
    { text: nav.programmable, link: `${prefix}/programmable/` },
    { text: nav.sdk, link: `${prefix}/programmable/sdk/` },
    { text: nav.reference, link: `${prefix}/reference/keyboard-shortcuts` },
    { text: nav.development, link: '/development/contributing' },
    { text: nav.openApp, link: 'https://app.openpencil.dev' },
  ],
  sidebar: {
    [`${prefix}/user-guide/`]: userGuideSidebar(prefix, sidebar),
    [`${prefix}/programmable/sdk/`]: sdkSidebar(prefix),
    [`${prefix}/programmable/`]: programmableSidebar(prefix, prog),
    [`${prefix}/reference/`]: referenceSidebar(prefix, nav.reference, sidebar),
    [`${prefix}/development/`]: developmentSidebar('', nav.development, sidebar),
    [`${prefix}/`]: guideSidebar(prefix, sidebar),
  },
})
