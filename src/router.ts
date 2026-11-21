import { createRouter, createWebHistory } from 'vue-router'

import { homeLocation } from '@/app/home/location'
import { baseAddressFrom, designRouteGuard } from '@/app/tabs/design-address'

import WorkspaceView from './views/WorkspaceView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: WorkspaceView },
    {
      // Links to the storage workspace open Home on it.
      path: '/storage',
      redirect: (to) => {
        homeLocation.value = { kind: 'storage' }
        return { path: '/', query: to.query }
      }
    },
    { path: '/demo', component: WorkspaceView, meta: { demo: true } },
    // A design kept only on this device, by its recovery copy's ID (`src/app/tabs/design-address.ts`).
    { path: '/design/:designId', component: WorkspaceView, beforeEnter: designRouteGuard },
    { path: '/design', redirect: baseAddressFrom },
    // A peer-to-peer room, joined by its ID.
    { path: '/rooms/:roomId', component: WorkspaceView },
    // Cloud invitations and links; the app takes their secret out of the address on start.
    { path: '/invitations/:invitationId', component: WorkspaceView },
    { path: '/share/:shareId', component: WorkspaceView },
    // A Cloud document, or one of its versions, for whoever signs in with access to it.
    { path: '/documents/:documentId', component: WorkspaceView },
    // A document of the server's community gallery, which anyone opens read-only; its page on the
    // server, `/community/:documentId`, links here.
    { path: '/community/:documentId/open', component: WorkspaceView }
  ]
})

export default router
