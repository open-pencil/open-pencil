import type { GenericSchema } from 'valibot'
import { useForm } from 'vee-validate'
import { watch, type Ref } from 'vue'

/** A field is checked when the person leaves it, then on every change until it is right. */
export const validateAfterFirstError = (state: { errors: string[] }) => ({
  validateOnModelUpdate: state.errors.length > 0,
  validateOnChange: false,
  validateOnInput: false
})

/** Validate a non-secret projection without moving persistence into the form layer. */
export function useSettingsValidation(
  values: Readonly<Ref<Record<string, string | boolean>>>,
  schema: Readonly<Ref<GenericSchema>>
) {
  const form = useForm<Record<string, string | boolean>>({
    initialValues: { ...values.value },
    validationSchema: schema
  })
  const registered = new Set<string>()
  function registerFields() {
    for (const field of Object.keys(values.value)) {
      if (registered.has(field)) continue
      registered.add(field)
      form.defineField(field, validateAfterFirstError)
    }
  }
  registerFields()
  watch(
    values,
    (next, previous) => {
      registerFields()
      form.setValues({ ...next }, false)
      // Cross-field rules may attach their issue to a different field than the one changed.
      if (Object.keys(next).some((field) => next[field] !== previous[field])) {
        for (const field of Object.keys(form.errors.value)) void form.validateField(field)
      }
    },
    { deep: true, flush: 'sync' }
  )

  return {
    errors: form.errors,
    blur: (field: string) => form.validateField(field),
    validate: async () => (await form.validate()).valid,
    reset: () => form.resetForm({ values: { ...values.value } }, { force: true })
  }
}
