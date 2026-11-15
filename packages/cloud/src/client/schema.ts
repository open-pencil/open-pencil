import { collaborationTicketSchema, documentSummarySchema } from '#cloud/contract'
import * as v from 'valibot'

/** What the API answers with one document, as creating, restoring, or duplicating one does. */
export const documentResponseSchema = v.object({ document: documentSummarySchema })

/** What the API answers with a ticket into a document's live room. */
export const collaborationTicketResponseSchema = v.object({ ticket: collaborationTicketSchema })
