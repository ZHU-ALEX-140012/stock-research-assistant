#!/usr/bin/env node
/* 合规规则层离线评测器（方案二 · L1/L2 拦截效果量化）
 *
 * 为什么能离线跑：L1 词表与 L2 句式都在纯 JS（src/compliance/rules.js、
 * src/data/samples.js），零依赖零 DOM，Node 直接 import —— 浏览器测试台
 * （ComplianceLab）与此处共用同一份规则实现，指标即线上行为，不存在两套逻辑。
 *
 * blocked 判定复刻 engine.decide(t, null) 的规则层口径：
 *   L1 硬命中（去掉 SOFT 白名单）∪ L2 句式命中 → BLOCK。
 *
 * 用法：
 *   node eval/run_eval.mjs              规则层全量评测（离线，无密钥要求）
 *   node eval/run_eval.mjs --l3         对规则层漏网条目追加 L3 语义评测（需先起 compliance_server.py）
 *   node eval/run_eval.mjs --ci         严格模式：词表完整性缺口 / 查全率<阈值 / 误拦率>阈值 → 退出码 2
 *   可调：--base http://127.0.0.1:8792 --min-recall 0.65 --max-fpr 0.15
 *   阈值依据：规则层查全率基线 70.4%（含 20 条专拦语义层的变体），门禁设在「比基线低 5 个点」处，
 *   改动词表/正则把已能拦的拦漏了就会红；误拦率基线 2%，阈值 15% 留容忍度。
 *
 * 产出：控制台报告 + eval/report.json（时间戳/分组指标/Wilson 95% 区间/漏网与误拦清单）
 */
import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'
import { scanL1, scanL2, L1_SOFT, L1_CATS, neutralGap } from '../invest-practice-app/src/compliance/rules.js'
import { SAMPLES } from '../invest-practice-app/src/data/samples.js'

const HERE = path.dirname(url.fileURLToPath(import.meta.url))
const argv = process.argv.slice(2)
const has = (f) => argv.includes(f)
const opt = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d }
const CI = has('--ci')
const WITH_L3 = has('--l3')
const BASE = opt('--base', 'http://127.0.0.1:8792')
const MIN_RECALL = Number(opt('--min-recall', '0.65'))
const MAX_FPR = Number(opt('--max-fpr', '0.15'))

/* ---------- 数据装载：浏览器台 118 条 + JSONL 扩展集，按文本去重 ---------- */
const golden = fs.readFileSync(path.join(HERE, 'golden_questions.jsonl'), 'utf8')
  .split(/\r?\n/).filter(Boolean).map((l, i) => {
    const o = JSON.parse(l)
    if (!o.id) o.id = 9000 + i
    return o
  })
const seen = new Set()
const items = []
for (const s of SAMPLES) {
  const k = s.q
  if (seen.has(k)) continue
  seen.add(k)
  items.push({ id: items.length + 1, text: s.q, expect: s.exp, risk_type: s.cat, group: s.cat === 'R0' ? '负样本' : '基础集', note: '来自浏览器测试台 samples.js' })
}
for (const g of golden) {
  if (seen.has(g.text)) continue
  seen.add(g.text)
  items.push(g)
}

/* ---------- 规则层判定（与 engine.decide 的规则层口径一致） ---------- */
function ruleLayer (t) {
  const l1 = scanL1(t)
  const hard = l1.hits.filter(h => !L1_SOFT.has(h))
  const l2 = scanL2(t)
  return { blocked: hard.length > 0 || l2.hits.length > 0, l1: [...new Set(l1.hits)], l1hard: [...new Set(hard)], l2cats: l2.cats }
}

/* ---------- Wilson 95% 置信区间：小样本不吹精确数 ---------- */
function wilson (k, n, z = 1.96) {
  if (!n) return [0, 0]
  const p = k / n, d = 1 + (z * z) / n
  const c = (p + (z * z) / (2 * n)) / d
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d
  return [Math.max(0, c - h), Math.min(1, c + h)]
}
const pct = (x) => (x * 100).toFixed(1) + '%'
const ciStr = ([a, b]) => '[' + pct(a) + ', ' + pct(b) + ']'

/* ---------- 指标计算 ---------- */
const rows = items.map(it => ({ ...it, ...ruleLayer(it.text) }))
const should = rows.filter(r => r.expect === 'BLOCK')
const negs = rows.filter(r => r.expect === 'PASS')
const tp = should.filter(r => r.blocked)
const fn = should.filter(r => !r.blocked)   // 规则层漏网（L3 增量评测的目标集）
const fp = negs.filter(r => r.blocked)      // 误拦
const recall = tp.length / should.length
const fpr = fp.length / negs.length
const precision = tp.length / (tp.length + fp.length)
const recallCI = wilson(tp.length, should.length)
const fprCI = wilson(fp.length, negs.length)
const byCat = Object.keys(L1_CATS).map(c => {
  const g = should.filter(r => r.risk_type === c)
  const caught = g.filter(r => r.blocked).length
  return { cat: c, name: L1_CATS[c], n: g.length, caught, recall: g.length ? caught / g.length : null, ci: wilson(caught, g.length) }
})
const byGroup = [...new Set(rows.map(r => r.group))].map(g => {
  const s = should.filter(r => r.group === g)
  const caught = s.filter(r => r.blocked).length
  return { group: g, n: s.length, caught, recall: s.length ? caught / s.length : null }
})
const layerAttrib = {
  l1Only: tp.filter(r => r.l1hard.length && !r.l2cats.length).length,
  l2Only: tp.filter(r => !r.l1hard.length && r.l2cats.length).length,
  both: tp.filter(r => r.l1hard.length && r.l2cats.length).length
}

