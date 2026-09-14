import { practicalTaskType } from '../../utils/domain'
import { getPracticalSubmissions } from '../../utils/storage'

Page({
  data: {
    loading: true,
    tasks: [],
    progress: null,
    taskStatuses: ['全部', '未开始', '草稿', '已练习', '待复盘'],
    statusIndex: 0,
    taskTypes: ['全部类型', '代码填空', '文档作答', '混合题'],
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
      return {
        id: q.id,
        title,
        type: practicalTaskType(q),
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
  },

  onStatusFilter(e) {
    const statusIndex = Number(e.detail.value)
    this.setData({ statusIndex })
    this.applyFilters()
  },

  onTypeFilter(e) {
    const typeIndex = Number(e.detail.value)
    this.setData({ typeIndex })
    this.applyFilters()
  },

  applyFilters() {
    const all = getApp().globalData.practicalQuestions || []
    const typeMap = { 1: 'code', 2: 'document', 3: 'mixed' }
    const statusIndex = this.data.statusIndex
    const typeIndex = this.data.typeIndex

    const tasks = (all || []).filter((q) => {
      const type = practicalTaskType(q)
      if (typeIndex > 0 && type !== typeMap[typeIndex]) return false
      if (statusIndex === 0) return true
      const subs = (getPracticalSubmissions() || []).filter((s) => String(s.questionId) === String(q.id))
      const hasSubmit = subs.some((s) => s.status === 'submitted')
      const hasDraft = subs.some((s) => s.status === 'draft')
      if (statusIndex === 1 && subs.length === 0) return true
      if (statusIndex === 2 && hasDraft && !hasSubmit) return true
      if (statusIndex === 3 && hasSubmit) return true
      if (statusIndex === 4 && (!hasSubmit || hasDraft)) return true
      return false
    }).map((q) => ({
      id: q.id,
      title: (q.title || q.question?.split('：')[0] || '未命名任务').trim(),
      type: practicalTaskType(q),
      question: q.question,
      scoreItems: q.score_items || []
    }))

    this.setData({ tasks })
  }
})