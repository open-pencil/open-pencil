<script setup lang="ts">
import { useFocus } from '@vueuse/core'
import { useTemplateRef } from 'vue'

import { useMessages } from '@open-pencil/vue/i18n'

import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlertDialogRoot from '@/components/ui/dialog/AppAlertDialogRoot.vue'
import AppDialogFooter from '@/components/ui/dialog/AppDialogFooter.vue'
import AppDialogHeader from '@/components/ui/dialog/AppDialogHeader.vue'
import { useHeldContent } from '@/components/ui/overlay/held'

/**
 * Asks how the document takes another color profile, as Figma's File color profile dialog does:
 * assigned, keeping its values, or converted, keeping its colors.
 */
const { profileName } = defineProps<{
  /** The name of the profile chosen, or null while the dialog is closed. */
  profileName: string | null
}>()

const emit = defineEmits<{
  choose: [mode: 'assign' | 'convert']
  cancel: []
}>()

const panels = useMessages('panels')
const common = useMessages('common')
const shownName = useHeldContent(() => profileName)
const convertButton = useTemplateRef('convertButton')
// The dialog mounts on open; Return converts, the choice that keeps the document looking the same.
useFocus(convertButton, { initialValue: true, preventScroll: true })

function updateOpen(open: boolean) {
  if (!open) emit('cancel')
}
</script>

<template>
  <AppAlertDialogRoot :open="profileName !== null" @update:open="updateOpen">
    <AppDialogHeader
      :heading="panels.colorProfileChange({ profile: shownName ?? '' })"
      :description="panels.colorProfileChangeDescription"
      :show-close="false"
    />
    <AppDialogFooter>
      <template #start>
        <AppButton color="neutral" variant="ghost" @click="emit('cancel')">
          {{ common.cancel }}
        </AppButton>
      </template>
      <AppButton
        color="neutral"
        variant="outline"
        data-test-id="color-profile-assign"
        @click="emit('choose', 'assign')"
      >
        {{ panels.colorProfileAssign }}
      </AppButton>
      <AppButton
        ref="convertButton"
        color="primary"
        variant="solid"
        data-test-id="color-profile-convert"
        @click="emit('choose', 'convert')"
      >
        {{ panels.colorProfileConvert }}
      </AppButton>
    </AppDialogFooter>
  </AppAlertDialogRoot>
</template>
