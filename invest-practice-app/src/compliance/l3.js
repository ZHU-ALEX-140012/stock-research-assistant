/* 合规三层引擎 · L3 语义层（走后端 LLM）状态与调度。
 * 已拍板：线上全量触发（每条提问都过 L3）；gated 作为成本兜底保留；off 仅用于对比。
 * 全量让 LLM 成为主链路依赖，所以这里同时负责降级计数——降级率是运维告警指标，不是可选日志。 */
import { reactive } from 'vue'
import { getHealth, semantic, semanticBatch } from '@/api/client'

export const L3_MODES = {
  always: '全量触发（线上默认：每问必调，每条都带语义改写，能实时发现规则误拦）',
  gated: '按需触发（成本兜底：规则未命中且带疑问特征才调 LLM）',
  off: '关闭 L3（仅规则层，对比用）'
}

/* 独立 key：换了默认策略后，旧版本持久化的 gated 会把新默认顶回去，所以必须让旧值失效 */
const MODE_KEY = 'invest_l3_mode_v2'
const readMode = () => { try { return localStorage.getItem(MODE_KEY) || 'always' } catch (e) { return 'always' } }

export const l3 = reactive({ probed: false, available: false, model: '', reason: '', cached: 0, mode: readMode(), stats: null })

/* 会话级开销与降级观测：fail = 该调 L3 却没拿到结果（超时/网络/降级），全量策略下即降级条数 */
export const l3stat = reactive({ q: 0, call: 0, block: 0, cached: 0, fail: 0, ms: 0 })
export function resetL3Stat () { Object.assign(l3stat, { q: 0, call: 0, block: 0, cached: 0, fail: 0, ms: 0 }) }

export function setL3Mode (m) {
  l3.mode = m
  try { localStorage.setItem(MODE_KEY, m) } catch (e) {}
  resetL3Stat()
}

/* 只在「按需触发」兜底策略下用：只在看起来像在提问/要建议的句子上花 LLM 成本 */
export const L3_TRIGGER = /[？?]|吗|呢$|吧$|怎么|怎样|如何|多少|哪个|哪里|什么时候|能不能|会不会|要不要|该不该|是不是|有没有|值不值|稳不稳|靠不|给个|帮我|推荐|建议|结论|说句实话|可不可|该咋/

export function needL3 (t, d12) {
  if (!l3.available || l3.mode === 'off') return false
  if (l3.mode === 'always') return true
  return !d12.blocked && L3_TRIGGER.test(t)
}

export async function refreshStats () {
  try {
    const d = await getHealth()
    if (d && d.stats) { l3.stats = d.stats; l3.cached = d.cached || l3.cached }
  } catch (e) {}
  return l3.stats
}

export async function probeL3 (force = false) {
  if (l3.probed && !force) return l3
  try {
    const d = await getHealth()
    l3.available = !!d.l3_available
    l3.model = d.model || ''
    l3.cached = d.cached || 0
    l3.reason = d.reason || ''
    l3.stats = d.stats || null
  } catch (e) {
    l3.available = false
    l3.reason = '未启动 L3 后端（compliance_server.py）或网络不可达，已降级为 L1+L2 规则层'
  }
  l3.probed = true
  return l3
}

/* 单条语义判定：null 即降级（超时 / 网络失败 / 后端无密钥），由 engine 退回规则层 */
export async function askL3 (text) {
  if (!l3.available) return null
  const r = await semantic(text)
  if (r) {
    l3stat.call++
    l3stat.ms += r.latency_ms || 0
    if (r.cached) l3stat.cached++
    if (r.verdict === 'BLOCK') l3stat.block++
  }
  return r
}

export function askL3Batch (texts, onProgress) { return semanticBatch(texts, onProgress) }
