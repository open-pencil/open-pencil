import { useWindowFocus } from '@vueuse/core'
import { computed, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'

import { readGitStatus, type GitStatus, type GitTransport } from '@/app/integrations/git'

import type { Project } from './schema'

/** What Home shows of a project's repository: its branch and how many files differ from it. */
export type ProjectStatus = {
  /** The branch name, or null while HEAD is detached or the branch has no commits yet. */
  branch: string | null
  /** Files the working tree reports as changed, staged, or untracked. */
  changed: number
}

/** The two facts the project list shows, read from one status. */
export function summarizeGitStatus(status: GitStatus): ProjectStatus {
  return { branch: status.branch.head, changed: status.entries.length }
}

/**
 * The branch and changes of every project Home lists. A repository git cannot read simply has
 * no status, so one unreadable project never hides the others.
 */
export function useProjectStatuses(
  projects: MaybeRefOrGetter<readonly Project[]>,
  transport?: GitTransport
) {
  const statuses = ref<Record<string, ProjectStatus>>({})
  /**
   * The list a read belongs to, id and repository together: the id comes from the repository, but a
   * record edited outside the app can keep the id of the folder it no longer points at, and the
   * status of that folder is then not the one the list would show.
   */
  const listed = computed(() =>
    toValue(projects)
      .map((project) => `${project.id} ${project.repository}`)
      .join('\n')
  )
  /** Reads run one after another, so a refresh asked for mid-read waits for that read. */
  let chain: Promise<void> = Promise.resolve()

  async function readAll(): Promise<void> {
    const current = toValue(projects)
    const expected = listed.value
    const read = await Promise.all(
      current.map(async (project) => {
        const outcome = await readGitStatus(project.repository, transport)
        return [project.id, outcome.ok ? summarizeGitStatus(outcome.value) : null] as const
      })
    )
    if (listed.value !== expected) return
    const next: Record<string, ProjectStatus> = {}
    for (const [id, status] of read) {
      if (status !== null) next[id] = status
    }
    statuses.value = next
  }

  function refresh(): Promise<void> {
    // A failed read must not stop the reads queued behind it.
    chain = chain.then(() => readAll().catch(() => undefined))
    return chain
  }

  watch(listed, () => void refresh(), { immediate: true })
  // Coming back to the window is when a commit made elsewhere shows up here.
  const focused = useWindowFocus()
  watch(focused, (isFocused) => {
    if (isFocused) void refresh()
  })

  return { statuses, refresh }
}
