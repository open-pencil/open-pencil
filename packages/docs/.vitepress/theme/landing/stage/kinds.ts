import type { FeatureKind } from '../content/features'

/** Stages with one editor; the collaboration stage composes two of its own. */
export type SingleStageKind = Exclude<FeatureKind, 'collab'>
