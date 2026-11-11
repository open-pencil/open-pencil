import { useLocalStorage } from '@vueuse/core'
import { computed } from 'vue'

import {
  addProject,
  configureProject,
  parseProjects,
  removeProject,
  renameProject,
  storedProjects
} from './list'
import { type Project } from './schema'

const PROJECTS_STORAGE_KEY = 'open-pencil-projects'

/**
 * The projects the home screen lists. Each one carries its repository, the application inside it,
 * and how to start it, so source control and the app runner answer per project rather than for
 * the application as a whole.
 */
export function useProjects() {
  const stored = useLocalStorage<unknown>(PROJECTS_STORAGE_KEY, [])
  const projects = computed(() => parseProjects(stored.value))

  function write(next: Project[]): void {
    // A record this build cannot read travels back out with the write: renaming one project must
    // not be what deletes another one a later build would have understood.
    stored.value = storedProjects(next, stored.value)
  }

  function add(project: Project): void {
    write(addProject(projects.value, project))
  }

  function remove(id: string): void {
    write(removeProject(projects.value, id))
  }

  function rename(id: string, name: string): void {
    write(renameProject(projects.value, id, name))
  }

  function configure(
    id: string,
    changes: Partial<Pick<Project, 'appDirectory' | 'startCommand' | 'startUrl'>>
  ): void {
    write(configureProject(projects.value, id, changes))
  }

  return { projects, add, remove, rename, configure }
}

export type ProjectsStore = ReturnType<typeof useProjects>
