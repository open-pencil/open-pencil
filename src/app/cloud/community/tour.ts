import { fetchCommunityTour } from '@open-pencil/cloud/client'

import { APP_VERSION } from '@/app/runtime/version'
import { OFFICIAL_CLOUD_URL } from '@/constants'

import { cloudFetch } from '../sessions/connection'

/**
 * The tour, from the official Cloud server's community gallery: the version named for this
 * release when the gallery has one, else the tour as it is now. Null when the server names none.
 * The desktop app fetches it without the webview's CORS, as it does every Cloud request, since
 * the server and its storage list only web origins.
 */
export async function fetchOfficialTour(): Promise<Uint8Array | null> {
  const tour = await fetchCommunityTour(OFFICIAL_CLOUD_URL, {
    version: APP_VERSION,
    fetch: cloudFetch
  })
  return tour?.bytes ?? null
}
