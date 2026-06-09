// === Replay Core (15 screens) generation script ===
// 1 eval 完結、全 helpers + 全画面実装 + walk-fix を 1 file に。
// 画面サイズは 1440x900 desktop default, dark player は 1440x900 黒背景。
// 配置: 4 列 x 4 行 grid (gap 200px)、page 上は左上 (0,0) から開始。

const page = figma.currentPage

// 既存 page をクリア
for (const c of [...page.children]) c.remove()
page.name = "Replay/Core"

// ===== Helpers =====
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

// rect(parent, x, y, w, h, opts) — appendChild → resize → x/y の順で座標 bug 回避
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

// txt(parent, x, y, content, opts) — appendChild → resize → x/y の順、 fontName を最初に
function txt(parent, x, y, content, opts) {
  opts = opts || {}
  const t = figma.createText()
  t.fontName = { family: opts.family || "Inter", style: opts.style || "Regular" }
  t.characters = content
  parent.appendChild(t)
  if (opts.size) t.fontSize = opts.size
  if (opts.lineHeight) t.lineHeight = { value: opts.lineHeight, unit: "PIXELS" }
  if (opts.letterSpacing !== undefined) t.letterSpacing = { value: opts.letterSpacing, unit: "PIXELS" }
  if (opts.width) {
    t.textAutoResize = "HEIGHT"
    t.resize(opts.width, opts.height || opts.lineHeight || (opts.size || 14) * 1.4)
  }
  t.x = x
  t.y = y
  if (opts.align) t.textAlignHorizontal = opts.align
  const color = opts.color || "#0F172A"
  t.fills = [solidFill(color, opts.opacity)]
  return t
}

// btn(parent, x, y, w, h, label, opts)
function btn(parent, x, y, w, h, label, opts) {
  opts = opts || {}
  const variant = opts.variant || "primary"
  const fills = {
    primary: "#0D9488",
    primaryHover: "#0F766E",
    secondary: "#F1F5F9",
    danger: "#DC2626",
    record: "#EF4444",
    ghost: "#FFFFFF"
  }
  const labelColors = {
    primary: "#FFFFFF",
    secondary: "#0F172A",
    danger: "#FFFFFF",
    record: "#FFFFFF",
    ghost: "#0F172A"
  }
  const fill = fills[variant] || fills.primary
  const labelColor = labelColors[variant] || "#FFFFFF"

  const f = rect(parent, x, y, w, h, {
    name: "btn/" + variant,
    fill: fill,
    radius: opts.radius !== undefined ? opts.radius : 8,
    stroke: variant === "ghost" || variant === "secondary" ? "#CBD5E1" : undefined,
    strokeWeight: 1
  })
  const size = opts.size || 14
  const ty = Math.round((h - size * 1.2) / 2)
  const tx = opts.padX !== undefined ? opts.padX : 16
  const labelNode = txt(f, tx, ty, label, {
    size: size,
    style: opts.weight || "Medium",
    color: labelColor,
    width: w - tx * 2,
    align: opts.align || "CENTER"
  })
  return { frame: f, label: labelNode }
}

// badge(parent, x, y, label, opts) — pill 形 badge with strong contrast
function badge(parent, x, y, label, opts) {
  opts = opts || {}
  const variant = opts.variant || "default"
  const fills = {
    default: "#E2E8F0",
    success: "#BBF7D0",
    warning: "#FEF08A",
    error: "#FECACA",
    info: "#BFDBFE",
    unwatched: "#FED7AA",
    new: "#C7D2FE"
  }
  const colors = {
    default: "#1E293B",
    success: "#14532D",
    warning: "#713F12",
    error: "#7F1D1D",
    info: "#1E3A8A",
    unwatched: "#7C2D12",
    new: "#312E81"
  }
  const bg = fills[variant] || fills.default
  const color = colors[variant] || colors.default
  const w = opts.width || (label.length * 7 + 24)
  const h = opts.height || 22
  const f = rect(parent, x, y, w, h, {
    name: "badge",
    fill: bg,
    radius: h / 2
  })
  txt(f, 10, Math.round((h - 11) / 2), label, {
    size: 11,
    style: "Medium",
    color: color,
    width: w - 20,
    align: "CENTER"
  })
  return f
}

// avatar(parent, x, y, size, label, opts) — 円形 avatar (initial)
function avatar(parent, x, y, size, label, opts) {
  opts = opts || {}
  const palette = ["#0D9488", "#7C3AED", "#DB2777", "#F59E0B", "#2563EB", "#059669", "#DC2626"]
  const fill = opts.fill || palette[Math.abs(label.charCodeAt(0)) % palette.length]
  const f = rect(parent, x, y, size, size, {
    name: "avatar",
    fill: fill,
    radius: size / 2
  })
  txt(f, 0, Math.round((size - size * 0.45) / 2), label.charAt(0).toUpperCase(), {
    size: Math.round(size * 0.45),
    style: "SemiBold",
    color: "#FFFFFF",
    width: size,
    align: "CENTER"
  })
  return f
}

// videoThumb(parent, x, y, w, h, title, opts) — 動画 thumbnail card
function videoThumb(parent, x, y, w, h, title, opts) {
  opts = opts || {}
  const f = rect(parent, x, y, w, h, {
    name: "video-thumb",
    fill: "#1E293B",
    radius: 10,
    clip: true
  })
  // gradient stripes simulating thumbnail content
  rect(f, 0, 0, w, h, { fill: opts.thumbFill || "#334155", radius: 10 })
  // play overlay - triangle made of two stacked rects (avoid emoji glyph fail)
  const playSize = 48
  rect(f, Math.round((w - playSize) / 2), Math.round((h - playSize) / 2), playSize, playSize, {
    fill: "#FFFFFF",
    radius: playSize / 2,
    fillOpacity: 0.95
  })
  // Triangle approximation
  const ptx = Math.round((w - playSize) / 2) + 18
  const pty = Math.round((h - playSize) / 2) + 16
  rect(f, ptx, pty, 14, 16, { fill: "#0D9488", radius: 2 })
  rect(f, ptx + 14, pty + 4, 8, 8, { fill: "#0D9488", radius: 2 })
  // duration pill
  if (opts.duration) {
    const dw = opts.duration.length * 6 + 14
    rect(f, w - dw - 10, h - 26, dw, 18, {
      fill: "#0F172A",
      radius: 4,
      fillOpacity: 0.85
    })
    txt(f, w - dw - 10, h - 24, opts.duration, {
      size: 10,
      color: "#FFFFFF",
      width: dw,
      align: "CENTER",
      style: "Medium"
    })
  }
  return f
}

// Section title (page section header)
function sectionTitle(parent, x, y, w, title, sub) {
  txt(parent, x, y, title, { size: 18, style: "SemiBold", color: "#0F172A", width: w })
  if (sub) txt(parent, x, y + 26, sub, { size: 13, color: "#64748B", width: w })
}

// Build sidebar (Replay common navigation)
function sidebar(parent, h, active) {
  const w = 240
  const sb = rect(parent, 0, 0, w, h, {
    name: "Sidebar",
    fill: "#0F172A",
    stroke: "#1E293B",
    strokeWeight: 1
  })
  // brand
  rect(sb, 24, 24, 32, 32, { fill: "#0D9488", radius: 8 })
  txt(sb, 28, 32, "R", { size: 18, style: "Bold", color: "#FFFFFF", width: 24, align: "CENTER" })
  txt(sb, 64, 28, "Replay", { size: 16, style: "SemiBold", color: "#FFFFFF", width: 120 })
  txt(sb, 64, 46, "Acme Inc.", { size: 11, color: "#94A3B8", width: 120 })

  // Record button (red, with center red-dot icon)
  const recBtn = rect(sb, 24, 80, w - 48, 44, {
    fill: "#EF4444",
    radius: 10
  })
  rect(recBtn, 16, 16, 12, 12, { fill: "#FFFFFF", radius: 6 })
  txt(recBtn, 36, 14, "Record", { size: 14, style: "SemiBold", color: "#FFFFFF", width: 120 })
  txt(recBtn, 36, 30, "⌘ + R", { size: 10, color: "#FECACA", width: 100 })

  // Nav items - icon letters as a stable fallback for emoji
  const items = [
    ["Home", "C-01", "H", "#0EA5E9"],
    ["Library", "C-02", "L", "#7C3AED"],
    ["Comments", "C-08", "C", "#F59E0B"],
    ["Analytics", "C-09", "A", "#0D9488"],
    ["Workflows", "C-11", "W", "#DB2777"],
    ["External shares", "C-13", "E", "#059669"],
    ["Search", "C-15", "S", "#2563EB"]
  ]
  let yo = 152
  for (const [label, id, letter, hex] of items) {
    const isActive = id === active
    const item = rect(sb, 16, yo, w - 32, 38, {
      fill: isActive ? "#1E293B" : "#0F172A",
      radius: 8,
      transparent: !isActive
    })
    if (isActive) {
      rect(item, 0, 9, 3, 20, { fill: "#2DD4BF", radius: 2 })
    }
    iconBox(item, 12, 9, 20, isActive ? hex : "#334155", letter)
    txt(item, 40, 11, label, {
      size: 13,
      style: isActive ? "SemiBold" : "Regular",
      color: isActive ? "#FFFFFF" : "#94A3B8",
      width: w - 80
    })
    yo += 44
  }

  // Bottom user
  const uy = h - 76
  rect(sb, 16, uy, w - 32, 56, { fill: "#1E293B", radius: 8 })
  avatar(sb, 30, uy + 12, 32, "M")
  txt(sb, 72, uy + 14, "Mika Tanaka", { size: 13, style: "Medium", color: "#FFFFFF", width: 120 })
  txt(sb, 72, uy + 32, "PM • Online", { size: 11, color: "#94A3B8", width: 120 })
  return sb
}

// Topbar (with search and right actions)
function topbar(parent, w, title, sub) {
  const tb = rect(parent, 0, 0, w, 72, {
    name: "Topbar",
    fill: "#FFFFFF",
    stroke: "#E2E8F0",
    strokeWeight: 1
  })
  txt(tb, 32, 14, title, { size: 18, style: "SemiBold", color: "#0F172A", width: 360 })
  if (sub) txt(tb, 32, 40, sub, { size: 12, color: "#64748B", width: 360 })

  // Search
  const sw = 320
  const sx = Math.round(w / 2 - sw / 2)
  rect(tb, sx, 20, sw, 32, {
    fill: "#F8FAFC",
    stroke: "#E2E8F0",
    radius: 8
  })
  iconBox(tb, sx + 10, 26, 16, "#94A3B8", "Q", { radius: 8, fg: "#FFFFFF" })
  txt(tb, sx + 36, 26, "Search transcripts, tags, people…", { size: 12, color: "#94A3B8", width: 260 })

  // Right actions
  const rax = w - 240
  rect(tb, rax, 20, 32, 32, { fill: "#F1F5F9", radius: 8 })
  iconBox(tb, rax + 8, 28, 16, "#475569", "N", { radius: 8 })
  rect(tb, rax + 40, 20, 32, 32, { fill: "#F1F5F9", radius: 8 })
  iconBox(tb, rax + 48, 28, 16, "#475569", "?", { radius: 8 })
  avatar(tb, rax + 88, 20, 32, "M")
  btn(tb, rax + 132, 20, 100, 32, "Share", { variant: "primary", size: 12 })

  return tb
}

