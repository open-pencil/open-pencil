export interface DesignValidationIssue {
  level: "error" | "warning" | "info";
  category: "color" | "spacing" | "accessibility" | "general";
  message: string;
  nodeId?: string;
}

interface NodeLike {
  id: string;
  type: string;
  width?: number;
  height?: number;
  fill?: Array<{ type: string; color?: string }>;
  gap?: number;
  padding?: { top: number; right: number; bottom: number; left: number };
  [key: string]: unknown;
}

interface VariableLike {
  name: string;
  value: string | number | boolean;
  type: string;
}

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/**
 * Calculate relative luminance of a hex color (WCAG formula).
 */
export function luminance(hex: string): number {
  const normalized = hex.replace("#", "");
  const fullHex =
    normalized.length === 3
      ? normalized
          .split("")
          .map((c) => c + c)
          .join("")
      : normalized.length === 8
        ? normalized.slice(0, 6)
        : normalized;

  const r = parseInt(fullHex.slice(0, 2), 16) / 255;
  const g = parseInt(fullHex.slice(2, 4), 16) / 255;
  const b = parseInt(fullHex.slice(4, 6), 16) / 255;

  const toLinear = (c: number): number => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Calculate contrast ratio between two hex colors (WCAG formula).
 */
export function contrastRatio(fg: string, bg: string): number {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function isHardcodedColor(value: unknown): boolean {
  if (typeof value !== "string") return false;
  if (value.startsWith("$")) return false; // variable reference
  return HEX_COLOR_REGEX.test(value);
}

function collectNodes(nodes: NodeLike[]): NodeLike[] {
  const all: NodeLike[] = [];
  for (const node of nodes) {
    all.push(node);
    if (Array.isArray(node["children"])) {
      all.push(...collectNodes(node["children"] as NodeLike[]));
    }
  }
  return all;
}

/**
 * Validate a design for common quality issues:
 * - Hardcoded colors (should use variables)
 * - Touch targets smaller than 44px
 * - Spacing values not multiples of 8
 */
export function validateDesign(nodes: NodeLike[], variables?: VariableLike[]): DesignValidationIssue[] {
  const issues: DesignValidationIssue[] = [];
  const allNodes = collectNodes(nodes);
  const definedColorVars = new Set(
    (variables ?? []).filter((v) => v.type === "color").map((v) => v.name)
  );

  for (const node of allNodes) {
    // Check hardcoded colors in fills
    if (Array.isArray(node.fill)) {
      for (const fill of node.fill) {
        if (fill.type === "solid" && isHardcodedColor(fill.color)) {
          // Only warn if there are defined color variables (suggesting the project uses a system)
          if (definedColorVars.size > 0) {
            issues.push({
              level: "warning",
              category: "color",
              message: `Node "${node.id}" uses hardcoded color ${fill.color} instead of a variable`,
              nodeId: node.id,
            });
          }
        }
      }
    }

    // Check touch target sizes for interactive-looking elements
    const isInteractive = node.type === "frame" || node.type === "rectangle" || node.type === "icon_font";
    if (isInteractive && typeof node.width === "number" && typeof node.height === "number") {
      if (node.width < 44 && node.height < 44) {
        issues.push({
          level: "warning",
          category: "accessibility",
          message: `Node "${node.id}" (${node.width}x${node.height}) may be too small for touch targets (minimum 44x44px)`,
          nodeId: node.id,
        });
      }
    }

    // Check spacing multiples of 8
    if (typeof node.gap === "number" && node.gap > 0 && node.gap % 8 !== 0) {
      issues.push({
        level: "info",
        category: "spacing",
        message: `Node "${node.id}" has gap ${node.gap}px which is not a multiple of 8`,
        nodeId: node.id,
      });
    }

    if (node.padding) {
      const p = node.padding;
      const values = [p.top, p.right, p.bottom, p.left];
      for (const val of values) {
        if (typeof val === "number" && val > 0 && val % 8 !== 0) {
          issues.push({
            level: "info",
            category: "spacing",
            message: `Node "${node.id}" has padding value ${val}px which is not a multiple of 8`,
            nodeId: node.id,
          });
          break; // One warning per node for padding
        }
      }
    }
  }

  return issues;
}
