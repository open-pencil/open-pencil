import { compact } from 'es-toolkit/array'
import * as v from 'valibot'

import { projectSchema, type Project } from './schema'

/**
 * Projects come back from storage written by an older build or edited by hand, so every record
 * is validated on read and a broken one is dropped instead of taking the list down with it.
 */
export function parseProjects(stored: unknown): Project[] {
  if (!Array.isArray(stored)) return []
  return compact(
    stored.map((entry) => {
      const parsed = v.safeParse(projectSchema, entry)
      return parsed.success ? parsed.output : undefined
    })
  )
}

/**
 * The records this build cannot read, kept as they were written. A build older than the schema, or
 * one that writes a newer field, would otherwise lose them on the next rename of another project.
 */
export function unreadableProjects(stored: unknown): unknown[] {
  if (!Array.isArray(stored)) return []
  return stored.filter((entry) => !v.safeParse(projectSchema, entry).success)
}

/** The list as it is stored: this build's projects, then the records it could not read. */
export function storedProjects(list: readonly Project[], previous: unknown): unknown[] {
  return [...list, ...unreadableProjects(previous)]
}

/** Add a project, or replace the record with its id so one repository never appears twice. */
export function addProject(list: readonly Project[], project: Project): Project[] {
  const existing = list.findIndex((entry) => entry.id === project.id)
  if (existing === -1) return [...list, project]
  return list.map((entry, index) => (index === existing ? project : entry))
}

export function removeProject(list: readonly Project[], id: string): Project[] {
  return list.filter((entry) => entry.id !== id)
}

/** Rename a project; an empty name leaves the record as it was rather than clearing it. */
export function renameProject(list: readonly Project[], id: string, name: string): Project[] {
  const trimmed = name.trim()
  if (trimmed === '') return [...list]
  return list.map((entry) => (entry.id === id ? { ...entry, name: trimmed } : entry))
}

/** Point a project at the application it starts, keeping one entry per repository. */
export function configureProject(
  list: readonly Project[],
  id: string,
  changes: Partial<Pick<Project, 'appDirectory' | 'startCommand' | 'startUrl'>>
): Project[] {
  return list.map((entry) => (entry.id === id ? { ...entry, ...changes } : entry))
}
