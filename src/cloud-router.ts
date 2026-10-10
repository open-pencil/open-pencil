import { createRouter, createWebHistory } from 'vue-router'

import type { PortalContext } from '@/app/cloud-portal/context'
import { PORTAL_HOME, portalDestination } from '@/app/cloud-portal/navigation'

/** The Cloud portal's pages, guarded by the portal's access rules (`portalDestination`). */
export function createCloudPortalRouter(context: PortalContext) {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', redirect: PORTAL_HOME },
      {
        path: '/auth/sign-in',
        name: 'sign-in',
        component: () => import('./views/cloud/SignInView.vue'),
        meta: { signedOut: true }
      },
      {
        path: '/auth/sign-up',
        name: 'sign-up',
        component: () => import('./views/cloud/SignInView.vue'),
        meta: { signedOut: true }
      },
      {
        path: '/auth/check-email',
        name: 'check-email',
        component: () => import('./views/cloud/CheckEmailView.vue')
      },
      {
        path: '/auth/two-factor',
        name: 'two-factor',
        component: () => import('./views/cloud/TwoStepView.vue')
      },
      {
        path: '/auth/forgot-password',
        name: 'forgot-password',
        component: () => import('./views/cloud/ResetPasswordView.vue')
      },
      {
        path: '/auth/reset-password',
        name: 'reset-password',
        component: () => import('./views/cloud/ResetPasswordView.vue')
      },
      {
        path: '/auth/return',
        name: 'return',
        component: () => import('./views/cloud/ReturnView.vue'),
        meta: { account: true }
      },
      {
        path: '/cloud/device',
        name: 'device',
        component: () => import('./views/cloud/DeviceView.vue'),
        meta: { account: true }
      },
      {
        path: '/account/pending',
        name: 'pending',
        component: () => import('./views/cloud/StandingView.vue')
      },
      {
        path: '/account/closed',
        name: 'closed',
        component: () => import('./views/cloud/StandingView.vue')
      },
      {
        path: '/account',
        name: 'security',
        component: () => import('./views/cloud/ConsoleView.vue'),
        meta: { account: true }
      },
      {
        path: '/admin/:section(overview|requests|people|email|activity)?',
        name: 'admin',
        component: () => import('./views/cloud/ConsoleView.vue'),
        meta: { account: true, admin: true }
      },
      { path: '/:pathMatch(.*)*', redirect: PORTAL_HOME }
    ]
  })

  router.beforeEach((to) => portalDestination(to, context.account.value))

  return router
}
