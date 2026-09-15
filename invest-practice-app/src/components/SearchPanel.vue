<template>
  <div class="search-wrap">
    <div class="search-box">
      <span class="ico">⌕</span>
      <input v-model="kw" :placeholder="placeholder" autocomplete="off">
    </div>
    <!-- 精确搜索：只按代码/名称包含匹配，无热门推荐、无榜单入口、无涨跌颜色 -->
    <div v-if="showSug && kw.trim()" class="sug">
      <div v-for="s in hits" :key="s.code" @click="pick(s.code)">
        {{ s.name }} {{ s.code }}<span class="ind"> · {{ s.industry }}</span>
      </div>
      <div v-if="!hits.length" class="ind-empty">无匹配标的（Demo 内置 4 个）</div>
    </div>
  </div>
</template>

<script setup>
/* 首页与 /search 共用的搜索面板：命中即写入最近浏览并跳详情，两个入口行为完全一致。 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { searchList } from '@/data/stocks'
import { touchRecent } from '@/store/account'

const kw = defineModel({ type: String, default: '' })
defineProps({
  showSug: { type: Boolean, default: true },
  placeholder: { type: String, default: '输入股票代码 / 名称搜索' }
})
const router = useRouter()
const hits = computed(() => searchList(kw.value.trim()))

function pick (code) {
  touchRecent(code)
  router.push('/stock/' + code)
}
defineExpose({ pick })
</script>

<style scoped>
.search-wrap { margin: 8px 0; }
.ico { color: #bfbfbf; }
.ind { color: #bfbfbf; font-size: 12px; }
.ind-empty { color: #bfbfbf; }
</style>
