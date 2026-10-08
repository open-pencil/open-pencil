import * as v from 'valibot'
import { computed, ref } from 'vue'

import { submitWaitlistEntry } from './submit'

const EmailSchema = v.pipe(v.string(), v.trim(), v.email())

export type WaitlistStatus = 'idle' | 'invalid' | 'submitting' | 'joined' | 'failed'

/** One waitlist form's email field and the outcome of submitting it. */
export function useWaitlistForm() {
  const email = ref('')
  const status = ref<WaitlistStatus>('idle')
  const submitting = computed(() => status.value === 'submitting')

  /** Editing after a rejected address clears the complaint until the next submit. */
  function edit(): void {
    if (status.value === 'invalid' || status.value === 'failed') status.value = 'idle'
  }

  async function submit(): Promise<void> {
    if (submitting.value) return
    const parsed = v.safeParse(EmailSchema, email.value)
    if (!parsed.success) {
      status.value = 'invalid'
      return
    }
    status.value = 'submitting'
    try {
      await submitWaitlistEntry({ email: parsed.output })
      status.value = 'joined'
    } catch {
      status.value = 'failed'
    }
  }

  return { email, status, submitting, edit, submit }
}
