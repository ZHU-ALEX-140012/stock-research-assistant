<template>
  <div class="page home-page">
    <RiskTip />
    <div class="page-content">
      <h2 class="page-title">投研助手</h2>
      <SearchPanel v-model="kw" />
      <div class="muted hint">仅支持代码/名称精确搜索，无热门推荐、无榜单入口、无涨跌颜色</div>

      <div class="card plain">
        <h3>最近浏览标的</h3>
        <div v-for="s in recentStocks" :key="s.code" class="recent-item" @click="open(s.code)">
          <div>
            <div class="nm">{{ s.name }}<span v-if="s.st" class="st-badge">ST</span></div>
            <div class="cd">{{ s.code }} · {{ s.industry }}</div>
          </div>
          <div>
            <div class="pv">{{ s.price }}</div>
            <div class="rg">公开信息整理</div>
          </div>
        </div>
        <div v-if="!recentStocks.length" class="muted empty">暂无浏览记录</div>
      </div>

      <div class="card">
        <h3>今日中性投研日报</h3>
        <div class="muted">全市场涨跌统计 · 行业估值排行 · 当日重大公开公告</div>
        <button class="btn ghost sm" style="margin-top:12px" @click="$router.push('/report')">查看日报</button>
      </div>

      <div class="card dashed">
        <h3>合规审核后台（Demo 入口）</h3>
        <div class="muted">三层拦截引擎 L1关键词 / L2句式意图 / L3语义（线上定为全量触发），118 条回归样本（100 违规 + 18 放行）</div>
        <button class="btn ghost sm" style="margin-top:12px" @click="$router.push('/compliance')">跑合规回归测试</button>
      </div>

      <div class="src">数据来源：持牌数据服务商，仅供参考</div>
    </div>
    <BottomNav active-tab="/home" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import RiskTip from '@/components/RiskTip.vue'
import BottomNav from '@/components/BottomNav.vue'
import SearchPanel from '@/components/SearchPanel.vue'
import { STOCKS } from '@/data/stocks'
import { state, touchRecent } from '@/store/account'

const router = useRouter()
const kw = ref('')
const recentStocks = computed(() => state.recent.map(c => STOCKS[c]).filter(Boolean))

function open (code) {
  touchRecent(code)
  router.push('/stock/' + code)
}
</script>

<style scoped>
.hint { margin-bottom: 14px; }
.empty { padding: 14px 0; }
.card.dashed { background: #fff; border: 1px dashed #d9d9d9; }
.st-badge { margin-left: 6px; }
</style>
