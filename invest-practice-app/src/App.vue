<template>
  <router-view />
  <AppToast />
</template>

<script setup>
/* 路由出口 + 全局 toast 宿主。RiskTip / BottomNav 按组件文档的做法由各页面自己引入。 */
import { watch } from 'vue'
import { useRoute } from 'vue-router'
import AppToast from '@/components/AppToast.vue'

// 切页回到顶部，等价 demo.html 里每次渲染后的 screen.scrollTop = 0
const route = useRoute()
watch(() => route.fullPath, () => { window.scrollTo(0, 0) })
</script>
