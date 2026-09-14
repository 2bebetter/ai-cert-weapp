App({
  globalData: {
    questions: null,
    theoryQuestions: [],
    practicalQuestions: [],
    examInProgress: false
  },

  onLaunch() {
    // 初始化云开发
    if (wx.cloud) {
      wx.cloud.init({
        env: 'cloud1-d0g57699wf3dd062e',
        traceUser: true
      })
    }

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

  // 全局题库加载（懒加载，各页面按需调用）
  async loadQuestions() {
    if (this.globalData.questions) return this.globalData.questions

    try {
      const res = await wx.request({
        url: 'https://your-cdn-or-cloud-url/questions.json',
        // 或将题库放在云存储中，用 wx.cloud.downloadFile
      })

      // 如果从 CDN/云存储加载失败，从本地兜底
      if (!res.data) {
        const local = await wx.getFileSystemManager().readFile({
          filePath: `${wx.env.USER_DATA_PATH}/questions.json`
        })
        this.globalData.questions = JSON.parse(local)
      } else {
        this.globalData.questions = res.data
      }

      this.globalData.theoryQuestions = this.globalData.questions.theory || []
      this.globalData.practicalQuestions = this.globalData.questions.practical || []
      return this.globalData.questions
    } catch (err) {
      console.error('题库加载失败', err)
      return null
    }
  }
})