// === Replay Marketing/Auth/Onboarding (13 screens) ===
// M-01..04, A-01..04, O-01..05
// 1 eval 完結、 helper は Core で確立した append→resize→x/y 順序

const page = figma.currentPage
for (const c of [...page.children]) c.remove()
page.name = "Replay/Marketing"

function hexToRgb(hex) {
  hex = hex.replace("#", "")
  if (hex.length === 3) hex = hex.split("").map(c => c + c).join("")
  return {
    r: parseInt(hex.substr(0, 2), 16) / 255,
    g: parseInt(hex.substr(2, 2), 16) / 255,
    b: parseInt(hex.substr(4, 2), 16) / 255
  }
}
function solidFill(hex, opacity) {
  const o = { type: "SOLID", color: hexToRgb(hex) }
  if (opacity !== undefined) o.opacity = opacity
  return o
}
function rect(parent, x, y, w, h, opts) {
  opts = opts || {}
  const f = figma.createFrame()
  if (opts.name) f.name = opts.name
  parent.appendChild(f)
  f.resize(w, h)
  f.x = x
  f.y = y
  if (opts.fill) f.fills = [solidFill(opts.fill, opts.fillOpacity)]
  else if (opts.transparent) f.fills = []
  else f.fills = [solidFill("#FFFFFF")]
  if (opts.stroke) {
    f.strokes = [solidFill(opts.stroke, opts.strokeOpacity)]
    f.strokeWeight = opts.strokeWeight || 1
    f.strokeAlign = opts.strokeAlign || "INSIDE"
  }
  if (opts.radius !== undefined) f.cornerRadius = opts.radius
  if (opts.clip !== undefined) f.clipsContent = opts.clip
  return f
}
function txt(parent, x, y, content, opts) {
  opts = opts || {}
  const t = figma.createText()
  t.fontName = { family: opts.family || "Inter", style: opts.style || "Regular" }
  t.characters = content
  parent.appendChild(t)
  if (opts.size) t.fontSize = opts.size
  if (opts.lineHeight) t.lineHeight = { value: opts.lineHeight, unit: "PIXELS" }
  if (opts.width) {
    t.textAutoResize = "HEIGHT"
    t.resize(opts.width, opts.height || opts.lineHeight || (opts.size || 14) * 1.4)
  }
  t.x = x
  t.y = y
  if (opts.align) t.textAlignHorizontal = opts.align
  t.fills = [solidFill(opts.color || "#0F172A", opts.opacity)]
  return t
}
function btn(parent, x, y, w, h, label, opts) {
  opts = opts || {}
  const variant = opts.variant || "primary"
  const fills = { primary: "#0D9488", secondary: "#F1F5F9", ghost: "#FFFFFF", dark: "#0F172A", record: "#EF4444" }
  const labelColors = { primary: "#FFFFFF", secondary: "#0F172A", ghost: "#0F172A", dark: "#FFFFFF", record: "#FFFFFF" }
  const fill = fills[variant] || fills.primary
  const labelColor = labelColors[variant] || "#FFFFFF"
  const f = rect(parent, x, y, w, h, {
    fill: fill,
    radius: opts.radius !== undefined ? opts.radius : 8,
    stroke: variant === "ghost" || variant === "secondary" ? "#CBD5E1" : undefined,
    strokeWeight: 1
  })
  const size = opts.size || 14
  const ty = Math.round((h - size * 1.2) / 2)
  txt(f, 0, ty, label, {
    size: size,
    style: opts.weight || "SemiBold",
    color: labelColor,
    width: w,
    align: "CENTER"
  })
  return f
}
function badge(parent, x, y, label, opts) {
  opts = opts || {}
  const variant = opts.variant || "default"
  const fills = {
    default: "#E2E8F0", success: "#BBF7D0", warning: "#FEF08A", error: "#FECACA",
    info: "#BFDBFE", unwatched: "#FED7AA", new: "#C7D2FE", teal: "#CCFBF1"
  }
  const colors = {
    default: "#1E293B", success: "#14532D", warning: "#713F12", error: "#7F1D1D",
    info: "#1E3A8A", unwatched: "#7C2D12", new: "#312E81", teal: "#134E4A"
  }
  const bg = fills[variant] || fills.default
  const color = colors[variant] || colors.default
  const w = opts.width || (label.length * 7 + 24)
  const h = opts.height || 22
  const f = rect(parent, x, y, w, h, { fill: bg, radius: h / 2 })
  txt(f, 0, Math.round((h - 11) / 2), label, {
    size: 11, style: "Medium", color: color, width: w, align: "CENTER"
  })
  return f
}
function iconBox(parent, x, y, size, hex, letter, opts) {
  opts = opts || {}
  const f = rect(parent, x, y, size, size, {
    fill: hex,
    radius: opts.radius !== undefined ? opts.radius : Math.round(size * 0.25)
  })
  txt(f, 0, Math.round((size - size * 0.55) / 2), letter, {
    size: Math.round(size * 0.55),
    style: "Bold",
    color: opts.fg || "#FFFFFF",
    width: size,
    align: "CENTER"
  })
  return f
}
function avatar(parent, x, y, size, label, opts) {
  opts = opts || {}
  const palette = ["#0D9488", "#7C3AED", "#DB2777", "#F59E0B", "#2563EB", "#059669"]
  const fill = opts.fill || palette[Math.abs(label.charCodeAt(0)) % palette.length]
  const f = rect(parent, x, y, size, size, { fill: fill, radius: size / 2 })
  txt(f, 0, Math.round((size - size * 0.45) / 2), label.charAt(0).toUpperCase(), {
    size: Math.round(size * 0.45),
    style: "SemiBold",
    color: "#FFFFFF",
    width: size,
    align: "CENTER"
  })
  return f
}
function videoMock(parent, x, y, w, h, opts) {
  opts = opts || {}
  const f = rect(parent, x, y, w, h, { fill: opts.bg || "#0F766E", radius: 12, clip: true })
  const ps = Math.min(72, Math.round(w * 0.15))
  rect(f, Math.round((w - ps) / 2), Math.round((h - ps) / 2), ps, ps, {
    fill: "#FFFFFF", radius: ps / 2, fillOpacity: 0.95
  })
  rect(f, Math.round((w - ps) / 2) + Math.round(ps * 0.38), Math.round((h - ps) / 2) + Math.round(ps * 0.32), Math.round(ps * 0.22), Math.round(ps * 0.36), { fill: opts.bg || "#0F766E", radius: 2 })
  rect(f, Math.round((w - ps) / 2) + Math.round(ps * 0.60), Math.round((h - ps) / 2) + Math.round(ps * 0.40), Math.round(ps * 0.14), Math.round(ps * 0.20), { fill: opts.bg || "#0F766E", radius: 2 })
  if (opts.duration) {
    rect(f, w - 60, h - 26, 50, 18, { fill: "#0F172A", radius: 4, fillOpacity: 0.85 })
    txt(f, w - 60, h - 24, opts.duration, { size: 10, color: "#FFFFFF", width: 50, align: "CENTER", style: "Medium" })
  }
  return f
}
function logo(parent, x, y, size) {
  const f = rect(parent, x, y, size, size, { fill: "#0D9488", radius: Math.round(size * 0.2) })
  txt(f, 0, Math.round((size - size * 0.6) / 2), "R", {
    size: Math.round(size * 0.6), style: "Bold", color: "#FFFFFF", width: size, align: "CENTER"
  })
  return f
}
function idTag(page, screen, id, name) {
  const t = figma.createText()
  t.fontName = { family: "Inter", style: "Bold" }
  t.characters = id + " · " + name
  page.appendChild(t)
  t.fontSize = 14
  t.resize(800, 20)
  t.x = screen.x
  t.y = screen.y - 32
  t.fills = [solidFill("#0F172A")]
  const inner = figma.createFrame()
  inner.name = "id-tag-inner"
  screen.appendChild(inner)
  inner.resize(96, 22)
  inner.x = 8
  inner.y = 8
  inner.fills = [solidFill("#0F172A")]
  inner.cornerRadius = 4
  const it = figma.createText()
  it.fontName = { family: "Inter", style: "Bold" }
  it.characters = id
  inner.appendChild(it)
  it.fontSize = 11
  it.resize(96, 14)
  it.x = 0
  it.y = 4
  it.textAlignHorizontal = "CENTER"
  it.fills = [solidFill("#FFFFFF")]
}

