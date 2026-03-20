import { computeAllLayouts } from '@open-pencil/core'
import type { EditorStore } from './stores/editor'
import type { Color, Fill } from '@open-pencil/core'

// ── 색상 팔레트 ──

const WHITE: Color = { r: 1, g: 1, b: 1, a: 1 }
const BLACK: Color = { r: 0, g: 0, b: 0, a: 1 }
const GRAY_50: Color = { r: 0.98, g: 0.98, b: 0.98, a: 1 }
const GRAY_100: Color = { r: 0.96, g: 0.96, b: 0.97, a: 1 }
const GRAY_300: Color = { r: 0.82, g: 0.82, b: 0.84, a: 1 }
const GRAY_500: Color = { r: 0.55, g: 0.55, b: 0.58, a: 1 }
const GRAY_700: Color = { r: 0.35, g: 0.35, b: 0.38, a: 1 }
const GRAY_900: Color = { r: 0.12, g: 0.12, b: 0.14, a: 1 }
const SKY: Color = { r: 0, g: 0.64, b: 1, a: 1 } // #00A3FF
const SKY_DARK: Color = { r: 0, g: 0.5, b: 0.85, a: 1 }
const SKY_LIGHT: Color = { r: 0.9, g: 0.96, b: 1, a: 1 }

// ── 21:9 슬라이드 크기 ──

const W = 1260
const H = 540
const PAD = 60
const CONTENT_W = W - PAD * 2

function solid(color: Color, opacity = 1): Fill {
  return { type: 'SOLID', color, opacity, visible: true }
}

function gradient(from: Color, to: Color): Fill {
  return {
    type: 'GRADIENT_LINEAR',
    color: from,
    opacity: 1,
    visible: true,
    gradientStops: [
      { color: from, position: 0 },
      { color: to, position: 1 },
    ],
    gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
  }
}

// ── 슬라이드 헬퍼 ──

function createSlide(store: EditorStore, index: number, name: string, bg: Fill): string {
  const x = 100
  const y = 100 + index * (H + 80) // 슬라이드 간 80px 간격
  const id = store.createShape('FRAME', x, y, W, H)
  store.graph.updateNode(id, {
    name,
    fills: [bg],
    clipsContent: true,
    cornerRadius: 0,
  })
  return id
}

function addText(
  store: EditorStore,
  parentId: string,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  opts: {
    fontSize?: number
    fontWeight?: number
    color?: Color
    letterSpacing?: number
    lineHeight?: number
    name?: string
    hAlign?: 'LEFT' | 'CENTER' | 'RIGHT'
    vAlign?: 'TOP' | 'CENTER' | 'BOTTOM'
  } = {},
): string {
  const id = store.createShape('TEXT', x, y, w, h, parentId)
  store.graph.updateNode(id, {
    name: opts.name ?? text.slice(0, 20),
    text,
    fontSize: opts.fontSize ?? 14,
    fontWeight: opts.fontWeight ?? 400,
    fills: [solid(opts.color ?? BLACK)],
    ...(opts.letterSpacing != null ? { letterSpacing: opts.letterSpacing } : {}),
    ...(opts.lineHeight != null ? { lineHeight: opts.lineHeight } : {}),
    ...(opts.hAlign ? { textAlignHorizontal: opts.hAlign } : {}),
    ...(opts.vAlign ? { textAlignVertical: opts.vAlign } : {}),
  })
  return id
}

function addRect(
  store: EditorStore,
  parentId: string,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: Fill,
  cornerRadius = 0,
): string {
  const id = store.createShape('RECTANGLE', x, y, w, h, parentId)
  store.graph.updateNode(id, { fills: [fill], cornerRadius })
  return id
}

// ── 메인 ──

