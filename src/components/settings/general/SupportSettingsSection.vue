<script setup lang="ts">
import { useI18n } from '@open-pencil/vue/i18n'

import { donate, DONATION_URL } from '@/app/donation'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppButton from '@/components/ui/button/AppButton.vue'

/** Donating from Settings, for builds whose repository names a donation page. */
const { diagnostics } = useI18n()
</script>

<template>
  <SettingsSection v-if="DONATION_URL" data-test-id="settings-support">
    <template #title>{{ diagnostics.supportTitle }}</template>
    <template #description>{{ diagnostics.supportDescription }}</template>
    <template #actions>
      <AppButton size="sm" color="primary" variant="solid" @click="donate('settings')">
        {{ diagnostics.supportDonate }}
      </AppButton>
    </template>
  </SettingsSection>
</template>
