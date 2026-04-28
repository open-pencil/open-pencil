<script setup lang="ts">
import { PopoverClose, PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { ref } from 'vue'

import ApiKeySection from '@/components/chat/ProviderSettings/ApiKeySection.vue'
import ApiTypeSection from '@/components/chat/ProviderSettings/ApiTypeSection.vue'
import CustomEndpointSection from '@/components/chat/ProviderSettings/CustomEndpointSection.vue'
import MaxTokensSection from '@/components/chat/ProviderSettings/MaxTokensSection.vue'
import ProviderSelectField from '@/components/chat/ProviderSelect/ProviderSelectField.vue'
import StockPhotoKeysSection from '@/components/chat/ProviderSettings/StockPhotoKeysSection.vue'
import { provideProviderSettings } from '@/components/chat/ProviderSettings/context'
import { usePopoverUI } from '@/components/ui/popover'

const cls = usePopoverUI({ content: 'isolate z-[51] w-64 p-3' })
const popoverOpen = ref(false)
const providerSettings = provideProviderSettings()

function onInteractOutside(e: Event) {
  const target = e.target as HTMLElement | null
  if (target?.closest('[role=listbox], [data-reka-popper-content-wrapper]')) {
    e.preventDefault()
    return
  }
  providerSettings.save()
}
</script>

<template>
  <PopoverRoot @update:open="popoverOpen = $event">
    <PopoverTrigger
      data-test-id="provider-settings-trigger"
      class="rounded p-0.5 text-muted hover:bg-hover hover:text-surface"
      :title="popoverOpen ? undefined : 'Provider settings'"
    >
      <icon-lucide-settings class="size-3" />
    </PopoverTrigger>

    <PopoverPortal>
      <PopoverContent
        side="top"
        :side-offset="8"
        align="end"
        :collision-padding="16"
        :avoid-collisions="true"
        :class="cls.content"
        @interact-outside="onInteractOutside"
      >
        <div class="flex flex-col gap-2.5">
          <h3 class="text-[11px] font-semibold text-surface">AI Provider</h3>
          <ProviderSelectField test-id="provider-settings-provider" />
          <MaxTokensSection />
          <StockPhotoKeysSection />
          <CustomEndpointSection />
          <ApiTypeSection />
          <ApiKeySection />

          <PopoverClose
            class="mt-1 w-full rounded bg-accent px-2 py-1 text-center text-[11px] font-medium text-white hover:bg-accent/90"
            data-test-id="provider-settings-done"
            @click="providerSettings.save"
          >
            Done
          </PopoverClose>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
