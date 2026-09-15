<template>
  <div class="page virtual-disk">
    <RiskTip />
    <div class="page-content">
      <h2 class="page-title">虚拟盘</h2>

      <!-- 《设计方案》规定的全部统计项，四项均为可复核的纯数据统计 -->
      <div class="grid2" style="margin-bottom:10px">
        <MetricStat v-for="m in cards" :key="m.lb" :lb="m.lb" :vl="m.vl" :note="m.note" />
      </div>
      <div class="muted desc">
        以上四项是《设计方案》规定的全部统计项，均为可复核的纯数据统计：每项口径已写到卡内，无评分、无等级、无同行排名、不点评交易习惯。持仓成本 {{ fmt(a.cost) }} 元 · 仓位占比 {{ a.weight.toFixed(1) }}%
      </div>

      <div class="row2">
        <button class="btn" style="font-size:14px" @click="addOpen = true">手动添加虚拟持仓</button>
        <button class="btn ghost" style="font-size:14px" @click="openRemove">手动移除虚拟持仓</button>
      </div>

      <div class="card plain">
        <h3>虚拟持仓列表</h3>
        <div v-for="(p, i) in positions" :key="p.code" class="hold-item">
          <div>
            <div class="nm">{{ p.name }} {{ p.code }}</div>
            <div class="muted mt3">{{ p.count }} 股 · 成本 {{ p.cost.toFixed(2) }}</div>
          </div>
          <div class="rt">
            <div class="mv">{{ fmt(p.value) }}</div>
            <div class="muted">虚拟市值（黑色）</div>
          </div>
        </div>
        <div v-if="!positions.length" class="muted empty">当前无虚拟持仓</div>
        <div class="muted cash">可用虚拟资金 {{ fmt(a.cash) }} 元 · 初始发放 {{ fmt(INIT_CAPITAL) }} 元，不可充值、不可提现</div>
      </div>
      <div class="global-tip">所有模拟操作均为用户自主练习行为，本产品不提供任何交易通道与投资建议</div>
    </div>
    <BottomNav active-tab="/virtual" />

    <SheetModal v-if="addOpen" title="手动添加虚拟持仓" note="需用户手动填写并主动提交，系统无任何自动下单与条件单触发逻辑" @close="addOpen = false">
      <div class="field"><label>标的代码</label><input v-model="addCode" class="input" placeholder="600036 / 000651 / 601988 / 600519"></div>
      <div class="field"><label>数量（股）</label><input v-model="addCount" class="input" type="number"></div>
      <div class="row2" style="margin:18px 0 0">
        <button class="btn" style="font-size:15px" @click="doAdd">确认提交</button>
        <button class="btn gray" style="font-size:15px" @click="addOpen = false">取消</button>
      </div>
      <div class="src" style="margin:14px 0 0">提交即视为用户自主操作的虚拟记录，不涉及真实资金</div>
    </SheetModal>

    <SheetModal v-if="rmOpen" title="手动移除虚拟持仓" note="点击即记录一次用户自主操作" @close="rmOpen = false">
      <div class="field">
        <label v-for="(p, i) in positions" :key="p.code" class="rm-row">
          <input v-model="rmIdx" type="checkbox" :value="i">{{ p.name }} {{ p.code }} · {{ p.count }} 股
        </label>
      </div>
      <div class="row2" style="margin:8px 0 0">
        <button class="btn" style="font-size:15px" @click="doRemove">确认移除</button>
        <button class="btn gray" style="font-size:15px" @click="rmOpen = false">取消</button>
      </div>
    </SheetModal>
  </div>
</template>

<script setup>
/* 虚拟盘：只做「用户自主记录的模拟持仓」，无交易通道、无自动下单、无条件单。
 * 四项统计（总资产 / 胜率 / 最大回撤 / 累计虚拟收益率）全部由持仓与移除流水实时算出，见 @/store/account。 */
import { computed, ref } from 'vue'
import RiskTip from '@/components/RiskTip.vue'
import BottomNav from '@/components/BottomNav.vue'
import MetricStat from '@/components/MetricStat.vue'
import SheetModal from '@/components/SheetModal.vue'
import { STOCKS } from '@/data/stocks'
import { INIT_CAPITAL, addPosition, calcAsset, fmt, removePositions, statCards, state } from '@/store/account'
import { toast } from '@/store/ui'

const a = computed(() => calcAsset())
const cards = computed(() => statCards())
const positions = computed(() => state.positions.map(p => {
  const s = STOCKS[p.code]
  return { code: p.code, name: s ? s.name : '', count: p.count, cost: p.cost, value: s ? s.price * p.count : 0 }
}))

const addOpen = ref(false)
const addCode = ref('')
const addCount = ref(100)
const rmOpen = ref(false)
const rmIdx = ref([])

function openRemove () {
  if (!state.positions.length) { toast('当前无虚拟持仓'); return }
  rmIdx.value = []
  rmOpen.value = true
}
function doAdd () {
  const r = addPosition(addCode.value.trim(), addCount.value)
  toast(r.msg)
  if (r.ok) { addOpen.value = false; addCode.value = '' }
}
function doRemove () {
  const r = removePositions(rmIdx.value)
  toast(r.msg)
  if (r.ok) rmOpen.value = false
}
</script>

<style scoped>
.desc { margin: 0 0 18px; }
.hold-item { min-height: 64px; display: flex; align-items: center; justify-content: space-between; gap: 10px; border-bottom: 1px solid var(--line); }
.hold-item .nm { font-size: 15px; font-weight: 700; }
.hold-item .rt { text-align: right; }
.hold-item .mv { font-size: 15px; font-weight: 700; color: var(--text); }
.mt3 { margin-top: 3px; }
.empty { padding: 14px 0; }
.cash { margin-top: 12px; }
.rm-row { display: flex; align-items: center; gap: 10px; padding: 12px 0; border-bottom: 1px solid #f0f0f0; font-size: 15px; color: var(--text); }
.rm-row input { width: 18px; height: 18px; accent-color: var(--primary); }
</style>
