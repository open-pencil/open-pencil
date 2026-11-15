import { createRouter, createWebHistory } from 'vue-router'

import { isCloudPortalPage } from '@open-pencil/cloud/contract'

import type { PortalContext } from '@/app/cloud-portal/context'
import { PORTAL_HOME, portalDestination, TERMS_PAGE } from '@/app/cloud-portal/navigation'

/**
 * The Cloud portal's pages, guarded by the portal's access rules (`portalDestination`). The
 * editor, and anything else the server serves, loads as its own page.
 */
export function createCloudPortalRouter(context: PortalContext) {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      {
        path: '/welcome',
        name: 'welcome',
        component: () => import('@/views/cloud/WelcomeView.vue'),
        meta: { signedOut: true }
      },
      {
        path: '/auth/sign-in',
        name: 'sign-in',
        component: () => import('@/views/cloud/SignInView.vue'),
        meta: { signedOut: true }
      },
      {
        path: '/auth/sign-up',
        name: 'sign-up',
        component: () => import('@/views/cloud/SignInView.vue'),
        meta: { signedOut: true }
      },
      {
        path: '/auth/check-email',
        name: 'check-email',
        component: () => import('@/views/cloud/CheckEmailView.vue')
      },
      {
        path: '/auth/verified',
        name: 'verified',
        component: () => import('@/views/cloud/VerifiedView.vue')
      },
      {
        path: '/auth/two-factor',
        name: 'two-factor',
        component: () => import('@/views/cloud/TwoStepView.vue')
      },
      {
        path: '/auth/forgot-password',
        name: 'forgot-password',
        component: () => import('@/views/cloud/ResetPasswordView.vue')
      },
      {
        path: '/auth/reset-password',
        name: 'reset-password',
        component: () => import('@/views/cloud/ResetPasswordView.vue')
      },
      {
        path: '/auth/return',
        name: 'return',
        component: () => import('@/views/cloud/ReturnView.vue'),
        meta: { account: true }
      },
      {
        path: '/auth/device',
        name: 'device',
        component: () => import('@/views/cloud/DeviceView.vue'),
        meta: { account: true }
      },
      {
        path: '/account/pending',
        name: 'pending',
        component: () => import('@/views/cloud/StandingView.vue'),
        meta: { account: true }
      },
      {
        path: '/account/closed',
        name: 'closed',
        component: () => import('@/views/cloud/StandingView.vue'),
        meta: { account: true }
      },
      {
        path: TERMS_PAGE,
        name: 'terms',
        component: () => import('@/views/cloud/TermsView.vue'),
        meta: { account: true }
      },
      {
        path: '/account',
        name: 'profile',
        component: () => import('@/views/cloud/ConsoleView.vue'),
        meta: { account: true }
      },
      {
        path: '/account/security',
        name: 'security',
        component: () => import('@/views/cloud/ConsoleView.vue'),
        meta: { account: true }
      },
      {
        path: '/account/sessions',
        name: 'sessions',
        component: () => import('@/views/cloud/ConsoleView.vue'),
        meta: { account: true }
      },
      {
        path: '/account/plan',
        name: 'plan',
        component: () => import('@/views/cloud/ConsoleView.vue'),
        meta: { account: true },
        // Only a server that sells plans has one to show; editors link here only then.
        beforeEnter: () => (context.discovery.billing ? true : { name: 'profile' })
      },
      {
        path: '/account/tokens',
        name: 'tokens',
        component: () => import('@/views/cloud/ConsoleView.vue'),
        meta: { account: true }
      },
      {
        path: '/admin/:section(overview|requests|reports|documents|people|email|activity)?',
        name: 'admin',
        component: () => import('@/views/cloud/ConsoleView.vue'),
        meta: { account: true, admin: true }
      },
      {
        // The community gallery, for anyone; a server without one sends visitors to the editor.
        path: '/community',
        name: 'community',
        component: () => import('@/views/cloud/community/CommunityView.vue'),
        beforeEnter: () => (context.discovery.community ? true : PORTAL_HOME)
      },
      {
        path: '/community/:documentId',
        name: 'community-document',
        component: () => import('@/views/cloud/community/CommunityDocumentView.vue'),
        beforeEnter: () => (context.discovery.community ? true : PORTAL_HOME)
      },
      {
        path: '/admin/people/:userId',
        name: 'person',
        component: () => import('@/views/cloud/ConsoleView.vue'),
        meta: { account: true, admin: true }
      }
    ]
  })

  // Guards rather than a catch-all route: a redirect record runs before them, and the editor's
  // own address, which they send on, would match it again.
  router.beforeEach((to) => {
    if (!isCloudPortalPage(to.path)) {
      globalThis.location.assign(to.fullPath)
      return false
    }
    // A stale or mistyped portal address, which the server still answers with this page.
    if (to.matched.length === 0) return PORTAL_HOME
    return portalDestination(to, context.account.value)
  })

  return router
}
