<template>
  <div class="page stock-detail">
    <RiskTip />
    <div v-if="!stock" class="page-content">
      <h2 class="page-title">标的不存在</h2>
      <div class="backbar" @click="$router.push('/')">‹ 返回首页</div>
    </div>
    <div v-else class="page-content">
      <div class="backbar" @click="$router.push('/')">‹ 返回</div>
      <div class="stock-base">
        <div>
          <div class="nm">{{ stock.name }} {{ stock.code }}</div>
          <div class="muted sub">{{ stock.industry }} · {{ stock.dataSrc }}</div>
        </div>
        <div class="px">
          <div class="vl">{{ stock.price }}</div>
          <div class="muted">最新价（黑色展示）</div>
        </div>
      </div>

      <!-- 三 Agent 卡片竖排堆叠（已拍板），无「综合研判结论」区块 -->
      <div class="card agent-card fade-in">
        <h3>基本面Agent <span class="tag">公开财报整理</span></h3>
        <div class="muted sec">一、最新财报核心财务数据</div>
        <div v-for="f in stock.fin" :key="f[0]" class="kv">
          <span>{{ f[0] }}</span><b>{{ f[1] }} <i class="extra">{{ f[2] }}</i></b>
        </div>
        <div class="muted sec">二、近3个月公开行业利好政策汇总（行业口径，不针对单一标的）</div>
        <div v-for="g in stock.good" :key="g" class="list-line"><i class="dot"></i><span>{{ g }}</span></div>
        <div class="muted sec">三、近3个月公开行业利空政策汇总</div>
        <div v-for="g in stock.bad" :key="g" class="list-line"><i class="dot"></i><span>{{ g }}</span></div>
        <div class="muted sec">四、上市公司最新公告核心事件梳理</div>
        <div v-for="n in stock.notice" :key="n[0]" class="list-line"><i class="dot"></i><span class="dt">{{ n[0] }}</span>&nbsp;{{ n[1] }}</div>
        <div class="agent-foot">内容来自公开财报，无任何投资建议。以上为机器自动整理的公开信息，不构成任何参考依据。</div>
      </div>

      <div class="card agent-card fade-in">
        <h3>技术面Agent <span class="tag">估值统计结果</span></h3>
        <div class="muted sec">一、当前价格对应历史估值分位（百分比统计值）</div>
        <div v-for="p in pctRows" :key="p[0]" class="kv">
          <span>{{ p[0] }}</span><b>{{ p[1] }}%<PctBar :value="p[1]" /></b>
        </div>
        <div class="muted sec">二、当前价格对应近1年波动区间</div>
        <div class="kv"><span>区间上沿 / 下沿</span><b>{{ stock.upper }} / {{ stock.lower }}</b></div>
        <div class="kv"><span>当前价在区间内的统计位置</span><b>{{ posPct }}%</b></div>
        <Sparkline :stock="stock" />
        <div class="muted sec">三、近30日量能变化统计</div>
        <div class="kv"><span>近30日日均成交量</span><b>{{ stock.vol.avg30 }} 万手</b></div>
        <div class="kv"><span>近30日均量 / 前30日均量</span><b>{{ stock.vol.ratio }}</b></div>
        <div class="kv"><span>近30日平均换手率</span><b>{{ stock.vol.turnover }}%</b></div>
        <div class="agent-foot">内容为历史统计结果，无任何投资建议；本卡片不输出「低估/高估」等关联性描述。进度条为单色刻度，红色仅表示历史分位的高低位置，不代表涨跌方向或风险等级。</div>
      </div>

      <div class="card agent-card risk-card fade-in">
        <h3>风控Agent <span class="tag warn-tag">公开风险事件整理</span></h3>
        <div class="st-wrap">
          <span v-if="stock.st" class="st-badge">已自动标记：ST / 其他风险警示</span>
          <span v-else class="muted">ST/*ST 标记：无</span>
        </div>
        <div v-for="r in stock.risks" :key="r[0]" class="kv"><span>{{ r[0] }}</span><b>{{ r[1] }}</b></div>
        <div class="agent-foot">内容来自公开监管公告整理，已自动过滤退市标的；本卡片不对标的安全性作任何绝对化表述。</div>
      </div>

      <div class="card plain">
        <h3>三层合规引擎实测 <span class="tag" :class="l3.available ? 'ok' : 'warn-tag'">{{ l3Tag }}</span></h3>
        <div class="muted" style="margin-bottom:10px">L1 关键词 → L2 句式意图 → L3 语义（LLM，线上全量触发），任一层命中即不回答原问题</div>
        <input v-model="askText" class="input" placeholder="例如：会不会涨（不含任何违规词）" @keyup.enter="submit">
        <button class="btn sm" style="margin-top:12px" :disabled="busy" @click="submit">{{ busy ? (l3.available ? '三层引擎判定中…' : '判定中…') : '提交给Agent' }}</button>
        <div v-if="result" class="ask-out">
          <div class="muted" style="margin-bottom:6px">判定链路</div>
          <div class="chain"><div v-for="c in chain" :key="c.lb"><b>{{ c.lb }}</b>：{{ c.tx }}</div></div>
          <div class="muted out-label">Agent 返回（已过滤）</div>
          <div class="out-text">{{ result.text }}</div>
          <div class="agent-foot">{{ outFoot }}该内容已做合规脱敏，仅供参考。以上为机器自动整理的公开信息，不构成任何参考依据。</div>
        </div>
        <button class="btn ghost sm" style="margin-top:12px" @click="$router.push('/compliance')">
          → {{ SAMPLES.length }} 条样本批量回归测试（100 违规 + 18 放行）
        </button>
      </div>
      <div class="src">数据来源：{{ stock.dataSrc }}，仅供参考</div>
    </div>
    <BottomNav active-tab="/home" />
  </div>
</template>

<script setup>
/* 标的详情：三 Agent 卡片 + 三层合规引擎实测入口。
 * 提问链路的降级逻辑不在本页——@/api/client 把任何 L3 异常归一为 null，@/compliance/engine 退回规则层。 */
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import RiskTip from '@/components/RiskTip.vue'
import BottomNav from '@/components/BottomNav.vue'
import PctBar from '@/components/PctBar.vue'
import Sparkline from '@/components/Sparkline.vue'
import { STOCKS } from '@/data/stocks'
import { SAMPLES } from '@/data/samples'
import { L3_MODES, l3, probeL3 } from '@/compliance/l3'
import { buildChain, runEngine } from '@/compliance/engine'
import { pushLog } from '@/store/account'
import { toast } from '@/store/ui'

