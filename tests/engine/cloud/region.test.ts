import { describe, expect, test } from 'bun:test'

import { inferS3Region } from '@/app/cloud/s3/region'

describe('inferS3Region', () => {
  test('parses Backblaze B2 endpoints', () => {
    expect(inferS3Region('https://s3.eu-central-003.backblazeb2.com')).toBe('eu-central-003')
    expect(inferS3Region('s3.us-west-004.backblazeb2.com')).toBe('us-west-004')
  })

  test('parses AWS path-style endpoints', () => {
    expect(inferS3Region('https://s3.eu-west-1.amazonaws.com')).toBe('eu-west-1')
    expect(inferS3Region('https://s3-us-east-1.amazonaws.com')).toBe('us-east-1')
  })

  test('uses auto for Cloudflare R2', () => {
    expect(inferS3Region('https://abc123.r2.cloudflarestorage.com')).toBe('auto')
  })

  test('falls back for custom MinIO hosts', () => {
    expect(inferS3Region('https://minio.example.com')).toBe('us-east-1')
  })
})
