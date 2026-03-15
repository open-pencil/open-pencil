import { describe, expect, it } from "bun:test";
import { contrastRatio, luminance, validateDesign } from "../validator.js";

describe("luminance", () => {
  it("returns 0 for black", () => {
    expect(luminance("#000000")).toBeCloseTo(0, 4);
  });

  it("returns 1 for white", () => {
    expect(luminance("#ffffff")).toBeCloseTo(1, 4);
  });

  it("handles 3-digit hex", () => {
    expect(luminance("#fff")).toBeCloseTo(1, 4);
  });
});

describe("contrastRatio", () => {
  it("returns 21 for black on white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
  });

  it("returns 1 for same colors", () => {
    expect(contrastRatio("#336699", "#336699")).toBeCloseTo(1, 1);
  });

  it("is symmetric", () => {
    const r1 = contrastRatio("#333333", "#ffffff");
    const r2 = contrastRatio("#ffffff", "#333333");
    expect(r1).toBeCloseTo(r2, 4);
  });
});

describe("validateDesign", () => {
  it("returns no issues for valid nodes", () => {
    const nodes = [
      { id: "btn1", type: "frame", width: 120, height: 48 },
    ];
    const issues = validateDesign(nodes);
    expect(issues.length).toBe(0);
  });

  it("warns about small touch targets", () => {
    const nodes = [
      { id: "icon1", type: "icon_font", width: 20, height: 20 },
    ];
    const issues = validateDesign(nodes);
    expect(issues.some((i) => i.category === "accessibility" && i.nodeId === "icon1")).toBe(true);
  });

  it("warns about hardcoded colors when variables exist", () => {
    const nodes = [
      {
        id: "box1",
        type: "rectangle",
        width: 100,
        height: 100,
        fill: [{ type: "solid", color: "#ff0000" }],
      },
    ];
    const variables = [{ name: "primary", value: "#0066ff", type: "color" }];
    const issues = validateDesign(nodes, variables);
    expect(issues.some((i) => i.category === "color")).toBe(true);
  });

  it("does not warn about hardcoded colors when no variables defined", () => {
    const nodes = [
      {
        id: "box1",
        type: "rectangle",
        width: 100,
        height: 100,
        fill: [{ type: "solid", color: "#ff0000" }],
      },
    ];
    const issues = validateDesign(nodes);
    expect(issues.filter((i) => i.category === "color").length).toBe(0);
  });

  it("reports spacing not multiple of 8", () => {
    const nodes = [
      { id: "frame1", type: "frame", width: 400, height: 300, gap: 10 },
    ];
    const issues = validateDesign(nodes);
    expect(issues.some((i) => i.category === "spacing")).toBe(true);
  });

  it("does not report spacing that is multiple of 8", () => {
    const nodes = [
      { id: "frame1", type: "frame", width: 400, height: 300, gap: 16 },
    ];
    const issues = validateDesign(nodes);
    expect(issues.filter((i) => i.category === "spacing").length).toBe(0);
  });
});
