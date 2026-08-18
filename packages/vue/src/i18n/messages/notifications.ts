import { params } from '@nanostores/i18n'

import { i18n } from '#vue/i18n/create'

export const notificationMessageDefaults = {
  chatInitializationFailed: params('Could not initialize chat: {error}'),
  linkCopied: 'Link copied to clipboard.',
  clipboardMissingDesignData: 'Clipboard does not contain design data.',
  clipboardAccessBlocked: 'Clipboard access is blocked in this browser context.',
  copiedAs: params('Copied as {format}.'),
  pngClipboardUnavailable: 'PNG clipboard export is not available in this browser.',
  openFileFailed: params('Could not open “{name}”: {error}'),
  importedDOMCSS: 'Imported DOM/CSS document.',
  importDOMCSSFailed: params('Could not import DOM/CSS: {error}'),
  openDOMCSSFailed: params('Could not open DOM/CSS file: {error}'),
  vectorizeCredentialRequired: params('Add a {provider} API key in Settings → Media.'),
  vectorizeImageMissing: 'Image data is missing for this layer.',
  vectorizingImage: 'Vectorizing image…',
  imageConvertedToVectors: 'Image converted to vectors.',
  vectorizeCredentialFailed: params('{error}. Update it in Settings → Media.'),
  vectorizeFailed: params('{provider} could not vectorize this image: {error}'),
  operationFailed: params('Operation failed: {error}'),
  storageConnected: 'Connected. Storage namespace is ready.',
  storageConnectionFailed: params('Could not connect to storage: {error}')
} as const

export const notificationMessages = i18n('notifications', notificationMessageDefaults)
