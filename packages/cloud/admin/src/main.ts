import { VueQueryPlugin } from '@tanstack/vue-query'
import { createHead } from '@unhead/vue/client'
import { createApp } from 'vue'

import App from './App.vue'
import { readCloudBootstrap } from './app/bootstrap'
import BootstrapErrorView from './app/BootstrapErrorView.vue'
import { queryClient } from './app/query/client'
import { cloudQueryKeys } from './app/query/keys'
import { router } from './app/router'

import './app.css'

const application = (root: typeof App | typeof BootstrapErrorView) =>
  createApp(root).use(createHead()).use(VueQueryPlugin, { queryClient }).use(router)

try {
  queryClient.setQueryData(cloudQueryKeys.discovery, readCloudBootstrap(document))
  application(App).mount('#app')
} catch {
  application(BootstrapErrorView).mount('#app')
}
