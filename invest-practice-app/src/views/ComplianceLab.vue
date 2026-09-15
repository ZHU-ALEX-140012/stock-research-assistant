<template>
  <div class="page compliance-lab">
    <RiskTip />
    <div class="page-content">
      <div class="backbar" @click="$router.push('/')">‹ 返回</div>
      <h2 class="page-title" style="margin-top:4px">合规拦截回归测试</h2>
      <div class="muted head-note">对应《设计方案》上线前 Checklist 第 2 条：模拟输入 100 条违规提问，确认输出全部被拦截并自动脱敏。样本含 {{ shouldN }} 条应拦截 + {{ passN }} 条应放行。</div>

      <div class="card plain">
        <h3>L3 触发策略</h3>
        <select class="input" :value="l3.mode" @change="changeMode">
          <option v-for="(v, k) in L3_MODES" :key="k" :value="k">{{ v }}</option>
        </select>
        <div class="muted policy">
          线上已定为<b>全量触发</b>：每条提问都过 L3，{{ SAMPLES.length }} 条样本 = {{ SAMPLES.length }} 次调用，每条拦截都带语义改写文案，并能在实时链路上发现规则误拦。「按需触发」作为成本兜底保留：同批样本只需对 <b>{{ gated.n }} 条</b>（{{ gated.pct }}%）调 LLM，即全量比按需多花约 <b>{{ (SAMPLES.length / gated.n).toFixed(1) }} 倍</b>调用。两种策略的合并拦截结果相同（任一命中即拦，规则已拦的再调一次不改变判定），差别在开销与改写文案覆盖率。L3 不可用时无论哪种策略都降级为 L1+L2 兜底，不阻断回答。
        </div>
        <div class="muted ops">{{ opsText }}</div>
      </div>

      <div class="card plain">
        <div class="row2">
          <button class="btn" style="font-size:14px" :disabled="busy" @click="runBatch(false)">跑 L1+L2（即时）</button>
          <button class="btn ghost" style="font-size:14px" :disabled="busy" @click="runBatch(true)">加跑 L3 语义</button>
        </div>
        <div class="muted">线上已定全量触发，所以回归测试固定对全部 {{ SAMPLES.length }} 条跑 L3——这条就是线上真实链路；「跑 L1+L2」用于对比成本兜底下的能力差。L3 结果会缓存，重跑秒回。</div>

        <div v-if="busy" class="muted prog">{{ prog }}</div>
        <template v-else-if="rep">
          <div class="grid2 metrics">
            <MetricStat lb="回归样本总数" :vl="rep.s12.total" :note="'应拦截 ' + rep.s12.should + ' 条 / 应放行 ' + (rep.s12.total - rep.s12.should) + ' 条'" />
            <MetricStat lb="L1+L2 拦截率" :vl="rep.s12.caught + '/' + rep.s12.should" :note="rep.s12.rate.toFixed(1) + '% · 误拦 ' + rep.s12.wrong + ' 条'" />
            <MetricStat lb="原方案 11 词基线" :vl="rep.baseN + '/' + rep.s12.should" :note="(rep.baseN / rep.s12.should * 100).toFixed(1) + '% · 仅关键词匹配的结果'" />
            <MetricStat v-if="rep.withL3" lb="含 L3 拦截率" :vl="rep.s123.caught + '/' + rep.s123.should" :note="rep.s123.rate.toFixed(1) + '% · 误拦 ' + rep.s123.wrong + ' 条'" />
            <MetricStat v-if="rep.withL3" lb="L3 单独拦截率" :vl="rep.s3.caught + '/' + rep.s3.should" :note="rep.s3.rate.toFixed(1) + '% · 误拦 ' + rep.s3.wrong + ' 条（不借规则）'" />
            <MetricStat v-if="rep.withL3" lb="仅语义层能拦" :vl="rep.only3.length + ' 条'" note="规则层完全漏网、靠 L3 补上" />
          </div>

          <table class="tbl">
            <tr><th>意图类别</th><th>样本</th><th>L1+L2</th><th>+L3 语义</th></tr>
            <tr v-for="b in rep.byCat" :key="b.c">
              <td>{{ b.name }}</td><td>{{ b.n }}</td><td>{{ b.c12 }}/{{ b.n }}</td>
              <td>{{ rep.withL3 ? b.c123 + '/' + b.n : '—' }}</td>
            </tr>
            <tr>
              <td>无风险事实查询</td><td>{{ rep.r0n }}</td><td>误拦 {{ rep.s12.wrong }}</td>
              <td>{{ rep.withL3 ? '误拦 ' + rep.s123.wrong : '—' }}</td>
            </tr>
          </table>

          <div class="card risk-card">
            <h3 style="font-size:15px">漏网清单（应拦未拦 {{ rep.miss.length }} 条）</h3>
            <template v-if="rep.miss.length">
              <div v-for="m in rep.miss" :key="m.q" class="list-line">
                <i class="dot"></i><b>{{ m.cat }}</b>&nbsp;{{ m.q }}<span class="tail">{{ m.l3 && m.l3.degraded ? 'L3降级' : (m.l3 ? 'L3判为' + m.l3.risk_type : '未跑L3') }}</span>
              </div>
              <div class="agent-foot">这些就是纯关键词方案会直接泄到用户面前的提问，需靠 L2 补充规则或 L3 语义层兼顶。</div>
            </template>
            <div v-else class="muted">当前配置下 0 条漏网。</div>
          </div>

          <div v-if="rep.withL3" class="card">
            <h3 style="font-size:15px">语义层单独漏网（{{ rep.l3miss.length }} 条，由规则层补上）</h3>
            <div v-for="m in rep.l3miss" :key="m.q" class="list-line">
              <i class="dot"></i><b>{{ m.cat }}</b>&nbsp;{{ m.q }}<span class="tail">　L3判为{{ m.l3 ? m.l3.risk_type : '—' }}</span>
            </div>
            <div v-if="!rep.l3miss.length" class="muted">无</div>
            <div class="agent-foot">这说明两层不能互替：语义层会把「它的基本面如何」这类评价问句当作事实查询放行，而规则层能接住；反过来，规则库外的新型变体说法只能靠语义层接住。</div>
          </div>

          <div v-if="rep.withL3 && rep.only3.length" class="card risk-card">
            <h3 style="font-size:15px">仅语义层拦下的 {{ rep.only3.length }} 条（即原方案纯关键词会泄到用户面前的提问）</h3>
            <div v-for="m in rep.only3" :key="m.q" class="list-line">
              <i class="dot"></i><b>{{ m.cat }}</b>&nbsp;{{ m.q }}<span class="tail">　L3：{{ m.l3.risk_type.replace(/^R\d_/g, '') }} / {{ m.l3.reason || '' }}</span>
            </div>
            <div class="agent-foot">这组就是本次扩展的理由：它们不含任何违规词、也不匹配固定句式，只能靠语义层识别。</div>
          </div>

          <div v-if="rep.over.length" class="card">
            <h3 style="font-size:15px">误拦清单（应放被拦 {{ rep.over.length }} 条）</h3>
            <div v-for="m in rep.over" :key="m.q" class="list-line">
              <i class="dot"></i>{{ m.q }}<span class="tail">　命中：{{ m.hard.join('、') }}{{ m.l2c.length ? ' / 意图' + m.l2c.join('、') : '' }}</span>
            </div>
            <div class="agent-foot">误拦会伤体验，需把这些词加入白名单或收紧对应正则。</div>
          </div>

          <button class="btn ghost sm" @click="exportCsv">导出回归报告 CSV</button>
        </template>
      </div>

      <div class="card plain">
        <h3 style="font-size:15px">替换话术表（词级中性化对照 {{ neutralRows.length }} 组 / {{ neutralTotal }} 词）</h3>
        <div class="muted bold">
          词表完整性：L1 词表共 {{ hardWords.length }} 词，其中硬拦截 {{ hardCount }} 词（其余 {{ hardWords.length - hardCount }} 词命中只做词级替换、不拦截）；{{ gap.length ? '缺中性映射 ' + gap.length + ' 个（' + gap.join('、') + '）——这些词命中后原文会漏到输出里，需补映射' : '已全部有中性映射，无漏词' }}。
        </div>
        <div class="muted" style="margin-bottom:8px">改写原则：操作类名词化为「持仓记录」（不再用进入/退出/扩大这类方向动词，否则替换后本身仍是一条指令）；方向类落到「历史区间统计」（不写「处于下沿附近」这类隐含便宜的说法）。</div>
        <div v-for="row in neutralRows" :key="row.cat" class="n-row">
          <span class="n-cat">{{ row.cat }}</span>
          <span class="n-words"><template v-for="(it, i) in row.items" :key="it.w">{{ i ? '　' : '' }}{{ it.w }}→<b>{{ it.to }}</b></template></span>
        </div>
      </div>

      <div class="global-tip">本测试台为合规审核账号视角，不展示给普通用户</div>
    </div>
    <BottomNav active-tab="/home" />
  </div>
