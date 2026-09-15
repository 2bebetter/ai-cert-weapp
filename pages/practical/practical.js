import { getPracticalSubmissions } from '../../utils/storage'
import {
  buildTaskList,
  applyTaskFilters,
  buildStats,
  buildGroups
} from '../../utils/practical-stats'

const EXPAND_KEY = 'practical_group_expanded'

Page({
  data: {
    loading: true,
    // 筛选
    taskStatuses: ['全部', '未开始', '进行中', '已练习', '待复盘'],
    statusIndex: 0,
    taskTypes: ['全部类型', '代码填空', '文档作答', '混合题'],
    typeIndex: 0,
    // 数据
    stats: { total: 0, practiced: 0, inProgress: 0, unattempted: 0 },
    groups: [],
    filteredCount: 0
  },

  onShow() {
    // 从答题页返回时重新读本地记录，徽章 / 进度 / 得分实时更新
    this.loadTasks()
  },

  /**
   * 下拉刷新：重置分组展开状态，本地记录重新计算
   */
  async onPullDownRefresh() {
    try {
      wx.removeStorageSync(EXPAND_KEY)
    } catch (e) { /* 忽略 */ }
    await this.loadTasks()
    wx.stopPullDownRefresh()
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

    // 注意：列表页不加载代码模板。
    // 列表只需要「题库 + 本地作答记录」，模板只在答题页（detail.js）用。
    // 此前这里 await loadTemplateIds()，而 utils/templates.js 是
    // 「网络优先、本地兜底」，于是每次进列表页都要等一次 getTemplates
    // 云函数往返，loading 一直挂到它返回。
    const submissions = getPracticalSubmissions() || []
    const allTasks = buildTaskList(questions || [], submissions)

    this.allTasks = allTasks
    this.setData({ loading: false })
    this.refresh()
  },

  /** 按当前筛选重新计算推荐 / 统计 / 分组 */
  refresh() {
    const allTasks = this.allTasks || []
    const filtered = applyTaskFilters(allTasks, this.data.statusIndex, this.data.typeIndex)

    // 展开状态本地缓存（默认全部折叠，只记展开过的组）
    let expandedMap = {}
    try {
      expandedMap = wx.getStorageSync(EXPAND_KEY) || {}
    } catch (e) {
      expandedMap = {}
    }

    this.setData({
      filteredCount: filtered.length,
      stats: buildStats(filtered),
      groups: buildGroups(filtered, expandedMap)
    })
  },

  /* ── 筛选 ── */
  onStatusFilter(e) {
    this.setData({ statusIndex: Number(e.detail.value) })
    this.refresh()
  },

  onTypeFilter(e) {
    this.setData({ typeIndex: Number(e.detail.value) })
    this.refresh()
  },

  /* ── 分组展开 / 折叠（默认折叠） ── */
  toggleGroup(e) {
    const name = e.currentTarget.dataset.name
    if (!name) return
    let map = {}
    try {
      map = wx.getStorageSync(EXPAND_KEY) || {}
    } catch (err) {
      map = {}
    }
    if (map[name]) delete map[name]
    else map[name] = true
    try {
      wx.setStorageSync(EXPAND_KEY, map)
    } catch (err) { /* 忽略 */ }
    this.refresh()
  },

  /* ── 跳转答题页 ── */
  openTask(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: `/pages/practical/detail?questionId=${id}` })
  }
})
