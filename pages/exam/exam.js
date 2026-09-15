import { buildTheoryExam, scoreTheoryExam, scoreTheory, getTypeLabel } from '../../utils/domain'
import { getExamSessions, saveExamSession, saveExam, getSavedExam, clearSavedExam } from '../../utils/storage'
import { EXAM_DURATION, EXAM_QUOTAS } from '../../utils/constants'
import * as haptic from '../../utils/haptics'

Page({
  data: {
    examStarted: false,
    examFinished: false,
    questions: [],
    currentIndex: 0,
    currentQuestion: null,
    answers: {},       // { [questionId]: [selectedKeys] }
    marked: new Set(), // 标记的题号
    isMarked: false,
    timerDisplay: '90:00',
    timerUrgent: false,
    typeLabel: '',
    examHistory: [],
    navigatorOpen: false,
    questionGroups: [],
    answerKeys: [],
    renderOptions: [], // [{ key, value, checked, cls }]
    examResult: null,
    endTime: 0,
    timer: null
  },

  onLoad() {
    this.loadHistory()
  },

  onUnload() {
    if (this.data.timer) {
      clearInterval(this.data.timer)
    }
  },

  loadHistory() {
    const sessions = getExamSessions()
    const theorySessions = sessions
      .filter((s) => s.kind === 'theory' && s.report)
      .slice(0, 10)
      .map((s) => ({
        id: s.id,
        date: new Date(s.completedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        score: s.report.score,
        maxScore: s.report.maxScore,
        accuracy: s.report.accuracy
      }))
    this.setData({ examHistory: theorySessions })
  },

  startExam() {
    const app = getApp()
    const questions = app.globalData.theoryQuestions
    if (!questions || !questions.length) {
      haptic.warn()
      wx.showToast({ title: '题库未加载，请稍后', icon: 'none' })
      return
    }
    haptic.success()

    // 检查题目数量
    const quotas = EXAM_QUOTAS
    for (const [type, quota] of Object.entries(quotas)) {
      const pool = questions.filter((q) => q.type === type && q.answer?.length)
      if (pool.length < quota) {
        wx.showToast({ title: `${type} 题库不足 ${quota} 题`, icon: 'none' })
        return
      }
    }

    const examQuestions = buildTheoryExam(questions)
    const endTime = Date.now() + EXAM_DURATION
    const groups = this.buildGroups(examQuestions)

    this.setData({
      examStarted: true,
      examFinished: false,
      questions: examQuestions,
      currentIndex: 0,
      currentQuestion: examQuestions[0],
      answers: {},
      marked: new Set(),
      answerKeys: [],
      renderOptions: this.buildRenderOptions(examQuestions[0], []),
      endTime,
      timerDisplay: this.formatTime(EXAM_DURATION),
      timerUrgent: false,
      typeLabel: getTypeLabel(examQuestions[0].type),
      questionGroups: groups,
      examResult: null
    })

    // 保存考试状态（可恢复）
    this.saveExamState()

    // 启动计时器
    if (this.data.timer) clearInterval(this.data.timer)
    const timer = setInterval(() => this.updateTimer(), 1000)
    this.data.timer = timer
  },

  updateTimer() {
    const remaining = Math.max(0, this.data.endTime - Date.now())
    const display = this.formatTime(remaining)
    const urgent = remaining < 5 * 60 * 1000 // 5分钟倒计时变红
    this.setData({ timerDisplay: display, timerUrgent: urgent })

    if (remaining <= 0) {
      clearInterval(this.data.timer)
      this.submitExam()
    }
  },

  formatTime(ms) {
    const totalSec = Math.ceil(ms / 1000)
    const min = Math.floor(totalSec / 60)
    const sec = totalSec % 60
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  },

  buildGroups(questions) {
    const groups = {}
    questions.forEach((q, i) => {
      const type = q.type || 'judge'
      if (!groups[type]) {
        groups[type] = { type, indexes: [], counter: 1 }
      }
      groups[type].indexes.push({ idx: i, num: groups[type].counter++ })
    })
    return Object.values(groups)
  },

  groupLabel(type) {
    return getTypeLabel(type)
  },

  selectOption(e) {
    haptic.tap()
    const key = e.currentTarget.dataset.key
    const q = this.data.currentQuestion
    const answers = { ...this.data.answers }
    const current = [...(answers[q.id] || [])]

    if (q.type === 'single' || q.type === 'judge') {
      answers[q.id] = [key]
    } else {
      const idx = current.indexOf(key)
      if (idx >= 0) current.splice(idx, 1)
      else current.push(key)
      answers[q.id] = current
    }

    this.setData({ answers, answerKeys: answers[q.id] || [] })
    this.syncRenderOptions()
    this.saveExamState()
  },

  buildRenderOptions(question, answerKeys) {
    if (!question || !question.options) return []
    return question.options.map((opt) => ({
      key: opt.key,
      value: opt.value,
      checked: answerKeys.includes(opt.key),
      cls: answerKeys.includes(opt.key) ? 'selected' : ''
    }))
  },

  syncRenderOptions() {
    const q = this.data.currentQuestion
    const keys = this.data.answers[q?.id] || []
    this.setData({
      renderOptions: this.buildRenderOptions(q, keys)
    })
  },

  toggleMark() {
    const q = this.data.currentQuestion
    const marked = new Set(this.data.marked)
    if (marked.has(q.id)) marked.delete(q.id)
    else marked.add(q.id)
    haptic.tap()
    this.setData({ marked, isMarked: marked.has(q.id) })
  },

  prevQuestion() {
    if (this.data.currentIndex <= 0) return
    const idx = this.data.currentIndex - 1
    const q = this.data.questions[idx]
    const answerKeys = this.data.answers[q.id] || []
    this.setData({
      currentIndex: idx,
      currentQuestion: q,
      answerKeys,
      renderOptions: this.buildRenderOptions(q, answerKeys),
      isMarked: this.data.marked.has(q.id),
      typeLabel: getTypeLabel(q.type)
    })
  },

  nextQuestion() {
    if (this.data.currentIndex >= this.data.questions.length - 1) return
    const idx = this.data.currentIndex + 1
    const q = this.data.questions[idx]
    const answerKeys = this.data.answers[q.id] || []
    this.setData({
      currentIndex: idx,
      currentQuestion: q,
      answerKeys,
      renderOptions: this.buildRenderOptions(q, answerKeys),
      isMarked: this.data.marked.has(q.id),
      typeLabel: getTypeLabel(q.type)
    })
  },

  navNumClass(index) {
    const cls = []
    if (index === this.data.currentIndex) cls.push('current')
    const q = this.data.questions[index]
    const answered = (this.data.answers[q.id] || []).length > 0
    if (answered) cls.push('answered')
    if (this.data.marked.has(q.id)) cls.push('marked')
    return cls.join(' ')
  },

  jumpToQuestion(e) {
    const idx = Number(e.currentTarget.dataset.index)
    const q = this.data.questions[idx]
    const answerKeys = this.data.answers[q.id] || []
    this.setData({
      currentIndex: idx,
      currentQuestion: q,
      answerKeys,
      renderOptions: this.buildRenderOptions(q, answerKeys),
      isMarked: this.data.marked.has(q.id),
      typeLabel: getTypeLabel(q.type),
      navigatorOpen: false
    })
  },

  toggleNavigator() {
    haptic.tap()
    this.setData({ navigatorOpen: !this.data.navigatorOpen })
  },

  saveProgress() {
    this.saveExamState()
    wx.showToast({ title: '进度已保存', icon: 'success' })
  },

  saveExamState() {
    saveExam({
      questions: this.data.questions.map((q) => q.id),
      answers: this.data.answers,
      marked: [...this.data.marked],
      currentIndex: this.data.currentIndex,
      endTime: this.data.endTime,
      startedAt: Date.now() - (EXAM_DURATION - (this.data.endTime - Date.now()))
    })
  },

  confirmSubmit() {
    wx.showModal({
      title: '确认交卷',
      content: `还有 ${Object.keys(this.data.answers).length} 道已作答，共 ${this.data.questions.length} 题。确定交卷吗？`,
      success: (res) => {
        if (res.confirm) this.submitExam()
      }
    })
  },

  submitExam() {
    if (this.data.timer) clearInterval(this.data.timer)
    clearSavedExam()

    let score = 0
    let correct = 0
    const wrongIds = []
    const maxScore = this.data.questions.length

    for (const q of this.data.questions) {
      const answer = this.data.answers[q.id] || []
      const result = scoreTheory(q, answer)
      score += result.score
      if (result.correct) correct++
      else wrongIds.push(q.id)
    }

    const report = {
      score,
      maxScore,
      accuracy: Math.round((correct / this.data.questions.length) * 100),
      wrongIds,
      completedAt: new Date().toISOString()
    }

    const session = {
      id: `theory-${Date.now()}`,
      kind: 'theory',
      report,
      answers: this.data.answers,
      startedAt: Date.now() - (EXAM_DURATION - (this.data.endTime - Date.now())),
      completedAt: Date.now()
    }

    saveExamSession(session)
    this.loadHistory()

    this.setData({
      examFinished: true,
      examStarted: false,
      examResult: report,
      navigatorOpen: false
    })
    haptic.success()

    wx.showToast({ title: `得分：${score}/${maxScore}`, icon: 'none', duration: 3000 })
  }
})