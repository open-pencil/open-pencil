import TwoslashFloatingVue from '@shikijs/vitepress-twoslash/client'
import { inBrowser } from 'vitepress'
import DefaultTheme from 'vitepress/theme'

import '@shikijs/vitepress-twoslash/style.css'

import SdkCard from './components/SdkCard.vue'
import SdkCardGroup from './components/SdkCardGroup.vue'
import SdkComponentAPI from './components/SdkComponentAPI.vue'
import SdkDataTable from './components/SdkDataTable.vue'
import SdkEventsTable from './components/SdkEventsTable.vue'
import SdkField from './components/SdkField.vue'
import SdkFieldGroup from './components/SdkFieldGroup.vue'
import SdkPropsTable from './components/SdkPropsTable.vue'
import SdkRelatedLinks from './components/SdkRelatedLinks.vue'
import SdkSlotsTable from './components/SdkSlotsTable.vue'

import { movedSection } from './moved-sections'

import './tailwind.css'
import './vars.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    // An old link to a section that moved to its own page lands here with that section's `#`.
    if (inBrowser) {
      const moved = movedSection(location.pathname, location.hash)
      if (moved) location.replace(moved)
    }
    app.use(TwoslashFloatingVue)
    app.component('SdkCard', SdkCard)
    app.component('SdkCardGroup', SdkCardGroup)
    app.component('SdkComponentAPI', SdkComponentAPI)
    app.component('SdkDataTable', SdkDataTable)
    app.component('SdkEventsTable', SdkEventsTable)
    app.component('SdkField', SdkField)
    app.component('SdkFieldGroup', SdkFieldGroup)
    app.component('SdkPropsTable', SdkPropsTable)
    app.component('SdkRelatedLinks', SdkRelatedLinks)
    app.component('SdkSlotsTable', SdkSlotsTable)
  }
}
