/**
 * 触觉反馈
 * 关键节点给一次轻微震动，让「答对 / 答错 / 操作成功」在手指上有回馈。
 * 低版本基础库或用户关闭震动时静默降级，绝不抛错。
 */

function buzz(type) {
  try {
    wx.vibrateShort({ type })
  } catch (e) {
    try {
      wx.vibrateShort()
    } catch (err) { /* 设备不支持，忽略 */ }
  }
}

/** 轻触：选中、切换、打开面板 */
export function tap() {
  buzz('light')
}

/** 成功：答对、保存成功、提交完成 */
export function success() {
  buzz('medium')
}

/** 警示：答错、校验失败 */
export function warn() {
  buzz('heavy')
}
