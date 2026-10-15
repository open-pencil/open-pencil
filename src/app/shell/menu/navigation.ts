import type { Router } from 'vue-router'

/** Shows the start page. */
export function openHome(router: Router): void {
  void router
    .push('/')
    .then(() => import('@/app/tabs'))
    .then(({ showHome }) => showHome())
}
