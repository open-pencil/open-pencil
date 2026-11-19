import { useLocalStorage } from '@vueuse/core'
import * as v from 'valibot'

import type { Skill, SkillSourceID } from './types'

const skillPreferencesSchema = v.object({
  sources: v.optional(v.record(v.string(), v.boolean()), {}),
  skills: v.optional(v.record(v.string(), v.boolean()), {}),
  trustedFolders: v.optional(v.record(v.string(), v.boolean()), {}),
  pickedSources: v.optional(v.record(v.string(), v.boolean()), {})
})

/**
 * The sources and skills the user turned on or off, and the skills folders near documents the
 * user trusts, where everything else is off. A source in `pickedSources` was turned on for the
 * skills picked from it, so a skill that appears there later stays off until picked too.
 */
export type SkillPreferences = v.InferOutput<typeof skillPreferencesSchema>

const storedPreferencesSchema = v.pipe(v.string(), v.parseJson(), skillPreferencesSchema)

export const skillPreferences = useLocalStorage<SkillPreferences>(
  'open-pencil:ai:skills',
  { sources: {}, skills: {}, trustedFolders: {}, pickedSources: {} },
  {
    serializer: {
      read: (raw) => {
        const result = v.safeParse(storedPreferencesSchema, raw)
        return result.success
          ? result.output
          : { sources: {}, skills: {}, trustedFolders: {}, pickedSources: {} }
      },
      write: JSON.stringify
    }
  }
)

/** A skill's toggle belongs to its source and folder, so the same name elsewhere keeps its own. */
export function skillPreferenceKey(skill: Pick<Skill, 'source' | 'name' | 'skillsFolder'>): string {
  return skill.skillsFolder === undefined
    ? `${skill.source}/${skill.name}`
    : `${skill.source}/${skill.skillsFolder}/${skill.name}`
}

/** A skills folder near a document runs nothing until the user trusts it. */
export function isSkillsFolderTrusted(path: string, preferences: SkillPreferences): boolean {
  return preferences.trustedFolders[path] ?? false
}

/**
 * Uploads and folders next to a document are chosen for design work; the folders coding agents
 * share hold their own workflows, such as releases or email, so they start off until picked.
 */
const SOURCES_ON_BY_DEFAULT: Record<SkillSourceID, boolean> = {
  openpencil: true,
  project: true,
  agents: false,
  claude: false
}

export function isSkillSourceEnabled(source: SkillSourceID, preferences: SkillPreferences) {
  return preferences.sources[source] ?? SOURCES_ON_BY_DEFAULT[source]
}

/**
 * Preferences that use exactly the picked skills among `offered`, from coding agents' folders:
 * a folder turns on when any of its skills is picked, and its other skills turn off.
 */
export function withPickedSkills(
  preferences: SkillPreferences,
  offered: readonly Skill[],
  picked: ReadonlySet<string>
): SkillPreferences {
  const sources = { ...preferences.sources }
  const skills = { ...preferences.skills }
  const pickedSources = { ...preferences.pickedSources }
  for (const skill of offered) {
    const key = skillPreferenceKey(skill)
    skills[key] = picked.has(key)
    if (!picked.has(key)) continue
    sources[skill.source] = true
    pickedSources[skill.source] = true
  }
  return { ...preferences, sources, skills, pickedSources }
}

export function isSkillEnabled(skill: Skill, preferences: SkillPreferences): boolean {
  return (
    isSkillSourceEnabled(skill.source, preferences) &&
    (skill.skillsFolder === undefined || isSkillsFolderTrusted(skill.skillsFolder, preferences)) &&
    (preferences.skills[skillPreferenceKey(skill)] ?? !preferences.pickedSources[skill.source])
  )
}

/**
 * The skills the chat offers: those switched on, the first of each name in source order, as
 * pi and Amp resolve a name found twice. Turning the first off lets the next one through.
 */
export function enabledSkillsFrom(
  skills: readonly Skill[],
  preferences: SkillPreferences
): Skill[] {
  const seen = new Set<string>()
  return skills.filter((skill) => {
    if (!isSkillEnabled(skill, preferences) || seen.has(skill.name)) return false
    seen.add(skill.name)
    return true
  })
}
