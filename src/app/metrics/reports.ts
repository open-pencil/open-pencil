import { compact } from 'es-toolkit'
import * as v from 'valibot'
import { computed, ref, shallowRef, watch, type Ref } from 'vue'

import { createFeedbackClient } from '@open-pencil/feedback/client'
import {
  reportDetailSchema,
  reportInboxSchema,
  reportTriageRecordSchema,
  type InboxReport,
  type ReportDetail,
  type ReportStatus,
  type ReportTriage,
  type ReportTriageRecord
} from '@open-pencil/feedback/contract'

import type { PortalListPage, PortalListRequest } from '@/app/cloud-portal/list'

import type { MetricsRange } from './range'

/** The inbox's filters: one per status, and every report. */
export type ReportInboxFilter = ReportStatus | 'all'

const client = () => createFeedbackClient({ origin: globalThis.location.origin })

/** Parses an answer against the contract, as the metrics snapshot is. */
async function parsed<T extends v.GenericSchema>(response: Response, schema: T) {
  const result = v.safeParse(v.pipe(v.string(), v.parseJson(), schema), await response.text())
  if (!result.success) throw new Error('The reports API sent an unexpected answer')
  return result.output
}

/** The reports received in a range, with the team's triage. */
export async function fetchReportInbox(range: MetricsRange) {
  const response = await client().admin.api.reports.$get({
    query: { start: range.start, end: range.end }
  })
  if (response.status !== 200) throw new Error(`The reports API answered ${response.status}`)
  return parsed(response, reportInboxSchema)
}

/** One report with the steps that led up to it. */
export async function fetchReportDetail(reportId: string): Promise<ReportDetail> {
  const response = await client().admin.api.reports[':reportId'].$get({ param: { reportId } })
  if (response.status !== 200) throw new Error(`The report answered ${response.status}`)
  return parsed(response, reportDetailSchema)
}

/** Saves where the team stands with a report, and answers what was saved and by whom. */
export async function saveReportTriage(
  reportId: string,
  triage: ReportTriage
): Promise<ReportTriageRecord> {
  const response = await client().admin.api.reports[':reportId'].triage.$put({
    param: { reportId },
    json: triage
  })
  if (response.status !== 200) throw new Error(`Saving the report answered ${response.status}`)
  return parsed(response, reportTriageRecordSchema)
}

const searchable = (report: InboxReport) =>
  [report.note, report.email, report.error, report.version, report.platform, report.app]
    .filter((field) => field !== null)
    .join('\n')
    .toLowerCase()

/**
 * One page of the inbox for the console table: the reports matching the search under the filter,
 * with how many match under each filter. The page already holds the range's reports, so this
 * runs in the browser.
 */
export function reportInboxPage(
  reports: readonly InboxReport[],
  request: PortalListRequest<ReportInboxFilter>
): PortalListPage<ReportInboxFilter, InboxReport> {
  const words = compact((request.search ?? '').toLowerCase().split(/\s+/))
  const found = reports.filter((report) => {
    const text = searchable(report)
    return words.every((word) => text.includes(word))
  })
  const count = (status: ReportStatus) => found.filter((report) => report.status === status).length
  const counts = {
    all: found.length,
    open: count('open'),
    replied: count('replied'),
    closed: count('closed')
  }
  const matching =
    request.filter === 'all' ? found : found.filter((report) => report.status === request.filter)
  return {
    rows: matching.slice(request.offset, request.offset + request.limit),
    total: matching.length,
    counts
  }
}

/**
 * The inbox for the range as it changes. A newer request wins over one still in flight. A failed
 * refresh keeps the range's reports on screen; a failed load of another range clears them, so
 * they never stand for days they don't cover. `update` saves triage and shows it at once.
 */
