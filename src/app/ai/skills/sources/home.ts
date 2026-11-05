import { invoke } from '@tauri-apps/api/core'
import { partition } from 'es-toolkit'
import * as v from 'valibot'

import { isSkill, skillFromFolder } from '../folder'
import type { SkillScan, SkillSourceID } from '../types'

/** The folders other agents install skills into, in the order a repeated name resolves. */
export const HOME_SKILL_SOURCES: readonly { id: SkillSourceID; folder: readonly string[] }[] = [
  { id: 'agents', folder: ['.agents', 'skills'] },
  { id: 'claude', folder: ['.claude', 'skills'] }
]

const skillFoldersSchema = v.array(
  v.object({
    name: v.string(),
    path: v.string(),
    skillFile: v.string(),
    files: v.array(v.string())
  })
)

export type SkillFolder = v.InferOutput<typeof skillFoldersSchema>[number]

export interface HomeSkillReader {
  /** The skill folders directly inside `root`; empty when it does not exist. */
  folders: (root: string) => Promise<unknown>
  readFile: (dir: string, path: string) => Promise<string>
}

/** The folders in a skills folder, or none when it cannot be read. */
export async function readSkillFolders(
  reader: Pick<HomeSkillReader, 'folders'>,
  root: string
): Promise<SkillFolder[]> {
  const result = v.safeParse(skillFoldersSchema, await reader.folders(root).catch(() => []))
  return result.success ? result.output : []
}

/** Turns the folders one source holds into skills, and the ones that are not into problems. */
export function skillsFromFolders(
  source: SkillSourceID,
  displayRoot: string,
  folders: readonly SkillFolder[],
  readFile: HomeSkillReader['readFile'],
  skillsFolder?: string
): SkillScan {
  const [skills, problems] = partition(
    folders.map((folder) =>
      skillFromFolder({
        source,
        folder: folder.name,
        location: `${displayRoot}/${folder.name}`,
        ...(skillsFolder !== undefined && { skillsFolder }),
        skillFile: folder.skillFile,
        files: folder.files,
        readFile: (path) => readFile(folder.path, path)
      })
    ),
    isSkill
  )
  return { skills, problems }
}

/** Reads every home source; a source that cannot be read contributes nothing. */
export async function readHomeSkills(home: string, reader: HomeSkillReader): Promise<SkillScan> {
  const scans = await Promise.all(
    HOME_SKILL_SOURCES.map(async ({ id, folder }) => {
      const folders = await readSkillFolders(reader, [home, ...folder].join('/'))
      return skillsFromFolders(id, `~/${folder.join('/')}`, folders, reader.readFile)
    })
  )
  return {
    skills: scans.flatMap((scan) => scan.skills),
    problems: scans.flatMap((scan) => scan.problems)
  }
}

/** The desktop's reader, through the shell's skill commands. */
export async function nativeHomeSkillReader(): Promise<HomeSkillReader> {
  return {
    folders: (root) => invoke<unknown>('skill_folders', { root }),
    readFile: (dir, path) => invoke<string>('skill_folder_file', { dir, path })
  }
}
