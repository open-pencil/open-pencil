import { ref, shallowRef } from 'vue'

import { importProject, type ProjectImportIo, type ProjectImportOutcome } from './import'
import { useProjects } from './store'

/** Why the last add produced no project, as the section explains it. */
export type ProjectAddFailure =
  | { kind: 'notRepository' }
  | { kind: 'unavailable' }
  | { kind: 'failed'; reason: string }

/**
 * Adding projects from the home screen: a picked folder becomes a project in the stored list.
 * The dialog's own outcome is returned so a caller can react, and a cancelled dialog changes
 * nothing at all.
 */
export function useProjectImport(io: ProjectImportIo) {
  const store = useProjects()
  const busy = ref(false)
  const failure = shallowRef<ProjectAddFailure | null>(null)

  /** Answers null while an add is already running, so a double click asks for one folder. */
  async function add(title: string): Promise<ProjectImportOutcome | null> {
    if (busy.value) return null
    busy.value = true
    failure.value = null
    try {
      const outcome = await importProject(io, title)
      if (outcome.kind === 'added') store.add(outcome.project)
      else if (outcome.kind !== 'cancelled') failure.value = outcome
      return outcome
    } finally {
      busy.value = false
    }
  }

  return {
    projects: store.projects,
    add,
    remove: store.remove,
    rename: store.rename,
    busy,
    failure
  }
}

export type ProjectImport = ReturnType<typeof useProjectImport>
