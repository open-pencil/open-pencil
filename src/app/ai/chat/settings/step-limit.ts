import * as v from 'valibot'
import { useForm } from 'vee-validate'
import { computed, watch, type Ref } from 'vue'

import { maxAgentSteps } from '../preferences'
import { agentStepLimitSchema } from '../step-limit'

/** Immediate preference control: validate on commit, never persist an incomplete draft. */
export function useChatStepLimit(errorMessage: Readonly<Ref<string>>) {
  const schema = computed(() =>
    v.object({
      maxSteps: v.pipe(
        v.union([v.string(), v.number()]),
        v.transform(Number),
        v.check((value) => v.is(agentStepLimitSchema, value), errorMessage.value)
      )
    })
  )
  const form = useForm({
    initialValues: { maxSteps: maxAgentSteps.value as string | number },
    validationSchema: schema
  })
  const [maxSteps] = form.defineField('maxSteps', (state) => ({
    validateOnModelUpdate: state.errors.length > 0,
    validateOnChange: false,
    validateOnInput: false
  }))

  function reset() {
    form.resetForm({ values: { maxSteps: maxAgentSteps.value } })
  }
  function persist(values: { maxSteps: string | number }) {
    const value = Number(values.maxSteps)
    if (Number(maxSteps.value) !== value) return
    maxAgentSteps.value = value
    reset()
  }
  watch(maxAgentSteps, reset)

  return { maxSteps, errors: form.errors, commit: form.handleSubmit(persist) }
}
