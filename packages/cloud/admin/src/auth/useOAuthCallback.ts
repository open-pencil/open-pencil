import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { parseOAuthCallback, withoutOAuthCallback, type OAuthCallbackState } from './callback'

export function useOAuthCallback() {
  const route = useRoute()
  const router = useRouter()
  const state = ref<OAuthCallbackState>({ kind: 'none' })

  onMounted(async () => {
    state.value = parseOAuthCallback(route.query)
    if (state.value.kind !== 'none') {
      await router.replace({ path: route.path, query: withoutOAuthCallback(route.query) })
    }
  })

  return state
}
