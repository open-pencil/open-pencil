import * as v from 'valibot'
import { useForm } from 'vee-validate'
import { computed, type Ref } from 'vue'

import type { CloudAuthFailure } from '@open-pencil/cloud/client'
import type { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { validateAfterFirstError } from '@/app/settings/validation/use'

export type CloudAccountFormMode = 'sign-in' | 'sign-up'
export type CloudAccountCredentials = { name: string; email: string; password: string }

type Messages = ReturnType<typeof useCloudPortalMessages>['value']

/**
 * Signing in to or joining a Cloud server with an email and password: what the server would turn
 * down is caught here first, and sign-up asks for the password twice.
 */
export function useCloudAccountForm(
  mode: Readonly<Ref<CloudAccountFormMode>>,
  minimumPasswordLength: Readonly<Ref<number>>,
  messages: Readonly<Ref<Messages>>
) {
  const schema = computed(() => {
    const words = messages.value
    const email = v.pipe(
      v.string(),
      v.trim(),
      v.nonEmpty(words.errorEmailRequired),
      v.email(words.errorEmailInvalid)
    )
    if (mode.value === 'sign-in') {
      // Name and repeat stay in the shape, unchecked, so both modes share the form's fields.
      return v.object({
        name: v.string(),
        email,
        password: v.pipe(v.string(), v.nonEmpty(words.errorPasswordRequired)),
        repeat: v.string()
      })
    }
    return v.pipe(
      v.object({
        name: v.pipe(v.string(), v.trim(), v.nonEmpty(words.errorNameRequired)),
        email,
        password: v.pipe(
          v.string(),
          v.minLength(
            minimumPasswordLength.value,
            words.errorPasswordTooShort({ count: minimumPasswordLength.value })
          )
        ),
        repeat: v.string()
      }),
      v.forward(
        v.partialCheck(
          [['password'], ['repeat']],
          (input) => input.password === input.repeat,
          words.errorPasswordsDiffer
        ),
        ['repeat']
      )
    )
  })
  const form = useForm({
    initialValues: { name: '', email: '', password: '', repeat: '' },
    validationSchema: schema
  })
  const [name] = form.defineField('name', validateAfterFirstError)
  const [email] = form.defineField('email', validateAfterFirstError)
  const [password] = form.defineField('password', validateAfterFirstError)
  const [repeat] = form.defineField('repeat', validateAfterFirstError)

  return {
    fields: { name, email, password, repeat },
    errors: form.errors,
    blur: (field: 'name' | 'email' | 'password' | 'repeat') => form.validateField(field),
    submit: (send: (credentials: CloudAccountCredentials) => void) =>
      form.handleSubmit((values) =>
        send({ name: values.name.trim(), email: values.email.trim(), password: values.password })
      ),
    /** Clears what was typed and every message, keeping the email for the other mode. */
    switchMode: () => form.resetForm({ values: { ...form.values, password: '', repeat: '' } })
  }
}

/** Words for a failed sign-in step, the same in the editor and on the server's pages. */
export function cloudAuthFailureMessage(failure: CloudAuthFailure, words: Messages): string {
  const messages: Record<CloudAuthFailure, string> = {
    'invalid-credentials': words.failureInvalidCredentials,
    'email-not-verified': words.failureEmailNotVerified,
    'password-too-short': words.failurePasswordTooShort,
    'password-too-long': words.failurePasswordTooLong,
    'invalid-link': words.failureInvalidLink,
    'invalid-code': words.failureInvalidCode,
    'passkey-cancelled': words.failurePasskeyCancelled,
    'passkey-exists': words.failurePasskeyExists,
    'passkey-unavailable': words.failurePasskeyUnavailable,
    'session-not-fresh': words.errorSessionNotFresh,
    'rate-limited': words.failureRateLimited,
    unavailable: words.failureUnavailable
  }
  return messages[failure]
}