// Marketing top nav (used in M-01..M-04)
function marketingNav(parent, w) {
  const nav = rect(parent, 0, 0, w, 72, { fill: "#FFFFFF", stroke: "#E2E8F0" })
  logo(nav, 60, 20, 32)
  txt(nav, 100, 24, "Replay", { size: 16, style: "Bold", color: "#0F172A", width: 80 })
  const navItems = ["Product", "Use cases", "Pricing", "Customers", "Docs"]
  let nx = 240
  for (const it of navItems) {
    txt(nav, nx, 28, it, { size: 13, color: "#475569", width: it.length * 8 + 8 })
    nx += it.length * 8 + 32
  }
  btn(nav, w - 260, 20, 80, 32, "Sign in", { variant: "ghost", size: 12 })
  btn(nav, w - 172, 20, 112, 32, "Start free trial", { variant: "primary", size: 12 })
  return nav
}

const SCREEN_W = 1440
const SCREEN_H_DEFAULT = 900
const SCREEN_H_LP = 1400 // longer for marketing
const SCREEN_H_LP_PRICING = 1640 // pricing has FAQ section
const COLS = 4
const GAP = 200

const SCREENS = [
  ["M-01", "Marketing/Landing", "#F8FAFC", SCREEN_H_LP],
  ["M-02", "Marketing/Pricing", "#F8FAFC", SCREEN_H_LP_PRICING],
  ["M-03", "Marketing/UseCases", "#F8FAFC", SCREEN_H_LP],
  ["M-04", "Marketing/SignupCTA", "#0F172A", SCREEN_H_DEFAULT],
  ["A-01", "Auth/SignUp", "#F1F5F9", SCREEN_H_DEFAULT],
  ["A-02", "Auth/SignIn", "#F1F5F9", SCREEN_H_DEFAULT],
  ["A-03", "Auth/ForgotPassword", "#F1F5F9", SCREEN_H_DEFAULT],
  ["A-04", "Auth/EmailVerify", "#F1F5F9", SCREEN_H_DEFAULT],
  ["O-01", "Onboarding/Welcome", "#F8FAFC", SCREEN_H_DEFAULT],
  ["O-02", "Onboarding/WorkspaceSetup", "#F8FAFC", SCREEN_H_DEFAULT],
  ["O-03", "Onboarding/InstallRecorder", "#F8FAFC", SCREEN_H_DEFAULT],
  ["O-04", "Onboarding/InviteTeam", "#F8FAFC", SCREEN_H_DEFAULT],
  ["O-05", "Onboarding/FirstRecording", "#F8FAFC", SCREEN_H_DEFAULT]
]

const F = {}
for (let i = 0; i < SCREENS.length; i++) {
  const [id, name, bg, h] = SCREENS[i]
  const col = i % COLS
  const row = Math.floor(i / COLS)
  // compute Y as sum of previous row heights
  let ry = 0
  for (let r = 0; r < row; r++) {
    let maxH = 0
    for (let c = 0; c < COLS; c++) {
      const idx = r * COLS + c
      if (idx < SCREENS.length) maxH = Math.max(maxH, SCREENS[idx][3])
    }
    ry += maxH + GAP + 60
  }
  const x = col * (SCREEN_W + GAP)
  const f = figma.createFrame()
  f.name = "Screen/" + name
  f.x = x
  f.y = ry
  page.appendChild(f)
  f.resize(SCREEN_W, h)
  f.fills = [solidFill(bg)]
  f.clipsContent = true
  F[id] = f
  idTag(page, f, id, name)
}

// ===== M-01 Landing =====
;(function (f) {
  marketingNav(f, SCREEN_W)
  // Hero
  badge(f, 720 - 100, 132, "New: AI-generated chapters", { variant: "teal", width: 200 })
  txt(f, 120, 168, "The video tool that actually gets watched.", {
    size: 56, style: "Bold", color: "#0F172A", width: SCREEN_W - 240,
    lineHeight: 64, align: "CENTER"
  })
  txt(f, 120, 312, "Replay turns 5-minute videos into team momentum.", {
    size: 20, color: "#475569", width: SCREEN_W - 240, lineHeight: 28,
    align: "CENTER"
  })
  txt(f, 120, 344, "See who watched, who's behind, and let auto-reminders close the loop.", {
    size: 20, color: "#475569", width: SCREEN_W - 240, align: "CENTER"
  })
  btn(f, 540, 408, 156, 52, "Start free trial", { variant: "primary", size: 15 })
  btn(f, 712, 408, 188, 52, "Watch the 90-sec demo", { variant: "secondary", size: 14 })
  txt(f, 120, 476, "No credit card · Free for 14 days · 50 GB included", {
    size: 12, color: "#94A3B8", width: SCREEN_W - 240, align: "CENTER"
  })

  // Hero visual: app preview mock
  const hpx = 220
  const hpy = 524
  const hpw = SCREEN_W - 440
  const hph = 480
  rect(f, hpx, hpy, hpw, hph, { fill: "#0F172A", radius: 16 })
  // sidebar preview
  rect(f, hpx + 16, hpy + 16, 160, hph - 32, { fill: "#1E293B", radius: 8 })
  logo(f, hpx + 32, hpy + 32, 24)
  txt(f, hpx + 64, hpy + 36, "Replay", { size: 12, style: "SemiBold", color: "#FFFFFF", width: 80 })
  // record button
  rect(f, hpx + 28, hpy + 76, 136, 32, { fill: "#EF4444", radius: 8 })
  txt(f, hpx + 28, hpy + 84, "● Record", { size: 12, style: "SemiBold", color: "#FFFFFF", width: 136, align: "CENTER" })
  for (let i = 0; i < 6; i++) {
    rect(f, hpx + 28, hpy + 124 + i * 36, 136, 28, { fill: "#1E293B", transparent: true, radius: 6 })
    iconBox(f, hpx + 36, hpy + 130 + i * 36, 16, ["#0EA5E9", "#7C3AED", "#F59E0B", "#0D9488", "#DB2777", "#059669"][i], ["H", "L", "C", "A", "W", "S"][i], { radius: 4 })
    txt(f, hpx + 58, hpy + 132 + i * 36, ["Home", "Library", "Comments", "Analytics", "Workflows", "Search"][i], {
      size: 11, color: i === 3 ? "#FFFFFF" : "#94A3B8", width: 80
    })
  }
  // Main area: video + viewing ops
  videoMock(f, hpx + 196, hpy + 16, hpw - 480, hph - 32, { bg: "#0F766E", duration: "5:12" })
  // viewing ops panel
  const opx = hpx + hpw - 268
  rect(f, opx, hpy + 16, 252, hph - 32, { fill: "#FFFFFF", radius: 12 })
  txt(f, opx + 16, hpy + 32, "Today's viewing ops", {
    size: 13, style: "SemiBold", color: "#0F172A", width: 220
  })
  const stats = [
    ["Avg watch rate", "73%", "+8% wk", "success"],
    ["Unwatched (you)", "3 videos", "12m ago", "warning"],
    ["Awaiting reply", "5 comments", "2 customer", "info"]
  ]
  for (let i = 0; i < stats.length; i++) {
    rect(f, opx + 16, hpy + 60 + i * 92, 220, 80, { fill: "#F8FAFC", radius: 8 })
    txt(f, opx + 28, hpy + 70 + i * 92, stats[i][0], { size: 10, color: "#64748B", width: 200 })
    txt(f, opx + 28, hpy + 84 + i * 92, stats[i][1], {
      size: 18, style: "Bold", color: "#0F172A", width: 200
    })
    badge(f, opx + 28, hpy + 112 + i * 92, stats[i][2], { variant: stats[i][3] })
  }

  // Social proof
  txt(f, 120, hpy + hph + 56, "Trusted by remote teams that ship", {
    size: 13, color: "#64748B", width: SCREEN_W - 240, align: "CENTER", style: "Medium"
  })
  const logos = ["Acme", "Globex", "Yamato", "Zora", "Initech", "Stark"]
  for (let i = 0; i < logos.length; i++) {
    const lx = 200 + i * 180
    rect(f, lx, hpy + hph + 88, 140, 40, { fill: "#FFFFFF", stroke: "#E2E8F0", radius: 6 })
    txt(f, lx, hpy + hph + 100, logos[i], {
      size: 14, style: "Bold", color: "#475569", width: 140, align: "CENTER"
    })
  }

  // Features 3 cards
  const fy = hpy + hph + 180
  txt(f, 120, fy, "Built so 'I sent the video' actually means 'they got it.'", {
    size: 32, style: "Bold", color: "#0F172A", width: SCREEN_W - 240, align: "CENTER", lineHeight: 40
  })
  const features = [
    ["Viewing ops dashboard", "Who watched, who dropped where. Nudge only the people you need to.", "#0D9488", "V"],
    ["AI summary + chapters", "5-min videos get a TL;DR, chapters, action items, and multi-lingual transcript.", "#7C3AED", "A"],
    ["Slack / Linear / Notion auto-routing", "Workflows post videos where work happens, then close the loop on its own.", "#0EA5E9", "R"]
  ]
  for (let i = 0; i < features.length; i++) {
    const cx = 120 + i * ((SCREEN_W - 240 - 64) / 3 + 32)
    const cw = (SCREEN_W - 240 - 64) / 3
    rect(f, cx, fy + 96, cw, 240, { fill: "#FFFFFF", radius: 16, stroke: "#E2E8F0" })
    iconBox(f, cx + 32, fy + 128, 44, features[i][2], features[i][3], { radius: 10 })
    txt(f, cx + 32, fy + 192, features[i][0], {
      size: 18, style: "SemiBold", color: "#0F172A", width: cw - 64, lineHeight: 24
    })
    txt(f, cx + 32, fy + 234, features[i][1], {
      size: 13, color: "#475569", width: cw - 64, lineHeight: 20
    })
    txt(f, cx + 32, fy + 300, "Learn more →", {
      size: 12, style: "Medium", color: "#0D9488", width: 120
    })
  }
})(F["M-01"])

