import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

import ts from 'typescript'

import { FIGMA_RAW_NODE_FIELD_KEYS } from '#core/kiwi/fig/node-change/convert'
import { parseSchema } from '#core/kiwi/schema-runtime'

interface SchemaField {
  name: string
  type: string | null
}

type SchemaCoverageBucket =
  | 'modeled'
  | 'rawPreserved'
  | 'schemaTag'
  | 'styleLibraryMetadata'
  | 'componentInstanceMetadata'
  | 'textMetadata'
  | 'visualGeometryMetadata'
  | 'layoutMetadata'
  | 'prototypeConnectorMetadata'
  | 'widgetMetadata'
  | 'slideFigjamMetadata'
  | 'variableDevMetadata'
  | 'codeCmsAiMetadata'
  | 'mediaMotionMetadata'
  | 'internalBookkeeping'

const SCHEMA_PATH = 'packages/core/src/kiwi/fig/codec/schema/fig.kiwi'
const CODEC_PATH = 'packages/core/src/kiwi/fig/codec/index.ts'

function nodeChangeSchemaFields(): SchemaField[] {
  const schema = parseSchema(readFileSync(SCHEMA_PATH, 'utf8'))
  const nodeChange = schema.definitions.find((definition) => definition.name === 'NodeChange')
  if (!nodeChange) throw new Error('NodeChange message is missing from fig.kiwi')
  return nodeChange.fields.map((field) => ({ name: field.name, type: field.type }))
}

