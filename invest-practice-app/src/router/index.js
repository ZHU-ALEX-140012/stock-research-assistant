/* 路由表：路径与 name 严格对齐《Vue项目路由配置和npm run build打包的注意事项清单》，
 * 全部用 () => import() 懒加载（打包清单「体积优化」要求），并额外补上合规相关页面。 */
import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import { state } from '@/store/account'

const routes = [
  { path: '/', name: 'Home', component: () => import('@/views/Home.vue'), meta: { tab: 'home' } },
  // 组件文档里 BottomNav 与部分调用写的是 /home，路由表里首页是 /，这里做等价重定向，两种写法都能用
  { path: '/home', redirect: '/' },
  { path: '/search', name: 'SearchPage', component: () => import('@/views/SearchPage.vue'), meta: { tab: 'home' } },
  { path: '/stock/:code', name: 'StockDetail', component: () => import('@/views/StockDetail.vue'), meta: { tab: 'home' } },
  { path: '/virtual', name: 'VirtualDisk', component: () => import('@/views/VirtualDisk.vue'), meta: { tab: 'virtual' } },
  { path: '/warning', name: 'WarningCenter', component: () => import('@/views/WarningCenter.vue'), meta: { tab: 'warning' } },
  { path: '/mine', name: 'Mine', component: () => import('@/views/Mine.vue'), meta: { tab: 'mine' } },
  { path: '/report', name: 'DailyReport', component: () => import('@/views/DailyReport.vue'), meta: { tab: 'mine' } },
  { path: '/logs', name: 'OperationLogs', component: () => import('@/views/OperationLogs.vue'), meta: { tab: 'mine' } },
  { path: '/settings', name: 'Settings', component: () => import('@/views/Settings.vue'), meta: { tab: 'mine' } },
  { path: '/compliance', name: 'ComplianceLab', component: () => import('@/views/ComplianceLab.vue'), meta: { tab: 'home' } },
  // 首次启动强制授权页；meta.free = 不受协议守卫拦截
  { path: '/agreement', name: 'ComplianceAgreement', component: () => import('@/views/ComplianceAgreement.vue'), meta: { free: true } },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

/* 历史模式选择（打包清单两处要求的取舍，与 vite.config.js 里的 base 逻辑是一对）：
 * - 「产物校验」要求直接打开 dist/index.html 不白屏，且静态资源统一用相对路径 ./；
 * - 「部署兼容」说 History 模式要配 Nginx try_files 兜底。
 * 所以默认走 hash 模式：双击、任意子路由刷新、二级目录部署三种场景都不需要服务端改造。
 * 构建时设 VITE_ROUTER_MODE=history 即切到清单里的 createWebHistory(BASE_URL)，
 * 此时 vite 会同步把 base 换成绝对路径（VITE_BASE，默认 '/'），BASE_URL 直接可用。 */
const useHistory = import.meta.env.VITE_ROUTER_MODE === 'history'
const history = useHistory
  ? createWebHistory(import.meta.env.BASE_URL || '/')
  : createWebHashHistory()

const router = createRouter({ history, routes })

/* 合规守卫：未勾选协议不得进入任何主界面，也没有绕过入口（协议页自身与授权页放行） */
router.beforeEach((to) => {
  if (to.meta.free) return true
  if (!state.agreed) return { path: '/agreement', query: { redirect: to.fullPath } }
  return true
})

export default router
