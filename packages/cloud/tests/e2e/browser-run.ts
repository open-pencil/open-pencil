import { cloudDeployPath, repositoryPath } from '#cloud-test/helpers/paths'
import { composeCommand, runProcess } from '#cloud-test/helpers/process'

const deployDirectory = cloudDeployPath()
const repositoryDirectory = repositoryPath()
const projectName = `openpencil-cloud-browser-e2e-${process.pid}`
const compose = composeCommand(projectName, 'compose.yml')
const appPort = 14_000 + (process.pid % 1_000)
const cloudPort = 15_000 + (process.pid % 1_000)
const relayPort = 16_000 + (process.pid % 1_000)
const postgresPort = 17_000 + (process.pid % 1_000)
const seaweedS3Port = 18_000 + (process.pid % 1_000)
const seaweedMasterPort = 19_000 + (process.pid % 1_000)
const relayControlPort = 23_000 + (process.pid % 1_000)
const appOrigin = `http://127.0.0.1:${appPort}`
const serviceEnvironment = {
  ...Bun.env,
  OPENPENCIL_CLOUD_PORT: String(cloudPort),
  POSTGRES_PORT: String(postgresPort),
  SEAWEEDFS_S3_PORT: String(seaweedS3Port),
  SEAWEEDFS_MASTER_PORT: String(seaweedMasterPort),
  DATABASE_URL: `postgresql://openpencil:openpencil-development-password@127.0.0.1:${postgresPort}/openpencil`,
  S3_ENDPOINT: `http://127.0.0.1:${seaweedS3Port}`
}
const relayEnvironment = {
  ...serviceEnvironment,
  BETTER_AUTH_SECRET: 'browser-e2e-secret-at-least-32-characters',
  OPENPENCIL_CLOUD_COLLABORATION_PORT: String(relayPort)
}
let cloud: ReturnType<typeof Bun.spawn> | null = null
let relay: ReturnType<typeof Bun.spawn> | null = null
let relayControl: ReturnType<typeof Bun.serve> | null = null
let playwrightExitCode = 1

async function run(command: string[], cwd = deployDirectory): Promise<void> {
  await runProcess(command, {
    cwd,
    environment: { ...serviceEnvironment, S3_BUCKET: Bun.env.S3_BUCKET ?? 'openpencil' }
  })
}

type CloudBrowserE2EFixture = {
  serverURL: string
  workspaceId: string
  documentId: string
}

async function waitForReadyLine(
  process: ReturnType<typeof Bun.spawn>,
  marker: string,
  processName: string
): Promise<string> {
  const stdout = process.stdout
  if (!(stdout instanceof ReadableStream)) {
    throw new Error(`${processName} stdout is unavailable`)
  }
  const reader = stdout.getReader()
  const decoder = new TextDecoder()
  let output = ''
  while (true) {
    const result = await reader.read()
    if (result.done) throw new Error(`${processName} exited before becoming ready`)
    output += decoder.decode(result.value, { stream: true })
    const lines = output.split('\n')
    output = lines.pop() ?? ''
    for (const line of lines) {
      console.log(line)
      if (line.startsWith(marker)) return line.slice(marker.length)
    }
  }
}

async function waitForCloud(
  process: ReturnType<typeof Bun.spawn>
): Promise<CloudBrowserE2EFixture> {
  const payload = await waitForReadyLine(
    process,
    'OPENPENCIL_CLOUD_E2E_READY ',
    'Cloud browser E2E server'
  )
  return JSON.parse(payload) as CloudBrowserE2EFixture
}

async function startRelay(): Promise<ReturnType<typeof Bun.spawn>> {
  const process = Bun.spawn(
    ['node', '--experimental-strip-types', 'packages/cloud/tests/e2e/relay-server.ts'],
    {
      cwd: repositoryDirectory,
      env: relayEnvironment,
      stdout: 'pipe',
      stderr: 'inherit'
    }
  )
  await waitForReadyLine(process, 'OPENPENCIL_CLOUD_RELAY_READY', 'Cloud collaboration relay')
  return process
}

async function restartRelay(): Promise<void> {
  relay?.kill('SIGTERM')
  if (relay) await relay.exited
  relay = await startRelay()
}

try {
  await run([...compose, 'up', '-d', '--wait', 'postgres', 'seaweedfs'])
  await run([...compose, 'run', '--rm', 'seaweedfs-init'])
  await run(['bun', 'run', '--filter', '@open-pencil/cloud', 'build'], repositoryDirectory)
  cloud = Bun.spawn(['bun', 'packages/cloud/tests/e2e/browser-server.ts'], {
    cwd: repositoryDirectory,
    env: {
      ...serviceEnvironment,
      S3_BUCKET: Bun.env.S3_BUCKET ?? 'openpencil',
      OPENPENCIL_APP_ORIGIN: appOrigin,
      OPENPENCIL_CLOUD_E2E_PORT: String(cloudPort),
      OPENPENCIL_CLOUD_COLLABORATION_PORT: String(relayPort)
    },
    stdout: 'pipe',
    stderr: 'inherit'
  })
  const fixturePromise = waitForCloud(cloud)
  relay = await startRelay()
  const fixture = await fixturePromise
  relayControl = Bun.serve({
    hostname: '127.0.0.1',
    port: relayControlPort,
    async fetch(request) {
      if (request.method !== 'POST' || new URL(request.url).pathname !== '/restart') {
        return new Response('Not found', { status: 404 })
      }
      await restartRelay()
      return Response.json({ restarted: true })
    }
  })
  const playwright = Bun.spawn(
    ['bunx', 'playwright', 'test', 'tests/e2e/cloud/sharing.spec.ts', '--project=openpencil'],
    {
      cwd: repositoryDirectory,
      env: {
        ...serviceEnvironment,
        OPENPENCIL_CLOUD_E2E: '1',
        OPENPENCIL_CLOUD_E2E_URL: fixture.serverURL,
        OPENPENCIL_CLOUD_E2E_WORKSPACE_ID: fixture.workspaceId,
        OPENPENCIL_CLOUD_E2E_DOCUMENT_ID: fixture.documentId,
        OPENPENCIL_CLOUD_E2E_COLLABORATION_URL: `ws://127.0.0.1:${relayPort}`,
        OPENPENCIL_CLOUD_E2E_RELAY_CONTROL_URL: `http://127.0.0.1:${relayControlPort}`,
        OPENPENCIL_E2E_APP_PORT: String(appPort),
        PLAYWRIGHT_BASE_URL: appOrigin
      },
      stdout: 'inherit',
      stderr: 'inherit'
    }
  )
  playwrightExitCode = await playwright.exited
} finally {
  relayControl?.stop(true)
  relay?.kill('SIGTERM')
  cloud?.kill('SIGTERM')
  if (relay) await relay.exited
  if (cloud) await cloud.exited
  await run([...compose, 'down', '--volumes'])
}

process.exit(playwrightExitCode)
