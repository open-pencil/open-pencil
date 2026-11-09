import { params } from '@nanostores/i18n'

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
  hint: 'The frame shows this address from the application the project runs.',
  baselines: 'Baselines',
  keepBaseline: 'Keep as baseline',
  compareBaseline: 'Compare',
  compareAll: 'Compare all pages',
  baselineMissing: 'No picture of this page is kept yet.',
  baselineKept: 'A baseline is kept. Compare it with the page to see whether the page still matches.',
  baselineSame: 'The page still looks like its baseline.',
  baselineChanged: 'The page has changed since its baseline.',
  baselineTaken: params('Baseline taken {date}'),
  baselineHint:
    'A baseline is a picture of the page, compared by its fingerprint. The picture is taken on the desktop, in a browser this machine already has.',
  baselineNotDrawn:
    'The page could not be drawn. Check that the project is running, and that Chrome, Chromium, or Edge is installed.',
  baselineNotSaved: 'The baselines could not be written to the document.'
} as const

export const livePageMessages = i18n('livePages', livePageMessageDefaults)
