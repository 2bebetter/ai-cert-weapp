import { scoreTheory, getTypeLabel } from '../../utils/domain'
import {
  getTheoryAttempts, addTheoryAttempt,
  getFavorites, toggleFavorite,
  addWrongBook, removeWrongBook, getWrongBook,
  saveTheoryNote, getNotes
} from '../../utils/storage'

Page({
  data: {
    loading: true,
    loadError: false,
    filtered: [],
    currentIndex: 0,
    currentQuestion: null,
    renderOptions: [],
    selectedKeys: [],
    submitted: false,
    feedback: null,
    isFavorited: false,
    isWrongBook: false,
    hasNote: false,
    noteText: '',
    noteModalVisible: false,
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
      this.syncQuestionMeta()
    }
  },

  async loadQuestions() {
    const app = getApp()

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
      feedback: null,
      renderOptions: currentQuestion
        ? this.buildRenderOptions(currentQuestion, [], false) : []
    })

    if (currentQuestion) {
      this.syncQuestionMeta()
    }
  },

  retry() {
    this.setData({ loading: true, loadError: false })
    this.loadQuestions()
  },

  applyFilters(questions) {
    let result = [...questions]
    if (this.data.filterTypeIndex === 1) result = result.filter((q) => q.type === 'judge')
    else if (this.data.filterTypeIndex === 2) result = result.filter((q) => q.type === 'single')
    else if (this.data.filterTypeIndex === 3) result = result.filter((q) => q.type === 'multiple')
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
      feedback: null,
      renderOptions: currentQuestion
        ? this.buildRenderOptions(currentQuestion, [], false) : []
    })
    if (currentQuestion) this.syncQuestionMeta()
  },

  buildRenderOptions(question, selectedKeys, submitted) {
    if (!question || !question.options) return []
    return question.options.map((opt) => {
      const isSelected = selectedKeys.includes(opt.key)
      let cls = ''
      if (!submitted) {
        cls = isSelected ? 'selected' : ''
      } else {
        const isCorrect = question.answer && question.answer.includes(opt.key)
        if (isCorrect) cls = 'correct'
        else if (isSelected && !isCorrect) cls = 'wrong'
      }
      return {
        key: opt.key,
        value: opt.value,
        checked: isSelected,
        cls
      }
    })
  },

  /** 从本地存储同步本题的收藏/错题本/笔记状态 */
  syncQuestionMeta() {
    const q = this.data.currentQuestion
    if (!q) return
    const qid = String(q.id)
    try {
      this.setData({
        typeLabel: getTypeLabel(q.type),
        typeTagClass: q.type === 'judge' ? 'tag' :
          q.type === 'single' ? 'tag tag-success' : 'tag tag-warning',
        isFavorited: getFavorites().has(qid),
        isWrongBook: getWrongBook().includes(qid),
        hasNote: !!((getNotes().theory || {})[qid])
      })
    } catch (e) {
      console.warn('syncQuestionMeta 失败', e)
      this.setData({ isFavorited: false, isWrongBook: false, hasNote: false })
      wx.showToast({ title: '状态读取失败, 请重试', icon: 'none' })
    }
  },

  onSelectOption(e) {
    if (this.data.submitted) return

    const { key, type } = e.currentTarget.dataset
    let selectedKeys

    if (type === 'single' || type === 'judge') {
      selectedKeys = [key]
    } else {
      selectedKeys = [...this.data.selectedKeys]
      const idx = selectedKeys.indexOf(key)
      if (idx >= 0) selectedKeys.splice(idx, 1)
      else selectedKeys.push(key)
    }

    const renderOptions = this.buildRenderOptions(this.data.currentQuestion, selectedKeys, false)
    this.setData({ selectedKeys, renderOptions })
  },

  submitAnswer() {
    const question = this.data.currentQuestion
    if (!question) return

    const result = scoreTheory(question, this.data.selectedKeys)
    const confidence = Number.isInteger(question.confidence) ? question.confidence : 0
    const qid = String(question.id)

    if (!question.answer.length || question.answer_status === 'unverified' || confidence === 0) {
      this.setData({
        submitted: true,
        feedback: { class: 'warn', title: '答案待核对', body: '该题没有可验证的参考答案，当前不会判定对错。' },
        renderOptions: this.buildRenderOptions(question, this.data.selectedKeys, true)
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
      },
      renderOptions: this.buildRenderOptions(question, this.data.selectedKeys, true)
    })

    addTheoryAttempt({
      id: `${question.id}_${Date.now()}`,
      questionId: qid,
      type: question.type,
      selected: this.data.selectedKeys,
      correct: result.correct,
      attemptedAt: new Date().toISOString()
    })

    // 注意：答错不自动加入错题本，由用户手动控制
  },

  /** 右上角图标统一分发 */
  onHeadAction(e) {
    const action = e.currentTarget.dataset.action
    if (action === 'wrongbook') this.toggleWrongBook()
    else if (action === 'note') this.openNoteModal()
    else if (action === 'favorite') this.toggleFavorite()
  },

  toggleFavorite() {
    const q = this.data.currentQuestion
    if (!q) return
    const nowFav = toggleFavorite(q.id)
    this.setData({ isFavorited: nowFav })
    wx.showToast({ title: nowFav ? '已收藏' : '已取消收藏', icon: 'none' })
  },

  toggleWrongBook() {
    const q = this.data.currentQuestion
    if (!q) return
    const qid = String(q.id)
    try {
      const inBook = getWrongBook().includes(qid)
      if (inBook) {
        removeWrongBook(qid)
        this.setData({ isWrongBook: false })
        wx.showToast({ title: '已移出错题本', icon: 'none' })
      } else {
        addWrongBook(qid)
        this.setData({ isWrongBook: true })
        wx.showToast({ title: '已加入错题本', icon: 'none' })
      }
    } catch (e) {
      console.warn('toggleWrongBook 失败', e)
      wx.showToast({ title: '操作失败，请重试', icon: 'none' })
    }
  },

  openNoteModal() {
    const q = this.data.currentQuestion
    if (!q) return
    this.setData({
      noteModalVisible: true,
      noteText: (getNotes().theory || {})[String(q.id)] || ''
    })
  },

  closeNoteModal() {
    this.setData({ noteModalVisible: false })
  },

  onNoteInput(e) {
    this.setData({ noteText: e.detail.value })
  },

  saveNote() {
    const q = this.data.currentQuestion
    if (!q) return
    try {
      saveTheoryNote(String(q.id), this.data.noteText)
      this.setData({
        noteModalVisible: false,
        hasNote: !!this.data.noteText
      })
      wx.showToast({ title: '笔记已保存', icon: 'success' })
    } catch (e) {
      console.warn('saveNote 失败', e)
      wx.showToast({ title: '保存失败，请重试', icon: 'none' })
    }
  },

  /** 从复习页跳转到指定题目 */
  navigateToQuestion(id) {
    const idx = this.data.filtered.findIndex((q) => String(q.id) === id)
    if (idx >= 0) {
      const q = this.data.filtered[idx]
      this.setData({
        currentIndex: idx,
        currentQuestion: q,
        selectedKeys: [],
        submitted: false,
        feedback: null,
        renderOptions: q ? this.buildRenderOptions(q, [], false) : []
      })
      this.syncQuestionMeta()
    }
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
      feedback: null,
      renderOptions: q ? this.buildRenderOptions(q, [], false) : []
    })
    this.syncQuestionMeta()
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
      feedback: null,
      renderOptions: q ? this.buildRenderOptions(q, [], false) : []
    })
    this.syncQuestionMeta()
  }
})