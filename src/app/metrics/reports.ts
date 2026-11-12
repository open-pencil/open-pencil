import { refDebounced } from '@vueuse/core'
import { omitBy } from 'es-toolkit'
import * as v from 'valibot'
import { ref, shallowRef, watch } from 'vue'

import { createFeedbackClient } from '@open-pencil/feedback/client'
import {
  reportDetailSchema,
  reportInboxSchema,
  reportTriageRecordSchema,
  type InboxReport,
  type ReportDetail,
  type ReportInbox,
  type ReportInboxFilter,
  type ReportStatus,
  type ReportTriage,
  type ReportTriageRecord
} from '@open-pencil/feedback/contract'

/** How long typing pauses before a search asks PostHog. */
const SEARCH_DELAY_MS = 300

const client = () => createFeedbackClient({ origin: globalThis.location.origin })

/** Parses an answer against the contract, as the metrics snapshot is. */
async function parsed<T extends v.GenericSchema>(response: Response, schema: T) {
  const result = v.safeParse(v.pipe(v.string(), v.parseJson(), schema), await response.text())
  if (!result.success) throw new Error('The reports API sent an unexpected answer')
  return result.output
}

/** One page of the inbox: a filter, an optional search, and where the last page ended. */
export async function fetchReportInbox(query: {
  filter: ReportInboxFilter
  search?: string
  after?: string
}): Promise<ReportInbox> {
  // Left out rather than sent empty: the server takes no search and no cursor as their defaults.
  const params: { filter: ReportInboxFilter; search?: string; after?: string } = {
    filter: query.filter
  }
  if (query.search) params.search = query.search
  if (query.after) params.after = query.after
  const response = await client().admin.api.reports.$get({ query: params })
  if (response.status !== 200) throw new Error(`The reports API answered ${response.status}`)
  return parsed(response, reportInboxSchema)
}

/** One report whole: its steps and, for an error, its exceptions. */
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

/**
 * The inbox as the team works through it: one filter and search at a time, page after page as the
 * list scrolls, across all time. A newer filter or search wins over a load still in flight.
 * Triage saved here shows at once and stays over later loads, since PostHog takes a moment to
 * have it; the counts follow it.
 */