</template>

<script setup>
/* 合规拦截回归测试台（审核账号视角）：118 条样本跑线上真实链路。
 * 前端 L1+L2 即时执行，L3 走 @/api/client 的批量接口（20 条/次 + 进度回调）；
 * 任何一条 L3 拿不到结果就按降级计入统计，不影响该条的规则层判定结果。 */
import { computed, onMounted, ref } from 'vue'
import RiskTip from '@/components/RiskTip.vue'
import BottomNav from '@/components/BottomNav.vue'
import MetricStat from '@/components/MetricStat.vue'
import { L1_CATS, L1_ENTRIES, L1_SOFT, NEUTRAL_MAP, neutralGap } from '@/compliance/rules'
import { L3_MODES, L3_TRIGGER, askL3Batch, l3, probeL3, refreshStats, setL3Mode } from '@/compliance/l3'
import { decide } from '@/compliance/engine'
import { L1_BASE_RE, SAMPLES } from '@/data/samples'
import { pushLog } from '@/store/account'
import { toast } from '@/store/ui'

const busy = ref(false)
const prog = ref('')
const BATCH = ref(null)

const shouldN = SAMPLES.filter(s => s.exp === 'BLOCK').length
const passN = SAMPLES.filter(s => s.exp === 'PASS').length

/* 按需触发策略下真正会打到 LLM 的条数：全量比它多花的倍数就是决策成本 */
const gated = computed(() => {
  const n = SAMPLES.filter(s => L3_TRIGGER.test(s.q) && !decide(s.q, null).blocked).length
  return { n, pct: Math.round(n / SAMPLES.length * 100) }
})

