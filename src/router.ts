import { createRouter, createWebHistory } from 'vue-router'

import { isExplicitOpenPending, tabCount } from './app/tabs'
import EditorView from './views/EditorView.vue'
import StorageView from './views/StorageView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    // The workspace is the entry point. Cold-starting into the editor meant a
    // first-time user landed on an untitled scratch document with no way back
    // to their own work until they discovered the storage route.
    { path: '/', component: StorageView },
    {
      path: '/editor',
      component: EditorView,
      /**
       * The editor needs a document; it no longer invents one.
       *
       * Redirecting from inside the view does not work — `router.replace()`
       * does not halt setup, so the rest of EditorView runs and asks for an
       * editor store that is not there. The decision has to happen before the
       * component mounts.
       */
      beforeEnter: (to) => {
        const wantsBlank = to.query.new === 'design' || to.query.new === 'deck'
        // The workspace routes here BEFORE the document finishes loading, so a
        // tab count of zero does not mean "nothing is coming" — it means the
        // open is still in flight.
        const allowed = tabCount() > 0 || wantsBlank || isExplicitOpenPending()
        return allowed ? true : { path: '/' }
      }
    },
    // Kept so existing links and bookmarks still resolve.
    { path: '/storage', redirect: '/' },
    { path: '/demo', component: EditorView, meta: { demo: true } },
    { path: '/share/:roomId', component: EditorView }
  ]
})

export default router
