/* 合规三层引擎 · 合并判定与输出文案。
 * 三层关系：L1 关键词 / L2 句式意图 在前端即时执行，L3 语义走后端（线上全量触发）；
 * 任一层命中即整句不回答原问题，只回公开事实数据。L3 拿不到结果时按规则层兜底，不阻断回答。 */
import { L1_CATS, L1_ENTRIES, L1_SOFT, scanL1, scanL2 } from './rules'
import { askL3, needL3, l3, l3stat, L3_MODES, refreshStats } from './l3'

export function decide (t, l3res) {
  const l1 = scanL1(t)
  const l2 = scanL2(t)
  const hard = l1.hits.filter(h => !L1_SOFT.has(h))
  const blocked = hard.length > 0 || l2.hits.length > 0 || !!(l3res && l3res.verdict === 'BLOCK')
  const cats = [...new Set([...l2.cats, ...hard.map(h => (L1_ENTRIES.find(e => e[0] === h) || [])[1]).filter(Boolean),
    ...(l3res && l3res.verdict === 'BLOCK' && !/^R0/.test(l3res.risk_type) ? [l3res.risk_type.slice(0, 2)] : [])])]
  return { l1, l2, hard, blocked, cats }
}

/* 拦截后仍然输出的「公开事实」段：只给数据口径，不给任何方向、操作、评价结论 */
export function factBlock (s) {
  if (!s) return ''
  return `以下为 ${s.name}（${s.code}）的公开信息整理：最新价 ${s.price}；近1年估值分位 ${s.pct[0]}%；近1年波动区间 ${s.lower}~${s.upper}；近30日日均成交量 ${s.vol.avg30} 万手；最新公开公告「${s.notice[0][1]}」（${s.notice[0][0]}）。`
}

export async function runEngine (raw, stock) {
  const t = String(raw).trim()
  const d0 = decide(t, null)
  l3stat.q++
  let l3res = null
  if (needL3(t, d0)) {
    l3res = await askL3(t)
    if (!l3res) l3stat.fail++ // 全量策略下该调而未拿到结果 = 降级，降级率是告警指标
  }
  const d = decide(t, l3res)
  const names = d.cats.map(c => L1_CATS[c] || c)
  let out
  if (d.blocked) {
    out = `该提问涉及【${names.join('、') || (l3res ? l3res.risk_type : '合规敏感意图')}】，按合规规则不回答方向、操作、评价、推荐类问题。`
    if (l3res && l3res.neutral) out += ` 语义层中性化改写：${l3res.neutral}`
    out += ' ' + factBlock(stock)
  } else {
    out = (d.l1.hits.length ? d.l1.text : t) + ' ' + factBlock(stock)
  }
  await refreshStats() // 本次调用也要计入后端累计，否则面板上永远是旧值
  return { text: out, blocked: d.blocked, l1: d.l1, l2: d.l2, hard: d.hard, l3: l3res, cats: names, ruleBlocked: d0.blocked }
}

/* 判定链路：给「三层实测」卡片逐行展示，纯文本结构，模板里不需要 v-html */
export function buildChain (r) {
  const s = l3.stats
  const modeName = (L3_MODES[l3.mode] || l3.mode).split('（')[0]
  let l3tx
  if (r.l3) {
    l3tx = `${r.l3.risk_type} / ${r.l3.verdict}${r.l3.reason ? ' / ' + r.l3.reason : ''}${r.l3.cached ? '（缓存命中）' : ''}${r.l3.latency_ms ? ' · ' + r.l3.latency_ms + 'ms' : ''}`
  } else if (l3.mode === 'off') {
    l3tx = '按策略关闭，仅走规则层'
  } else if (l3.mode === 'always') {
    l3tx = '全量策略下本次调用未返回（超时/网络/后端无密钥），已降级为规则层兜底'
  } else if (r.ruleBlocked) {
    l3tx = '规则层已拦下，按「按需触发」策略未调 LLM'
  } else {
    l3tx = l3.available ? '未触发或调用失败，已降级' : '未接入，已降级'
  }
  return [
    { lb: 'L1 关键词', tx: r.l1.hits.length ? '命中 ' + [...new Set(r.l1.hits)].join('、') : '未命中' },
    { lb: 'L2 句式意图', tx: r.l2.hits.length ? '命中 ' + [...new Set(r.l2.hits.map(h => h.code + '_' + h.name))].join('、') : '未命中' },
    { lb: 'L3 语义', tx: l3tx },
    {
      lb: '开销统计',
      tx: `当前策略「${modeName}」——本次会话提问 ${l3stat.q} 条，实际调 LLM ${l3stat.call} 条（占 ${l3stat.q ? Math.round(l3stat.call / l3stat.q * 100) : 0}%，其中缓存命中 ${l3stat.cached} 次），语义层拦下 ${l3stat.block} 条，累计等待 ${l3stat.ms} ms。全量策略下每条提问的响应下限等于 L3 往返耗时（实测 0.6~1.0s，命中缓存约 10ms），超过 8s 未回即降级为规则层兜底。`
    },
    {
      lb: '降级监控',
      tx: `本次会话需调 L3 但未拿到结果 ${l3stat.fail} 条（本地降级率 ${l3stat.q ? (l3stat.fail / l3stat.q * 100).toFixed(1) : '0.0'}%）；` +
        (s
          ? `后端累计（含本次）请求 ${s.requests} 条、降级 ${s.degraded} 条（${(s.degrade_rate * 100).toFixed(1)}%）、连续失败 ${s.fail_streak} 次；告警阈值 降级率 ${(s.thresholds.ratio * 100).toFixed(0)}% 或连续失败 ${s.thresholds.fail_streak} 次，命中即写运行日志与审计流水。当前状态：${s.alert ? '已告警' : '正常'}`
          : '后端未返回 stats：请确认 L3 后端已重启到含降级观测的版本')
    }
  ]
}
