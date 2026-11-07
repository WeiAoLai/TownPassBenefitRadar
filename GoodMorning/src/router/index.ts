import { createRouter, createWebHashHistory } from 'vue-router'
import FeedView from '../views/FeedView.vue'

declare module 'vue-router' {
  interface RouteMeta {
    title: string
    tab?: 'feed' | 'create' | 'rank' | 'me'
    back?: boolean
  }
}

export const router = createRouter({
  // hash 模式：靜態主機與 TownPass WebView 都不需伺服器 rewrite，返回鍵可用
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'feed', component: FeedView, meta: { title: '早安政策圖', tab: 'feed' } },
    {
      path: '/create',
      name: 'create',
      component: () => import('../views/EditorView.vue'),
      meta: { title: '製作長輩圖', tab: 'create' },
    },
    {
      path: '/leaderboard',
      name: 'rank',
      component: () => import('../views/LeaderboardView.vue'),
      meta: { title: '作品排行榜', tab: 'rank' },
    },
    { path: '/me', name: 'me', component: () => import('../views/MeView.vue'), meta: { title: '我的作品', tab: 'me' } },
    {
      path: '/artworks/:id(\\d+)',
      name: 'artwork',
      component: () => import('../views/ArtworkView.vue'),
      meta: { title: '作品', back: true },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: (_to, _from, saved) => saved ?? { top: 0 },
})

router.afterEach((to) => {
  // TownPass 以頁面標題作為 AppBar 標題
  document.title = to.meta.title
})
