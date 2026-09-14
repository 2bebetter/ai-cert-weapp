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
      const title = (q.title || q.question || '未命名任务').split('：')[0].trim()
      const type = q.score_items && q.score_items.length ? 'code' : 'document'
      return {
        id: q.id,
        title,
        type,
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
  }
})