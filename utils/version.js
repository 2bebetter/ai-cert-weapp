/**
 * 小程序版本号
 *
 * 之前「关于」卡片里是写死的 v1.0.0，每次发版都得记得手动改一处。
 * 改成从 wx.getAccountInfoSync() 读：
 *
 *   正式版    miniProgram.version 是上传代码时在开发者工具里填的版本号，
 *             所以以后发版只要在开发者工具里填对，界面自动跟着变。
 *   开发版/体验版
 *             这两种环境 version 是空字符串，退回 constants.js 里的
 *             APP_VERSION，并标注环境 —— 免得看到兜底值误以为是线上版本。
 */
import { APP_VERSION } from './constants'

const ENV_LABEL = { develop: '开发版', trial: '体验版' }

/**
 * @returns {String} 形如 "v1.1.0"，开发版/体验版下形如 "v1.1.0 体验版"
 */
export function getAppVersion() {
  let mp = {}
  try {
    mp = (wx.getAccountInfoSync() || {}).miniProgram || {}
  } catch (e) {
    // 基础库过低没有这个 API 时退回常量
    return `v${APP_VERSION}`
  }
  if (mp.version) return `v${mp.version}`
  const label = ENV_LABEL[mp.envVersion]
  return label ? `v${APP_VERSION} ${label}` : `v${APP_VERSION}`
}