const opsText = computed(() => {
  const s = l3.stats
  if (!s) return '后端 L3 观测：未取到 stats，请确认 compliance_server.py 已启动到含降级观测的版本'
  return `后端 L3 观测（全量策略下的主链路健康度）：累计请求 ${s.requests} 条、真正打到 LLM ${s.llm_calls} 次、缓存命中 ${s.cache_hits} 次、降级 ${s.degraded} 条（${(s.degrade_rate * 100).toFixed(1)}%）、连续失败 ${s.fail_streak} 次。告警阈值：降级率超 ${(s.thresholds.ratio * 100).toFixed(0)}% 或连续失败 ${s.thresholds.fail_streak} 次，命中即写 compliance_server.log 与审计流水。当前状态：${s.alert ? '已告警' : '正常'}`
})

function stat (rows, key) {
  const should = rows.filter(r => r.exp === 'BLOCK')
  const caught = should.filter(r => r[key]).length
  const wrong = rows.filter(r => r.exp === 'PASS' && r[key]).length
  return { total: rows.length, should: should.length, caught, rate: should.length ? (caught / should.length * 100) : 0, wrong }
}

const rep = computed(() => {
  if (!BATCH.value) return null
  const rows = BATCH.value.rows
  const withL3 = BATCH.value.withL3
  const s12 = stat(rows, 'b12'), s123 = stat(rows, 'blocked'), s3 = stat(rows, 'l3block')
  const only3 = rows.filter(r => r.exp === 'BLOCK' && !r.b12 && r.l3block)
  return {
    withL3, rows, s12, s123, s3, only3,
    baseN: rows.filter(r => r.exp === 'BLOCK' && L1_BASE_RE.test(r.q)).length,
    miss: rows.filter(r => r.exp === 'BLOCK' && !r.blocked),
    over: rows.filter(r => r.exp === 'PASS' && r.blocked),
    l3miss: rows.filter(r => r.exp === 'BLOCK' && !r.l3block),
    r0n: rows.filter(r => r.cat === 'R0').length,
    byCat: ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7'].map(c => {
      const g = rows.filter(r => r.cat === c)
      return { c, name: L1_CATS[c], n: g.length, c12: g.filter(r => r.b12).length, c123: g.filter(r => r.blocked).length }
    })
  }
})

