import { BROWSER_BASELINE } from './baseline'
import { baselineBrowserFor, type SupportEnvironment } from './detect'

/**
 * Copy for the pre-boot notice. It renders before Vue and the i18n catalogs
 * exist, so it is plain English by design.
 */
export interface SupportNotice {
  readonly heading: string
  readonly paragraphs: readonly string[]
  /** Technical facts shown behind a disclosure and prefilled into a bug report. */
  readonly details: readonly string[]
  readonly links: readonly SupportLink[]
}

export interface SupportLink {
  readonly label: string
  readonly url: string
}

export const SYSTEM_REQUIREMENTS_URL = 'https://openpencil.dev/getting-started#system-requirements'
export const WEBVIEW2_DOWNLOAD_URL = 'https://developer.microsoft.com/microsoft-edge/webview2/'
const ISSUE_URL = 'https://github.com/open-pencil/open-pencil/issues/new'

export const MINIMUM_MACOS_VERSION = 13
export const MINIMUM_WEBKITGTK_VERSION = '2.40'

const BROWSER_LABELS = {
  chrome: 'Chrome',
  edge: 'Edge',
  opera: 'Opera',
  firefox: 'Firefox',
  safari: 'Safari',
  unknown: 'this browser'
} as const

export function requirementsSentence(): string {
  const { chrome, edge, firefox, safari } = BROWSER_BASELINE
  return `OpenPencil needs Chrome ${chrome}, Edge ${edge}, Firefox ${firefox}, or Safari ${safari} or later.`
}

function majorVersion(version: string | undefined): number | undefined {
  if (!version) return undefined
  const major = Number.parseInt(version, 10)
  return Number.isFinite(major) ? major : undefined
}

function versionLabel(version: number): string {
  return Number.isInteger(version) ? String(version) : version.toFixed(1)
}

function environmentDetails(env: SupportEnvironment): string[] {
  const details = [`Host: ${env.host === 'desktop' ? 'desktop app' : 'browser'}`]
  details.push(`OS: ${env.os}${env.osVersion ? ` ${env.osVersion}` : ''}`)
  if (env.browserVersion !== undefined) {
    details.push(`Browser: ${BROWSER_LABELS[env.browser]} ${versionLabel(env.browserVersion)}`)
  }
  if (env.webviewVersion) details.push(`WebView: ${env.webviewVersion}`)
  details.push(`User agent: ${env.userAgent}`)
  return details
}

/** Option labels of the bug report form's Platform dropdown. */
const DESKTOP_ISSUE_PLATFORMS: Partial<Record<SupportEnvironment['os'], string>> = {
  macos: 'macOS (Tauri)',
  windows: 'Windows (Tauri)',
  linux: 'Linux (Tauri)'
}

function issuePlatform(env: SupportEnvironment): string {
  if (env.host === 'browser') return 'Web (app.openpencil.dev)'
  return DESKTOP_ISSUE_PLATFORMS[env.os] ?? 'Not sure'
}

function issueLink(
  env: SupportEnvironment,
  title: string,
  details: readonly string[]
): SupportLink {
  const params = new URLSearchParams({
    template: 'bug_report.yml',
    title,
    platform: issuePlatform(env),
    'affected-area': 'App UI',
    version: typeof __OPENPENCIL_APP_VERSION__ === 'string' ? __OPENPENCIL_APP_VERSION__ : '',
    browser: env.userAgent,
    logs: details.join('\n')
  })
  return { label: 'Report a problem', url: `${ISSUE_URL}?${params.toString()}` }
}

function requirementsLink(): SupportLink {
  return { label: 'System requirements', url: SYSTEM_REQUIREMENTS_URL }
}

interface Advice {
  heading: string
  paragraphs: string[]
  extraLinks?: SupportLink[]
}

function desktopAdvice(env: SupportEnvironment): Advice {
  switch (env.os) {
    case 'macos': {
      const major = majorVersion(env.osVersion)
      const running = env.osVersion ? `This Mac is running macOS ${env.osVersion}. ` : ''
      if (major !== undefined && major < MINIMUM_MACOS_VERSION) {
        return {
          heading: `OpenPencil needs macOS ${MINIMUM_MACOS_VERSION} or later`,
          paragraphs: [
            `${running}OpenPencil renders with the WebKit engine that ships with macOS, and this version is too old to run it. Upgrade to macOS ${MINIMUM_MACOS_VERSION} or later to use OpenPencil.`
          ]
        }
      }
      return {
        heading: 'Update macOS to run OpenPencil',
        paragraphs: [
          `${running}OpenPencil renders with the WebKit engine that ships with macOS, and this Mac's copy is older than Safari ${BROWSER_BASELINE.safari}.`,
          'Open System Settings → General → Software Update, install the available macOS and Safari updates, then reopen OpenPencil.'
        ]
      }
    }
    case 'linux':
      return {
        heading: 'Update WebKitGTK to run OpenPencil',
        paragraphs: [
          `OpenPencil renders with WebKitGTK${env.webviewVersion ? ` ${env.webviewVersion}` : ''}, which is too old.`,
          `Update the webkit2gtk-4.1 package to ${MINIMUM_WEBKITGTK_VERSION} or later with your distribution's package manager, then reopen OpenPencil.`
        ]
      }
    case 'windows':
      return {
        heading: 'Update WebView2 to run OpenPencil',
        paragraphs: [
          `OpenPencil renders with the Microsoft Edge WebView2 Runtime${env.webviewVersion ? ` ${env.webviewVersion}` : ''}, which is too old.`,
          'Install the latest Evergreen runtime from Microsoft, then reopen OpenPencil.'
        ],
        extraLinks: [{ label: 'Download WebView2', url: WEBVIEW2_DOWNLOAD_URL }]
      }
    default:
      return {
        heading: 'OpenPencil needs a newer WebView',
        paragraphs: [
          'The system WebView engine is too old to run OpenPencil. Install your operating system updates, then reopen OpenPencil.'
        ]
      }
  }
}