export function useReportInbox(range: Ref<MetricsRange>) {
  const reports = shallowRef<InboxReport[]>([])
  const truncated = ref(false)
  const loading = ref(false)
  const loaded = ref(false)
  const failed = ref(false)
  /** The range `reports` belongs to. */
  let shownRange: MetricsRange | null = null
  const shownFor = shallowRef<MetricsRange | null>(null)
  /** `reports` are the selected range's, not another's still on screen while it loads. */
  const current = computed(
    () => shownFor.value?.start === range.value.start && shownFor.value.end === range.value.end
  )
  let latest = 0
  /** Triage saved here, numbered, so a load that read the triage before a save doesn't undo it. */
  let saveCount = 0
  const saves = new Map<string, { count: number; record: ReportTriageRecord }>()

  async function load() {
    const request = ++latest
    const asked = range.value
    const savedBefore = saveCount
    loading.value = true
    try {
      const next = await fetchReportInbox(asked)
      if (request !== latest) return
      reports.value = next.reports.map((report) => {
        const save = saves.get(report.id)
        return save && save.count > savedBefore ? { ...report, ...save.record } : report
      })
      truncated.value = next.truncated
      shownRange = asked
      shownFor.value = asked
      loaded.value = true
      failed.value = false
    } catch (error) {
      if (request !== latest) return
      console.warn('Reports could not load', error)
      failed.value = true
      if (shownRange?.start !== asked.start || shownRange.end !== asked.end) {
        reports.value = []
        truncated.value = false
        shownRange = null
        shownFor.value = null
        loaded.value = false
      }
    } finally {
      if (request === latest) loading.value = false
    }
  }

  /** Saves triage and shows it, with who saved it, in place; returns the report as it now is. */
  async function update(reportId: string, triage: ReportTriage): Promise<InboxReport | null> {
    const saved = await saveReportTriage(reportId, triage)
    saves.set(reportId, { count: ++saveCount, record: saved })
    let updated: InboxReport | null = null
    reports.value = reports.value.map((report) => {
      if (report.id !== reportId) return report
      updated = { ...report, ...saved }
      return updated
    })
    return updated
  }

  watch(range, load)
  return { reports, truncated, loading, loaded, current, failed, refresh: load, update }
}

/**
 * The report the team has open in the inbox's dialog, its steps as they load, and saving its
 * triage, from the dialog or straight from a row's menu. Saving returns whether it went through.
 */
export function useReportTriage(inbox: Pick<ReturnType<typeof useReportInbox>, 'update'>) {
  const selected = shallowRef<InboxReport | null>(null)
  const detail = shallowRef<ReportDetail | null>(null)
  const detailFailed = ref(false)
  const saving = ref(false)
  /** The report a row's menu is saving. */
  const busy = ref<string | null>(null)

  /** Counts each opening, so only the latest one's steps are shown, even for the same report. */
  let opening = 0

  async function open(report: InboxReport) {
    const request = ++opening
    selected.value = report
    detail.value = null
    detailFailed.value = false
    try {
      const loaded = await fetchReportDetail(report.id)
      if (request === opening) detail.value = loaded
    } catch (error) {
      console.warn('The report could not load', error)
      if (request === opening) detailFailed.value = true
    }
  }

  async function save(triage: ReportTriage): Promise<boolean> {
    const report = selected.value
    if (!report) return false
    saving.value = true
    try {
      const updated = await inbox.update(report.id, triage)
      // The dialog shows who changed it last; another report may be open by now.
      if (updated && selected.value?.id === report.id) selected.value = updated
      return true
    } catch (error) {
      console.warn('The report could not be saved', error)
      return false
    } finally {
      saving.value = false
    }
  }

  async function setStatus(report: InboxReport, status: ReportStatus): Promise<boolean> {
    busy.value = report.id
    try {
      await inbox.update(report.id, { status, note: report.triageNote })
      return true
    } catch (error) {
      console.warn('The report could not be saved', error)
      return false
    } finally {
      busy.value = null
    }
  }

  return { selected, detail, detailFailed, saving, busy, open, save, setStatus }
}
