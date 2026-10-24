import type { TwoStepChange } from '#cloud/email'
import type { TransactionalEmailService } from '#cloud/server/email'
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js'

export type AuthenticationEmailService = {
  sendVerification(input: {
    email: string
    name: string
    url: string
    token: string
    purpose?: 'account' | 'change'
  }): Promise<void>
  sendPasswordReset(input: {
    email: string
    name: string
    url: string
    token: string
  }): Promise<void>
  sendPasswordChanged(input: {
    email: string
    name: string
    userId: string
    url: string
  }): Promise<void>
  /** Tells the address being replaced which address is taking over, before it confirms. */
  sendEmailChangeRequested(input: {
    email: string
    name: string
    userId: string
    newEmail: string
  }): Promise<void>
  sendNewSignIn(input: {
    email: string
    name: string
    signInId: string
    signedInAt: Date
    ipAddress: string | null
    browser: string | null
    system: string | null
    desktop: boolean
  }): Promise<void>
  sendTwoStepChanged(input: {
    email: string
    name: string
    userId: string
    change: TwoStepChange
  }): Promise<void>
}

function tokenHash(value: string): string {
  return bytesToHex(sha256(utf8ToBytes(value)))
}

export function createAuthenticationEmailService(
  email: TransactionalEmailService,
  publicURL: string
): AuthenticationEmailService {
  return {
    async sendVerification(input) {
      await email.enqueue({
        idempotencyKey: `email-verification/${input.email.toLowerCase()}/${tokenHash(input.token)}`,
        kind: 'email-verification',
        recipientEmail: input.email,
        payload: { name: input.name, actionURL: input.url, purpose: input.purpose }
      })
    },
    async sendPasswordReset(input) {
      await email.enqueue({
        idempotencyKey: `password-reset/${input.email.toLowerCase()}/${tokenHash(input.token)}`,
        kind: 'password-reset',
        recipientEmail: input.email,
        payload: { name: input.name, actionURL: input.url }
      })
    },
    async sendPasswordChanged(input) {
      await email.enqueue({
        idempotencyKey: `password-changed/${input.userId}/${crypto.randomUUID()}`,
        kind: 'password-changed',
        recipientEmail: input.email,
        payload: { name: input.name, actionURL: new URL('/auth/sign-in', publicURL).href }
      })
    },
    async sendEmailChangeRequested(input) {
      await email.enqueue({
        idempotencyKey: `email-change-requested/${input.userId}/${crypto.randomUUID()}`,
        kind: 'email-change-requested',
        recipientEmail: input.email,
        payload: {
          name: input.name,
          newEmail: input.newEmail,
          actionURL: new URL('/account/sessions', publicURL).href
        }
      })
    },
    async sendNewSignIn(input) {
      await email.enqueue({
        idempotencyKey: `new-sign-in/${input.signInId}`,
        kind: 'new-sign-in',
        recipientEmail: input.email,
        payload: {
          name: input.name,
          signedInAt: input.signedInAt.toISOString(),
          ipAddress: input.ipAddress,
          browser: input.browser,
          system: input.system,
          desktop: input.desktop,
          actionURL: new URL('/account/sessions', publicURL).href
        }
      })
    },
    async sendTwoStepChanged(input) {
      await email.enqueue({
        idempotencyKey: `two-step-changed/${input.userId}/${crypto.randomUUID()}`,
        kind: 'two-step-changed',
        recipientEmail: input.email,
        payload: {
          name: input.name,
          change: input.change,
          actionURL: new URL('/account/security', publicURL).href
        }
      })
    }
  }
}
