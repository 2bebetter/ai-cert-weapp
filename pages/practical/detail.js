import { getAIConfig, savePracticalSubmission, getPracticalSubmissions } from '../../../utils/storage'
import { CLOUD_FUNCTIONS } from '../../../utils/constants'

Page({
  data: {
    loading: true,
    task: null,
    answer: '',
    gradeResult: null
  },

  onLoad(options) {
    this.questionId = options.questionId
    this.loadTask()
  },

  loadTask() {
    const app = getApp()
    const questions = app.globalData.practicalQuestions

    if (!questions || !questions.length) {
      setTimeout(() => this.loadTask(), 300)
      return
    }

    const q = questions.find((item) => String(item.id) === this.questionId)
    if (!q) {
      this.setData({ loading: false })
      wx.showToast({ title: '未找到该任务', icon: 'none' })
      return
    }

    const type = q.score_items && q.score_items.length ? 'code' : 'document'
    const task = {
      id: q.id,
      title: (q.title || q.question || '未命名任务').split('：')[0].trim(),
      question: q.question,
      type,
      scoreItems: q.score_items || [],
      maxScore: q.score_total || (q.score_items || []).reduce((s, i) => s + Number(i.score), 0)
    }

    // 恢复草稿
    const submissions = getPracticalSubmissions()
    const draft = submissions.filter((s) => s.questionId === this.questionId && s.status === 'draft').at(-1)
    const answer = draft?.answer?.code || draft?.answer?.text || ''

    this.setData({
      loading: false,
      task,
      answer
    })

    wx.setNavigationBarTitle({ title: task.title })
  },

  onAnswerInput(e) {
    this.setData({ answer: e.detail.value, gradeResult: null })
  },

  saveDraft() {
    const task = this.data.task
    if (!task) return

    savePracticalSubmission({
      id: `practical:${task.id}:draft`,
      questionId: task.id,
      canonicalId: task.id,
      type: task.type,
      answer: task.type === 'code' ? { code: this.data.answer } : { text: this.data.answer },
      status: 'draft',
      savedAt: new Date().toISOString()
    })
    wx.showToast({ title: '草稿已保存', icon: 'success' })
  },

  async submitGrade() {
    const task = this.data.task
    const config = getAIConfig()

    if (!config.apiKey) {
      wx.showModal({
        title: '未配置 API Key',
        content: '请先到"我的"页面配置 API Key，才能使用 AI 评测。',
        confirmText: '去配置',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({ url: '/pages/settings/settings' })
          }
        }
      })
      return
    }

    wx.showLoading({ title: 'AI 判题中…', mask: true })

    try {
      const res = await wx.cloud.callFunction({
        name: CLOUD_FUNCTIONS.AI_GRADE,
        data: {
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          model: config.model,
          question: task.question,
          scoreItems: task.scoreItems,
          submission: { text: this.data.answer },
          reference: { text: '' }
        }
      })

      wx.hideLoading()

      const result = res.result
      if (result.error) {
        this.setData({ gradeResult: { error: result.error } })
        return
      }

      const maxScore = task.scoreItems.reduce((s, item) => s + Number(item.score), 0)
      this.setData({
        gradeResult: {
          total_score: result.total_score,
          maxScore,
          items: result.items
        }
      })
    } catch (err) {
      wx.hideLoading()
      this.setData({ gradeResult: { error: err.message } })
    }
  }
})