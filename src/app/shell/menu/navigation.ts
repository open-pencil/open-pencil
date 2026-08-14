import type { Router } from 'vue-router'

export function openStorageWorkspace(router: Router): void {
  void router.push('/storage')
}
