import { provideXMLParser } from '#cloud/runtime/cloudflare/xml'
import { CopyObjectCommand, S3Client } from '@aws-sdk/client-s3'

// Bundled by Wrangler and run in workerd: the store refuses a copy with an S3 error in XML, and
// the Worker answers with what the SDK made of it.
const S3_ERROR = new TextEncoder().encode(
  '<?xml version="1.0" encoding="UTF-8"?><Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>'
)

provideXMLParser()

const client = new S3Client({
  endpoint: 'https://s3.example.com',
  region: 'auto',
  credentials: { accessKeyId: 'key', secretAccessKey: 'secret' },
  maxAttempts: 1,
  requestHandler: {
    handle: async () => ({
      response: {
        statusCode: 403,
        headers: { 'content-type': 'application/xml' },
        body: S3_ERROR
      }
    })
  }
})

export default {
  async fetch() {
    try {
      await client.send(
        new CopyObjectCommand({ Bucket: 'bucket', Key: 'deleted/file', CopySource: 'bucket/file' })
      )
      return Response.json({ name: null })
    } catch (error) {
      return Response.json({ name: error instanceof Error ? error.name : String(error) })
    }
  }
}
