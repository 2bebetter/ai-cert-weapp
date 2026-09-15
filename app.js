App({
  globalData: {
    questions: null,
    theoryQuestions: [],
    practicalQuestions: [],
    examInProgress: false,
    cloudReady: false
  },

  onLaunch() {
    // 初始化云开发
    if (wx.cloud) {
      wx.cloud.init({
        env: 'cloud1-d0g57699wf3dd062e',
        traceUser: true
      })
      this.globalData.cloudReady = true
    }

    // 预加载题库（App 启动后立刻加载）
    this.loadQuestions()

    // 检查版本更新
    const updateManager = wx.getUpdateManager()
    updateManager.onUpdateReady(() => {
      wx.showModal({
        title: '更新提示',
        content: '新版本已准备就绪，是否重启应用？',
        success: (res) => {
          if (res.confirm) updateManager.applyUpdate()
        }
      })
    })
  },

  // ══════════════ 题库加载 ══════════════
  // 读取顺序：内存 → 本地缓存（秒回 + 后台静默刷新）→ 网络（仅首次启动）
  // 同一时刻只跑一次网络请求，避免并发重复下载

  _pending: null,     // 首次加载进行中的 Promise
  _refreshing: null,  // 后台刷新进行中的 Promise

  cachePath() {
    return `${wx.env.USER_DATA_PATH}/questions.json`
  },

  /** 读本地题库缓存；没有或已损坏时返回 null */
  readQuestionCache() {
    try {
      const data = JSON.parse(
        wx.getFileSystemManager().readFileSync(this.cachePath(), 'utf-8')
      )
      if (data && Array.isArray(data.theory) && data.theory.length) return data
      return null
    } catch (e) {
      return null
    }
  },

  /** 写本地题库缓存，失败不影响使用 */
  writeQuestionCache(data) {
    try {
      wx.getFileSystemManager().writeFileSync(
        this.cachePath(), JSON.stringify(data), 'utf-8'
      )
    } catch (e) { /* 缓存非必须 */ }
  },

  /** 把题库写进 globalData，各页面统一从这里读 */
  applyQuestionData(data) {
    this.globalData.questions = data
    this.globalData.theoryQuestions = data.theory || []
    this.globalData.practicalQuestions = data.practical || []
  },

  /**
   * 取题库（各页面统一入口）
   * 有本地缓存时立刻返回，网络更新放到后台，不阻塞界面
   * @returns {Promise<Object|null>}
   */
  async loadQuestions() {
    if (this.globalData.questions) return this.globalData.questions

    // ① 本地缓存优先：秒开，之后在后台悄悄刷新
    const cached = this.readQuestionCache()
    if (cached) {
      this.applyQuestionData(cached)
      console.log('⚡ 题库来自本地缓存',
        '理论:', cached.theory.length, '道,',
        '实操:', (cached.practical || []).length, '道')
      this.refreshQuestions()
      return cached
    }

    // ② 首次启动（无缓存）：只能等网络，并发调用复用同一个请求
    if (this._pending) return this._pending
    this._pending = this.fetchQuestions(false)
    try {
      return await this._pending
    } finally {
      this._pending = null
    }
  },

  /** 后台静默刷新题库：不弹 loading，不阻塞界面 */
  refreshQuestions() {
    if (this._refreshing) return this._refreshing
    this._refreshing = this.fetchQuestions(true)
      .catch(() => null)
      .then((r) => {
        this._refreshing = null
        return r
      })
    return this._refreshing
  },

  /**
   * 走网络取题库：云函数 → 校验 → 落盘
   * @param {Boolean} silent 后台刷新时不显示 loading
   */
  async fetchQuestions(silent) {
    if (!silent) wx.showLoading({ title: '加载题库中…', mask: true })
    try {
      // 通过云函数从云存储读取题库（比 wx.cloud.downloadFile 更稳定）
      const res = await wx.cloud.callFunction({ name: 'getQuestions' })
      const data = res.result

      if (!data || data.error) {
        throw new Error((data && data.error) || '云函数返回为空')
      }
      if (!data.theory || !data.theory.length) {
        throw new Error('题库文件格式不正确，缺少 theory 数组')
      }

      this.applyQuestionData(data)
      this.writeQuestionCache(data)

      console.log('✅ 题库已更新',
        '理论:', data.theory.length, '道,',
        '实操:', (data.practical || []).length, '道')
      return data
    } catch (err) {
      console.error('❌ 题库加载失败:', err)
      return null
    } finally {
      if (!silent) wx.hideLoading()
    }
  }
})