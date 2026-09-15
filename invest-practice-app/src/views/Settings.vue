<template>
  <div class="page settings-page">
    <RiskTip />
    <div class="page-content">
      <div class="backbar" @click="$router.push('/mine')">‹ 返回</div>
      <h2 class="page-title" style="margin-top:4px">设置</h2>

      <div class="card">
        <h3>合规相关</h3>
        <div class="kv"><span>用户协议与风险告知</span><b class="link" @click="$router.push({ path: '/agreement', query: { review: 1 } })">查看</b></div>
        <div class="kv"><span>违规词拦截清单</span><b>{{ BASE11.length }} 项（后台统一挂载）· 前端规则层实装 {{ HARD_COUNT }} 硬词</b></div>
        <div class="kv"><span>合规审核账号（后台）</span><b>已启用，可下架内容/关停Agent</b></div>
        <div class="kv"><span>合规拦截回归测试</span><b class="link" @click="$router.push('/compliance')">进入测试台</b></div>
      </div>

      <div class="card">
        <h3>数据与性能</h3>
        <div class="kv"><span>数据源</span><b>Choice / iFinD 公开版 API</b></div>
        <div class="kv"><span>接口异常兜底</span><b>展示「数据拉取中」，禁止编造</b></div>
        <div class="kv"><span>日志留存</span><b>加密 ≥ 6 个月</b></div>
        <div class="kv"><span>L3 语义层（线上全量触发）</span><b>{{ l3Text }}</b></div>
      </div>

      <button class="btn ghost" style="height:44px;font-size:15px" @click="reset">重置本地模拟数据（Demo 专用）</button>
      <div class="global-tip">后端地址由 dist/config.js 的 API_BASE_URL 控制，改完刷新即生效，无需重新打包</div>
    </div>
    <BottomNav active-tab="/mine" />
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import RiskTip from '@/components/RiskTip.vue'
import BottomNav from '@/components/BottomNav.vue'
import { L1_ENTRIES, L1_SOFT } from '@/compliance/rules'
import { l3, probeL3 } from '@/compliance/l3'
import { L1_BASE_11 } from '@/data/samples'
import { resetAll } from '@/store/account'

/* 《设计方案》拦截清单是 11 个词（后台统一挂载下发），前端规则层在此基础上实装了更多硬词 + SOFT 白名单 */
const BASE11 = L1_BASE_11
const HARD_COUNT = new Set(L1_ENTRIES.map(e => e[0]).filter(w => !L1_SOFT.has(w))).size
const l3Text = computed(() => (l3.available ? '已接入 ' + l3.model : '未接入 · 已降级为规则层'))

onMounted(() => { probeL3() })
function reset () {
  resetAll()
  location.reload()
}
</script>

<style scoped>
.link { color: var(--primary); cursor: pointer; }
</style>
