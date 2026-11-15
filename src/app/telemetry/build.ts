import { platform, arch } from '@tauri-apps/plugin-os'

import type { Architecture, Build } from '@open-pencil/feedback/contract'

import { APP_VERSION } from '@/app/runtime/version'
import { describeEnvironment } from '@/app/shell/support/detect'
import { IS_TAURI } from '@/constants'

function architecture(arch: string): Architecture {
  if (arch === 'aarch64') return 'arm64'
  if (arch === 'x86_64') return 'x64'
  return 'unknown'
}

async function detectBuild(): Promise<Build> {
  const facts = { userAgent: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints }
  if (!IS_TAURI) {
    const { os, browser } = describeEnvironment(facts)
    return { version: APP_VERSION, platform: os, arch: 'unknown', app: 'web', browser }
  }
  const { os } = describeEnvironment(facts, { platform: platform() })
  return {
    version: APP_VERSION,
    platform: os,
    arch: architecture(arch()),
    app: 'desktop',
    browser: 'unknown'
  }
}

let build: Promise<Build> | null = null

/** The build fields every ping and usage batch carries; nothing else about the device is read. */
export function currentBuild(): Promise<Build> {
  build ??= detectBuild()
  return build
}
