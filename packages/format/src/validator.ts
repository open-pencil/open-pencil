import type { DesignDocument, DesignNode } from "./schema.js";

export interface ValidationIssue {
  level: "error" | "warning";
  message: string;
  path?: string;
}

function collectIds(nodes: DesignNode[], path: string, ids: Map<string, string[]>): void {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (!node) continue;
    const currentPath = `${path}[${i}]`;
    const existing = ids.get(node.id);
    if (existing) {
      existing.push(currentPath);
    } else {
      ids.set(node.id, [currentPath]);
    }
    if ("children" in node && Array.isArray(node.children)) {
      collectIds(node.children as DesignNode[], `${currentPath}.children`, ids);
    }
  }
}

function collectRefs(nodes: DesignNode[], refs: Set<string>): void {
  for (const node of nodes) {
    if (node.type === "ref") {
      refs.add(node.refId);
    }
    if ("children" in node && Array.isArray(node.children)) {
      collectRefs(node.children as DesignNode[], refs);
    }
  }
}

function collectVariableUsages(nodes: DesignNode[], usages: Set<string>): void {
  for (const node of nodes) {
    // Check all string values for variable references ($xxx)
    for (const value of Object.values(node)) {
      if (typeof value === "string" && value.startsWith("$")) {
        usages.add(value.slice(1));
      }
    }
    if ("children" in node && Array.isArray(node.children)) {
      collectVariableUsages(node.children as DesignNode[], usages);
    }
  }
}

function detectRefCycles(nodes: DesignNode[], reusableIds: Set<string>): string[] {
  // Build adjacency: refId -> set of refIds it references
  const nodeMap = new Map<string, DesignNode>();
  function index(list: DesignNode[]): void {
    for (const n of list) {
      nodeMap.set(n.id, n);
      if ("children" in n && Array.isArray(n.children)) {
        index(n.children as DesignNode[]);
      }
    }
  }
  index(nodes);

  const graph = new Map<string, string[]>();
  for (const [id, node] of nodeMap) {
    if (node.type === "ref") {
      const existing = graph.get(id) ?? [];
      existing.push(node.refId);
      graph.set(id, existing);
    }
  }

  // Simple DFS cycle detection
  const visited = new Set<string>();
  const stack = new Set<string>();
  const cycles: string[] = [];

  function dfs(nodeId: string): void {
    if (stack.has(nodeId)) {
      cycles.push(`Cycle detected involving ref "${nodeId}"`);
      return;
    }
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    stack.add(nodeId);
    const edges = graph.get(nodeId);
    if (edges) {
      for (const target of edges) {
        dfs(target);
      }
    }
    stack.delete(nodeId);
  }

  for (const id of graph.keys()) {
    dfs(id);
  }

  return cycles;
}

/**
 * Validate a DesignDocument for:
 * - Duplicate IDs
 * - Broken ref references
 * - Missing variable definitions
 * - Cycles in ref nodes
 */
export function validateDesignDocument(doc: DesignDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // 1. Duplicate IDs
  const ids = new Map<string, string[]>();
  collectIds(doc.children, "children", ids);
  for (const [id, paths] of ids) {
    if (paths.length > 1) {
      issues.push({
        level: "error",
        message: `Duplicate ID "${id}" found at: ${paths.join(", ")}`,
      });
    }
  }

  // 2. Broken refs
  const allIds = new Set(ids.keys());
  const reusableIds = new Set<string>();
  for (const [id, _paths] of ids) {
    // Find the node
    function findNode(nodes: DesignNode[]): DesignNode | undefined {
      for (const n of nodes) {
        if (n.id === id) return n;
        if ("children" in n && Array.isArray(n.children)) {
          const found = findNode(n.children as DesignNode[]);
          if (found) return found;
        }
      }
      return undefined;
    }
    const node = findNode(doc.children);
    if (node?.reusable) {
      reusableIds.add(id);
    }
  }

  const refs = new Set<string>();
  collectRefs(doc.children, refs);
  for (const refId of refs) {
    if (!allIds.has(refId)) {
      issues.push({
        level: "error",
        message: `Broken ref: node references "${refId}" which does not exist`,
      });
    }
  }

  // 3. Missing variables
  const varUsages = new Set<string>();
  collectVariableUsages(doc.children, varUsages);
  const definedVars = new Set((doc.variables ?? []).map((v) => v.name));
  for (const usage of varUsages) {
    if (!definedVars.has(usage)) {
      issues.push({
        level: "warning",
        message: `Variable "$${usage}" is used but not defined in variables`,
      });
    }
  }

  // 4. Ref cycles
  const cycles = detectRefCycles(doc.children, reusableIds);
  for (const cycle of cycles) {
    issues.push({
      level: "error",
      message: cycle,
    });
  }

  return issues;
}
