import { params } from '@nanostores/i18n'

import { i18n } from '#vue/i18n/create'

export const pageMessageDefaults = {
  newPage: 'New page',
  rename: 'Rename',
  delete: 'Delete',
  pageName: params('Page {number}'),
  pages: 'Pages',
  goToPage: 'Go to page…',
  recentPage: 'Recent',
  currentPage: 'Current page',
  pageNameLabel: 'Page name'
} as const

export const pageMessages = i18n('pages', pageMessageDefaults)