// ===== M-02 Pricing =====
;(function (f) {
  marketingNav(f, SCREEN_W)
  badge(f, 720 - 80, 120, "14-day free trial", { variant: "teal", width: 160 })
  txt(f, 120, 156, "Pricing that scales with your team.", {
    size: 48, style: "Bold", color: "#0F172A", width: SCREEN_W - 240,
    lineHeight: 56, align: "CENTER"
  })
  txt(f, 120, 232, "Per seat / month, billed annually. Cancel any time.", {
    size: 16, color: "#64748B", width: SCREEN_W - 240, align: "CENTER"
  })

  // Toggle
  rect(f, 660, 280, 120, 36, { fill: "#FFFFFF", stroke: "#E2E8F0", radius: 18 })
  rect(f, 664, 284, 56, 28, { fill: "#0F172A", radius: 14 })
  txt(f, 664, 291, "Annual", { size: 12, style: "Medium", color: "#FFFFFF", width: 56, align: "CENTER" })
  txt(f, 720, 291, "Monthly", { size: 12, color: "#475569", width: 56, align: "CENTER" })
  badge(f, 786, 286, "Save 20%", { variant: "success", width: 76 })

  // 3 tier cards
  const tiers = [
    ["Starter", "Free", "For solo creators & small teams up to 10", [
      "5 GB recording storage",
      "Personal library + unlimited views",
      "Basic transcript (EN, JA)",
      "Slack share link",
      "—"
    ], "Get started", "ghost"],
    ["Business", "$15", "Where teams of 10-500 land. Most popular.", [
      "1 TB pooled storage",
      "Viewing ops dashboard",
      "AI chapters & action items",
      "Workflows + Slack/Linear/Notion",
      "External shares with lead capture"
    ], "Start free trial", "primary", true],
    ["Enterprise", "Custom", "For 500+ orgs with compliance needs", [
      "Unlimited pooled storage",
      "SOC 2 Type II, SSO/SAML",
      "Dynamic watermark + DLP",
      "Audit log + admin API",
      "Dedicated CSM"
    ], "Talk to sales", "dark"]
  ]
  const cardW = 360
  const cardH = 560
  const totalW = cardW * 3 + 48
  const startX = Math.round((SCREEN_W - totalW) / 2)
  for (let i = 0; i < tiers.length; i++) {
    const cx = startX + i * (cardW + 24)
    const featured = tiers[i][6]
    const card = rect(f, cx, 348, cardW, cardH, {
      fill: featured ? "#0F172A" : "#FFFFFF",
      stroke: featured ? "#0D9488" : "#E2E8F0",
      strokeWeight: featured ? 2 : 1,
      radius: 16
    })
    if (featured) {
      badge(card, 24, 24, "Most popular", { variant: "teal", width: 112 })
    }
    txt(card, 32, featured ? 62 : 32, tiers[i][0], {
      size: 18, style: "SemiBold",
      color: featured ? "#FFFFFF" : "#0F172A", width: cardW - 64
    })
    txt(card, 32, featured ? 96 : 64, tiers[i][1], {
      size: 44, style: "Bold",
      color: featured ? "#FFFFFF" : "#0F172A", width: cardW - 64,
      lineHeight: 52
    })
    if (tiers[i][1] !== "Custom" && tiers[i][1] !== "Free") {
      txt(card, 132, featured ? 124 : 92, "/ seat / mo", {
        size: 13, color: featured ? "#94A3B8" : "#64748B", width: 120
      })
    }
    txt(card, 32, featured ? 156 : 128, tiers[i][2], {
      size: 12, color: featured ? "#94A3B8" : "#64748B",
      width: cardW - 64, lineHeight: 18
    })
    // features
    for (let j = 0; j < tiers[i][3].length; j++) {
      const fy = (featured ? 204 : 176) + j * 36
      iconBox(card, 32, fy, 18, "#0D9488", "✓", { radius: 9 })
      txt(card, 56, fy + 2, tiers[i][3][j], {
        size: 12, color: featured ? "#E2E8F0" : "#475569", width: cardW - 88
      })
    }
    btn(card, 32, cardH - 64, cardW - 64, 44, tiers[i][4], { variant: tiers[i][5], size: 13 })
  }

  // Comparison table title
  txt(f, 120, 968, "Compare features", {
    size: 28, style: "Bold", color: "#0F172A", width: SCREEN_W - 240, align: "CENTER"
  })

  // Comparison table
  const tbX = 240
  const tbY = 1024
  const tbW = SCREEN_W - 480
  rect(f, tbX, tbY, tbW, 280, { fill: "#FFFFFF", stroke: "#E2E8F0", radius: 12 })
  // Header
  const colW = (tbW - 240) / 3
  const headers = ["Feature", "Starter", "Business", "Enterprise"]
  for (let i = 0; i < headers.length; i++) {
    const cx = i === 0 ? tbX + 32 : tbX + 240 + (i - 1) * colW
    txt(f, cx, tbY + 24, headers[i], {
      size: 12, style: "SemiBold", color: "#64748B", width: i === 0 ? 200 : colW, align: i === 0 ? "LEFT" : "CENTER"
    })
  }
  rect(f, tbX + 16, tbY + 60, tbW - 32, 1, { fill: "#E2E8F0" })
  // Rows
  const rowsData = [
    ["Storage", "5 GB", "1 TB pooled", "Unlimited"],
    ["Team viewing dashboard", "—", "✓", "✓"],
    ["Workflows", "—", "10 active", "Unlimited"],
    ["SSO/SAML", "—", "—", "✓"],
    ["Audit log", "—", "30 days", "Forever"]
  ]
  for (let r = 0; r < rowsData.length; r++) {
    const ry = tbY + 80 + r * 36
    for (let c = 0; c < 4; c++) {
      const cx = c === 0 ? tbX + 32 : tbX + 240 + (c - 1) * colW
      txt(f, cx, ry, rowsData[r][c], {
        size: 12, color: c === 0 ? "#0F172A" : "#475569",
        style: c === 0 ? "Medium" : "Regular",
        width: c === 0 ? 200 : colW, align: c === 0 ? "LEFT" : "CENTER"
      })
    }
  }

  // FAQ section (Phase 3 minor fix #2)
  const fqY = 1336
  txt(f, 120, fqY, "Frequently asked", {
    size: 28, style: "Bold", color: "#0F172A", width: SCREEN_W - 240, align: "CENTER"
  })
  const faqs = [
    ["Can I switch tiers later?", "Yes — upgrades take effect immediately, downgrades on renewal. We prorate the difference."],
    ["Where is my video data stored?", "AWS Tokyo region by default, with EU and US options on Enterprise. SOC 2 Type II for Business+."],
    ["What happens to my videos when I cancel?", "We keep them read-only for 30 days, then anonymize. You can export everything as MP4 before then."],
    ["Do I need a credit card for the trial?", "No card to start. We ask before the trial ends, never charge you without confirmation."]
  ]
  const fqX = 240
  const fqW = SCREEN_W - 480
  for (let i = 0; i < faqs.length; i++) {
    const yo = fqY + 56 + i * 68
    rect(f, fqX, yo, fqW, 56, {
      fill: "#FFFFFF", stroke: "#E2E8F0", radius: 10
    })
    txt(f, fqX + 24, yo + 10, faqs[i][0], {
      size: 14, style: "SemiBold", color: "#0F172A", width: fqW - 60
    })
    txt(f, fqX + 24, yo + 30, faqs[i][1], {
      size: 12, color: "#64748B", width: fqW - 60
    })
    rect(f, fqX + fqW - 36, yo + 24, 12, 2, { fill: "#94A3B8" })
    rect(f, fqX + fqW - 30, yo + 18, 2, 14, { fill: "#94A3B8" })
  }
})(F["M-02"])

