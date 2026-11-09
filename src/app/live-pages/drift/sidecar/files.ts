import { join } from '@tauri-apps/api/path'
import { mkdir, readFile, writeFile } from '@tauri-apps/plugin-fs'

import { IS_TAURI } from '@/constants'

import { DRIFT_SIDECAR_FOLDER, DRIFT_SIDECAR_FILE } from './model'

/**
 * A project's sidecar, as the two operations that move it: reading one that may not exist yet, and
 * writing one. Injected, so the scenario around it runs without a desktop or a repository.
 */
export type SidecarFiles = {
  read(repository: string): Promise<string | null>
  write(repository: string, text: string): Promise<boolean>
}

/** The sidecar's path in a project, which the native file access takes as one absolute path. */
export function sidecarPath(repository: string): Promise<string> {
  return join(repository, DRIFT_SIDECAR_FOLDER, DRIFT_SIDECAR_FILE)
}

/**
 * The project's files as the desktop sees them. A browser build has no project folder to write to,
 * and a folder that refuses the write answers false: either way the panel says so rather than
 * leaving a rejected promise behind.
 */
export function desktopSidecarFiles(): SidecarFiles {
  return {
    async read(repository) {
      if (!IS_TAURI) return null
      try {
        return new TextDecoder().decode(await readFile(await sidecarPath(repository)))
      } catch (error) {
        // A project with no sidecar yet is the ordinary case, not a failure worth a banner.
        console.warn('[Drift] The project holds no readable baselines:', error)
        return null
      }
    },
    async write(repository, text) {
      if (!IS_TAURI) return false
      try {
        await mkdir(await join(repository, DRIFT_SIDECAR_FOLDER), { recursive: true })
        await writeFile(await sidecarPath(repository), new TextEncoder().encode(text))
        return true
      } catch (error) {
        console.warn('[Drift] The baselines could not be written to the project:', error)
        return false
      }
    }
  }
}
