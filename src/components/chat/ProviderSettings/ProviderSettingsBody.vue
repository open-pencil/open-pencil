<script setup lang="ts">
import { PopoverClose } from 'reka-ui'
import { useI18n } from '@open-pencil/vue'

import ApiKeySection from '@/components/chat/ProviderSettings/ApiKeySection.vue'
import ApiTypeSection from '@/components/chat/ProviderSettings/ApiTypeSection.vue'
import CustomEndpointSection from '@/components/chat/ProviderSettings/CustomEndpointSection.vue'
import MaxTokensSection from '@/components/chat/ProviderSettings/MaxTokensSection.vue'
import ProviderSelectField from '@/components/chat/ProviderSelect/ProviderSelectField.vue'
import StockPhotoKeysSection from '@/components/chat/ProviderSettings/StockPhotoKeysSection.vue'
import VectorizeSection from '@/components/chat/ProviderSettings/VectorizeSection.vue'
import { useProviderSettingsContext } from '@/components/chat/ProviderSettings/context'

const { doneAsPopoverClose = true } = defineProps<{
  /** When false, render a plain button (e.g. inside DialogClose). */
  doneAsPopoverClose?: boolean
}>()

const emit = defineEmits<{
  done: []
}>()

const { dialogs } = useI18n()
const providerSettings = useProviderSettingsContext()

function onDone() {
  providerSettings.save()
  emit('done')
}
</script>

<template>
  <div class="flex flex-col gap-2.5">
    <h3 class="text-[11px] font-semibold text-surface">{{ dialogs.aiProvider }}</h3>
    <ProviderSelectField test-id="provider-settings-provider" />
    <ApiKeySection />
    <MaxTokensSection />
    <StockPhotoKeysSection />
    <CustomEndpointSection />
    <ApiTypeSection />
    <VectorizeSection />

    <PopoverClose
      v-if="doneAsPopoverClose"
      class="mt-1 w-full rounded bg-accent px-2 py-1 text-center text-[11px] font-medium text-white hover:bg-accent/90"
      data-test-id="provider-settings-done"
      @click="onDone"
    >
      {{ dialogs.done }}
    </PopoverClose>
    <button
      v-else
      type="button"
      class="mt-1 w-full rounded bg-accent px-2 py-1 text-center text-[11px] font-medium text-white hover:bg-accent/90"
      data-test-id="provider-settings-done"
      @click="onDone"
    >
      {{ dialogs.done }}
    </button>
  </div>
</template>
