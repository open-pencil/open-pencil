export {
  clearS3Credentials,
  cloudProviderId,
  isCloudConfigured,
  isS3ConfigComplete,
  prefillCloudCredentialsFromEnv,
  readS3Config,
  s3AccessKeyId,
  s3Bucket,
  s3Endpoint,
  s3SecretAccessKey,
  setS3Credentials
} from '@/app/cloud/credentials'
export { inferS3Region } from '@/app/cloud/s3/region'
export { beginCloudActivity, cloudActivityMessage, withCloudActivity } from '@/app/cloud/activity'
export { getActiveCloudAdapter, requireActiveCloudAdapter } from '@/app/cloud/active'
export { createCanvasId } from '@/app/cloud/id'
export { nextUniqueCloudName } from '@/app/cloud/unique-name'
export {
  getLocalCanvasStore,
  createMemoryLocalCanvasStore,
  type LocalCanvasMeta,
  type LocalSyncStatus
} from '@/app/cloud/local-store'
export {
  clearCloudLocalMirror,
  enqueueDeleteCanvas,
  enqueuePutCanvas,
  enqueuePutThumb,
  kickSyncEngine,
  pendingSyncCount,
  syncStatusLabel,
  syncUiState
} from '@/app/cloud/sync'
export {
  validateDesignImportBytes,
  validateFigBytes,
  validatePenBytes
} from '@/app/cloud/validate-import'
export type { DesignImportValidation } from '@/app/cloud/validate-import'
export {
  encodeThumbnailJpeg,
  extractFigThumbnailPng,
  isProvisionalCloudThumbnail,
  renderBlankCanvasThumbnailJpeg,
  renderGraphThumbnailPng,
  thumbnailBytesToObjectUrl,
  uploadCanvasThumbnail,
  uploadFigThumbnail
} from '@/app/cloud/thumbnail'
export { CLOUD_NAMESPACE, canvasFigKey, canvasIdFromFigKey } from '@/app/cloud/namespace'
export { CLOUD_PROVIDERS, createCloudAdapter, getCloudProviderDef } from '@/app/cloud/registry'
export {
  buildCorsConfigurationJson,
  buildCorsConfigurationXml,
  collectCloudCorsOrigins,
  CloudCorsError,
  putBucketCors
} from '@/app/cloud/s3/cors'
export type {
  CloudCanvas,
  CloudCanvasMeta,
  CloudConnectionTestResult,
  CloudDocumentBinding,
  CloudProviderId,
  CloudStorageAdapter,
  S3CompatibleConfig
} from '@/app/cloud/types'
