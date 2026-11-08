<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { portalForm } from '@/components/cloud-portal/ui'
import AppConfirmationDialog from '@/components/ui/dialog/AppConfirmationDialog.vue'
import AppTextarea from '@/components/ui/input/AppTextarea.vue'
import { useHeldContent } from '@/components/ui/overlay/held'

import type { PortalContentAction, PortalDocumentRow } from '../types'
import { contentConfirmation } from './content'

/**
 * Asks once more before an administrator takes a document down, restores it, revokes its link,
 * or suspends its owner; taking down and suspending take a reason for the activity log.
 */
const { pending } = defineProps<{
  pending: { action: PortalContentAction; document: PortalDocumentRow } | null
}>()
const emit = defineEmits<{ confirm: [reason?: string]; cancel: [] }>()

const form = portalForm()
const messages = useCloudPortalMessages()
const reason = ref('')
const shown = useHeldContent(() => pending)
const confirmation = computed(() =>
  shown.value ? contentConfirmation(messages.value, shown.value.action, shown.value.document) : null
)
watch(
  () => pending,
  () => (reason.value = '')
)
</script>

<template>
  <AppConfirmationDialog
    :open="pending !== null"
    tone="danger"
    :heading="confirmation?.heading ?? ''"
    :description="confirmation?.description"
    :cancel-label="messages.cancel"
    :confirm-label="confirmation?.confirm ?? ''"
    @update:open="(open) => !open && emit('cancel')"
    @confirm="emit('confirm', reason.trim() || undefined)"
  >
    <div v-if="confirmation?.reason" :class="[form.field(), 'mt-3']">
      <label for="portal-content-reason" :class="form.label()">{{ messages.takeDownReason }}</label>
      <AppTextarea id="portal-content-reason" v-model="reason" :rows="2" maxlength="500" />
    </div>
  </AppConfirmationDialog>
</template>
