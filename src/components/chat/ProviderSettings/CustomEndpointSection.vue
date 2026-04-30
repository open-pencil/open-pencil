<script setup lang="ts">
import { useInputUI } from '@/components/ui/input'
import { useProviderSettingsContext } from '@/components/chat/ProviderSettings/context'

const ctx = useProviderSettingsContext()
</script>

<template>
  <template v-if="!ctx.isACP">
    <div v-if="ctx.providerDef.supportsCustomBaseURL" class="flex flex-col gap-1">
      <label class="text-[10px] text-muted">Base URL</label>
      <input
        v-model="ctx.baseURLInput"
        type="text"
        data-test-id="provider-settings-base-url"
        placeholder="http://localhost:11434/v1"
        :class="useInputUI({ size: 'sm' }).base"
        @change="ctx.save"
      />
    </div>

    <div v-if="ctx.providerDef.supportsCustomModel" class="flex flex-col gap-1">
      <label class="text-[10px] text-muted">Model ID</label>
      <input
        v-model="ctx.customModelInput"
        type="text"
        data-test-id="provider-settings-custom-model"
        placeholder="e.g. llama-3.3-70b"
        :class="useInputUI({ size: 'sm' }).base"
        @change="ctx.save"
      />
    </div>
  </template>
</template>
