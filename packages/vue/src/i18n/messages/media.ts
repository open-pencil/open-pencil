import { params } from '@nanostores/i18n'

import { i18n } from '#vue/i18n/create'

export const mediaMessageDefaults = {
  vectorization: 'Image vectorization',
  vectorizationDescription:
    'Send image layers to Recraft, fal.ai, or QuiverAI and return editable vectors. Provider charges may apply.',
  vectorizeProvider: 'Vectorization service',
  pexelsAPIKey: 'Pexels API Key (stock photos)',
  unsplashAccessKey: 'Unsplash Access Key',
  stockPhotoToolOptional: 'Optional — for stock_photo tool',
  pexelsAlternativeOptional: 'Optional — alternative to Pexels',
  getPexelsAPIKey: 'Get free Pexels API key →',
  getUnsplashAccessKey: 'Get free Unsplash access key →',
  photoKeyWorks: params('{service} accepted this key.'),
  photoKeyRejected: params('{service} refused this key. Check that you copied all of it.'),
  unsplashKeyRejected:
    'Unsplash refused this key. Paste your app’s Access Key, not its Secret key.',
  photoKeyRateLimited: params(
    'This key has used up its {service} requests for this hour. Try again later.'
  ),
  photoKeyUnreachable: params('Couldn’t reach {service}. Check your network connection.'),
  photoKeyCheckFailed: params('{service} didn’t answer the test. Try again later.')
} as const

export const mediaMessages = i18n('media', mediaMessageDefaults)
