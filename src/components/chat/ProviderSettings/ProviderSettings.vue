<script setup lang="ts">
import {
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger,
  TooltipContent,
  TooltipPortal,
  TooltipRoot,
  TooltipTrigger
} from 'reka-ui'
import { ref, watch } from 'vue'
import { useI18n } from '@open-pencil/vue'

import ProviderSettingsBody from '@/components/chat/ProviderSettings/ProviderSettingsBody.vue'
import { provideProviderSettings } from '@/components/chat/ProviderSettings/context'
import { providerSettingsOpenTick } from '@/app/ai/chat/use'
import { usePopoverUI } from '@/components/ui/popover'
import { useTooltipUI } from '@/components/ui/tooltip'

const { dialogs } = useI18n()
const cls = usePopoverUI({ content: 'isolate z-[51] w-64 p-3' })
const tooltipCls = useTooltipUI({ content: 'animate-in zoom-in-95 fade-in' })
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
  <TooltipRoot :open="popoverOpen ? false : undefined">
    <PopoverRoot v-model:open="popoverOpen">
      <TooltipTrigger as-child>
        <PopoverTrigger as-child>
          <button
            data-test-id="provider-settings-trigger"
            class="rounded p-0.5 text-muted hover:bg-hover hover:text-surface"
          >
            <icon-lucide-settings class="size-3" />
          </button>
        </PopoverTrigger>
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent side="top" :side-offset="4" :class="tooltipCls.content">
          {{ dialogs.providerSettings }}
        </TooltipContent>
      </TooltipPortal>

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
  </TooltipRoot>
</template>