const route = useRoute()
const stock = computed(() => STOCKS[route.params.code])
const pctRows = computed(() => {
  const s = stock.value
  return s ? [['近1年', s.pct[0]], ['近3年', s.pct[1]], ['近5年', s.pct[2]]] : []
})
const posPct = computed(() => Math.round((stock.value ? stock.value.pos : 0) * 100))

const l3Tag = computed(() => (l3.available
  ? 'L3 已接入 ' + l3.model + ' · ' + (L3_MODES[l3.mode] || l3.mode).split('（')[0]
  : 'L3 未接入·已降级'))

const askText = ref('')
const busy = ref(false)
const result = ref(null)
const chain = computed(() => (result.value ? buildChain(result.value) : []))
const outFoot = computed(() => {
  const r = result.value
  if (!r) return ''
  return (r.blocked ? '本条已被合规引擎拦截，未向用户输出原始提问对应的任何结论。'
    : (r.l1.hits.length ? '命中关键词，已替换为中性表述。' : '三层均未命中，按原文输出事实数据。'))
})

onMounted(() => { probeL3() })

async function submit () {
  const v = askText.value.trim()
  if (!v) { toast('请输入内容'); return }
  if (!stock.value) return
  busy.value = true
  try {
    const r = await runEngine(v, stock.value)
    result.value = r
    pushLog('合规拦截', `输入「${v}」→ ${r.blocked ? '拦截（' + r.cats.join('、') + '）' : '放行'}；L1命中${r.l1.hits.length}项、L2命中${r.l2.hits.length}项、L3${r.l3 ? r.l3.verdict : 'N/A'}`)
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.stock-base {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--line);
}
.stock-base .nm { font-size: 20px; font-weight: 700; }
.stock-base .sub { margin-top: 4px; }
.stock-base .px { text-align: right; }
.stock-base .vl { font-size: 24px; font-weight: 700; color: var(--text); }
.agent-card { padding: 18px; margin-bottom: 18px; }
.sec { margin: 14px 0 6px; }
.sec:first-of-type { margin-top: 0; }
.extra { font-style: normal; color: #8c8c8c; font-size: 12px; }
.dt { color: #8c8c8c; }
/* 状态标签色：正常=主色蓝、异常=金色告警。不用红/绿表状态（合规校验全局搜红绿会命中） */
.warn-tag { color: #874d00 !important; border-color: #ffe58f !important; }
.tag.ok { color: var(--primary) !important; border-color: #cfe0ff !important; }
.st-wrap { margin-bottom: 10px; }
.ask-out { background: #fcfcfd; border: 1px solid #f0f0f0; border-radius: 10px; padding: 14px; margin-top: 14px; }
.chain { font-size: 12px; line-height: 1.9; color: #595959; }
.out-label { margin: 12px 0 6px; border-top: 1px dashed #e8e8e8; padding-top: 10px; }
.out-text { font-size: 14px; line-height: 1.7; color: var(--text); }
</style>
