import { invoke } from '@tauri-apps/api/core'
import * as v from 'valibot'

import type { SkillScan } from '../types'
import { readSkillFolders, skillsFromFolders, type HomeSkillReader } from './home'

const skillsFoldersSchema = v.array(v.string())

export interface ProjectSkillReader extends HomeSkillReader {
  /** The skills folders a document's folder sees, nearest first. */
  skillsFolders: (dir: string) => Promise<unknown>
}

/** A skills folder near the open document, which the chat uses only once the user trusts it. */
export interface ProjectSkillsFolder {
  path: string
  /** The path as the user sees it, with the home folder as `~`. */
  location: string
}

export interface ProjectSkillScan extends SkillScan {
  folders: ProjectSkillsFolder[]
}

function displayPath(path: string, home: string): string {
  return path === home || path.startsWith(`${home}/`) ? `~${path.slice(home.length)}` : path
}

/**
 * Reads the `.agents/skills` and `.claude/skills` folders from a document's folder up to its
 * repository, as Claude Code and pi read a project's skills; nearer folders come first.
 */
export async function readProjectSkills(
  documentDir: string,
  home: string,
  reader: ProjectSkillReader
): Promise<ProjectSkillScan> {
  const found = v.safeParse(
    skillsFoldersSchema,
    await reader.skillsFolders(documentDir).catch(() => [])
  )
  const folders = (found.success ? found.output : []).map((path) => ({
    path,
    location: displayPath(path, home)
  }))
  const scans = await Promise.all(
    folders.map(async (folder) =>
      skillsFromFolders(
        'project',
        folder.location,
        await readSkillFolders(reader, folder.path),
        reader.readFile,
        folder.path
      )
    )
  )
  return {
    folders,
    skills: scans.flatMap((scan) => scan.skills),
    problems: scans.flatMap((scan) => scan.problems)
  }
}

/** The desktop's reader, through the shell's skill commands. */
export async function nativeProjectSkillReader(home: HomeSkillReader): Promise<ProjectSkillReader> {
  return { ...home, skillsFolders: (dir) => invoke<unknown>('project_skill_folders', { dir }) }
}