export function createCareerNoteTemplate(store: EditorStore) {
  // ━━━ 1. 커버 ━━━
  const cover = createSlide(store, 0, '01 커버', gradient(SKY, SKY_DARK))

  // 좌측 텍스트
  addText(store, cover, PAD, 120, 600, 20, 'PORTFOLIO', {
    fontSize: 13, fontWeight: 600, color: { r: 1, g: 1, b: 1, a: 0.6 }, letterSpacing: 4,
  })
  addText(store, cover, PAD, 160, 600, 60, '홍길동', {
    fontSize: 52, fontWeight: 700, color: WHITE, name: '이름',
  })
  addText(store, cover, PAD, 240, 600, 32, '프론트엔드 개발자', {
    fontSize: 24, fontWeight: 500, color: { r: 1, g: 1, b: 1, a: 0.85 }, name: '직무',
  })
  addText(store, cover, PAD, 300, 400, 20, 'hong@email.com  ·  010-1234-5678', {
    fontSize: 14, fontWeight: 400, color: { r: 1, g: 1, b: 1, a: 0.6 }, name: '연락처',
  })

  // 우측 장식 원
  const circleId = store.createShape('ELLIPSE', 900, 120, 300, 300, cover)
  store.graph.updateNode(circleId, {
    name: 'Deco Circle',
    fills: [solid({ r: 1, g: 1, b: 1, a: 0.08 })],
  })
  const circleId2 = store.createShape('ELLIPSE', 980, 200, 200, 200, cover)
  store.graph.updateNode(circleId2, {
    name: 'Deco Circle Inner',
    fills: [solid({ r: 1, g: 1, b: 1, a: 0.06 })],
  })

  // 하단 라인
  addRect(store, cover, PAD, H - 60, 100, 3, solid(WHITE), 2)

  // ━━━ 2. 프로필 ━━━
  const profile = createSlide(store, 1, '02 프로필', solid(WHITE))

  addText(store, profile, PAD, 50, 200, 20, 'PROFILE', {
    fontSize: 12, fontWeight: 700, color: SKY, letterSpacing: 3,
  })
  addRect(store, profile, PAD, 78, 40, 3, solid(SKY), 2)

  // 좌측: 기본 정보
  addText(store, profile, PAD, 110, 500, 36, '홍길동', {
    fontSize: 28, fontWeight: 700, color: GRAY_900, name: '이름',
  })
  addText(store, profile, PAD, 160, 500, 22, '프론트엔드 개발자  ·  3년차', {
    fontSize: 16, fontWeight: 500, color: GRAY_500, name: '직무/경력',
  })

  // 정보 항목들
  const infoItems = [
    { label: '이메일', value: 'hong@email.com' },
    { label: '연락처', value: '010-1234-5678' },
    { label: '학력', value: '경희대학교 컴퓨터공학과 (졸업)' },
    { label: 'GitHub', value: 'github.com/hong' },
  ]
  for (let i = 0; i < infoItems.length; i++) {
    const y = 210 + i * 36
    addText(store, profile, PAD, y, 100, 18, infoItems[i].label, {
      fontSize: 12, fontWeight: 600, color: GRAY_500,
    })
    addText(store, profile, PAD + 110, y, 400, 18, infoItems[i].value, {
      fontSize: 13, fontWeight: 400, color: GRAY_700,
    })
  }

  // 우측: 스킬 태그
  addText(store, profile, 700, 110, 200, 20, 'SKILLS', {
    fontSize: 12, fontWeight: 700, color: SKY, letterSpacing: 3,
  })
  const skills = ['React', 'TypeScript', 'Next.js', 'Node.js', 'Python']
  for (let i = 0; i < skills.length; i++) {
    const tagX = 700 + (i % 3) * 130
    const tagY = 150 + Math.floor(i / 3) * 44
    const tagId = store.createShape('FRAME', tagX, tagY, 120, 34, profile)
    store.graph.updateNode(tagId, {
      name: skills[i],
      cornerRadius: 17,
      fills: [solid(SKY_LIGHT)],
    })
    addText(store, tagId, 0, 0, 120, 34, skills[i], {
      fontSize: 13, fontWeight: 600, color: SKY, name: skills[i],
      hAlign: 'CENTER', vAlign: 'CENTER',
    })
  }

  // 하단 구분선
  addRect(store, profile, PAD, H - 40, CONTENT_W, 1, solid(GRAY_100))

  // ━━━ 3. 인사이트 ━━━
  const insight = createSlide(store, 2, '03 인사이트', solid(GRAY_50))

  addText(store, insight, PAD, 50, 200, 20, 'INSIGHT', {
    fontSize: 12, fontWeight: 700, color: SKY, letterSpacing: 3,
  })
  addRect(store, insight, PAD, 78, 40, 3, solid(SKY), 2)

  addText(store, insight, PAD, 110, CONTENT_W, 36, '"사용자 경험을 최우선으로 생각합니다"', {
    fontSize: 26, fontWeight: 700, color: GRAY_900, name: '인사이트 타이틀',
  })

  addText(store, insight, PAD, 170, CONTENT_W, 80, '서비스의 가치를 사용자에게 전달하는 과정에서 기술은 수단이라고 생각합니다. React와 TypeScript를 활용한 컴포넌트 설계, 성능 최적화, 접근성 개선 등을 통해 사용자가 느끼는 서비스의 품질을 높이는 데 집중해왔습니다. 데이터 기반의 의사결정과 빠른 실험을 통해 서비스를 지속적으로 성장시키는 것을 좋아합니다.', {
    fontSize: 14, fontWeight: 400, color: GRAY_700, lineHeight: 26, name: '인사이트 본문',
  })

  // 핵심 가치 3개
  const values = [
    { title: '사용자 중심', desc: '기술보다 사용자 경험을\n먼저 생각합니다', icon: 'U' },
    { title: '데이터 기반', desc: '가설과 데이터로\n의사결정합니다', icon: 'D' },
    { title: '지속적 성장', desc: '빠른 실험과 개선을\n반복합니다', icon: 'G' },
  ]
  for (let i = 0; i < values.length; i++) {
    const vx = PAD + i * 380
    const cardId = store.createShape('FRAME', vx, 310, 350, 170, insight)
    store.graph.updateNode(cardId, {
      name: values[i].title,
      cornerRadius: 12,
      fills: [solid(WHITE)],
    })

    // 아이콘 원
    const iconCircle = store.createShape('ELLIPSE', 24, 24, 44, 44, cardId)
    store.graph.updateNode(iconCircle, {
      name: 'Icon BG',
      fills: [solid(SKY_LIGHT)],
    })
    addText(store, cardId, 24, 24, 44, 44, values[i].icon, {
      fontSize: 18, fontWeight: 700, color: SKY,
      hAlign: 'CENTER', vAlign: 'CENTER',
    })

    addText(store, cardId, 84, 28, 240, 22, values[i].title, {
      fontSize: 16, fontWeight: 700, color: GRAY_900,
    })
    addText(store, cardId, 84, 56, 240, 80, values[i].desc, {
      fontSize: 13, fontWeight: 400, color: GRAY_500, lineHeight: 22,
    })
  }

  // ━━━ 4. 활동개요 ━━━
  const overview = createSlide(store, 3, '04 활동개요', solid(WHITE))

  addText(store, overview, PAD, 50, 300, 20, 'ACTIVITY OVERVIEW', {
    fontSize: 12, fontWeight: 700, color: SKY, letterSpacing: 3,
  })
  addRect(store, overview, PAD, 78, 40, 3, solid(SKY), 2)

  addText(store, overview, PAD, 110, CONTENT_W, 30, '주요 활동 및 경험', {
    fontSize: 22, fontWeight: 700, color: GRAY_900,
  })

  // 타임라인 카드 3개
  const activities = [
    {
      period: '2024.04 ~ 현재',
      title: '커리어노트 서비스 개발',
      role: 'PM / 풀스택 개발',
      tags: ['React', 'Next.js', 'NestJS'],
      highlight: 'MAU 15,000명 달성',
    },
    {
      period: '2023.02 ~ 2024.12',
      title: '마이폴리오 웹서비스 운영',
      role: 'COO / 공동대표',
      tags: ['기획', 'Flutter', 'Firebase'],
      highlight: '사용자 3,000명 확보',
    },
    {
      period: '2022.01 ~ 2023.01',
      title: '태평염전 해외영업',
      role: '영업 담당',
      tags: ['B2B', '해외영업', '유통'],
      highlight: 'Vomfass 파트너십',
    },
  ]

  for (let i = 0; i < activities.length; i++) {
    const a = activities[i]
    const cx = PAD + i * 380
    const cardId = store.createShape('FRAME', cx, 170, 360, 310, overview)
    store.graph.updateNode(cardId, {
      name: a.title,
      cornerRadius: 12,
      fills: [solid(GRAY_50)],
    })

    // 기간
    addText(store, cardId, 24, 24, 312, 16, a.period, {
      fontSize: 11, fontWeight: 600, color: SKY,
    })

    // 제목
    addText(store, cardId, 24, 52, 312, 24, a.title, {
      fontSize: 18, fontWeight: 700, color: GRAY_900,
    })

    // 역할
    addText(store, cardId, 24, 86, 312, 18, a.role, {
      fontSize: 13, fontWeight: 500, color: GRAY_500,
    })

    // 구분선
    addRect(store, cardId, 24, 120, 312, 1, solid(GRAY_300))

    // 하이라이트
    const hlBg = store.createShape('FRAME', 24, 140, 312, 44, cardId)
    store.graph.updateNode(hlBg, {
      name: 'Highlight',
      cornerRadius: 8,
      fills: [solid(SKY_LIGHT)],
    })
    addText(store, hlBg, 0, 0, 312, 44, a.highlight, {
      fontSize: 15, fontWeight: 700, color: SKY,
      hAlign: 'CENTER', vAlign: 'CENTER',
    })

    // 태그
    for (let j = 0; j < a.tags.length; j++) {
      const tagId = store.createShape('FRAME', 24 + j * 100, 200, 90, 28, cardId)
      store.graph.updateNode(tagId, {
        name: a.tags[j],
        cornerRadius: 14,
        fills: [solid(WHITE)],
        strokes: [{ color: GRAY_300, weight: 1, opacity: 1, visible: true, align: 'INSIDE' as const }],
      })
      addText(store, tagId, 0, 0, 90, 28, a.tags[j], {
        fontSize: 11, fontWeight: 500, color: GRAY_700,
        hAlign: 'CENTER', vAlign: 'CENTER',
      })
    }
  }

  // ━━━ 5. 활동1 상세 ━━━
  const activity1 = createSlide(store, 4, '05 활동1 - 커리어노트', solid(WHITE))

  addText(store, activity1, PAD, 50, 300, 20, 'ACTIVITY DETAIL', {
    fontSize: 12, fontWeight: 700, color: SKY, letterSpacing: 3,
  })
  addRect(store, activity1, PAD, 78, 40, 3, solid(SKY), 2)

  addText(store, activity1, PAD, 110, 700, 32, '커리어노트 서비스 개발 및 고도화', {
    fontSize: 24, fontWeight: 700, color: GRAY_900, name: '활동 제목',
  })
  addText(store, activity1, PAD, 155, 500, 18, '2024.04 ~ 현재  ·  PM / 풀스택 개발', {
    fontSize: 13, fontWeight: 500, color: GRAY_500,
  })

  // 상세 설명
  addText(store, activity1, PAD, 200, 600, 120,
    'AI 기반 커리어 포트폴리오 빌더 플랫폼을 기획하고 개발을 주도했습니다. 서비스 런칭 3개월 만에 고유 방문자 수 15,000명을 달성하고, 매달 1,200명의 신규 유저를 유치하는 성과를 거두었습니다.\n\n청년창업사관학교 지원기업 약 300개 중 4위로 선정되었으며, 서비스 기획부터 개발, 운영까지 전반적인 사업을 담당했습니다.', {
      fontSize: 13, fontWeight: 400, color: GRAY_700, lineHeight: 24, name: '활동 설명',
    })

  // 우측: 성과 카드
  const metricsFrame = store.createShape('FRAME', 740, 110, 460, 380, activity1)
  store.graph.updateNode(metricsFrame, {
    name: 'Metrics',
    cornerRadius: 16,
    fills: [solid(GRAY_50)],
  })

  addText(store, metricsFrame, 32, 28, 200, 20, 'KEY RESULTS', {
    fontSize: 11, fontWeight: 700, color: SKY, letterSpacing: 2,
  })

  const metrics = [
    { value: '15,000', label: '월 고유 방문자 수' },
    { value: '1,200', label: '월 신규 가입자 수' },
    { value: 'Top 4', label: '창업사관학교 300개 중' },
  ]
  for (let i = 0; i < metrics.length; i++) {
    const my = 70 + i * 100
    addText(store, metricsFrame, 32, my, 300, 44, metrics[i].value, {
      fontSize: 36, fontWeight: 800, color: SKY,
    })
    addText(store, metricsFrame, 32, my + 48, 300, 18, metrics[i].label, {
      fontSize: 13, fontWeight: 400, color: GRAY_500,
    })
    if (i < metrics.length - 1) {
      addRect(store, metricsFrame, 32, my + 80, 396, 1, solid(GRAY_100))
    }
  }

  // ━━━ 6. 엔딩 페이지 ━━━
  const ending = createSlide(store, 5, '06 엔딩', gradient(GRAY_900, BLACK))

  addText(store, ending, PAD, 150, CONTENT_W, 20, 'THANK YOU', {
    fontSize: 13, fontWeight: 600, color: { r: 1, g: 1, b: 1, a: 0.4 }, letterSpacing: 6,
  })
  addText(store, ending, PAD, 190, CONTENT_W, 60, '함께 만들어갈 기회를\n기다리고 있습니다', {
    fontSize: 40, fontWeight: 700, color: WHITE, lineHeight: 56, name: '엔딩 메시지',
  })

  // 연락처 정보
  addRect(store, ending, PAD, 320, 200, 1, solid({ r: 1, g: 1, b: 1, a: 0.15 }))

  const contacts = [
    'hong@email.com',
    '010-1234-5678',
    'github.com/hong',
  ]
  for (let i = 0; i < contacts.length; i++) {
    addText(store, ending, PAD, 340 + i * 30, 400, 20, contacts[i], {
      fontSize: 14, fontWeight: 400, color: { r: 1, g: 1, b: 1, a: 0.6 },
    })
  }

  // CareerNote 브랜딩
  addText(store, ending, W - PAD - 200, H - 60, 200, 16, 'Powered by CareerNote', {
    fontSize: 11, fontWeight: 500, color: { r: 1, g: 1, b: 1, a: 0.25 },
  })

  computeAllLayouts(store.graph)
  store.clearSelection()
}
