<script setup lang="ts">
import * as v from 'valibot'
import { computed, ref } from 'vue'

import {
  DOCUMENT_REPORT_DESCRIPTION_MAX,
  type DocumentReportReason
} from '@open-pencil/cloud/contract'
import { useCloudMessages, useCommonMessages } from '@open-pencil/vue/i18n'

import AppFormDialog from '@/components/ui/dialog/AppFormDialog.vue'
import AppFormField from '@/components/ui/input/AppFormField.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import AppTextarea from '@/components/ui/input/AppTextarea.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'

/**
 * Reporting a document someone opened from a share link to the administrators of its server: why,
 * what to look at, and where they may answer. Send waits for a description and an address that is
 * one, or none.
 */
const {
  host,
  email = null,
  busy = false,
  failure = null
} = defineProps<{
  host: string
  /** The reporter's address when they are signed in, offered for a reply. */
  email?: string | null
  busy?: boolean
  /** Why the last attempt did not go through, if it did not. */
  failure?: 'failed' | 'too-many' | null
}>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{
  send: [report: { reason: DocumentReportReason; description: string; replyEmail?: string }]
  cancel: []
}>()

const t = useCloudMessages()
const common = useCommonMessages()
const reason = ref<DocumentReportReason>('spam-phishing')
const description = ref('')
const replyEmail = ref('')
function reset() {
  reason.value = 'spam-phishing'
  description.value = ''
  replyEmail.value = email ?? ''
}

const reasons = computed(() => [
  { value: 'spam-phishing' as const, label: t.value.reportReasonSpam },
  { value: 'illegal' as const, label: t.value.reportReasonIllegal },
  { value: 'copyright' as const, label: t.value.reportReasonCopyright },
  { value: 'harassment' as const, label: t.value.reportReasonHarassment },
  { value: 'other' as const, label: t.value.reportReasonOther }
])
const emailSchema = v.pipe(v.string(), v.email())
const trimmedEmail = computed(() => replyEmail.value.trim())
const emailInvalid = computed(
  () => trimmedEmail.value !== '' && !v.is(emailSchema, trimmedEmail.value)
)
const ready = computed(() => description.value.trim() !== '' && !emailInvalid.value)

function send() {
  if (!ready.value) return
  emit('send', {
    reason: reason.value,
    description: description.value.trim(),
    replyEmail: trimmedEmail.value || undefined
  })
}
</script>

<template>
  <AppFormDialog
    v-model:open="open"
    :heading="t.reportFile"
    :description="t.reportDescription({ host })"
    :close-label="common.close"
    :cancel-label="common.cancel"
    :submit-label="t.reportSend"
    :error="failure === 'too-many' ? t.reportTooMany : failure ? t.reportFailed : null"
    :saving="busy"
    :submit-disabled="!ready"
    @open="reset"
    @cancel="emit('cancel')"
    @submit="send"
  >
    <AppFormField :label="t.reportReason" :label-for="false">
      <AppSelect v-model="reason" :options="reasons" :label="t.reportReason" />
    </AppFormField>
    <AppFormField :label="t.reportDetails">
      <template #default="{ id }">
        <AppTextarea
          :id="id"
          v-model="description"
          :rows="4"
          :maxlength="DOCUMENT_REPORT_DESCRIPTION_MAX"
          :disabled="busy"
          :placeholder="t.reportDetailsPlaceholder"
        />
      </template>
    </AppFormField>
    <AppFormField
      :label="t.reportEmail"
      :error="emailInvalid ? t.reportEmailInvalid : null"
      :hint="t.reportEmailHint"
    >
      <template #default="{ id, invalid, describedBy }">
        <AppInput
          :id="id"
          v-model="replyEmail"
          type="email"
          autocomplete="email"
          :disabled="busy"
          :state="invalid ? 'invalid' : 'idle'"
          :aria-invalid="invalid || undefined"
          :aria-describedby="describedBy"
        />
      </template>
    </AppFormField>
  </AppFormDialog>
</template>
