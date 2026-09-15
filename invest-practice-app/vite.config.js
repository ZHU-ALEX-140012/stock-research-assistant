/*
 * Vite 配置。《Vue项目路由配置和npm run build打包的注意事项清单》里的打包必查项是按 vue.config.js（webpack）写的，
 * 这里给出等价实现，逐项对应，验收时仍按那张表勾：
 *
 *  清单要求                        本工程实现
 *  publicPath: './'            →   base: './'（默认）；走 History 时自动换为绝对 base，见下方说明
 *  outputDir / assetsDir        →   build.outDir: 'dist' / static
 *  productionSourceMap: false   →   build.sourcemap: false
 *  terser drop_console/debugger →   esbuild.drop: ['console','debugger']（Vite 默认用 esbuild 压缩，只在 build 时生效）
 *  路由懒加载                   →   router 里全部 () => import('@/views/...')
 *  copy public/config.js        →   Vite 默认把 public/ 原样拷到 dist 根，无需 copy 插件
 *  devServer.proxy['/api']      →   server.proxy['/api'] → http://127.0.0.1:8792（本地合规 L3 后端）
 */
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 后端地址：Jenkins 上用环境变量覆盖，例如 VITE_API_TARGET=http://10.0.0.8:8792 npm run build
const API_TARGET = process.env.VITE_API_TARGET || 'http://127.0.0.1:8792'

/* 路由模式与资源 base 必须一起定（清单「路径适配」与「部署兼容」的取舍）：
 * 默认 hash 模式 → base './'：双击 dist/index.html 不白屏、子路由刷新不 404、二级目录免改造；
 * VITE_ROUTER_MODE=history → base 必须是绝对路径（默认 '/'，二级目录再给 VITE_BASE='/invest-practice/'），
 * 因为 base './' 在 /stock/600036 这类多级深链上会把 ./static/xx.js 解析成 /stock/static/xx.js 而 404；
 * 同时按清单第四节配 Nginx try_files 兜底。 */
const useHistoryMode = process.env.VITE_ROUTER_MODE === 'history'
const BASE = useHistoryMode ? (process.env.VITE_BASE || '/') : './'

export default defineConfig(({ command }) => ({
  base: BASE,
  plugins: [vue()],
  resolve: {
    // 清单里的组件都用 @/components/xxx.vue 形式导入，vue-cli 自带该别名，Vite 必须显式声明
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'static',
    sourcemap: false,
    // 清单要求首屏单包 < 2MB；本工程无任何 UI 组件库与图表库，正常在 100KB 级，超阈值即报警
    chunkSizeWarningLimit: 2048,
    reportCompressedSize: false
  },
  esbuild: command === 'build' ? { drop: ['console', 'debugger'] } : {},
  server: {
    host: '127.0.0.1',
    port: 8080,
    proxy: { '/api': { target: API_TARGET, changeOrigin: true } }
  },
  preview: {
    host: '127.0.0.1',
    port: 8081,
    proxy: { '/api': { target: API_TARGET, changeOrigin: true } }
  }
}))
