import { getAIConfig, saveAIConfig } from '../../utils/storage'

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
      const endpoint = (baseUrl || 'https://api.openai.com/v1')
        .replace(/\/$/, '')
        .replace(/\/chat\/completions$/, '')

      const res = await new Promise((resolve) => {
        wx.request({
          url: `${endpoint}/chat/completions`,
          method: 'POST',
          timeout: 15000,
          header: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          data: {
            model: model || 'deepseek-chat',
            temperature: 0,
            max_tokens: 16,
            messages: [{ role: 'user', content: 'ping' }]
          },
          success: (r) => resolve({ ok: r.statusCode >= 200 && r.statusCode < 300, errMsg: r.data?.error?.message || `HTTP ${r.statusCode}` }),
          fail: (e) => resolve({ ok: false, errMsg: e.errMsg || e.message })
        })
      })

      if (res.ok) {
        this.setData({ testResult: { ok: true, msg: '连接成功 ✓' } })
      } else {
        this.setData({ testResult: { ok: false, msg: `连接失败：${res.errMsg}` } })
      }
    } catch (err) {
      this.setData({ testResult: { ok: false, msg: `连接失败：${err.message}` } })
    }
  }
})