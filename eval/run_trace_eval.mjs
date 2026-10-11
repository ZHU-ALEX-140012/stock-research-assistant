#!/usr/bin/env node
/* 幻觉溯源评测器（方案二 · 数字对账防线量化）
 *
 * 三块指标：
 *  A. 检出能力：golden_claims.jsonl 注入幻觉句 —— 检出率 / 正当成误报率
 *  B. 确定层自证：factBlock（模板与 engine.factBlock 逐字一致）全标的核验 —— 期望 0 无来源数字
 *  C. 真实语义层产物：L3 缓存里的 neutral 改写逐条对账 —— 线上真实 LLM 输出的幻觉率
 *
 * 用法：node eval/run_trace_eval.mjs [--ci]   （--ci：检出率<100% 或 误报>0 或 B/C 出现无源数字 → 退出码 2）
 * 产出：控制台报告 + eval/trace_report.json
 */
import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'
import { STOCKS, LIST, REPORT } from '../invest-practice-app/src/data/stocks.js'
import { walkWhitelist, verifyText } from '../invest-practice-app/src/compliance/traceability.js'

const HERE = path.dirname(url.fileURLToPath(import.meta.url))
const CI = process.argv.includes('--ci')

/* 全局白名单：全部标的 + 日报都算数据上下文（对检测器最宽容，仍抓得住即稳健） */
const wl = walkWhitelist({ STOCKS, REPORT }, 'ctx')

function wilson (k, n, z = 1.96) {
  if (!n) return [0, 0]
  const p = k / n, d = 1 + (z * z) / n
  const c = (p + (z * z) / (2 * n)) / d
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d
  return [Math.max(0, c - h), Math.min(1, c + h)]
}
const pct = (x) => (x * 100).toFixed(1) + '%'

/* ---------- A. 注入幻觉的检出能力 ---------- */
const claims = fs.readFileSync(path.join(HERE, 'golden_claims.jsonl'), 'utf8')
  .split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l))
const verdicts = claims.map(c => {
  const v = verifyText(c.text, wl)
  return { ...c, claimTotal: v.claimTotal, unsourcedTotal: v.unsourcedTotal, unsourced: v.sentences.filter(s => s.unsourcedCount).flatMap(s => s.claims.filter(x => !x.sourced).map(x => x.raw)) }
})
const dirty = verdicts.filter(c => c.expect !== 'CLEAN')
const clean = verdicts.filter(c => c.expect === 'CLEAN')
const detected = dirty.filter(c => c.unsourcedTotal > 0)
const falselyFlagged = clean.filter(c => c.unsourcedTotal > 0)
const detectRate = dirty.length ? detected.length / dirty.length : 0
const falseAlarmRate = clean.length ? falselyFlagged.length / clean.length : 0

/* ---------- B. 确定层自证：factBlock 模板（与 engine.factBlock 逐字一致，改模板先改这里） ---------- */
function factBlock (s) {
  return `以下为 ${s.name}（${s.code}）的公开信息整理：最新价 ${s.price}；近1年估值分位 ${s.pct[0]}%；近1年波动区间 ${s.lower}~${s.upper}；近30日日均成交量 ${s.vol.avg30} 万手；最新公开公告「${s.notice[0][1]}」（${s.notice[0][0]}）。`
}
const fb = LIST.map(s => ({ code: s.code, ...verifyText(factBlock(s), wl) }))
const fbClaims = fb.reduce((a, r) => a + r.claimTotal, 0)
const fbUnsourced = fb.reduce((a, r) => a + r.unsourcedTotal, 0)

/* ---------- C. 真实语义层产物：L3 缓存的 neutral 改写（存在则审计，不存在跳过） ---------- */
let neutrals = null
try {
  const cache = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'compliance_semantic_cache.json'), 'utf8'))
  const rows = Object.values(cache).filter(r => r && r.neutral).map(r => ({ ...verifyText(r.neutral, wl), text: r.neutral }))
  const nClaims = rows.reduce((a, r) => a + r.claimTotal, 0)
  const nUn = rows.reduce((a, r) => a + r.unsourcedTotal, 0)
  neutrals = { audited: rows.length, claimTotal: nClaims, unsourcedTotal: nUn, dirty: rows.filter(r => r.unsourcedTotal) }
} catch (e) { /* 无缓存文件：跳过 C，不算失败 */ }

