<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue/i18n'

import type { ReportSendFailure } from '@/app/reports/send'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppCollapsible from '@/components/ui/collapsible/AppCollapsible.vue'
import AppDialogCancel from '@/components/ui/dialog/AppDialogCancel.vue'
import AppFormDialog from '@/components/ui/dialog/AppFormDialog.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppFormField from '@/components/ui/input/AppFormField.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import AppTextarea from '@/components/ui/input/AppTextarea.vue'
import AppCheckboxCard from '@/components/ui/toggle/AppCheckboxCard.vue'
import reportsTheme from '@/theme/reports'

const {
  kind,
  emailInvalid = false,
  hasDocument = false,
  preparingDocument = false,
  documentFailed = false,
  preview,
  canSend,
  sending = false,
  failure = null
} = defineProps<{
  kind: 'error' | 'problem'
  emailInvalid?: boolean
  /** Whether the active tab holds a document to attach. */
  hasDocument?: boolean
  preparingDocument?: boolean
  documentFailed?: boolean
  /** The exact body that would be sent. */
  preview: string
  canSend: boolean
  sending?: boolean
  failure?: ReportSendFailure | null
}>()

const emit = defineEmits<{ send: [] }>()

const open = defineModel<boolean>('open', { default: false })
const note = defineModel<string>('note', { default: '' })
const email = defineModel<string>('email', { default: '' })
const includeActivity = defineModel<boolean>('includeActivity', { default: true })
const attachDocument = defineModel<boolean>('attachDocument', { default: false })

const { diagnostics: messages } = useI18n()
const ui = tv(reportsTheme)()

const heading = computed(() =>
  kind === 'error' ? messages.value.reportErrorTitle : messages.value.reportProblemTitle
)
const description = computed(() =>
  kind === 'error' ? messages.value.reportErrorDescription : messages.value.reportProblemDescription
)
</script>

<template>
  <AppFormDialog
    v-model:open="open"
    size="md"
    data-test-id="report-dialog"
    :heading="heading"
    :description="description"
    :error="
      failure ? (failure === 'files' ? messages.reportFilesFailed : messages.reportFailed) : null
    "
    @submit="emit('send')"
  >
    <AppFormField :label="kind === 'error' ? messages.reportNoteError : messages.reportNoteProblem">
      <template #default="{ id }">
        <AppTextarea
          :id="id"
          v-model="note"
          :rows="4"
          :placeholder="messages.reportNotePlaceholder"
          data-test-id="report-note"
        />
      </template>
    </AppFormField>
    <AppFormField
      :label="messages.reportEmail"
      :error="emailInvalid ? messages.reportEmailInvalid : null"
      :hint="messages.reportEmailHint"
    >
      <template #default="{ id, invalid, describedBy }">
        <AppInput
          :id="id"
          v-model="email"
          type="email"
          size="md"
          :state="invalid ? 'invalid' : 'idle'"
          :aria-invalid="invalid || undefined"
          :aria-describedby="describedBy"
          autocomplete="email"
        />
      </template>
    </AppFormField>
    <AppCheckboxCard
      v-model="includeActivity"
      :label="messages.reportActivity"
      :description="messages.reportActivityDescription"
    />
    <AppCheckboxCard
      v-if="hasDocument"
      v-model="attachDocument"
      :label="messages.reportDocument"
      :description="messages.reportDocumentDescription"
    />
    <AppCollapsible :label="messages.reportPreview">
      <pre :class="ui.preview()" data-test-id="report-preview">{{ preview }}</pre>
    </AppCollapsible>
    <AppAlert v-if="documentFailed" tone="error" :heading="messages.reportDocumentFailed" />
    <template #footer>
      <AppDialogCancel size="md" />
      <AppButton
        type="submit"
        size="md"
        color="primary"
        variant="solid"
        :loading="sending"
        :disabled="!canSend || preparingDocument"
      >
        {{ messages.reportSend }}
      </AppButton>
    </template>
  </AppFormDialog>
</template>
