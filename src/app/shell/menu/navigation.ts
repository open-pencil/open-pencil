import type { Router } from 'vue-router'

import { homeSection } from '@/app/recent-files'

/** Shows the start page. */
export function openHome(router: Router): void {
  void router
    .push('/')
    .then(() => import('@/app/tabs'))
    .then(({ showHome }) => showHome())
}

/** Shows the start page on its Storage list. */
export function openStorageWorkspace(router: Router): void {
  homeSection.value = 'storage'
  openHome(router)
}
