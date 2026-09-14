import { buildReviewQueues, getTypeLabel } from '../../utils/domain'
import {
  getWrongBook, getTheoryAttempts, getTheorySummaries,
  getNotes, getReviewStates, getFavorites
} from '../../utils/storage'

Page({
  data: {
    tabs: [
      { key: 'wrong', label: '错题', count: 0 },
      { key: 'repeatedWrong', label: '反复错', count: 0 },
      { key: 'favorites', label: '收藏', count: 0 },
      { key: 'notes', label: '有笔记', count: 0 }
    ],
    activeTab: 'wrong',
    reviewList: []
  },

  onShow() {
    this.loadReview()
  },

  loadReview() {
    const app = getApp()
    const questions = app.globalData.theoryQuestions
    if (!questions || !questions.length) return

    const wrongIds = new Set(getWrongBook())
    const attempts = getTheoryAttempts()
    const notes = getNotes().theory || {}
    const reviewStates = getReviewStates()
    const favoriteIds = getFavorites()

    // 构建作答历史
    const histories = {}
    for (const a of attempts) {
      const id = a.questionId
      if (!histories[id]) histories[id] = { attemptCount: 0, correctCount: 0, lastCorrect: null }
      histories[id].attemptCount++
      if (a.correct) histories[id].correctCount++
      histories[id].lastCorrect = a.correct
    }

    // 构建 reviewStates
    const states = {}
    for (const id of wrongIds) {
      states[id] = { ...(states[id] || {}), id, wrong: true }
    }
    for (const [id, note] of Object.entries(notes)) {
      if (note.trim()) {
        states[id] = { ...(states[id] || {}), id, note }
      }
    }

    const queues = buildReviewQueues(questions, histories, states, favoriteIds)
    const activeKey = this.data.activeTab
    const ids = queues[activeKey] || []

    // 更新各 tab 计数
    const tabs = this.data.tabs.map((t) => ({
      ...t,
      count: (queues[t.key] || []).length
    }))

    // 构建展示列表
    const reviewList = ids.map((id) => {
      const q = questions.find((item) => String(item.id) === id)
      if (!q) return null
      const history = histories[id]
      let statusLabel = '未作答'
      let statusClass = 'unattempted'
      if (history) {
        if (history.lastCorrect === false) { statusLabel = '答错'; statusClass = 'wrong' }
        else if (history.lastCorrect === true) { statusLabel = '答对'; statusClass = 'correct' }
      }
      return {
        id,
        typeLabel: getTypeLabel(q.type),
        typeClass: q.type === 'judge' ? 'tag' : q.type === 'single' ? 'tag tag-success' : 'tag tag-warning',
        text: (q.question || '').slice(0, 200),
        statusLabel,
        statusClass,
        hasNote: !!notes[id]
      }
    }).filter(Boolean)

    this.setData({ tabs, reviewList })
  },

  switchTab(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ activeTab: key })
    this.loadReview()
  },

  openQuestion(e) {
    const id = e.currentTarget.dataset.id
    wx.switchTab({
      url: '/pages/theory/theory',
      success: () => {
        const pages = getCurrentPages()
        const theoryPage = pages.find((p) => p.route === 'pages/theory/theory')
        if (theoryPage) theoryPage.navigateToQuestion(id)
      }
    })
  }
})