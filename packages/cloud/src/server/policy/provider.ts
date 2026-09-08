import {
  type EvaluationContext,
  type Logger,
  type Provider,
  type ProviderMetadata,
  type ResolutionDetails
} from '@openfeature/server-sdk'

import type { EntitlementSource, EntitlementSubject } from './entitlements'

function subject(context: EvaluationContext): EntitlementSubject {
  const type = context.subjectType
  return {
    type: type === 'user' || type === 'organization' || type === 'deployment' ? type : 'workspace',
    id: context.targetingKey ?? 'deployment'
  }
}

export class EntitlementOpenFeatureProvider implements Provider {
  readonly metadata: ProviderMetadata = { name: 'openpencil-entitlements' }
  readonly runsOn = 'server' as const

  constructor(private readonly source: EntitlementSource) {}

  async resolveBooleanEvaluation(
    flagKey: string,
    defaultValue: boolean,
    context: EvaluationContext,
    _logger: Logger
  ): Promise<ResolutionDetails<boolean>> {
    const value = await this.source.boolean(subject(context), flagKey)
    return value === null
      ? { value: defaultValue, reason: 'DEFAULT' }
      : { value, reason: 'TARGETING_MATCH' }
  }

  async resolveNumberEvaluation(
    flagKey: string,
    defaultValue: number,
    context: EvaluationContext,
    _logger: Logger
  ): Promise<ResolutionDetails<number>> {
    const value = await this.source.number(subject(context), flagKey)
    return value === null
      ? { value: defaultValue, reason: 'DEFAULT' }
      : { value, reason: 'TARGETING_MATCH' }
  }

  async resolveStringEvaluation(
    flagKey: string,
    defaultValue: string,
    context: EvaluationContext,
    _logger: Logger
  ): Promise<ResolutionDetails<string>> {
    const value = await this.source.string(subject(context), flagKey)
    return value === null
      ? { value: defaultValue, reason: 'DEFAULT' }
      : { value, reason: 'TARGETING_MATCH' }
  }

  async resolveObjectEvaluation<T>(
    _flagKey: string,
    defaultValue: T
  ): Promise<ResolutionDetails<T>> {
    return { value: defaultValue, reason: 'DEFAULT' }
  }
}
