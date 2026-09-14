import { getAIConfig, saveAIConfig, exportAllData, importAllData } from '../../utils/storage'
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
        data: {
          apiKey,
          baseUrl,
          model,
          action: 'test'
        }
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

  exportData() {
    const data = exportAllData()
    const json = JSON.stringify(data, null, 2)

    // 保存到临时文件并分享
    const fs = wx.getFileSystemManager()
    const path = `${wx.env.USER_DATA_PATH}/ai-trainer-backup.json`
    fs.writeFileSync(path, json, 'utf8')

    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    })

    wx.setClipboardData({
      data: '学习数据已导出到: ' + path,
      success: () => wx.showToast({ title: '数据已导出', icon: 'success' })
    })
  },

  importData() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      success: (res) => {
        const file = res.tempFiles[0]
        const fs = wx.getFileSystemManager()
        try {
          const content = fs.readFileSync(file.path, 'utf8')
          const data = JSON.parse(content)
          importAllData(data)
          wx.showToast({ title: '导入成功', icon: 'success' })
        } catch (err) {
          wx.showToast({ title: `导入失败：${err.message}`, icon: 'none' })
        }
      }
    })
  },

  clearData() {
    wx.showModal({
      title: '确认清除',
      content: '所有学习数据将被清除，包括错题本、考试记录、笔记等。此操作不可撤销！',
      success: (res) => {
        if (res.confirm) {
          try {
            wx.clearStorageSync()
            this.loadConfig()
            wx.showToast({ title: '已清除', icon: 'success' })
          } catch (err) {
            wx.showToast({ title: `清除失败：${err.message}`, icon: 'none' })
          }
        }
      }
    })
  }
})