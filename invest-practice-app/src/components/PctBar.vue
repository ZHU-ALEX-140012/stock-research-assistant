<template>
  <div class="bar"><i :style="{ width: value + '%' }"></i></div>
</template>

<script setup>
/* 单色分位刻度条：色值只来自 --scale-fg（#cf1322），仅表历史分位高低，不代表涨跌方向或风险等级。
 * 使用处必须同屏带这条说明文案，合规校验才允许该红色存在。 */
defineProps({ value: { type: [Number, String], default: 0 } })
</script>