// ===== M-03 Use cases =====
;(function (f) {
  marketingNav(f, SCREEN_W)
  txt(f, 120, 140, "One tool. Four ways your team will use it.", {
    size: 44, style: "Bold", color: "#0F172A", width: SCREEN_W - 240,
    lineHeight: 52, align: "CENTER"
  })
  txt(f, 120, 224, "Every team is different. Replay flexes to how you work, async.", {
    size: 16, color: "#64748B", width: SCREEN_W - 240, align: "CENTER"
  })

  // Tab nav
  const tabs = [
    ["Engineering", true],
    ["Product", false],
    ["Customer Success", false],
    ["Leadership", false]
  ]
  const tabsTotalW = 720
  let txX = Math.round((SCREEN_W - tabsTotalW) / 2)
  for (let i = 0; i < tabs.length; i++) {
    const w = 176
    const active = tabs[i][1]
    rect(f, txX + i * (w + 4), 286, w, 44, {
      fill: active ? "#0F172A" : "#FFFFFF",
      stroke: active ? "#0F172A" : "#E2E8F0",
      radius: 22
    })
    txt(f, txX + i * (w + 4), 300, tabs[i][0], {
      size: 13, style: active ? "SemiBold" : "Regular",
      color: active ? "#FFFFFF" : "#475569",
      width: w, align: "CENTER"
    })
  }

  // Use case content
  const ux = 120
  const uy = 380
  rect(f, ux, uy, SCREEN_W - 240, 540, {
    fill: "#FFFFFF", radius: 20, stroke: "#E2E8F0"
  })
  badge(f, ux + 56, uy + 56, "For Engineering", { variant: "info", width: 140 })
  txt(f, ux + 56, uy + 90, "PR walkthroughs that don't get lost in Slack.", {
    size: 32, style: "Bold", color: "#0F172A", width: 600, lineHeight: 40
  })
  txt(f, ux + 56, uy + 192, "Record a 3-minute walkthrough of your PR. Replay turns it into",
    { size: 16, color: "#475569", width: 600, lineHeight: 24 })
  txt(f, ux + 56, uy + 216, "transcript + chapters, posts it to #frontend with a 'remind",
    { size: 16, color: "#475569", width: 600 })
  txt(f, ux + 56, uy + 240, "in 24h if unwatched' workflow.", { size: 16, color: "#475569", width: 600 })

  // bullet features
  const items = [
    ["Inline Figma & GitHub embeds", "Replay opens with PR / Figma context"],
    ["Timestamped comments", "Anchor discussion to the exact moment"],
    ["Video reply", "Answer with a 30-sec recording, not text"]
  ]
  for (let i = 0; i < items.length; i++) {
    const ix = ux + 56
    const iy = uy + 290 + i * 60
    iconBox(f, ix, iy, 28, "#0D9488", "✓", { radius: 14 })
    txt(f, ix + 44, iy + 2, items[i][0], {
      size: 14, style: "SemiBold", color: "#0F172A", width: 500
    })
    txt(f, ix + 44, iy + 22, items[i][1], {
      size: 12, color: "#64748B", width: 500
    })
  }
  btn(f, ux + 56, uy + 480, 168, 44, "See it in action", { variant: "primary", size: 13 })

  // Right preview
  const px = ux + 700
  const py = uy + 56
  const pw = SCREEN_W - 240 - 700 - 80
  const ph = 440
  rect(f, px, py, pw, ph, { fill: "#0F172A", radius: 16 })
  videoMock(f, px + 24, py + 24, pw - 48, ph - 48, { bg: "#7C3AED", duration: "3:14" })

  // Other tab previews row
  const ty2 = uy + 600
  txt(f, ux, ty2, "Also great for", {
    size: 13, style: "Medium", color: "#64748B", width: 200
  })
  const otherUC = [
    ["Product", "Async spec videos that get watched", "#0EA5E9"],
    ["CS", "Demo videos with viewer drop-off analytics", "#F59E0B"],
    ["Leadership", "All-hands you can revisit any time", "#7C3AED"]
  ]
  const oW = (SCREEN_W - 240 - 32) / 3
  for (let i = 0; i < otherUC.length; i++) {
    const cx = ux + i * (oW + 16)
    rect(f, cx, ty2 + 32, oW, 120, {
      fill: "#FFFFFF", radius: 12, stroke: "#E2E8F0"
    })
    iconBox(f, cx + 20, ty2 + 52, 32, otherUC[i][2], otherUC[i][0].charAt(0), { radius: 8 })
    txt(f, cx + 64, ty2 + 56, otherUC[i][0], {
      size: 15, style: "SemiBold", color: "#0F172A", width: oW - 80
    })
    txt(f, cx + 20, ty2 + 100, otherUC[i][1], {
      size: 12, color: "#475569", width: oW - 40, lineHeight: 18
    })
  }
})(F["M-03"])

// ===== M-04 Signup CTA =====
;(function (f) {
  // Dark mode hero with form on the left, mock app on the right
  rect(f, 0, 0, SCREEN_W, SCREEN_H_DEFAULT, { fill: "#0F172A" })

  // Nav with white-on-dark
  logo(f, 60, 24, 32)
  txt(f, 100, 28, "Replay", { size: 16, style: "Bold", color: "#FFFFFF", width: 80 })
  txt(f, SCREEN_W - 220, 28, "Already a customer?", { size: 12, color: "#94A3B8", width: 140 })
  txt(f, SCREEN_W - 80, 28, "Sign in →", { size: 12, style: "Medium", color: "#0D9488", width: 80 })

  // Left content
  const lx = 120
  const ly = 200
  badge(f, lx, ly - 36, "Free 14 days · No credit card", { variant: "teal", width: 224 })
  txt(f, lx, ly, "Start sharing context async.", {
    size: 42, style: "Bold", color: "#FFFFFF", width: 560, lineHeight: 50
  })
  txt(f, lx, ly + 124, "Loom-style recording with team viewing operations built in. Try Replay free for 14 days.", {
    size: 16, color: "#94A3B8", width: 540, lineHeight: 24
  })

  // Email form
  rect(f, lx, ly + 220, 540, 60, { fill: "#1E293B", stroke: "#334155", radius: 12 })
  txt(f, lx + 20, ly + 240, "name@company.com", { size: 14, color: "#94A3B8", width: 240 })
  btn(f, lx + 380, ly + 230, 144, 40, "Start trial", { variant: "primary", size: 13 })

  // Below benefits row
  const bullets = ["Setup in 60 sec", "Cancel anytime", "Data stays yours"]
  for (let i = 0; i < bullets.length; i++) {
    iconBox(f, lx + i * 180, ly + 308, 18, "#0D9488", "✓", { radius: 9 })
    txt(f, lx + i * 180 + 24, ly + 311, bullets[i], {
      size: 12, color: "#E2E8F0", width: 150
    })
  }

  // Inline SSO row (Phase 3 minor fix #4)
  rect(f, lx, ly + 366, 230, 1, { fill: "#334155" })
  txt(f, lx + 240, ly + 358, "or sign in with", {
    size: 11, color: "#94A3B8", width: 80, align: "CENTER"
  })
  rect(f, lx + 326, ly + 366, 230, 1, { fill: "#334155" })

  const ssoBtns = [
    ["Google", "G", "#EA4335"],
    ["Microsoft", "M", "#0078D4"],
    ["Okta SSO", "O", "#0F172A"]
  ]
  const sbW = (540 - 24) / 3
  for (let i = 0; i < ssoBtns.length; i++) {
    const sx = lx + i * (sbW + 12)
    rect(f, sx, ly + 396, sbW, 44, {
      fill: "#1E293B", stroke: "#334155", radius: 10
    })
    iconBox(f, sx + 14, ly + 408, 20, ssoBtns[i][2], ssoBtns[i][1], { radius: 4 })
    txt(f, sx + 40, ly + 411, ssoBtns[i][0], {
      size: 13, style: "Medium", color: "#FFFFFF",
      width: sbW - 56
    })
  }

  // Right: stylized mock app preview, floating
  const rx = SCREEN_W - 680
  const ry = ly - 40
  rect(f, rx, ry, 600, 480, { fill: "#020617", radius: 16, stroke: "#1E293B" })
  videoMock(f, rx + 24, ry + 24, 552, 320, { bg: "#0D9488", duration: "5:12" })
  rect(f, rx + 24, ry + 364, 552, 96, { fill: "#1E293B", radius: 8 })
  txt(f, rx + 40, ry + 380, "8 of 14 watched", { size: 12, color: "#94A3B8", width: 200 })
  txt(f, rx + 40, ry + 398, "Q4 roadmap walkthrough", {
    size: 14, style: "SemiBold", color: "#FFFFFF", width: 400
  })
  badge(f, rx + 40, ry + 422, "Reminder sent to 6 viewers", { variant: "info", width: 200 })
  badge(f, rx + 248, ry + 422, "auto by Workflows", { variant: "teal", width: 160 })
})(F["M-04"])

