import type { Report, ReportStep } from '#feedback/contract'
import { mapKeys, pick } from 'es-toolkit'

const BUILD_KEYS = ['version', 'platform', 'arch', 'app', 'browser'] as const

/** Where the team opens a report's attached files, behind Cloudflare Access. */
export function reportFileURL(origin: string, reportId: string, name: string): string {
  return `${origin}/admin/reports/${reportId}/files/${name}`
}

/** A diagnostics event as one of PostHog's exception steps, its attributes beside the message. */
function exceptionStep(step: ReportStep) {
  return {
    $message: step.name,
    $timestamp: step.timestamp,
    category: step.category,
    level: step.level,
    ...mapKeys(step.attributes, (_value, key) => `attribute_${key}`)
  }
}

/**
 * PostHog's `/batch/` body for one report: an `$exception` for an error, which error tracking
 * groups into issues, or `problem_reported` for a problem a person describes. Like usage events,
 * it creates no person profile and skips GeoIP, and the request comes from the Worker.
 */
export function toPostHogReport(
  report: Report,
  options: { apiKey: string; reportId: string; origin: string; timestamp: string }
) {
  const { kind, installId, release, note, email, steps, files } = report
  const properties = {
    ...pick(report, BUILD_KEYS),
    report_id: options.reportId,
    report_note: note ?? null,
    report_email: email ?? null,
    report_files: (files ?? []).map((file) =>
      reportFileURL(options.origin, options.reportId, file.name)
    ),
    ...(release && { $release_id: release }),
    $lib: 'openpencil',
    $process_person_profile: false,
    $geoip_disable: true
  }
  const exception =
    kind === 'error'
      ? {
          $exception_list: report.exceptions,
          $exception_level: 'error',
          $exception_steps: (steps ?? []).map(exceptionStep)
        }
      : { report_steps: (steps ?? []).map(exceptionStep) }
  return {
    api_key: options.apiKey,
    batch: [
      {
        event: kind === 'error' ? '$exception' : 'problem_reported',
        timestamp: options.timestamp,
        distinct_id: installId ?? options.reportId,
        properties: { ...properties, ...exception }
      }
    ]
  }
}
