import { code } from '@stream-markdown/code'

export const markdownExtensions = {
  code: code({
    theme: ['github-light', 'github-dark'],
    langs: [
      'bash',
      'css',
      'html',
      'javascript',
      'json',
      'markdown',
      'tsx',
      'typescript',
      'vue',
      'yaml'
    ]
  })
}

export function createMarkdownHardenOptions(origin: string) {
  const appOrigin = new URL('/', origin).href

  return {
    allowedLinkPrefixes: ['*'],
    allowedImagePrefixes: [appOrigin],
    allowedProtocols: ['http', 'https', 'mailto'],
    allowDataImages: false
  }
}