function browserUpdateSteps(env: SupportEnvironment): string {
  switch (env.browser) {
    case 'chrome':
      return 'Open the Chrome menu → Help → About Google Chrome to install the update.'
    case 'edge':
      return 'Open Settings and more → Help and feedback → About Microsoft Edge to install the update.'
    case 'opera':
      return 'Open the Opera menu → Update & Recovery to install the update.'
    case 'firefox':
      return 'Open the Firefox menu → Help → About Firefox to install the update.'
    case 'safari':
      return 'Update it through System Settings → General → Software Update, or open OpenPencil in a current Chrome, Edge, or Firefox.'
    default:
      return requirementsSentence()
  }
}

function browserAdvice(env: SupportEnvironment): Advice {
  if (env.os === 'ios') {
    return {
      heading: 'Update iOS to run OpenPencil',
      paragraphs: [
        `OpenPencil needs iOS ${BROWSER_BASELINE.ios} or later. Every browser on iPhone and iPad uses the system WebKit engine, so update in Settings → General → Software Update.`
      ]
    }
  }
  const baseline = baselineBrowserFor(env)
  if (baseline === undefined) {
    return {
      heading: "OpenPencil can't run in this browser",
      paragraphs: [requirementsSentence()]
    }
  }
  const label = BROWSER_LABELS[env.browser]
  const minimum = BROWSER_BASELINE[baseline]
  const detected =
    env.browserVersion === undefined
      ? ''
      : `${label} ${versionLabel(env.browserVersion)} detected. `
  const needs =
    env.browser === 'opera'
      ? `OpenPencil needs Opera built on Chrome ${minimum} or later.`
      : `OpenPencil needs ${label} ${minimum} or later.`
  return {
    heading: `Update ${label} to run OpenPencil`,
    paragraphs: [`${detected}${needs}`, browserUpdateSteps(env)]
  }
}

/** True when the UA claims a version at or above the baseline for its browser. */
function claimsSupportedVersion(env: SupportEnvironment): boolean {
  const baseline = baselineBrowserFor(env)
  return (
    baseline !== undefined &&
    env.browserVersion !== undefined &&
    env.browserVersion >= BROWSER_BASELINE[baseline]
  )
}

/** Notice for an engine that fails the support sentinels before boot. */
export function unsupportedNotice(
  env: SupportEnvironment,
  missing: readonly string[]
): SupportNotice {
  const details = [`Missing: ${missing.join(', ')}`, ...environmentDetails(env)]
  const report = issueLink(env, 'bug: unsupported browser notice shown', details)

  if (env.host === 'browser' && claimsSupportedVersion(env)) {
    return {
      heading: 'A required browser feature is unavailable',
      paragraphs: [
        `Your browser reports ${BROWSER_LABELS[env.browser]} ${versionLabel(env.browserVersion ?? 0)}, which should run OpenPencil, but it is missing ${missing.join(', ')}.`,
        'A browser policy, an extension, or a preview build may have disabled it. Try a current release of Chrome, Edge, Firefox, or Safari.'
      ],
      details,
      links: [requirementsLink(), report]
    }
  }

  const advice = env.host === 'desktop' ? desktopAdvice(env) : browserAdvice(env)
  return {
    heading: advice.heading,
    paragraphs: advice.paragraphs,
    details,
    links: [requirementsLink(), ...(advice.extraLinks ?? []), report]
  }
}

function errorDetails(error: unknown): string[] {
  if (!(error instanceof Error)) return [String(error)]
  const summary = `${error.name}: ${error.message}`
  const frames = (error.stack ?? '')
    .split('\n')
    // V8 repeats the summary as the first stack line; WebKit and Gecko do not.
    .filter((line, index) => line.trim() !== '' && !(index === 0 && line.trim() === summary))
    .slice(0, 8)
  return [summary, ...frames]
}

function bootFailureHint(env: SupportEnvironment): string {
  if (env.host === 'browser') return requirementsSentence()
  if (env.os === 'macos') {
    return 'OpenPencil renders with the WebKit engine that ships with macOS. If this Mac has pending macOS or Safari updates, install them first.'
  }
  return 'OpenPencil renders with the system WebView engine. If your operating system has pending updates, install them first.'
}

/** Notice for an app that failed while loading and left the window blank. */
export function bootFailureNotice(env: SupportEnvironment, error: unknown): SupportNotice {
  const details = [...errorDetails(error), ...environmentDetails(env)]
  return {
    heading: "OpenPencil couldn't start",
    paragraphs: [
      'Something failed while the app was loading, so nothing could be shown.',
      bootFailureHint(env),
      'If it keeps happening, report the problem and include the details below.'
    ],
    details,
    links: [requirementsLink(), issueLink(env, 'bug: app fails to start', details)]
  }
}
