import { createRouter, createWebHistory } from 'vue-router'

import EditorView from './views/EditorView.vue'
import StorageView from './views/StorageView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    // The workspace is the entry point. Cold-starting into the editor meant a
    // first-time user landed on an untitled scratch document with no way back
    // to their own work until they discovered the storage route.
    { path: '/', component: StorageView },
    { path: '/editor', component: EditorView },
    // Kept so existing links and bookmarks still resolve.
    { path: '/storage', redirect: '/' },
    { path: '/demo', component: EditorView, meta: { demo: true } },
    { path: '/share/:roomId', component: EditorView }
  ]
})

export default router
