import { getAIConfig, savePracticalSubmission, getPracticalSubmissions } from '../../utils/storage'
import { practicalTaskType, splitDocSubQuestions, gradeCodeTask, buildBlankAnswers, extractKeywords, gradeByScorePoints } from '../../utils/domain'
import { CLOUD_FUNCTIONS } from '../../utils/constants'

Page({
  data: {
    loading: true,
    loadError: false,
    task: null,
    answer: '',           // 文档作答（单框）
    docAnswer: '',        // 混合题的文档部分
    docSections: [],      // 文档题多子问 [{ key, num, prompt, value }]
    // 代码填空
    codeLines: [],
    blankValues: {},
    blankAnswers: [],     // 逐空参考答案与解析 [{ blankId, hint, status, userValue, ... }]
    blankStatusMap: {},  // { blankId: 'correct'|'wrong'|'empty' }
    blankAnswerMap: {},  // { blankId: '标准答案文本' }
    verified: false,       // 是否已验证
    currentAnalysis: null, // { blankId, hint, reference, explanation, commonMistake, contrast }
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

    // 判定题型：code / document / mixed
    const type = practicalTaskType(q)
    const hasTemplate = q.type === 'code_practice' || type === 'code' || type === 'mixed'

    // 加载代码模板
    if (!this.templates && hasTemplate) {
      try {
        this.templates = await this.loadTemplates()
      } catch (err) {
        console.warn('代码模板加载失败:', err.message)
      }
    }

    const task = {
      id: q.id,
      title: (q.title || q.question?.split('：')[0] || '未命名任务').trim(),
      question: q.question || '请按题目要求完成本任务。',
      type,
      scoreItems: q.score_items || [],
      maxScore: q.score_total || (q.score_items || []).reduce((s, i) => s + Number(i.score), 0)
    }

    // 生成代码行（code / mixed 且有模板）
    let codeLines = []
    let blankValues = {}
    let blankAnswers = []
    const saved = this.loadDraft()

    if (hasTemplate && this.templates && this.templates[this.questionId]) {
      const segments = this.templates[this.questionId].segments || []
      if (saved?.blanks) blankValues = { ...saved.blanks }
      codeLines = this.splitSegmentsToLines(segments)
      const refAns = this.templates[this.questionId].referenceAnswers || {}
      blankAnswers = buildBlankAnswers(segments, blankValues, refAns)
    }

    // 文档部分：document 用 answer/sections，mixed 用 docAnswer
    let docSections = []
    let docAnswer = ''
    if (type === 'document') {
      const subs = splitDocSubQuestions(q)
      if (subs.length > 0) {
        const savedSections = (saved?.sections || []).reduce((map, s) => {
          map[s.id] = s.value || ''
          return map
        }, {})
        docSections = subs.map((s) => ({
          key: s.id,
          num: s.num,
          prompt: s.prompt,
          value: savedSections[s.id] || ''
        }))
      } else {
        docAnswer = saved?.text || ''
      }
    } else if (type === 'mixed') {
      docAnswer = saved?.docText || ''
    }

    this.setData({
      loading: false,
      loadError: false,
      task,
      codeLines,
      blankValues,
      blankAnswers,
      answer: docAnswer,
      docAnswer,
      docSections,
      hasContent: this.computeHasContent(type, blankValues, docAnswer, docSections)
    })

    wx.setNavigationBarTitle({ title: (task.title || '实操任务').slice(0, 20) })
  },

  computeHasContent(type, blankValues, docText, docSections) {
    const blanksFilled = Object.keys(blankValues).some((k) => blankValues[k]?.trim())
    const sectionsFilled = (docSections || []).some((s) => s.value && s.value.trim().length > 0)
    if (type === 'code') return blanksFilled
    if (type === 'mixed') return blanksFilled || (docText && docText.trim().length > 0)
    if (sectionsFilled) return true
    return docText && docText.trim().length > 0
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
      verified: false,
      blankStatusMap: {},
      gradeResult: null,
      hasContent: this.computeHasContent(
        this.data.task.type, blankValues,
        this.data.task.type === 'mixed' ? this.data.docAnswer : this.data.answer,
        this.data.docSections
      )
    })
  },

  onAnswerInput(e) {
    const isMixed = this.data.task.type === 'mixed'
    const answer = e.detail.value
    this.setData({
      answer,
      docAnswer: isMixed ? answer : this.data.docAnswer,
      gradeResult: null,
      hasContent: this.computeHasContent(this.data.task.type, this.data.blankValues, answer, this.data.docSections)
    })
  },

  /** 文档题子问输入 */
  onDocSectionInput(e) {
    const key = e.currentTarget.dataset.key
    const docSections = this.data.docSections.map((s) =>
      s.key === key ? { ...s, value: e.detail.value } : s
    )
    this.setData({
      docSections,
      gradeResult: null,
      hasContent: this.computeHasContent(this.data.task.type, this.data.blankValues, this.data.answer, docSections)
    })
  },

  toggleCriteria() {
    this.setData({ criteriaOpen: !this.data.criteriaOpen })
  },

  saveDraft() {
    const task = this.data.task
    if (!task) return

    const answerMap = {
      code: { blanks: this.data.blankValues },
      document: this.data.docSections.length
        ? { sections: this.data.docSections.map((s) => ({ id: s.key, value: s.value })) }
        : { text: this.data.answer },
      mixed: { blanks: this.data.blankValues, docText: this.data.docAnswer }
    }

    savePracticalSubmission({
      id: `practical:${task.id}:draft`,
      questionId: task.id,
      canonicalId: task.id,
      type: task.type,
      answer: answerMap[task.type] || {},
      status: 'draft',
      savedAt: new Date().toISOString()
    })
    wx.showToast({ title: '草稿已保存', icon: 'success' })
  },

  /** 代码题验证答案（规则匹配 + 逐空标记） */
  verifyAnswers() {
    const task = this.data.task
    const segments = this.templates?.[this.questionId]?.segments || []
    if (!segments.length) {
      wx.showToast({ title: '无法获取代码模板', icon: 'none' })
      return
    }

    const blankValues = { ...this.data.blankValues }
    const refAns = this.templates?.[this.questionId]?.referenceAnswers || {}
    const blankAnswers = buildBlankAnswers(segments, blankValues, refAns)

    // 构建逐空状态映射 { blankId: 'correct'|'wrong'|'empty' }
    const blankStatusMap = {}
    const blankAnswerMap = {}
    for (const ba of blankAnswers) {
      blankStatusMap[ba.blankId] = ba.status
      blankAnswerMap[ba.blankId] = ba.reference
    }

    // 按「评分点 → 填空」映射判分：总分与填空红绿完全一致
    let result = gradeByScorePoints(blankStatusMap, this.questionId)
    if (!result || !result.items.length) {
      // 该题无映射时回退到关键词判分
      const userCode = this.assembleCode()
      result = gradeCodeTask(userCode, task.scoreItems)
      result.mode = 'rule'
    } else {
      // 补上评分点描述，便于展示明细
      result = {
        ...result,
        items: result.items.map((it) => {
          const src = (task.scoreItems || []).find((s) => s.id === it.id)
          return { ...it, desc: src ? (src.desc || '') : '' }
        })
      }
    }

    this.setData({
      gradeResult: result,
      blankAnswers,
      blankStatusMap,
      blankAnswerMap,
      verified: true,
      currentAnalysis: null
    })
  },

  /** 点击标准答案 → 打开解析弹窗 */
  openBlankAnalysis(e) {
    const blankId = e.currentTarget.dataset.blankId
    const item = this.data.blankAnswers.find((ba) => ba.blankId === blankId)
    if (item) {
      this.setData({ currentAnalysis: item })
    }
  },

  /** 关闭解析弹窗 */
  closeBlankAnalysis() {
    this.setData({ currentAnalysis: null })
  },

  noop() {},

  /** 混合题/文档题 AI 评测 */
  async submitGrade() {
    const task = this.data.task
    const config = getAIConfig()

    // 混合题：拆成代码部分(按评分点判分) + 文档部分(AI)
    if (task.type === 'mixed') {
      const segments = this.templates?.[this.questionId]?.segments || []
      const refAns = this.templates?.[this.questionId]?.referenceAnswers || {}
      const blankAnswers = buildBlankAnswers(segments, this.data.blankValues || {}, refAns)
      const blankStatusMap = {}
      const blankAnswerMap = {}
      for (const ba of blankAnswers) {
        blankStatusMap[ba.blankId] = ba.status
        blankAnswerMap[ba.blankId] = ba.reference
      }

      // 代码部分：按「评分点 → 填空」映射判分
      let codeResult = gradeByScorePoints(blankStatusMap, this.questionId)
      let docItems = []
      if (codeResult && codeResult.items.length) {
        const docIds = new Set(codeResult.docItems)
        docItems = (task.scoreItems || []).filter((i) => docIds.has(i.id))
      } else {
        // 无映射时回退：关键词判分 + 描述正则分离文档题
        const codeItems = []
        for (const item of (task.scoreItems || [])) {
          if (/回答|规范|流程|描述/.test(item.desc || '')) docItems.push(item)
          else codeItems.push(item)
        }
        codeResult = codeItems.length ? gradeCodeTask(this.assembleCode(), codeItems) : { total_score: 0, items: [] }
      }

      let aiResult
      // 文档部分AI评测
      if (docItems.length && this.data.docAnswer.trim()) {
        if (!config.apiKey) {
          wx.showModal({
            title: '未配置 API Key',
            content: '文档部分需要 AI 评测，请先到"我的"页面配置 API Key。',
            confirmText: '去配置',
            success: (r) => { if (r.confirm) wx.switchTab({ url: '/pages/settings/settings' }) }
          })
          return
        }
        wx.showLoading({ title: '文档评测中…', mask: true })
        try {
          const res = await wx.cloud.callFunction({
            name: CLOUD_FUNCTIONS.AI_GRADE,
            data: {
              apiKey: config.apiKey,
              baseUrl: config.baseUrl,
              model: config.model,
              question: task.question,
              scoreItems: docItems,
              submission: { text: this.data.docAnswer }
            }
          })
          wx.hideLoading()
          aiResult = res.result
        } catch (err) {
          wx.hideLoading()
          aiResult = { error: err.message }
        }
      }

      // 合并结果
      const allItems = [
        ...(codeResult?.items || []),
        ...(aiResult?.items || docItems.map((i) => ({ id: i.id, max_score: Number(i.score), score: 0, reason: 'AI 评测未完成' })))
      ]
      const totalScore = (codeResult?.total_score || 0) + (aiResult?.total_score || 0)
      const maxScore = allItems.reduce((s, i) => s + (i.max_score || 0), 0)
      this.setData({
        gradeResult: {
          total_score: totalScore, maxScore, items: allItems,
          mode: 'mixed',
          error: aiResult?.error || null
        },
        blankAnswers,
        blankStatusMap,
        blankAnswerMap,
        verified: true
      })
      return
    }

    // 文档题：AI 评测
    if (!config.apiKey) {
      wx.showModal({
        title: '未配置 API Key',
        content: '请先到"我的"页面配置 API Key，才能使用 AI 评测。',
        confirmText: '去配置',
        success: (r) => { if (r.confirm) wx.switchTab({ url: '/pages/settings/settings' }) }
      })
      return
    }

    wx.showLoading({ title: '智能评测中…', mask: true })
    try {
      const submission = this.buildSubmission()
      const res = await wx.cloud.callFunction({
        name: CLOUD_FUNCTIONS.AI_GRADE,
        data: {
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          model: config.model,
          question: task.question,
          scoreItems: task.scoreItems,
          submission
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
        gradeResult: { total_score: result.total_score, maxScore, items: result.items, mode: 'ai' }
      })
    } catch (err) {
      wx.hideLoading()
      this.setData({ gradeResult: { error: err.message } })
    }
  },

  buildSubmission() {
    const task = this.data.task
    if (task.type === 'document') {
      if (this.data.docSections.length) {
        const sections = this.data.docSections.map((s) => `（${s.num}）${s.value || ''}`).join('\n')
        return { text: sections }
      }
      return { text: this.data.answer }
    }
    if (task.type === 'mixed') {
      return {
        text: this.assembleCode(),
        docText: this.data.docAnswer
      }
    }
    return { text: this.assembleCode() }
  },

  assembleCode() {
    const segments = this.templates?.[this.questionId]?.segments || []
    return segments.map((seg) => {
      if (seg.kind === 'blank') return this.data.blankValues[seg.id] || '______'
      return seg.value
    }).join('')
  }
})