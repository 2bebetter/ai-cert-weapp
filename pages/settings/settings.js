import { CLOUD_FUNCTIONS } from '../../utils/constants'
import { getAppVersion } from '../../utils/version'

Page({
  data: {
    aboutVersion: ''
  },

  onLoad() {
    // 版本号从 wx.getAccountInfoSync() 动态取，不再写死在 WXML 里
    this.setData({ aboutVersion: getAppVersion() })
  },

  copyGithubLink() {
    wx.setClipboardData({
      data: 'https://github.com/2bebetter/ai-cert-weapp',
      success: () => wx.showToast({ title: '仓库链接已复制', icon: 'success' })
    })
  },

  // ---- 问题反馈 ----

  openFeedbackModal() {
    if (!this.feedbackCtxChecked) {
      this.feedbackCtxChecked = true
      this.feedbackCtx = { page: '', deviceInfo: {} }
      try {
        const pages = getCurrentPages()
        if (pages.length) {
          const cur = pages[pages.length - 1]
          this.feedbackCtx.page = cur.route ? `/${cur.route}` : ''
        }
      } catch (e) { /* ignore */ }
      try {
        const info = wx.getSystemInfoSync()
        this.feedbackCtx.deviceInfo = {
          brand: info.brand || '',
          model: info.model || '',
          system: info.system || '',
          version: info.version || '',
          platform: info.platform || ''
        }
      } catch (e) { /* ignore */ }
    }
    this.setData({ feedbackModalVisible: true, feedbackText: '' })
  },

  closeFeedbackModal() {
    this.setData({ feedbackModalVisible: false })
  },

  noop() {},

  onFeedbackTextInput(e) {
    this.setData({ feedbackText: e.detail.value })
  },

  async submitFeedback() {
    const text = (this.data.feedbackText || '').trim()
    if (!text) {
      wx.showToast({ title: '请先填写反馈内容', icon: 'none' })
      return
    }

    wx.showLoading({ title: '提交中…', mask: true })
    try {
      const res = await wx.cloud.callFunction({
        name: CLOUD_FUNCTIONS.SUBMIT_FEEDBACK,
        data: {
          text,
          page: this.feedbackCtx ? this.feedbackCtx.page : '',
          deviceInfo: this.feedbackCtx ? this.feedbackCtx.deviceInfo : {}
        }
      })
      wx.hideLoading()
      if (res.result && res.result.code === 0) {
        this.setData({ feedbackModalVisible: false, feedbackText: '' })
        wx.showToast({ title: '感谢反馈！', icon: 'success' })
      } else {
        wx.showToast({ title: res.result?.error || '提交失败，请重试', icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: `提交失败：${err.message}`, icon: 'none' })
    }
  }
})