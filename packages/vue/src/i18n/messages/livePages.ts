import { i18n } from '#vue/i18n/create'

export const livePageMessageDefaults = {
  title: 'Live page',
  url: 'Page address',
  urlPlaceholder: 'http://localhost:3000/pricing',
  link: 'Show page',
  unlink: 'Remove page',
  reload: 'Reload page',
  open: 'Open in browser',
  openAll: 'Open all pages',
  openAllHint: 'Pages are read from the project this document is saved in.',
  routeParams: 'Route parameters',
  routeParamsPlaceholder: 'slug=hello, id=42',
  exportVue: 'Export as Vue component',
  selectedInPage: 'Selected in page',
  copySelection: 'Copy the file and line',
  hint: 'The frame shows this address from the application the project runs.'
} as const

export const livePageMessages = i18n('livePages', livePageMessageDefaults)