// ===== A-01 Sign up =====
;(function (f) {
  // Split: left brand panel, right form
  rect(f, 0, 0, 560, SCREEN_H_DEFAULT, { fill: "#0F172A" })
  logo(f, 60, 60, 36)
  txt(f, 108, 64, "Replay", { size: 18, style: "Bold", color: "#FFFFFF", width: 120 })
  txt(f, 60, 200, "Stop wondering if your team caught up.", {
    size: 28, style: "Bold", color: "#FFFFFF", width: 440, lineHeight: 36
  })
  txt(f, 60, 312, "5-min videos with viewing dashboards, auto-routing, and timestamped comments.", {
    size: 14, color: "#94A3B8", width: 440, lineHeight: 22
  })
  // Testimonial card
  rect(f, 60, 480, 440, 200, { fill: "#1E293B", radius: 12 })
  badge(f, 80, 504, "PRODUCT", { variant: "info", width: 76 })
  txt(f, 80, 538, "\"We replaced our weekly sync with Replay videos. Async actually works now.\"", {
    size: 15, color: "#FFFFFF", width: 400, lineHeight: 22, style: "Medium"
  })
  avatar(f, 80, 636, 32, "M")
  txt(f, 120, 640, "Mika Tanaka", { size: 13, style: "SemiBold", color: "#FFFFFF", width: 160 })
  txt(f, 120, 658, "PM, Acme Inc.", { size: 11, color: "#94A3B8", width: 160 })

  // Right form area
  const fx = 700
  const fy = 100
  txt(f, fx, fy, "Create your workspace", {
    size: 28, style: "Bold", color: "#0F172A", width: 540
  })
  txt(f, fx, fy + 44, "Already on Replay?", { size: 13, color: "#64748B", width: 140 })
  txt(f, fx + 142, fy + 44, "Sign in", { size: 13, style: "Medium", color: "#0D9488", width: 80 })

  // SSO buttons
  btn(f, fx, fy + 92, 260, 44, "Continue with Google", { variant: "ghost", size: 13 })
  btn(f, fx + 276, fy + 92, 260, 44, "Continue with Microsoft", { variant: "ghost", size: 13 })
  btn(f, fx, fy + 152, 536, 44, "Continue with Okta SSO", { variant: "ghost", size: 13 })

  // Or divider
  rect(f, fx, fy + 224, 230, 1, { fill: "#E2E8F0" })
  txt(f, fx + 240, fy + 218, "or", { size: 12, color: "#94A3B8", width: 56, align: "CENTER" })
  rect(f, fx + 306, fy + 224, 230, 1, { fill: "#E2E8F0" })

  // Form fields
  const fields = [
    ["Work email", "name@company.com"],
    ["Workspace name", "Acme Inc."],
    ["Password", "8+ characters"]
  ]
  for (let i = 0; i < fields.length; i++) {
    const yo = fy + 264 + i * 84
    txt(f, fx, yo, fields[i][0], {
      size: 12, style: "Medium", color: "#475569", width: 200
    })
    rect(f, fx, yo + 22, 536, 44, {
      fill: "#FFFFFF", stroke: "#CBD5E1", radius: 8
    })
    txt(f, fx + 16, yo + 36, fields[i][1], { size: 13, color: "#94A3B8", width: 500 })
  }

  // Checkbox & CTA
  rect(f, fx, fy + 540, 16, 16, { fill: "#0D9488", radius: 4 })
  txt(f, fx + 4, fy + 540 - 1, "✓", { size: 11, style: "Bold", color: "#FFFFFF", width: 16, align: "CENTER" })
  txt(f, fx + 24, fy + 540, "I agree to Replay's terms and privacy policy.", {
    size: 12, color: "#475569", width: 460
  })

  btn(f, fx, fy + 580, 536, 48, "Create workspace", { variant: "primary", size: 14 })

  txt(f, fx, fy + 644, "By creating an account you accept the data processing terms.", {
    size: 11, color: "#94A3B8", width: 536
  })
})(F["A-01"])

// ===== A-02 Sign in =====
;(function (f) {
  // Centered card on light bg
  rect(f, 0, 0, SCREEN_W, SCREEN_H_DEFAULT, { fill: "#F1F5F9" })

  // Top brand
  logo(f, Math.round((SCREEN_W - 36) / 2), 80, 36)
  txt(f, 0, 124, "Replay", {
    size: 18, style: "Bold", color: "#0F172A", width: SCREEN_W, align: "CENTER"
  })

  const cw = 480
  const ch = 580
  const cx = Math.round((SCREEN_W - cw) / 2)
  const cy = 200
  rect(f, cx, cy, cw, ch, { fill: "#FFFFFF", radius: 20, stroke: "#E2E8F0" })

  txt(f, cx + 40, cy + 40, "Welcome back", {
    size: 24, style: "Bold", color: "#0F172A", width: cw - 80
  })
  txt(f, cx + 40, cy + 76, "Sign in to your Replay workspace.", {
    size: 13, color: "#64748B", width: cw - 80
  })

  // SSO
  btn(f, cx + 40, cy + 124, cw - 80, 44, "Continue with Google", { variant: "ghost", size: 13 })
  btn(f, cx + 40, cy + 180, cw - 80, 44, "Continue with Microsoft", { variant: "ghost", size: 13 })
  btn(f, cx + 40, cy + 236, cw - 80, 44, "Continue with SSO", { variant: "ghost", size: 13 })

  rect(f, cx + 40, cy + 312, 160, 1, { fill: "#E2E8F0" })
  txt(f, cx + 200, cy + 306, "or email", { size: 11, color: "#94A3B8", width: 80, align: "CENTER" })
  rect(f, cx + 280, cy + 312, 160, 1, { fill: "#E2E8F0" })

  // Email
  txt(f, cx + 40, cy + 340, "Email", {
    size: 12, style: "Medium", color: "#475569", width: 200
  })
  rect(f, cx + 40, cy + 360, cw - 80, 44, {
    fill: "#FFFFFF", stroke: "#CBD5E1", radius: 8
  })
  txt(f, cx + 56, cy + 374, "you@company.com", { size: 13, color: "#94A3B8", width: 360 })

  txt(f, cx + 40, cy + 416, "Password", {
    size: 12, style: "Medium", color: "#475569", width: 200
  })
  txt(f, cx + cw - 156, cy + 416, "Forgot password?", {
    size: 12, color: "#0D9488", style: "Medium", width: 120, align: "RIGHT"
  })
  rect(f, cx + 40, cy + 436, cw - 80, 44, {
    fill: "#FFFFFF", stroke: "#CBD5E1", radius: 8
  })
  txt(f, cx + 56, cy + 450, "••••••••••••", { size: 13, color: "#0F172A", width: 200 })

  btn(f, cx + 40, cy + 504, cw - 80, 48, "Sign in", { variant: "primary", size: 14 })

  txt(f, 0, cy + ch + 32, "New to Replay?", {
    size: 13, color: "#64748B", width: SCREEN_W, align: "CENTER"
  })
  txt(f, 0, cy + ch + 52, "Create a workspace →", {
    size: 13, style: "Medium", color: "#0D9488", width: SCREEN_W, align: "CENTER"
  })
})(F["A-02"])

