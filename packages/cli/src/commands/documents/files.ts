import { resolve } from 'node:path'

import { defineCommand } from 'citty'

import { runAppCommand } from '#cli/app/command'
import { appTargetOptions, appTargetRPCArgs } from '#cli/app/target'
import { ok, printError } from '#cli/format'

const json = { type: 'boolean', description: 'Output as JSON' } as const

// The app resolves paths against its own working directory, so send absolute ones.
function absolutePath(path: string | undefined): { path?: string } {
  return path ? { path: resolve(path) } : {}
}

export const open = defineCommand({
  meta: { description: 'Open a .fig or .pen file in a new tab of the running app' },
  args: {
    file: { type: 'positional', description: 'Design file to open', required: true },
    json
  },
  run: ({ args }) =>
    runAppCommand('open_file', absolutePath(args.file), {
      json: args.json,
      message: () => ok(`Opened ${args.file}`)
    })
})

export const create = defineCommand({
  meta: { description: 'Create an empty document in a new tab of the running app' },
  args: {
    path: { type: 'string', description: 'Save the new document to this .fig path' },
    json
  },
  run: ({ args }) =>
    runAppCommand('new_document', absolutePath(args.path), {
      json: args.json,
      message: () => ok('Created document')
    })
})

export const save = defineCommand({
  meta: { description: 'Save a document open in the running app' },
  args: {
    path: { type: 'string', description: 'Save to this .fig path instead of the current one' },
    ...appTargetOptions,
    json
  },
  run: ({ args }) =>
    runAppCommand(
      'save_file',
      { ...appTargetRPCArgs(args), ...absolutePath(args.path) },
      {
        json: args.json,
        message: () => ok('Saved document')
      }
    )
})

export const close = defineCommand({
  meta: {
    description:
      'Close a document tab; with unsaved changes, pass --save or --discard (it never prompts in the app)'
  },
  args: {
    save: { type: 'boolean', description: 'Save unsaved changes first' },
    discard: { type: 'boolean', description: 'Close without saving, losing unsaved changes' },
    path: { type: 'string', description: 'With --save: .fig path for a document never saved' },
    ...appTargetOptions,
    json
  },
  run: ({ args }) => {
    if (args.save && args.discard) {
      printError('Pass either --save or --discard, not both')
      process.exit(1)
    }
    const rpcArgs: Record<string, unknown> = {
      ...appTargetRPCArgs(args),
      ...absolutePath(args.path)
    }
    if (args.save) rpcArgs.unsaved = 'save'
    if (args.discard) rpcArgs.unsaved = 'discard'
    return runAppCommand('close_file', rpcArgs, {
      json: args.json,
      message: (result) =>
        (result as { closed?: boolean }).closed ? ok('Closed document') : 'Document stayed open'
    })
  }
})

export const activate = defineCommand({
  meta: { description: 'Bring a document tab to the front, optionally on a given page' },
  args: {
    id: { type: 'positional', description: 'Document ID from `documents list`', required: true },
    'page-id': appTargetOptions['page-id'],
    json
  },
  run: ({ args }) =>
    runAppCommand(
      'activate_document',
      appTargetRPCArgs({ 'document-id': args.id, 'page-id': args['page-id'] }),
      { json: args.json, message: () => ok('Activated document') }
    )
})
