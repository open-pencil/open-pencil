#!/usr/bin/env bun
import { readFile } from 'node:fs/promises'
import { Readable, Writable } from 'node:stream'

import { AgentSideConnection, ndJsonStream } from '@agentclientprotocol/sdk'

import { createAgent } from './agent.js'

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf-8'))

const writable = Writable.toWeb(process.stdout)
const readable = Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>
const stream = ndJsonStream(writable, readable)

new AgentSideConnection(
  (conn) => createAgent(conn, pkg.version),
  stream
)
