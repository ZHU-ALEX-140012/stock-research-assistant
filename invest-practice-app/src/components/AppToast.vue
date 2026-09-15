<template>
  <div class="toast" :class="{ show: ui.show }">{{ ui.msg }}</div>
</template>

<script setup>
// toast 宿主：全站单例，由 @/store/ui 的 toast() 驱动
import { ui } from '@/store/ui'
</script>
