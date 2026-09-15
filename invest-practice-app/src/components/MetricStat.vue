<template>
  <div class="metric">
    <div class="lb">{{ lb }}</div>
    <div class="vl">{{ vl }}</div>
    <div v-if="note" class="note">{{ note }}</div>
  </div>
</template>

<script setup>
// 统计格：note 里必须写清分子分母口径（去绩效化的强制要求）
defineProps({
  lb: { type: String, default: '' },
  vl: { type: [String, Number], default: '' },
  note: { type: String, default: '' }
})
</script>
