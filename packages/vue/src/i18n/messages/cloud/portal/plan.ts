import { params } from '@nanostores/i18n'

/** Messages of the `cloudPortal` namespace for an account's plan, storage and credits. */
export const planPortalMessageDefaults = {
  plan: 'Plan',
  planDescription: 'What your account includes, and what you pay for.',
  planFree: 'Free',
  planRenews: params('Renews on {date}.'),
  planEnds: params('Ends on {date}. Your files stay, read-only beyond the free storage.'),
  planPastDue: 'Your last payment didn’t go through',
  planPastDueDescription:
    'We’ll try again over the next two weeks. Update your card in Manage billing to keep your plan.',
  planStorage: 'Storage',
  planStorageOf: params('{used} of {total} used, across the workspaces you own'),
  planStorageUsed: params('{used} used, across the workspaces you own'),
  planStorageFull: 'Your files are read-only',
  planStorageFullDescription:
    'They use all the storage your plan includes. Delete files or get more storage to edit again.',
  planMonthlyCredits: 'Credits each month',
  planCredits: params('{credits} credits'),
  planNoCredits: 'Not included',
  planOffers: 'Plans',
  planOffersDescription: 'Billed monthly in US dollars, plus tax where it applies. Cancel anytime.',
  planOfferPrice: params('{price} a month'),
  planOfferIncludes: params('{storage} of storage and {credits} credits every month'),
  planSubscribe: params('Get {name}'),
  manageBilling: 'Manage billing',
  creditPacks: 'More credits',
  creditPacksDescription: 'For AI and search beyond your monthly credits.',
  creditPackDetail: params('{price}, valid for {days} days'),
  creditPackBuy: 'Buy',
  billingUnavailable: 'Plans and payments can’t be reached right now',
  billingUnavailableDescription: 'Your plan still applies meanwhile.'
}
