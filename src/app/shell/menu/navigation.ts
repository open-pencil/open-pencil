import type { Router } from 'vue-router'

import { homeLocation, type HomeLocation } from '@/app/home/location'
import { showNewTab } from '@/app/tabs'

function showHome(router: Router): void {
  void router.push('/').then(showNewTab)
}

/** Shows Home at one of its places, in a new tab when a document is open. */
export function openHomeLocation(router: Router, location: HomeLocation): void {
  homeLocation.value = location
  showHome(router)
}
