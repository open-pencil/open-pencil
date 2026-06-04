import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: () => import('./views/EditorView.vue') },
    { path: '/boards', component: () => import('./views/BoardsView.vue') },
    { path: '/board/:id/settings', component: () => import('./views/BoardSettingsView.vue') },
    { path: '/invite/:token', component: () => import('./views/InviteRedirectView.vue') },
    { path: '/demo', component: () => import('./views/EditorView.vue'), meta: { demo: true } },
    { path: '/share/:roomId', component: () => import('./views/EditorView.vue') }
  ]
})

export default router
