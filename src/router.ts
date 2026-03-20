import { createRouter, createWebHistory } from 'vue-router'

import EditorView from './views/EditorView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: EditorView },
    { path: '/demo', component: EditorView, meta: { demo: true } },
    { path: '/share/:roomId', component: EditorView },
    { path: '/careernote', component: EditorView, meta: { careernote: true } },
  ]
})

export default router
