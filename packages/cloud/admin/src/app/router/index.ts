import SecurityView from '#admin/account/security/SecurityView.vue'
import AuditView from '#admin/admin/audit/AuditView.vue'
import EmailView from '#admin/admin/email/EmailView.vue'
import EnrollmentView from '#admin/admin/enrollment/EnrollmentView.vue'
import OperationsView from '#admin/admin/operations/OperationsView.vue'
import UsersView from '#admin/admin/users/UsersView.vue'
import DashboardView from '#admin/app/dashboard/DashboardView.vue'
import AuthView from '#admin/auth/AuthView.vue'
import ForgotPasswordView from '#admin/auth/ForgotPasswordView.vue'
import PendingView from '#admin/auth/PendingView.vue'
import ResetPasswordView from '#admin/auth/ResetPasswordView.vue'
import RestrictedView from '#admin/auth/RestrictedView.vue'
import VerifyEmailView from '#admin/auth/VerifyEmailView.vue'
import AdminShell from '#admin/components/layout/AdminShell.vue'
import HomeView from '#admin/public/home/HomeView.vue'
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

import {
  requireAccountState,
  requireActiveAccount,
  requireDeploymentAdmin,
  resolveAnonymous
} from './guards'

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
    meta: { headKey: 'home', indexing: 'public' }
  },
  {
    path: '/auth/sign-in',
    name: 'sign-in',
    component: AuthView,
    props: { intent: 'sign-in' },
    beforeEnter: resolveAnonymous,
    meta: { headKey: 'signIn', indexing: 'private' }
  },
  {
    path: '/auth/sign-up',
    name: 'sign-up',
    component: AuthView,
    props: { intent: 'sign-up' },
    beforeEnter: resolveAnonymous,
    meta: { headKey: 'signUp', indexing: 'private' }
  },
  {
    path: '/auth/verify-email',
    name: 'verify-email',
    component: VerifyEmailView,
    meta: { headKey: 'verifyEmail', indexing: 'private' }
  },
  {
    path: '/auth/forgot-password',
    name: 'forgot-password',
    component: ForgotPasswordView,
    beforeEnter: resolveAnonymous,
    meta: { headKey: 'forgotPassword', indexing: 'private' }
  },
  {
    path: '/auth/reset-password',
    name: 'reset-password',
    component: ResetPasswordView,
    meta: { headKey: 'resetPassword', indexing: 'private' }
  },
  { path: '/sign-in', redirect: { name: 'sign-in' } },
  { path: '/sign-up', redirect: { name: 'sign-up' } },
  { path: '/join', redirect: { name: 'sign-up' } },
  { path: '/admin/sign-in', redirect: { name: 'sign-in', query: { redirect: '/admin' } } },
  {
    path: '/account/pending',
    name: 'account-pending',
    component: PendingView,
    beforeEnter: requireAccountState('pending'),
    meta: { headKey: 'pending', indexing: 'private' }
  },
  {
    path: '/account/rejected',
    name: 'account-rejected',
    component: RestrictedView,
    props: { state: 'rejected' },
    beforeEnter: requireAccountState('rejected'),
    meta: { headKey: 'rejected', indexing: 'private' }
  },
  {
    path: '/account/revoked',
    name: 'account-revoked',
    component: RestrictedView,
    props: { state: 'revoked' },
    beforeEnter: requireAccountState('revoked'),
    meta: { headKey: 'revoked', indexing: 'private' }
  },
  {
    path: '/app/account/security',
    name: 'account-security',
    component: SecurityView,
    beforeEnter: requireActiveAccount,
    meta: { headKey: 'security', indexing: 'private' }
  },
  {
    path: '/app',
    name: 'dashboard',
    component: DashboardView,
    beforeEnter: requireActiveAccount,
    meta: { headKey: 'dashboard', indexing: 'private' }
  },
  {
    path: '/admin/forbidden',
    name: 'admin-forbidden',
    component: () => import('#admin/auth/ForbiddenView.vue'),
    meta: { headKey: 'forbidden', indexing: 'private' }
  },
  {
    path: '/admin',
    component: AdminShell,
    beforeEnter: requireDeploymentAdmin,
    meta: { headKey: 'enrollment', indexing: 'private' },
    children: [
      { path: '', redirect: { name: 'admin-enrollment' } },
      {
        path: 'enrollment',
        name: 'admin-enrollment',
        component: EnrollmentView,
        meta: { headKey: 'enrollment', indexing: 'private' }
      },
      {
        path: 'users',
        name: 'admin-users',
        component: UsersView,
        meta: { headKey: 'users', indexing: 'private' }
      },
      {
        path: 'email',
        name: 'admin-email',
        component: EmailView,
        meta: { headKey: 'email', indexing: 'private' }
      },
      {
        path: 'audit',
        name: 'admin-audit',
        component: AuditView,
        meta: { headKey: 'audit', indexing: 'private' }
      },
      {
        path: 'operations',
        name: 'admin-operations',
        component: OperationsView,
        meta: { headKey: 'operations', indexing: 'private' }
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('#admin/public/not-found/NotFoundView.vue'),
    meta: { headKey: 'notFound', indexing: 'private' }
  }
] satisfies RouteRecordRaw[]

export const router = createRouter({ history: createWebHistory(), routes })
