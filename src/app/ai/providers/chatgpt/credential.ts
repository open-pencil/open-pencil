import * as v from 'valibot'

/** A ChatGPT sign-in, kept as JSON in the connection's credential slot. */
const chatGPTCredentialSchema = v.object({
  access: v.pipe(v.string(), v.minLength(1)),
  refresh: v.pipe(v.string(), v.minLength(1)),
  /** When the access token expires, in epoch milliseconds. */
  expires: v.number(),
  accountId: v.pipe(v.string(), v.minLength(1)),
  email: v.optional(v.string()),
  /** The ChatGPT plan, such as `plus` or `pro`. */
  plan: v.optional(v.string())
})

export type ChatGPTCredential = v.InferOutput<typeof chatGPTCredentialSchema>

export function parseChatGPTCredential(text: string): ChatGPTCredential | null {
  const parsed = v.safeParse(v.pipe(v.string(), v.parseJson(), chatGPTCredentialSchema), text)
  return parsed.success ? parsed.output : null
}

export function serializeChatGPTCredential(credential: ChatGPTCredential): string {
  return JSON.stringify(credential)
}
