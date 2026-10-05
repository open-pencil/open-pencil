import { APP_VERSION } from '@/constants'

/** The Harness companion runs Pi; it is installed separately and must match the app version. */
export const HARNESS_EXECUTABLE = 'openpencil-harness'
export const HARNESS_PACKAGE = '@open-pencil/harness'
export const HARNESS_INSTALL_TARGET = `${HARNESS_PACKAGE}@${APP_VERSION}`
