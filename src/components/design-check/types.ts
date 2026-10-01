import type { Component } from 'vue'

import type { LintFixRequest } from '@open-pencil/core/lint'

import type { IssueAction, IssueSwatch } from '@/app/editor/design-check/format'
import type { DesignIssue, DesignIssueSeverity } from '@/app/editor/design-check/issues'

export interface IssueRowView {
  issue: DesignIssue
  layerName: string
  layerIcon: Component
  detail: string | null
  swatch: IssueSwatch | null
  action: IssueAction | null
  hidden: boolean
  missing: boolean
  selected: boolean
  /** The page the layer is on, shown when it is not the current page. */
  pageLabel: string | null
}

export interface IssueGroupView {
  ruleId: string
  severity: DesignIssueSeverity
  title: string
  help: string | null
  rows: IssueRowView[]
  /** Safe fixes of the rows, which the group applies together. */
  fixes: LintFixRequest[]
  /** Whether every safe fix binds a variable, which the group button names. */
  bindsOnly: boolean
}
