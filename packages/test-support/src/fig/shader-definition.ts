import type { GUID } from '@open-pencil/kiwi/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

/** The library shader a test's shader paints name. */
export const SHADER_ASSET = { key: 'abc', version: 'v1' }

/** What a shader's definition on Figma's internal page carries besides its place. */
export const SHADER_DEFINITION_FIELDS = {
  ...SHADER_ASSET,
  codeObjectType: 'CUSTOM_FILL',
  customToolArtifactRef: { publishedCustomToolId: '123', customToolVersion: '2' },
  componentPropDefs: [
    { id: { sessionID: 7, localID: 8 }, name: 'Amount', type: 'NUMBER', sortPosition: 'a' }
  ]
} satisfies Partial<NodeChange>

/** Figma's internal page holding one shader definition, as a file or a copy writes it. */
export function shaderDefinitionRecords(
  documentGuid: GUID,
  canvasGuid: GUID,
  definitionGuid: GUID
): NodeChange[] {
  return [
    {
      guid: canvasGuid,
      type: 'CANVAS',
      phase: 'CREATED',
      name: 'Internal Only Canvas',
      internalOnly: true,
      parentIndex: { guid: documentGuid, position: '~' }
    },
    {
      guid: definitionGuid,
      type: 'CODE_COMPONENT',
      phase: 'CREATED',
      name: 'Shader',
      visible: false,
      locked: true,
      size: { x: 100, y: 100 },
      parentIndex: { guid: canvasGuid, position: '!' },
      ...SHADER_DEFINITION_FIELDS
    }
  ] as NodeChange[]
}

/** The definitions among written records, with the fields a test compares. */
export function writtenShaderDefinitions(records: readonly NodeChange[]) {
  return records
    .filter((record) => record.type === 'CODE_COMPONENT')
    .map((record) => ({
      key: record.key,
      version: record.version,
      codeObjectType: record.codeObjectType,
      customToolArtifactRef: record.customToolArtifactRef,
      componentPropDefs: record.componentPropDefs
    }))
}
