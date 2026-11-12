<script setup lang="ts">
import { useFileDialog } from '@vueuse/core'
import { AlertDialogAction, AlertDialogCancel } from 'reka-ui'
import { computed, ref } from 'vue'

import { IS_TAURI } from '@open-pencil/core/constants'
import { useAIMessages, useCommonMessages, useSettingsMessages } from '@open-pencil/vue/i18n'

import { skillPreferenceKey } from '@/app/ai/skills/preferences'
import { useSkillsSettings, type SkillSourceGroup } from '@/app/ai/skills/settings/use'
import type { Skill, SkillSourceID } from '@/app/ai/skills/types'
import { useSettingsFormGuard } from '@/app/settings/navigation/use'
import CapabilityList from '@/components/settings/capability/CapabilityList.vue'
import CapabilityPage from '@/components/settings/capability/CapabilityPage.vue'
import { filterCapabilities } from '@/components/settings/capability/filter'
import type {
  CapabilityFilter,
  CapabilityGroup,
  CapabilityItem
} from '@/components/settings/capability/types'
import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import { AppAlertDialogRoot, AppDialogFooter, AppDialogHeader } from '@/components/ui/dialog'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppPlaceholder from '@/components/ui/feedback/AppPlaceholder.vue'
import PanelDrillIn from '@/components/ui/panel/PanelDrillIn.vue'

import { useSkillMessages } from './messages'
import SkillDetails from './SkillDetails.vue'

/** Skills as Tool access lists tools: a group per source with its switch, a switch per skill. */
const ai = useAIMessages()
const common = useCommonMessages()
const settings = useSettingsMessages()
const messages = useSkillMessages()
const skills = useSkillsSettings()
const { groups, loading, uploading, uploadFailure, selected, detailOpen } = skills
const search = ref('')
const show = ref<CapabilityFilter>('all')
const expanded = ref<Record<string, boolean>>({})
const deleteOpen = ref(false)
const trustOpen = ref(false)
/** The folder near the document the person is asked to trust; kept while the dialog closes. */
const trusting = ref<SkillSourceGroup | null>(null)
const removing = ref(false)

useSettingsFormGuard(
  {
    dirty: computed(() => false),
    busy: removing,
    cancel: skills.close,
    crumb: { parent: () => settings.value.skills, title: () => selected.value?.skill.name ?? '' }
  },
  detailOpen
)

const fileDialog = useFileDialog({
  accept: '.zip,.md,application/zip,text/markdown',
  multiple: false,
  reset: true
})
fileDialog.onChange((files) => {
  const file = files?.[0]
  if (file) void skills.upload(file)
})

const SOURCE_TITLES: Record<SkillSourceID, () => string> = {
  openpencil: () => ai.value.skillsUploadedSource,
  project: () => ai.value.skillsProjectSource,
  agents: () => ai.value.skillsAgentsSource,
  claude: () => ai.value.skillsClaudeSource
}

function matches(skill: Skill, query: string): boolean {
  return `${skill.name} ${skill.description}`.toLowerCase().includes(query)
}

const listGroups = computed<CapabilityGroup[]>(() => {
  const query = search.value.trim().toLowerCase()
  const all = groups.value.map((group): CapabilityGroup => ({
    key: group.key,
    label: SOURCE_TITLES[group.source](),
    ...(group.folder && { detail: group.folder }),
    ...(group.skills.length > 0 && {
      count: ai.value.skillsEnabledCount({
        enabled: group.skills.filter((entry) => entry.enabled).length,
        total: group.skills.length
      })
    }),
    // A folder next to the document is trusted rather than switched on.
    toggle: group.trustPath ? null : { enabled: group.enabled, state: 'idle' },
    items: group.skills
      .filter((entry) => !query || matches(entry.skill, query))
      .map((entry): CapabilityItem => ({
        key: skillPreferenceKey(entry.skill),
        name: entry.skill.name,
        description: entry.skill.description,
        enabled: entry.enabled,
        locked: !group.enabled,
        ...(entry.untrusted && { note: ai.value.skillsNotTrusted }),
        ...(entry.shadowed && { note: ai.value.skillsNotUsed })
      })),
    ...(!query && { empty: group.folder ? ai.value.skillsNoneInFolder : ai.value.skillsNoUploads })
  }))
  return filterCapabilities(all, show.value)
})

// Without a search or filter, empty groups say why they are empty instead.
const hasMatches = computed(
  () =>
    (!search.value.trim() && show.value === 'all') ||
    listGroups.value.some((group) => group.items.length)
)

const hasProblems = computed(() => groups.value.some((group) => group.problems.length))

function sourceGroup(key: string): SkillSourceGroup | undefined {
  return groups.value.find((group) => group.key === key)
}

function find(groupKey: string, itemKey: string): Skill | undefined {
  return sourceGroup(groupKey)?.skills.find(({ skill }) => skillPreferenceKey(skill) === itemKey)
    ?.skill
}

function setGroup(groupKey: string, enabled: boolean) {
  const group = sourceGroup(groupKey)
  if (group && !group.trustPath) skills.setSourceEnabled(group.source, enabled)
}

function setItem(groupKey: string, itemKey: string, enabled: boolean) {
  const skill = find(groupKey, itemKey)
  if (skill) skills.setSkillEnabled(skill, enabled)
}

