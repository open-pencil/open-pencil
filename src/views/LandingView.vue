<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAuthStore } from '@/app/auth/store'
import { toast } from '@/app/shell/ui'

const year = computed(() => new Date().getFullYear())

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const loggingIn = ref(false)

const returnTo = computed(() => {
  const value = route.query.returnTo
  return typeof value === 'string' && value.startsWith('/') ? value : ''
})

const inviteToken = computed(() => {
  const value = route.query.invite
  return typeof value === 'string' && value.length > 0 ? value : ''
})

const ctaPrimaryLabel = computed(() => {
  if (auth.isAuthenticated) return 'ダッシュボードを開く'
  if (returnTo.value) return 'ログインして招待先を開く'
  return 'Google でログイン'
})

const ctaSecondaryTo = computed(() => {
  if (auth.isAuthenticated) return '/boards'
  return null
})

async function handlePrimaryCta() {
  if (auth.isAuthenticated) {
    // 認証済なら returnTo (or /dashboard) に直接遷移、 invite が付いていれば query で持ち越す
    const target = returnTo.value || '/dashboard'
    void router.push(
      inviteToken.value ? { path: target, query: { invite: inviteToken.value } } : target
    )
    return
  }

  if (loggingIn.value) return
  loggingIn.value = true
  try {
    // returnTo があるとログイン callback でその path に戻す、 無ければ /dashboard
    // 招待 token があれば callback URL の query に保持し、 board 画面側で再検証 / 利用できるようにする
    const callbackURL = new URL(returnTo.value || '/dashboard', window.location.origin)
    if (inviteToken.value && returnTo.value) {
      callbackURL.searchParams.set('invite', inviteToken.value)
    }
    await auth.signInWithGoogle(callbackURL.toString())
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ログインを開始できませんでした'
    toast.error(message)
  } finally {
    loggingIn.value = false
  }
}

const features = [
  {
    title: '.fig と .pen を両方ネイティブ対応',
    body: 'Figma ファイル (.fig) と Pencil ネイティブ形式 (.pen) を直接開いて編集できます。インポートや変換は不要、 .pen は AES 暗号化で機密設計データも安全に管理。'
  },
  {
    title: 'リアルタイム共同編集',
    body: 'WebRTC による P2P 接続。 サーバー不要、 アカウント登録も不要で招待 URL だけで共同編集を始められます。'
  },
  {
    title: 'AI 駆動のデザイン生成',
    body: '任意の LLM (OpenRouter / Anthropic / OpenAI / Google AI) を接続可能。 90 種類以上のツールを搭載し、 仕様書からデザインを自動生成します。'
  },
  {
    title: 'プログラマブルな headless API',
    body: 'inkly CLI、 MCP サーバー、 Figma Plugin API、 Vue SDK を提供。 CI/CD パイプラインや自動化スクリプトに組み込めます。'
  },
  {
    title: '軽量デスクトップアプリ',
    body: '約 7 MB の Tauri v2 アプリ (macOS / Windows / Linux)。 PWA としても動作するためインストール不要でも使えます。'
  },
  {
    title: 'オープンソース',
    body: 'MIT ライセンス。 セルフホスト、 または pencil-editor.fly.dev のホスト版を利用できます。'
  }
]

onMounted(async () => {
  document.body.classList.add('landing-active')
  // LP 直アクセスでも既存セッションを読みに行く。
  // 認証済なら CTA が「ダッシュボードを開く」に切り替わる (auth.init 未呼出だと未ログイン扱い)。
  if (!auth.initialized) {
    try {
      await auth.init()
    } catch {
      // session 取得失敗時は LP を未ログイン状態のまま表示
    }
  }
})

onBeforeUnmount(() => {
  document.body.classList.remove('landing-active')
})
</script>

<template>
  <main class="landing">
    <header class="landing__header">
      <div class="landing__brand">Pencil Editor</div>
      <nav class="landing__nav">
        <a href="https://github.com/cardene777/open-pencil" target="_blank" rel="noopener">GitHub</a>
        <a href="https://inkly.dev" target="_blank" rel="noopener">ドキュメント</a>
        <button
          v-if="!auth.isAuthenticated"
          type="button"
          class="landing__nav-cta"
          data-test-id="landing-nav-login"
          :disabled="loggingIn"
          @click="handlePrimaryCta"
        >
          {{ loggingIn ? 'ログイン中…' : 'ログイン' }}
        </button>
        <router-link
          v-else
          to="/dashboard"
          class="landing__nav-cta"
          data-test-id="landing-nav-dashboard"
        >
          ダッシュボード
        </router-link>
      </nav>
    </header>

    <section class="hero">
      <h1 class="hero__title">
        オープンソースのデザインエディタ<br />
        <span class="hero__accent">.fig と .pen に両対応</span>
      </h1>
      <p class="hero__lead">
        Figma ファイル (.fig) も Pencil ネイティブ形式 (.pen) も直接編集。<br />
        リアルタイムで共同作業し、 AI でデザインを生成。<br />
        すべてオープンソース、 すべてあなたのものに。
      </p>
      <div class="hero__cta">
        <button
          type="button"
          class="btn btn--primary"
          data-test-id="landing-primary-cta"
          :disabled="loggingIn"
          @click="handlePrimaryCta"
        >
          {{ loggingIn ? 'ログイン中…' : ctaPrimaryLabel }}
        </button>
        <router-link
          v-if="ctaSecondaryTo"
          :to="ctaSecondaryTo"
          class="btn btn--ghost"
          data-test-id="landing-secondary-cta"
        >
          ボード一覧
        </router-link>
      </div>
      <p class="hero__formats">
        対応形式 ·
        <code>.fig</code> Figma · <code>.pen</code> Pencil ネイティブ · <code>.svg</code> · <code>.pdf</code> エクスポート
      </p>
    </section>

    <section class="features">
      <h2 class="features__title">機能</h2>
      <div class="features__grid">
        <article v-for="feature in features" :key="feature.title" class="feature">
          <h3 class="feature__title">{{ feature.title }}</h3>
          <p class="feature__body">{{ feature.body }}</p>
        </article>
      </div>
    </section>

    <footer class="landing__footer">
      <p>© {{ year }} Pencil Editor · MIT License</p>
    </footer>
  </main>
