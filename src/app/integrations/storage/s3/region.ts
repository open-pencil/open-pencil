/**
 * Infer SigV4 signing region from a common S3-compatible endpoint host.
 * Region is not shown in the UI — most providers encode it in the URL.
 */
export const BUNNY_S3_REGIONS = ['de', 'ny', 'sg', 'uk', 'se', 'la', 'jh', 'syd'] as const

export type BunnyS3Region = (typeof BUNNY_S3_REGIONS)[number]

function endpointHostname(endpoint: string): string | null {
  const trimmed = endpoint.trim()
  if (!trimmed) return null

  try {
    const withProtocol =
      trimmed.startsWith('http://') || trimmed.startsWith('https://')
        ? trimmed
        : `https://${trimmed}`
    return new URL(withProtocol).hostname.toLowerCase()
  } catch {
    return null
  }
}

export function inferBunnyS3Region(endpoint: string): BunnyS3Region | null {
  const host = endpointHostname(endpoint)
  const region = host?.match(/^([a-z]{2,3})-s3\.storage\.bunnycdn\.com$/)?.[1]
  return BUNNY_S3_REGIONS.find((candidate) => candidate === region) ?? null
}

export function inferS3Region(endpoint: string, fallback = 'us-east-1'): string {
  const host = endpointHostname(endpoint)
  if (!host) return fallback

  const bunny = inferBunnyS3Region(endpoint)
  if (bunny) return bunny

  // Backblaze B2: s3.eu-central-003.backblazeb2.com
  const b2 = host.match(/^s3\.([a-z0-9-]+)\.backblazeb2\.com$/)
  if (b2?.[1]) return b2[1]

  // AWS path-style: s3.eu-west-1.amazonaws.com / s3-eu-west-1.amazonaws.com
  const awsPath = host.match(/^s3[.-]([a-z0-9-]+)\.amazonaws\.com$/)
  if (awsPath?.[1] && awsPath[1] !== 'dualstack' && awsPath[1] !== 'control') {
    return awsPath[1]
  }

  // AWS virtual-hosted: bucket.s3.eu-west-1.amazonaws.com
  const awsVirtual = host.match(/\.s3[.-]([a-z0-9-]+)\.amazonaws\.com$/)
  if (awsVirtual?.[1] && awsVirtual[1] !== 'dualstack') return awsVirtual[1]

  // Cloudflare R2
  if (host.endsWith('.r2.cloudflarestorage.com') || host === 'r2.cloudflarestorage.com') {
    return 'auto'
  }

  // MinIO / custom: no region in host — SigV4 still wants a string.
  return fallback
}