function open(groupKey: string, itemKey: string) {
  const skill = find(groupKey, itemKey)
  if (skill) skills.open(skill)
}

const trustDescription = computed(() =>
  ai.value.skillsTrustDescription({ folder: trusting.value?.folder ?? '' })
)

function askTrust(groupKey: string) {
  const group = sourceGroup(groupKey)
  if (!group) return
  trusting.value = group
  trustOpen.value = true
}

function stopTrusting(groupKey: string) {
  const path = sourceGroup(groupKey)?.trustPath
  if (path) skills.setFolderTrusted(path, false)
}

function trust() {
  if (trusting.value?.trustPath) skills.setFolderTrusted(trusting.value.trustPath, true)
  trustOpen.value = false
}

const deleteDescription = computed(() =>
  ai.value.skillsDeleteDescription({ name: selected.value?.skill.name ?? '' })
)

async function remove() {
  const skill = selected.value?.skill
  removing.value = true
  try {
    if (skill) await skills.remove(skill)
  } finally {
    removing.value = false
    deleteOpen.value = false
  }
}
</script>

<template>
  <PanelDrillIn :open="detailOpen" data-test-id="settings-skills-panel" @closed="skills.closed">
    <template #detail>
      <SkillDetails
        v-if="selected"
        :entry="selected"
        @done="skills.close"
        @remove="deleteOpen = true"
        @set-enabled="skills.setSkillEnabled(selected.skill, $event)"
      />
    </template>
    <CapabilityPage
      v-model:search="search"
      v-model:show="show"
      :search-label="ai.searchSkills"
      :aria-busy="loading"
    >
      <template #description>{{ ai.skillsDescription }}</template>
      <template #actions>
        <AppButton color="primary" variant="solid" :loading="uploading" @click="fileDialog.open()">
          <template #leading><icon-lucide-upload class="size-3.5" /></template>
          {{ ai.skillsUpload }}
        </AppButton>
      </template>
      <template v-if="IS_TAURI" #tools>
        <IconButton :label="common.refresh" :disabled="loading" @click="skills.reload">
          <icon-lucide-refresh-cw class="size-3.5" :class="loading && 'motion-safe:animate-spin'" />
        </IconButton>
      </template>
      <div v-if="uploadFailure || hasProblems" class="flex flex-col gap-2">
        <AppAlert
          v-if="uploadFailure"
          tone="error"
          :heading="ai.skillsUploadFailed"
          :description="messages.uploadFailure(uploadFailure)"
        />
        <template v-for="group in groups" :key="group.key">
          <AppAlert v-if="group.problems.length" tone="warning" :heading="ai.skillsProblems">
            <ul class="flex flex-col gap-0.5">
              <li v-for="problem in group.problems" :key="problem.location">
                <code>{{ problem.location }}</code
                >: {{ messages.error(problem.error) }}
              </li>
            </ul>
          </AppAlert>
        </template>
      </div>
      <AppPlaceholder
        v-if="!hasMatches"
        size="compact"
        :fill="false"
        :label="ai.noMatchingSkills"
      />
      <CapabilityList
        v-else
        :groups="listGroups"
        :expanded="expanded"
        :open-label="(item) => ai.openSkillSettings({ name: item.name })"
        @update:expanded="(key, isOpen) => (expanded = { ...expanded, [key]: isOpen })"
        @set-group="setGroup"
        @set-item="setItem"
        @open="open"
      >
        <template #group-actions="{ group }">
          <template v-if="sourceGroup(group.key)?.trustPath">
            <AppButton
              v-if="sourceGroup(group.key)?.enabled"
              size="xs"
              variant="link"
              @click.stop="stopTrusting(group.key)"
            >
              {{ ai.skillsStopTrusting }}
            </AppButton>
            <AppButton v-else size="xs" variant="outline" @click.stop="askTrust(group.key)">
              <template #leading><icon-lucide-shield-check class="size-3.5" /></template>
              {{ ai.skillsTrustFolder }}
            </AppButton>
          </template>
        </template>
      </CapabilityList>
    </CapabilityPage>
  </PanelDrillIn>
  <AppAlertDialogRoot v-model:open="trustOpen">
    <AppDialogHeader
      :heading="ai.skillsTrustTitle"
      :description="trustDescription"
      :show-close="false"
    />
    <AppDialogFooter>
      <AlertDialogCancel as-child>
        <AppButton>{{ common.cancel }}</AppButton>
      </AlertDialogCancel>
      <AlertDialogAction as-child>
        <AppButton color="primary" variant="solid" @click="trust">
          {{ ai.skillsTrustFolder }}
        </AppButton>
      </AlertDialogAction>
    </AppDialogFooter>
  </AppAlertDialogRoot>
  <AppAlertDialogRoot v-model:open="deleteOpen">
    <AppDialogHeader
      :heading="ai.skillsDelete"
      :description="deleteDescription"
      :show-close="false"
    />
    <AppDialogFooter>
      <AlertDialogCancel as-child>
        <AppButton>{{ common.cancel }}</AppButton>
      </AlertDialogCancel>
      <AlertDialogAction as-child>
        <AppButton color="error" variant="solid" :loading="removing" @click="remove">
          {{ ai.skillsDelete }}
        </AppButton>
      </AlertDialogAction>
    </AppDialogFooter>
  </AppAlertDialogRoot>
</template>
