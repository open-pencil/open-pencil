import type { Router } from 'vue-router'

import { homeLocation, type HomeLocation } from '@/app/home/location'

function showHome(router: Router): void {
  void router
    .push('/')
    .then(() => import('@/app/tabs'))
    .then(({ showNewTab }) => showNewTab())
}

/** Shows Home at one of its places, in a new tab when a document is open. */
export function openHomeLocation(router: Router, location: HomeLocation): void {
  homeLocation.value = location
  showHome(router)
}

/** Home at the place the person browsed last: a Cloud workspace, the bucket, or Recent. */
export function browseFiles(router: Router): void {
  showHome(router)
}
