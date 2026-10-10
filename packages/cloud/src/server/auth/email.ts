import type { TransactionalEmailService } from '#cloud/server/email'
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js'

export type AuthenticationEmailService = {
  sendVerification(input: {
    email: string
    name: string
    url: string
    token: string
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
        payload: { name: input.name, actionURL: input.url }
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
    }
  }
}
