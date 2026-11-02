import { omit } from 'es-toolkit'
import * as v from 'valibot'
import { useForm } from 'vee-validate'
import { computed, reactive, ref, watch, type Ref } from 'vue'

import {
  createMCPConnectionDraft,
  validateMCPConnectionURL,
  mcpConnectionSettings,
  MCP_CONNECTION_NAME_MAX_LENGTH
} from '@/app/integrations/mcp'
import { requiredSetting, type SettingsValidationMessages } from '@/app/settings/validation/schema'
import { validateAfterFirstError } from '@/app/settings/validation/use'

import type { MCPConnectionDraft } from '../types'

interface ConnectionFormMessages {
  connectionNameInvalid: string
  serverURLHint: string
  bearerTokenRequired: string
}
export type MCPConnectionFieldErrors = Partial<Record<'name' | 'url' | 'credential', string>>

/** Only credential availability enters form state, never entered or saved secrets. */
export function useMCPConnectionForm(
  messages: Readonly<Ref<SettingsValidationMessages>>,
  automation: Readonly<Ref<ConnectionFormMessages>>
) {
  const id = ref<MCPConnectionDraft['id']>(null)
  const schema = computed(() =>
    v.pipe(
      v.object({
        name: v.pipe(
          requiredSetting(messages.value.requiredField),
          v.check(
            (name) =>
              name.length <= MCP_CONNECTION_NAME_MAX_LENGTH &&
              name.toLowerCase() !== 'open-pencil' &&
              !mcpConnectionSettings.value.connections.some(
                (connection) =>
                  connection.id !== id.value && connection.name.toLowerCase() === name.toLowerCase()
              ),
            automation.value.connectionNameInvalid
          )
        ),
        url: v.pipe(
          requiredSetting(messages.value.requiredField),
          v.check((value) => {
            try {
              validateMCPConnectionURL(value)
              return true
            } catch {
              return false
            }
          }, automation.value.serverURLHint)
        ),
        enabled: v.boolean(),
        authenticationType: v.picklist(['none', 'bearer']),
        credential: v.boolean()
      }),
      v.forward(
        v.partialCheck(
          [['enabled'], ['authenticationType'], ['credential']],
          (value) => !value.enabled || value.authenticationType !== 'bearer' || value.credential,
          automation.value.bearerTokenRequired
        ),
        ['credential']
      )
    )
  )
  const form = useForm({
    initialValues: { ...omit(createMCPConnectionDraft(), ['id']), credential: false },
    validationSchema: schema
  })
  const config = validateAfterFirstError
  const [name] = form.defineField('name', config)
  const [url] = form.defineField('url', config)
  const [enabled] = form.defineField('enabled', config)
  const [authenticationType] = form.defineField('authenticationType', config)
  form.defineField('credential', config)
  watch([enabled, authenticationType], () => {
    if (form.errors.value.credential) void form.validateField('credential')
  })
  const fields = reactive({ id, name, url, enabled, authenticationType })
  const draft = computed<MCPConnectionDraft>({
    get: () => fields,
    set: (values) => {
      id.value = values.id
      form.resetForm({ values: { ...omit(values, ['id']), credential: false } })
    }
  })

  return {
    draft,
    dirty: computed(() => form.meta.value.dirty),
    errors: form.errors,
    blur: (field: 'name' | 'url' | 'credential') => form.validateField(field),
    setCredentialReady: (ready: boolean) => form.resetField('credential', { value: ready }),
    handleSubmit: form.handleSubmit,
    isSubmitting: form.isSubmitting
  }
}
