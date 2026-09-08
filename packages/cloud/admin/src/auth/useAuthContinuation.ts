import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { cloudRedirectPath } from '@open-pencil/cloud/client'

/** Carries a same-instance return destination through each authentication step. */
export function useAuthContinuation() {
  const route = useRoute()
  const redirect = computed(() => cloudRedirectPath(route.query.redirect))
  const signInRoute = computed(() => ({ name: 'sign-in', query: { redirect: redirect.value } }))
  function callbackURL(path: string): string {
    const url = new URL(path, globalThis.location.origin)
    url.searchParams.set('redirect', redirect.value)
    return url.href
  }
  return { redirect, signInRoute, callbackURL }
}
