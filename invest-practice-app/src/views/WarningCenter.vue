<template>
  <div class="page warning-center">
    <RiskTip />
    <div class="page-content">
      <h2 class="page-title">预警中心</h2>
      <button class="btn" style="margin-bottom:18px" @click="openCreate">新建预警</button>

      <div class="card plain">
        <h3>已设预警（{{ warnings.length }}）</h3>
        <div v-for="w in warnings" :key="w.id" class="warn-item">
          <div>
            <div class="nm">{{ w.name }} {{ w.code }}</div>
            <div class="muted mt4">条件：{{ w.type }} {{ w.val }}</div>
            <div class="muted mt2">设置于 {{ w.time }}</div>
          </div>
          <div class="rt">
            <span class="chip">{{ w.status }}</span>
            <div class="fire"><button class="btn ghost xs" @click="fire(w)">试触发</button></div>
          </div>
        </div>
        <div v-if="!warnings.length" class="muted empty">暂无预警规则</div>
      </div>

      <div class="card">
        <h3>通知文案固定模板</h3>
        <div class="muted">「你关注的标的【XXXX】触发了你预设的【X条件】，请自行查看详情」</div>
        <div class="agent-foot">仅开放三个可配置项：价格达到X元 / 估值分位达到X% / 近7日公告数量≥X条；无默认推荐规则；系统不推送任何「市场异动」「机会来临」类营销通知。</div>
      </div>
      <div class="global-tip">所有预警推送仅为公开信息提醒，不构成任何操作指引或投资建议</div>
    </div>
    <BottomNav active-tab="/warning" />

    <SheetModal v-if="createOpen" title="新建预警" note="仅开放 3 个可配置项，无默认推荐规则" @close="createOpen = false">
      <div class="field"><label>标的代码</label><input v-model="form.code" class="input" placeholder="600036"></div>
      <div class="field">
        <label>触发条件（三选一）</label>
        <select v-model="form.type" class="input">
          <option v-for="t in TYPES" :key="t" :value="t">{{ t }}</option>
        </select>
      </div>
      <div class="field"><label>阈值</label><input v-model="form.val" class="input" placeholder="如 35.00 元 / 70% / 3 条"></div>
      <div class="row2" style="margin:18px 0 0">
        <button class="btn" style="font-size:15px" @click="save">保存规则</button>
        <button class="btn gray" style="font-size:15px" @click="createOpen = false">取消</button>
      </div>
      <div class="src" style="margin:14px 0 0">触发后仅推送固定模板通知，不附带任何操作引导</div>
    </SheetModal>
  </div>
</template>

<script setup>
/* 预警中心：只存用户自建的阈值规则，条件项仅 3 种；触发后推送固定模板文案，不带任何操作引导。 */
import { computed, reactive, ref } from 'vue'
import RiskTip from '@/components/RiskTip.vue'
import BottomNav from '@/components/BottomNav.vue'
import SheetModal from '@/components/SheetModal.vue'
import { STOCKS } from '@/data/stocks'
import { addWarning, fireWarning, state } from '@/store/account'
import { toast } from '@/store/ui'

const TYPES = ['价格达到', '估值分位达到', '近7日公告数量≥']
const createOpen = ref(false)
const form = reactive({ code: '', type: TYPES[0], val: '' })

const warnings = computed(() => state.warnings.map(w => ({
  ...w, name: STOCKS[w.code] ? STOCKS[w.code].name : ''
})))

function openCreate () {
  form.code = ''
  form.type = TYPES[0]
  form.val = ''
  createOpen.value = true
}
function save () {
  const r = addWarning(form.code.trim(), form.type, form.val)
  toast(r.msg)
  if (r.ok) createOpen.value = false
}
function fire (w) {
  const r = fireWarning(w.id)
  toast(r.msg, 3600)
}
</script>

<style scoped>
.warn-item { min-height: 72px; display: flex; align-items: center; justify-content: space-between; gap: 10px; border-bottom: 1px solid var(--line); }
.warn-item .nm { font-size: 15px; font-weight: 700; }
.warn-item .rt { text-align: right; flex: 0 0 auto; }
.warn-item .chip { margin: 0; }
.fire { margin-top: 8px; }
.mt4 { margin-top: 4px; }
.mt2 { margin-top: 2px; }
.empty { padding: 14px 0; }
</style>
