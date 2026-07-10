import { ref } from 'vue'

/**
 * Non-null when the configured cloud provider is unreachable (CORS, network,
 * bad credentials). Set by the home listing reconcile; shown as a red badge
 * on the always-on Settings button so a working-then-broken setup is visible
 * outside the Settings dialog.
 */
export const cloudConnectionError = ref<string | null>(null)
