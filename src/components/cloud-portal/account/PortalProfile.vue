<script setup lang="ts">
import { useFileDialog } from '@vueuse/core'

import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import AccountAvatar from '@/components/presence/AccountAvatar.vue'
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import SettingsRow from '@/components/settings/layout/SettingsRow.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppCopyField from '@/components/ui/input/AppCopyField.vue'

/**
 * How a person appears on a Cloud server: their picture, changed beside it, their name and email,
 * each changed in a dialog, and the account ID an administrator asks for.
 */
const {
  profile,
  emailChangeAvailable = true,
  busy = false
} = defineProps<{
  profile: {
    id: string
    name: string
    email: string
    image: string | null
    memberSince: string
  }
  /** Whether the server can send the link a new address needs. */
  emailChangeAvailable?: boolean
  busy?: boolean
}>()
const emit = defineEmits<{
  changeName: []
  changeEmail: []
  choosePicture: [file: File]
  removePicture: []
}>()

const messages = useCloudPortalMessages()
const { open: pickPicture, onChange: onPicture } = useFileDialog({
  accept: 'image/png,image/jpeg,image/webp,image/gif',
  multiple: false,
  reset: true
})
onPicture((files) => {
  const file = files?.[0]
  if (file) emit('choosePicture', file)
})
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-6">
    <div class="flex items-center gap-3">
      <AccountAvatar :id="profile.id" :name="profile.name" :image="profile.image" size="lg" />
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-semibold text-surface">{{ profile.name }}</p>
        <p class="truncate text-xs text-muted">{{ profile.email }}</p>
        <p class="mt-0.5 text-[11px] text-muted">
          {{ messages.memberSince({ date: profile.memberSince }) }}
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <AppButton
          v-if="profile.image"
          size="sm"
          variant="ghost"
          :disabled="busy"
          @click="emit('removePicture')"
        >
          {{ messages.removePicture }}
        </AppButton>
        <AppButton size="sm" variant="outline" :disabled="busy" @click="pickPicture()">
          {{ profile.image ? messages.changePicture : messages.uploadPicture }}
        </AppButton>
      </div>
    </div>

    <SettingsSection>
      <template #title>{{ messages.detailsSection }}</template>
      <template #description>{{ messages.detailsSectionDescription }}</template>
      <SettingsGroup>
        <SettingsRow :label="messages.name" :description="profile.name">
          <AppButton size="sm" variant="outline" :disabled="busy" @click="emit('changeName')">
            {{ messages.changeName }}
          </AppButton>
        </SettingsRow>
        <SettingsRow
          :label="messages.email"
          :description="emailChangeAvailable ? profile.email : messages.emailChangeUnavailable"
        >
          <AppButton
            v-if="emailChangeAvailable"
            size="sm"
            variant="outline"
            :disabled="busy"
            @click="emit('changeEmail')"
          >
            {{ messages.changeEmail }}
          </AppButton>
        </SettingsRow>
      </SettingsGroup>
    </SettingsSection>

    <SettingsSection>
      <template #title>{{ messages.accountId }}</template>
      <template #description>{{ messages.accountIdDescription }}</template>
      <AppCopyField
        :value="profile.id"
        :copy-label="messages.copy"
        :copied-label="messages.copied"
      />
    </SettingsSection>
  </div>
</template>
