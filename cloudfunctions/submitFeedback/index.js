/**
 * 用户反馈收集云函数
 * 将反馈写入云数据库 feedbacks 集合
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { text, page, deviceInfo } = event
  if (!text || !text.trim()) {
    return { code: 1, error: '反馈内容不能为空' }
  }

  try {
    await db.collection('feedbacks').add({
      data: {
        text: text.trim(),
        page: page || '',
        deviceInfo: deviceInfo || {},
        images: event.images || [],
        createdAt: db.serverDate()
      }
    })
    return { code: 0, message: 'ok' }
  } catch (e) {
    return { code: 2, error: e.message }
  }
}