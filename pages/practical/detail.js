import { getAIConfig, savePracticalSubmission, getPracticalSubmissions } from '../../utils/storage'
import { CLOUD_FUNCTIONS } from '../../utils/constants'

Page({
  data: {
    loading: true,
    loadError: false,
    task: null,
    answer: '',
    // 代码填空相关
    codeLines: [],          // 渲染用行数组 [{parts: [{kind,value,id}]}]
    blankValues: {},        // 填空值 { blankId: value }
    // 自评相关
    scoreChecked: [],       // 评分点勾选状态
    calculatedScore: 0,     // 自评总分
    hasContent: false,
    gradeResult: null,
    debugInfo: ''
  },

  onLoad(options) {
    this.questionId = options.questionId
    this.retryCount = 0
    this.maxRetries = 20
    this.templates = null
    this.loadTask()
  },

  async loadTask() {
    const app = getApp()
    let questions = app.globalData.practicalQuestions

    if (!questions || !questions.length) {
      if (!app.globalData.questions) {
        await app.loadQuestions()
        questions = app.globalData.practicalQuestions
      } else if (this.retryCount < this.maxRetries) {
        this.retryCount++
        setTimeout(() => this.loadTask(), 300)
        return
      } else {
        this.setData({ loading: false, loadError: true, debugInfo: '题库加载超时' })
        return
      }
    }

    if (!questions || !questions.length) {
      this.setData({ loading: false, loadError: true, debugInfo: 'practicalQuestions 为空' })
      return
    }

    const q = questions.find((item) => String(item.id) === this.questionId)
    if (!q) {
      this.setData({
        loading: false,
        loadError: true,
        debugInfo: `未找到题目 ID=${this.questionId}，题库有 ${questions.length} 道题`
      })
      return
    }

    // 加载代码模板
    if (!this.templates && q.type === 'code_practice') {
      try {
        this.templates = await this.loadTemplates()
      } catch (err) {
        console.warn('代码模板加载失败:', err.message)
      }
    }

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

    // 生成代码行（代码任务且有模板）
    let codeLines = []
    let blankValues = {}
    const savedAnswer = this.loadDraft()

    if (type === 'code' && this.templates && this.templates[this.questionId]) {
      const segments = this.templates[this.questionId].segments || []
      // 恢复已填写的空白
      if (savedAnswer?.blanks) {
        blankValues = { ...savedAnswer.blanks }
      }
      // 拆分 segments 为行
      codeLines = this.splitSegmentsToLines(segments)
    }

    const answer = savedAnswer?.text || savedAnswer?.code || ''
    const scoreChecked = task.scoreItems.map((_, index) => {
      return savedAnswer?.checkedIndexes?.includes(index) || false
    })
    const calculatedScore = this.calcScore(task.scoreItems, scoreChecked)

    this.setData({
      loading: false,
      loadError: false,
      task,
      codeLines,
      blankValues,
      answer,
      scoreChecked,
      calculatedScore,
      hasContent: type === 'code'
        ? Object.keys(blankValues).some((k) => blankValues[k]?.trim())
        : answer.trim().length > 0
    })

    wx.setNavigationBarTitle({ title: (task.title || '实操任务').slice(0, 20) })
  },

  loadDraft() {
    const submissions = getPracticalSubmissions()
    const drafts = submissions.filter((s) => s.questionId === this.questionId && s.status === 'draft')
    const draft = drafts[drafts.length - 1]
    return draft?.answer || null
  },

  async loadTemplates() {
    // 从云存储加载代码模板（非必需，加载失败不影响题目显示）
    try {
      const res = await wx.cloud.callFunction({ name: 'getTemplates' })
      if (res.result && !res.result.error && typeof res.result === 'object') {
        return res.result
      }
    } catch (err) {
      console.warn('getTemplates 云函数不可用:', err.message)
    }
    // 本地缓存兜底
    try {
      const fs = wx.getFileSystemManager()
      const content = fs.readFileSync(`${wx.env.USER_DATA_PATH}/code-templates.json`, 'utf-8')
      return JSON.parse(content)
    } catch (e2) {
      console.warn('本地也无模板缓存')
      return {}
    }
  },

  // 将模板 segments 拆分为渲染行
  splitSegmentsToLines(segments) {
    const lines = []
    let currentLine = []

    const flush = () => {
      if (currentLine.length) {
        lines.push(currentLine)
        currentLine = []
      }
    }

    for (const seg of segments) {
      if (seg.kind === 'text') {
        const parts = String(seg.value).split('\n')
        for (let i = 0; i < parts.length; i++) {
          if (i > 0) flush()
          if (parts[i].length > 0) {
            currentLine.push({ kind: 'text', value: parts[i] })
          }
        }
      } else {
        currentLine.push({ kind: 'blank', id: seg.id, value: '' })
      }
    }
    flush()
    return lines
  },

  onBlankInput(e) {
    const id = e.currentTarget.dataset.blankId
    const blankValues = { ...this.data.blankValues, [id]: e.detail.value }
    this.setData({
      blankValues,
      hasContent: Object.keys(blankValues).some((k) => blankValues[k]?.trim())
    })
  },

  onAnswerInput(e) {
    this.setData({ answer: e.detail.value, gradeResult: null, hasContent: e.detail.value.trim().length > 0 })
  },

  // 评分点自评勾选
  toggleScoreItem(e) {
    const index = Number(e.currentTarget.dataset.index)
    const scoreChecked = [...this.data.scoreChecked]
    scoreChecked[index] = !scoreChecked[index]
    const calculatedScore = this.calcScore(this.data.task.scoreItems, scoreChecked)
    this.setData({ scoreChecked, calculatedScore })
  },

  calcScore(scoreItems, checked) {
    return scoreItems.reduce((sum, item, index) => {
      return sum + (checked[index] ? Number(item.score) : 0)
    }, 0)
  },

  saveDraft() {
    const task = this.data.task
    if (!task) return

    const answer = task.type === 'code'
      ? { blanks: this.data.blankValues }
      : { text: this.data.answer }

    savePracticalSubmission({
      id: `practical:${task.id}:draft`,
      questionId: task.id,
      canonicalId: task.id,
      type: task.type,
      answer,
      checkedIndexes: this.data.scoreChecked.map((v, i) => v ? i : -1).filter((i) => i >= 0),
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
      // 组装提交内容：代码任务提交完整代码，文档任务提交文本
      let submission = { text: this.data.answer }
      if (task.type === 'code') {
        submission = { code: this.assembleCode() }
      }

      const res = await wx.cloud.callFunction({
        name: CLOUD_FUNCTIONS.AI_GRADE,
        data: {
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          model: config.model,
          question: task.question,
          scoreItems: task.scoreItems,
          submission,
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
  },

  // 组装完整代码（文本+填空值）
  assembleCode() {
    const segments = this.templates[this.questionId]?.segments || []
    return segments.map((seg) => {
      if (seg.kind === 'blank') return this.data.blankValues[seg.id] || '______'
      return seg.value
    }).join('')
  }
})