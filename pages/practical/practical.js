Page({
  data: {
    loading: true,
    tasks: [],
    progress: null,
    taskStatuses: ['全部', '未开始', '草稿', '已练习', '待复盘'],
    statusIndex: 0,
    taskTypes: ['全部类型', '代码填空', '文档作答'],
    typeIndex: 0
  },

  onShow() {
    this.loadTasks()
  },

  async loadTasks() {
    const app = getApp()
    let questions = app.globalData.practicalQuestions

    if (!questions || !questions.length) {
      const result = await app.loadQuestions()
      if (!result) {
        this.setData({ loading: false })
        return
      }
      questions = app.globalData.practicalQuestions
    }

    // 从 practicalQuestions 构建任务列表
    const tasks = (questions || []).map((q) => {
      const title = (q.title || q.question?.split('：')[0] || '未命名任务').trim()
      const hasScoreItems = q.score_items && q.score_items.length > 0
      const isCode = q.type === 'code_practice' || hasScoreItems
      return {
        id: q.id,
        title,
        type: isCode ? 'code' : 'document',
        question: q.question,
        scoreItems: q.score_items || [],
        versions: q.source_variant ? [{ year: q.source_year, code: q.source_code }] : []
      }
    })

    this.setData({
      loading: false,
      tasks,
      progress: {
        total: tasks.length,
        practiced: 0,
        inProgress: 0,
        unattempted: tasks.length
      }
    })
  },

  openTask(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/practical/detail?questionId=${id}` })
  }
})