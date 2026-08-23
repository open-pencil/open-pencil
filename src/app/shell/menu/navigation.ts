import type { Router } from 'vue-router'

export function openStorageWorkspace(router: Router): void {
  void router
    .push('/')
    .then(() => import('@/app/tabs'))
    .then(({ showNewTab }) => showNewTab())
}
