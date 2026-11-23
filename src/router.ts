import { createRouter, createWebHistory } from 'vue-router'

import { homeLocation } from '@/app/home/location'

/**
 * The editor and its workspace load with the first address that needs them, so a page that is
 * not the editor, such as an embed, never loads the editor's services, dialogs, or panels. Every
 * editor address shares one workspace component, which moving between them keeps.
 */
const EditorLayout = () => import('./views/EditorLayout.vue')
const WorkspaceView = () => import('./views/WorkspaceView.vue')
const EmbedView = () => import('./views/embed/EmbedView.vue')

const router = createRouter({
  history: createWebHistory(),
  routes: [
    // A Cloud document inside another site's page, read-only, without the editor around it. A
    // build without Cloud has none, and bundles none of the embed.
    ...(__OPENPENCIL_CLOUD__
      ? [
          { path: '/embed/share/:shareId', component: EmbedView },
          { path: '/embed/community/:documentId', component: EmbedView }
        ]
      : []),
    {
      path: '/',
      component: EditorLayout,
      children: [
        { path: '', component: WorkspaceView },
        {
          // Links to the storage workspace open Home on it.
          path: 'storage',
          redirect: (to) => {
            homeLocation.value = { kind: 'storage' }
            return { path: '/', query: to.query }
          }
        },
        { path: 'demo', component: WorkspaceView, meta: { demo: true } },
        // A peer-to-peer room, joined by its ID.
        { path: 'rooms/:roomId', component: WorkspaceView },
        // Cloud invitations and links; the app takes their secret out of the address on start.
        { path: 'invitations/:invitationId', component: WorkspaceView },
        { path: 'share/:shareId', component: WorkspaceView },
        // A Cloud document, or one of its versions, for whoever signs in with access to it.
        { path: 'documents/:documentId', component: WorkspaceView },
        // A document of the server's community gallery, which anyone opens read-only; its page
        // on the server, `/community/:documentId`, links here.
        { path: 'community/:documentId/open', component: WorkspaceView }
      ]
    }
  ]
})

export default router
