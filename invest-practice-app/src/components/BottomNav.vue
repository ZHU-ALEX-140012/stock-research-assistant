<template>
  <div class="bottom-nav">
    <div
      v-for="item in navList"
      :key="item.path"
      class="nav-item"
      :class="{ active: isActive(item) }"
      @click="$router.push(item.path)"
    >
      <i class="ico">{{ item.icon }}</i>{{ item.name }}
    </div>
  </div>
</template>

<script setup>
/* 全局底部导航：固定 50px。路由表里首页是 '/'，而组件调用方习惯写 activeTab="/home"，
 * 两者都归一到 tab key 再比高亮；子页面（详情/搜索/日报/日志/设置）由路由 meta.tab 决定归属哪个 tab。 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

defineProps({
  activeTab: { type: String, default: '/home' }
})
const route = useRoute()

const navList = [
  { name: '首页', icon: '⌂', path: '/home', tab: 'home' },
  { name: '虚拟盘', icon: '▤', path: '/virtual', tab: 'virtual' },
  { name: '预警中心', icon: '⚑', path: '/warning', tab: 'warning' },
  { name: '我的', icon: '○', path: '/mine', tab: 'mine' }
]

const minePaths = ['report', 'logs', 'settings', 'mine']
function keyOf (path) {
  const hit = navList.find(n => n.path === path)
  if (hit) return hit.tab
  if (path === '/') return 'home'
  const k = (path || '').replace(/^\//, '') || 'home'
  return minePaths.indexOf(k) >= 0 ? 'mine' : k
}
/* 优先用路由 meta.tab（详情页归首页、日报/日志/设置归我的），没声明 meta 时才按路径推断 */
const currentTab = computed(() => (route.meta && route.meta.tab) || keyOf(route.path))
function isActive (item) { return currentTab.value === item.tab }
</script>

<style scoped>
.bottom-nav {
  width: 100%;
  height: 50px;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  max-width: var(--app-max, 520px);
  margin: 0 auto;
  display: flex;
  background: #fff;
  border-top: 1px solid #eee;
  z-index: 999;
}
.nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  font-size: 14px;
  color: #666;
  cursor: pointer;
}
.nav-item .ico { font-style: normal; font-size: 15px; opacity: .75; }
.nav-item.active {
  color: #1677FF;
  font-weight: bold;
}
</style>
