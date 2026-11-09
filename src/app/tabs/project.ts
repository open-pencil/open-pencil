import type { Project } from '@/app/projects/schema'

type ProjectTab = { kind: string; project?: Project }

/**
 * The tab already open for this project, so asking for the same project twice brings that tab
 * forward instead of opening a second screen over the same repository.
 */
export function findProjectTab<T extends ProjectTab>(
  tabs: readonly T[],
  projectId: string
): T | null {
  return tabs.find((tab) => tab.kind === 'project' && tab.project?.id === projectId) ?? null
}
