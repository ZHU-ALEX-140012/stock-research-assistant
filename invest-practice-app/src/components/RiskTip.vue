<template>
  <div class="risk-tip">
    <span class="risk-text">本产品仅为投研辅助工具，不构成任何投资建议</span>
  </div>
</template>

<script setup>
// 全局合规固定组件，无需传参：44px 常驻、不可关闭、全页面复用（强制合规项）
</script>

<style scoped>
.risk-tip {
  height: 44px;
  background-color: #FFF2F2;
  display: flex;
  align-items: center;
  justify-content: center;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
  max-width: var(--app-max, 520px);
  margin: 0 auto;
  z-index: 9999;
  border-bottom: 1px solid #ffd6d6;
}
.risk-text {
  font-size: 14px;
  font-weight: bold;
  color: #262626;
}
</style>
