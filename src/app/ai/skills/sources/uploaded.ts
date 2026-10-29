import { partition } from 'es-toolkit'
import { unzipSync } from 'fflate'
import type { DBSchema } from 'idb'

import { APP_DATABASE_NAMES, connectAppDatabase, defineAppDatabase } from '@/app/storage/idb'

import { isSkill, skillFromFolder } from '../folder'
import { parseSkill } from '../parse'
import type { SkillParseError, SkillScan } from '../types'

const SKILL_FILE = 'SKILL.md'
/** The same bounds the desktop applies to skill folders it reads. */
const MAX_ARCHIVE_BYTES = 10 * 1024 * 1024
const MAX_FILE_BYTES = 1024 * 1024
const MAX_FILES = 200
/** What an archive may unpack to; a few kilobytes of zeros can otherwise inflate to gigabytes. */
const MAX_UNPACKED_BYTES = 20 * 1024 * 1024

/** A text file in an uploaded skill, by its path inside the skill's folder. */
export interface StoredSkillFile {
  path: string
  content: string
}

/** An uploaded skill: its SKILL.md and its other text files. */
export interface StoredSkill {
  name: string
  skillFile: string
  files: StoredSkillFile[]
  uploadedAt: number
}

export type SkillUploadFailure =
  | { reason: 'too-large' }
  | { reason: 'no-skill' }
  | { reason: 'several-skills' }
  | { reason: 'unreadable' }
  | { reason: 'invalid'; error: SkillParseError }

export type SkillUpload = { ok: true; skill: StoredSkill } | ({ ok: false } & SkillUploadFailure)

/** A path OpenPencil keeps: no hidden or packaging folders, which skills never refer to. */
function isKeptPath(path: string): boolean {
  return path
    .split('/')
    .every((part) => part.length > 0 && !part.startsWith('.') && part !== '__MACOSX')
}

const textDecoder = new TextDecoder('utf-8', { fatal: true })

function decodeText(bytes: Uint8Array): string | null {
  try {
    return textDecoder.decode(bytes)
  } catch {
    return null
  }
}

/**
 * The skill an archive holds: one SKILL.md at its root or in one top folder, as Claude and
 * skill registries package them. Binary files are left out, since the chat reads only text.
 */
export function skillFromArchive(bytes: Uint8Array, uploadedAt: number): SkillUpload {
  if (bytes.byteLength > MAX_ARCHIVE_BYTES) return { ok: false, reason: 'too-large' }
  let entries: Record<string, Uint8Array>
  // Counted before anything inflates, from the sizes the archive declares.
  const unpacking = { kept: 0, bytes: 0, tooLarge: false }
  try {
    entries = unzipSync(bytes, {
      filter: (entry) => {
        if (unpacking.tooLarge || !isKeptPath(entry.name) || entry.originalSize > MAX_FILE_BYTES) {
          return false
        }
        unpacking.kept += 1
        unpacking.bytes += entry.originalSize
        unpacking.tooLarge = unpacking.kept > MAX_FILES + 1 || unpacking.bytes > MAX_UNPACKED_BYTES
        return !unpacking.tooLarge
      }
    })
  } catch {
    return { ok: false, reason: 'unreadable' }
  }
  if (unpacking.tooLarge) return { ok: false, reason: 'too-large' }
  const roots = Object.keys(entries)
    .filter((path) => path === SKILL_FILE || /^[^/]+\/SKILL\.md$/.test(path))
    .map((path) => path.slice(0, -SKILL_FILE.length))
  if (roots.length === 0) return { ok: false, reason: 'no-skill' }
  if (roots.length > 1) return { ok: false, reason: 'several-skills' }
  const [root = ''] = roots
  const skillFile = decodeText(entries[`${root}${SKILL_FILE}`] ?? new Uint8Array())
  if (skillFile === null) return { ok: false, reason: 'unreadable' }

  const files: StoredSkillFile[] = []
  for (const [path, content] of Object.entries(entries)) {
    if (!path.startsWith(root) || path === `${root}${SKILL_FILE}` || path.endsWith('/')) continue
    if (files.length >= MAX_FILES) break
    const text = decodeText(content)
    if (text !== null) files.push({ path: path.slice(root.length), content: text })
  }
  files.sort((a, b) => a.path.localeCompare(b.path))
  return storedSkill(skillFile, root ? root.slice(0, -1) : null, files, uploadedAt)
}

function storedSkill(
  skillFile: string,
  folder: string | null,
  files: StoredSkillFile[],
  uploadedAt: number
): SkillUpload {
  const parsed = parseSkill(skillFile, folder)
  if (!parsed.ok) return { ok: false, reason: 'invalid', error: parsed.error }
  return { ok: true, skill: { name: parsed.skill.name, skillFile, files, uploadedAt } }
}

/** A picked file as a skill: a ZIP of the folder, or a SKILL.md on its own. */
export async function skillFromUpload(file: File, uploadedAt = Date.now()): Promise<SkillUpload> {
  if (file.size > MAX_ARCHIVE_BYTES) return { ok: false, reason: 'too-large' }
  if (/\.zip$/i.test(file.name)) {
    return skillFromArchive(new Uint8Array(await file.arrayBuffer()), uploadedAt)
  }
  if (file.size > MAX_FILE_BYTES) return { ok: false, reason: 'too-large' }
  const text = decodeText(new Uint8Array(await file.arrayBuffer()))
  if (text === null) return { ok: false, reason: 'unreadable' }
  return storedSkill(text, null, [], uploadedAt)
}

/** Uploaded skills as the chat reads them; uploads are named by their skill's name. */
export function skillsFromUploads(stored: readonly StoredSkill[]): SkillScan {
  const [skills, problems] = partition(
    stored.map((upload) =>
      skillFromFolder({
        source: 'openpencil',
        // The name it was stored under stands in for a folder, which a SKILL.md may name itself by.
        folder: upload.name,
        location: upload.name,
        skillFile: upload.skillFile,
        files: upload.files.map((file) => file.path),
        readFile: async (path) => {
          const file = upload.files.find((candidate) => candidate.path === path)
          if (!file) throw new Error(`"${path}" is not in the skill.`)
          return file.content
        }
      })
    ),
    isSkill
  )
  return { skills, problems }
}

interface SkillsDatabase extends DBSchema {
  skills: { key: string; value: StoredSkill }
}

const skillsDatabase = defineAppDatabase<SkillsDatabase>({
  name: APP_DATABASE_NAMES.skills,
  version: 1,
  callbacks: {
    upgrade(database) {
      if (!database.objectStoreNames.contains('skills')) {
        database.createObjectStore('skills', { keyPath: 'name' })
      }
    }
  }
})

export interface UploadedSkillStore {
  list(): Promise<StoredSkill[]>
  /** Adds the skill, replacing an upload with the same name. */
  put(skill: StoredSkill): Promise<void>
  remove(name: string): Promise<void>
}

export function createIDBUploadedSkillStore(): UploadedSkillStore {
  const database = connectAppDatabase(skillsDatabase)
  return {
    async list() {
      return (await database.open()).getAll('skills')
    },
    async put(skill) {
      await (await database.open()).put('skills', skill)
    },
    async remove(name) {
      await (await database.open()).delete('skills', name)
    }
  }
}
