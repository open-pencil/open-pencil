import type { App } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import { createRetainedScopePlugin } from '@open-pencil/vue'

const installed = new WeakSet<App>()

/**
 * What `src/boot.ts` installs for the app. App panels read the route, and VitePress has no
 * vue-router, so the page gets a private in-memory one that never touches the URL.
 */
export function installAppPlugins(app: App): void {
  if (installed.has(app)) return
  installed.add(app)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }]
  })
  app.use(createRetainedScopePlugin()).use(router)
}
