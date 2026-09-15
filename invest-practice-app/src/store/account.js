/* 账户 / 持仓 / 预警 / 操作日志 的本地状态。
 * 说明：Demo 阶段用 localStorage 模拟服务端留存，接真实后端时把 save/load 换成接口调用即可，
 * 页面只依赖这里导出的 state 与 action，不碰存储细节。
 * 虚拟资金口径（已拍板）：注册发放 100 万，不可充值、不可提现；移除持仓记入流水并影响现金。 */
import { reactive } from 'vue'
import { STOCKS, BASE_LOGS } from '@/data/stocks'

const LS_KEY = 'invest_practice_state_v1'
export const INIT_CAPITAL = 1000000

export const state = reactive({
  agreed: false,
  recent: ['600036', '000651', '601988'],
  positions: [
    { code: '600036', count: 12000, cost: 32.10 },
    { code: '000651', count: 8000, cost: 27.55 }
  ],
  warnings: [
    { id: 1, code: '600036', type: '估值分位达到', val: '70%', status: '未触发', time: '2026-09-11 15:20' },
    { id: 2, code: '000651', type: '价格达到', val: '30.00 元', status: '已触发 1 次', time: '2026-09-10 14:02' }
  ],
  /* 已移除持仓流水：历史持仓胜率的分子分母都来自这里的逐笔记录，而不是人工设定的能力分 */
  closed: [
    { code: '600036', count: 3000, cost: 31.20, exit: 32.05, time: '2026-08-14 10:12' },
    { code: '601988', count: 20000, cost: 3.82, exit: 3.76, time: '2026-08-21 14:35' },
    { code: '000651', count: 4000, cost: 26.40, exit: 27.10, time: '2026-08-27 09:48' },
    { code: '600519', count: 100, cost: 1588.00, exit: 1602.50, time: '2026-09-01 13:20' },
    { code: '601988', count: 15000, cost: 3.95, exit: 3.88, time: '2026-09-03 10:05' },
    { code: '000651', count: 2000, cost: 28.10, exit: 27.62, time: '2026-09-07 15:10' },
    { code: '600036', count: 5000, cost: 31.85, exit: 32.44, time: '2026-09-09 11:02' }
  ]
})

/* 操作日志：全部用户操作与每次 Agent 输入输出都要留存 ≥ 6 个月，这里先在内存里可查可导出 */
export const logs = reactive(BASE_LOGS.slice())

export function fmt (n) {
  return Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
export function nowStr () {
  const d = new Date(), p = x => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
export function pushLog (kind, text) { logs.unshift([nowStr(), kind, text]) }

export function save () {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)) } catch (e) { /* 隐私模式下忽略 */ }
}
export function load () {
  try {
    const s = localStorage.getItem(LS_KEY)
    if (s) Object.assign(state, JSON.parse(s))
  } catch (e) { /* 读不到就用默认值 */ }
  if (!Array.isArray(state.closed)) state.closed = []
  if (!Array.isArray(state.positions)) state.positions = []
}
export function resetAll () {
  try { localStorage.removeItem(LS_KEY) } catch (e) {}
}
load()

/* ---------------- 派生统计：四项统计全部由流水实时算出，无评分、无等级、无同行排名 ---------------- */
/* 已实现盈亏：（移除价 − 成本价）× 股数，必须计入现金，否则移除操作会让总资产失真 */
export function realizedPnl () {
  return (state.closed || []).reduce((s, x) => s + (x.exit - x.cost) * x.count, 0)
}
export function calcAsset () {
  let hold = 0, cost = 0
  state.positions.forEach(p => {
    const s = STOCKS[p.code]
    if (!s) return
    hold += s.price * p.count
    cost += p.cost * p.count
  })
  const cash = Math.max(0, INIT_CAPITAL - cost + realizedPnl())
  const total = cash + hold
  return { hold, cash, cost, total, ret: ((total - INIT_CAPITAL) / INIT_CAPITAL * 100), weight: (cost / INIT_CAPITAL * 100) }
}
/* 账户净值序列：按当前持仓股数逐周重算市值，现金用成本占用还原（近 52 周） */
export function accountSeries () {
  let cost = 0
  state.positions.forEach(p => { cost += p.cost * p.count })
  const cash0 = Math.max(0, INIT_CAPITAL - cost + realizedPnl())
  const seq = []
  for (let i = 0; i < 52; i++) {
    let hold = 0
    state.positions.forEach(p => {
      const s = STOCKS[p.code]
      if (s && s.series[i]) hold += s.series[i] * p.count
    })
    seq.push(cash0 + hold)
  }
  return seq
}
export function maxDrawdown (seq) {
  if (!seq.length) return 0
  let peak = seq[0], dd = 0
  seq.forEach(v => {
    if (v > peak) peak = v
    if (peak > 0) dd = Math.max(dd, (peak - v) / peak)
  })
  return dd * 100
}
/* 胜率可复核：分子分母取自已移除持仓流水 */
export function winRate () {
  const c = state.closed || [], win = c.filter(x => x.exit >= x.cost).length
  return { n: c.length, win, v: c.length ? (win / c.length * 100).toFixed(1) + '%' : '暂无移除记录' }
}
export function statCards () {
  const a = calcAsset(), w = winRate(), dd = maxDrawdown(accountSeries()), pnl = realizedPnl()
  return [
    { lb: '虚拟总资产', vl: fmt(a.total), note: '口径：可用虚拟资金 ' + fmt(a.cash) + '（含已实现盈亏 ' + (pnl >= 0 ? '+' : '') + fmt(pnl) + '）+ 虚拟持仓市值 ' + fmt(a.hold) },
    { lb: '历史持仓胜率', vl: w.v, note: '口径：已移除 ' + w.n + ' 笔中 ' + w.win + ' 笔的移除价≥成本价，为笔数比例而非能力评分' },
    { lb: '最大回撤', vl: dd.toFixed(2) + '%', note: '口径：近 52 周账户净值相对区间最高点的最大跌幅' },
    { lb: '累计虚拟收益率', vl: (a.ret >= 0 ? '+' : '') + a.ret.toFixed(2) + '%', note: '口径：(当前总资产 − 初始发放 ' + fmt(INIT_CAPITAL) + ') ÷ 初始发放' }
  ]
}

