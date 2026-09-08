import { setTimeout as delay } from 'node:timers/promises'

import * as v from 'valibot'

const addressSchema = v.object({ Address: v.pipe(v.string(), v.email()) })
const messageListItemSchema = v.object({
  ID: v.string(),
  Subject: v.string(),
  To: v.array(addressSchema)
})
const messageListSchema = v.object({ messages: v.array(messageListItemSchema) })
const messageSchema = v.object({
  ID: v.string(),
  Subject: v.string(),
  To: v.array(addressSchema),
  Text: v.string(),
  HTML: v.string()
})

export type MailpitMessage = v.InferOutput<typeof messageSchema>

export class MailpitClient {
  constructor(private readonly baseURL: string) {}

  async clearMessages(): Promise<void> {
    const response = await fetch(new URL('/api/v1/messages', this.baseURL), { method: 'DELETE' })
    if (!response.ok) throw new Error(`Mailpit clear failed with HTTP ${response.status}`)
  }

  async waitForMessage(input: {
    recipient: string
    subject: string
    timeoutMs?: number
  }): Promise<MailpitMessage> {
    const expiresAt = Date.now() + (input.timeoutMs ?? 5000)
    do {
      const response = await fetch(new URL('/api/v1/messages', this.baseURL))
      if (!response.ok) throw new Error(`Mailpit list failed with HTTP ${response.status}`)
      const list = v.parse(messageListSchema, await response.json())
      const match = list.messages.find(
        (message) =>
          message.Subject === input.subject &&
          message.To.some((recipient) => recipient.Address === input.recipient)
      )
      if (match) return this.readMessage(match.ID)
      await delay(100)
    } while (Date.now() < expiresAt)
    throw new Error(`Mailpit message was not received: ${input.subject}`)
  }

  private async readMessage(id: string): Promise<MailpitMessage> {
    const response = await fetch(new URL(`/api/v1/message/${encodeURIComponent(id)}`, this.baseURL))
    if (!response.ok) throw new Error(`Mailpit message read failed with HTTP ${response.status}`)
    return v.parse(messageSchema, await response.json())
  }
}

export function firstHTTPSLink(message: MailpitMessage): string {
  const link = message.Text.match(/https?:\/\/\S+/)?.[0]
  if (!link) throw new Error(`Mailpit message contains no HTTP link: ${message.Subject}`)
  return link
}
