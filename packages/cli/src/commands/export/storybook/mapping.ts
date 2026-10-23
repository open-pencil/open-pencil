import { createHash } from 'node:crypto'
import { readFile, realpath, stat } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'

import type { StorybookFile } from '@open-pencil/dom-css'
import {
  exportComponentReference,
  parseComponentMappings,
  validateComponentReference
} from '@open-pencil/dom-css/export/storybook/mapping'
import { behaviourProperties } from '@open-pencil/scene-graph/behaviours'

import { applyExportFontPolicy } from '#cli/commands/export/font-policy'
import { ok } from '#cli/format'
import { loadDocumentBytes, populateWholeDocument } from '#cli/headless'

import { createDesignImageRenderer } from './images'

const posixPath = (path: string) => path.split(sep).join('/')

async function readSavedDocument(file: string) {
  if (extname(file) !== '.fig')
    throw new Error('Durable component mappings require a saved .fig document.')
  const bytes = new Uint8Array(await readFile(file))
  const revision = createHash('sha256').update(bytes).digest('hex')
  const graph = await loadDocumentBytes(file, bytes)
  populateWholeDocument(graph)
  return { graph, revision }
}

/** Supported discovery of persistent identities, rather than transient tree-command handles. */
export async function printMappingInfo(file: string): Promise<void> {
  const { graph, revision } = await readSavedDocument(file)
  const path = posixPath(relative(process.cwd(), resolve(file)))
  if (path.startsWith('../') || isAbsolute(path))
    throw new Error(
      'Run --mapping-info from the directory that will hold the mapping file, with the design inside it.'
    )
  const components = Array.from(graph.getAllNodes()).filter(
    (node) =>
      node.type === 'COMPONENT_SET' ||
      (node.type === 'COMPONENT' && graph.getNode(node.parentId ?? '')?.type !== 'COMPONENT_SET')
  )
  console.log(
    JSON.stringify(
      {
        file: path,
        revision,
        components: components.map((node) => ({
          id: node.source.id,
          name: node.name,
          type: node.type,
          properties: behaviourProperties(graph, node).map((property) => ({
            id: property.id,
            name: property.name,
            type: property.type,
            defaultValue: property.defaultValue,
            options: property.variantOptions
          })),
          variants: graph
            .getChildren(node.id)
            .filter((child) => child.type === 'COMPONENT')
            .map((variant) => ({
              id: variant.source.id,
              name: variant.name,
              values: variant.componentPropertyValues
            }))
        }))
      },
      null,
      2
    )
  )
}

interface MappingExportOptions {
  output?: string
  beside?: boolean
  designImages: boolean
  fontPolicy: string
  write: (output: string, scope: { source: string }, files: StorybookFile[]) => Promise<void>
}

/** Check symlinks as well as lexical paths before treating a config-relative file as local. */
async function mappingFile(root: string, path: string): Promise<string> {
  const file = await realpath(resolve(root, path)).catch(() => {
    throw new Error(
      `Mapping file ${path} does not exist relative to the mapping config. Update moved or deleted paths.`
    )
  })
  const relativePath = relative(root, file)
  if (
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath) ||
    !(await stat(file)).isFile()
  )
    throw new Error(`Mapping file ${path} must be a file inside the mapping config directory.`)
  return file
}

/** Resolve the existing ancestor before computing portable imports into a new output folder. */
async function canonicalOutput(path: string): Promise<string> {
  try {
    return await realpath(path)
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error
    const parent = dirname(path)
    if (parent === path) throw error
    return join(await canonicalOutput(parent), basename(path))
  }
}

export async function exportMappedReferences(
  mappingPath: string,
  files: string[],
  options: MappingExportOptions
): Promise<void> {
  if (files.length > 1 && !options.beside && !options.output)
    throw new Error('Several mapped documents need --output or --beside.')
  const configPath = await realpath(resolve(mappingPath))
  const root = await realpath(dirname(configPath))
  const config = parseComponentMappings(await readFile(configPath, 'utf8'))
  // Validate every configured locator before publishing any references, including unselected ones.
  const sources = new Map<string, string>()
  const implementations = new Map<string, string>()
  for (const mapping of config.components) {
    sources.set(mapping.design.file, await mappingFile(root, mapping.design.file))
    implementations.set(mapping.key, await mappingFile(root, mapping.implementation.import))
  }
  const prepared: { file: string; output: string; source: string; references: StorybookFile[] }[] =
    []
  for (const file of files) {
    const canonical = await realpath(resolve(file))
    const mappings = config.components.filter(
      (mapping) => sources.get(mapping.design.file) === canonical
    )
    if (mappings.length === 0)
      throw new Error(
        `No mappings reference ${file}. Update design.file relative to the mapping config.`
      )
    const { graph, revision } = await readSavedDocument(canonical)
    for (const mapping of mappings) {
      if (mapping.design.revision && mapping.design.revision !== revision)
        throw new Error(
          `Mapping ${mapping.key} is stale: expected ${mapping.design.revision}, read ${revision}. Review and update the revision pin.`
        )
      validateComponentReference(graph, mapping)
    }
    if (options.designImages)
      await applyExportFontPolicy(
        graph,
        graph.getPages().map((page) => page.id),
        'PNG',
        options.fontPolicy
      )
    const output = options.beside
      ? dirname(canonical)
      : await canonicalOutput(resolve(options.output ?? `${basename(file, '.fig')}-references`))
    const references: StorybookFile[] = []
    for (const mapping of mappings) {
      const implementation = implementations.get(mapping.key)
      if (!implementation)
        throw new Error(`Implementation for mapping ${mapping.key} was not resolved.`)
      const importPath = posixPath(relative(output, implementation))
      references.push(
        ...(await exportComponentReference(graph, {
          config,
          mapping,
          revision,
          implementationImport:
            importPath.startsWith('./') || importPath.startsWith('../')
              ? importPath
              : `./${importPath}`,
          renderDesignImage: options.designImages ? createDesignImageRenderer(graph) : undefined
        }))
      )
    }
    // Reference-only mode owns a separate namespace; it cannot remove ordinary generated stories.
    const source = `mapping:${JSON.stringify([posixPath(relative(output, configPath)), posixPath(relative(output, canonical))])}`
    prepared.push({ file, output, source, references })
  }
  for (const item of prepared) {
    await options.write(item.output, { source: item.source }, item.references)
    console.log(
      ok(
        `Exported ${item.references.filter((file) => file.path.endsWith('.design.ts')).length} reference modules from ${item.file} to ${item.output}`
      )
    )
  }
}
