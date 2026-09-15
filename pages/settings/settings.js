import { getAIConfig, saveAIConfig } from '../../utils/storage'
import { CLOUD_FUNCTIONS } from '../../utils/constants'
import * as haptic from '../../utils/haptics'

Page({
  data: {
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: '',
    model: 'deepseek-chat',
    testResult: null
  },

  onLoad() {
    this.loadConfig()
  },

  loadConfig() {
    const config = getAIConfig()
    if (config.baseUrl) this.setData({ baseUrl: config.baseUrl })
    if (config.apiKey) this.setData({ apiKey: config.apiKey })
    if (config.model) this.setData({ model: config.model })
  },

  onBaseUrlInput(e) { this.setData({ baseUrl: e.detail.value }) },
  onApiKeyInput(e) { this.setData({ apiKey: e.detail.value }) },
  onModelInput(e) { this.setData({ model: e.detail.value }) },

  saveConfig() {
    saveAIConfig({
      baseUrl: this.data.baseUrl.trim(),
      apiKey: this.data.apiKey.trim(),
      model: this.data.model.trim()
    })
    haptic.success()
    wx.showToast({ title: '配置已保存', icon: 'success' })
  },

  async testConnection() {
    const { apiKey, baseUrl, model } = this.data
    if (!apiKey) {
      haptic.warn()
      this.setData({ testResult: { ok: false, msg: '请先填写 API Key' } })
      return
    }

    this.setData({ testResult: { ok: true, msg: '测试中…' } })

    try {
      const res = await wx.cloud.callFunction({
        name: CLOUD_FUNCTIONS.AI_GRADE,
        data: { apiKey, baseUrl, model, action: 'test' }
      })

      if (res.result && res.result.ok) {
        this.setData({ testResult: { ok: true, msg: '连接成功' } })
      } else {
        this.setData({ testResult: { ok: false, msg: res.result?.error || '连接失败' } })
      }
    } catch (err) {
      this.setData({ testResult: { ok: false, msg: `连接失败：${err.message}` } })
    }
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
      haptic.warn()
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
        haptic.success()
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