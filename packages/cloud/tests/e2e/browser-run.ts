import { resolve } from 'node:path'

import { composeCommand, runProcess } from '#cloud-test/helpers/process'

const deployDirectory = resolve(import.meta.dir, '../../deploy')
const repositoryDirectory = resolve(import.meta.dir, '../../../..')
const projectName = `openpencil-cloud-browser-e2e-${process.pid}`
const compose = composeCommand(projectName, 'compose.yml')
let cloud: ReturnType<typeof Bun.spawn> | null = null
let playwrightExitCode = 1

async function run(command: string[], cwd = deployDirectory): Promise<void> {
  await runProcess(command, {
    cwd,
    environment: { ...Bun.env, S3_BUCKET: Bun.env.S3_BUCKET ?? 'openpencil' }
  })
}

type CloudBrowserE2EFixture = {
  serverURL: string
  workspaceId: string
  documentId: string
}

async function waitForCloud(
  process: ReturnType<typeof Bun.spawn>
): Promise<CloudBrowserE2EFixture> {
  const stdout = process.stdout
  if (!(stdout instanceof ReadableStream)) {
    throw new Error('Cloud browser E2E server stdout is unavailable')
  }
  const reader = stdout.getReader()
  const decoder = new TextDecoder()
  let output = ''
  while (true) {
    const result = await reader.read()
    if (result.done) throw new Error('Cloud browser E2E server exited before becoming ready')
    output += decoder.decode(result.value, { stream: true })
    const newline = output.indexOf('\n')
    if (newline === -1) continue
    const line = output.slice(0, newline)
    output = output.slice(newline + 1)
    console.log(line)
    if (line.startsWith('OPENPENCIL_CLOUD_E2E_READY ')) {
      return JSON.parse(line.slice('OPENPENCIL_CLOUD_E2E_READY '.length)) as CloudBrowserE2EFixture
    }
  }
}

try {
  await run([...compose, 'up', '-d', '--wait', 'postgres', 'seaweedfs'])
  await run([...compose, 'run', '--rm', 'seaweedfs-init'])
  await run(['bun', 'run', '--filter', '@open-pencil/cloud', 'build'], repositoryDirectory)
  cloud = Bun.spawn(['bun', 'packages/cloud/tests/e2e/browser-server.ts'], {
    cwd: repositoryDirectory,
    env: { ...Bun.env, S3_BUCKET: Bun.env.S3_BUCKET ?? 'openpencil' },
    stdout: 'pipe',
    stderr: 'inherit'
  })
  const fixture = await waitForCloud(cloud)
  const playwright = Bun.spawn(
    ['bunx', 'playwright', 'test', 'tests/e2e/cloud/sharing.spec.ts', '--project=openpencil'],
    {
      cwd: repositoryDirectory,
      env: {
        ...Bun.env,
        OPENPENCIL_CLOUD_E2E: '1',
        OPENPENCIL_CLOUD_E2E_URL: fixture.serverURL,
        OPENPENCIL_CLOUD_E2E_WORKSPACE_ID: fixture.workspaceId,
        OPENPENCIL_CLOUD_E2E_DOCUMENT_ID: fixture.documentId
      },
      stdout: 'inherit',
      stderr: 'inherit'
    }
  )
  playwrightExitCode = await playwright.exited
} finally {
  cloud?.kill('SIGTERM')
  if (cloud) await cloud.exited
  await run([...compose, 'down', '--volumes'])
}

process.exit(playwrightExitCode)
