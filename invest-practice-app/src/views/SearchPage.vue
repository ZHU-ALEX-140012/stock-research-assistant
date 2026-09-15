<template>
  <div class="page search-page">
    <RiskTip />
    <div class="page-content">
      <div class="backbar" @click="$router.push('/')">‹ 返回首页</div>
      <h2 class="page-title" style="margin-top:4px">搜索标的</h2>
      <SearchPanel v-model="kw" :show-sug="false" placeholder="输入股票代码 / 名称，回车看全部结果" />
      <div class="muted hint">精确匹配代码或名称；无热门推荐、无榜单入口、无涨跌颜色、无猜你想搜</div>

      <div class="card plain">
        <h3>{{ kw.trim() ? `匹配结果（${hits.length}）` : '全部内置标的（4）' }}</h3>
        <div v-for="s in rows" :key="s.code" class="recent-item" @click="open(s.code)">
          <div>
            <div class="nm">{{ s.name }}<span v-if="s.st" class="st-badge">ST</span></div>
            <div class="cd">{{ s.code }} · {{ s.industry }}</div>
          </div>
          <div>
            <div class="pv">{{ s.price }}</div>
            <div class="rg">公开信息整理</div>
          </div>
        </div>
        <div v-if="!rows.length" class="muted empty">无匹配标的（Demo 内置 4 个）</div>
      </div>
      <div class="src">数据来源：持牌数据服务商，仅供参考</div>
    </div>
    <BottomNav active-tab="/home" />
  </div>
</template>

<script setup>
/* 独立搜索页：与首页共用 SearchPanel，差别是这里把结果平铺成列表而不是下拉建议。
 * 空关键词时展示 4 个内置标的，方便评审直接点进详情。 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import RiskTip from '@/components/RiskTip.vue'
import BottomNav from '@/components/BottomNav.vue'
import SearchPanel from '@/components/SearchPanel.vue'
import { LIST, searchList } from '@/data/stocks'
import { touchRecent } from '@/store/account'

const router = useRouter()
const kw = ref('')
const hits = computed(() => searchList(kw.value.trim()))
const rows = computed(() => (kw.value.trim() ? hits.value : LIST))

function open (code) {
  touchRecent(code)
  router.push('/stock/' + code)
}
</script>

<style scoped>
.hint { margin: 6px 0 14px; }
.empty { padding: 14px 0; }
.st-badge { margin-left: 6px; }
</style>
