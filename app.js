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

  // 全局题库加载（首次启动时预加载，各页面按需读取）
  async loadQuestions() {
    if (this.globalData.questions) return this.globalData.questions

    try {
      wx.showLoading({ title: '加载题库中…', mask: true })

      // 通过云函数从云存储读取题库（比 wx.cloud.downloadFile 更稳定）
      const res = await wx.cloud.callFunction({
        name: 'getQuestions'
      })

      const data = res.result

      if (!data || data.error) {
        throw new Error(data?.error || '云函数返回为空')
      }

      if (!data.theory || !data.theory.length) {
        throw new Error('题库文件格式不正确，缺少 theory 数组')
      }

      // 缓存到本地，下次秒开
      try {
        const fs = wx.getFileSystemManager()
        fs.writeFileSync(
          `${wx.env.USER_DATA_PATH}/questions.json`,
          JSON.stringify(data),
          'utf-8'
        )
      } catch (e) { /* 缓存非必须 */ }

      this.globalData.questions = data
      this.globalData.theoryQuestions = data.theory || []
      this.globalData.practicalQuestions = data.practical || []

      console.log('✅ 题库加载成功',
        '理论:', data.theory?.length, '道,',
        '实操:', data.practical?.length, '道')

      wx.hideLoading()
      return data
    } catch (err) {
      console.error('❌ 题库加载失败:', err)

      // 尝试从本地缓存兜底
      try {
        const fs = wx.getFileSystemManager()
        const cached = fs.readFileSync(`${wx.env.USER_DATA_PATH}/questions.json`, 'utf-8')
        const data = JSON.parse(cached)
        this.globalData.questions = data
        this.globalData.theoryQuestions = data.theory || []
        this.globalData.practicalQuestions = data.practical || []
        console.log('✅ 从本地缓存加载题库成功')
        wx.hideLoading()
        return data
      } catch (e2) {
        console.error('❌ 本地缓存也无效')
        wx.hideLoading()
        return null
      }
    }
  }
})