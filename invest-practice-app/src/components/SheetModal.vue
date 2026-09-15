<template>
  <div class="mask" @click.self="$emit('close')">
    <div class="sheet">
      <h4>{{ title }}</h4>
      <div v-if="note" class="muted" style="margin-top:4px">{{ note }}</div>
      <slot />
    </div>
  </div>
</template>

<script setup>
// 底部弹出式表单容器：虚拟盘添加/移除、新建预警都用它，避免三处各写一套 mask/sheet
defineProps({
  title: { type: String, default: '' },
  note: { type: String, default: '' }
})
defineEmits(['close'])
</script>
