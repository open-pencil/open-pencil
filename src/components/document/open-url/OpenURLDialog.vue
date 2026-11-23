<script setup lang="ts">
import { computed, ref, shallowRef, useTemplateRef } from 'vue'

import { useMessages } from '@open-pencil/vue/i18n'

import { openURLDialogOpen, submitOpenURL } from '@/app/document/io/url/dialog'
import { parseWebAddress } from '@/app/document/io/url/open'
import { WEB_PAGE_SIZES, type WebPageSize } from '@/app/document/io/url/viewport'
import { appPreferences, updateImportPreferences } from '@/app/settings/preferences/store'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppDialogBody from '@/components/ui/dialog/AppDialogBody.vue'
import AppDialogHeader from '@/components/ui/dialog/AppDialogHeader.vue'
import AppDialogRoot from '@/components/ui/dialog/AppDialogRoot.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import SegmentedControl from '@/components/ui/select/SegmentedControl.vue'
import AppCheckbox from '@/components/ui/toggle/AppCheckbox.vue'
import { IS_TAURI } from '@/constants'

/**
 * File → Open from URL…: one line saying what an address may hold, the address and Open side by
 * side, and why it could not open under them, as Home's Join room asks for a room link. Under
 * them, how a web page opens: the window size it is laid out at and, on desktop, whether its
 * scripts run first; both are remembered for the next open. The dialog closes once the address
 * is read, and the new tab shows the rest of the open.
 */
const files = useMessages('files')
const field = useTemplateRef('field')
const address = ref('')
const error = ref<string | null>(null)
/** The open in progress; closing the dialog aborts it, and a newer one replaces it. */
const pending = shallowRef<AbortController | null>(null)
const ERROR_ID = 'open-url-error'

const SIZE_LABELS = {
  desktop: 'openURLSizeDesktop',
  tablet: 'openURLSizeTablet',
  mobile: 'openURLSizeMobile'
} as const satisfies Record<WebPageSize, keyof typeof files.value>

const sizeOptions = computed(() =>
  WEB_PAGE_SIZES.map((value) => ({ value, label: files.value[SIZE_LABELS[value]] }))
)

const size = computed({
  get: () => appPreferences.value.import.webPageSize,
  set: (value: string) => {
    const webPageSize = WEB_PAGE_SIZES.find((option) => option === value)
    if (webPageSize) updateImportPreferences({ webPageSize })
  }
})

const runScripts = computed({
  get: () => appPreferences.value.import.runPageScripts,
  set: (runPageScripts: boolean) => updateImportPreferences({ runPageScripts })
})

function updateOpen(open: boolean) {
  openURLDialogOpen.value = open
  if (open) return
  pending.value?.abort()
  pending.value = null
  address.value = ''
  error.value = null
}

function focusField(event: Event) {
  event.preventDefault()
  field.value?.focus()
}

async function submit() {
  if (pending.value || !address.value.trim()) return
  if (!parseWebAddress(address.value)) {
    error.value = files.value.openURLInvalid
    return
  }
  error.value = null
  const controller = new AbortController()
  pending.value = controller
  const failure = await submitOpenURL(address.value, controller.signal)
  // An open the dialog was closed on, or that a newer one replaced, no longer speaks for it.
  if (pending.value !== controller) return
  pending.value = null
  if (failure) error.value = failure
  else updateOpen(false)
}
</script>

<template>
  <AppDialogRoot
    :open="openURLDialogOpen"
    size="sm"
    @update:open="updateOpen"
    @open-auto-focus="focusField"
  >
    <AppDialogHeader
      :heading="files.openURLHeading"
      :description="files.openURLDescription"
      :ui="{ header: 'border-b-0 pb-0' }"
    />
    <AppDialogBody :ui="{ body: 'flex flex-col gap-2 pt-3' }">
      <form class="flex items-center gap-1.5" novalidate @submit.prevent="submit">
        <AppInput
          ref="field"
          v-model="address"
          type="url"
          inputmode="url"
          autocomplete="url"
          class="min-w-0 flex-1"
          placeholder="https://example.com"
          :aria-label="files.openURLAddress"
          :state="error ? 'invalid' : 'idle'"
          :aria-invalid="error !== null"
          :aria-describedby="error ? ERROR_ID : undefined"
          @update:model-value="error = null"
        />
        <AppButton
          type="submit"
          color="primary"
          variant="solid"
          :disabled="!address.trim()"
          :loading="pending !== null"
        >
          {{ files.openURLSubmit }}
        </AppButton>
      </form>
      <p v-if="error" :id="ERROR_ID" class="text-xs text-error" role="alert">{{ error }}</p>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
        <SegmentedControl
          v-model="size"
          data-test-id="open-url-size"
          :options="sizeOptions"
          :label="files.openURLSize"
        >
          <template #option="{ option }">
            <icon-lucide-monitor v-if="option.value === 'desktop'" class="size-3" />
            <icon-lucide-tablet v-else-if="option.value === 'tablet'" class="size-3" />
            <icon-lucide-smartphone v-else class="size-3" />
            <span class="truncate">{{ option.label }}</span>
          </template>
        </SegmentedControl>
        <label v-if="IS_TAURI" class="flex cursor-pointer items-center gap-2 text-xs text-surface">
          <AppCheckbox
            v-model="runScripts"
            data-test-id="open-url-run-scripts"
            :ariaLabel="files.openURLRunScripts"
          />
          {{ files.openURLRunScripts }}
        </label>
      </div>
    </AppDialogBody>
  </AppDialogRoot>
</template>
