import { fromUint8Array } from 'js-base64'

/** The SHA-256 of `bytes`, in Base64, as Cloud checks an upload against it. */
export async function cloudChecksum(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes))
  return fromUint8Array(new Uint8Array(digest))
}
