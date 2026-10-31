import { dirname, homeDir } from '@tauri-apps/api/path'
import { computed, shallowRef } from 'vue'

import { IS_TAURI } from '@open-pencil/core/constants'

import { getActiveEditorStoreOrNull } from '@/app/editor/active-store'

import { enabledSkillsFrom, skillPreferences } from './preferences'
import { nativeHomeSkillReader, readHomeSkills } from './sources/home'
import {
  nativeProjectSkillReader,
  readProjectSkills,
  type ProjectSkillsFolder
} from './sources/project'
import {
  createIDBUploadedSkillStore,
  skillFromUpload,
  skillsFromUploads,
  type SkillUpload,
  type UploadedSkillStore
} from './sources/uploaded'
import type { Skill, SkillScan } from './types'

/** What the chat needs from skills: a fresh read before a message, then the enabled list. */
export interface SkillLibrary {
  refresh: () => Promise<void>
  enabled: () => readonly Skill[]
}

/** Every skill found, and the folders that failed, from the last read. */
export const foundSkills = shallowRef<SkillScan>({ skills: [], problems: [] })

/** The skills folders near the open document, from the last read. */
export const projectSkillsFolders = shallowRef<ProjectSkillsFolder[]>([])

export const enabledSkills = computed(() =>
  enabledSkillsFrom(foundSkills.value.skills, skillPreferences.value)
)

let uploads: UploadedSkillStore | null = null
function uploadedSkillStore(): UploadedSkillStore {
  uploads ??= createIDBUploadedSkillStore()
  return uploads
}

const NO_SKILLS: SkillScan = { skills: [], problems: [] }

/** The folders around the open document, then the user's own; the browser has neither. */
async function readFolders(): Promise<{ project: SkillScan; home: SkillScan }> {
  if (!IS_TAURI) {
    projectSkillsFolders.value = []
    return { project: NO_SKILLS, home: NO_SKILLS }
  }
  const home = await homeDir()
  const reader = await nativeHomeSkillReader()
  const documentPath = getActiveEditorStoreOrNull()?.getDocumentFilePath() ?? null
  const [project, homeSkills] = await Promise.all([
    documentPath
      ? readProjectSkills(await dirname(documentPath), home, await nativeProjectSkillReader(reader))
      : null,
    readHomeSkills(home, reader)
  ])
  projectSkillsFolders.value = project?.folders ?? []
  return { project: project ?? NO_SKILLS, home: homeSkills }
}

let reading: Promise<void> | null = null
/** Counts refresh requests, so a read knows whether another came in while it ran. */
let requests = 0

/**
 * Reads uploaded skills and the skill folders again. A repeated name resolves to the first:
 * uploads, then the document's folders, nearest first, then the user's own, as project skills
 * win over personal ones in Claude Code and pi.
 */
export function refreshSkills(): Promise<void> {
  // A caller that arrives mid-read, such as one that just saved an upload, gets a read that
  // starts after it did, not the one already under way.
  requests += 1
  if (reading) return reading
  reading = (async () => {
    try {
      let read: number
      do {
        read = requests
        await readSkills()
      } while (requests !== read)
    } finally {
      reading = null
    }
  })()
  return reading
}

async function readSkills(): Promise<void> {
  try {
    const [uploaded, { project, home }] = await Promise.all([
      uploadedSkillStore().list().then(skillsFromUploads),
      readFolders()
    ])
    foundSkills.value = {
      skills: [...uploaded.skills, ...project.skills, ...home.skills],
      problems: [...uploaded.problems, ...project.problems, ...home.problems]
    }
  } catch (error) {
    // The last read stays, so a message never fails over a folder, except the skills next to
    // the document, which may belong to one no longer open.
    console.warn('Could not read skills', error)
    projectSkillsFolders.value = []
    const { skills, problems } = foundSkills.value
    foundSkills.value = {
      skills: skills.filter((skill) => skill.source !== 'project'),
      problems: problems.filter((problem) => problem.source !== 'project')
    }
  }
}

/** Keeps a picked file as a skill when it is one, replacing an upload with the same name. */
export async function uploadSkill(file: File): Promise<SkillUpload> {
  const upload = await skillFromUpload(file)
  if (upload.ok) {
    await uploadedSkillStore().put(upload.skill)
    await refreshSkills()
  }
  return upload
}

export async function removeUploadedSkill(name: string): Promise<void> {
  await uploadedSkillStore().remove(name)
  // Gone at once, even if the read that follows fails and keeps the rest of the last one.
  const { skills, problems } = foundSkills.value
  const removed = (entry: { source: string; location: string }) =>
    entry.source === 'openpencil' && entry.location === name
  foundSkills.value = {
    skills: skills.filter((skill) => !removed(skill)),
    problems: problems.filter((problem) => !removed(problem))
  }
  await refreshSkills()
}

export const appSkillLibrary: SkillLibrary = {
  refresh: refreshSkills,
  enabled: () => enabledSkills.value
}
