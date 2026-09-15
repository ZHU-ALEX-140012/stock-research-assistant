<template>
  <div class="page report-page">
    <RiskTip />
    <div class="page-content">
      <div class="backbar" @click="$router.push('/mine')">‹ 返回</div>
      <h2 class="page-title" style="margin-top:4px">中性投研日报</h2>
      <div class="muted date">{{ REPORT.date }}</div>

      <div class="card">
        <h3>一、全市场涨跌统计</h3>
        <div v-for="b in REPORT.breadth" :key="b[0]" class="kv"><span>{{ b[0] }}</span><b>{{ b[1] }}</b></div>
      </div>

      <div class="card">
        <h3>二、行业估值排行（PE分位由低到高）</h3>
        <div v-for="(x, i) in REPORT.industry" :key="x[0]" class="kv">
          <span>{{ i + 1 }}. {{ x[0] }}</span><b>{{ x[1] }}%<PctBar :value="x[1]" /></b>
        </div>
        <div class="agent-foot">仅为全行业历史分位统计排序，不含「低估/高估」判断与任何配置建议。进度条为单色刻度，红色仅表示分位高低，不构成热度榜。</div>
      </div>

      <div class="card">
        <h3>三、当日重大公开公告汇总（非ST）</h3>
        <div v-for="n in REPORT.notices" :key="n[0]" class="list-line"><i class="dot"></i><b class="bold">{{ n[0] }}</b>&nbsp;{{ n[1] }}</div>
        <div class="agent-foot">仅作全市场公开事件整理，未做任何筛选与点评。</div>
      </div>
      <div class="global-tip">本内容仅为市场信息整理，不构成任何投资参考依据</div>
    </div>
    <BottomNav active-tab="/mine" />
  </div>
</template>

<script setup>
/* 中性投研日报：只有全市场统计、行业分位排序、公开公告汇总三块，
 * 不给涨跌原因、不给观点、不给配置建议（合规强制）。 */
import RiskTip from '@/components/RiskTip.vue'
import BottomNav from '@/components/BottomNav.vue'
import PctBar from '@/components/PctBar.vue'
import { REPORT } from '@/data/stocks'
</script>

<style scoped>
.date { margin: -12px 0 18px; }
.bold { font-weight: 700; }
</style>
