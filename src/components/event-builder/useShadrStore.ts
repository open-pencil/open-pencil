import {
  isConnecting,
  isOnline,
  isSyncing,
  lastError,
  selectedPageId,
  serverPages,
  serverUrl,
  status,
  token
} from '@/app/integrations/shadr/store/state'

import { checkConnection, saveCredentials } from './services/connection.service'
import { pullPage, pushCurrentPage } from './services/sync.service'

export function useShadrStore() {
  return {
    serverUrl,
    token,
    status,
    isOnline,
    isConnecting,
    isSyncing,
    serverPages,
    selectedPageId,
    lastError,
    saveCredentials,
    checkConnection,
    pullPage,
    pushCurrentPage
  }
}
