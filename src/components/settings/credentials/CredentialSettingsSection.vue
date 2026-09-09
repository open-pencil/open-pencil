<script setup lang="ts">
import { useI18n } from '@open-pencil/vue'
import { IS_TAURI } from '@open-pencil/core/constants'
import { useCredentialSettings } from '@/app/settings/credentials/preferences/use'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import SettingsSectionHeader from '@/components/settings/layout/SettingsSectionHeader.vue'

const { credentials } = useI18n()
const { busy, paused, failed, checkFailed, remembered, retry, retryCheck } = useCredentialSettings()
</script>

<template>
  <template v-if="!IS_TAURI || paused || failed || checkFailed">
    <SettingsSectionHeader>{{ credentials.settingsTitle }}</SettingsSectionHeader>
    <SettingsGroup>
      <label v-if="!IS_TAURI" class="flex items-center justify-between gap-4 px-3 py-2.5">
        <span>
          <span class="block text-xs text-surface">{{ credentials.rememberDevice }}</span>
          <span v-if="!remembered" class="block text-[11px] text-muted">{{
            credentials.sessionOnly
          }}</span>
        </span>
        <AppSwitch v-model="remembered" :label="credentials.rememberDevice" />
      </label>
      <div v-if="checkFailed" class="flex items-center justify-between gap-4 px-3 py-2.5">
        <span role="status" class="text-xs text-surface">{{ credentials.checkFailed }}</span>
        <AppButton size="xs" variant="ghost" :disabled="busy" @click="retryCheck">{{
          credentials.retryCheck
        }}</AppButton>
      </div>
      <div v-else-if="paused" class="flex items-center justify-between gap-4 px-3 py-2.5">
        <span class="text-xs text-surface">{{ credentials.accessPaused }}</span>
        <AppButton size="xs" variant="ghost" :disabled="busy" @click="retry">{{
          credentials.retryAccess
        }}</AppButton>
      </div>
      <p v-if="failed" role="status" class="px-3 py-2 text-xs text-muted">
        {{ credentials.retryFailed }}
      </p>
    </SettingsGroup>
  </template>
</template>
