import { i18n } from '#vue/i18n/create'

export const mediaMessageDefaults = {
  vectorization: 'Image vectorization',
  vectorizationDescription:
    'Send image layers to Recraft or fal.ai and return editable vectors. Provider charges may apply.',
  vectorizeProvider: 'Vectorization service',
  pexelsAPIKey: 'Pexels API Key (stock photos)',
  unsplashAccessKey: 'Unsplash Access Key',
  stockPhotoToolOptional: 'Optional — for stock_photo tool',
  pexelsAlternativeOptional: 'Optional — alternative to Pexels',
  getPexelsAPIKey: 'Get free Pexels API key →',
  getUnsplashAccessKey: 'Get free Unsplash access key →'
} as const

export const mediaMessages = i18n('media', mediaMessageDefaults)
