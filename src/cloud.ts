import { createHead } from '@unhead/vue/client'
import { createApp } from 'vue'

import './app.css'
import { loadPortalContext, PORTAL_CONTEXT } from '@/app/cloud-portal/context'

import { createCloudPortalRouter } from './cloud-router'
import CloudPortalApp from './views/cloud/CloudPortalApp.vue'
import CloudPortalUnavailableView from './views/cloud/CloudPortalUnavailableView.vue'

// Entry for the pages a Cloud server shows on its own address (`cloud.html`): signing in,
// approving the desktop app, account security, and the administrator console. The editor
// never loads it; only the Cloud server serves this page.
async function start(): Promise<void> {
  const head = createHead()
  let context: Awaited<ReturnType<typeof loadPortalContext>>
  try {
    context = await loadPortalContext()
  } catch (error) {
    console.error(error)
    createApp(CloudPortalUnavailableView).use(head).mount('#app')
    return
  }
  const app = createApp(CloudPortalApp)
  app.config.errorHandler = (error) => {
    console.error(error)
  }
  app.provide(PORTAL_CONTEXT, context)
  app.use(createCloudPortalRouter(context)).use(head).mount('#app')
}

void start()
