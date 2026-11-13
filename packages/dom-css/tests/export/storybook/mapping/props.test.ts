import { afterAll, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { exportComponentReference } from '#dom-css/export/storybook/mapping/reference'
import ts from 'typescript'

import { mappedFixture, REVISION } from './fixtures'

const folders: string[] = []
afterAll(() => Promise.all(folders.map((folder) => rm(folder, { recursive: true, force: true }))))

test('checks implementation props for React functions/classes and Vue component kinds', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'open-pencil-mapped-props-'))
  folders.push(folder)
  await mkdir(join(folder, 'node_modules/@types'), { recursive: true })
  for (const dependency of ['react', '@types/react', 'vue'])
    await symlink(
      dirname(Bun.resolveSync(`${dependency}/package.json`, import.meta.dir)),
      join(folder, 'node_modules', dependency)
    )
  const implementations = [
    {
      name: 'react-function',
      source: `export function Button(props: { size?: 'sm' | 'lg'; label?: string }) { return null }`
    },
    {
      name: 'react-default-function',
      exported: 'default',
      source: `export default function Button(props: { size?: 'sm' | 'lg'; label?: string }) { return null }`
    },
    {
      name: 'react-class',
      source: `import { Component } from 'react'; export class Button extends Component<{ size?: 'sm' | 'lg'; label?: string }> { render() { return null } }`
    },
    {
      name: 'react-component-type',
      source: `import type { ComponentType } from 'react'; export declare const Button: ComponentType<{ size?: 'sm' | 'lg'; label?: string }>`
    },
    {
      name: 'react-no-props',
      emptyProps: true,
      source: `export function Button() { return null }`
    },
    {
      name: 'vue-functional',
      source: `import type { FunctionalComponent } from 'vue'; export declare const Button: FunctionalComponent<{ size?: 'sm' | 'lg'; label?: string }>`
    },
    {
      name: 'vue-constructor',
      source: `import type { DefineComponent } from 'vue'; export declare const Button: DefineComponent<{ size?: 'sm' | 'lg'; label?: string }>`
    },
    {
      name: 'invalid-props',
      source: `export function Button(props: { size?: 'tiny' | 'huge'; label?: string }) { return null }`
    }
  ]
  const roots: string[] = []
  for (const implementation of implementations) {
    const target = join(folder, implementation.name)
    await mkdir(target)
    await writeFile(join(target, 'Button.ts'), implementation.source)
    const { graph, config, mapping } = mappedFixture()
    let selected = mapping
    if (implementation.emptyProps)
      selected = {
        ...mapping,
        props: {},
        states: mapping.states.map((state) => ({ ...state, args: {} }))
      }
    const files = await exportComponentReference(graph, {
      config,
      mapping: {
        ...selected,
        implementation: { ...mapping.implementation, export: implementation.exported ?? 'Button' }
      },
      revision: REVISION,
      implementationImport: './Button'
    })
    for (const file of files) {
      const path = join(target, file.path)
      await writeFile(path, file.content)
      roots.push(path)
    }
  }
  // One program shares the installed framework types across all emitted reference modules.
  const program = ts.createProgram(roots, {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ES2022,
    types: []
  })
  const diagnostics = ts.getPreEmitDiagnostics(program)
  const positiveErrors = diagnostics.filter(
    (diagnostic) => !diagnostic.file?.fileName.includes('invalid-props')
  )
  expect(
    positiveErrors.map((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
    )
  ).toEqual([])
  const negativeErrors = diagnostics.filter((diagnostic) =>
    diagnostic.file?.fileName.includes('invalid-props')
  )
  expect(negativeErrors.length).toBeGreaterThanOrEqual(2)
  expect(
    negativeErrors.every((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n').includes('not assignable')
    )
  ).toBe(true)
})