function modeledNodeChangeFields(): Set<string> {
  const source = ts.createSourceFile(
    CODEC_PATH,
    readFileSync(CODEC_PATH, 'utf8'),
    ts.ScriptTarget.Latest,
    true
  )
  const fields = new Set<string>()

  function visit(node: ts.Node): void {
    if (ts.isInterfaceDeclaration(node) && node.name.text === 'NodeChange') {
      for (const member of node.members) {
        if (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name)) {
          fields.add(member.name.text)
        }
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(source)
  return fields
}

function includesAny(value: string, parts: string[]): boolean {
  return parts.some((part) => value.includes(part))
}

function classifySchemaOnlyField(
  field: SchemaField
): Exclude<SchemaCoverageBucket, 'modeled' | 'rawPreserved'> | null {
  const name = field.name
  const lower = name.toLowerCase()
  const type = field.type ?? ''

  if (name.endsWith('Tag')) return 'schemaTag'

  if (
    includesAny(lower, [
      'style',
      'library',
      'publish',
      'asset',
      'nonupdateable',
      'ojans',
      'sevmoonlitlily'
    ])
  ) {
    return 'styleLibraryMetadata'
  }

  if (
    includesAny(lower, [
      'symbol',
      'component',
      'variant',
      'override',
      'slot',
      'module',
      'guidpath',
      'unflattening',
      'bubble'
    ])
  ) {
    return 'componentInstanceMetadata'
  }

  if (
    includesAny(lower, [
      'font',
      'opentype',
      'otfeatures',
      'text',
      'paragraph',
      'lineheight',
      'letterspacing',
      'ligature',
      'numeric',
      'caps',
      'leadingtrim',
      'hanging',
      'glyph',
      'hyperlink',
      'mention',
      'semantic',
      'responsive',
      'list'
    ])
  ) {
    return 'textMetadata'
  }

  if (
    includesAny(lower, [
      'fill',
      'stroke',
      'paint',
      'effect',
      'mask',
      'background',
      'corner',
      'transform',
      'rectangle',
      'constraint',
      'proportion',
      'border',
      'geometry',
      'scene3d',
      'vector',
      'arc',
      'handlemirroring',
      'starinnerscale',
      'pathtrim',
      'brush',
      'dash',
      'miter',
      'opacity',
      'blendmode',
      'size',
      'visible',
      'locked',
      'lockmode',
      'rotation',
      'absolutebounds'
    ])
  ) {
    return 'visualGeometryMetadata'
  }

  if (
    includesAny(lower, [
      'stack',
      'grid',
      'layout',
      'scroll',
      'container',
      'resize',
      'child',
      'fixedchildren',
      'breakpoint',
      'contracted',
      'readingdirection',
      'readingindex'
    ])
  ) {
    return 'layoutMetadata'
  }

  if (
    includesAny(lower, [
      'prototype',
      'transition',
      'interaction',
      'connection',
      'connector',
      'annotation',
      'measurement',
      'overlay',
      'destination',
      'easing',
      'navigation',
      'keytrigger',
      'voiceevent'
    ])
  ) {
    return 'prototypeConnectorMetadata'
  }

  if (lower.includes('widget')) return 'widgetMetadata'

  if (
    includesAny(lower, [
      'slide',
      'figjam',
      'shape',
      'section',
      'stamp',
      'table',
      'snakegame',
      'diagram',
      'flapp',
      'agenda',
      'page',
      'presentation',
      'theme'
    ])
  ) {
    return 'slideFigjamMetadata'
  }

  if (
    includesAny(lower, [
      'variable',
      'collection',
      'timing',
      'parameter',
      'dev',
      'handoff',
      'aria',
      'accessible',
      'htmltag',
      'decorativeimage'
    ])
  ) {
    return 'variableDevMetadata'
  }

  if (
    includesAny(lower, [
      'code',
      'jsx',
      'cms',
      'repeater',
      'ai',
      'generation',
      'chat',
      'buzz',
      'cooper',
      'draft',
      'make',
      'spec',
      'hub',
      'managedstring',
      'thumbnail',
      'placeholder',
      'customtool',
      'sourcecontrol',
      'imageimport',
      'backingnode',
      'mime',
      'blobref',
      'artifact'
    ])
  ) {
    return 'codeCmsAiMetadata'
  }

  if (
    includesAny(lower, [
      'video',
      'media',
      'syncedstate',
      'embed',
      'motion',
      'timeline',
      'keyframe',
      'interpolation',
      'bezier',
      'clip',
      'playback',
      'animation',
      'tools',
      'customeffects',
      'smartanimate'
    ])
  ) {
    return 'mediaMotionMetadata'
  }

  if (
    includesAny(lower, [
      'guid',
      'phase',
      'parentindex',
      'type',
      'name',
      'description',
      'version',
      'sortposition',
      'key',
      'internal',
      'autorename',
      'count',
      'export',
      'paste',
      'deleted',
      'editinfo',
      'colorprofile',
      'stability',
      'migration',
      'ancestorpathbeforedeletion',
      'root',
      'belongs',
      'isprimary',
      'multieditglueid',
      'autofork',
      'manuallyrenamed',
      'isc2',
      'behavior',
      'linkpreview',
      'editscope',
      'simplifyinstancepanels',
      'source',
      'file',
      'disablejitdst'
    ]) ||
    type.startsWith('Internal')
  ) {
    return 'internalBookkeeping'
  }

  return null
}

function classifyField(
  field: SchemaField,
  modeled: Set<string>,
  rawPreserved: Set<string>
): SchemaCoverageBucket | null {
  if (modeled.has(field.name)) return 'modeled'
  if (rawPreserved.has(field.name)) return 'rawPreserved'
  return classifySchemaOnlyField(field)
}

describe('Figma Kiwi schema coverage', () => {
  test('classifies every NodeChange schema field', () => {
    const modeled = modeledNodeChangeFields()
    const rawPreserved = new Set<string>(FIGMA_RAW_NODE_FIELD_KEYS)
    const fields = nodeChangeSchemaFields()
    const buckets = new Map<SchemaCoverageBucket, string[]>()
    const unclassified: SchemaField[] = []

    for (const field of fields) {
      const bucket = classifyField(field, modeled, rawPreserved)
      if (!bucket) {
        unclassified.push(field)
        continue
      }
      buckets.set(bucket, [...(buckets.get(bucket) ?? []), field.name])
    }

    expect(unclassified).toEqual([])
    expect(
      Object.fromEntries([...buckets].map(([bucket, items]) => [bucket, items.length]))
    ).toEqual({
      modeled: 104,
      schemaTag: 60,
      internalBookkeeping: 17,
      rawPreserved: 52,
      styleLibraryMetadata: 39,
      componentInstanceMetadata: 42,
      textMetadata: 23,
      slideFigjamMetadata: 39,
      visualGeometryMetadata: 38,
      layoutMetadata: 29,
      prototypeConnectorMetadata: 32,
      variableDevMetadata: 14,
      widgetMetadata: 11,
      codeCmsAiMetadata: 67,
      mediaMotionMetadata: 23
    })
  })

  test('keeps high-value schema fields modeled or raw-preserved', () => {
    const modeled = modeledNodeChangeFields()
    const rawPreserved = new Set<string>(FIGMA_RAW_NODE_FIELD_KEYS)
    const covered = (name: string) => modeled.has(name) || rawPreserved.has(name)

    expect(covered('fillPaints')).toBe(true)
    expect(covered('strokePaints')).toBe(true)
    expect(covered('effects')).toBe(true)
    expect(covered('vectorData')).toBe(true)
    expect(covered('derivedTextData')).toBe(true)
    expect(covered('leadingTrim')).toBe(true)
    expect(covered('textDecorationStyle')).toBe(true)
    expect(covered('semanticWeight')).toBe(true)
    expect(covered('semanticItalic')).toBe(true)
    expect(covered('toggledOnOTFeatures')).toBe(true)
    expect(covered('toggledOffOTFeatures')).toBe(true)
    expect(covered('textDecorationFillPaints')).toBe(true)
    expect(covered('textUnderlineOffset')).toBe(true)
    expect(covered('textDecorationThickness')).toBe(true)
    expect(covered('mask')).toBe(true)
    expect(covered('maskType')).toBe(true)
    expect(covered('maskIsOutline')).toBe(true)
    expect(covered('layoutGrids')).toBe(true)
    expect(covered('gridChildVerticalAlign')).toBe(true)
    expect(covered('gridChildHorizontalAlign')).toBe(true)
    expect(covered('slideThemeMap')).toBe(true)
  })
})
