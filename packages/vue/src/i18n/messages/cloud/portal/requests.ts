import { params } from '@nanostores/i18n'

/** Messages of the `cloudPortal` namespace for access requests: deciding each one. */
export const requestPortalMessageDefaults = {
  decline: 'Decline',
  removeAccess: 'Remove access',
  declineHeading: params('Decline {name}?'),
  declineDescription: 'They get an email saying so, and can ask again later.',
  removeAccessHeading: params('Remove access for {name}?'),
  removeAccessDescription: 'They can’t sign in any more, and get an email saying so.',
  reviewNote: 'Note for administrators (optional)',
  noteDetail: params('Note: {note}'),
  noOneWaiting: 'No one is waiting',
  nothingHere: 'Nothing here yet',
  requestsEmptyDescription: 'New requests appear here, and administrators get an email for each.'
}