// ===== A-03 Forgot password =====
;(function (f) {
  rect(f, 0, 0, SCREEN_W, SCREEN_H_DEFAULT, { fill: "#F1F5F9" })
  logo(f, Math.round((SCREEN_W - 36) / 2), 80, 36)
  txt(f, 0, 124, "Replay", {
    size: 18, style: "Bold", color: "#0F172A", width: SCREEN_W, align: "CENTER"
  })

  const cw = 440
  const ch = 420
  const cx = Math.round((SCREEN_W - cw) / 2)
  const cy = 240
  rect(f, cx, cy, cw, ch, { fill: "#FFFFFF", radius: 20, stroke: "#E2E8F0" })
  iconBox(f, cx + Math.round((cw - 48) / 2), cy + 40, 48, "#ECFEFF", "L", { radius: 24, fg: "#0D9488" })
  txt(f, cx + 40, cy + 108, "Reset your password", {
    size: 22, style: "Bold", color: "#0F172A", width: cw - 80, align: "CENTER"
  })
  txt(f, cx + 40, cy + 148, "Enter the email associated with your account.", {
    size: 13, color: "#64748B", width: cw - 80, align: "CENTER", lineHeight: 18
  })
  txt(f, cx + 40, cy + 168, "We'll send you a reset link.", {
    size: 13, color: "#64748B", width: cw - 80, align: "CENTER"
  })

  txt(f, cx + 40, cy + 212, "Email", {
    size: 12, style: "Medium", color: "#475569", width: 200
  })
  rect(f, cx + 40, cy + 232, cw - 80, 44, {
    fill: "#FFFFFF", stroke: "#CBD5E1", radius: 8
  })
  txt(f, cx + 56, cy + 246, "you@company.com", { size: 13, color: "#94A3B8", width: 280 })

  btn(f, cx + 40, cy + 296, cw - 80, 48, "Send reset link", { variant: "primary", size: 14 })

  txt(f, cx + 40, cy + 360, "← Back to sign in", {
    size: 13, style: "Medium", color: "#0D9488",
    width: cw - 80, align: "CENTER"
  })

  // Help text
  txt(f, 0, cy + ch + 32, "Trouble? Reach support at help@replay.app", {
    size: 12, color: "#94A3B8", width: SCREEN_W, align: "CENTER"
  })
})(F["A-03"])

// ===== A-04 Email verify =====
;(function (f) {
  rect(f, 0, 0, SCREEN_W, SCREEN_H_DEFAULT, { fill: "#F1F5F9" })
  logo(f, Math.round((SCREEN_W - 36) / 2), 80, 36)
  txt(f, 0, 124, "Replay", {
    size: 18, style: "Bold", color: "#0F172A", width: SCREEN_W, align: "CENTER"
  })

  const cw = 480
  const ch = 480
  const cx = Math.round((SCREEN_W - cw) / 2)
  const cy = 220
  rect(f, cx, cy, cw, ch, { fill: "#FFFFFF", radius: 20, stroke: "#E2E8F0" })
  iconBox(f, cx + Math.round((cw - 64) / 2), cy + 48, 64, "#ECFEFF", "@", { radius: 32, fg: "#0D9488" })

  txt(f, cx + 40, cy + 132, "Check your inbox", {
    size: 24, style: "Bold", color: "#0F172A", width: cw - 80, align: "CENTER"
  })
  txt(f, cx + 40, cy + 176, "We just sent a verification link to", {
    size: 13, color: "#64748B", width: cw - 80, align: "CENTER"
  })
  txt(f, cx + 40, cy + 200, "mika@acme.com", {
    size: 14, style: "SemiBold", color: "#0F172A", width: cw - 80, align: "CENTER"
  })
  txt(f, cx + 40, cy + 234, "Open the email and click 'Verify' to continue.", {
    size: 12, color: "#64748B", width: cw - 80, align: "CENTER"
  })

  // OTP boxes
  for (let i = 0; i < 6; i++) {
    const otpX = cx + Math.round((cw - 6 * 44 - 5 * 8) / 2) + i * 52
    rect(f, otpX, cy + 282, 44, 52, {
      fill: i < 3 ? "#FFFFFF" : "#F8FAFC",
      stroke: i < 3 ? "#0D9488" : "#CBD5E1",
      radius: 8
    })
    if (i < 3) {
      txt(f, otpX, cy + 296, ["7", "2", "4"][i], {
        size: 20, style: "Bold", color: "#0F172A",
        width: 44, align: "CENTER"
      })
    }
  }

  // Resend
  txt(f, cx + 40, cy + 360, "Didn't get the email?", {
    size: 12, color: "#64748B", width: cw - 80, align: "CENTER"
  })
  txt(f, cx + 40, cy + 380, "Resend in 28 seconds", {
    size: 12, style: "Medium", color: "#0D9488",
    width: cw - 80, align: "CENTER"
  })

  // Change email
  rect(f, cx + 40, cy + 412, cw - 80, 1, { fill: "#E2E8F0" })
  txt(f, cx + 40, cy + 424, "Wrong email? Change it →", {
    size: 13, style: "Medium", color: "#0F172A",
    width: cw - 80, align: "CENTER"
  })
})(F["A-04"])

// ===== O-01 Welcome =====
;(function (f) {
  rect(f, 0, 0, SCREEN_W, SCREEN_H_DEFAULT, { fill: "#F8FAFC" })
  // Top bar simple
  logo(f, 32, 24, 32)
  txt(f, 72, 28, "Replay", { size: 16, style: "Bold", color: "#0F172A", width: 80 })
  // Progress
  txt(f, SCREEN_W - 200, 28, "Setup · Step 1 of 5", { size: 12, color: "#64748B", width: 160, align: "RIGHT" })

  // Hero
  txt(f, 120, 140, "Welcome to Replay, Mika.", {
    size: 40, style: "Bold", color: "#0F172A", width: SCREEN_W - 240,
    lineHeight: 48, align: "CENTER"
  })
  txt(f, 120, 212, "Three quick actions to get your team going.", {
    size: 16, color: "#475569", width: SCREEN_W - 240, align: "CENTER"
  })

  // 3 action cards
  const aw = 360
  const ah = 380
  const totalW = aw * 3 + 32 * 2
  const startX = Math.round((SCREEN_W - totalW) / 2)
  const actions = [
    ["Record your first video", "Try recording in under 60 seconds. We'll guide you through it.", "Most teams ship their first in under a minute.", "Start recording", "#0D9488", "R", true],
    ["Watch the demo", "See how a real PM team uses Replay every week.", "Sora, Mika, and Ren in a 90-sec walkthrough.", "Watch (90 sec)", "#7C3AED", "D", false],
    ["Invite your team", "Bring 1-50 teammates so videos have a place to land.", "Replay works best with 5+ people on board.", "Invite team", "#0EA5E9", "I", false]
  ]
  for (let i = 0; i < actions.length; i++) {
    const cx = startX + i * (aw + 32)
    const featured = actions[i][6]
    rect(f, cx, 296, aw, ah, {
      fill: "#FFFFFF",
      stroke: featured ? "#0D9488" : "#E2E8F0",
      strokeWeight: featured ? 2 : 1,
      radius: 16
    })
    if (featured) {
      badge(f, cx + 24, 320, "Recommended", { variant: "teal", width: 116 })
    }
    iconBox(f, cx + 24, featured ? 360 : 332, 56, actions[i][4], actions[i][5], { radius: 12 })
    txt(f, cx + 24, featured ? 432 : 404, actions[i][0], {
      size: 20, style: "SemiBold", color: "#0F172A", width: aw - 48, lineHeight: 28
    })
    txt(f, cx + 24, featured ? 484 : 456, actions[i][2], {
      size: 13, color: "#0F172A", style: "Medium", width: aw - 48, lineHeight: 20
    })
    txt(f, cx + 24, featured ? 528 : 500, actions[i][1], {
      size: 13, color: "#475569", width: aw - 48, lineHeight: 20
    })
    btn(f, cx + 24, ah + 296 - 80, aw - 48, 44, actions[i][3], {
      variant: featured ? "primary" : "ghost", size: 13
    })
  }

  // Skip
  txt(f, 0, SCREEN_H_DEFAULT - 96, "Or skip and explore on your own →", {
    size: 13, style: "Medium", color: "#64748B",
    width: SCREEN_W, align: "CENTER"
  })
})(F["O-01"])

