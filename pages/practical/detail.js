import { getAIConfig, savePracticalSubmission, getPracticalSubmissions } from '../../utils/storage'

Page({
  data: {
    loading: true,
    loadError: false,
    task: null,
    answer: '',
    // 代码填空
    codeLines: [],
    blankValues: {},
    // 评分标准折叠
    criteriaOpen: false,
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
      this.setData({ loading: false, loadError: true, debugInfo: `未找到题目 ID=${this.questionId}` })
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

    // 从模板生成代码行
    let codeLines = []
    let blankValues = {}
    const saved = this.loadDraft()

    if (type === 'code' && this.templates && this.templates[this.questionId]) {
      const segments = this.templates[this.questionId].segments || []
      if (saved?.blanks) blankValues = { ...saved.blanks }
      codeLines = this.splitSegmentsToLines(segments)
    }

    const answer = saved?.text || ''

    this.setData({
      loading: false,
      loadError: false,
      task,
      codeLines,
      blankValues,
      answer,
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
    try {
      const res = await wx.cloud.callFunction({ name: 'getTemplates' })
      if (res.result && !res.result.error && typeof res.result === 'object') return res.result
    } catch (err) {
      console.warn('getTemplates 云函数不可用:', err.message)
    }
    try {
      const fs = wx.getFileSystemManager()
      const content = fs.readFileSync(`${wx.env.USER_DATA_PATH}/code-templates.json`, 'utf-8')
      return JSON.parse(content)
    } catch {
      return {}
    }
  },

  splitSegmentsToLines(segments) {
    const lines = []
    let currentLine = []
    const flush = () => { if (currentLine.length) { lines.push(currentLine); currentLine = [] } }
    for (const seg of segments) {
      if (seg.kind === 'text') {
        const parts = String(seg.value).split('\n')
        for (let i = 0; i < parts.length; i++) {
          if (i > 0) flush()
          if (parts[i].length > 0) currentLine.push({ kind: 'text', value: parts[i] })
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
    this.setData({
      answer: e.detail.value,
      gradeResult: null,
      hasContent: e.detail.value.trim().length > 0
    })
  },

  toggleCriteria() {
    this.setData({ criteriaOpen: !this.data.criteriaOpen })
  },

  saveDraft() {
    const task = this.data.task
    if (!task) return
    savePracticalSubmission({
      id: `practical:${task.id}:draft`,
      questionId: task.id,
      canonicalId: task.id,
      type: task.type,
      answer: task.type === 'code' ? { blanks: this.data.blankValues } : { text: this.data.answer },
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
        success: (res) => { if (res.confirm) wx.switchTab({ url: '/pages/settings/settings' }) }
      })
      return
    }

    wx.showLoading({ title: 'AI 判题中…', mask: true })

    try {
      const submission = task.type === 'code'
        ? { text: this.assembleCode() }
        : { text: this.data.answer }

      const endpoint = (config.baseUrl || 'https://api.openai.com/v1')
        .replace(/\/$/, '')
        .replace(/\/chat\/completions$/, '')

      const subText = submission.text || ''

      // 构建判分 Prompt
      const isCode = task.type === 'code'
      const prompt = isCode
        ? `你是严格的代码填空评分器。只依据考生实际提交代码和题目评分点评分。逐项检查：如果该评分项对应的代码仍包含下划线空缺，必须给该项0分。不要运行代码。每项分数只能是0到该项满分的整数。返回JSON对象 {"items":[{"id":"M1","score":0,"reason":"..."}]}。\n题目：${JSON.stringify(task.question)}\n评分点：${JSON.stringify(task.scoreItems)}\n考生提交代码：${subText}`
        : `你是严格的文档作答评分器。根据题目要求和评分点逐项评阅考生的作答内容。每项分数只能是0到该项满分的整数。返回JSON对象 {"items":[{"id":"M1","score":0,"reason":"..."}]}。\n题目：${JSON.stringify(task.question)}\n评分点：${JSON.stringify(task.scoreItems)}\n考生作答：${subText}`

      const res = await this.callLLM(endpoint, config.apiKey, config.model, prompt)
      wx.hideLoading()

      if (res.error) {
        this.setData({ gradeResult: { error: res.error } })
        return
      }

      // 标准化评分结果
      const raw = res.data
      const returned = new Map((raw?.items || []).map((item, i) => [item.id || `M${i + 1}`, item]))
      const items = task.scoreItems.map((item, i) => {
        const id = item.id || `M${i + 1}`
        const result = returned.get(id)
        const score = Math.max(0, Math.min(Number(item.score), Number(result?.score) || 0))
        return { id, score, max_score: Number(item.score), reason: result?.reason || 'AI 未返回该评分项' }
      })
      const totalScore = items.reduce((s, item) => s + item.score, 0)
      const maxScore = task.scoreItems.reduce((s, item) => s + Number(item.score), 0)

      this.setData({
        gradeResult: { total_score: totalScore, maxScore, items }
      })
    } catch (err) {
      wx.hideLoading()
      this.setData({ gradeResult: { error: err.message } })
    }
  },

  callLLM(baseUrl, apiKey, model, prompt) {
    return new Promise((resolve) => {
      wx.request({
        url: `${baseUrl}/chat/completions`,
        method: 'POST',
        timeout: 60000,
        header: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        data: {
          model: model || 'deepseek-chat',
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: '严格按给定参考答案判分，不要自行接受替代写法。' },
            { role: 'user', content: prompt }
          ]
        },
        success(res) {
          if (res.statusCode >= 400) {
            const msg = res.data?.error?.message || `HTTP ${res.statusCode}`
            resolve({ error: `LLM API 返回错误: ${msg}` })
            return
          }
          const content = res.data?.choices?.[0]?.message?.content || '{}'
          try {
            const parsed = JSON.parse(content.replace(/^```json\s*/i, '').replace(/```$/i, '').trim())
            resolve({ data: parsed })
          } catch (e) {
            resolve({ error: `解析 AI 返回失败: ${e.message}，原始内容: ${content.slice(0, 100)}` })
          }
        },
        fail(err) {
          resolve({ error: `网络请求失败: ${err.errMsg || err.message}` })
        }
      })
    })
  },

  assembleCode() {
    const segments = this.templates?.[this.questionId]?.segments || []
    return segments.map((seg) => {
      if (seg.kind === 'blank') return this.data.blankValues[seg.id] || '______'
      return seg.value
    }).join('')
  }
})