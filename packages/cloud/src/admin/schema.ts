import * as v from 'valibot'

const uuidSchema = v.pipe(v.string(), v.uuid())
/** Accounts and access requests are named by UUID; anything else names no row. */
export const isUUID = (value: string) => v.is(uuidSchema, value)

/** The most rows one admin list request returns. */
export const ADMIN_LIST_MAXIMUM = 500
