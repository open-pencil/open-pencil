<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue/i18n'

import type { ProfileSignInStatus } from '@/app/ai/models/settings/profile-editor/sign-in'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'

/** A ChatGPT connection's credential: a sign-in saved earlier, one made now, or none. */
const {
  saved,
  signedIn,
  email,
  status = 'idle',
  disabled = false
} = defineProps<{
  saved: boolean
  signedIn: boolean
  email?: string
  status?: ProfileSignInStatus
  disabled?: boolean
}>()
const emit = defineEmits<{ signIn: []; reopen: []; cancel: []; signOut: [] }>()
const { ai, common } = useI18n()

const failure = computed(() => {
  if (status === 'cancelled') return ai.value.aiSetupSignInCancelled
  if (status === 'expired') return ai.value.aiSetupSignInExpired
  if (status === 'port-in-use') return ai.value.aiSetupChatGPTPortInUse
  if (status === 'failed') return ai.value.aiSetupChatGPTFailed
  return null
})
</script>

<template>
  <div class="flex flex-col gap-2" data-test-id="settings-chatgpt-sign-in">
    <p class="text-[11px] text-muted">{{ ai.aiSetupChatGPTUsage }}</p>
    <div v-if="status === 'waiting'" class="flex flex-wrap items-center gap-2">
      <p role="status" class="flex items-center gap-1.5 text-[11px] text-muted">
        <icon-lucide-loader-2 class="size-3.5 animate-spin" aria-hidden="true" />
        {{ ai.aiSetupChatGPTWaiting }}
      </p>
      <AppButton class="ml-auto" size="xs" variant="outline" @click="emit('reopen')">
        {{ ai.aiSetupSignInReopen }}
      </AppButton>
      <AppButton size="xs" @click="emit('cancel')">{{ common.cancel }}</AppButton>
    </div>
    <div v-else-if="signedIn || saved" class="flex flex-wrap items-center gap-2">
      <p role="status" class="flex items-center gap-1.5 text-[11px] text-surface">
        <icon-lucide-circle-check class="size-3.5 text-success" aria-hidden="true" />
        {{ ai.aiSetupChatGPTSignedInTitle }}
        <span v-if="email" class="text-muted">{{ email }}</span>
      </p>
      <AppButton class="ml-auto" size="xs" :disabled="disabled" @click="emit('signIn')">
        {{ ai.aiSetupSignInChange }}
      </AppButton>
      <AppButton size="xs" :disabled="disabled" @click="emit('signOut')">
        {{ ai.aiSetupSignOut }}
      </AppButton>
    </div>
    <AppButton
      v-else
      class="self-start"
      color="primary"
      variant="solid"
      :disabled="disabled"
      @click="emit('signIn')"
    >
      {{ ai.aiSetupChatGPTSignIn }}
    </AppButton>
    <AppAlert v-if="failure" tone="warning" :heading="failure" />
  </div>
</template>
