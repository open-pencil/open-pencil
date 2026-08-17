export type S3CompatibleConfig = {
  endpoint: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  region?: string
}

export type S3ConnectionResult = {
  ok: boolean
  message: string
  corsApplied: boolean
  isCORSFailure: boolean
  corsError: string | null
}