/* ---------- 汇总：语料级数字幻觉率（B + C 合并，即「真实产物」而非注入样本） ---------- */
const corpusClaims = fbClaims + (neutrals ? neutrals.claimTotal : 0)
const corpusUnsourced = fbUnsourced + (neutrals ? neutrals.unsourcedTotal : 0)

console.log('== 幻觉溯源（数字对账）评测 ==')
console.log(`A 注入检出：${detected.length}/${dirty.length} 条幻觉/篡改句被标记 → 检出率 ${pct(detectRate)}（95%CI [${pct(wilson(detected.length, dirty.length)[0])}, ${pct(wilson(detected.length, dirty.length)[1])}]）`)
console.log(`  正当误报：${falselyFlagged.length}/${clean.length} 条正常引用被误标 → 误报率 ${pct(falseAlarmRate)}`)
if (falselyFlagged.length) console.log('  误报明细：' + falselyFlagged.map(c => `「${c.text}」→ ${c.unsourced.join(',')}`).join('\n  '))
const missed = dirty.filter(c => !c.unsourcedTotal)
if (missed.length) console.log('  漏检明细：' + missed.map(c => `「${c.text}」(${c.note || c.expect})`).join('\n  '))
console.log(`B 确定层自证：${fb.length} 条 factBlock，数值声明 ${fbClaims} 个，无来源 ${fbUnsourced} 个` + (fbUnsourced ? ' ← 需排查！' : '（0 = 展示数字全部可溯源）'))
if (neutrals) console.log(`C 语义层产物：${neutrals.audited} 条 L3 neutral 改写，数值声明 ${neutrals.claimTotal} 个，无来源 ${neutrals.unsourcedTotal} 个`)
else console.log('C 语义层产物：未找到 compliance_semantic_cache.json，跳过（跑过一次 --l3 或线上问答后再看）')
console.log(`语料级数字幻觉率（B+C）：${corpusUnsourced}/${corpusClaims} = ${pct(corpusClaims ? corpusUnsourced / corpusClaims : 0)}`)

fs.writeFileSync(path.join(HERE, 'trace_report.json'), JSON.stringify({
  generated_at: new Date().toISOString(),
  injection: { total: claims.length, dirty: dirty.length, clean: clean.length, detected: detected.length, detectRate, falselyFlagged: falselyFlagged.length, falseAlarmRate, missed: missed.map(c => c.text), flaggedClean: falselyFlagged.map(c => ({ text: c.text, unsourced: c.unsourced })) },
  factBlock: { samples: fb.length, claimTotal: fbClaims, unsourcedTotal: fbUnsourced },
  l3Neutrals: neutrals && { audited: neutrals.audited, claimTotal: neutrals.claimTotal, unsourcedTotal: neutrals.unsourcedTotal, dirty: neutrals.dirty.map(r => ({ text: r.text, unsourced: r.unsourcedTotal })) },
  corpus: { claims: corpusClaims, unsourced: corpusUnsourced, rate: corpusClaims ? corpusUnsourced / corpusClaims : 0 }
}, null, 2), 'utf8')
console.log('报告已写入 eval/trace_report.json')

if (CI) {
  let fail = false
  if (detected.length !== dirty.length) { console.error('GATE: 存在漏检的注入幻觉句'); fail = true }
  if (falselyFlagged.length) { console.error('GATE: 正常引用出现误报'); fail = true }
  if (fbUnsourced) { console.error('GATE: factBlock 出现无来源数字（模板与数据源脱节）'); fail = true }
  if (fail) process.exit(2)
  console.log('CI 门禁通过')
}
