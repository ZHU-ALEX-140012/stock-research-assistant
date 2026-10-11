/* 合规三层引擎 · 幻觉溯源（数字对账）
 * 原则：LLM 不得产生任何未在数据上下文中出现过的数字。输出前逐句对账：
 *   句中出现白名单之外的数字 = 无来源句（unsourced）→ 屏蔽/降灰，不进用户可见输出。
 * 纯 ESM 零依赖（不 import vue / stocks.js，白名单由调用方传入），因此
 * 前端 engine.js 与 Node 评测脚本 eval/run_trace_eval.mjs 共用这一份实现，指标即线上行为。 */

/* 数值 token：整数/小数/千分位；日期单独抽，避免 "2026-09-09" 被拆成三个数 */
const DATE_RE = /\d{4}-\d{1,2}-\d{1,2}/g
const NUM_RE = /-?\d[\d,]*(?:\.\d+)?/g

/* 归一化：去千分位、去尾零（32.80 == 32.8），失败返回 null */
export function normNum (raw) {
  const s = String(raw).replace(/,/g, '')
  const n = Number(s)
  return Number.isFinite(n) ? String(n) : null
}

/* 从一段文本抽出全部数值声明（日期与数字都算） */
export function extractClaims (text) {
  const out = []
  let m
  DATE_RE.lastIndex = 0
  const dates = []
  while ((m = DATE_RE.exec(text)) !== null) dates.push({ raw: m[0], kind: 'date', val: m[0] })
  const noDate = text.replace(DATE_RE, ' ')
  NUM_RE.lastIndex = 0
  while ((m = NUM_RE.exec(noDate)) !== null) {
    const val = normNum(m[0])
    if (val !== null) out.push({ raw: m[0], kind: 'num', val })
  }
  return out.concat(dates)
}

/* 白名单：深扫数据上下文（股票对象/日报对象/任意嵌套字符串），
 * 把其中出现过的每个数字和日期登记在案，来源路径随附——这就是「可溯源」的实体。 */
export function walkWhitelist (obj, prefix = '') {
  const wl = { numbers: new Map(), dates: new Map() } // val -> 来源路径（多个用 ; 连接）
  const add = (kind, val, src) => {
    const bucket = kind === 'date' ? wl.dates : wl.numbers
    if (!bucket.has(val)) bucket.set(val, src)
    else if (!String(bucket.get(val)).includes(src)) bucket.set(val, bucket.get(val) + ';' + src)
  }
  const walk = (v, path) => {
    if (v == null) return
    if (typeof v === 'number') { add('num', String(v), path); return }
    if (typeof v !== 'object') {
      if (typeof v === 'string') for (const c of extractClaims(v)) add(c.kind === 'date' ? 'date' : 'num', c.val, path)
      return
    }
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, path + '[' + i + ']')); return }
    /* series：未展示的原始曲线浮点，不可被引用，跳过——否则幻觉数字可能撞上曲线尾数的巧合精度 */
    Object.keys(v).forEach(k => { if (k !== 'series') walk(v[k], path ? path + '.' + k : k) })
  }
  walk(obj, prefix)
  /* 结构性窗口数字：来自 factBlock 模板文本本身（「近1年」「近30日」），非数据值，
   * 显式登记并标注来源，避免把模板当作幻觉。要新增窗口词在这里加，别改判定逻辑。 */
  ;[['1', 'template:近1年窗口'], ['30', 'template:近30日窗口'], ['52', 'template:52周区间']].forEach(([v, s]) => add('num', v, s))
  return wl
}

/* 逐句对账：返回每句的数值声明与命中来源；unsourcedTotal>0 即该文本含幻觉数字 */
export function verifyText (text, wl) {
  const sentences = String(text).split(/(?<=[。！？；!?;])|\n/).map(s => s.trim()).filter(Boolean)
  const rows = sentences.map(t => {
    const claims = extractClaims(t).map(c => ({
      ...c,
      sourced: (c.kind === 'date' ? wl.dates : wl.numbers).has(c.val),
      source: (c.kind === 'date' ? wl.dates : wl.numbers).get(c.val) || ''
    }))
    return { t, claims, unsourcedCount: claims.filter(c => !c.sourced).length }
  })
  const claimTotal = rows.reduce((a, r) => a + r.claims.length, 0)
  const unsourcedTotal = rows.reduce((a, r) => a + r.unsourcedCount, 0)
  return { sentences: rows, claimTotal, unsourcedTotal, ratio: claimTotal ? unsourcedTotal / claimTotal : 0 }
}

/* 输出防线：给 engine 用的单点开关。
 * 干净 → 原样放行并附 citations；含无来源数字 → 整段屏蔽（宁可没有改写文案，
 * 也不能让一条幻觉数字借合规引擎之口进入用户可见输出）。 */
export function guardNeutral (text, wl) {
  const v = verifyText(text, wl)
  if (!v.unsourcedTotal) return { ok: true, text, citations: citeClaims(v, wl) }
  return { ok: false, text, citations: citeClaims(v, wl), unsourced: v.sentences.filter(s => s.unsourcedCount).flatMap(s => s.claims.filter(c => !c.sourced)) }
}

/* 事实句的引用信息（claim/value/source），前端「溯源」徽标数据源 */
export function citeClaims (verified, wl) {
  return verified.sentences.flatMap(s => s.claims.filter(c => c.sourced).map(c => ({
    claim: s.t, value: c.kind === 'date' ? c.val : Number(c.val), kind: c.kind, source: c.source
  })))
}

/* 按标的构建白名单（engine 侧常用入口）：单只股票对象即可覆盖 factBlock 的全部数字 */
export function wlFor (stock) {
  return walkWhitelist(stock, String(stock && stock.code || 'ctx'))
}
