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
      // 从云存储下载题库
      const { tempFilePath } = await wx.cloud.downloadFile({
        fileID: 'cloud://cloud1-d0g57699wf3dd062e.636c-cloud1-d0g57699wf3dd062e-1487644378/questions.json'
      })

      const fs = wx.getFileSystemManager()
      const content = fs.readFileSync(tempFilePath, 'utf-8')
      const data = JSON.parse(content)

      // 缓存到本地，下次秒开
      try {
        fs.writeFileSync(
          `${wx.env.USER_DATA_PATH}/questions.json`,
          content,
          'utf-8'
        )
      } catch (e) { /* 缓存非必须 */ }

      this.globalData.questions = data
      this.globalData.theoryQuestions = data.theory || []
      this.globalData.practicalQuestions = data.practical || []
      console.log('题库加载成功', data.theory?.length, '道理论题,', data.practical?.length, '道实操题')
      return data
    } catch (err) {
      console.error('云存储题库加载失败', err)

      // 尝试从本地缓存兜底
      try {
        const fs = wx.getFileSystemManager()
        const cached = fs.readFileSync(`${wx.env.USER_DATA_PATH}/questions.json`, 'utf-8')
        const data = JSON.parse(cached)
        this.globalData.questions = data
        this.globalData.theoryQuestions = data.theory || []
        this.globalData.practicalQuestions = data.practical || []
        console.log('从本地缓存加载题库成功')
        return data
      } catch (e2) {
        console.error('本地缓存也无效', e2)
        return null
      }
    }
  }
})