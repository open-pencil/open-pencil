import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { resolveWorkspaceRoot } from '@open-pencil/package-artifacts-tools'
import { randomHex } from '@open-pencil/scene-graph/random'

import { composeProjectName, localCloudDeploymentTOML } from './config'

const root = await resolveWorkspaceRoot(import.meta.dir)
const composeFile = join(root, 'packages/cloud/deploy/compose.yml')
const generatedDirectory = join(root, 'packages/cloud/deploy/generated')
const generatedConfig = join(generatedDirectory, 'openpencil-cloud.local.toml')
const generatedSecret = join(generatedDirectory, 'auth-secret')

// Development-only credentials shared with compose.yml defaults.
const POSTGRES_PASSWORD = 'openpencil-development-password'
const S3_ACCESS_KEY_ID = 'openpencil'
const S3_SECRET_ACCESS_KEY = 'openpencil-development-secret'

async function output(command: string[]): Promise<string> {
  const child = Bun.spawn(command, { cwd: root, stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited
  ])
  if (exitCode !== 0) throw new Error(stderr.trim() || `${command[0]} exited with ${exitCode}`)
  return stdout.trim()
}

async function execute(
  command: string[],
  options: { allowFailure?: boolean; environment?: Record<string, string | undefined> } = {}
): Promise<number> {
  const child = Bun.spawn(command, {
    cwd: root,
    env: options.environment,
    stdout: 'inherit',
    stderr: 'inherit'
  })
  const exitCode = await child.exited
  if (exitCode !== 0 && !options.allowFailure) {
    throw new Error(`${command.join(' ')} exited with ${exitCode}`)
  }
  return exitCode
}

function compose(project: string, ...args: string[]): string[] {
  return ['docker', 'compose', '--project-name', project, '--file', composeFile, ...args]
}

async function publishedPort(project: string, service: string, port: number): Promise<number> {
  const address = await output(compose(project, 'port', service, String(port)))
  const value = Number(address.slice(address.lastIndexOf(':') + 1))
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`Could not resolve the published ${service} port ${port}`)
  }
  return value
}

const portlessURL = (name: string) => output(['bunx', 'portless', 'get', name])

function aliasName(url: string): string {
  const hostname = new URL(url).hostname
  if (!hostname.endsWith('.localhost'))
    throw new Error(`Portless returned an unexpected URL: ${url}`)
  return hostname.slice(0, -'.localhost'.length)
}

async function authSecret(): Promise<string> {
  if (existsSync(generatedSecret)) return (await readFile(generatedSecret, 'utf8')).trim()
  const secret = randomHex(32)
  await writeFile(generatedSecret, `${secret}\n`, { mode: 0o600 })
  return secret
}

async function start(project: string): Promise<void> {
  const [cloudURL, mailURL, editorURL] = await Promise.all([
    portlessURL('cloud.open-pencil'),
    portlessURL('mail.open-pencil'),
    portlessURL('open-pencil')
  ])

  // Port 0 lets Docker pick free loopback ports, so worktrees never collide.
  const services = {
    ...process.env,
    POSTGRES_PORT: '0',
    SEAWEEDFS_S3_PORT: '0',
    SEAWEEDFS_MASTER_PORT: '0',
    MAILPIT_UI_PORT: '0',
    MAILPIT_SMTP_PORT: '0'
  }
  await execute(compose(project, 'up', '--detach', '--wait', 'postgres', 'seaweedfs', 'mailpit'), {
    environment: services
  })
  await execute(compose(project, 'run', '--rm', 'seaweedfs-init'), { environment: services })
  const [postgresPort, s3Port, mailpitUIPort, smtpPort] = await Promise.all([
    publishedPort(project, 'postgres', 5432),
    publishedPort(project, 'seaweedfs', 8333),
    publishedPort(project, 'mailpit', 8025),
    publishedPort(project, 'mailpit', 1025)
  ])

  await mkdir(generatedDirectory, { recursive: true })
  await writeFile(
    generatedConfig,
    localCloudDeploymentTOML({
      cloudURL,
      editorURL,
      objectStorageURL: `http://127.0.0.1:${s3Port}`,
      smtpPort
    }),
    { mode: 0o600 }
  )
  await execute(['bunx', 'portless', 'alias', aliasName(mailURL), String(mailpitUIPort), '--force'])

  // The server serves the portal's pages from this build, rebuilt on every change.
  const portal = Bun.spawn(['bun', 'run', 'build:cloud-portal', '--watch'], {
    cwd: root,
    stdout: 'inherit',
    stderr: 'inherit'
  })

  console.warn(`OpenPencil Cloud: ${cloudURL}`)
  console.warn(`Captured email:  ${mailURL}`)
  console.warn('Stop the services with `bun run cloud:dev:down`; their data is kept.')

  const exitCode = await execute(
    [
      'bunx',
      'portless',
      'run',
      '--name',
      'cloud.open-pencil',
      'bun',
      '--watch',
      'packages/cloud/src/runtime/node/main.ts'
    ],
    {
      allowFailure: true,
      environment: {
        ...process.env,
        HOST: '127.0.0.1',
        OPENPENCIL_CLOUD_CONFIG: generatedConfig,
        OPENPENCIL_CLOUD_PORTAL_DIR: join(root, 'dist-cloud-portal'),
        DATABASE_URL: `postgresql://openpencil:${POSTGRES_PASSWORD}@127.0.0.1:${postgresPort}/openpencil`,
        BETTER_AUTH_SECRET: await authSecret(),
        S3_ACCESS_KEY_ID,
        S3_SECRET_ACCESS_KEY
      }
    }
  )
  portal.kill()
  process.exitCode = exitCode
}

async function stop(project: string): Promise<void> {
  await execute(compose(project, 'down'), { allowFailure: true })
  const mailURL = await portlessURL('mail.open-pencil')
  await execute(['bunx', 'portless', 'alias', '--remove', aliasName(mailURL)], {
    allowFailure: true
  })
  await rm(generatedConfig, { force: true })
}

const project = composeProjectName(await output(['git', 'branch', '--show-current']))
const command = process.argv[2] ?? 'up'
if (command === 'up') await start(project)
else if (command === 'down') await stop(project)
else throw new Error('Usage: bun tools/dev/cloud/src/index.ts [up|down]')
