import * as v from 'valibot'
import { computed, ref, type Ref } from 'vue'

import type { FeedbackClient } from '@open-pencil/feedback/client'
import { waitlistSignupSchema, type WaitlistSignup } from '@open-pencil/feedback/contract'

import { feedback } from '@/app/feedback/client'

import { useTurnstile } from './turnstile'

/** What became of one sign-up the feedback service was sent. */
export type WaitlistOutcome = 'joined' | 'invalid' | 'refused' | 'limited' | 'failed'

/**
 * Sends a sign-up to the OpenPencil Cloud waitlist. The service answers every accepted sign-up
 * alike and emails a link to confirm it, so `joined` means "check your inbox", whether or not
 * the address was already on the list.
 */
export async function joinWaitlist(
  signup: WaitlistSignup,
  client: FeedbackClient = feedback
): Promise<WaitlistOutcome> {
  const response = await client.waitlist.$post({ json: signup }).catch(() => null)
  if (!response) return 'failed'
  // The route types its own answers; validation (400) and the rate limit (429) come from the
  // middleware in front of it, so the status is compared as the number it is.
  const status: number = response.status
  if (status === 202) return 'joined'
  if (status === 400) return 'invalid'
  if (status === 403) return 'refused'
  if (status === 429) return 'limited'
  return 'failed'
}

export type WaitlistStatus = WaitlistOutcome | 'idle' | 'submitting' | 'unavailable'

/** The address checked as the service checks it, so the form refuses what the service would. */
const emailSchema = waitlistSignupSchema.entries.email

/**
 * One waitlist form: its address, Turnstile in `turnstileContainer`, and the outcome of the last
 * attempt. Every surface that offers the waitlist renders its own form around this, so the
 * website and Settings send and report sign-ups the same way.
 */
export function useWaitlistSignup(turnstileContainer: Readonly<Ref<HTMLElement | null>>) {
  const email = ref('')
  const status = ref<WaitlistStatus>('idle')
  const submitting = computed(() => status.value === 'submitting')
  const turnstile = useTurnstile(turnstileContainer)
  /** A sign-up waits on the visitor to tick Turnstile's check, which the form says rather than spin. */
  const confirming = computed(() => submitting.value && turnstile.state.value === 'asking')

  /** Editing after a refused attempt clears the complaint until the next one. */
  function edit(): void {
    if (status.value !== 'joined' && status.value !== 'submitting') status.value = 'idle'
  }

  async function submit(): Promise<void> {
    if (submitting.value) return
    const parsed = v.safeParse(emailSchema, email.value)
    if (!parsed.success) {
      status.value = 'invalid'
      return
    }
    status.value = 'submitting'
    const turnstileToken = await turnstile.nextToken()
    if (!turnstileToken) {
      status.value = 'unavailable'
      return
    }
    status.value = await joinWaitlist({ email: parsed.output, turnstileToken })
    turnstile.spend()
  }

  return { email, status, submitting, confirming, edit, submit }
}
