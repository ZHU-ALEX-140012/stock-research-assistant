<template>
  <div class="page mine-page">
    <RiskTip />
    <div class="page-content">
      <div class="card plain user-card">
        <div class="phone">138****6784</div>
        <div class="muted mt6">手机号仅展示脱敏信息 · 无头像、无签名、无社交入口</div>
      </div>

      <!-- 只留合规要求的三个入口，社区 / 分享 / 邀请 / 带单一律不做 -->
      <div class="card plain menu-list">
        <div v-for="m in MENUS" :key="m.path" class="menu-item" @click="$router.push(m.path)">
          <span>{{ m.name }}</span><span class="arrow">›</span>
        </div>
        <div class="blocked">已屏蔽社区 / 分享 / 邀请 / 带单类入口</div>
      </div>
      <div class="global-tip">V1.0.0 MVP · 本产品不涉及任何证券相关经营活动</div>
    </div>
    <BottomNav active-tab="/mine" />
  </div>
</template>

<script setup>
import RiskTip from '@/components/RiskTip.vue'
import BottomNav from '@/components/BottomNav.vue'

const MENUS = [
  { path: '/report', name: '投研日报' },
  { path: '/logs', name: '操作日志回溯' },
  { path: '/settings', name: '设置' }
]
</script>

<style scoped>
.user-card { margin-top: 24px; }
.user-card .phone { font-size: 20px; font-weight: 700; }
.mt6 { margin-top: 6px; }
.menu-list { padding: 4px 18px; }
.menu-item { height: 56px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--line); font-size: 16px; cursor: pointer; }
.arrow { color: #bfbfbf; }
.blocked { height: 56px; display: flex; align-items: center; font-size: 12px; color: #a8a8a8; }
</style>
