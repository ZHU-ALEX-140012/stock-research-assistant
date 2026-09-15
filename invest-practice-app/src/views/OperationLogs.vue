<template>
  <div class="page logs-page">
    <RiskTip />
    <div class="page-content">
      <div class="backbar" @click="$router.push('/mine')">‹ 返回</div>
      <h2 class="page-title" style="margin-top:4px">操作日志回溯</h2>
      <div class="card">
        <h3>近 7 日记录（当前 {{ logs.length }} 条）</h3>
        <div v-for="(l, i) in logs" :key="i" class="log-item">
          <div class="muted head"><span>{{ l[0] }}</span><span class="kind">{{ l[1] }}</span></div>
          <div class="body">{{ l[2] }}</div>
        </div>
        <button class="btn ghost sm" style="margin-top:14px" @click="exportLogs">导出日志（合规回溯）</button>
        <div class="agent-foot">全部用户操作与每次 Agent 输入输出均加密留存 ≥ 6 个月，支持随时导出用于合规回溯。</div>
      </div>
    </div>
    <BottomNav active-tab="/mine" />
  </div>
</template>

<script setup>
/* 操作日志回溯：合规强制项。用户可查可导，Demo 阶段数据在内存 + localStorage。 */
import RiskTip from '@/components/RiskTip.vue'
import BottomNav from '@/components/BottomNav.vue'
import { logs } from '@/store/account'
import { toast } from '@/store/ui'

function exportLogs () {
  const txt = logs.map(l => l.join(' | ')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' }))
  a.download = 'compliance_log.txt'
  a.click()
  toast('已导出（Demo 演示用）')
}
</script>

<style scoped>
.log-item { border-bottom: 1px solid #f0f0f0; padding: 10px 0; }
.log-item .head { display: flex; justify-content: space-between; }
.log-item .kind { color: var(--primary); }
.log-item .body { font-size: 13px; line-height: 1.6; margin-top: 4px; color: var(--text); }
</style>
