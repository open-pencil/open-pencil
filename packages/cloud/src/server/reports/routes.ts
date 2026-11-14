import { parseFileDocumentReport } from '#cloud/contract'
import { acceptedLocale } from '#cloud/email'
import type { CloudSessionResolver } from '#cloud/server/auth'
import { shareActor } from '#cloud/server/sharing/actor'
import { sharingRoute } from '#cloud/server/sharing/http'
import { shareParams, validatedJSON } from '#cloud/server/validation'
import { Hono } from 'hono'

import { DocumentReportLimitError, type DocumentReportService } from './service'

/** Reports about documents shared by link, which anyone the link lets in may file. */
export function createPublicReportRoutes(
  service: DocumentReportService,
  resolveSession?: CloudSessionResolver
) {
  return new Hono().post(
    '/shares/:shareId/reports',
    shareParams,
    validatedJSON(parseFileDocumentReport),
    async (context) => {
      try {
        return await sharingRoute(context, async () => {
          await service.file(
            context.req.valid('param').shareId,
            context.req.valid('json'),
            await shareActor(context.req.raw, resolveSession),
            acceptedLocale(context.req.header('accept-language'))
          )
          return context.json({ received: true as const }, 201)
        })
      } catch (error) {
        if (error instanceof DocumentReportLimitError) {
          return context.json({ error: { code: 'rate_limited' as const } }, 429)
        }
        throw error
      }
    }
  )
}
