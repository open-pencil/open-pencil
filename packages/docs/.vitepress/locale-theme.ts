import { sdkSidebar } from './sdk-sidebar'
import {
  developmentSidebar,
  guideSidebar,
  programmableSidebar,
  referenceSidebar,
  userGuideSidebar,
} from './sidebars'

import type { NavLabels, ProgrammableLabels, SidebarLabels } from './labels'
import type { DefaultTheme } from 'vitepress'

export const localeThemeConfig = (
  prefix: string,
  nav: NavLabels,
  sidebar: SidebarLabels,
  prog: ProgrammableLabels,
): DefaultTheme.Config => ({
  nav: [
    { text: nav.guide, link: `${prefix}/guide/getting-started` },
    { text: nav.userGuide, link: `${prefix}/user-guide/` },
    { text: nav.programmable, link: `${prefix}/programmable/` },
    { text: nav.sdk, link: `${prefix}/programmable/sdk/` },
    { text: nav.reference, link: `${prefix}/reference/keyboard-shortcuts` },
    { text: nav.development, link: `${prefix}/development/contributing` },
    { text: nav.openApp, link: 'https://app.openpencil.dev' },
  ],
  sidebar: {
    [`${prefix}/user-guide/`]: userGuideSidebar(prefix, sidebar),
    [`${prefix}/programmable/sdk/`]: sdkSidebar(prefix),
    [`${prefix}/programmable/`]: programmableSidebar(prefix, prog),
    [`${prefix}/reference/`]: referenceSidebar(prefix, nav.reference),
    [`${prefix}/`]: [
      ...guideSidebar(prefix, sidebar),
      ...developmentSidebar(prefix, nav.development),
    ],
  },
})