/* ---------------- 操作 ---------------- */
export function touchRecent (code) {
  if (!state.recent.includes(code)) state.recent.unshift(code)
  state.recent = state.recent.slice(0, 6)
  save()
}

export function addPosition (code, count) {
  const s = STOCKS[code]
  if (!s) return { ok: false, msg: '未匹配到标的，Demo 内置代码：600036 / 000651 / 601988 / 600519' }
  const n = parseInt(count, 10)
  if (!n || n <= 0) return { ok: false, msg: '请填写有效的持仓数量' }
  const a = calcAsset()
  if (s.price * n > a.cash) {
    return { ok: false, msg: `可用虚拟资金不足：本次需 ${fmt(s.price * n)} 元，当前可用 ${fmt(a.cash)} 元（初始发放 ${fmt(INIT_CAPITAL)} 元，不可充值）` }
  }
  const ex = state.positions.find(p => p.code === code)
  if (ex) {
    const tc = ex.cost * ex.count + s.price * n
    ex.count += n
    ex.cost = tc / ex.count
  } else {
    state.positions.push({ code, count: n, cost: Number(s.price) })
  }
  pushLog('用户操作', `手动添加虚拟持仓：${code} / ${n} 股 / 用户自主提交`)
  save()
  return { ok: true, msg: '已记录你的手动虚拟操作' }
}

export function removePositions (indexes) {
  const idx = [...indexes].sort((a, b) => b - a)
  if (!idx.length) return { ok: false, msg: '请勾选要移除的持仓' }
  idx.forEach(i => {
    const p = state.positions[i], s = STOCKS[p.code]
    state.closed.push({ code: p.code, count: p.count, cost: +p.cost.toFixed(2), exit: +Number(s.price).toFixed(2), time: nowStr() })
    pushLog('用户操作', `手动移除虚拟持仓：${p.code} / ${p.count} 股（已计入胜率流水）`)
    state.positions.splice(i, 1)
  })
  save()
  return { ok: true, msg: '已按你的选择移除虚拟持仓记录' }
}

export function addWarning (code, type, val) {
  const s = STOCKS[code]
  if (!s) return { ok: false, msg: 'Demo 内置代码：600036 / 000651 / 601988 / 600519' }
  const v = String(val).trim()
  if (!v) return { ok: false, msg: '请填写阈值' }
  const unit = v.includes('%') || v.includes('元') || v.includes('条') ? '' : (type === '估值分位达到' ? '%' : type === '价格达到' ? ' 元' : ' 条')
  state.warnings.unshift({ id: Date.now(), code, type, val: v + unit, status: '未触发', time: nowStr() })
  pushLog('用户操作', `新建预警规则：${code} ${type}${v}`)
  save()
  return { ok: true, msg: '预警规则已保存，等待条件命中' }
}

/* 试触发：通知文案固定模板，不附带任何操作引导 */
export function fireWarning (id) {
  const w = state.warnings.find(x => String(x.id) === String(id))
  if (!w) return { ok: false, msg: '未找到该预警规则' }
  const s = STOCKS[w.code]
  w.status = '已触发 ' + (parseInt((w.status.match(/\d+/) || [0])[0], 10) + 1) + ' 次'
  pushLog('系统', `预警触发通知：${w.code} ${w.type}${w.val}`)
  save()
  return { ok: true, msg: `你关注的标的【${s ? s.name : w.code} ${w.code}】触发了你预设的【${w.type}${w.val}】，请自行查看详情` }
}

export function agreeTerms () {
  state.agreed = true
  pushLog('用户操作', '确认《重要风险告知》与用户协议，进入主界面')
  save()
}
