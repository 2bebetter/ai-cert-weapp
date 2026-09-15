import { getPracticalSubmissions } from '../../utils/storage'
import { loadTemplateIds } from '../../utils/templates'
import {
  buildTaskList,
  applyTaskFilters,
  buildStats,
  buildRecommendations,
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
    recommend: [],
    stats: { total: 0, practiced: 0, inProgress: 0, unattempted: 0 },
    groups: [],
    filteredCount: 0
  },

  onShow() {
    // 从答题页返回时重新读本地记录，徽章 / 进度 / 得分实时更新
    this.loadTasks()
  },

  /**
   * 下拉刷新：重置分组展开状态与本地缓存，全部模块数据重新计算
   * @param {Boolean} refreshTemplates 是否跳过模板内存缓存重新拉取
   */
  async onPullDownRefresh() {
    try {
      wx.removeStorageSync(EXPAND_KEY)
    } catch (e) { /* 忽略 */ }
    await this.loadTasks(true)
    wx.stopPullDownRefresh()
  },

  async loadTasks(refreshTemplates = false) {
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

    // 有代码模板的题目才可练（云函数 + 本地文件双缓存）
    let templateIds = new Set()
    try {
      templateIds = await loadTemplateIds(refreshTemplates)
    } catch (e) {
      templateIds = new Set()
    }

    const submissions = getPracticalSubmissions() || []
    const allTasks = buildTaskList(questions || [], submissions, templateIds)

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
      recommend: buildRecommendations(filtered),
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
