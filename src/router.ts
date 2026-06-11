import { createRouter, createWebHistory } from 'vue-router'

import { useAuthStore } from '@/app/auth/store'

// 認証必須 path の prefix list。 未ログイン時にこの path 群へアクセスすると LP へ
// 強制 redirect し、 returnTo クエリでログイン成功後に元の path へ戻す。
//   /dashboard          - 個人ダッシュボード
//   /boards             - ボード一覧
//   /notifications      - 通知一覧
//   /teams              - チーム一覧
//   /team/:id           - 個別チーム + settings
//   /account            - アカウント設定
//   /admin              - 管理画面
//   /board/:id          - 編集画面 (招待リンク経由でも認証は必須、 招待 token 自体は
//                         /invite/:token がログインまで保持して beforeEach guard は通る)
//   /board/:id/settings - ボード設定
//
// 公開 path: / (LP)、 /demo、 /share/:roomId (room URL 共有)、 /invite/:token (招待入口)、
// /editor (autosave local file 編集の互換 path、 anonymous OK)
const PROTECTED_PATH_PREFIXES = [
  '/dashboard',
  '/boards',
  '/notifications',
  '/teams',
  '/team/',
  '/account',
  '/admin',
  '/board/'
]

function isProtectedPath(path: string): boolean {
  return PROTECTED_PATH_PREFIXES.some((prefix) =>
    prefix.endsWith('/') ? path.startsWith(prefix) : path === prefix || path.startsWith(`${prefix}/`)
  )
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: () => import('./views/LandingView.vue') },
    { path: '/editor', component: () => import('./views/EditorView.vue') },
    { path: '/dashboard', component: () => import('./views/DashboardView.vue') },
    { path: '/admin', component: () => import('./views/AdminView.vue') },
    { path: '/boards', component: () => import('./views/BoardsView.vue') },
    { path: '/notifications', component: () => import('./views/NotificationsView.vue') },
    { path: '/teams', component: () => import('./views/TeamsView.vue') },
    { path: '/team/:id', component: () => import('./views/TeamDetailView.vue') },
    { path: '/team/:id/settings', component: () => import('./views/TeamSettingsView.vue') },
    { path: '/account', component: () => import('./views/AccountView.vue') },
    { path: '/board/:id', component: () => import('./views/EditorView.vue') },
    { path: '/board/:id/settings', component: () => import('./views/BoardSettingsView.vue') },
    { path: '/invite/:token', component: () => import('./views/InviteRedirectView.vue') },
    { path: '/demo', component: () => import('./views/EditorView.vue'), meta: { demo: true } },
    { path: '/share/:roomId', component: () => import('./views/EditorView.vue') }
  ]
})

router.beforeEach(async (to) => {
  if (!isProtectedPath(to.path)) {
    return true
  }

  const auth = useAuthStore()
  // 初回ナビゲーション時は session 取得が未完了の可能性、 init 完了を待つ。
  if (!auth.initialized) {
    await auth.init()
  }

  if (auth.isAuthenticated) {
    return true
  }

  // 未ログインで保護 path へアクセス → LP へ。 returnTo に元の path + query を保持して
  // LP のログインボタンから戻ってこられるようにする (fullPath は ?query も含む)。
  return {
    path: '/',
    query: { returnTo: to.fullPath }
  }
})

export default router
