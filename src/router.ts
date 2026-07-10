import { createRouter, createWebHistory } from 'vue-router'

import { isCloudConfigured } from '@/app/cloud/credentials'

import EditorView from './views/EditorView.vue'
import HomeView from './views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
      beforeEnter(_to, _from, next) {
        if (!isCloudConfigured.value) {
          next({ path: '/edit', replace: true })
          return
        }
        next()
      }
    },
    {
      path: '/edit',
      name: 'edit',
      component: EditorView,
      // Cloud as source of truth: bare /edit is not the default entry — the files home is.
      // Allow /edit?local=1 after opening a local file from the home screen.
      beforeEnter(to, _from, next) {
        if (isCloudConfigured.value && to.query.local !== '1') {
          next({ path: '/', replace: true })
          return
        }
        next()
      }
    },
    {
      path: '/edit/cloud/:canvasId',
      name: 'edit-cloud',
      component: EditorView,
      props: true
    },
    { path: '/demo', component: EditorView, meta: { demo: true } },
    { path: '/share/:roomId', component: EditorView }
  ]
})

export default router