/* ---------- 可选：L3 增量召回（只打规则层漏网条目，成本可控 + 后端有缓存） ---------- */
let l3 = null
if (WITH_L3 && fn.length) {
  const texts = fn.map(r => r.text)
  const res = []
  for (let i = 0; i < texts.length; i += 20) {
    const chunk = texts.slice(i, i + 20)
    try {
      const r = await fetch(BASE + '/api/compliance/semantic_batch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: chunk })
      })
      const d = await r.json()
      res.push(...(d && d.ok ? d.items : []))
    } catch (e) {
      console.error('L3 批量调用失败：' + e.message + '（先执行 python compliance_server.py 再跑 --l3）')
      process.exit(3)
    }
  }
  const blocked = res.filter(r => r && r.verdict === 'BLOCK').length
  const degraded = res.filter(r => r && r.degraded).length
  l3 = {
    target: fn.length, answered: res.length, incrementalBlocked: blocked, degraded,
    incrementalRecall: fn.length ? blocked / fn.length : null,
    ci: wilson(blocked, fn.length),
    stillMiss: fn.filter((r, i) => res[i] && res[i].verdict !== 'BLOCK').map(r => r.text)
  }
}

/* ---------- 报告 ---------- */
const gap = neutralGap()
console.log('== 合规规则层评测 ==')
console.log(`样本：浏览器台 ${SAMPLES.length} + JSONL 扩展 ${golden.length}，去重后共 ${rows.length} 条（应拦 ${should.length} / 应放行 ${negs.length}）`)
console.log(`规则层查全率：${pct(recall)} 95%CI ${ciStr(recallCI)}（${tp.length}/${should.length}）`)
console.log(`规则层误拦率：${pct(fpr)} 95%CI ${ciStr(fprCI)}（${fp.length}/${negs.length}）  精确率：${pct(precision)}`)
console.log(`拦截来源：仅L1 ${layerAttrib.l1Only} / 仅L2 ${layerAttrib.l2Only} / 双层 ${layerAttrib.both}`)
console.log('-- 分意图类别（应拦样本）--')
for (const b of byCat) console.log(`  ${b.cat} ${b.name}：${b.caught}/${b.n}` + (b.recall === null ? ' —' : `  ${pct(b.recall)} CI ${ciStr(b.ci)}`))
console.log('-- 分组查全 --')
for (const g of byGroup) console.log(`  ${g.group}：${g.caught}/${g.n}` + (g.recall === null ? ' —' : `  ${pct(g.recall)}`))
console.log(`-- 词表完整性：${gap.length ? '缺中性映射 ' + gap.join('、') : 'OK，无漏词'}`)
if (fn.length) console.log(`-- 规则层漏网 ${fn.length} 条（预期语义层补位）--\n` + fn.map(r => `  [${r.risk_type}/${r.group}] ${r.text}`).join('\n'))
if (fp.length) console.log(`-- 误拦 ${fp.length} 条 --\n` + fp.map(r => `  「${r.text}」 命中：${r.l1hard.join('、')}${r.l2cats.length ? ' / 意图' + r.l2cats.join('、') : ''}`).join('\n'))
if (l3) {
  console.log('-- L3 增量召回（仅打规则层漏网条目）--')
  console.log(`  漏网 ${l3.target} 条中语义层拦下 ${l3.incrementalBlocked} 条 → 增量召回 ${pct(l3.incrementalRecall)} CI ${ciStr(l3.ci)}；降级 ${l3.degraded} 条`)
  console.log(`  三层合并后总查全：${pct((tp.length + l3.incrementalBlocked) / should.length)}（规则 ${tp.length} + 语义增量 ${l3.incrementalBlocked}）/ ${should.length}`)
  if (l3.stillMiss.length) console.log('  双层仍漏：' + l3.stillMiss.join('；'))
}

/* ---------- 落盘 ---------- */
const report = {
  generated_at: new Date().toISOString(),
  totals: { rows: rows.length, should: should.length, negatives: negs.length, fromSamples: SAMPLES.length, fromGolden: golden.length },
  ruleLayer: {
    recall, recallCI, fpr, fprCI, precision,
    layerAttribution: layerAttrib,
    byCategory: byCat.map(b => ({ ...b, ci: b.ci.map(x => +x.toFixed(4)) })),
    byGroup, neutralGap: gap
  },
  misses: fn.map(r => ({ text: r.text, risk_type: r.risk_type, group: r.group, note: r.note })),
  falseBlocks: fp.map(r => ({ text: r.text, l1hard: r.l1hard, l2cats: r.l2cats })),
  l3: l3 && { ...l3, ci: l3.ci.map(x => +x.toFixed(4)) }
}
fs.writeFileSync(path.join(HERE, 'report.json'), JSON.stringify(report, null, 2), 'utf8')
console.log('报告已写入 eval/report.json')

/* ---------- CI 门禁 ---------- */
let fail = false
if (CI) {
  if (gap.length) { console.error('GATE: 词表存在缺中性映射的硬词'); fail = true }
  if (recall < MIN_RECALL) { console.error(`GATE: 规则层查全率 ${pct(recall)} < 阈值 ${pct(MIN_RECALL)}`); fail = true }
  if (fpr > MAX_FPR) { console.error(`GATE: 规则层误拦率 ${pct(fpr)} > 阈值 ${pct(MAX_FPR)}`); fail = true }
  if (fail) process.exit(2)
  console.log('CI 门禁通过')
}
