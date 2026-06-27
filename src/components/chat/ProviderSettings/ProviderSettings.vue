<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { ref, watch } from 'vue'
import { useI18n } from '@open-pencil/vue'

import ProviderSettingsBody from '@/components/chat/ProviderSettings/ProviderSettingsBody.vue'
import { provideProviderSettings } from '@/components/chat/ProviderSettings/context'
import { providerSettingsOpenTick } from '@/app/ai/chat/use'
import { usePopoverUI } from '@/components/ui/popover'
import Tip from '@/components/ui/Tip.vue'

const { dialogs } = useI18n()
const cls = usePopoverUI({ content: 'isolate z-[51] w-64 p-3' })
const popoverOpen = ref(false)
const providerSettings = provideProviderSettings()

watch(providerSettingsOpenTick, () => {
  popoverOpen.value = true
})

watch(popoverOpen, (open, wasOpen) => {
  if (wasOpen && !open) providerSettings.save()
})

function isNestedSelectLayer(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return !!target.closest(
    '[role="listbox"], [role="combobox"], [data-reka-popper-content-wrapper], [data-reka-select-viewport]'
  )
}

function onDismissableOutside(e: Event) {
  const event = e as CustomEvent<{ originalEvent?: Event }>
  const target = event.detail?.originalEvent?.target ?? event.target
  if (isNestedSelectLayer(target)) {
    e.preventDefault()
  }
}
</script>

<template>
  <PopoverRoot v-model:open="popoverOpen">
    <Tip :label="dialogs.providerSettings" :disabled="popoverOpen">
      <PopoverTrigger as-child>
        <button
          data-test-id="provider-settings-trigger"
          class="rounded p-0.5 text-muted hover:bg-hover hover:text-surface"
        >
          <icon-lucide-settings class="size-3" />
        </button>
      </PopoverTrigger>
    </Tip>

    <PopoverPortal>
      <PopoverContent
        side="top"
        :side-offset="8"
        align="end"
        :collision-padding="16"
        :avoid-collisions="true"
        :class="cls.content"
        @pointer-down-outside="onDismissableOutside"
        @interact-outside="onDismissableOutside"
        @focus-outside="onDismissableOutside"
      >
        <ProviderSettingsBody />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
