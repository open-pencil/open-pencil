import { createRouter, createWebHistory } from 'vue-router'

import CloudInvitationView from './views/CloudInvitationView.vue'
import EditorView from './views/EditorView.vue'
import WorkspaceView from './views/WorkspaceView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: WorkspaceView },
    { path: '/storage', redirect: '/' },
    { path: '/demo', component: WorkspaceView, meta: { demo: true } },
    { path: '/share/:roomId', component: WorkspaceView },
    {
      path: '/cloud/invitations/:invitationId',
      name: 'cloud-invitation',
      component: CloudInvitationView
    },
    { path: '/cloud/share/:shareId', name: 'cloud-share', component: EditorView }
  ]
})

export default router
