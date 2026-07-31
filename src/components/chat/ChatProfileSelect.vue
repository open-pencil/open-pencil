<script setup lang="ts">
import { computed } from 'vue'
import {
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectViewport
} from 'reka-ui'

import { useI18n } from '@open-pencil/vue'

import { aiModelSettings, setModelRoleAssignment } from '@/app/ai/models'
import type { AIModelProfileId } from '@/app/ai/models'
import AppBadge from '@/components/ui/AppBadge.vue'
import { useSelectUI } from '@/components/ui/select'

const { dialogs } = useI18n()

// Only profiles that can drive the design agent — setModelRoleAssignment rejects the rest.
const profiles = computed(() =>
  aiModelSettings.value.models.filter((profile) => profile.capabilities.includes('tools'))
)

const selectedProfileId = computed({
  get: () => aiModelSettings.value.assignments.design,
  set: (profileId: AIModelProfileId) => setModelRoleAssignment('design', profileId)
})

const selectCls = useSelectUI({
  trigger: 'gap-1 rounded border-none bg-transparent px-1.5 py-0.5 text-[10px] text-muted',
  content: 'max-h-60 overflow-y-auto',
  item: 'gap-2 rounded px-2 py-1.5 text-[11px]'
})
</script>

<template>
  <SelectRoot v-model="selectedProfileId">
    <SelectTrigger
      data-test-id="chat-profile-selector"
      :aria-label="dialogs.models"
      :class="selectCls.trigger"
    >
      <icon-lucide-bot class="size-3" />
      <slot name="value" />
      <icon-lucide-chevron-down class="size-2.5" />
    </SelectTrigger>
    <SelectPortal>
      <SelectContent position="popper" side="top" :side-offset="4" :class="selectCls.content">
        <SelectViewport>
          <SelectItem
            v-for="profile in profiles"
            :key="profile.id"
            :value="profile.id"
            :class="selectCls.item"
          >
            <SelectItemText class="flex-1">{{ profile.name }}</SelectItemText>
            <AppBadge v-if="profile.capabilities.includes('vision')">
              {{ dialogs.modelCapabilityVisionShort }}
            </AppBadge>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
