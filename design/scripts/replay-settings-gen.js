// === Replay Settings (7) + States (6) — 13 screens ===
const page = figma.currentPage
for (const c of [...page.children]) c.remove()
page.name = "Replay/Settings"

function hexToRgb(hex) {
  hex = hex.replace("#", "")
  if (hex.length === 3) hex = hex.split("").map(c => c + c).join("")
  return {
    r: parseInt(hex.substring(0, 2), 16) / 255,
    g: parseInt(hex.substring(2, 4), 16) / 255,
    b: parseInt(hex.substring(4, 6), 16) / 255
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
  const fills = { primary: "#0D9488", secondary: "#F1F5F9", ghost: "#FFFFFF", dark: "#0F172A", danger: "#DC2626" }
  const labelColors = { primary: "#FFFFFF", secondary: "#0F172A", ghost: "#0F172A", dark: "#FFFFFF", danger: "#FFFFFF" }
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

// Reusable settings sidebar (with section header)
function settingsSidebar(parent, h, active) {
  const w = 240
  const sb = rect(parent, 0, 0, w, h, {
    fill: "#FFFFFF",
    stroke: "#E2E8F0"
  })
  logo(sb, 24, 24, 32)
  txt(sb, 64, 28, "Replay", { size: 16, style: "SemiBold", color: "#0F172A", width: 120 })
  txt(sb, 64, 46, "Acme Inc.", { size: 11, color: "#64748B", width: 120 })

  // Section: Settings
  txt(sb, 24, 100, "SETTINGS", {
    size: 10, style: "SemiBold", color: "#94A3B8", width: 200, letterSpacing: 1
  })
  const items = [
    ["Profile", "S-01", "P", "#0EA5E9"],
    ["Workspace", "S-02", "W", "#7C3AED"],
    ["Members", "S-03", "M", "#F59E0B"],
    ["Billing", "S-04", "B", "#0D9488"],
    ["Integrations", "S-05", "I", "#DB2777"],
    ["Audit log", "S-06", "A", "#059669"],
    ["Recording defaults", "S-07", "R", "#2563EB"]
  ]
  let yo = 132
  for (const [label, id, letter, hex] of items) {
    const isActive = id === active
    const item = rect(sb, 12, yo, w - 24, 36, {
      fill: isActive ? "#ECFEFF" : "#FFFFFF",
      transparent: !isActive,
      radius: 8
    })
    iconBox(item, 12, 9, 18, isActive ? hex : "#CBD5E1", letter, { radius: 4 })
    txt(item, 38, 11, label, {
      size: 12, style: isActive ? "SemiBold" : "Regular",
      color: isActive ? "#0F172A" : "#475569",
      width: w - 76
    })
    yo += 40
  }

  // Bottom: back to app
  rect(sb, 12, h - 60, w - 24, 40, { fill: "#F1F5F9", radius: 8 })
  txt(sb, 24, h - 48, "← Back to app", {
    size: 12, style: "Medium", color: "#0F172A", width: w - 48, align: "CENTER"
  })
  return sb
}
function settingsTop(parent, w, title, sub) {
  const tb = rect(parent, 0, 0, w, 96, {
    fill: "#FFFFFF",
    stroke: "#E2E8F0"
  })
  txt(tb, 32, 24, title, { size: 22, style: "Bold", color: "#0F172A", width: 600 })
  txt(tb, 32, 56, sub, { size: 13, color: "#64748B", width: 600 })
  return tb
}

const SCREEN_W = 1440
const SCREEN_H = 900
const COLS = 4
const GAP = 200

const SCREENS = [
  ["S-01", "Settings/Profile", "#F8FAFC"],
  ["S-02", "Settings/Workspace", "#F8FAFC"],
  ["S-03", "Settings/Members", "#F8FAFC"],
  ["S-04", "Settings/Billing", "#F8FAFC"],
  ["S-05", "Settings/Integrations", "#F8FAFC"],
  ["S-06", "Settings/AuditLog", "#F8FAFC"],
  ["S-07", "Settings/RecordingDefaults", "#F8FAFC"],
  ["ST-01", "States/EmptyLibrary", "#F8FAFC"],
  ["ST-02", "States/LoadingRecorder", "#0F172A"],
  ["ST-03", "States/ErrorUpload", "#F8FAFC"],
  ["ST-04", "States/PermissionDenied", "#F8FAFC"],
  ["ST-05", "States/Maintenance", "#F8FAFC"],
  ["ST-06", "States/404", "#F8FAFC"]
]

const F = {}
for (let i = 0; i < SCREENS.length; i++) {
  const [id, name, bg] = SCREENS[i]
  const col = i % COLS
  const row = Math.floor(i / COLS)
  const x = col * (SCREEN_W + GAP)
  const y = row * (SCREEN_H + GAP + 60)
  const f = figma.createFrame()
  f.name = "Screen/" + name
  f.x = x
  f.y = y
  page.appendChild(f)
  f.resize(SCREEN_W, SCREEN_H)
  f.fills = [solidFill(bg)]
  f.clipsContent = true
  F[id] = f
  idTag(page, f, id, name)
}

// ===== S-01 Profile =====
;(function (f) {
  settingsSidebar(f, SCREEN_H, "S-01")
  const main = rect(f, 240, 0, SCREEN_W - 240, SCREEN_H, { fill: "#F8FAFC", transparent: true })
  settingsTop(main, SCREEN_W - 240, "Your profile", "How you appear to your team in Replay")

  const cx = 32
  const cw = SCREEN_W - 240 - 64
  // Photo card
  rect(main, cx, 128, cw, 156, { fill: "#FFFFFF", radius: 12, stroke: "#E2E8F0" })
  txt(main, cx + 24, 144, "Photo", { size: 14, style: "SemiBold", color: "#0F172A", width: 200 })
  txt(main, cx + 24, 164, "PNG or JPG, square, max 2 MB", {
    size: 11, color: "#64748B", width: 280
  })
  avatar(main, cx + 24, 196, 64, "M")
  btn(main, cx + 108, 212, 120, 36, "Upload new", { variant: "secondary", size: 12 })
  btn(main, cx + 236, 212, 100, 36, "Remove", { variant: "ghost", size: 12 })

  // Name + role card
  rect(main, cx, 304, cw, 280, { fill: "#FFFFFF", radius: 12, stroke: "#E2E8F0" })
  txt(main, cx + 24, 320, "Basic info", { size: 14, style: "SemiBold", color: "#0F172A", width: 200 })

  const fields = [
    ["Display name", "Mika Tanaka"],
    ["Pronouns", "she/her"],
    ["Title", "Senior PM"],
    ["Timezone", "Asia/Tokyo (UTC+9)"]
  ]
  for (let i = 0; i < fields.length; i++) {
    const col = i % 2
    const row = Math.floor(i / 2)
    const fx = cx + 24 + col * Math.round((cw - 64) / 2)
    const fy = 360 + row * 96
    const fw = Math.round((cw - 64) / 2) - 16
    txt(main, fx, fy, fields[i][0], {
      size: 11, style: "Medium", color: "#64748B", width: fw
    })
    rect(main, fx, fy + 18, fw, 40, {
      fill: "#FFFFFF", stroke: "#CBD5E1", radius: 8
    })
    txt(main, fx + 14, fy + 30, fields[i][1], {
      size: 13, color: "#0F172A", width: fw - 28
    })
  }

  // Notifications card
  rect(main, cx, 604, cw, 224, { fill: "#FFFFFF", radius: 12, stroke: "#E2E8F0" })
  txt(main, cx + 24, 620, "Notifications", {
    size: 14, style: "SemiBold", color: "#0F172A", width: 200
  })
  txt(main, cx + 24, 640, "How Replay reaches you when a video needs you", {
    size: 11, color: "#64748B", width: 400
  })
  const notifs = [
    ["Mentions in comments", true],
    ["Reminders for unwatched (critical)", true],
    ["Workflow run failures", false],
    ["Weekly viewing ops digest", true]
  ]
  for (let i = 0; i < notifs.length; i++) {
    const yo = 676 + i * 32
    rect(main, cx + 24, yo, 40, 22, {
      fill: notifs[i][1] ? "#0D9488" : "#CBD5E1", radius: 11
    })
    rect(main, notifs[i][1] ? cx + 44 : cx + 26, yo + 2, 18, 18, {
      fill: "#FFFFFF", radius: 9
    })
    txt(main, cx + 80, yo + 4, notifs[i][0], {
      size: 12, color: "#0F172A", width: 400
    })
  }

  // Save action
  btn(main, cx + cw - 192, 836, 96, 40, "Cancel", { variant: "ghost", size: 13 })
  btn(main, cx + cw - 88, 836, 88, 40, "Save", { variant: "primary", size: 13 })
})(F["S-01"])

// ===== S-02 Workspace =====
;(function (f) {
  settingsSidebar(f, SCREEN_H, "S-02")
  const main = rect(f, 240, 0, SCREEN_W - 240, SCREEN_H, { fill: "#F8FAFC", transparent: true })
  settingsTop(main, SCREEN_W - 240, "Workspace", "Identity, security, and how Replay represents Acme Inc.")

  const cx = 32
  const cw = SCREEN_W - 240 - 64

  // Identity
  rect(main, cx, 128, cw, 196, { fill: "#FFFFFF", radius: 12, stroke: "#E2E8F0" })
  txt(main, cx + 24, 144, "Identity", { size: 14, style: "SemiBold", color: "#0F172A", width: 200 })

  // Logo + name + slug
  rect(main, cx + 24, 184, 64, 64, { fill: "#0D9488", radius: 12 })
  txt(main, cx + 24, 200, "A", { size: 32, style: "Bold", color: "#FFFFFF", width: 64, align: "CENTER" })

  txt(main, cx + 108, 184, "Workspace name", {
    size: 11, style: "Medium", color: "#64748B", width: 200
  })
  rect(main, cx + 108, 204, 300, 36, {
    fill: "#FFFFFF", stroke: "#CBD5E1", radius: 6
  })
  txt(main, cx + 120, 214, "Acme Inc.", {
    size: 13, style: "Medium", color: "#0F172A", width: 280
  })

  txt(main, cx + 432, 184, "URL slug (replay.app/...)", {
    size: 11, style: "Medium", color: "#64748B", width: 200
  })
  rect(main, cx + 432, 204, 280, 36, {
    fill: "#FFFFFF", stroke: "#CBD5E1", radius: 6
  })
  txt(main, cx + 444, 214, "acme", {
    size: 13, style: "Medium", color: "#0F172A", width: 80
  })
  badge(main, cx + 612, 210, "Available ✓", { variant: "success", width: 92 })

  // Branding
  rect(main, cx, 344, cw, 180, { fill: "#FFFFFF", radius: 12, stroke: "#E2E8F0" })
  txt(main, cx + 24, 360, "Branding", { size: 14, style: "SemiBold", color: "#0F172A", width: 200 })
  txt(main, cx + 24, 380, "Applied to share pages, embeds, and outgoing emails", {
    size: 11, color: "#64748B", width: 400
  })

  txt(main, cx + 24, 416, "Brand color", {
    size: 11, style: "Medium", color: "#64748B", width: 200
  })
  rect(main, cx + 24, 436, 200, 40, {
    fill: "#FFFFFF", stroke: "#CBD5E1", radius: 6
  })
  rect(main, cx + 36, 446, 20, 20, { fill: "#0D9488", radius: 4 })
  txt(main, cx + 64, 446, "#0D9488", { size: 12, style: "Medium", color: "#0F172A", width: 100 })

  txt(main, cx + 244, 416, "Favicon", {
    size: 11, style: "Medium", color: "#64748B", width: 200
  })
  rect(main, cx + 244, 436, 200, 40, {
    fill: "#FFFFFF", stroke: "#CBD5E1", radius: 6
  })
  rect(main, cx + 256, 446, 20, 20, { fill: "#0D9488", radius: 4 })
  txt(main, cx + 284, 446, "favicon.png", { size: 12, color: "#0F172A", width: 120 })

  // Security / SSO
  rect(main, cx, 544, cw, 280, { fill: "#FFFFFF", radius: 12, stroke: "#E2E8F0" })
  txt(main, cx + 24, 560, "Security", { size: 14, style: "SemiBold", color: "#0F172A", width: 200 })

  const sec = [
    ["SSO / SAML", "Okta", "Configured", "success"],
    ["Domain allowlist", "acme.com", "Verified", "success"],
    ["IP allowlist", "Not configured", "Optional", "default"],
    ["Default video retention", "365 days", "Workspace-wide", "info"]
  ]
  for (let i = 0; i < sec.length; i++) {
    const yo = 600 + i * 52
    rect(main, cx + 24, yo, cw - 48, 44, { fill: "#F8FAFC", radius: 8 })
    txt(main, cx + 40, yo + 10, sec[i][0], {
      size: 12, style: "Medium", color: "#0F172A", width: 240
    })
    txt(main, cx + 40, yo + 26, sec[i][1], { size: 11, color: "#64748B", width: 240 })
    badge(main, cx + 320, yo + 12, sec[i][2], { variant: sec[i][3] })
    txt(main, cx + cw - 76, yo + 14, "Edit →", {
      size: 12, style: "Medium", color: "#0D9488", width: 60, align: "RIGHT"
    })
  }
})(F["S-02"])

// ===== S-03 Members =====
;(function (f) {
  settingsSidebar(f, SCREEN_H, "S-03")
  const main = rect(f, 240, 0, SCREEN_W - 240, SCREEN_H, { fill: "#F8FAFC", transparent: true })
  settingsTop(main, SCREEN_W - 240, "Members", "12 members · 3 admins · 1 pending invite")

  const cx = 32
  const cw = SCREEN_W - 240 - 64

  // Actions row
  rect(main, cx, 128, cw, 56, { fill: "#FFFFFF", radius: 10, stroke: "#E2E8F0" })
  // Search input
  rect(main, cx + 16, 142, 320, 28, {
    fill: "#F8FAFC", stroke: "#CBD5E1", radius: 6
  })
  iconBox(main, cx + 26, 148, 16, "#94A3B8", "Q", { radius: 8 })
  txt(main, cx + 50, 149, "Search by name or email", { size: 12, color: "#94A3B8", width: 240 })

  txt(main, cx + 360, 148, "Role: All", { size: 12, color: "#475569", width: 100 })
  txt(main, cx + 460, 148, "Status: All", { size: 12, color: "#475569", width: 100 })

  btn(main, cx + cw - 240, 138, 100, 36, "Bulk action", { variant: "ghost", size: 12 })
  btn(main, cx + cw - 132, 138, 132, 36, "+ Invite member", { variant: "primary", size: 12 })

  // Table header
  rect(main, cx, 208, cw, 40, { fill: "#F1F5F9", radius: 8 })
  const hcols = ["Member", "Role", "Team", "Status", "Last active", ""]
  const hxs = [60, 460, 600, 760, 900, 1080]
  for (let i = 0; i < hcols.length; i++) {
    txt(main, cx + hxs[i], 220, hcols[i], {
      size: 10, style: "SemiBold", color: "#64748B", width: 120, letterSpacing: 0.5
    })
  }

  // Rows
  const members = [
    ["Mika Tanaka", "mika@acme.com", "Owner", "Product", "Active", "Online now", "success"],
    ["Sora Lee", "sora@acme.com", "Admin", "Engineering", "Active", "5m ago", "success"],
    ["Ren Sato", "ren@acme.com", "Manager", "CS", "Active", "1h ago", "success"],
    ["Jenny Marks", "jenny@acme.com", "Member", "Engineering", "Active", "3h ago", "default"],
    ["Aoi Patel", "aoi@acme.com", "Member", "Design", "Active", "1d ago", "default"],
    ["Kenta Park", "kenta@acme.com", "Viewer", "Marketing", "Active", "2d ago", "default"],
    ["Naomi Rosa", "naomi@acme.com", "Member", "PM", "Pending", "Invited 1h ago", "warning"]
  ]
  for (let i = 0; i < members.length; i++) {
    const ry = 260 + i * 60
    rect(main, cx, ry, cw, 52, {
      fill: "#FFFFFF", stroke: "#E2E8F0", radius: 8
    })
    avatar(main, cx + 16, ry + 8, 36, members[i][0])
    txt(main, cx + 60, ry + 10, members[i][0], {
      size: 13, style: "SemiBold", color: "#0F172A", width: 240
    })
    txt(main, cx + 60, ry + 28, members[i][1], { size: 11, color: "#64748B", width: 240 })

    txt(main, cx + hxs[1], ry + 18, members[i][2], {
      size: 12, color: "#0F172A", width: 120
    })
    txt(main, cx + hxs[2], ry + 18, members[i][3], {
      size: 12, color: "#0F172A", width: 120
    })
    badge(main, cx + hxs[3], ry + 16, members[i][4], { variant: members[i][6] })
    txt(main, cx + hxs[4], ry + 18, members[i][5], {
      size: 11, color: "#64748B", width: 140
    })
    txt(main, cx + hxs[5], ry + 18, "Manage →", {
      size: 12, style: "Medium", color: "#0D9488", width: 100
    })
  }
})(F["S-03"])

// ===== S-04 Billing =====
;(function (f) {
  settingsSidebar(f, SCREEN_H, "S-04")
  const main = rect(f, 240, 0, SCREEN_W - 240, SCREEN_H, { fill: "#F8FAFC", transparent: true })
  settingsTop(main, SCREEN_W - 240, "Billing", "Plan, seats, usage, and invoices")

  const cx = 32
  const cw = SCREEN_W - 240 - 64

  // Current plan card (highlighted)
  rect(main, cx, 128, cw, 152, {
    fill: "#0F172A", radius: 12
  })
  badge(main, cx + 24, 152, "Business plan", { variant: "teal", width: 112 })
  txt(main, cx + 24, 180, "$15 / seat / month · Annual billing", {
    size: 22, style: "Bold", color: "#FFFFFF", width: 500
  })
  txt(main, cx + 24, 218, "Renews on Jan 14, 2027 · 80 seats · $14,400 / year", {
    size: 12, color: "#94A3B8", width: 500
  })
  btn(main, cx + cw - 232, 160, 96, 40, "Switch plan", { variant: "secondary", size: 12 })
  btn(main, cx + cw - 128, 160, 96, 40, "Manage", { variant: "ghost", size: 12 })

  // Usage row
  const uy = 308
  txt(main, cx, uy, "Usage", { size: 16, style: "SemiBold", color: "#0F172A", width: 200 })
  const usage = [
    ["Seats", "80 of 80", 100],
    ["Storage (pooled)", "612 GB of 1 TB", 60],
    ["AI summaries (mo)", "1,248 of 5,000", 25],
    ["External shares", "23 of unlimited", 0]
  ]
  const uw = (cw - 48) / 4
  for (let i = 0; i < usage.length; i++) {
    const ux = cx + i * (uw + 16)
    rect(main, ux, uy + 32, uw, 124, { fill: "#FFFFFF", radius: 10, stroke: "#E2E8F0" })
    txt(main, ux + 20, uy + 48, usage[i][0], {
      size: 11, color: "#64748B", width: uw - 40
    })
    txt(main, ux + 20, uy + 68, usage[i][1], {
      size: 18, style: "Bold", color: "#0F172A", width: uw - 40, family: "Inter"
    })
    rect(main, ux + 20, uy + 110, uw - 40, 6, { fill: "#F1F5F9", radius: 3 })
    if (usage[i][2] > 0) {
      rect(main, ux + 20, uy + 110, Math.round((uw - 40) * usage[i][2] / 100), 6, {
        fill: usage[i][2] >= 95 ? "#F59E0B" : "#0D9488",
        radius: 3
      })
    }
    txt(main, ux + 20, uy + 122, usage[i][2] === 0 ? "Unlimited use" : usage[i][2] + "% used", {
      size: 10, color: "#94A3B8", width: 100
    })
  }

  // Invoices table
  const iy = 504
  txt(main, cx, iy, "Recent invoices", {
    size: 16, style: "SemiBold", color: "#0F172A", width: 200
  })
  rect(main, cx, iy + 32, cw, 280, { fill: "#FFFFFF", radius: 10, stroke: "#E2E8F0" })

  // Header
  const ihx = [24, 200, 500, 700, 920]
  const ihn = ["Invoice #", "Date", "Amount", "Status", ""]
  for (let i = 0; i < ihn.length; i++) {
    txt(main, cx + ihx[i], iy + 48, ihn[i], {
      size: 10, style: "SemiBold", color: "#64748B", width: 120, letterSpacing: 0.5
    })
  }
  rect(main, cx + 16, iy + 76, cw - 32, 1, { fill: "#E2E8F0" })

  const invoices = [
    ["INV-2026-014", "Jan 14, 2026", "$14,400.00", "Paid", "success"],
    ["INV-2026-013", "Dec 14, 2025", "$1,200.00", "Paid", "success"],
    ["INV-2026-012", "Nov 14, 2025", "$1,200.00", "Paid", "success"],
    ["INV-2026-011", "Oct 14, 2025", "$1,150.00", "Paid", "success"]
  ]
  for (let i = 0; i < invoices.length; i++) {
    const ry = iy + 88 + i * 44
    txt(main, cx + ihx[0], ry, invoices[i][0], {
      size: 12, style: "Medium", color: "#0F172A", width: 180, family: "Inter"
    })
    txt(main, cx + ihx[1], ry, invoices[i][1], {
      size: 12, color: "#475569", width: 160
    })
    txt(main, cx + ihx[2], ry, invoices[i][2], {
      size: 12, style: "Medium", color: "#0F172A", width: 120, family: "Inter"
    })
    badge(main, cx + ihx[3], ry - 2, invoices[i][3], { variant: invoices[i][4] })
    txt(main, cx + ihx[4], ry, "Download PDF →", {
      size: 12, style: "Medium", color: "#0D9488", width: 140
    })
  }
})(F["S-04"])

// ===== S-05 Integrations =====
;(function (f) {
  settingsSidebar(f, SCREEN_H, "S-05")
  const main = rect(f, 240, 0, SCREEN_W - 240, SCREEN_H, { fill: "#F8FAFC", transparent: true })
  settingsTop(main, SCREEN_W - 240, "Integrations", "Connect Replay to where work happens")

  const cx = 32
  const cw = SCREEN_W - 240 - 64

  // Section tabs
  const cats = ["Connected (5)", "All apps", "Webhooks", "API keys"]
  let tx = cx
  for (let i = 0; i < cats.length; i++) {
    const active = i === 0
    const w = cats[i].length * 7 + 28
    txt(main, tx, 132, cats[i], {
      size: 13, style: active ? "SemiBold" : "Regular",
      color: active ? "#0D9488" : "#64748B", width: w
    })
    if (active) rect(main, tx, 154, w - 8, 2, { fill: "#0D9488" })
    tx += w + 20
  }

  // Connected integrations grid 3x2
  const apps = [
    ["Slack", "Post videos to channels, get unwatched DMs", "Connected", "S", "#4A154B", "success"],
    ["Notion", "Embed videos in pages, sync chapters as headings", "Connected", "N", "#0F172A", "success"],
    ["Linear", "Create issues from action items, attach videos", "Connected", "L", "#5E6AD2", "success"],
    ["GitHub", "Attach videos to PR comments, surface in reviews", "Connected", "G", "#1F2328", "success"],
    ["Figma", "Embed video walkthroughs in Figma comments", "Connected", "F", "#F24E1E", "success"],
    ["Salesforce", "Track external demo views on opportunity records", "Not connected", "S", "#00A1E0", "default"]
  ]
  const aw = (cw - 32) / 3
  const ah = 156
  for (let i = 0; i < apps.length; i++) {
    const col = i % 3
    const row = Math.floor(i / 3)
    const ax = cx + col * (aw + 16)
    const ay = 196 + row * (ah + 16)
    rect(main, ax, ay, aw, ah, {
      fill: "#FFFFFF", radius: 12, stroke: "#E2E8F0"
    })
    iconBox(main, ax + 24, ay + 24, 44, apps[i][4], apps[i][3], { radius: 10 })
    txt(main, ax + 80, ay + 24, apps[i][0], {
      size: 16, style: "SemiBold", color: "#0F172A", width: aw - 100
    })
    badge(main, ax + 80, ay + 44, apps[i][2], { variant: apps[i][5] })
    txt(main, ax + 24, ay + 84, apps[i][1], {
      size: 12, color: "#475569", width: aw - 48, lineHeight: 18
    })
    btn(main, ax + 24, ay + 116, 90, 30, apps[i][2] === "Connected" ? "Configure" : "Connect", {
      variant: apps[i][2] === "Connected" ? "secondary" : "primary",
      size: 11
    })
    txt(main, ax + aw - 96, ay + 124, apps[i][2] === "Connected" ? "Disconnect" : "Learn more", {
      size: 11, style: "Medium",
      color: apps[i][2] === "Connected" ? "#DC2626" : "#0D9488",
      width: 80, align: "RIGHT"
    })
  }

  // Browse all
  rect(main, cx, 552, cw, 76, {
    fill: "#ECFEFF", stroke: "#A5F3FC", radius: 12
  })
  txt(main, cx + 24, 572, "Looking for more?", {
    size: 14, style: "SemiBold", color: "#0F172A", width: 300
  })
  txt(main, cx + 24, 594, "32 apps available — Webhooks, Asana, Jira, Confluence, and more.", {
    size: 12, color: "#475569", width: 600
  })
  btn(main, cx + cw - 148, 580, 116, 36, "Browse 32 apps", { variant: "primary", size: 12 })
})(F["S-05"])

// ===== S-06 Audit log =====
;(function (f) {
  settingsSidebar(f, SCREEN_H, "S-06")
  const main = rect(f, 240, 0, SCREEN_W - 240, SCREEN_H, { fill: "#F8FAFC", transparent: true })
  settingsTop(main, SCREEN_W - 240, "Audit log", "Workspace activity for the last 30 days")

  const cx = 32
  const cw = SCREEN_W - 240 - 64

  // Filter row
  rect(main, cx, 128, cw, 56, { fill: "#FFFFFF", radius: 10, stroke: "#E2E8F0" })
  const fchips = [
    ["Period", "Last 30 days"],
    ["Actor", "All"],
    ["Action", "All"],
    ["Resource", "All"]
  ]
  let fx = cx + 16
  for (const [label, val] of fchips) {
    rect(main, fx, 142, 160, 28, {
      fill: "#F8FAFC", stroke: "#CBD5E1", radius: 6
    })
    txt(main, fx + 12, 145, label, { size: 10, color: "#64748B", width: 60 })
    txt(main, fx + 12, 157, val, {
      size: 11, style: "Medium", color: "#0F172A", width: 120
    })
    rect(main, fx + 140, 154, 8, 2, { fill: "#94A3B8" })
    rect(main, fx + 144, 152, 2, 6, { fill: "#94A3B8" })
    fx += 168
  }
  btn(main, cx + cw - 156, 138, 132, 36, "Export CSV", { variant: "secondary", size: 12 })

  // Table header
  rect(main, cx, 208, cw, 36, { fill: "#F1F5F9", radius: 6 })
  const ahx = [24, 360, 540, 800, 1040]
  const ahd = ["Timestamp", "Actor", "Action", "Resource", "Source IP"]
  for (let i = 0; i < ahd.length; i++) {
    txt(main, cx + ahx[i], 218, ahd[i], {
      size: 10, style: "SemiBold", color: "#64748B", width: 140, letterSpacing: 0.5
    })
  }

  // Log rows
  const logs = [
    ["2026-01-14 09:42:18 JST", "Mika Tanaka", "video.publish", "Q4 roadmap walkthrough", "203.0.113.42"],
    ["2026-01-14 09:38:01 JST", "Workflow: All-hands auto-post", "workflow.run", "Q4 roadmap walkthrough", "system"],
    ["2026-01-14 09:32:12 JST", "Sora Lee", "comment.create", "PR walkthrough #4521", "203.0.113.78"],
    ["2026-01-14 09:20:45 JST", "Admin: Jenny Marks", "member.role_change", "Naomi Rosa: Viewer → Member", "203.0.113.13"],
    ["2026-01-14 09:14:09 JST", "Ren Sato", "external_share.create", "Customer demo: Acme Corp", "203.0.113.92"],
    ["2026-01-14 09:02:33 JST", "Mika Tanaka", "video.publish", "Sprint review — Frontend", "203.0.113.42"],
    ["2026-01-14 08:48:22 JST", "Admin: Jenny Marks", "sso.config_update", "Okta", "203.0.113.13"],
    ["2026-01-14 08:32:18 JST", "Workflow: Spec unwatched reminder", "workflow.run", "12 members notified", "system"],
    ["2026-01-14 08:18:00 JST", "Sora Lee", "video.delete", "Bug repro: legacy", "203.0.113.78"]
  ]
  for (let i = 0; i < logs.length; i++) {
    const ry = 256 + i * 56
    rect(main, cx, ry, cw, 48, {
      fill: "#FFFFFF", stroke: "#E2E8F0", radius: 6
    })
    txt(main, cx + ahx[0], ry + 16, logs[i][0], {
      size: 11, color: "#475569", width: 200, family: "Inter"
    })
    txt(main, cx + ahx[1], ry + 16, logs[i][1], {
      size: 12, style: "Medium", color: "#0F172A", width: 200
    })
    // action tag
    rect(main, cx + ahx[2], ry + 12, 160, 24, {
      fill: logs[i][2].includes("delete") ? "#FECACA" :
        logs[i][2].includes("workflow") ? "#C7D2FE" : "#BBF7D0",
      radius: 4
    })
    txt(main, cx + ahx[2] + 8, ry + 17, logs[i][2], {
      size: 10, style: "Medium",
      color: logs[i][2].includes("delete") ? "#7F1D1D" :
        logs[i][2].includes("workflow") ? "#312E81" : "#14532D",
      width: 144, family: "Inter"
    })
    txt(main, cx + ahx[3], ry + 16, logs[i][3], {
      size: 12, color: "#0F172A", width: 240
    })
    txt(main, cx + ahx[4], ry + 16, logs[i][4], {
      size: 11, color: "#64748B", width: 140, family: "Inter"
    })
  }
})(F["S-06"])

// ===== S-07 Recording defaults =====
;(function (f) {
  settingsSidebar(f, SCREEN_H, "S-07")
  const main = rect(f, 240, 0, SCREEN_W - 240, SCREEN_H, { fill: "#F8FAFC", transparent: true })
  settingsTop(main, SCREEN_W - 240, "Recording defaults", "How new recordings behave across the workspace")

  const cx = 32
  const cw = SCREEN_W - 240 - 64

  // Video quality
  rect(main, cx, 128, cw, 200, { fill: "#FFFFFF", radius: 12, stroke: "#E2E8F0" })
  txt(main, cx + 24, 144, "Video quality", { size: 14, style: "SemiBold", color: "#0F172A", width: 200 })
  txt(main, cx + 24, 164, "Default resolution for new recordings (changeable per video)", {
    size: 11, color: "#64748B", width: 500
  })
  const qualities = [["720p", false], ["1080p", true], ["1440p", false], ["4K", false]]
  for (let i = 0; i < qualities.length; i++) {
    const qx = cx + 24 + i * 160
    const active = qualities[i][1]
    rect(main, qx, 200, 144, 100, {
      fill: active ? "#ECFEFF" : "#F8FAFC",
      stroke: active ? "#0D9488" : "#E2E8F0",
      radius: 10
    })
    txt(main, qx, 220, qualities[i][0], {
      size: 22, style: "Bold", color: active ? "#0D9488" : "#0F172A",
      width: 144, align: "CENTER"
    })
    txt(main, qx, 252, i === 0 ? "Bandwidth" : i === 1 ? "Recommended" : i === 2 ? "Higher" : "Highest",
      { size: 10, color: active ? "#0D9488" : "#64748B", width: 144, align: "CENTER" })
    if (active) {
      iconBox(main, qx + 56, 268, 18, "#0D9488", "✓", { radius: 9 })
    }
  }

  // Retention
  rect(main, cx, 348, cw, 156, { fill: "#FFFFFF", radius: 12, stroke: "#E2E8F0" })
  txt(main, cx + 24, 364, "Default retention", {
    size: 14, style: "SemiBold", color: "#0F172A", width: 200
  })
  txt(main, cx + 24, 384, "How long Replay keeps videos before auto-archive", {
    size: 11, color: "#64748B", width: 400
  })
  const retention = [["30 days", false], ["180 days", false], ["1 year", true], ["Forever", false]]
  for (let i = 0; i < retention.length; i++) {
    const rx = cx + 24 + i * 180
    const active = retention[i][1]
    rect(main, rx, 420, 160, 60, {
      fill: active ? "#0F172A" : "#FFFFFF",
      stroke: active ? "#0F172A" : "#CBD5E1",
      radius: 8
    })
    txt(main, rx, 436, retention[i][0], {
      size: 14, style: "SemiBold",
      color: active ? "#FFFFFF" : "#0F172A",
      width: 160, align: "CENTER"
    })
    txt(main, rx, 454, ["Compliance heavy", "Standard", "Default", "No limit"][i],
      { size: 10, color: active ? "#94A3B8" : "#64748B", width: 160, align: "CENTER" })
  }

  // Watermark + consent
  rect(main, cx, 524, cw, 312, { fill: "#FFFFFF", radius: 12, stroke: "#E2E8F0" })
  txt(main, cx + 24, 540, "Watermark & consent", {
    size: 14, style: "SemiBold", color: "#0F172A", width: 200
  })

  const toggs = [
    ["Dynamic email watermark", "Embed viewer email subtly on external shares (Enterprise)", true],
    ["Recording consent banner", "Show 'Recording in progress' notice on the captured screen", true],
    ["Auto-mute notifications", "Silence Slack / OS notifications while recording", true],
    ["Auto-pause on screen lock", "Pause if the macOS screen locks during recording", false]
  ]
  for (let i = 0; i < toggs.length; i++) {
    const yo = 576 + i * 60
    rect(main, cx + 24, yo, cw - 48, 48, { fill: "#F8FAFC", radius: 8 })
    txt(main, cx + 40, yo + 8, toggs[i][0], {
      size: 13, style: "SemiBold", color: "#0F172A", width: 600
    })
    txt(main, cx + 40, yo + 26, toggs[i][1], {
      size: 11, color: "#64748B", width: 600
    })
    rect(main, cx + cw - 100, yo + 14, 40, 22, {
      fill: toggs[i][2] ? "#0D9488" : "#CBD5E1", radius: 11
    })
    rect(main, toggs[i][2] ? cx + cw - 80 : cx + cw - 98, yo + 16, 18, 18, {
      fill: "#FFFFFF", radius: 9
    })
  }
})(F["S-07"])

// ===== ST-01 Empty Library =====
;(function (f) {
  // Reuse a simplified sidebar to indicate it's Library
  settingsSidebar(f, SCREEN_H, "")
  const main = rect(f, 240, 0, SCREEN_W - 240, SCREEN_H, { fill: "#F8FAFC", transparent: true })
  settingsTop(main, SCREEN_W - 240, "Library", "Your recordings will land here")

  // Centered empty state
  const cx = 32
  const cw = SCREEN_W - 240 - 64

  // Hero illustration (stylized empty card)
  const ex = Math.round((cw - 400) / 2) + cx
  const ey = 200
  rect(main, ex, ey, 400, 240, {
    fill: "#FFFFFF", stroke: "#E2E8F0", radius: 16
  })
  // Mock 3 cards inside
  for (let i = 0; i < 3; i++) {
    const px = ex + 32 + i * 116
    rect(main, px, ey + 40, 104, 64, { fill: "#F1F5F9", radius: 8 })
    rect(main, px + 36, ey + 60, 32, 24, { fill: "#0D9488", radius: 4, fillOpacity: 0.3 })
    rect(main, px, ey + 116, 80, 8, { fill: "#E2E8F0", radius: 4 })
    rect(main, px, ey + 130, 60, 6, { fill: "#E2E8F0", radius: 3 })
  }
  // "Plus" badge on top of cards
  rect(main, ex + 168, ey + 152, 64, 64, {
    fill: "#0D9488", radius: 32
  })
  txt(main, ex + 168, ey + 168, "+", {
    size: 36, style: "Bold", color: "#FFFFFF", width: 64, align: "CENTER"
  })

  // Copy
  txt(main, cx, 484, "Your library is empty — and that's a good place to start.", {
    size: 26, style: "Bold", color: "#0F172A", width: cw, align: "CENTER", lineHeight: 32
  })
  txt(main, cx, 532, "Record your first 60-second video. We'll add chapters, a transcript, and a place to discuss.", {
    size: 14, color: "#475569", width: cw, align: "CENTER", lineHeight: 22
  })

  // CTAs
  const bx = Math.round((cw - 360) / 2) + cx
  btn(main, bx, 612, 168, 48, "Record first video", { variant: "record", size: 14 })
  btn(main, bx + 192, 612, 168, 48, "Watch 90-sec demo", { variant: "ghost", size: 13 })

  // Reassure
  txt(main, cx, 692, "Tip — most teams find their rhythm in 5-7 videos.", {
    size: 12, color: "#94A3B8", width: cw, align: "CENTER"
  })
})(F["ST-01"])

// ===== ST-02 Loading Recorder =====
;(function (f) {
  rect(f, 0, 0, SCREEN_W, SCREEN_H, { fill: "#0F172A" })

  // Centered loading card
  const cw = 540
  const ch = 380
  const cx = Math.round((SCREEN_W - cw) / 2)
  const cy = Math.round((SCREEN_H - ch) / 2)
  rect(f, cx, cy, cw, ch, { fill: "#1E293B", radius: 16, stroke: "#334155" })

  // Spinner: layered circles
  const spx = Math.round((cw - 96) / 2) + cx
  const spy = cy + 60
  rect(f, spx, spy, 96, 96, { fill: "#0D9488", radius: 48, fillOpacity: 0.2 })
  rect(f, spx + 12, spy + 12, 72, 72, { fill: "#0D9488", radius: 36, fillOpacity: 0.4 })
  rect(f, spx + 28, spy + 28, 40, 40, { fill: "#0D9488", radius: 20 })
  rect(f, spx + 40, spy + 40, 16, 16, { fill: "#FFFFFF", radius: 8 })

  txt(f, cx + 40, cy + 196, "Warming up the recorder…", {
    size: 22, style: "SemiBold", color: "#FFFFFF",
    width: cw - 80, align: "CENTER"
  })
  txt(f, cx + 40, cy + 232, "Connecting camera and microphone permissions.", {
    size: 13, color: "#94A3B8",
    width: cw - 80, align: "CENTER", lineHeight: 20
  })
  txt(f, cx + 40, cy + 256, "Usually takes 2 seconds.", {
    size: 13, color: "#94A3B8",
    width: cw - 80, align: "CENTER"
  })

  // Permission status mini list
  const perms = [
    ["Camera", "Granted"],
    ["Microphone", "Granted"],
    ["Screen recording", "Requesting…"]
  ]
  for (let i = 0; i < perms.length; i++) {
    const py = cy + 300 + i * 24
    iconBox(f, cx + 100, py, 14, i < 2 ? "#0D9488" : "#94A3B8", i < 2 ? "✓" : "…", { radius: 7 })
    txt(f, cx + 124, py, perms[i][0], {
      size: 11, style: "Medium", color: "#E2E8F0", width: 140
    })
    txt(f, cx + 280, py, perms[i][1], {
      size: 11, color: i < 2 ? "#5EEAD4" : "#94A3B8", width: 160
    })
  }

  // Cancel link
  txt(f, 0, cy + ch + 24, "Cancel and go back", {
    size: 12, style: "Medium", color: "#94A3B8", width: SCREEN_W, align: "CENTER"
  })
})(F["ST-02"])

// ===== ST-03 Error Upload =====
;(function (f) {
  rect(f, 0, 0, SCREEN_W, SCREEN_H, { fill: "#F8FAFC" })

  const cw = 600
  const ch = 540
  const cx = Math.round((SCREEN_W - cw) / 2)
  const cy = Math.round((SCREEN_H - ch) / 2)
  rect(f, cx, cy, cw, ch, { fill: "#FFFFFF", radius: 20, stroke: "#E2E8F0" })

  // Top warning icon
  iconBox(f, cx + Math.round((cw - 64) / 2), cy + 48, 64, "#FEE2E2", "!", { radius: 32, fg: "#DC2626" })

  txt(f, cx + 40, cy + 140, "Upload stalled — but your recording is safe.", {
    size: 24, style: "Bold", color: "#0F172A",
    width: cw - 80, align: "CENTER", lineHeight: 32
  })
  txt(f, cx + 40, cy + 208, "We saved a local copy on this device, so nothing is lost.", {
    size: 13, color: "#475569", width: cw - 80, align: "CENTER", lineHeight: 20
  })
  txt(f, cx + 40, cy + 232, "You can retry now or wait and we'll auto-retry in 30 seconds.", {
    size: 13, color: "#475569", width: cw - 80, align: "CENTER"
  })

  // Status box
  rect(f, cx + 40, cy + 276, cw - 80, 88, { fill: "#F8FAFC", radius: 10 })
  txt(f, cx + 56, cy + 292, "Recording", { size: 10, color: "#94A3B8", width: 200 })
  txt(f, cx + 56, cy + 308, "Q4 roadmap walkthrough · 5 min 13 sec", {
    size: 12, style: "Medium", color: "#0F172A", width: 360
  })
  txt(f, cx + 56, cy + 332, "Local copy size 142 MB · Last try 12 sec ago", {
    size: 11, color: "#64748B", width: 360
  })
  badge(f, cx + cw - 168, cy + 312, "Saved locally ✓", { variant: "success", width: 116 })

  // CTAs
  btn(f, cx + 40, cy + 388, cw - 80, 48, "Retry upload", { variant: "primary", size: 14 })
  btn(f, cx + 40, cy + 448, (cw - 96) / 2, 40, "Save as draft", { variant: "ghost", size: 12 })
  btn(f, cx + 56 + (cw - 96) / 2, cy + 448, (cw - 96) / 2, 40, "Contact support", { variant: "ghost", size: 12 })

  // Error code at bottom
  txt(f, cx, cy + ch - 32, "Error code REPLAY_UPLOAD_3127 · We've been notified.", {
    size: 11, color: "#94A3B8", width: cw, align: "CENTER", family: "Inter"
  })
})(F["ST-03"])

// ===== ST-04 Permission denied =====
;(function (f) {
  rect(f, 0, 0, SCREEN_W, SCREEN_H, { fill: "#F8FAFC" })

  const cw = 580
  const ch = 480
  const cx = Math.round((SCREEN_W - cw) / 2)
  const cy = Math.round((SCREEN_H - ch) / 2)
  rect(f, cx, cy, cw, ch, { fill: "#FFFFFF", radius: 20, stroke: "#E2E8F0" })

  iconBox(f, cx + Math.round((cw - 64) / 2), cy + 48, 64, "#FEF9C3", "L", { radius: 32, fg: "#A16207" })

  txt(f, cx + 40, cy + 140, "This video is restricted.", {
    size: 26, style: "Bold", color: "#0F172A", width: cw - 80, align: "CENTER"
  })
  txt(f, cx + 40, cy + 188, "Access was changed after the link was shared with you.", {
    size: 14, color: "#475569", width: cw - 80, align: "CENTER", lineHeight: 22
  })
  txt(f, cx + 40, cy + 212, "Request access from the owner to keep watching.", {
    size: 14, color: "#475569", width: cw - 80, align: "CENTER"
  })

  // Video meta block
  rect(f, cx + 40, cy + 264, cw - 80, 96, { fill: "#F8FAFC", radius: 10 })
  rect(f, cx + 56, cy + 280, 64, 64, { fill: "#7C3AED", radius: 6 })
  rect(f, cx + 76, cy + 304, 24, 16, { fill: "#FFFFFF", radius: 2 })
  txt(f, cx + 136, cy + 280, "Customer demo: Acme Corp", {
    size: 14, style: "SemiBold", color: "#0F172A", width: 360
  })
  txt(f, cx + 136, cy + 302, "Shared by Ren Sato · Acme Inc.", {
    size: 12, color: "#64748B", width: 360
  })
  badge(f, cx + 136, cy + 322, "Audience now limited to: Sales team", { variant: "warning", width: 280 })

  btn(f, cx + 40, cy + 384, cw - 80, 48, "Request access from Ren", { variant: "primary", size: 13 })
  txt(f, cx + 40, cy + 442, "Or ask in #cs to see why it was restricted", {
    size: 12, color: "#94A3B8", width: cw - 80, align: "CENTER"
  })
})(F["ST-04"])

// ===== ST-05 Maintenance =====
;(function (f) {
  rect(f, 0, 0, SCREEN_W, SCREEN_H, { fill: "#F8FAFC" })

  const cw = 620
  const ch = 460
  const cx = Math.round((SCREEN_W - cw) / 2)
  const cy = Math.round((SCREEN_H - ch) / 2)
  rect(f, cx, cy, cw, ch, { fill: "#FFFFFF", radius: 20, stroke: "#E2E8F0" })

  iconBox(f, cx + Math.round((cw - 64) / 2), cy + 48, 64, "#DBEAFE", "M", { radius: 32, fg: "#1E40AF" })

  txt(f, cx + 40, cy + 140, "We're updating Replay.", {
    size: 28, style: "Bold", color: "#0F172A", width: cw - 80, align: "CENTER"
  })
  txt(f, cx + 40, cy + 192, "Recording & uploads are paused. Playback & comments work normally.", {
    size: 14, color: "#475569", width: cw - 80, align: "CENTER", lineHeight: 22
  })

  // Status block
  rect(f, cx + 40, cy + 248, cw - 80, 124, {
    fill: "#F8FAFC", radius: 12
  })
  txt(f, cx + 60, cy + 268, "Estimated completion", {
    size: 11, color: "#64748B", width: 200
  })
  txt(f, cx + 60, cy + 286, "Today 14:30 JST (in 38 min)", {
    size: 18, style: "Bold", color: "#0F172A", width: 400, family: "Inter"
  })
  // Progress
  rect(f, cx + 60, cy + 326, cw - 120, 8, { fill: "#E2E8F0", radius: 4 })
  rect(f, cx + 60, cy + 326, Math.round((cw - 120) * 0.62), 8, { fill: "#0D9488", radius: 4 })
  txt(f, cx + 60, cy + 342, "62% complete · No data lost", {
    size: 11, color: "#64748B", width: 300
  })

  btn(f, cx + 40, cy + 396, cw - 80, 44, "View incident & status", { variant: "primary", size: 13 })
})(F["ST-05"])

// ===== ST-06 404 =====
;(function (f) {
  rect(f, 0, 0, SCREEN_W, SCREEN_H, { fill: "#F8FAFC" })

  // 404 big numerals
  txt(f, 0, 200, "404", {
    size: 220, style: "Bold", color: "#0D9488",
    width: SCREEN_W, align: "CENTER", lineHeight: 220
  })

  txt(f, 0, 444, "We couldn't find that video.", {
    size: 32, style: "Bold", color: "#0F172A",
    width: SCREEN_W, align: "CENTER", lineHeight: 40
  })
  txt(f, 0, 500, "The link may have been changed, or the video was archived.", {
    size: 16, color: "#475569", width: SCREEN_W, align: "CENTER"
  })

  // Big search + CTAs
  const sw = 560
  const sx = Math.round((SCREEN_W - sw) / 2)
  rect(f, sx, 560, sw, 56, {
    fill: "#FFFFFF", stroke: "#0D9488", strokeWeight: 2, radius: 12
  })
  iconBox(f, sx + 16, 578, 24, "#0D9488", "Q", { radius: 12 })
  txt(f, sx + 52, 578, "Search recent videos by title or transcript", {
    size: 14, color: "#94A3B8", width: 440
  })

  // Recent
  txt(f, 0, 660, "Or jump to a recent video", {
    size: 12, style: "Medium", color: "#64748B",
    width: SCREEN_W, align: "CENTER"
  })
  const rx = Math.round((SCREEN_W - 720) / 2)
  const recent = [
    ["Q4 roadmap walkthrough", "Mika · 12h"],
    ["Sprint review — Frontend", "Sora · 1d"],
    ["Customer demo: Acme", "Ren · 2d"]
  ]
  for (let i = 0; i < recent.length; i++) {
    const ix = rx + i * 240
    rect(f, ix, 696, 224, 100, {
      fill: "#FFFFFF", stroke: "#E2E8F0", radius: 10
    })
    rect(f, ix + 12, 708, 60, 40, {
      fill: ["#0F766E", "#1E40AF", "#7C3AED"][i], radius: 6
    })
    rect(f, ix + 30, 716, 24, 24, { fill: "#FFFFFF", radius: 12 })
    rect(f, ix + 38, 720, 8, 16, { fill: ["#0F766E", "#1E40AF", "#7C3AED"][i], radius: 1 })
    txt(f, ix + 84, 712, recent[i][0], {
      size: 12, style: "SemiBold", color: "#0F172A", width: 130, lineHeight: 16
    })
    txt(f, ix + 84, 748, recent[i][1], { size: 10, color: "#64748B", width: 120 })
  }

  txt(f, 0, 836, "← Back to Home", {
    size: 13, style: "Medium", color: "#0D9488",
    width: SCREEN_W, align: "CENTER"
  })
})(F["ST-06"])

console.log("Settings/States done. Screens:", figma.currentPage.children.length)
