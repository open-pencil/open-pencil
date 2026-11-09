import { open } from '@tauri-apps/plugin-dialog'
import { readFile } from '@tauri-apps/plugin-fs'

import { readRepositoryRoot } from '@/app/integrations/git/client'

import { detectProject, type RepositoryRootAnswer } from './detect'
import type { ProjectImportIo } from './import'

/** Read a UTF-8 file, or answer null when it is missing or unreadable. */
async function readText(path: string): Promise<string | null> {
  try {
    return new TextDecoder().decode(await readFile(path))
  } catch {
    return null
  }
}

/**
 * Git's answer for the picked folder. A gateway failure means git could not be asked at all,
 * which is a different problem from a folder that simply is not versioned.
 */
async function repositoryRoot(folder: string): Promise<RepositoryRootAnswer> {
  const answer = await readRepositoryRoot(folder)
  if (!answer.ok) return { kind: 'unavailable' }
  return answer.value === null
    ? { kind: 'not-repository' }
    : { kind: 'repository', root: answer.value }
}

/** Adding a project in the desktop app: the native folder picker, git, and the package manifest. */
export const desktopProjectImport: ProjectImportIo = {
  chooseFolder: async (title) => {
    const picked = await open({ directory: true, multiple: false, title })
    return typeof picked === 'string' && picked !== '' ? picked : null
  },
  detect: (folder) => detectProject({ repositoryRoot, readText }, folder)
}
