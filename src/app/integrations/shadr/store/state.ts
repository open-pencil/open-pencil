import { computed, ref } from 'vue'

import { getCookie } from './cookie'

export type ConnectionStatus = 'idle' | 'connecting' | 'online' | 'offline'

export const COOKIE_KEY_TOKEN = 'shadr_token'
export const STORAGE_KEY_URL = 'shadr_server_url'

const ENV_URL = import.meta.env?.VITE_SHADR_API_URL || ''
const ENV_TOKEN = import.meta.env?.VITE_SHADR_TOKEN || ''

export const serverUrl = ref(
  (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY_URL)) || ENV_URL
)

export const token = ref(getCookie(COOKIE_KEY_TOKEN) || ENV_TOKEN)

export const status = ref<ConnectionStatus>('idle')
export const isOnline = computed(() => status.value === 'online')
export const isConnecting = computed(() => status.value === 'connecting')
export const isSyncing = ref(false)

export const serverPages = ref<string[]>([])
export const selectedPageId = ref<string>('main_menu')
export const lastError = ref<string | null>(null)
