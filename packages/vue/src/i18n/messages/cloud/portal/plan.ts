import { params } from '@nanostores/i18n'

/** Messages of the `cloudPortal` namespace for an account's plan, storage and credits. */
export const planPortalMessageDefaults = {
  plan: 'Plan',
  planDescription: 'What your account includes, and what you pay for.',
  planStorage: 'Storage',
  planStorageOf: params('{used} of {total} used, across the workspaces you own'),
  planStorageUsed: params('{used} used, across the workspaces you own'),
  planStorageFull: 'Your files are read-only',
  planStorageFullDescription:
    'They use all the storage your plan includes. Delete files or get more storage to edit again.',
  planMonthlyCredits: 'Credits each month',
  planCredits: params('{credits} credits'),
  planNoCredits: 'Not included',
  planBilling: 'Plans and billing',
  planBillingDescription: 'Change your plan, buy more credits, and see your invoices.',
  planOpenBilling: 'Open billing'
}
