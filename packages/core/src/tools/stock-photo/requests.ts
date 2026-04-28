import type { PhotoRequest } from './apply'

export function parsePhotoRequests(value: unknown): PhotoRequest[] | { error: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(String(value))
  } catch {
    return { error: 'Invalid JSON in requests' }
  }

  const requests = Array.isArray(parsed) ? parsed : [parsed]
  if (requests.length === 0) return { error: 'Empty requests array' }
  return requests as PhotoRequest[]
}
