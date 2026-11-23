import { params } from '@nanostores/i18n'

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
