<template>
  <div class="agreement-page">
    <RiskTip />
    <div class="page-content">
      <div v-if="reviewMode" class="backbar" @click="back">‹ 返回</div>
      <h1 class="agree-title">重要风险告知</h1>
      <div class="agree-scroll">
        <p>1. 本产品仅为投研信息整理辅助工具，<b>不持有任何证券投资咨询资质</b>，不提供投资建议、不荐股、不代客交易、不接入任何实盘交易通道。</p>
        <p>2. 产品内全部 Agent 输出内容均来自公开财报、公开监管公告与持牌数据服务商提供的客观统计数据，为机器自动整理结果，可能存在延迟、遗漏或误差，<b>不构成任何参考依据</b>。</p>
        <p>3. 股市有风险。用户作出的全部投资决策及其后果，由用户本人自行承担全部责任，本产品及其运营方不承担任何连带责任。</p>
        <p>4. 你的操作记录与每次 Agent 的输入输出内容将加密留存不少于 6 个月，仅用于合规回溯，你可以在「我的-操作日志回溯」中查看与导出。</p>
      </div>
      <div class="agree-check">
        <input id="agreeBox" v-model="isAgree" type="checkbox">
        <label for="agreeBox">我已明确知晓本产品不提供任何投资咨询服务，所有投资决策自行承担全部风险</label>
      </div>
      <button class="btn confirm-btn" :disabled="!isAgree" @click="confirm">确认并进入</button>
      <div class="muted tip">未勾选协议无法进入主界面，无跳过入口</div>
    </div>
  </div>
</template>

<script setup>
/* 首次启动全屏协议页：路由守卫（@/router）会挡住一切未授权访问，这里只负责展示与记录授权动作。
 * 已授权用户从「设置-用户协议与风险告知」再进来时是回看模式，带返回条，可重新确认。 */
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import RiskTip from '@/components/RiskTip.vue'
import { agreeTerms, state } from '@/store/account'
import { toast } from '@/store/ui'

const route = useRoute()
const router = useRouter()
const isAgree = ref(false)
const reviewMode = computed(() => !!route.query.review || state.agreed)

function confirm () {
  if (!isAgree.value) return
  if (!state.agreed) agreeTerms()
  else toast('协议已再次确认，授权记录已留存')
  const to = route.query.redirect
  router.replace(typeof to === 'string' && to && to !== '/agreement' ? to : '/')
}
function back () { router.back() }
</script>

<style scoped>
.agreement-page { min-height: 100vh; padding-top: 44px; padding-bottom: 40px; }
.page-content { padding: 0 30px; max-width: var(--app-max); margin: 0 auto; }
.confirm-btn { margin-top: 40px; height: 48px; font-size: 16px; }
.tip { text-align: center; margin-top: 12px; }
.agree-check label { font-size: 14px; line-height: 1.6; flex: 1; cursor: pointer; }
</style>
