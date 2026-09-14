import { getAIConfig, saveAIConfig } from '../../utils/storage'
import { CLOUD_FUNCTIONS } from '../../utils/constants'

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
    wx.showToast({ title: '配置已保存', icon: 'success' })
  },

  async testConnection() {
    const { apiKey, baseUrl, model } = this.data
    if (!apiKey) {
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
        this.setData({ testResult: { ok: true, msg: '连接成功 ✓' } })
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
  }
})