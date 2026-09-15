<template>
  <div>
    <svg :viewBox="`0 0 ${W} ${H}`" width="100%" :height="H" style="display:block">
      <line x1="0" :y1="y(max)" :x2="W" :y2="y(max)" stroke="#d9d9d9" stroke-dasharray="3 3" />
      <line x1="0" :y1="y(min)" :x2="W" :y2="y(min)" stroke="#d9d9d9" stroke-dasharray="3 3" />
      <polyline :points="pts" fill="none" stroke="#262626" stroke-width="1.4" />
    </svg>
    <div class="muted labels">
      <span>下沿 {{ stock.lower }}</span>
      <span>虚线=近1年统计上下沿</span>
      <span>上沿 {{ stock.upper }}</span>
    </div>
    <div class="muted" style="margin-top:2px">以上为已发生数据的连续统计呈现，不构成趋势判断，也不预示未来表现</div>
  </div>
</template>

<script setup>
/* 近1年走势黑线（已拍板保留）：线色固定 #262626，不用涨跌色；虚线只标统计上下沿。 */
import { computed } from 'vue'

const props = defineProps({ stock: { type: Object, required: true } })
const W = 300, H = 78
const min = computed(() => Math.min(...props.stock.series))
const max = computed(() => Math.max(...props.stock.series))
const y = v => (H - (v - min.value) / (max.value - min.value) * (H - 6) - 3).toFixed(1)
const pts = computed(() => {
  const a = props.stock.series
  return a.map((v, i) => `${(i / (a.length - 1) * W).toFixed(1)},${y(v)}`).join(' ')
})
</script>

<style scoped>
.labels { display: flex; justify-content: space-between; margin-top: 4px; }
</style>
