import { copyFile, mkdir, writeFile } from 'node:fs/promises'

import { cloudDeployPath, cloudPackagePath, repositoryPath } from '#cloud-tests/helpers/paths'
import { composeCommand, runProcess } from '#cloud-tests/helpers/process'

// Runs the Cloudflare Worker under `wrangler dev`, against PostgreSQL and SeaweedFS from Compose,
// then checks it from outside as clients reach it: see checks.ts. The Worker is a copy of the
// deploy/cloudflare template in deploy/generated, with a TOML for these services, as a
// self-hosted deployment would be.
const deployDirectory = cloudDeployPath()
const compose = composeCommand(`openpencil-cloud-workers-e2e-${process.pid}`, 'compose.yml')
const portOffset = process.pid % 1_000
const workerPort = 23_000 + portOffset
const databaseURL = `postgresql://openpencil:openpencil-development-password@127.0.0.1:${20_000 + portOffset}/openpencil`
const s3Endpoint = `http://127.0.0.1:${21_000 + portOffset}`
const secrets = {
  BETTER_AUTH_SECRET: 'cloudflare-e2e-secret-at-least-32-characters',
  S3_ACCESS_KEY_ID: 'openpencil',
  S3_SECRET_ACCESS_KEY: 'openpencil-development-secret'
}
const environment = {
  ...process.env,
  S3_BUCKET: 'openpencil',
  POSTGRES_PORT: String(20_000 + portOffset),
  SEAWEEDFS_S3_PORT: String(21_000 + portOffset),
  SEAWEEDFS_MASTER_PORT: String(22_000 + portOffset),
  ...secrets,
  DATABASE_URL: databaseURL,
  CLOUD_WORKER_URL: `http://127.0.0.1:${workerPort}`,
  OPENPENCIL_CLOUD_CONFIG: cloudDeployPath('generated/openpencil-cloud.toml'),
  CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: databaseURL
}

const config = `schema_version = 2

[deployment]
mode = "self-hosted"
public_url = "${environment.CLOUD_WORKER_URL}"
indexing = "deny"
trusted_origins = []

[database]

[authentication.enrollment]
mode = "open"

[authentication.trusted_proxies]
headers = []
addresses = []

[object_storage]
endpoint = "${s3Endpoint}"
region = "us-east-1"
bucket = "openpencil"
force_path_style = true
checksum_verification = "metadata"

[email]
transport = "none"

[entitlements]
source = "static"

[entitlements.collaboration]
enabled = true
maximum_participants = 10
`

async function run(command: string[], cwd = deployDirectory): Promise<void> {
  await runProcess(command, { cwd, environment })
}

async function untilServing(worker: Bun.Subprocess) {
  for (let attempt = 0; attempt < 600; attempt++) {
    if (worker.exitCode !== null) throw new Error(`wrangler dev exited with ${worker.exitCode}`)
    const health = await fetch(`${environment.CLOUD_WORKER_URL}/health`).catch(() => null)
    if (health?.ok) return
    await Bun.sleep(100)
  }
  throw new Error('The Worker did not start')
}

let worker: Bun.Subprocess | null = null
try {
  await mkdir(cloudDeployPath('generated'), { recursive: true })
  for (const file of ['wrangler.jsonc', 'worker.ts']) {
    await copyFile(cloudDeployPath('cloudflare', file), cloudDeployPath('generated', file))
  }
  await writeFile(environment.OPENPENCIL_CLOUD_CONFIG, config)
  await run([...compose, 'up', '-d', '--wait', 'postgres', 'seaweedfs'])
  await run([...compose, 'run', '--rm', 'seaweedfs-init'])
  await run(['bun', cloudPackagePath('src/runtime/node/migrate.ts')], cloudPackagePath())
  worker = Bun.spawn(
    [
      'bunx',
      'wrangler',
      'dev',
      '--assets',
      repositoryPath('dist-cloud'),
      '--ip',
      '127.0.0.1',
      '--port',
      String(workerPort),
      '--test-scheduled',
      '--show-interactive-dev-session=false',
      ...Object.entries(secrets).flatMap(([name, value]) => ['--var', `${name}:${value}`])
    ],
    { cwd: cloudDeployPath('generated'), env: environment, stdout: 'inherit', stderr: 'inherit' }
  )
  await untilServing(worker)
  await run(['bun', cloudPackagePath('tests/e2e/cloudflare/checks.ts')], cloudPackagePath())
} finally {
  worker?.kill()
  await worker?.exited
  await run([...compose, 'down', '--volumes'])
}
