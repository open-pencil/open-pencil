<script setup lang="ts">
import type { StorageLimitReachedPayload } from '../schema'
import BrandEmail from './BrandEmail.vue'
import EmailText from './EmailText.vue'
import { greeting, useEmailLocalization } from './localization'

/** The account holds all the storage its plan includes, so its workspaces are read-only. */
const { payload } = defineProps<{ payload: StorageLimitReachedPayload }>()

const localization = useEmailLocalization()
const { t, storage } = localization
const amounts = { used: storage(payload.usedBytes), limit: storage(payload.limitBytes) }
</script>

<template>
  <BrandEmail
    :preview="t.storageFullPreview(amounts)"
    :heading="t.storageFullHeading"
    :action="{
      label: payload.upgradable ? t.storageFullAction : t.openCloud,
      url: payload.actionURL
    }"
  >
    <EmailText>{{ greeting(localization, payload.name) }}</EmailText>
    <EmailText>{{ t.storageFull(amounts) }}</EmailText>
    <EmailText>{{ payload.upgradable ? t.storageFullUpgrade : t.storageFullFreeSpace }}</EmailText>
  </BrandEmail>
</template>
