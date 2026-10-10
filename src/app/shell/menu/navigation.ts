import type { Router } from 'vue-router'

import { homeLocation } from '@/app/home/location'

export function openStorageWorkspace(router: Router): void {
  homeLocation.value = { kind: 'storage' }
  void router
    .push('/')
    .then(() => import('@/app/tabs'))
    .then(({ showNewTab }) => showNewTab())
}
