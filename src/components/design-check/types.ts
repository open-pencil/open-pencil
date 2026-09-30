import type { Component } from 'vue'

import type { IssueFix, IssueSwatch } from '@/app/editor/design-check/format'
import type { DesignIssue, DesignIssueSeverity } from '@/app/editor/design-check/issues'

export interface IssueRowView {
  issue: DesignIssue
  layerName: string
  layerIcon: Component
  detail: string | null
  swatch: IssueSwatch | null
  fix: IssueFix | null
  hidden: boolean
  missing: boolean
  selected: boolean
}

export interface IssueGroupView {
  ruleId: string
  severity: DesignIssueSeverity
  title: string
  help: string | null
  rows: IssueRowView[]
  fixes: IssueFix[]
}
