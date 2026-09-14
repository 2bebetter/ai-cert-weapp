import { buildTheoryProgress } from '../../utils/domain'
import { getWrongBook, getTheoryAttempts } from '../../utils/storage'

Page({
  data: {
    loading: true,
    stats: null
  },

  onShow() {
    this.loadStats()
  },

  async loadStats() {
    const app = getApp()
    let questions = app.globalData.theoryQuestions

    if (!questions || !questions.length) {
      const result = await app.loadQuestions()
      if (!result) {
        this.setData({ loading: false })
        return
      }
      questions = app.globalData.theoryQuestions
    }

    const attempts = getTheoryAttempts()
    const wrongIds = getWrongBook()
    const progress = buildTheoryProgress(questions, attempts, {}, {})

    this.setData({
      loading: false,
      stats: {
        attempted: progress.attempted,
        total: progress.total,
        accuracy: progress.accuracy,
        wrongCount: wrongIds.length
      }
    })
  }
})