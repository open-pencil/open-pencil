<script setup lang="ts">
import * as v from 'valibot'
import { computed, ref, watch } from 'vue'

import {
  DOCUMENT_REPORT_DESCRIPTION_MAX,
  type DocumentReportReason
} from '@open-pencil/cloud/contract'
import { useCloudMessages, useCommonMessages } from '@open-pencil/vue/i18n'

import AppButton from '@/components/ui/button/AppButton.vue'
import AppDialogBody from '@/components/ui/dialog/AppDialogBody.vue'
import AppDialogFooter from '@/components/ui/dialog/AppDialogFooter.vue'
import AppDialogHeader from '@/components/ui/dialog/AppDialogHeader.vue'
import AppDialogRoot from '@/components/ui/dialog/AppDialogRoot.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import AppTextarea from '@/components/ui/input/AppTextarea.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'

import { cloudReport } from './ui'

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

const ui = cloudReport()
const t = useCloudMessages()
const common = useCommonMessages()
const reason = ref<DocumentReportReason>('spam-phishing')
const description = ref('')
const replyEmail = ref('')
watch(
  open,
  (isOpen) => {
    if (!isOpen) return
    reason.value = 'spam-phishing'
    description.value = ''
    replyEmail.value = email ?? ''
  },
  { immediate: true }
)

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
  <AppDialogRoot v-model:open="open" size="sm">
    <AppDialogHeader
      :heading="t.reportFile"
      :description="t.reportDescription({ host })"
      :close-label="common.close"
    />
    <AppDialogBody>
      <form id="cloud-report" :class="ui.form()" novalidate @submit.prevent="send">
        <div :class="ui.field()">
          <span :class="ui.label()">{{ t.reportReason }}</span>
          <AppSelect v-model="reason" :options="reasons" :label="t.reportReason" />
        </div>
        <div :class="ui.field()">
          <label for="cloud-report-details" :class="ui.label()">{{ t.reportDetails }}</label>
          <AppTextarea
            id="cloud-report-details"
            v-model="description"
            :rows="4"
            :maxlength="DOCUMENT_REPORT_DESCRIPTION_MAX"
            :disabled="busy"
            :placeholder="t.reportDetailsPlaceholder"
          />
        </div>
        <div :class="ui.field()">
          <label for="cloud-report-email" :class="ui.label()">{{ t.reportEmail }}</label>
          <AppInput
            id="cloud-report-email"
            v-model="replyEmail"
            type="email"
            autocomplete="email"
            :disabled="busy"
            :aria-invalid="emailInvalid || undefined"
          />
          <span v-if="emailInvalid" :class="ui.error()">{{ t.reportEmailInvalid }}</span>
          <span v-else :class="ui.note()">{{ t.reportEmailHint }}</span>
        </div>
        <AppAlert
          v-if="failure"
          tone="error"
          :heading="failure === 'too-many' ? t.reportTooMany : t.reportFailed"
        />
      </form>
    </AppDialogBody>
    <AppDialogFooter :ui="{ footer: 'justify-between' }">
      <AppButton @click="emit('cancel')">{{ common.cancel }}</AppButton>
      <AppButton
        type="submit"
        form="cloud-report"
        color="primary"
        variant="solid"
        :loading="busy"
        :disabled="!ready"
      >
        {{ t.reportSend }}
      </AppButton>
    </AppDialogFooter>
  </AppDialogRoot>
</template>
