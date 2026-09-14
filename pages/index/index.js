import { buildTheoryProgress } from '../../utils/domain'
import { getWrongBook, getTheoryAttempts, getTheorySummaries } from '../../utils/storage'

Page({
  data: {
    stats: null
  },

  onShow() {
    this.loadStats()
  },

  loadStats() {
    const questions = getApp().globalData.theoryQuestions
    if (!questions || !questions.length) {
      // 题库未加载，尝试加载
      this.loadQuestions()
      return
    }

    const attempts = getTheoryAttempts()
    const summaries = getTheorySummaries()
    const wrongIds = getWrongBook()

    const progress = buildTheoryProgress(questions, attempts, {}, summaries)

    this.setData({
      stats: {
        attempted: progress.attempted,
        total: progress.total,
        accuracy: progress.accuracy,
        wrongCount: wrongIds.length
      }
    })
  },

  async loadQuestions() {
    const app = getApp()
    await app.loadQuestions()
    this.loadStats()
  }
})