import { routeMeta, type CloudHeadKey } from '#admin/app/router/meta'
import { headMessages } from '#admin/i18n/create'
import { cloudLocale } from '#admin/i18n/locale'
import type { headMessageDefaults } from '#admin/i18n/messages'
import { useStore } from '@nanostores/vue'
import { useHead } from '@unhead/vue'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const HEAD_KEYS = {
  home: ['homeTitle', 'homeDescription'],
  signIn: ['signInTitle', 'signInDescription'],
  signUp: ['signUpTitle', 'signUpDescription'],
  verifyEmail: ['verifyEmailTitle', 'verifyEmailDescription'],
  forgotPassword: ['forgotPasswordTitle', 'forgotPasswordDescription'],
  resetPassword: ['resetPasswordTitle', 'resetPasswordDescription'],
  pending: ['pendingTitle', 'pendingDescription'],
  rejected: ['rejectedTitle', 'rejectedDescription'],
  revoked: ['revokedTitle', 'revokedDescription'],
  dashboard: ['dashboardTitle', 'dashboardDescription'],
  notFound: ['notFoundTitle', 'notFoundDescription'],
  enrollment: ['enrollmentTitle', 'enrollmentDescription'],
  users: ['usersTitle', 'usersDescription'],
  email: ['emailTitle', 'emailDescription'],
  audit: ['auditTitle', 'auditDescription'],
  operations: ['operationsTitle', 'operationsDescription'],
  forbidden: ['forbiddenTitle', 'forbiddenDescription']
} as const satisfies Record<
  CloudHeadKey,
  readonly [keyof typeof headMessageDefaults, keyof typeof headMessageDefaults]
>

export function useRouteHead(): void {
  const route = useRoute()
  const locale = useStore(cloudLocale)
  const messages = useStore(headMessages)
  const keys = computed(() => HEAD_KEYS[routeMeta(route).headKey])
  const title = computed(() => String(messages.value[keys.value[0]]))
  const description = computed(() => String(messages.value[keys.value[1]]))
  const canonical = computed(() => new URL(route.path, globalThis.location.origin).href)
  useHead({
    htmlAttrs: { lang: () => locale.value },
    title,
    titleTemplate: (value) =>
      value === messages.value.homeTitle ? value : `${value} · ${messages.value.homeTitle}`,
    meta: [
      { name: 'description', content: description },
      {
        name: 'robots',
        content: () =>
          routeMeta(route).indexing === 'private' ? 'noindex, nofollow, noarchive' : 'index, follow'
      },
      { name: 'theme-color', content: '#1e1e1e' }
    ],
    link: [{ rel: 'canonical', href: canonical }]
  })
}
