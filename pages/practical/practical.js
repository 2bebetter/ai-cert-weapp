import { buildPracticalProgress, TASK_STATUSES, TASK_TYPES } from '../../utils/constants'
import { getPracticalSubmissions } from '../../utils/storage'

Page({
  data: {
    tasks: [],
    progress: null,
    taskStatuses: ['全部', '未开始', '草稿', '已练习', '待复盘'],
    statusIndex: 0,
    taskTypes: ['全部类型', '代码填空', '文档作答'],
    typeIndex: 0,
    filteredTasks: []
  },

  onLoad() {
    this.loadTasks()
  },

  onShow() {
    // 刷新进度
    if (this.data.tasks.length) {
      this.refreshProgress()
    }
  },

  loadTasks() {
    const app = getApp()
    const practicalQuestions = app.globalData.practicalQuestions

    if (!practicalQuestions || !practicalQuestions.length) {
      // 题库未加载—等首页加载完成后进入这里会有数据
      setTimeout(() => this.loadTasks(), 500)
      return
    }

    // 从 questions 构建任务列表（简化版—后续完善）
    // 实际需要用 catalog 数据结构，这里先做骨架
    this.refreshProgress()
  },

  refreshProgress() {
    const submissions = getPracticalSubmissions()
    // 进度需要完整的任务列表才能计算，这里先做示意
  },

  onStatusFilter(e) {
    this.setData({ statusIndex: Number(e.detail.value) })
    this.filterTasks()
  },

  onTypeFilter(e) {
    this.setData({ typeIndex: Number(e.detail.value) })
    this.filterTasks()
  },

  filterTasks() {
    // 后续实现
  },

  openTask(e) {
    const taskId = e.currentTarget.dataset.task
    wx.navigateTo({ url: `/pages/practical/detail?taskId=${taskId}` })
  }
})