export function useReportInbox() {
  const filter = ref<ReportInboxFilter>('open')
  const query = ref('')
  const search = refDebounced(query, SEARCH_DELAY_MS)
  const reports = shallowRef<InboxReport[]>([])
  const counts = shallowRef<Record<ReportInboxFilter, number> | null>(null)
  const next = ref<string | null>(null)
  /** The first page of the filter and search shown is loading. */
  const loading = ref(false)
  /** A further page is loading. */
  const loadingMore = ref(false)
  const loaded = ref(false)
  const failed = ref(false)
  /** Counts loads, so an answer for an earlier filter or search is dropped. */
  let latest = 0
  /** Triage saved in this page, which a load that read PostHog before it took it in would undo. */
  const saves = new Map<string, ReportTriageRecord>()

  const withSaves = (page: InboxReport[]) =>
    page.map((report) => {
      const save = saves.get(report.id)
      return save && (!report.handledAt || report.handledAt < save.handledAt)
        ? { ...report, ...save }
        : report
    })

  async function load() {
    const request = ++latest
    loading.value = true
    try {
      const page = await fetchReportInbox({ filter: filter.value, search: search.value.trim() })
      if (request !== latest) return
      reports.value = withSaves(page.reports)
      counts.value = page.counts
      next.value = page.next
      loaded.value = true
      failed.value = false
    } catch (error) {
      if (request !== latest) return
      console.warn('Reports could not load', error)
      reports.value = []
      next.value = null
      loaded.value = false
      failed.value = true
    } finally {
      if (request === latest) loading.value = false
    }
  }

  /** Appends the next page, as the list scrolls to its end. */
  async function loadMore() {
    const after = next.value
    if (!after || loadingMore.value || loading.value) return
    const request = latest
    loadingMore.value = true
    try {
      const page = await fetchReportInbox({
        filter: filter.value,
        search: search.value.trim(),
        after
      })
      if (request !== latest) return
      const shown = new Set(reports.value.map((report) => report.id))
      reports.value = [
        ...reports.value,
        ...withSaves(page.reports.filter((report) => !shown.has(report.id)))
      ]
      next.value = page.next
    } catch (error) {
      if (request !== latest) return
      console.warn('More reports could not load', error)
      failed.value = true
    } finally {
      loadingMore.value = false
    }
  }

  /** Saves triage and shows it, with who saved it, in place; returns the report as it now is. */
  /** Saves a triage change and shows it in the list at once; answers what was saved. */
  async function update(reportId: string, triage: ReportTriage): Promise<ReportTriageRecord> {
    // Only the fields this change saved, so merging it leaves the others as they were.
    const { handledBy, handledAt, ...changed } = await saveReportTriage(reportId, triage)
    const saved: ReportTriageRecord = {
      handledBy,
      handledAt,
      ...omitBy(changed, (value) => value === undefined)
    }
    saves.set(reportId, { ...saves.get(reportId), ...saved })
    reports.value = reports.value.map((report) => {
      if (report.id !== reportId) return report
      // The counts follow a status that moved; the report stays where it is until the next load.
      if (counts.value && saved.status && report.status !== saved.status) {
        counts.value = {
          ...counts.value,
          [report.status]: Math.max(0, counts.value[report.status] - 1),
          [saved.status]: counts.value[saved.status] + 1
        }
      }
      return { ...report, ...saved }
    })
    return saved
  }

  watch([filter, search], () => void load())
  return {
    filter,
    query,
    reports,
    counts,
    next,
    loading,
    loadingMore,
    loaded,
    failed,
    refresh: load,
    loadMore,
    update
  }
}

/** Where the last triage change on the report open stands: none yet, on its way, saved, or failed. */
export type ReportSaveState = 'idle' | 'saving' | 'saved' | 'failed'

/**
 * The report the team has open in the inbox, its steps as they load, and saving its status and
 * note where it is read. Saving returns whether it went through.
 */
export function useReportTriage(inbox: Pick<ReturnType<typeof useReportInbox>, 'update'>) {
  const selected = shallowRef<InboxReport | null>(null)
  const detail = shallowRef<ReportDetail | null>(null)
  const detailFailed = ref(false)
  const saveState = ref<ReportSaveState>('idle')

  /** Counts each opening, so only the latest one's steps are shown, even for the same report. */
  let opening = 0

  async function open(report: InboxReport) {
    const request = ++opening
    selected.value = report
    saveState.value = 'idle'
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

  /**
   * Saves one change to a report's triage: only the field that changed, so a teammate's change to
   * the other one stands. Changes run one after another, so they land in the order made.
   */
  let queue: Promise<unknown> = Promise.resolve()
  function apply(report: InboxReport, change: ReportTriage): Promise<boolean> {
    const shown = () => selected.value?.id === report.id
    // Saving shows from the moment of the change, even while an earlier one is still on its way.
    if (shown()) saveState.value = 'saving'
    const run = async () => {
      try {
        const saved = await inbox.update(report.id, change)
        if (selected.value && shown()) {
          selected.value = { ...selected.value, ...saved }
          saveState.value = 'saved'
        }
        return true
      } catch (error) {
        console.warn('The report could not be saved', error)
        if (shown()) saveState.value = 'failed'
        return false
      }
    }
    const result = queue.then(run)
    queue = result
    return result
  }

  /** Moves a report to another status; its note stays as anyone last left it. */
  const setStatus = (report: InboxReport, status: ReportStatus) => apply(report, { status })
  /** Saves the team's note on a report; its status stays as anyone last left it. */
  const setNote = (report: InboxReport, note: string | null) => apply(report, { note })

  return { selected, detail, detailFailed, saveState, open, setStatus, setNote }
}
