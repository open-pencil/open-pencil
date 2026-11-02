import { createHead } from '@unhead/vue/client'
import { createApp } from 'vue'
import { isNavigationFailure, NavigationFailureType } from 'vue-router'

import '@/app.css'
import { loadPortalContext, PORTAL_CONTEXT } from '@/app/cloud-portal/context'
import CloudPortalApp from '@/views/cloud/CloudPortalApp.vue'
import CloudPortalUnavailableView from '@/views/cloud/CloudPortalUnavailableView.vue'

import { createCloudPortalRouter } from './router'

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
  const router = createCloudPortalRouter(context)
  app.use(router).use(head)
  // The splash stays until the first page can show, rather than a blank page between. A first
  // navigation the guards stop leaves for the editor, so nothing mounts then; one that fails, as
  // when a page's code does not load, says the pages are unavailable.
  try {
    await router.isReady()
  } catch (error) {
    if (isNavigationFailure(error, NavigationFailureType.aborted)) return
    console.error(error)
    createApp(CloudPortalUnavailableView).use(createHead()).mount('#app')
    return
  }
  app.mount('#app')
}

void start()
