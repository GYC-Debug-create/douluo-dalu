import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'title',
    component: () => import('@/pages/TitlePage.vue')
  },
  {
    path: '/create',
    name: 'create',
    component: () => import('@/pages/CreatePage.vue')
  },
  {
    path: '/game',
    name: 'game',
    component: () => import('@/pages/GamePage.vue')
  },
  {
    path: '/map',
    name: 'map',
    component: () => import('@/pages/MapPage.vue')
  },
  {
    path: '/codex',
    name: 'codex',
    component: () => import('@/pages/CodexPage.vue')
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