// ===== O-02 Workspace setup =====
;(function (f) {
  rect(f, 0, 0, SCREEN_W, SCREEN_H_DEFAULT, { fill: "#F8FAFC" })
  logo(f, 32, 24, 32)
  txt(f, 72, 28, "Replay", { size: 16, style: "Bold", color: "#0F172A", width: 80 })
  txt(f, SCREEN_W - 200, 28, "Setup · Step 2 of 5", { size: 12, color: "#64748B", width: 160, align: "RIGHT" })

  // Progress bar
  rect(f, 0, 70, SCREEN_W, 2, { fill: "#E2E8F0" })
  rect(f, 0, 70, Math.round(SCREEN_W * 0.4), 2, { fill: "#0D9488" })

  const cw = 720
  const cx = Math.round((SCREEN_W - cw) / 2)
  txt(f, cx, 132, "Set up your workspace", {
    size: 32, style: "Bold", color: "#0F172A", width: cw, lineHeight: 40
  })
  txt(f, cx, 184, "These can be changed any time from Workspace settings.", {
    size: 14, color: "#64748B", width: cw
  })

  // Form
  const fy = 248
  const fields = [
    ["Workspace logo", "logo"],
    ["Workspace name", "name"],
    ["Primary domain", "domain"],
    ["Industry", "industry"],
    ["Team size", "size"]
  ]
  // Logo upload
  txt(f, cx, fy, fields[0][0], {
    size: 12, style: "Medium", color: "#475569", width: 200
  })
  rect(f, cx, fy + 22, 88, 88, {
    fill: "#FFFFFF", stroke: "#CBD5E1", radius: 12
  })
  iconBox(f, cx + 28, fy + 50, 32, "#0D9488", "+", { radius: 16 })
  txt(f, cx + 104, fy + 40, "Upload PNG or SVG", {
    size: 13, style: "Medium", color: "#0F172A", width: 240
  })
  txt(f, cx + 104, fy + 60, "Recommended 256x256, max 1 MB", {
    size: 11, color: "#64748B", width: 280
  })
  btn(f, cx + 104, fy + 82, 100, 28, "Choose file", { variant: "secondary", size: 11 })

  // Name
  txt(f, cx, fy + 144, fields[1][0], {
    size: 12, style: "Medium", color: "#475569", width: 200
  })
  rect(f, cx, fy + 164, cw, 44, {
    fill: "#FFFFFF", stroke: "#CBD5E1", radius: 8
  })
  txt(f, cx + 16, fy + 178, "Acme Inc.", {
    size: 14, style: "Medium", color: "#0F172A", width: 400
  })

  // Domain
  txt(f, cx, fy + 232, fields[2][0], {
    size: 12, style: "Medium", color: "#475569", width: 200
  })
  rect(f, cx, fy + 252, cw, 44, {
    fill: "#FFFFFF", stroke: "#CBD5E1", radius: 8
  })
  txt(f, cx + 16, fy + 266, "acme.com", { size: 14, style: "Medium", color: "#0F172A", width: 200 })
  badge(f, cx + cw - 132, fy + 262, "Verified ✓", { variant: "success", width: 100 })

  // Industry & size side by side
  txt(f, cx, fy + 320, fields[3][0], {
    size: 12, style: "Medium", color: "#475569", width: 200
  })
  rect(f, cx, fy + 340, (cw - 16) / 2, 44, {
    fill: "#FFFFFF", stroke: "#CBD5E1", radius: 8
  })
  txt(f, cx + 16, fy + 354, "SaaS / Software", { size: 14, color: "#0F172A", width: 200 })

  txt(f, cx + (cw - 16) / 2 + 16, fy + 320, fields[4][0], {
    size: 12, style: "Medium", color: "#475569", width: 200
  })
  rect(f, cx + (cw - 16) / 2 + 16, fy + 340, (cw - 16) / 2, 44, {
    fill: "#FFFFFF", stroke: "#CBD5E1", radius: 8
  })
  txt(f, cx + (cw - 16) / 2 + 32, fy + 354, "80 (Mid-market)", { size: 14, color: "#0F172A", width: 200 })

  // SSO setup row (Phase 3 minor fix #3)
  txt(f, cx, fy + 408, "Single sign-on (optional now, recommended for 50+ seats)", {
    size: 12, style: "Medium", color: "#475569", width: cw
  })
  const ssoProviders = [
    ["Okta", "O", "#0F172A", true],
    ["Microsoft Entra", "M", "#0078D4", false],
    ["Google", "G", "#EA4335", false],
    ["Custom SAML", "S", "#7C3AED", false]
  ]
  const ssoW = (cw - 24) / 4
  for (let i = 0; i < ssoProviders.length; i++) {
    const sx = cx + i * (ssoW + 8)
    const sel = ssoProviders[i][3]
    rect(f, sx, fy + 428, ssoW, 64, {
      fill: sel ? "#ECFEFF" : "#FFFFFF",
      stroke: sel ? "#0D9488" : "#CBD5E1",
      strokeWeight: sel ? 2 : 1,
      radius: 8
    })
    iconBox(f, sx + 16, fy + 446, 28, ssoProviders[i][2], ssoProviders[i][1], { radius: 6 })
    txt(f, sx + 52, fy + 450, ssoProviders[i][0], {
      size: 13, style: "Medium",
      color: sel ? "#0F172A" : "#475569",
      width: ssoW - 64
    })
    if (sel) {
      txt(f, sx + 52, fy + 466, "Configured", {
        size: 10, color: "#0D9488", width: 80
      })
    } else {
      txt(f, sx + 52, fy + 466, "Connect", {
        size: 10, color: "#94A3B8", width: 80
      })
    }
  }

  // Actions (shifted down to make room for SSO row)
  btn(f, cx, fy + 528, 120, 44, "← Back", { variant: "ghost", size: 13 })
  btn(f, cx + cw - 188, fy + 528, 188, 44, "Continue to Recorder →", { variant: "primary", size: 13 })
})(F["O-02"])

// ===== O-03 Install recorder =====
;(function (f) {
  rect(f, 0, 0, SCREEN_W, SCREEN_H_DEFAULT, { fill: "#F8FAFC" })
  logo(f, 32, 24, 32)
  txt(f, 72, 28, "Replay", { size: 16, style: "Bold", color: "#0F172A", width: 80 })
  txt(f, SCREEN_W - 200, 28, "Setup · Step 3 of 5", { size: 12, color: "#64748B", width: 160, align: "RIGHT" })

  rect(f, 0, 70, SCREEN_W, 2, { fill: "#E2E8F0" })
  rect(f, 0, 70, Math.round(SCREEN_W * 0.6), 2, { fill: "#0D9488" })

  // Hero
  txt(f, 120, 132, "Install the Replay recorder", {
    size: 32, style: "Bold", color: "#0F172A", width: SCREEN_W - 240, align: "CENTER"
  })
  txt(f, 120, 184, "Choose where you'll record from. You can have both.", {
    size: 14, color: "#475569", width: SCREEN_W - 240, align: "CENTER"
  })

  // 2 install options
  const ow = 480
  const totalOW = ow * 2 + 32
  const startX = Math.round((SCREEN_W - totalOW) / 2)
  const opts = [
    ["Chrome extension", "Record any tab in 1 click. Easiest path.", "Add to Chrome", "EXT", "#0EA5E9"],
    ["Desktop app", "Higher quality, system audio capture, multi-monitor.", "Download for Mac", "APP", "#7C3AED"]
  ]
  for (let i = 0; i < opts.length; i++) {
    const cx = startX + i * (ow + 32)
    rect(f, cx, 256, ow, 320, {
      fill: "#FFFFFF", radius: 16, stroke: "#E2E8F0"
    })
    iconBox(f, cx + 32, 296, 64, opts[i][4], opts[i][3], { radius: 16 })
    txt(f, cx + 32, 376, opts[i][0], {
      size: 22, style: "SemiBold", color: "#0F172A", width: ow - 64
    })
    txt(f, cx + 32, 412, opts[i][1], {
      size: 13, color: "#475569", width: ow - 64, lineHeight: 20
    })

    badge(f, cx + 32, 456, i === 0 ? "Detects: Chrome 122" : "Mac · Apple Silicon", {
      variant: "default", width: 160
    })

    btn(f, cx + 32, 504, ow - 64, 44, opts[i][2], { variant: "primary", size: 13 })
  }

  // Footer hint
  txt(f, 120, 632, "Or skip the install and use the in-browser recorder (web-only mode)", {
    size: 12, color: "#64748B", width: SCREEN_W - 240, align: "CENTER"
  })
  txt(f, 120, 656, "Continue with web recorder →", {
    size: 13, style: "Medium", color: "#0D9488",
    width: SCREEN_W - 240, align: "CENTER"
  })

  // Actions
  const ay = 760
  btn(f, 120, ay, 120, 44, "← Back", { variant: "ghost", size: 13 })
  btn(f, SCREEN_W - 320, ay, 200, 44, "Continue to Invite →", { variant: "primary", size: 13 })
})(F["O-03"])

