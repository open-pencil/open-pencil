<script setup lang="ts">
import ProviderConnectionTestButton from '@/components/chat/ProviderConnectionTestButton.vue'
import { useProviderSettingsContext } from '@/components/chat/ProviderSettings/context'

const ctx = useProviderSettingsContext()
</script>

<template>
  <ProviderConnectionTestButton
    v-if="!ctx.isACP"
    :status="ctx.connectionTestStatus"
    :reason="ctx.connectionTestReason"
    :disabled="!ctx.canTestConnection"
    @test="ctx.testConnection"
  />
</template>
