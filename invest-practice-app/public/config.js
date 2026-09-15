/*
 * 打包后可直接修改的外部配置（会被原样拷进 dist 根目录）。
 * 留空即走同源 /api/compliance/*，由 Nginx 反代到 L3 后端（清单里的「接口反向代理，避免跨域」方案）。
 * 例外：双击 dist/index.html（file://）演示时，留空会自动直连 http://127.0.0.1:8792，无需改本文件。
 * 跨域直连时才填绝对地址，例如 "http://10.0.0.8:8792"。这里不允许出现任何密钥。
 */
window.GLOBAL_CONFIG = {
  API_BASE_URL: ''
}
