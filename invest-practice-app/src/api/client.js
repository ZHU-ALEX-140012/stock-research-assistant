/* 请求层：所有后端调用都走这里，合规降级策略集中一处，避免每个页面各写一套 try/catch。
 * 后端地址优先级：window.GLOBAL_CONFIG.API_BASE_URL（打包后可改）> 同源 /api（Nginx 反代，推荐）。 */

const BASE = () => {
  const g = (typeof window !== 'undefined' && window.GLOBAL_CONFIG && window.GLOBAL_CONFIG.API_BASE_URL) || ''
  const cfg = String(g).replace(/\/+$/, '')
  if (cfg) return cfg
  /* 未配置时默认走同源 /api（Nginx 反代）。但双击打开 dist/index.html 时协议是 file://，
   * 同源会解析成 file:///.../api 必定失败，所以这种场景直连本地 L3 后端（已开 CORS），
   * 让「双击演示」也能跑到线上同一条全量链路；真机部署永远应在 config.js 里显式填写。 */
  if (typeof window !== 'undefined' && window.location.protocol === 'file:') return 'http://127.0.0.1:8792'
  return ''
}

export const api = (path) => BASE() + path

export function withTimeout (p, ms) {
  return Promise.race([p, new Promise((_, rj) => setTimeout(() => rj(new Error('timeout')), ms))])
}

/* SLA：单条语义判定 8s、健康探针 2.5s、批量（20 条/次）90s。
 * 线上为全量触发，每条提问都要等 L3，所以单条超时必须收紧——超时不是失败，而是降级。 */
export const SLA = { health: 2500, single: 8000, batch: 90000 }

async function post (path, body, ms) {
  const r = await withTimeout(fetch(api(path), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  }), ms)
  return r.json()
}

export function getHealth (ms = SLA.health) {
  return withTimeout(fetch(api('/api/compliance/health'), { cache: 'no-store' }), ms).then(r => r.json())
}

/* 语义判定：任何异常（网络失败 / 超时 / 后端未配密钥 / 返回 degraded）一律归一为 null，
 * 由上层 engine 退回 L1+L2 规则层兜底——合规降级绝不阻断用户正常的事实查询。 */
export async function semantic (text) {
  try {
    const d = await post('/api/compliance/semantic', { text }, SLA.single)
    const r = d && d.ok ? d.result : null
    return r && !r.degraded ? r : null
  } catch (e) { return null }
}

export async function semanticBatch (texts, onProgress, chunkSize = 20) {
  const out = []
  for (let i = 0; i < texts.length; i += chunkSize) {
    const chunk = texts.slice(i, i + chunkSize)
    try {
      const d = await post('/api/compliance/semantic_batch', { texts: chunk }, SLA.batch)
      out.push(...(d && d.ok ? d.items : chunk.map(() => null)))
    } catch (e) { out.push(...chunk.map(() => null)) }
    if (onProgress) onProgress(Math.min(i + chunkSize, texts.length), texts.length)
  }
  return out
}
