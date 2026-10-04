import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import {
  CODE_SYNTAX_PLATFORMS,
  VARIABLE_SCOPES,
  type CodeSyntaxPlatform,
  type PluginDataEntry,
  type Variable,
  type VariableScope
} from '@open-pencil/scene-graph'

import { extractPluginData, mergePluginData } from '../plugin-data'

type VariableMetadata = Pick<
  Variable,
  'description' | 'hiddenFromPublishing' | 'scopes' | 'codeSyntax' | 'pluginData'
>

const isScope = (value: string): value is VariableScope =>
  (VARIABLE_SCOPES as readonly string[]).includes(value)

const isPlatform = (value: string): value is CodeSyntaxPlatform =>
  (CODE_SYNTAX_PLATFORMS as readonly string[]).includes(value)

function readCodeSyntax(nc: NodeChange): Variable['codeSyntax'] {
  const entries = (nc.codeSyntax?.entries ?? []).flatMap(({ platform, value }) =>
    isPlatform(platform) && value ? [[platform, value] as const] : []
  )
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

/** Figma keeps the description twice, as `description` and `symbolDescription`. */
export function readVariableMetadata(nc: NodeChange): VariableMetadata {
  const scopes = nc.variableScopes?.filter(isScope)
  const pluginData = extractPluginData(nc)
  return {
    description: nc.description ?? nc.symbolDescription ?? '',
    hiddenFromPublishing: nc.isPublishable === false,
    scopes: scopes?.length ? scopes : undefined,
    codeSyntax: readCodeSyntax(nc),
    pluginData: pluginData.length > 0 ? pluginData : undefined
  }
}

export function variableMetadataNodeChange(variable: Variable): Partial<NodeChange> {
  const codeSyntax = Object.entries(variable.codeSyntax ?? {}).flatMap(([platform, value]) =>
    value ? [{ platform, value }] : []
  )
  const nc: Partial<NodeChange> = {
    isPublishable: !variable.hiddenFromPublishing,
    variableScopes: variable.scopes?.length ? variable.scopes : ['ALL_SCOPES'],
    pluginData: pluginDataNodeChange(variable.pluginData)
  }
  if (variable.description) {
    nc.description = variable.description
    nc.symbolDescription = variable.description
  }
  if (codeSyntax.length > 0) nc.codeSyntax = { entries: codeSyntax }
  return nc
}

export function pluginDataNodeChange(
  pluginData: PluginDataEntry[] | undefined
): NodeChange['pluginData'] {
  return pluginData?.length ? mergePluginData(pluginData) : undefined
}