</template>

<style scoped>
.landing {
  min-height: 100vh;
  background: linear-gradient(180deg, #0d1017 0%, #161b27 100%);
  color: #e8eaed;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
}

.hero__formats {
  margin: 2rem 0 0;
  font-size: 0.85rem;
  color: rgba(232, 234, 237, 0.5);
}

.hero__formats code {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  padding: 0.15rem 0.5rem;
  margin: 0 0.15rem;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 0.8rem;
  color: rgba(232, 234, 237, 0.85);
}

.landing__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.landing__brand {
  font-weight: 600;
  font-size: 1.1rem;
  letter-spacing: 0.02em;
}

.landing__nav {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.landing__nav a {
  color: rgba(232, 234, 237, 0.7);
  text-decoration: none;
  font-size: 0.9rem;
  transition: color 0.2s;
}

.landing__nav a:hover {
  color: #e8eaed;
}

.landing__nav-cta {
  cursor: pointer;
  background: rgba(124, 140, 255, 0.18);
  border: 1px solid rgba(124, 140, 255, 0.45);
  color: #e8eaed;
  font-size: 0.85rem;
  font-weight: 500;
  padding: 0.45rem 1.1rem;
  border-radius: 8px;
  text-decoration: none;
  transition: background 0.2s, border-color 0.2s, color 0.2s, opacity 0.2s;
  margin-left: 0.5rem;
}

.landing__nav-cta:hover:not(:disabled) {
  background: rgba(124, 140, 255, 0.3);
  border-color: rgba(124, 140, 255, 0.65);
}

.landing__nav-cta:disabled {
  cursor: wait;
  opacity: 0.6;
}

.hero {
  text-align: center;
  padding: 6rem 2rem 5rem;
  max-width: 960px;
  margin: 0 auto;
}

.hero__title,
.hero__lead {
  /* 日本語の自動改行で「デザインエ／ディタ」のような文節途中の改行を防ぐ。
     keep-all は CJK 単語 (デザインエディタ等) を 1 単語として扱い、 半角空白
     と <br> でのみ改行するようになる。 */
  word-break: keep-all;
  overflow-wrap: normal;
  line-break: strict;
}

.hero__title {
  font-size: clamp(2rem, 5vw, 3.5rem);
  font-weight: 700;
  line-height: 1.15;
  margin: 0 0 1.5rem;
  letter-spacing: -0.02em;
}

.hero__accent {
  background: linear-gradient(135deg, #7c8cff 0%, #b08cff 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.hero__lead {
  font-size: clamp(1rem, 2vw, 1.15rem);
  color: rgba(232, 234, 237, 0.7);
  line-height: 1.6;
  margin: 0 0 2.5rem;
}

.hero__cta {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.btn {
  display: inline-flex;
  align-items: center;
  padding: 0.85rem 1.75rem;
  font-size: 1rem;
  font-weight: 500;
  border-radius: 8px;
  text-decoration: none;
  transition: transform 0.15s, background 0.2s, border-color 0.2s;
  border: 1px solid transparent;
}

.btn--primary {
  background: linear-gradient(135deg, #7c8cff 0%, #b08cff 100%);
  color: #0d1017;
}

.btn--primary:hover {
  transform: translateY(-1px);
}

.btn--ghost {
  background: transparent;
  color: #e8eaed;
  border-color: rgba(255, 255, 255, 0.15);
}

.btn--ghost:hover {
  border-color: rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.04);
}

.features {
  max-width: 1100px;
  margin: 0 auto;
  padding: 4rem 2rem 6rem;
}

.features__title {
  font-size: 1.75rem;
  font-weight: 600;
  text-align: center;
  margin: 0 0 3rem;
}

.features__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}

.feature {
  padding: 1.75rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  transition: border-color 0.2s, background 0.2s;
}

.feature:hover {
  border-color: rgba(124, 140, 255, 0.4);
  background: rgba(255, 255, 255, 0.05);
}

.feature__title {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0 0 0.75rem;
  color: #f5f6f7;
}

.feature__body {
  font-size: 0.95rem;
  color: rgba(232, 234, 237, 0.65);
  line-height: 1.55;
  margin: 0;
}

.landing__footer {
  text-align: center;
  padding: 2rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  color: rgba(232, 234, 237, 0.4);
  font-size: 0.85rem;
}
</style>

<style>
/* Landing 表示中だけ overflow: hidden を解除してスクロール可能化。
   app.css の `html, body, #app { overflow: hidden }` は editor canvas を
   全画面 fixed するための強制設定、 LP では縦スクロールが必要なため override。
   html 単独に対しても、 body + #app 全部に対しても完全に上書きする (!important
   は specificity 戦争を避けるため必須)。 user-select も解除して LP 本文の
   コピーを許可、 文字選択でテキストを参照できる状態にする。 */
html:has(body.landing-active),
body.landing-active,
body.landing-active #app {
  overflow: auto !important;
  overflow-y: auto !important;
  height: auto !important;
  min-height: 100vh !important;
  user-select: text !important;
  -webkit-user-select: text !important;
}
</style>