// ===== O-04 Invite team =====
;(function (f) {
  rect(f, 0, 0, SCREEN_W, SCREEN_H_DEFAULT, { fill: "#F8FAFC" })
  logo(f, 32, 24, 32)
  txt(f, 72, 28, "Replay", { size: 16, style: "Bold", color: "#0F172A", width: 80 })
  txt(f, SCREEN_W - 200, 28, "Setup · Step 4 of 5", { size: 12, color: "#64748B", width: 160, align: "RIGHT" })
  rect(f, 0, 70, SCREEN_W, 2, { fill: "#E2E8F0" })
  rect(f, 0, 70, Math.round(SCREEN_W * 0.8), 2, { fill: "#0D9488" })

  const cw = 720
  const cx = Math.round((SCREEN_W - cw) / 2)
  txt(f, cx, 132, "Invite your team", {
    size: 32, style: "Bold", color: "#0F172A", width: cw
  })
  txt(f, cx, 184, "Replay works best with 5+ people. You can add more later.", {
    size: 14, color: "#475569", width: cw
  })

  // Method tabs
  const methods = ["Email", "Invite link", "Slack import"]
  let mx = cx
  for (let i = 0; i < methods.length; i++) {
    const active = i === 0
    const w = 160
    rect(f, mx, 232, w, 40, {
      fill: active ? "#0F172A" : "#FFFFFF",
      stroke: active ? "#0F172A" : "#E2E8F0",
      radius: 20
    })
    txt(f, mx, 244, methods[i], {
      size: 13, style: active ? "SemiBold" : "Regular",
      color: active ? "#FFFFFF" : "#475569", width: w, align: "CENTER"
    })
    mx += w + 8
  }

  // Email entries
  const ey = 296
  const entries = [
    ["ren@acme.com", "Member"],
    ["sora@acme.com", "Member"],
    ["jenny@acme.com", "Admin"],
    ["", ""],
    ["", ""]
  ]
  for (let i = 0; i < entries.length; i++) {
    const yo = ey + i * 56
    rect(f, cx, yo, cw - 180, 44, {
      fill: "#FFFFFF", stroke: "#CBD5E1", radius: 8
    })
    if (entries[i][0]) {
      avatar(f, cx + 12, yo + 8, 28, entries[i][0])
      txt(f, cx + 52, yo + 16, entries[i][0], {
        size: 13, style: "Medium", color: "#0F172A", width: 300
      })
    } else {
      txt(f, cx + 16, yo + 16, "name@acme.com", {
        size: 13, color: "#94A3B8", width: 300
      })
    }
    // Role dropdown
    rect(f, cx + cw - 172, yo, 160, 44, {
      fill: "#FFFFFF", stroke: "#CBD5E1", radius: 8
    })
    txt(f, cx + cw - 160, yo + 16, entries[i][1] || "Member", {
      size: 13, color: "#0F172A", width: 100
    })
    rect(f, cx + cw - 36, yo + 18, 8, 2, { fill: "#94A3B8" })
    rect(f, cx + cw - 32, yo + 16, 2, 6, { fill: "#94A3B8" })
  }

  // Add more
  txt(f, cx, ey + 5 * 56 + 8, "+ Add another", {
    size: 13, style: "Medium", color: "#0D9488", width: 160
  })

  // Help
  rect(f, cx, 696, cw, 60, {
    fill: "#ECFEFF", stroke: "#A5F3FC", radius: 10
  })
  txt(f, cx + 16, 712, "Tip — paste up to 100 emails at once. Replay will dedupe and validate.", {
    size: 12, color: "#0E7490", width: cw - 32
  })

  btn(f, cx, 800, 120, 44, "← Back", { variant: "ghost", size: 13 })
  btn(f, cx + cw - 160, 800, 160, 44, "Send invites", { variant: "primary", size: 13 })
  txt(f, cx + cw - 320, 812, "Skip for now", {
    size: 12, color: "#64748B", width: 100
  })
})(F["O-04"])

// ===== O-05 First recording walkthrough =====
;(function (f) {
  rect(f, 0, 0, SCREEN_W, SCREEN_H_DEFAULT, { fill: "#F8FAFC" })
  logo(f, 32, 24, 32)
  txt(f, 72, 28, "Replay", { size: 16, style: "Bold", color: "#0F172A", width: 80 })
  txt(f, SCREEN_W - 200, 28, "Setup · Step 5 of 5", { size: 12, color: "#64748B", width: 160, align: "RIGHT" })
  rect(f, 0, 70, SCREEN_W, 2, { fill: "#E2E8F0" })
  rect(f, 0, 70, SCREEN_W, 2, { fill: "#0D9488" })

  // Hero
  txt(f, 120, 132, "Record your first video in 90 seconds.", {
    size: 32, style: "Bold", color: "#0F172A", width: SCREEN_W - 240, align: "CENTER"
  })
  txt(f, 120, 184, "Follow the three steps. We'll keep this short.", {
    size: 14, color: "#475569", width: SCREEN_W - 240, align: "CENTER"
  })

  // 3 steps card with image-like mock
  const sx = 120
  const sy = 256
  const sw = SCREEN_W - 240
  const sh = 420
  rect(f, sx, sy, sw, sh, { fill: "#FFFFFF", radius: 16, stroke: "#E2E8F0" })

  // Left: steps list
  const sxL = sx + 48
  const steps = [
    ["1", "Pick a mode", "Screen + Cam is most popular. You can change it later.", true],
    ["2", "Record", "Talk to your team like you're in the room. 5 min max recommended.", false],
    ["3", "Publish", "We'll add a transcript and chapters automatically, then post per your rules.", false]
  ]
  for (let i = 0; i < steps.length; i++) {
    const yo = sy + 56 + i * 116
    rect(f, sxL, yo, 480, 96, {
      fill: steps[i][3] ? "#ECFEFF" : "#F8FAFC",
      stroke: steps[i][3] ? "#0D9488" : "#E2E8F0",
      radius: 12
    })
    iconBox(f, sxL + 20, yo + 22, 48, steps[i][3] ? "#0D9488" : "#CBD5E1", steps[i][0], { radius: 24 })
    txt(f, sxL + 88, yo + 22, steps[i][1], {
      size: 16, style: "SemiBold", color: "#0F172A", width: 360
    })
    txt(f, sxL + 88, yo + 46, steps[i][2], {
      size: 12, color: "#475569", width: 360, lineHeight: 18
    })
  }

  // Right: video mock
  const vx = sx + 600
  const vy = sy + 56
  const vw = sw - 600 - 48
  const vh = sh - 112
  rect(f, vx, vy, vw, vh, { fill: "#0F172A", radius: 12 })
  videoMock(f, vx + 16, vy + 16, vw - 32, vh - 80, { bg: "#0F766E", duration: "0:30" })
  rect(f, vx + 16, vy + vh - 52, vw - 32, 36, { fill: "#1E293B", radius: 6 })
  rect(f, vx + 28, vy + vh - 40, 12, 12, { fill: "#EF4444", radius: 6 })
  txt(f, vx + 48, vy + vh - 44, "Recording demo · 00:30", {
    size: 11, style: "Medium", color: "#FFFFFF", width: 240
  })

  // CTA Big
  btn(f, Math.round((SCREEN_W - 320) / 2), 720, 320, 56, "Start recording now", {
    variant: "record", size: 16, weight: "Bold"
  })
  txt(f, 0, 792, "Skip walkthrough → go to Home", {
    size: 12, style: "Medium", color: "#64748B",
    width: SCREEN_W, align: "CENTER"
  })
})(F["O-05"])

console.log("Marketing done. Screens:", figma.currentPage.children.length)
