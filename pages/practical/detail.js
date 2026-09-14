import { getAIConfig, savePracticalSubmission, getPracticalSubmissions } from '../../../utils/storage'
import { CLOUD_FUNCTIONS } from '../../../utils/constants'

Page({
  data: {
    loading: true,
    loadError: false,
    task: null,
    answer: '',
    gradeResult: null,
    debugInfo: ''
  },

  onLoad(options) {
    console.log('detail onLoad, options:', options)
    this.questionId = options.questionId
    this.retryCount = 0
    this.maxRetries = 20
    this.loadTask()
  },

  async loadTask() {
    const app = getApp()
    let questions = app.globalData.practicalQuestions

    console.log('detail loadTask, practicalQuestions:', questions?.length,
      'globalData.questions:', !!app.globalData.questions)

    // 如果题库还没加载，先主动触发加载
    if (!questions || !questions.length) {
      if (!app.globalData.questions) {
        // 还没开始加载 → 触发加载
        console.log('detail: 触发题库加载')
        await app.loadQuestions()
        questions = app.globalData.practicalQuestions
        console.log('detail: 加载后 practicalQuestions:', questions?.length)
      } else if (this.retryCount < this.maxRetries) {
        // 正在加载中，等待
        this.retryCount++
        console.log(`detail: 等待题库加载... 第${this.retryCount}次`)
        setTimeout(() => this.loadTask(), 300)
        return
      } else {
        console.error('detail: 题库加载超时')
        this.setData({ loading: false, loadError: true, debugInfo: '题库加载超时，practicalQuestions=' + (questions?.length ?? 'null') })
        return
      }
    }

    if (!questions || !questions.length) {
      console.error('detail: practicalQuestions 为空')
      this.setData({ loading: false, loadError: true, debugInfo: 'practicalQuestions 为空' })
      return
    }

    const q = questions.find((item) => String(item.id) === this.questionId)
    console.log('detail: 找到题目:', !!q, 'questionId:', this.questionId)

    if (!q) {
      this.setData({
        loading: false,
        loadError: true,
        debugInfo: `未找到题目 ID=${this.questionId}，题库有 ${questions.length} 道题`
      })
      return
    }

    // 判断类型
    const hasScoreItems = q.score_items && q.score_items.length > 0
    const isCode = q.type === 'code_practice' || hasScoreItems
    const type = isCode ? 'code' : 'document'

    const task = {
      id: q.id,
      title: (q.title || q.question?.split('：')[0] || '未命名任务').trim(),
      question: q.question || '请按题目要求完成本任务。',
      type,
      scoreItems: q.score_items || [],
      maxScore: q.score_total || (q.score_items || []).reduce((s, i) => s + Number(i.score), 0)
    }

    console.log('detail: 构建任务成功', task.title, task.type)

    // 恢复草稿
    const submissions = getPracticalSubmissions()
    const drafts = submissions.filter((s) => s.questionId === this.questionId && s.status === 'draft')
    const draft = drafts[drafts.length - 1]
    const answer = draft?.answer?.code || draft?.answer?.text || ''

    this.setData({
      loading: false,
      loadError: false,
      task,
      answer
    })

    wx.setNavigationBarTitle({ title: (task.title || '实操任务').slice(0, 20) })
  },

  retry() {
    this.setData({ loading: true, loadError: false, debugInfo: '' })
    this.retryCount = 0
    this.loadTask()
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