/* 词级中性化对照：按意图类别归组，并自检有没有硬词缺映射 */
const hardWords = computed(() => [...new Set(L1_ENTRIES.map(e => e[0]))])
/* 硬拦截词 = 词表词去掉 SOFT 白名单（与设置页「前端规则层实装 N 硬词」同一算法） */
const hardCount = computed(() => hardWords.value.filter(w => !L1_SOFT.has(w)).length)
const neutralTotal = Object.keys(NEUTRAL_MAP).length
const gap = computed(() => neutralGap())
const neutralRows = computed(() => {
  const byCat = {}
  Object.keys(NEUTRAL_MAP).forEach(w => {
    const e = L1_ENTRIES.find(x => x[0] === w)
    const c = (e && e[1]) || '其他'
    /* 不用 (byCat[c] = byCat[c] || []).push() 写法：行首是 ( 会被上一行结尾的字符串吃成函数调用（ASI 陷阱） */
    if (!byCat[c]) byCat[c] = []
    byCat[c].push({ w, to: NEUTRAL_MAP[w] })
  })
  return Object.keys(byCat).sort().map(c => ({ cat: L1_CATS[c] || c, items: byCat[c] }))
})

function changeMode (e) {
  setL3Mode(e.target.value)
  toast('已切换：' + L3_MODES[e.target.value])
}

async function runBatch (withL3) {
  busy.value = true
  try {
    const qs = SAMPLES.map(s => s.q)
    let l3items = null
    if (withL3) {
      await probeL3(true)
      if (!l3.available) { toast('L3 未接入：请先执行 python compliance_server.py（' + l3.reason + '）'); return }
      prog.value = 'L3 语义层批量判定中（每批 20 条）…'
      l3items = await askL3Batch(qs, (d, t) => { prog.value = `L3 语义层判定中 ${d}/${t}…` })
    }
    const rows = SAMPLES.map((s, i) => {
      const r3 = l3items ? l3items[i] : null
      const d12 = decide(s.q, null)
      const d = decide(s.q, r3)
      return {
        ...s,
        b12: d12.blocked,
        blocked: d.blocked,
        hard: d.hard,
        l2c: d.cats.filter(c => d12.cats.includes(c)),
        l3: r3,
        l3block: !!(r3 && r3.verdict === 'BLOCK')
      }
    })
    BATCH.value = { rows, withL3 }
    const s = stat(rows, 'blocked')
    pushLog('合规拦截', `执行回归测试：${rows.length} 条，L1+L2 拦截率 ${stat(rows, 'b12').rate.toFixed(1)}%${withL3 ? '，含 L3 ' + s.rate.toFixed(1) + '%' : '（未跑 L3）'}，漏网 ${rows.filter(r => r.exp === 'BLOCK' && !r.blocked).length} 条、误拦 ${s.wrong} 条`)
  } finally {
    busy.value = false
    refreshStats()
  }
}

function exportCsv () {
  const rows = rep.value.rows
  const head = '提问,意图类别,应判定,L1+L2判定,含L3判定,硬关键词,句式意图,L3类别,L3理由\n'
  const body = rows.map(r => [
    '"' + r.q.replace(/"/g, '""') + '"', r.cat, r.exp, r.b12 ? 'BLOCK' : 'PASS', r.blocked ? 'BLOCK' : 'PASS',
    '"' + r.hard.join(' ') + '"', '"' + r.l2c.join(' ') + '"',
    '"' + (r.l3 ? r.l3.risk_type : '') + '"', '"' + (r.l3 ? (r.l3.reason || '') : '') + '"'
  ].join(',')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['\ufeff' + head + body], { type: 'text/csv;charset=utf-8' }))
  a.download = 'compliance_regression_118.csv'
  a.click()
}

onMounted(async () => {
  await probeL3()
  await refreshStats()
})
</script>

<style scoped>
.head-note { margin: -12px 0 14px; }
.policy { margin-top: 8px; }
.ops { margin-top: 6px; }
.prog { margin-top: 10px; }
.metrics { margin: 14px 0 18px; }
.bold { font-weight: 700; margin-bottom: 6px; }
.tail { color: #8c8c8c; }
.tbl { width: 100%; border-collapse: collapse; font-size: 12px; margin: 6px 0 14px; }
.tbl th, .tbl td { border: 1px solid #eee; padding: 7px 8px; text-align: left; color: #434343; }
.tbl th { background: #fafafa; font-weight: 700; color: #262626; }
.n-row { display: flex; gap: 10px; padding: 7px 0; border-bottom: 1px solid #f0f0f0; font-size: 12px; line-height: 1.7; }
.n-cat { flex: 0 0 76px; color: var(--gray); }
.n-words { color: #434343; }
.n-words b { font-weight: 400; }
</style>
