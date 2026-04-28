import DefaultTheme from 'vitepress/theme'

import HomeLayout from './HomeLayout.vue'
import SdkCard from './components/SdkCard.vue'
import SdkCardGroup from './components/SdkCardGroup.vue'
import SdkDataTable from './components/SdkDataTable.vue'
import SdkEventsTable from './components/SdkEventsTable.vue'
import SdkField from './components/SdkField.vue'
import SdkFieldGroup from './components/SdkFieldGroup.vue'
import SdkPropsTable from './components/SdkPropsTable.vue'
import SdkRelatedLinks from './components/SdkRelatedLinks.vue'
import SdkSlotsTable from './components/SdkSlotsTable.vue'

export default {
  extends: DefaultTheme,
  Layout: HomeLayout,
  enhanceApp({ app }) {
    app.component('SdkCard', SdkCard)
    app.component('SdkCardGroup', SdkCardGroup)
    app.component('SdkDataTable', SdkDataTable)
    app.component('SdkEventsTable', SdkEventsTable)
    app.component('SdkField', SdkField)
    app.component('SdkFieldGroup', SdkFieldGroup)
    app.component('SdkPropsTable', SdkPropsTable)
    app.component('SdkRelatedLinks', SdkRelatedLinks)
    app.component('SdkSlotsTable', SdkSlotsTable)
  },
}
