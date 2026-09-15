/* 全局轻提示：toast 宿主挂在 App.vue，任何模块 import { toast } 即可用。
 * 只放单例状态，避免每个页面各写一套定时器。 */
import { reactive } from 'vue'

export const ui = reactive({ msg: '', show: false })

let timer = null
export function toast (msg, ms = 2600) {
  ui.msg = msg
  ui.show = true
  clearTimeout(timer)
  timer = setTimeout(() => { ui.show = false }, ms)
}
