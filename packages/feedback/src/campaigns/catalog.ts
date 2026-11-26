import { campaignSchema, type Campaign } from '#feedback/contract'
import * as v from 'valibot'

/**
 * The campaigns every ping answers with, read through the contract when the Worker starts, so a
 * campaign the app could not read never ships. A merged change redeploys the Worker; the app
 * picks it up at its next ping, with no release. Empty until a campaign is switched on.
 */
export const CAMPAIGNS: readonly Campaign[] = v.parse(v.array(campaignSchema), [])
