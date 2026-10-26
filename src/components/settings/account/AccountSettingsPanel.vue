<script setup lang="ts">
import { CloudSettingsSection } from '@/components/cloud/integration'
import CredentialSettingsSection from '@/components/settings/credentials/CredentialSettingsSection.vue'
import StorageSettingsPanel from '@/components/settings/storage/StorageSettingsPanel.vue'

import CollaborationNameSection from './CollaborationNameSection.vue'

/**
 * Who you are and where your work and secrets live: Cloud servers, the name collaborators see,
 * storage locations, and how keys are kept. Storage's editor slides over the whole page.
 */
</script>

<template>
  <StorageSettingsPanel>
    <CloudSettingsSection />
    <CollaborationNameSection />
    <template #after><CredentialSettingsSection /></template>
  </StorageSettingsPanel>
</template>
