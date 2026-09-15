import { savePracticalSubmission, getPracticalSubmissions } from '../../utils/storage'
import { loadTemplates } from '../../utils/templates'
import { practicalTaskType, splitDocSubQuestions, gradeCodeTask, buildBlankAnswers, gradeByScorePoints, parseQuestionSections, splitHighlight, splitInlineCode } from '../../utils/domain'
import { REFERENCE_ANSWERS } from '../../utils/reference-answers'

const UI_STATE_KEY = 'practical_ui_state'
const VISIBLE_TASKS = 3   // 收起时显示的任务条数

/** 评分点是否属于「文档作答」部分 —— 这些不再判分，只在参考答案里对照 */
function isDocScoreItem(item) {
  return /回答|规范|流程|描述/.test((item && item.desc) || '')
}

const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳']

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
    // 题干 / 评分标准 的展开状态（本地保留，不随弹窗、验证答案重置）
    qSections: null,      // { background, tasks, fields, output }
    questionOpen: false,  // 题干默认收起，只显示背景简述 + 前 3 条任务
    criteriaOpen: false,  // 评分标准默认收起
    hasMoreTasks: false,
    hasContent: false,
    gradeResult: null,
    referenceAnswer: null,  // 文档题的参考答案（按版本号索引）
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
      scoreItems: (q.score_items || []).map((it, i) => ({ ...it, mark: CIRCLED[i] || String(i + 1) })),
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

    // 展开 / 收起状态本地保留（按题目 id 存）
    const uiSaved = (wx.getStorageSync(UI_STATE_KEY) || {})[this.questionId] || {}
    const uiState = {
      questionOpen: !!uiSaved.questionOpen,
      criteriaOpen: !!uiSaved.criteriaOpen
    }

    const qSections = parseQuestionSections(q.question || '')
    let collapsedHint = ''
    if (qSections) {
      qSections.bgParts = splitHighlight(qSections.background)
      qSections.fieldParts = splitHighlight(qSections.fields)
      qSections.outputParts = splitHighlight(qSections.output)
      qSections.tasks = qSections.tasks.map((t) => ({ ...t, parts: splitHighlight(t.text) }))

      // 收起时到底藏了什么，明确写出来，避免用户以为「点了没反应」
      const hidden = []
      const rest = qSections.tasks.length - VISIBLE_TASKS
      if (rest > 0) hidden.push(`${rest} 条任务`)
      if (qSections.fields) hidden.push('数据集字段说明')
      if (qSections.output) hidden.push('输出与保存要求')
      collapsedHint = hidden.length ? `已折叠 ${hidden.join('、')}` : ''
    }
    this.setData({
      loading: false,
      loadError: false,
      task,
      qSections,
      questionOpen: uiState.questionOpen,
      criteriaOpen: uiState.criteriaOpen,
      collapsedHint,
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
    return loadTemplates()
  },

  /**
   * 当前作答进度：填了多少 / 总共多少
   * 供列表页展示「进度XX%」
   */
  computeProgress() {
    const type = this.data.task ? this.data.task.type : ''
    if (type === 'document') {
      if (this.data.docSections.length) {
        const total = this.data.docSections.length
        const filled = this.data.docSections.filter((s) => String(s.value || '').trim()).length
        return { filled, total }
      }
      return { filled: String(this.data.answer || '').trim() ? 1 : 0, total: 1 }
    }

    const segments = (this.templates && this.templates[this.questionId] && this.templates[this.questionId].segments) || []
    const blankIds = segments.filter((x) => x.kind === 'blank').map((x) => x.id)
    const filledBlanks = blankIds.filter((id) => String(this.data.blankValues[id] || '').trim()).length

    if (type === 'mixed') {
      const docFilled = String(this.data.docAnswer || '').trim() ? 1 : 0
      return { filled: filledBlanks + docFilled, total: blankIds.length + 1 }
    }
    return { filled: filledBlanks, total: blankIds.length || 1 }
  },

  /**
   * 记录一次完成，列表页据此显示「已练习」。
   * score 传 null 表示该题不计分（文档题），此时不写分数，列表只显示状态。
   */
  markSubmitted(score, maxScore) {
    const task = this.data.task
    if (!task) return
    const answerMap = {
      code: { blanks: this.data.blankValues },
      document: this.data.docSections.length
        ? { sections: this.data.docSections.map((x) => ({ id: x.key, value: x.value })) }
        : { text: this.data.answer },
      mixed: { blanks: this.data.blankValues, docText: this.data.docAnswer }
    }
    const record = {
      id: `practical:${task.id}:submitted`,
      questionId: task.id,
      canonicalId: task.id,
      type: task.type,
      answer: answerMap[task.type] || {},
      status: 'submitted',
      progress: this.computeProgress(),
      submittedAt: new Date().toISOString()
    }
    // 文档题不计分（score 传 null）时不写 score/maxScore 字段，
    // 列表页据此显示「已练习」而不是「0 / 0 分」
    if (typeof score === 'number' && !Number.isNaN(score)) {
      record.score = Number(score)
      record.maxScore = Number(maxScore) || 0
    }
    savePracticalSubmission(record)
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
    this.persistUiState()
  },

  /** 题干卡片展开 / 收起（状态本地保留） */
  toggleQuestion() {
    this.setData({ questionOpen: !this.data.questionOpen })
    this.persistUiState()
  },

  /** 把展开 / 收起状态写到本地，重进页面仍保持 */
  persistUiState() {
    try {
      const all = wx.getStorageSync(UI_STATE_KEY) || {}
      all[this.questionId] = {
        questionOpen: this.data.questionOpen,
        criteriaOpen: this.data.criteriaOpen
      }
      wx.setStorageSync(UI_STATE_KEY, all)
    } catch (e) {
      // 存储失败不影响交互
    }
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
      progress: this.computeProgress(),
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

    // 记一次完成，列表页的徽章 / 进度 / 得分随之更新
    this.markSubmitted(result.total_score, result.autoMax || result.maxScore)
  },

  /** 点击标准答案 → 打开解析弹窗 */
  openBlankAnalysis(e) {
    const blankId = e.currentTarget.dataset.blankId
    const item = this.data.blankAnswers.find((ba) => ba.blankId === blankId)
    if (item) {
      this.setData({
        currentAnalysis: {
          ...item,
          explParts: splitInlineCode(item.explanation),
          mistakeParts: splitInlineCode(item.commonMistake)
        }
      })
    }
  },

  /** 关闭解析弹窗 */
  closeBlankAnalysis() {
    this.setData({ currentAnalysis: null })
  },

  noop() {},

  /**
   * 混合题 / 文档题：提交后展示参考答案。
   *
   * 这里原来是把「题目 + 用户作答」发给大模型判分。微信把「AI 生成评语」
   * 归入深度合成类目，而该类目个人主体不开放，所以整体移除了 AI 判分：
   *   · 混合题 —— 代码部分仍按评分点规则匹配判分（不涉及 AI），
   *                文档部分改为展示参考答案，不计分；
   *   · 文档题 —— 不计分，只展示参考答案与评分标准，由考生自行对照。
   * 参考答案来自素材里各题的 reference 文档，按版本号索引。
   */
  async submitGrade() {
    const task = this.data.task

    // 混合题：代码部分按评分点判分 + 文档部分展示参考答案
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
      if (!codeResult || !codeResult.items.length) {
        // 无映射时回退到关键词判分；文档类评分点不参与（它们不计分）
        const codeItems = (task.scoreItems || []).filter((i) => !isDocScoreItem(i))
        codeResult = codeItems.length
          ? gradeCodeTask(this.assembleCode(), codeItems)
          : { total_score: 0, items: [] }
      }

      // 文档部分不再判分，只展示参考答案 —— 分数只反映代码部分
      const maxScore = codeResult.autoMax || codeResult.maxScore || 0
      this.setData({
        gradeResult: {
          total_score: codeResult.total_score || 0,
          maxScore,
          autoMax: maxScore,
          items: codeResult.items || [],
          mode: 'rule'
        },
        referenceAnswer: this.referenceAnswerFor(task),
        criteriaOpen: true,   // 文档部分不计分，自动展开评分标准方便对照
        blankAnswers,
        blankStatusMap,
        blankAnswerMap,
        verified: true
      })
      this.markSubmitted(codeResult.total_score || 0, maxScore)
      return
    }

    // 文档题：不计分，只展示参考答案与评分标准
    this.setData({
      gradeResult: { total_score: 0, maxScore: 0, autoMax: 0, items: [], mode: 'reference' },
      referenceAnswer: this.referenceAnswerFor(task),
      criteriaOpen: true,   // 文档题不计分，自动展开评分标准方便对照
      verified: true
    })
    // 记一次「已练习」，但不写入分数
    this.markSubmitted(null, null)
  },

  /** 取该题所用模型的版本号（1.2.1 / 3.1.1 …）；参考答案按版本号索引 */
  referenceAnswerFor(task) {
    const m = String((task && task.question) || '').match(/(\d+\.\d+\.\d+)/)
    return m ? (REFERENCE_ANSWERS[m[1]] || null) : null
  },

  assembleCode() {
    const segments = this.templates?.[this.questionId]?.segments || []
    return segments.map((seg) => {
      if (seg.kind === 'blank') return this.data.blankValues[seg.id] || '______'
      return seg.value
    }).join('')
  }
})