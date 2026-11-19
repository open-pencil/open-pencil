import { computed, ref, shallowRef, watch } from 'vue'

import { IS_TAURI } from '@open-pencil/core/constants'

import {
  enabledSkills,
  foundSkills,
  projectSkillsFolders,
  refreshSkills,
  removeUploadedSkill,
  uploadSkill
} from '../library'
import {
  isSkillEnabled,
  isSkillsFolderTrusted,
  isSkillSourceEnabled,
  skillPreferenceKey,
  skillPreferences
} from '../preferences'
import { HOME_SKILL_SOURCES } from '../sources/home'
import type { SkillUploadFailure } from '../sources/uploaded'
import type { Skill, SkillProblem, SkillSourceID } from '../types'
import { requestedSkill } from './request'

export interface SkillListEntry {
  skill: Skill
  enabled: boolean
  /** On, but another source's skill with the same name is offered instead. */
  shadowed: boolean
  /** Off because its folder is near the document and not trusted yet. */
  untrusted: boolean
}

/** The skill the details show, with whether its source is on. */
export interface SelectedSkill extends SkillListEntry {
  sourceEnabled: boolean
}

export interface SkillSourceGroup {
  key: string
  source: SkillSourceID
  /** The folder it reads, as the user sees it; null for uploads. */
  folder: string | null
  /** On for the chat: switched on, or, for a folder near the document, trusted. */
  enabled: boolean
  /** The path of a folder near the document, which the user trusts instead of switching on. */
  trustPath: string | null
  skills: SkillListEntry[]
  problems: SkillProblem[]
}

/** The folders other agents keep, read only on the desktop. */
const HOME_SOURCES: readonly { source: SkillSourceID; folder: string }[] = IS_TAURI
  ? HOME_SKILL_SOURCES.map(({ id, folder }) => ({ source: id, folder: `~/${folder.join('/')}` }))
  : []

export function useSkillsSettings() {
  const loading = ref(true)
  const uploading = ref(false)
  const uploadFailure = shallowRef<SkillUploadFailure | null>(null)
  const selectedKey = ref<string | null>(null)
  /** The details stay on the skill they showed while they slide away. */
  const detailOpen = ref(false)

  const groups = computed<SkillSourceGroup[]>(() => {
    const preferences = skillPreferences.value
    const offered = new Set(enabledSkills.value)
    const { skills, problems } = foundSkills.value
    const group = (
      base: Pick<SkillSourceGroup, 'key' | 'source' | 'folder' | 'enabled' | 'trustPath'>,
      belongs: (entry: Skill | SkillProblem) => boolean
    ): SkillSourceGroup => ({
      ...base,
      skills: skills.filter(belongs).map((skill) => {
        const enabled = isSkillEnabled(skill, preferences)
        const untrusted =
          skill.skillsFolder !== undefined &&
          !isSkillsFolderTrusted(skill.skillsFolder, preferences)
        return { skill, enabled, shadowed: enabled && !offered.has(skill), untrusted }
      }),
      problems: problems.filter(belongs)
    })
    const source = (id: SkillSourceID, folder: string | null) =>
      group(
        {
          key: id,
          source: id,
          folder,
          enabled: isSkillSourceEnabled(id, preferences),
          trustPath: null
        },
        (entry) => entry.source === id
      )
    // Uploads, the document's folders, then the user's: the order a repeated name resolves in.
    return [
      source('openpencil', null),
      ...projectSkillsFolders.value.map(({ path, location }) =>
        group(
          {
            key: path,
            source: 'project',
            folder: location,
            enabled: isSkillsFolderTrusted(path, preferences),
            trustPath: path
          },
          (entry) => entry.skillsFolder === path
        )
      ),
      ...HOME_SOURCES.map(({ source: id, folder }) => source(id, folder))
    ]
  })

  const selected = computed<SelectedSkill | null>(() => {
    const key = selectedKey.value
    if (key === null) return null
    for (const group of groups.value) {
      const entry = group.skills.find(({ skill }) => skillPreferenceKey(skill) === key)
      if (entry) return { ...entry, sourceEnabled: group.enabled }
    }
    return null
  })

  async function reload() {
    loading.value = true
    try {
      await refreshSkills()
    } finally {
      loading.value = false
    }
  }

  /** The whole source, every skill in it included, as against the skills picked in AI setup. */
  function setSourceEnabled(source: SkillSourceID, enabled: boolean) {
    const preferences = skillPreferences.value
    skillPreferences.value = {
      ...preferences,
      sources: { ...preferences.sources, [source]: enabled },
      pickedSources: { ...preferences.pickedSources, [source]: false }
    }
  }

  function setFolderTrusted(path: string, trusted: boolean) {
    const preferences = skillPreferences.value
    skillPreferences.value = {
      ...preferences,
      trustedFolders: { ...preferences.trustedFolders, [path]: trusted }
    }
  }

  function setSkillEnabled(skill: Skill, enabled: boolean) {
    const preferences = skillPreferences.value
    skillPreferences.value = {
      ...preferences,
      skills: { ...preferences.skills, [skillPreferenceKey(skill)]: enabled }
    }
  }

  async function upload(file: File) {
    uploading.value = true
    uploadFailure.value = null
    try {
      const result = await uploadSkill(file)
      if (!result.ok) uploadFailure.value = result
    } catch {
      uploadFailure.value = { reason: 'unreadable' }
    } finally {
      uploading.value = false
    }
  }

  function open(skill: Skill) {
    selectedKey.value = skillPreferenceKey(skill)
    detailOpen.value = true
  }

  function close() {
    detailOpen.value = false
  }

  function closed() {
    if (!detailOpen.value) selectedKey.value = null
  }

  async function remove(skill: Skill) {
    await removeUploadedSkill(skill.name)
    if (selectedKey.value === skillPreferenceKey(skill)) close()
  }

  /** Opens a requested skill once a read has found it: the one in use, else the first so named. */
  function openRequested() {
    const name = requestedSkill.value
    if (name === null || loading.value) return
    requestedSkill.value = null
    const entries = groups.value.flatMap((group) => group.skills)
    const entry =
      entries.find(({ skill }) => skill.name === name && enabledSkills.value.includes(skill)) ??
      entries.find(({ skill }) => skill.name === name)
    if (entry) open(entry.skill)
  }
  watch([requestedSkill, loading], openRequested)

  void reload()

  return {
    groups,
    loading,
    uploading,
    uploadFailure,
    selected,
    detailOpen,
    open,
    close,
    closed,
    reload,
    setSourceEnabled,
    setFolderTrusted,
    setSkillEnabled,
    upload,
    remove
  }
}
