import { scoreTheory, getTypeLabel } from '../../utils/domain'
import {
  getTheoryAttempts, addTheoryAttempt,
  getFavorites, toggleFavorite
} from '../../utils/storage'

Page({
  data: {
    loading: true,
    loadError: false,
    filtered: [],
    currentIndex: 0,
    currentQuestion: null,
    selectedKeys: [],
    submitted: false,
    feedback: null,
    isFavorited: false,
    typeLabel: '',
    typeTagClass: 'tag',
    filterTypes: ['全部题型', '判断题', '单选题', '多选题'],
    filterTypeIndex: 0,
    filterAnswers: ['有答案的题', '全部理论题', '高可信/人工确认'],
    filterAnswerIndex: 0,
    lastAnswerVisible: false
  },

  onLoad() {
    this.loadQuestions()
  },

  onShow() {
    if (!this.data.loading && !this.data.currentQuestion && !this.data.loadError) {
      this.loadQuestions()
    }
    if (this.data.currentQuestion) {
      this.updateFavoriteStatus()
    }
  },

  async loadQuestions() {
    const app = getApp()

    // 如果还没数据，等 preload 完成
    let questions = app.globalData.theoryQuestions
    if (!questions || !questions.length) {
      const result = await app.loadQuestions()
      if (!result) {
        this.setData({ loading: false, loadError: true })
        return
      }
      questions = app.globalData.theoryQuestions
    }

    const all = questions || []
    const filtered = this.applyFilters(all)
    const currentQuestion = filtered[0] || null

    this.setData({
      loading: false,
      loadError: false,
      filtered,
      currentIndex: 0,
      currentQuestion,
      selectedKeys: [],
      submitted: false,
      feedback: null
    })

    if (currentQuestion) {
      this.updateQuestionMeta(currentQuestion)
    }
  },

  retry() {
    this.setData({ loading: true, loadError: false })
    this.loadQuestions()
  },

  applyFilters(questions) {
    let result = [...questions]

    // 题型筛选
    if (this.data.filterTypeIndex === 1) result = result.filter((q) => q.type === 'judge')
    else if (this.data.filterTypeIndex === 2) result = result.filter((q) => q.type === 'single')
    else if (this.data.filterTypeIndex === 3) result = result.filter((q) => q.type === 'multiple')

    // 答案筛选
    if (this.data.filterAnswerIndex === 0) result = result.filter((q) => q.answer && q.answer.length)
    else if (this.data.filterAnswerIndex === 2) result = result.filter((q) => ['verified', 'manual'].includes(q.answer_status))

    return result
  },

  onFilterTypeChange(e) {
    this.setData({ filterTypeIndex: Number(e.detail.value) })
    this.reFilter()
  },

  onFilterAnswerChange(e) {
    this.setData({ filterAnswerIndex: Number(e.detail.value) })
    this.reFilter()
  },

  reFilter() {
    const all = getApp().globalData.theoryQuestions || []
    const filtered = this.applyFilters(all)
    const currentQuestion = filtered[0] || null
    this.setData({
      filtered,
      currentIndex: 0,
      currentQuestion,
      selectedKeys: [],
      submitted: false,
      feedback: null
    })
    if (currentQuestion) this.updateQuestionMeta(currentQuestion)
  },

  updateQuestionMeta(question) {
    const typeLabel = getTypeLabel(question.type)
    const typeTagClass = question.type === 'judge' ? 'tag' :
      question.type === 'single' ? 'tag tag-success' : 'tag tag-warning'
    this.setData({ typeLabel, typeTagClass })
    this.updateFavoriteStatus()
  },

  updateFavoriteStatus() {
    const q = this.data.currentQuestion
    if (!q) return
    const favs = getFavorites()
    this.setData({ isFavorited: favs.has(String(q.id)) })
  },

  onSelectOption(e) {
    if (this.data.submitted) return

    const { key, type } = e.currentTarget.dataset

    if (type === 'single' || type === 'judge') {
      this.setData({ selectedKeys: [key] })
    } else if (type === 'multiple') {
      let keys = [...this.data.selectedKeys]
      const idx = keys.indexOf(key)
      if (idx >= 0) keys.splice(idx, 1)
      else keys.push(key)
      this.setData({ selectedKeys: keys })
    }
  },

  optionClass(key) {
    const q = this.data.currentQuestion
    if (!this.data.submitted || !q) return ''
    const isCorrect = q.answer.includes(key)
    const isSelected = this.data.selectedKeys.includes(key)
    if (isCorrect) return 'correct'
    if (isSelected && !isCorrect) return 'wrong'
    return ''
  },

  submitAnswer() {
    const question = this.data.currentQuestion
    if (!question) return

    const result = scoreTheory(question, this.data.selectedKeys)
    const confidence = Number.isInteger(question.confidence) ? question.confidence : 0

    if (!question.answer.length || question.answer_status === 'unverified' || confidence === 0) {
      this.setData({
        submitted: true,
        feedback: { class: 'warn', title: '答案待核对', body: '该题没有可验证的参考答案，当前不会判定对错。' }
      })
      return
    }

    const text = question.answer.length ? question.answer.join('、') : '尚未回填参考答案'
    this.setData({
      submitted: true,
      feedback: {
        class: result.correct ? 'ok' : 'bad',
        title: result.correct ? '回答正确' : '回答错误',
        body: `正确答案：${text}\n${question.analysis || ''}${confidence < 90 ? '\n仅供参考，请自行核对' : ''}`
      }
    })

    // 记录作答
    addTheoryAttempt({
      id: `${question.id}_${Date.now()}`,
      questionId: String(question.id),
      type: question.type,
      selected: this.data.selectedKeys,
      correct: result.correct,
      attemptedAt: new Date().toISOString()
    })
  },

  toggleFavorite() {
    const q = this.data.currentQuestion
    if (!q) return
    const nowFav = toggleFavorite(q.id)
    this.setData({ isFavorited: nowFav })
    wx.showToast({ title: nowFav ? '已收藏' : '已取消', icon: 'none' })
  },

  prevQuestion() {
    if (this.data.currentIndex <= 0) return
    const idx = this.data.currentIndex - 1
    const q = this.data.filtered[idx]
    this.setData({
      currentIndex: idx,
      currentQuestion: q,
      selectedKeys: [],
      submitted: false,
      feedback: null
    })
    this.updateQuestionMeta(q)
  },

  nextQuestion() {
    if (this.data.currentIndex >= this.data.filtered.length - 1) return
    const idx = this.data.currentIndex + 1
    const q = this.data.filtered[idx]
    this.setData({
      currentIndex: idx,
      currentQuestion: q,
      selectedKeys: [],
      submitted: false,
      feedback: null
    })
    this.updateQuestionMeta(q)
  }
})