// ID tag (frame outer top-left + frame inner top-left badge for identification)
function idTag(page, screen, id, name) {
  // outer tag above frame
  const t = figma.createText()
  t.fontName = { family: "Inter", style: "Bold" }
  t.characters = id + " · " + name
  page.appendChild(t)
  t.fontSize = 14
  t.resize(800, 20)
  t.x = screen.x
  t.y = screen.y - 32
  t.fills = [solidFill("#0F172A")]

  // inner badge in screen top-left for individual export visibility
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
  return t
}

// iconBox - replacement for emoji icons that glyph-fail in Inter font
// renders a colored rect with monogram letter as a fallback that always draws
function iconBox(parent, x, y, size, hex, letter, opts) {
  opts = opts || {}
  const f = rect(parent, x, y, size, size, {
    fill: hex,
    radius: opts.radius !== undefined ? opts.radius : Math.round(size * 0.25),
    name: "icon"
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

// ===== Screen layout =====
// 4 列 x 4 行 grid、 各画面 1440x900 desktop、 gap 200
const COLS = 4
const GAP = 200
const SCREEN_W = 1440
const SCREEN_H = 900
const PLAYER_H = 900

// 画面定義: [id, name, dark, height]
const SCREENS = [
  ["C-01", "Core/Home", false, SCREEN_H],
  ["C-02", "Core/Library", false, SCREEN_H],
  ["C-03", "Core/Recorder/ModeSelect", true, SCREEN_H],
  ["C-04", "Core/Recorder/Live", true, SCREEN_H],
  ["C-05", "Core/Recorder/PostRecord", false, SCREEN_H],
  ["C-06", "Core/Player", true, PLAYER_H],
  ["C-07", "Core/Player/CommentCompose", true, PLAYER_H],
  ["C-08", "Core/Comments/Inbox", false, SCREEN_H],
  ["C-09", "Core/Analytics/Dashboard", false, SCREEN_H],
  ["C-10", "Core/Analytics/VideoDetail", false, SCREEN_H],
  ["C-11", "Core/Workflows", false, SCREEN_H],
  ["C-12", "Core/Workflows/Editor", false, SCREEN_H],
  ["C-13", "Core/ExternalShares", false, SCREEN_H],
  ["C-14", "Core/ExternalShares/Detail", false, SCREEN_H],
  ["C-15", "Core/Search", false, SCREEN_H]
]

const F = {}
for (let i = 0; i < SCREENS.length; i++) {
  const [id, name, dark, h] = SCREENS[i]
  const col = i % COLS
  const row = Math.floor(i / COLS)
  const x = col * (SCREEN_W + GAP)
  const y = row * (h + GAP + 60)
  const f = figma.createFrame()
  f.name = "Screen/" + name
  f.x = x
  f.y = y
  page.appendChild(f)
  f.resize(SCREEN_W, h)
  f.fills = [solidFill(dark ? "#0F172A" : "#F8FAFC")]
  f.clipsContent = true
  F[id] = f
  idTag(page, f, id, name)
}

// ===== C-01 Home =====
;(function (f) {
  sidebar(f, SCREEN_H, "C-01")
  const main = rect(f, 240, 0, SCREEN_W - 240, SCREEN_H, { fill: "#F8FAFC", transparent: true })
  topbar(main, SCREEN_W - 240, "Home", "Good morning, Mika — 3 new videos in your feed")

  // Tab bar
  const tabsY = 92
  const tabs = ["For you", "Following", "Team feed"]
  let tx = 32
  for (let i = 0; i < tabs.length; i++) {
    const active = i === 0
    const wT = tabs[i].length * 8 + 32
    rect(main, tx, tabsY, wT, 36, {
      fill: active ? "#0F172A" : "#FFFFFF",
      stroke: active ? "#0F172A" : "#E2E8F0",
      radius: 18,
      strokeWeight: 1
    })
    txt(main, tx, tabsY + 11, tabs[i], {
      size: 13,
      style: "Medium",
      color: active ? "#FFFFFF" : "#475569",
      width: wT,
      align: "CENTER"
    })
    tx += wT + 8
  }
  badge(main, tx + 8, tabsY + 8, "3 unwatched", { variant: "unwatched" })

  // Featured large video
  sectionTitle(main, 32, 152, 600, "Featured by your team", "PM Mika shared 12 minutes ago")
  videoThumb(main, 32, 200, 720, 380, "Q4 roadmap walkthrough", {
    thumbFill: "#0F766E",
    duration: "5:12"
  })
  txt(main, 32, 596, "Q4 roadmap walkthrough", {
    size: 18,
    style: "SemiBold",
    color: "#0F172A",
    width: 720
  })
  txt(main, 32, 622, "Mika Tanaka · #spec #frontend · 8 of 14 watched", {
    size: 12,
    color: "#64748B",
    width: 720
  })
  badge(main, 32, 644, "Spec", { variant: "info" })
  badge(main, 80, 644, "All-hands", { variant: "new" })
  badge(main, 156, 644, "57% watched", { variant: "warning" })

  // Right: stats panel
  const sp = rect(main, 780, 200, SCREEN_W - 240 - 780 - 32, 480, {
    fill: "#FFFFFF",
    radius: 12,
    stroke: "#E2E8F0"
  })
  txt(sp, 24, 24, "Today's viewing ops", {
    size: 15,
    style: "SemiBold",
    color: "#0F172A",
    width: 320
  })
  txt(sp, 24, 46, "Replay tracks who's caught up", {
    size: 12,
    color: "#64748B",
    width: 320
  })
  const stats = [
    ["Avg watch rate", "73%", "+8% vs last week", "success"],
    ["Unwatched by you", "3 videos", "Newest: 12m ago", "warning"],
    ["Awaiting reply", "5 comments", "2 from customers", "info"]
  ]
  let ssy = 86
  for (const [k, v, sub, vrn] of stats) {
    rect(sp, 24, ssy, sp.width - 48, 92, { fill: "#F8FAFC", radius: 10 })
    txt(sp, 40, ssy + 14, k, { size: 12, color: "#64748B", width: 200 })
    txt(sp, 40, ssy + 32, v, {
      size: 22,
      style: "Bold",
      color: "#0F172A",
      width: 200
    })
    badge(sp, 40, ssy + 64, sub, { variant: vrn })
    ssy += 104
  }
  rect(sp, 24, ssy + 12, sp.width - 48, 40, { fill: "#0F172A", radius: 8 })
  txt(sp, 24, ssy + 24, "Open viewing dashboard →", {
    size: 12,
    style: "Medium",
    color: "#FFFFFF",
    width: sp.width - 48,
    align: "CENTER"
  })

  // Below: feed grid 3 cards
  const fy = 700
  txt(main, 32, fy, "More for you", {
    size: 15,
    style: "SemiBold",
    color: "#0F172A",
    width: 200
  })
  const cardW = 280
  const cards = [
    ["Frontend sync (async)", "Sora · 3 min", "#engineering", "success"],
    ["Customer demo: Acme", "Ren · 7 min", "#cs", "info"],
    ["Onboarding walkthrough", "HR · 4 min", "#all-hands", "new"]
  ]
  for (let i = 0; i < cards.length; i++) {
    const cx = 32 + i * (cardW + 16)
    const cy = fy + 28
    const card = rect(main, cx, cy, cardW, 156, {
      fill: "#FFFFFF",
      radius: 10,
      stroke: "#E2E8F0"
    })
    videoThumb(card, 12, 12, cardW - 24, 88, cards[i][0], {
      thumbFill: ["#1E40AF", "#7C3AED", "#0F766E"][i],
      duration: ["3:14", "7:02", "4:21"][i]
    })
    txt(card, 16, 110, cards[i][0], {
      size: 12,
      style: "SemiBold",
      color: "#0F172A",
      width: cardW - 32
    })
    txt(card, 16, 128, cards[i][1] + " · " + cards[i][2], {
      size: 10,
      color: "#64748B",
      width: cardW - 32
    })
  }
})(F["C-01"])

// ===== C-02 Library =====
;(function (f) {
  sidebar(f, SCREEN_H, "C-02")
  const main = rect(f, 240, 0, SCREEN_W - 240, SCREEN_H, { fill: "#F8FAFC", transparent: true })
  topbar(main, SCREEN_W - 240, "Library", "All recordings across Personal, Team, and Workspace")

  // Sub nav
  const subnav = rect(main, 0, 72, SCREEN_W - 240, 48, {
    fill: "#FFFFFF",
    stroke: "#E2E8F0",
    strokeWeight: 1
  })
  const subtabs = ["Personal (42)", "Team (118)", "All workspace (683)"]
  let sx = 32
  for (let i = 0; i < subtabs.length; i++) {
    const active = i === 1
    txt(subnav, sx, 16, subtabs[i], {
      size: 13,
      style: active ? "SemiBold" : "Regular",
      color: active ? "#0D9488" : "#64748B",
      width: 200
    })
    if (active) rect(subnav, sx, 42, subtabs[i].length * 7, 2, { fill: "#0D9488" })
    sx += 180
  }
  // Right toggle / sort
  rect(subnav, SCREEN_W - 240 - 280, 12, 64, 28, { fill: "#0F172A", radius: 6 })
  txt(subnav, SCREEN_W - 240 - 280, 18, "Grid", {
    size: 12,
    style: "Medium",
    color: "#FFFFFF",
    width: 64,
    align: "CENTER"
  })
  rect(subnav, SCREEN_W - 240 - 212, 12, 64, 28, {
    fill: "#FFFFFF",
    stroke: "#E2E8F0",
    radius: 6
  })
  txt(subnav, SCREEN_W - 240 - 212, 18, "List", {
    size: 12,
    color: "#475569",
    width: 64,
    align: "CENTER"
  })
  txt(subnav, SCREEN_W - 240 - 132, 18, "Sort: Newest", {
    size: 12,
    color: "#475569",
    width: 120
  })

  // Filter chips
  const fy = 140
  const filters = ["All tags", "Spec", "Demo", "Bug repro", "Async sync", "Customer", "Engineering"]
  let fx = 32
  for (let i = 0; i < filters.length; i++) {
    const active = i === 0
    const w = filters[i].length * 7 + 28
    rect(main, fx, fy, w, 30, {
      fill: active ? "#0F172A" : "#FFFFFF",
      stroke: "#E2E8F0",
      radius: 15
    })
    txt(main, fx, fy + 8, filters[i], {
      size: 12,
      style: active ? "Medium" : "Regular",
      color: active ? "#FFFFFF" : "#475569",
      width: w,
      align: "CENTER"
    })
    fx += w + 8
  }

  // Library grid 4 x 2
  const gridX = 32
  const gridY = 196
  const cardW = 270
  const cardH = 224
  const gap = 16
  const titles = [
    "Q4 roadmap walkthrough",
    "Sprint review — Frontend",
    "Customer demo: Acme Corp",
    "PR walkthrough #4521",
    "All-hands: hiring update",
    "Async standup — Mon",
    "Design review — Auth flow",
    "Bug repro: upload stall"
  ]
  const owners = ["Mika · 12m", "Sora · 8m", "Ren · 7m", "Sora · 5m", "HR · 9m", "Mika · 3m", "Mika · 6m", "Sora · 4m"]
  const durs = ["5:12", "7:48", "8:21", "4:32", "9:02", "2:48", "5:41", "3:54"]
  const tags = ["Spec", "Sprint", "Demo", "PR", "All-hands", "Standup", "Design", "Bug"]
  const stats = ["Viewed 8/14", "Viewed 12/12", "Viewed 4 ext", "Viewed 3/5", "Viewed 67/80", "Viewed 9/14", "Viewed 6/8", "Viewed 5/8"]
  for (let i = 0; i < 8; i++) {
    const col = i % 4
    const row = Math.floor(i / 4)
    const x = gridX + col * (cardW + gap)
    const y = gridY + row * (cardH + gap)
    const card = rect(main, x, y, cardW, cardH, {
      fill: "#FFFFFF",
      radius: 10,
      stroke: "#E2E8F0"
    })
    videoThumb(card, 12, 12, cardW - 24, 140, titles[i], {
      thumbFill: ["#0F766E", "#1E40AF", "#7C3AED", "#DB2777", "#F59E0B", "#059669", "#0EA5E9", "#DC2626"][i],
      duration: durs[i]
    })
    txt(card, 16, 160, titles[i], {
      size: 12,
      style: "SemiBold",
      color: "#0F172A",
      width: cardW - 32
    })
    txt(card, 16, 178, owners[i], { size: 10, color: "#64748B", width: cardW - 32 })
    badge(card, 16, 196, tags[i], { variant: "default" })
    txt(card, 90, 200, stats[i], { size: 9, color: "#64748B", width: 150 })
  }
})(F["C-02"])

// ===== C-03 Recorder/ModeSelect =====
;(function (f) {
  // Dark mode entry, centered modal-like sheet
  const cardW = 640
  const cardH = 560
  const cx = Math.round((SCREEN_W - cardW) / 2)
  const cy = Math.round((SCREEN_H - cardH) / 2)

  // Background dim
  rect(f, 0, 0, SCREEN_W, SCREEN_H, { fill: "#0F172A" })

  // Close
  rect(f, SCREEN_W - 72, 32, 40, 40, { fill: "#1E293B", radius: 20 })
  txt(f, SCREEN_W - 72, 42, "×", {
    size: 22,
    style: "Medium",
    color: "#FFFFFF",
    width: 40,
    align: "CENTER"
  })

  const card = rect(f, cx, cy, cardW, cardH, {
    fill: "#FFFFFF",
    radius: 16,
    stroke: "#1E293B"
  })
  txt(card, 40, 36, "What do you want to record?", {
    size: 22,
    style: "Bold",
    color: "#0F172A",
    width: cardW - 80
  })
  txt(card, 40, 70, "Choose a mode. You can change cam shape and resolution after.", {
    size: 13,
    color: "#64748B",
    width: cardW - 80
  })

  // Mode cards 2x2
  const modes = [
    ["Screen + Cam", "Most popular for walkthroughs", true],
    ["Screen only", "Best for product demos & docs", false],
    ["Cam only", "Talking head, 90s tips", false],
    ["Audio only", "Voice memo for team", false]
  ]
  const mw = (cardW - 80 - 16) / 2
  const mh = 140
  for (let i = 0; i < 4; i++) {
    const col = i % 2
    const row = Math.floor(i / 2)
    const x = 40 + col * (mw + 16)
    const y = 120 + row * (mh + 16)
    const sel = modes[i][2]
    const mc = rect(card, x, y, mw, mh, {
      fill: sel ? "#ECFEFF" : "#F8FAFC",
      stroke: sel ? "#0D9488" : "#E2E8F0",
      radius: 12,
      strokeWeight: sel ? 2 : 1
    })
    // icon box with letter monogram (Screen+Cam / Screen only / Cam only / Audio)
    const letters = ["+", "S", "C", "A"]
    iconBox(mc, 20, 20, 44, sel ? "#0D9488" : "#CBD5E1", letters[i], { radius: 10 })
    txt(mc, 80, 24, modes[i][0], {
      size: 14,
      style: "SemiBold",
      color: "#0F172A",
      width: mw - 100
    })
    txt(mc, 80, 46, modes[i][1], {
      size: 11,
      color: "#64748B",
      width: mw - 100
    })
    if (sel) {
      rect(mc, mw - 36, 20, 20, 20, { fill: "#0D9488", radius: 10 })
      txt(mc, mw - 36, 23, "✓", {
        size: 14,
        style: "Bold",
        color: "#FFFFFF",
        width: 20,
        align: "CENTER"
      })
    }
  }

  // Countdown / settings row
  rect(card, 40, 432, cardW - 80, 60, {
    fill: "#F1F5F9",
    radius: 10
  })
  txt(card, 56, 446, "Countdown", { size: 12, color: "#64748B", width: 120 })
  txt(card, 56, 462, "3 seconds", {
    size: 14,
    style: "SemiBold",
    color: "#0F172A",
    width: 120
  })
  txt(card, 220, 446, "Resolution", { size: 12, color: "#64748B", width: 120 })
  txt(card, 220, 462, "1080p", {
    size: 14,
    style: "SemiBold",
    color: "#0F172A",
    width: 120
  })
  txt(card, 380, 446, "Camera", { size: 12, color: "#64748B", width: 120 })
  txt(card, 380, 462, "MacBook FaceTime", {
    size: 14,
    style: "SemiBold",
    color: "#0F172A",
    width: 180
  })

  btn(card, 40, 512, cardW - 80, 48, "Start recording", {
    variant: "record",
    size: 15,
    weight: "SemiBold"
  })
})(F["C-03"])

// ===== C-04 Recorder/Live =====
;(function (f) {
  // Dark immersive, recorder chrome overlay
  rect(f, 0, 0, SCREEN_W, SCREEN_H, { fill: "#020617" })

  // Mock desktop content (simulate screen being recorded)
  const desk = rect(f, 60, 60, SCREEN_W - 120, SCREEN_H - 220, {
    fill: "#0F172A",
    radius: 12,
    stroke: "#1E293B"
  })
  txt(desk, 32, 32, "linear.app/team/ENG/active", {
    size: 13,
    color: "#94A3B8",
    width: 400
  })
  txt(desk, 32, 60, "Active sprint", {
    size: 32,
    style: "Bold",
    color: "#FFFFFF",
    width: 400
  })
  // Mock kanban columns
  const colTitles = ["Todo (12)", "In progress (5)", "In review (3)", "Done (8)"]
  const colW = 220
  for (let i = 0; i < 4; i++) {
    const cx = 32 + i * (colW + 16)
    const cy = 120
    rect(desk, cx, cy, colW, 460, {
      fill: "#1E293B",
      radius: 10
    })
    txt(desk, cx + 14, cy + 14, colTitles[i], {
      size: 12,
      style: "SemiBold",
      color: "#FFFFFF",
      width: colW - 28
    })
    for (let j = 0; j < 3; j++) {
      rect(desk, cx + 10, cy + 44 + j * 70, colW - 20, 60, {
        fill: "#334155",
        radius: 8
      })
      txt(desk, cx + 22, cy + 52 + j * 70, "Task " + (i * 3 + j + 1) + ": fix issue", {
        size: 11,
        style: "Medium",
        color: "#FFFFFF",
        width: colW - 40
      })
      txt(desk, cx + 22, cy + 84 + j * 70, "Sora · 2d", {
        size: 10,
        color: "#94A3B8",
        width: 100
      })
    }
  }

  // Webcam pill bottom right
  const camS = 180
  rect(f, SCREEN_W - camS - 60, SCREEN_H - 320, camS, camS, {
    fill: "#0F766E",
    radius: camS / 2,
    stroke: "#0D9488",
    strokeWeight: 3
  })
  txt(f, SCREEN_W - camS - 60, SCREEN_H - 320 + 60, "M", {
    size: 60,
    style: "Bold",
    color: "#FFFFFF",
    width: camS,
    align: "CENTER"
  })

  // Recorder chrome bar
  const cbY = SCREEN_H - 120
  const cbW = 720
  const cbX = Math.round((SCREEN_W - cbW) / 2)
  rect(f, cbX, cbY, cbW, 80, {
    fill: "#FFFFFF",
    radius: 40,
    stroke: "#E2E8F0",
    strokeWeight: 1
  })
  // REC light
  rect(f, cbX + 24, cbY + 28, 16, 16, {
    fill: "#EF4444",
    radius: 8
  })
  txt(f, cbX + 50, cbY + 32, "REC", {
    size: 13,
    style: "Bold",
    color: "#EF4444",
    width: 40
  })
  // Time
  txt(f, cbX + 100, cbY + 32, "00:02:47", {
    size: 16,
    style: "Bold",
    color: "#0F172A",
    width: 100,
    family: "Inter"
  })
  // Controls with letter-based icons (Pause / Mic / Cam / Draw / Trash / Done)
  const ctrls = [
    ["P", "Pause"],
    ["M", "Mic"],
    ["C", "Cam"],
    ["D", "Draw"],
    ["T", "Trash"],
    ["✓", "Done"]
  ]
  for (let i = 0; i < ctrls.length; i++) {
    const cx = cbX + 220 + i * 56
    const isDone = i === ctrls.length - 1
    rect(f, cx, cbY + 20, 40, 40, {
      fill: isDone ? "#0D9488" : "#F1F5F9",
      radius: 20
    })
    txt(f, cx, cbY + 12, ctrls[i][0], {
      size: 16,
      style: "Bold",
      color: isDone ? "#FFFFFF" : "#0F172A",
      width: 40,
      align: "CENTER"
    })
    txt(f, cx - 8, cbY + 30, ctrls[i][1], {
      size: 8,
      color: isDone ? "#FFFFFF" : "#475569",
      width: 56,
      align: "CENTER"
    })
  }
  // Stop button
  btn(f, cbX + cbW - 110, cbY + 20, 90, 40, "Stop", {
    variant: "danger",
    size: 13,
    weight: "SemiBold"
  })

  // Reduce noise notice top
  rect(f, 60, 16, 360, 32, {
    fill: "#1E293B",
    radius: 16
  })
  iconBox(f, 72, 24, 16, "#F59E0B", "!", { radius: 8 })
  txt(f, 96, 22, "Notifications muted while recording", {
    size: 12,
    color: "#F1F5F9",
    width: 260
  })
})(F["C-04"])

// ===== C-05 Recorder/PostRecord =====
;(function (f) {
  sidebar(f, SCREEN_H, "")
  const main = rect(f, 240, 0, SCREEN_W - 240, SCREEN_H, { fill: "#F8FAFC", transparent: true })
  topbar(main, SCREEN_W - 240, "New recording", "Trim, title, and share before it goes out")

  // Left: video preview + trim
  const previewW = 720
  rect(main, 32, 96, previewW, 420, {
    fill: "#0F172A",
    radius: 12
  })
  rect(main, 32, 96, previewW, 420, { fill: "#1E293B", radius: 12 })
  const cpx = Math.round(32 + (previewW - 80) / 2)
  const cpy = Math.round(96 + (420 - 80) / 2)
  rect(main, cpx, cpy, 80, 80, { fill: "#FFFFFF", radius: 40 })
  rect(main, cpx + 30, cpy + 26, 22, 28, { fill: "#0D9488", radius: 3 })
  rect(main, cpx + 52, cpy + 32, 12, 16, { fill: "#0D9488", radius: 3 })
  // Trim bar
  const trimY = 540
  rect(main, 32, trimY, previewW, 12, {
    fill: "#E2E8F0",
    radius: 6
  })
  rect(main, 32 + 60, trimY, previewW - 60 - 80, 12, {
    fill: "#0D9488",
    radius: 6
  })
  // trim handles
  rect(main, 32 + 56, trimY - 6, 8, 24, { fill: "#0D9488", radius: 4 })
  rect(main, 32 + previewW - 84, trimY - 6, 8, 24, { fill: "#0D9488", radius: 4 })
  txt(main, 32, trimY + 28, "00:00:08", {
    size: 11,
    color: "#475569",
    width: 80
  })
  txt(main, 32 + previewW - 80, trimY + 28, "00:05:21",
    {
      size: 11,
      color: "#475569",
      width: 80,
      align: "RIGHT"
    })
  txt(main, Math.round(32 + previewW / 2 - 50), trimY + 28, "5 min 13 sec total", {
    size: 11,
    color: "#0F172A",
    style: "Medium",
    width: 200,
    align: "CENTER"
  })

  // Chapter markers row
  txt(main, 32, trimY + 60, "AI-generated chapters", {
    size: 13,
    style: "SemiBold",
    color: "#0F172A",
    width: 240
  })
  const chs = [
    ["00:00", "Intro & context"],
    ["01:12", "What changed in v2"],
    ["02:48", "Migration steps"],
    ["04:30", "Q&A"]
  ]
  for (let i = 0; i < chs.length; i++) {
    const cx = 32 + i * 174
    rect(main, cx, trimY + 84, 168, 56, {
      fill: "#FFFFFF",
      stroke: "#E2E8F0",
      radius: 8
    })
    txt(main, cx + 12, trimY + 92, chs[i][0], {
      size: 11,
      style: "Medium",
      color: "#0D9488",
      width: 80
    })
    txt(main, cx + 12, trimY + 110, chs[i][1], {
      size: 11,
      color: "#0F172A",
      width: 144
    })
  }

  // Right: metadata panel
  const panelX = 32 + previewW + 24
  const panelW = SCREEN_W - 240 - panelX - 32
  const panel = rect(main, panelX, 96, panelW, 644, {
    fill: "#FFFFFF",
    radius: 12,
    stroke: "#E2E8F0"
  })
  txt(panel, 24, 24, "Title", { size: 11, style: "Medium", color: "#64748B", width: panelW - 48 })
  rect(panel, 24, 44, panelW - 48, 40, {
    fill: "#F8FAFC",
    stroke: "#CBD5E1",
    radius: 8
  })
  txt(panel, 36, 56, "Q4 roadmap walkthrough", {
    size: 13,
    style: "Medium",
    color: "#0F172A",
    width: panelW - 72
  })

  txt(panel, 24, 100, "Description", {
    size: 11,
    style: "Medium",
    color: "#64748B",
    width: panelW - 48
  })
  rect(panel, 24, 120, panelW - 48, 80, {
    fill: "#F8FAFC",
    stroke: "#CBD5E1",
    radius: 8
  })
  txt(panel, 36, 130, "Walk through key bets, scope cuts,\nand owners for Q4. Ping me if anything\nfeels off.", {
    size: 12,
    color: "#475569",
    width: panelW - 72,
    lineHeight: 18
  })

  txt(panel, 24, 220, "Tags", { size: 11, style: "Medium", color: "#64748B", width: panelW - 48 })
  badge(panel, 24, 244, "spec", { variant: "info" })
  badge(panel, 80, 244, "Q4", { variant: "default" })
  badge(panel, 130, 244, "team:frontend", { variant: "default" })

  txt(panel, 24, 296, "Who can see this", {
    size: 11,
    style: "Medium",
    color: "#64748B",
    width: panelW - 48
  })
  const opts = [
    ["Team: Frontend", true],
    ["Workspace (all)", false],
    ["External: Acme Corp", false]
  ]
  for (let i = 0; i < opts.length; i++) {
    rect(panel, 24, 316 + i * 44, panelW - 48, 36, {
      fill: opts[i][1] ? "#ECFEFF" : "#F8FAFC",
      stroke: opts[i][1] ? "#0D9488" : "#E2E8F0",
      radius: 8
    })
    rect(panel, 38, 326 + i * 44, 16, 16, {
      fill: opts[i][1] ? "#0D9488" : "#FFFFFF",
      stroke: "#CBD5E1",
      radius: 8,
      strokeWeight: 1
    })
    if (opts[i][1]) {
      txt(panel, 38, 326 + i * 44 - 2, "•", {
        size: 14,
        style: "Bold",
        color: "#FFFFFF",
        width: 16,
        align: "CENTER"
      })
    }
    txt(panel, 64, 326 + i * 44, opts[i][0], {
      size: 12,
      color: "#0F172A",
      width: panelW - 96
    })
  }

  txt(panel, 24, 456, "Auto-actions", {
    size: 11,
    style: "Medium",
    color: "#64748B",
    width: panelW - 48
  })
  const aut = [
    "Post to #frontend",
    "Remind unwatched in 24h",
    "Generate transcript (EN, JA)"
  ]
  for (let i = 0; i < aut.length; i++) {
    rect(panel, 24, 478 + i * 32, panelW - 48, 26, {
      fill: "#F8FAFC",
      radius: 6
    })
    rect(panel, 36, 484 + i * 32, 12, 12, {
      fill: "#0D9488",
      radius: 6
    })
    txt(panel, 56, 482 + i * 32, aut[i], {
      size: 11,
      color: "#475569",
      width: panelW - 96
    })
  }

  btn(panel, 24, 588, panelW - 48, 40, "Publish & share", {
    variant: "primary",
    size: 13,
    weight: "SemiBold"
  })
})(F["C-05"])

// ===== C-06 Player =====
;(function (f) {
  rect(f, 0, 0, SCREEN_W, SCREEN_H, { fill: "#0F172A" })

  // Top header
  rect(f, 0, 0, SCREEN_W, 60, {
    fill: "#020617",
    stroke: "#1E293B",
    strokeWeight: 1
  })
  rect(f, 24, 14, 32, 32, { fill: "#0D9488", radius: 8 })
  txt(f, 24, 22, "R", { size: 16, style: "Bold", color: "#FFFFFF", width: 32, align: "CENTER" })
  txt(f, 68, 12, "Q4 roadmap walkthrough", {
    size: 14,
    style: "SemiBold",
    color: "#FFFFFF",
    width: 600
  })
  txt(f, 68, 32, "Mika Tanaka · 5 min 13s · Shared in #frontend · 8 of 14 watched", {
    size: 11,
    color: "#94A3B8",
    width: 600
  })
  btn(f, SCREEN_W - 240, 14, 90, 32, "Comment", { variant: "secondary", size: 12 })
  btn(f, SCREEN_W - 140, 14, 110, 32, "Share", { variant: "primary", size: 12 })

  // Video player (left)
  const playerW = 960
  const playerH = 560
  rect(f, 24, 84, playerW, playerH, { fill: "#1E293B", radius: 12 })
  // Mock content
  rect(f, 24, 84, playerW, playerH, { fill: "#0F766E", radius: 12, fillOpacity: 0.85 })
  const pcx = Math.round(24 + (playerW - 96) / 2)
  const pcy = Math.round(84 + (playerH - 96) / 2)
  rect(f, pcx, pcy, 96, 96, { fill: "#FFFFFF", radius: 48, fillOpacity: 0.95 })
  rect(f, pcx + 36, pcy + 30, 26, 34, { fill: "#0D9488", radius: 3 })
  rect(f, pcx + 62, pcy + 38, 14, 18, { fill: "#0D9488", radius: 3 })
  // Person tag (recorder visible) — placed top-right so scrub bar isn't covered
  rect(f, 24 + playerW - 160, 84 + 24, 132, 132, {
    fill: "#0F172A",
    radius: 66,
    stroke: "#FFFFFF",
    strokeWeight: 4
  })
  txt(f, 24 + playerW - 160, 84 + 24 + 36, "M", {
    size: 48,
    style: "Bold",
    color: "#FFFFFF",
    width: 132,
    align: "CENTER"
  })

  // Player chrome
  const chromeY = 84 + playerH - 64
  rect(f, 24, chromeY, playerW, 64, { fill: "#0F172A", radius: 12, fillOpacity: 0.8 })
  // Scrub bar
  rect(f, 56, chromeY + 12, playerW - 112, 6, { fill: "#475569", radius: 3 })
  rect(f, 56, chromeY + 12, Math.round((playerW - 112) * 0.35), 6, {
    fill: "#0D9488",
    radius: 3
  })
  // Chapter ticks
  const chapMarks = [0.18, 0.52, 0.78]
  for (const p of chapMarks) {
    rect(f, 56 + Math.round((playerW - 112) * p), chromeY + 8, 2, 14, {
      fill: "#FFFFFF",
      fillOpacity: 0.7
    })
  }
  // Time
  txt(f, 56, chromeY + 28, "01:48 / 05:13", {
    size: 11,
    style: "Medium",
    color: "#FFFFFF",
    width: 160
  })
  // Controls right - letter labels for visibility
  const cc = ["||", "1x", "Vol", "CC", "Full"]
  for (let i = 0; i < cc.length; i++) {
    rect(f, playerW - 24 - (i + 1) * 44, chromeY + 22, 32, 32, {
      fill: "#1E293B",
      radius: 16
    })
    txt(f, playerW - 24 - (i + 1) * 44, chromeY + 32, cc[i], {
      size: 10,
      style: "Bold",
      color: "#FFFFFF",
      width: 32,
      align: "CENTER"
    })
  }

  // Chapter strip below
  const stripY = 84 + playerH + 12
  txt(f, 24, stripY, "Chapters (AI)", {
    size: 11,
    style: "SemiBold",
    color: "#94A3B8",
    width: 200
  })
  const chapTitles = ["Intro", "What changed in v2", "Migration steps", "Q&A"]
  const chapTimes = ["00:00", "01:12", "02:48", "04:30"]
  for (let i = 0; i < 4; i++) {
    const cx = 24 + i * (playerW / 4)
    const cw = playerW / 4 - 8
    rect(f, cx, stripY + 24, cw, 48, {
      fill: i === 1 ? "#0D9488" : "#1E293B",
      radius: 8
    })
    txt(f, cx + 12, stripY + 32, chapTimes[i], {
      size: 11,
      style: "Medium",
      color: i === 1 ? "#FFFFFF" : "#94A3B8",
      width: 100
    })
    txt(f, cx + 12, stripY + 50, chapTitles[i], {
      size: 12,
      style: "SemiBold",
      color: i === 1 ? "#FFFFFF" : "#FFFFFF",
      width: cw - 24
    })
  }

  // Right: transcript + comments tabs
  const rx = playerW + 48
  const rw = SCREEN_W - rx - 24
  rect(f, rx, 84, rw, SCREEN_H - 108, {
    fill: "#FFFFFF",
    radius: 12
  })
  // Tabs
  const rtabs = ["Transcript", "Comments (4)", "Analytics"]
  let rtx = 24
  for (let i = 0; i < rtabs.length; i++) {
    const active = i === 0
    const w = rtabs[i].length * 7 + 24
    txt(f, rx + rtx, 100, rtabs[i], {
      size: 12,
      style: active ? "SemiBold" : "Regular",
      color: active ? "#0D9488" : "#64748B",
      width: w
    })
    if (active) rect(f, rx + rtx, 124, w - 4, 2, { fill: "#0D9488" })
    rtx += w + 16
  }

  // Transcript lines
  const tlines = [
    ["00:08", "Mika Tanaka", "Hey team. Let me walk through what we're committing to for Q4."],
    ["00:24", "Mika Tanaka", "Three bets, in priority order. First, async standups become default."],
    ["00:48", "Mika Tanaka", "Second, the migration to the new analytics pipeline."],
    ["01:12", "Mika Tanaka", "Now, what changed in v2 — and why I'm asking for two weeks of slack."],
    ["01:48", "Mika Tanaka", "If we ship the v2 migration without these guardrails, here's what breaks."],
    ["02:30", "Mika Tanaka", "Let me share my screen with the diff so you see exactly what I mean."]
  ]
  let ly = 150
  for (let i = 0; i < tlines.length; i++) {
    const active = i === 4
    if (active) {
      rect(f, rx + 14, ly - 4, rw - 28, 64, { fill: "#ECFEFF", radius: 8 })
    }
    txt(f, rx + 24, ly, tlines[i][0], {
      size: 11,
      style: "Medium",
      color: active ? "#0D9488" : "#94A3B8",
      width: 50,
      family: "Inter"
    })
    txt(f, rx + 80, ly, tlines[i][1], {
      size: 11,
      style: "SemiBold",
      color: "#0F172A",
      width: rw - 100
    })
    txt(f, rx + 80, ly + 16, tlines[i][2], {
      size: 11,
      color: active ? "#0F172A" : "#475569",
      width: rw - 100,
      lineHeight: 18
    })
    ly += 76
  }
})(F["C-06"])

// ===== C-07 Player/CommentCompose =====
;(function (f) {
  // Reuse player layout with comment composer focus
  rect(f, 0, 0, SCREEN_W, SCREEN_H, { fill: "#0F172A" })

  // Top header
  rect(f, 0, 0, SCREEN_W, 60, {
    fill: "#020617",
    stroke: "#1E293B"
  })
  rect(f, 24, 14, 32, 32, { fill: "#0D9488", radius: 8 })
  txt(f, 24, 22, "R", { size: 16, style: "Bold", color: "#FFFFFF", width: 32, align: "CENTER" })
  txt(f, 68, 12, "PR walkthrough #4521", {
    size: 14,
    style: "SemiBold",
    color: "#FFFFFF",
    width: 600
  })
  txt(f, 68, 32, "Sora · 4 min · #engineering · 3 of 5 watched", {
    size: 11,
    color: "#94A3B8",
    width: 600
  })

  // Player left
  const playerW = 880
  const playerH = SCREEN_H - 200
  rect(f, 24, 84, playerW, playerH, { fill: "#1E293B", radius: 12 })
  rect(f, 24, 84, playerW, playerH, { fill: "#7C3AED", radius: 12, fillOpacity: 0.7 })
  const pcx2 = Math.round(24 + (playerW - 96) / 2)
  const pcy2 = Math.round(84 + (playerH - 96) / 2)
  rect(f, pcx2, pcy2, 96, 96, { fill: "#FFFFFF", radius: 48 })
  rect(f, pcx2 + 36, pcy2 + 30, 26, 34, { fill: "#7C3AED", radius: 3 })
  rect(f, pcx2 + 62, pcy2 + 38, 14, 18, { fill: "#7C3AED", radius: 3 })
  // Time bar
  const chromeY = 84 + playerH - 56
  rect(f, 56, chromeY, playerW - 64, 6, { fill: "#475569", radius: 3 })
  rect(f, 56, chromeY, Math.round((playerW - 64) * 0.42), 6, { fill: "#7C3AED", radius: 3 })
  txt(f, 56, chromeY + 16, "01:42 / 04:08", {
    size: 11,
    style: "Medium",
    color: "#FFFFFF",
    width: 160
  })

  // Right panel: Comments thread
  const rx = playerW + 48
  const rw = SCREEN_W - rx - 24
  const panel = rect(f, rx, 84, rw, SCREEN_H - 108, {
    fill: "#FFFFFF",
    radius: 12
  })
  txt(panel, 24, 20, "Comments (4)", {
    size: 14,
    style: "SemiBold",
    color: "#0F172A",
    width: rw - 48
  })

  // Existing comments
  const comments = [
    ["Ren", "00:42", "Love this framing. Should we add a slide for billing?", "2h ago"],
    ["Mika", "01:18", "Agree — let's make a video reply walking through the proposal.", "1h ago"]
  ]
  let cy = 60
  for (let i = 0; i < comments.length; i++) {
    rect(panel, 16, cy, rw - 32, 96, {
      fill: "#F8FAFC",
      stroke: "#E2E8F0",
      radius: 10
    })
    avatar(panel, 30, cy + 14, 32, comments[i][0])
    txt(panel, 72, cy + 14, comments[i][0] + " · " + comments[i][3], {
      size: 11,
      style: "SemiBold",
      color: "#0F172A",
      width: rw - 100
    })
    badge(panel, 72, cy + 32, "@" + comments[i][1], { variant: "info" })
    txt(panel, 16, cy + 60, comments[i][2], {
      size: 12,
      color: "#475569",
      width: rw - 60,
      lineHeight: 18
    })
    cy += 108
  }

  // Composer at bottom, focused state
  const cmpY = SCREEN_H - 280
  rect(panel, 16, cmpY, rw - 32, 196, {
    fill: "#ECFEFF",
    stroke: "#0D9488",
    radius: 12,
    strokeWeight: 2
  })
  badge(panel, 30, cmpY + 16, "Pinned to 01:42", { variant: "info" })
  txt(panel, 30, cmpY + 50, "Reply to Ren and Mika", {
    size: 12,
    style: "Medium",
    color: "#0F172A",
    width: rw - 80
  })
  rect(panel, 30, cmpY + 70, rw - 92, 60, {
    fill: "#FFFFFF",
    stroke: "#CBD5E1",
    radius: 8
  })
  txt(panel, 44, cmpY + 82, "Reply with text, or record a 30-second video answer here.", {
    size: 12,
    color: "#94A3B8",
    width: rw - 124,
    lineHeight: 18
  })
  // Toolbar
  const tb = cmpY + 144
  const tools = ["@ Mention", "✓ Action", "Vid reply", "React"]
  for (let i = 0; i < tools.length; i++) {
    rect(panel, 30 + i * 92, tb, 84, 32, {
      fill: "#FFFFFF",
      stroke: "#CBD5E1",
      radius: 16
    })
    txt(panel, 30 + i * 92, tb + 9, tools[i], {
      size: 10,
      style: "Medium",
      color: "#0F172A",
      width: 84,
      align: "CENTER"
    })
  }
  btn(panel, rw - 110, tb, 80, 32, "Post", { variant: "primary", size: 12 })
})(F["C-07"])

// ===== C-08 Comments Inbox =====
;(function (f) {
  sidebar(f, SCREEN_H, "C-08")
  const main = rect(f, 240, 0, SCREEN_W - 240, SCREEN_H, { fill: "#F8FAFC", transparent: true })
  topbar(main, SCREEN_W - 240, "Comments inbox", "5 mentions • 2 replies • 3 unwatched-by-me")

  // Tab bar with counts
  const tabs = [
    ["Mentions", "5", true],
    ["Replies", "2", false],
    ["Unwatched by me", "3", false]
  ]
  let tx = 32
  for (let i = 0; i < tabs.length; i++) {
    const active = tabs[i][2]
    const w = tabs[i][0].length * 7 + 60
    rect(main, tx, 96, w, 36, {
      fill: active ? "#0F172A" : "#FFFFFF",
      stroke: active ? "#0F172A" : "#E2E8F0",
      radius: 18
    })
    txt(main, tx, 107, tabs[i][0], {
      size: 12,
      style: "Medium",
      color: active ? "#FFFFFF" : "#475569",
      width: w - 28,
      align: "CENTER"
    })
    rect(main, tx + w - 30, 104, 22, 18, {
      fill: active ? "#FFFFFF" : "#F1F5F9",
      radius: 9
    })
    txt(main, tx + w - 30, 105, tabs[i][1], {
      size: 11,
      style: "Bold",
      color: active ? "#0F172A" : "#475569",
      width: 22,
      align: "CENTER"
    })
    tx += w + 8
  }

  // Filter row
  txt(main, SCREEN_W - 240 - 220, 102, "Mark all as read", {
    size: 12,
    color: "#0D9488",
    style: "Medium",
    width: 120
  })
  rect(main, SCREEN_W - 240 - 100, 100, 80, 28, {
    fill: "#FFFFFF",
    stroke: "#E2E8F0",
    radius: 6
  })
  txt(main, SCREEN_W - 240 - 90, 107, "Filter", { size: 12, color: "#475569", width: 60 })
  rect(main, SCREEN_W - 240 - 36, 113, 8, 2, { fill: "#94A3B8" })
  rect(main, SCREEN_W - 240 - 32, 111, 2, 6, { fill: "#94A3B8" })

  // Comment list
  const items = [
    ["Sora", "Mentioned you in Q4 roadmap walkthrough", "@Mika this section makes sense — should we add a beat on retention?", "@01:48", "Spec", "12m ago", true],
    ["Ren", "Replied to your comment on Customer demo: Acme Corp", "Great catch. Let me re-shoot the second half with the new pricing.", "@03:20", "Demo", "1h ago", true],
    ["Sora", "Mentioned you in PR walkthrough #4521", "Pushed the fix — replay this part to see the diff in action.", "@02:14", "Engineering", "3h ago", false],
    ["HR", "Posted in All-hands: hiring update", "Heads up — please watch by EOD Friday so we can decide.", "—", "All-hands", "4h ago", false],
    ["Ren", "Mentioned you in Frontend sync (async)", "Pinging here so this doesn't get lost in Slack.", "@04:02", "Sync", "6h ago", false]
  ]
  let ly = 160
  for (let i = 0; i < items.length; i++) {
    const isNew = items[i][6]
    const item = rect(main, 32, ly, SCREEN_W - 240 - 64, 96, {
      fill: "#FFFFFF",
      stroke: "#E2E8F0",
      radius: 10
    })
    if (isNew) {
      rect(item, 0, 0, 4, 96, { fill: "#0D9488", radius: 2 })
    }
    avatar(item, 24, 24, 40, items[i][0])
    txt(item, 76, 16, items[i][0] + " · " + items[i][5], {
      size: 12,
      style: "SemiBold",
      color: "#0F172A",
      width: 320
    })
    txt(item, 76, 34, items[i][1], {
      size: 11,
      color: "#64748B",
      width: SCREEN_W - 240 - 200
    })
    txt(item, 76, 56, items[i][2], {
      size: 12,
      style: "Medium",
      color: "#0F172A",
      width: SCREEN_W - 240 - 200,
      lineHeight: 18
    })
    if (items[i][3] !== "—") badge(item, 76, 78, items[i][3], { variant: "info" })
    badge(item, 144, 78, items[i][4], { variant: "default" })
    btn(item, SCREEN_W - 240 - 64 - 200, 32, 80, 32, "Open", { variant: "secondary", size: 11 })
    btn(item, SCREEN_W - 240 - 64 - 110, 32, 90, 32, "Resolve", { variant: "primary", size: 11 })
    ly += 108
  }
})(F["C-08"])

// ===== C-09 Analytics Dashboard =====
;(function (f) {
  sidebar(f, SCREEN_H, "C-09")
  const main = rect(f, 240, 0, SCREEN_W - 240, SCREEN_H, { fill: "#F8FAFC", transparent: true })
  topbar(main, SCREEN_W - 240, "Viewing operations", "Last 14 days · Workspace-wide")

  // Filter / period bar
  const fy = 96
  const periods = ["7d", "14d", "30d", "Custom"]
  let px = 32
  for (let i = 0; i < periods.length; i++) {
    const active = i === 1
    rect(main, px, fy, 60, 32, {
      fill: active ? "#0F172A" : "#FFFFFF",
      stroke: "#E2E8F0",
      radius: 6
    })
    txt(main, px, fy + 9, periods[i], {
      size: 12,
      style: "Medium",
      color: active ? "#FFFFFF" : "#475569",
      width: 60,
      align: "CENTER"
    })
    px += 68
  }
  const drops = [["Team", 80], ["Tag", 80], ["Audience", 100]]
  let dx = px + 16
  for (const [lbl, w0] of drops) {
    rect(main, dx, fy, w0, 32, { fill: "#FFFFFF", stroke: "#E2E8F0", radius: 6 })
    txt(main, dx + 10, fy + 9, lbl, { size: 12, color: "#475569", width: w0 - 24 })
    rect(main, dx + w0 - 18, fy + 14, 8, 2, { fill: "#94A3B8" })
    rect(main, dx + w0 - 14, fy + 12, 2, 6, { fill: "#94A3B8" })
    dx += w0 + 8
  }
  btn(main, SCREEN_W - 240 - 144, fy, 112, 32, "Export CSV", { variant: "secondary", size: 12 })

  // KPI cards row 4
  const kpis = [
    ["Avg watch rate", "73%", "+8% vs prev", "success"],
    ["Videos published", "48", "+12 vs prev", "info"],
    ["Unwatched (critical)", "9", "-3 vs prev", "warning"],
    ["Reminders sent", "21", "Auto by Workflows", "default"]
  ]
  const kw = (SCREEN_W - 240 - 80) / 4
  for (let i = 0; i < kpis.length; i++) {
    const kx = 32 + i * (kw + 16)
    rect(main, kx, 152, kw, 112, {
      fill: "#FFFFFF",
      radius: 12,
      stroke: "#E2E8F0"
    })
    txt(main, kx + 20, 168, kpis[i][0], {
      size: 11,
      style: "Medium",
      color: "#64748B",
      width: kw - 40
    })
    txt(main, kx + 20, 188, kpis[i][1], {
      size: 28,
      style: "Bold",
      color: "#0F172A",
      width: kw - 40,
      family: "Inter"
    })
    badge(main, kx + 20, 232, kpis[i][2], { variant: kpis[i][3] })
  }

  // Main chart left
  const cy = 290
  const chartW = (SCREEN_W - 240 - 64) * 0.62 - 8
  rect(main, 32, cy, chartW, 340, {
    fill: "#FFFFFF",
    radius: 12,
    stroke: "#E2E8F0"
  })
  txt(main, 56, cy + 24, "Watch rate by day", {
    size: 14,
    style: "SemiBold",
    color: "#0F172A",
    width: 300
  })
  txt(main, 56, cy + 44, "Avg time-to-first-view: 4h 12m", {
    size: 11,
    color: "#64748B",
    width: 320
  })
  // Chart area mock — bars
  const baseY = cy + 280
  const bw = (chartW - 80) / 14
  for (let i = 0; i < 14; i++) {
    const h = 60 + Math.round((Math.sin(i * 0.7) + 1) * 60 + (i % 3) * 12)
    rect(main, 56 + i * bw, baseY - h, bw - 4, h, {
      fill: i >= 11 ? "#0D9488" : "#A7F3D0",
      radius: 4
    })
  }
  txt(main, 56, baseY + 8, "Apr 1", { size: 10, color: "#94A3B8", width: 60 })
  txt(main, chartW - 60, baseY + 8, "Today", { size: 10, color: "#94A3B8", width: 60 })

  // Right side: unwatched list
  const ux = 32 + chartW + 16
  const uw = SCREEN_W - 240 - ux - 32
  rect(main, ux, cy, uw, 340, {
    fill: "#FFFFFF",
    radius: 12,
    stroke: "#E2E8F0"
  })
  txt(main, ux + 24, cy + 24, "Critical: still unwatched", {
    size: 14,
    style: "SemiBold",
    color: "#0F172A",
    width: uw - 48
  })
  txt(main, ux + 24, cy + 44, "Tagged All-hands or Spec • > 24h old", {
    size: 11,
    color: "#64748B",
    width: uw - 48
  })
  const unw = [
    ["Q4 roadmap walkthrough", "6/14 unwatched", "12h"],
    ["All-hands hiring update", "13/80 unwatched", "26h"],
    ["Sprint review — Frontend", "2/12 unwatched", "8h"]
  ]
  let uy = cy + 80
  for (const r of unw) {
    rect(main, ux + 16, uy, uw - 32, 64, {
      fill: "#F8FAFC",
      radius: 8
    })
    txt(main, ux + 28, uy + 12, r[0], {
      size: 12,
      style: "SemiBold",
      color: "#0F172A",
      width: uw - 60
    })
    txt(main, ux + 28, uy + 30, r[1] + " · last reminder " + r[2] + " ago", {
      size: 11,
      color: "#64748B",
      width: uw - 200
    })
    btn(main, ux + uw - 132, uy + 16, 100, 32, "Remind now", {
      variant: "primary",
      size: 11
    })
    uy += 76
  }

  // Bottom row: team comparison heatmap
  const hy = 654
  rect(main, 32, hy, SCREEN_W - 240 - 64, 196, {
    fill: "#FFFFFF",
    radius: 12,
    stroke: "#E2E8F0"
  })
  txt(main, 56, hy + 20, "Watch rate by team × week", {
    size: 14,
    style: "SemiBold",
    color: "#0F172A",
    width: 300
  })
  // Heatmap
  const teams = ["Frontend", "Backend", "Design", "PM", "CS", "HR"]
  const cell = 36
  for (let r = 0; r < teams.length; r++) {
    txt(main, 56, hy + 64 + r * cell, teams[r], {
      size: 11,
      color: "#475569",
      width: 80
    })
    for (let c = 0; c < 14; c++) {
      const v = (Math.sin(r + c * 0.3) + 1) / 2
      const intensity = Math.round(v * 200) + 50
      const hex = "#" + (12 + intensity).toString(16).padStart(2, "0") + "9488"
      rect(main, 140 + c * cell, hy + 60 + r * cell, cell - 4, cell - 4, {
        fill: v > 0.7 ? "#0D9488" : v > 0.4 ? "#5EEAD4" : "#CCFBF1",
        radius: 4
      })
    }
  }
})(F["C-09"])

// ===== C-10 Analytics/VideoDetail =====
;(function (f) {
  sidebar(f, SCREEN_H, "C-09")
  const main = rect(f, 240, 0, SCREEN_W - 240, SCREEN_H, { fill: "#F8FAFC", transparent: true })
  topbar(main, SCREEN_W - 240, "Q4 roadmap walkthrough", "Analytics · 5 min 13s · Published 12h ago")

  // Left: video preview + drop-off chart
  const lw = (SCREEN_W - 240 - 64) * 0.6
  // Video preview small
  videoThumb(main, 32, 96, lw, 320, "Q4 roadmap walkthrough", {
    thumbFill: "#0F766E",
    duration: "5:13"
  })

  // Drop-off chart below
  rect(main, 32, 432, lw, 320, {
    fill: "#FFFFFF",
    radius: 12,
    stroke: "#E2E8F0"
  })
  txt(main, 56, 452, "Drop-off & engagement timeline", {
    size: 14,
    style: "SemiBold",
    color: "#0F172A",
    width: 320
  })
  txt(main, 56, 472, "Where viewers leave, where they re-watch", {
    size: 11,
    color: "#64748B",
    width: 320
  })

  // chart
  const chBaseY = 700
  const chXs = lw - 80
  // baseline 100% line
  rect(main, 56, chBaseY - 200, chXs, 1, { fill: "#E2E8F0" })
  txt(main, 56, chBaseY - 210, "100%", { size: 9, color: "#94A3B8", width: 30 })
  txt(main, 56, chBaseY - 110, "50%", { size: 9, color: "#94A3B8", width: 30 })
  rect(main, 56, chBaseY - 100, chXs, 1, { fill: "#E2E8F0" })
  // area chart points (drop-off curve)
  const points = [200, 198, 195, 188, 175, 162, 158, 150, 142, 138, 135, 110, 92, 78, 65]
  // draw bars approx
  const stepW = chXs / points.length
  for (let i = 0; i < points.length; i++) {
    rect(main, 56 + i * stepW, chBaseY - points[i], stepW - 2, points[i], {
      fill: i < 8 ? "#0D9488" : "#F59E0B",
      radius: 2,
      fillOpacity: 0.85
    })
  }
  txt(main, 56, chBaseY + 8, "0:00", { size: 9, color: "#94A3B8", width: 30 })
  txt(main, 56 + chXs - 30, chBaseY + 8, "5:13", { size: 9, color: "#94A3B8", width: 30 })
  badge(main, 56, chBaseY + 24, "Drop-off spike at 03:42 — chapter Migration steps", { variant: "warning", width: 360 })

  // Right: viewer list
  const rx = 32 + lw + 16
  const rw = SCREEN_W - 240 - rx - 32
  rect(main, rx, 96, rw, 656, {
    fill: "#FFFFFF",
    radius: 12,
    stroke: "#E2E8F0"
  })
  txt(main, rx + 24, 116, "Viewer log", {
    size: 14,
    style: "SemiBold",
    color: "#0F172A",
    width: rw - 48
  })
  txt(main, rx + 24, 136, "14 viewers across team Frontend & PM", {
    size: 11,
    color: "#64748B",
    width: rw - 48
  })
  // Header row
  rect(main, rx + 16, 168, rw - 32, 32, {
    fill: "#F8FAFC",
    radius: 6
  })
  txt(main, rx + 28, 178, "Viewer", {
    size: 10,
    style: "SemiBold",
    color: "#64748B",
    width: 120
  })
  txt(main, rx + 180, 178, "Progress", {
    size: 10,
    style: "SemiBold",
    color: "#64748B",
    width: 120
  })
  txt(main, rx + rw - 90, 178, "Status",
    {
      size: 10,
      style: "SemiBold",
      color: "#64748B",
      width: 80,
      align: "RIGHT"
    })

  const viewers = [
    ["Sora", 100, "Replied"],
    ["Ren", 88, "Watching"],
    ["Aoi", 75, "Watching"],
    ["Kenta", 60, "Paused"],
    ["Yui", 45, "Dropped"],
    ["Daichi", 30, "Dropped"],
    ["Hiroshi", 12, "Skimmed"],
    ["Naomi", 0, "Not started"],
    ["Riko", 0, "Not started"],
    ["Toshiya", 0, "Not started"]
  ]
  for (let i = 0; i < viewers.length; i++) {
    const y = 212 + i * 44
    avatar(main, rx + 20, y - 2, 28, viewers[i][0])
    txt(main, rx + 56, y, viewers[i][0], {
      size: 12,
      style: "Medium",
      color: "#0F172A",
      width: 120
    })
    // progress bar
    rect(main, rx + 180, y + 6, 160, 8, { fill: "#F1F5F9", radius: 4 })
    rect(main, rx + 180, y + 6, Math.round(160 * viewers[i][1] / 100), 8, {
      fill: viewers[i][1] === 0 ? "#CBD5E1" : viewers[i][1] < 50 ? "#F59E0B" : "#0D9488",
      radius: 4
    })
    txt(main, rx + 350, y + 2, viewers[i][1] + "%", {
      size: 11,
      color: "#475569",
      width: 40,
      family: "Inter"
    })
    const vrn = viewers[i][2] === "Not started" ? "warning" : viewers[i][2] === "Replied" ? "success" : "default"
    badge(main, rx + rw - 110, y + 2, viewers[i][2], { variant: vrn })
  }
})(F["C-10"])

// ===== C-11 Workflows =====
;(function (f) {
  sidebar(f, SCREEN_H, "C-11")
  const main = rect(f, 240, 0, SCREEN_W - 240, SCREEN_H, { fill: "#F8FAFC", transparent: true })
  topbar(main, SCREEN_W - 240, "Workflows", "Automate where videos go and who gets reminded")

  // Header CTA
  btn(main, SCREEN_W - 240 - 184, 96, 152, 36, "+ New workflow", {
    variant: "primary",
    size: 13,
    weight: "Medium"
  })

  // Tabs
  const tabs = ["Active (4)", "Paused (1)", "All (7)"]
  let tx = 32
  for (let i = 0; i < tabs.length; i++) {
    const active = i === 0
    const w = tabs[i].length * 7 + 20
    txt(main, tx, 102, tabs[i], {
      size: 13,
      style: active ? "SemiBold" : "Regular",
      color: active ? "#0D9488" : "#64748B",
      width: w
    })
    if (active) rect(main, tx, 124, w - 4, 2, { fill: "#0D9488" })
    tx += w + 20
  }

  // Workflow rows
  const rows = [
    ["All-hands auto-post", "tag = All-hands → Post to #announcements + Slack DM exec team", "Triggered 12× this month", true],
    ["Spec unwatched reminder", "tag = Spec AND > 24h since publish AND unwatched → DM reminder", "Triggered 8×", true],
    ["Customer demo follow-up", "External share viewed > 60% → assign CSM follow-up task in Linear", "Triggered 5×", true],
    ["Async standup digest", "Every Mon 09:00 JST → Bundle prev week standups → Post to #engineering", "Triggered weekly", true],
    ["Bug repro to triage", "tag = Bug AND keyword = repro → Create Linear issue in Triage", "Paused (2 errors)", false]
  ]
  let ly = 152
  for (let i = 0; i < rows.length; i++) {
    const item = rect(main, 32, ly, SCREEN_W - 240 - 64, 100, {
      fill: "#FFFFFF",
      stroke: "#E2E8F0",
      radius: 10
    })
    // Toggle
    rect(item, 24, 24, 44, 24, {
      fill: rows[i][3] ? "#0D9488" : "#CBD5E1",
      radius: 12
    })
    rect(item, rows[i][3] ? 46 : 26, 26, 20, 20, {
      fill: "#FFFFFF",
      radius: 10
    })
    txt(item, 88, 20, rows[i][0], {
      size: 14,
      style: "SemiBold",
      color: "#0F172A",
      width: 400
    })
    txt(item, 88, 42, rows[i][1], {
      size: 11,
      color: "#475569",
      width: SCREEN_W - 240 - 64 - 320,
      family: "Inter"
    })
    badge(item, 88, 66, rows[i][2], { variant: rows[i][3] ? "success" : "warning" })
    btn(item, SCREEN_W - 240 - 64 - 200, 32, 90, 32, "Edit", { variant: "secondary", size: 12 })
    btn(item, SCREEN_W - 240 - 64 - 100, 32, 80, 32, "Run", { variant: "primary", size: 12 })
    ly += 112
  }
})(F["C-11"])

// ===== C-12 Workflow Editor =====
;(function (f) {
  sidebar(f, SCREEN_H, "C-11")
  const main = rect(f, 240, 0, SCREEN_W - 240, SCREEN_H, { fill: "#F8FAFC", transparent: true })
  topbar(main, SCREEN_W - 240, "Edit workflow: All-hands auto-post", "Last edited by Mika · 2 days ago")

  // Action row
  const ay = 96
  btn(main, 32, ay, 110, 32, "Test run", { variant: "secondary", size: 12 })
  btn(main, 150, ay, 110, 32, "Save draft", { variant: "secondary", size: 12 })
  btn(main, SCREEN_W - 240 - 184, ay, 152, 32, "Publish & enable", {
    variant: "primary",
    size: 12,
    weight: "Medium"
  })

  // Canvas nodes vertical
  const cx = Math.round((SCREEN_W - 240 - 600) / 2)
  const nw = 600
  // Trigger node
  rect(main, cx, 160, nw, 120, {
    fill: "#FFFFFF",
    stroke: "#0D9488",
    radius: 12,
    strokeWeight: 2
  })
  badge(main, cx + 20, 176, "TRIGGER", { variant: "info" })
  txt(main, cx + 20, 204, "When a video is published with tag", {
    size: 13,
    color: "#0F172A",
    width: nw - 40
  })
  rect(main, cx + 20, 226, 140, 36, {
    fill: "#ECFEFF",
    stroke: "#0D9488",
    radius: 8
  })
  txt(main, cx + 20, 236, "🏷  All-hands", {
    size: 12,
    style: "Medium",
    color: "#0D9488",
    width: 140,
    align: "CENTER"
  })

  // Connector
  rect(main, Math.round(cx + nw / 2 - 2), 280, 4, 28, { fill: "#0D9488" })
  rect(main, Math.round(cx + nw / 2 - 12), 296, 24, 24, {
    fill: "#0D9488",
    radius: 12
  })
  txt(main, Math.round(cx + nw / 2 - 12), 300, "+", {
    size: 16,
    style: "Bold",
    color: "#FFFFFF",
    width: 24,
    align: "CENTER"
  })

  // Condition node
  rect(main, cx, 332, nw, 100, {
    fill: "#FFFFFF",
    stroke: "#F59E0B",
    radius: 12,
    strokeWeight: 2
  })
  badge(main, cx + 20, 348, "IF", { variant: "warning" })
  txt(main, cx + 20, 376, "Recorder is in", {
    size: 12,
    color: "#475569",
    width: nw - 40
  })
  rect(main, cx + 20, 396, 200, 28, {
    fill: "#FEF9C3",
    radius: 6
  })
  txt(main, cx + 20, 402, "Group: Leadership team",
    {
      size: 11,
      style: "Medium",
      color: "#A16207",
      width: 200,
      align: "CENTER"
    })

  rect(main, Math.round(cx + nw / 2 - 2), 432, 4, 28, { fill: "#0D9488" })

  // Action node 1
  rect(main, cx, 484, nw, 124, {
    fill: "#FFFFFF",
    stroke: "#7C3AED",
    radius: 12,
    strokeWeight: 2
  })
  badge(main, cx + 20, 500, "THEN", { variant: "new" })
  txt(main, cx + 20, 528, "Post to Slack channel", {
    size: 13,
    color: "#0F172A",
    width: nw - 40
  })
  rect(main, cx + 20, 552, 200, 36, {
    fill: "#F3E8FF",
    radius: 8
  })
  txt(main, cx + 32, 562, "# announcements", {
    size: 12,
    style: "Medium",
    color: "#7C3AED",
    width: 180
  })
  rect(main, cx + 230, 552, 240, 36, {
    fill: "#F8FAFC",
    stroke: "#E2E8F0",
    radius: 8
  })
  txt(main, cx + 244, 562, "Message: New all-hands video…", {
    size: 12,
    color: "#475569",
    width: 220
  })

  rect(main, Math.round(cx + nw / 2 - 2), 608, 4, 28, { fill: "#0D9488" })

  // Action node 2
  rect(main, cx, 644, nw, 100, {
    fill: "#FFFFFF",
    stroke: "#7C3AED",
    radius: 12,
    strokeWeight: 2
  })
  badge(main, cx + 20, 660, "AND", { variant: "new" })
  txt(main, cx + 20, 688, "Schedule reminder", {
    size: 13,
    color: "#0F172A",
    width: nw - 40
  })
  rect(main, cx + 20, 710, 280, 24, {
    fill: "#F3E8FF",
    radius: 6
  })
  txt(main, cx + 20, 714, "If unwatched in 24h → DM viewer", {
    size: 11,
    style: "Medium",
    color: "#7C3AED",
    width: 280,
    align: "CENTER"
  })

  // Side help
  rect(main, 32, 160, 240, 320, {
    fill: "#0F172A",
    radius: 12
  })
  txt(main, 56, 180, "Workflow tips", {
    size: 13,
    style: "SemiBold",
    color: "#FFFFFF",
    width: 200
  })
  txt(main, 56, 204, "Triggers fire when a video is published or watched. Use conditions to scope by team, tag, or audience.", {
    size: 11,
    color: "#94A3B8",
    width: 200,
    lineHeight: 18
  })
  rect(main, 56, 308, 184, 32, {
    fill: "#1E293B",
    radius: 8
  })
  txt(main, 56, 316, "Browse templates →", {
    size: 12,
    style: "Medium",
    color: "#FFFFFF",
    width: 184,
    align: "CENTER"
  })
})(F["C-12"])

// ===== C-13 External Shares =====
;(function (f) {
  sidebar(f, SCREEN_H, "C-13")
  const main = rect(f, 240, 0, SCREEN_W - 240, SCREEN_H, { fill: "#F8FAFC", transparent: true })
  topbar(main, SCREEN_W - 240, "External shares", "Audiences, links, and lead capture across 23 active shares")

  // Top row of share metrics
  const kpis = [
    ["Active shares", "23", "info"],
    ["Total external views", "847", "success"],
    ["Avg watch (ext)", "62%", "success"],
    ["Leads captured", "31", "new"]
  ]
  const kw = (SCREEN_W - 240 - 80) / 4
  for (let i = 0; i < kpis.length; i++) {
    const kx = 32 + i * (kw + 16)
    rect(main, kx, 96, kw, 92, {
      fill: "#FFFFFF",
      radius: 12,
      stroke: "#E2E8F0"
    })
    txt(main, kx + 20, 112, kpis[i][0], {
      size: 11,
      color: "#64748B",
      width: kw - 40
    })
    txt(main, kx + 20, 132, kpis[i][1], {
      size: 24,
      style: "Bold",
      color: "#0F172A",
      width: kw - 40,
      family: "Inter"
    })
    badge(main, kx + 20, 168, "this month", { variant: kpis[i][2] })
  }

  // Filter + CTA
  txt(main, 32, 216, "Active shares", {
    size: 16,
    style: "SemiBold",
    color: "#0F172A",
    width: 200
  })
  btn(main, SCREEN_W - 240 - 184, 210, 152, 32, "+ New share link", {
    variant: "primary",
    size: 12,
    weight: "Medium"
  })

  // Table
  const tY = 252
  rect(main, 32, tY, SCREEN_W - 240 - 64, 40, {
    fill: "#F1F5F9",
    radius: 8
  })
  const cols = ["Video", "Audience", "Access", "Views", "Watch %", "Leads", "Created"]
  const colXs = [48, 380, 540, 680, 800, 920, 1040]
  for (let i = 0; i < cols.length; i++) {
    txt(main, colXs[i], tY + 12, cols[i], {
      size: 11,
      style: "SemiBold",
      color: "#475569",
      width: 120
    })
  }

  const shares = [
    ["Customer demo: Acme Corp", "acme.com domain", "Magic link", "32", "78%", "4", "2 days ago", "success"],
    ["Pricing walkthrough Q3", "Public + form", "Password", "147", "62%", "12", "8 days ago", "info"],
    ["Onboarding kickoff: Zora", "zora.com domain", "Magic link", "12", "91%", "2", "1 week ago", "success"],
    ["Tutorial: API auth", "Public", "No auth", "421", "44%", "8", "3 weeks ago", "warning"],
    ["Demo: integrations", "yamato.jp domain", "Magic link", "18", "67%", "3", "1 month ago", "info"],
    ["Renewal pitch: Globex", "globex.com domain", "Password", "9", "82%", "1", "1 month ago", "success"]
  ]
  for (let i = 0; i < shares.length; i++) {
    const ry = tY + 56 + i * 60
    rect(main, 32, ry, SCREEN_W - 240 - 64, 52, {
      fill: "#FFFFFF",
      stroke: "#E2E8F0",
      radius: 8
    })
    // Video col
    rect(main, 48, ry + 12, 28, 20, {
      fill: ["#0F766E", "#7C3AED", "#DB2777", "#F59E0B", "#1E40AF", "#059669"][i],
      radius: 4
    })
    txt(main, 84, ry + 6, shares[i][0], {
      size: 12,
      style: "SemiBold",
      color: "#0F172A",
      width: 280
    })
    txt(main, 84, ry + 24, "5 min · " + ["spec", "demo", "onboarding", "tutorial", "demo", "pitch"][i], {
      size: 10,
      color: "#94A3B8",
      width: 280
    })
    // Other columns
    txt(main, colXs[1], ry + 16, shares[i][1], {
      size: 11,
      color: "#475569",
      width: 140
    })
    badge(main, colXs[2], ry + 14, shares[i][2], { variant: "default" })
    txt(main, colXs[3], ry + 16, shares[i][3], {
      size: 12,
      style: "Medium",
      color: "#0F172A",
      width: 60,
      family: "Inter"
    })
    // Watch %
    rect(main, colXs[4], ry + 20, 80, 6, { fill: "#F1F5F9", radius: 3 })
    rect(main, colXs[4], ry + 20, parseInt(shares[i][4]) * 80 / 100, 6, {
      fill: parseInt(shares[i][4]) > 60 ? "#0D9488" : "#F59E0B",
      radius: 3
    })
    txt(main, colXs[4], ry + 30, shares[i][4], {
      size: 10,
      color: "#475569",
      width: 60,
      family: "Inter"
    })
    badge(main, colXs[5], ry + 14, shares[i][5] + " leads", { variant: shares[i][7] })
    txt(main, colXs[6], ry + 16, shares[i][6], {
      size: 11,
      color: "#64748B",
      width: 100
    })
  }
})(F["C-13"])

// ===== C-14 External Share Detail =====
;(function (f) {
  sidebar(f, SCREEN_H, "C-13")
  const main = rect(f, 240, 0, SCREEN_W - 240, SCREEN_H, { fill: "#F8FAFC", transparent: true })
  topbar(main, SCREEN_W - 240, "Customer demo: Acme Corp", "Share details · 32 views · 4 leads captured")

  // Left: video + share settings
  const lw = (SCREEN_W - 240 - 64) * 0.55
  // Video small
  videoThumb(main, 32, 96, lw, 280, "Customer demo: Acme Corp", {
    thumbFill: "#7C3AED",
    duration: "8:21"
  })

  // Share settings card
  rect(main, 32, 392, lw, 360, {
    fill: "#FFFFFF",
    radius: 12,
    stroke: "#E2E8F0"
  })
  txt(main, 56, 412, "Share settings", {
    size: 14,
    style: "SemiBold",
    color: "#0F172A",
    width: 200
  })

  // Magic link row
  txt(main, 56, 444, "Magic link", {
    size: 11,
    style: "Medium",
    color: "#64748B",
    width: 200
  })
  rect(main, 56, 462, lw - 200, 40, {
    fill: "#F8FAFC",
    stroke: "#CBD5E1",
    radius: 8
  })
  txt(main, 72, 474, "https://replay.app/s/acme-demo-q4-2bf91", {
    size: 12,
    color: "#0F172A",
    family: "Inter",
    width: lw - 240
  })
  btn(main, lw - 132, 462, 100, 40, "Copy", { variant: "secondary", size: 12 })

  // Access toggles
  const tg = [
    ["Domain allowlist", "acme.com", true],
    ["Require email", "Capture viewer email before play", true],
    ["Lead capture form", "After 30s playback", true],
    ["Watermark viewer email", "Embed dynamic email on video", false]
  ]
  let ty = 524
  for (const [name, sub, on] of tg) {
    rect(main, 56, ty, lw - 80, 48, {
      fill: "#F8FAFC",
      radius: 8
    })
    txt(main, 72, ty + 8, name, {
      size: 12,
      style: "Medium",
      color: "#0F172A",
      width: lw - 200
    })
    txt(main, 72, ty + 26, sub, {
      size: 11,
      color: "#64748B",
      width: lw - 200
    })
    rect(main, lw - 120, ty + 12, 40, 22, {
      fill: on ? "#0D9488" : "#CBD5E1",
      radius: 11
    })
    rect(main, on ? lw - 100 : lw - 116, ty + 14, 18, 18, {
      fill: "#FFFFFF",
      radius: 9
    })
    ty += 56
  }

  // Right: viewer log + leads
  const rx = 32 + lw + 16
  const rw = SCREEN_W - 240 - rx - 32
  rect(main, rx, 96, rw, SCREEN_H - 132, {
    fill: "#FFFFFF",
    radius: 12,
    stroke: "#E2E8F0"
  })
  txt(main, rx + 24, 116, "Viewer & lead log", {
    size: 14,
    style: "SemiBold",
    color: "#0F172A",
    width: rw - 48
  })
  txt(main, rx + 24, 136, "Last activity 12 minutes ago", {
    size: 11,
    color: "#64748B",
    width: rw - 48
  })

  const viewers = [
    ["jenny.acme@acme.com", "Watched 100%", "Submitted form", "12m", "success"],
    ["sales.lead@acme.com", "Watched 78%", "Marked interested", "2h", "info"],
    ["pm@acme.com", "Watched 92%", "Replied with question", "5h", "success"],
    ["marketing@acme.com", "Watched 45%", "—", "1d", "default"],
    ["billing@acme.com", "Watched 62%", "Submitted form", "1d", "success"],
    ["eng@acme.com", "Watched 30%", "—", "2d", "default"],
    ["ops@acme.com", "Watched 12%", "—", "2d", "warning"],
    ["security@acme.com", "Watched 100%", "Submitted form", "3d", "success"]
  ]
  for (let i = 0; i < viewers.length; i++) {
    const y = 172 + i * 64
    rect(main, rx + 16, y, rw - 32, 56, {
      fill: "#F8FAFC",
      radius: 8
    })
    avatar(main, rx + 28, y + 12, 32, viewers[i][0])
    txt(main, rx + 70, y + 10, viewers[i][0], {
      size: 12,
      style: "Medium",
      color: "#0F172A",
      width: rw - 100
    })
    txt(main, rx + 70, y + 28, viewers[i][1] + " · " + viewers[i][3] + " ago", {
      size: 10,
      color: "#64748B",
      width: rw - 200
    })
    badge(main, rx + rw - 174, y + 18, viewers[i][2], { variant: viewers[i][4] })
  }
})(F["C-14"])

// ===== C-15 Search =====
;(function (f) {
  sidebar(f, SCREEN_H, "C-15")
  const main = rect(f, 240, 0, SCREEN_W - 240, SCREEN_H, { fill: "#F8FAFC", transparent: true })
  topbar(main, SCREEN_W - 240, "Search", "Across transcript, title, tag, person, time")

  // Big search box
  const sb = rect(main, 32, 96, SCREEN_W - 240 - 64, 56, {
    fill: "#FFFFFF",
    stroke: "#0D9488",
    radius: 12,
    strokeWeight: 2
  })
  iconBox(sb, 14, 18, 24, "#0D9488", "Q", { radius: 12 })
  txt(sb, 50, 12, "v2 migration", {
    size: 18,
    style: "Medium",
    color: "#0F172A",
    width: 600
  })
  txt(sb, 64, 34, "Showing transcript matches & video titles", {
    size: 11,
    color: "#64748B",
    width: 400
  })
  // facet pills right
  badge(sb, SCREEN_W - 240 - 64 - 110, 18, "Last 30 days", { variant: "default" })
  badge(sb, SCREEN_W - 240 - 64 - 220, 18, "All tags", { variant: "default" })

  // Filter row
  const fy = 168
  txt(main, 32, fy, "Filter by", { size: 11, style: "Medium", color: "#64748B", width: 80 })
  const filters = ["People (12)", "Tags (8)", "Time (3)", "Audience (4)", "Channels (5)"]
  let fx = 112
  for (const fl of filters) {
    const w = fl.length * 7 + 24
    rect(main, fx, fy - 6, w, 28, {
      fill: "#FFFFFF",
      stroke: "#E2E8F0",
      radius: 14
    })
    txt(main, fx, fy + 2, fl, {
      size: 11,
      color: "#475569",
      width: w,
      align: "CENTER"
    })
    fx += w + 8
  }

  // Results
  const results = [
    ["Q4 roadmap walkthrough", "Mika · 12h", "Spec", "01:48", "If we ship the v2 migration without these guardrails…"],
    ["Sprint review — Frontend", "Sora · 1d", "Sprint", "03:22", "…the v2 migration is unblocking that work this sprint…"],
    ["Bug repro: upload stall", "Sora · 2d", "Bug", "00:48", "Reproduced only on v2 migration branch, see steps below."],
    ["Frontend sync (async)", "Mika · 3d", "Sync", "02:12", "Let's debate v2 migration order before standup tomorrow."],
    ["Design review — Auth flow", "Mika · 5d", "Design", "04:30", "Note: post-v2 migration, the auth diff is what we discussed."]
  ]
  let ry = 220
  for (const [title, owner, tag, ts, snippet] of results) {
    rect(main, 32, ry, SCREEN_W - 240 - 64, 96, {
      fill: "#FFFFFF",
      stroke: "#E2E8F0",
      radius: 10
    })
    // thumbnail
    rect(main, 48, ry + 16, 96, 64, { fill: "#0F766E", radius: 6 })
    rect(main, Math.round(48 + (96 - 28) / 2), Math.round(ry + 16 + (64 - 28) / 2), 28, 28, {
      fill: "#FFFFFF",
      radius: 14
    })
    txt(main, Math.round(48 + (96 - 28) / 2), Math.round(ry + 16 + (64 - 28) / 2) + 6, "▶", {
      size: 12,
      style: "Bold",
      color: "#0D9488",
      width: 28,
      align: "CENTER"
    })

    txt(main, 168, ry + 16, title, {
      size: 13,
      style: "SemiBold",
      color: "#0F172A",
      width: SCREEN_W - 240 - 200
    })
    txt(main, 168, ry + 36, owner, {
      size: 11,
      color: "#64748B",
      width: 200
    })
    badge(main, 268, ry + 34, tag, { variant: "default" })
    badge(main, 326, ry + 34, "@" + ts, { variant: "info" })

    // Snippet with highlight
    txt(main, 168, ry + 58, snippet, {
      size: 12,
      color: "#0F172A",
      width: SCREEN_W - 240 - 64 - 200,
      lineHeight: 18
    })
    btn(main, SCREEN_W - 240 - 64 - 132, ry + 32, 100, 32, "Jump to", {
      variant: "primary",
      size: 11
    })
    ry += 108
  }
})(F["C-15"])

// ===== Verification (walk-fix removed: appendChild → resize → x/y order eliminates need) =====
console.log("Done. Screens:", figma.currentPage.children.length)
