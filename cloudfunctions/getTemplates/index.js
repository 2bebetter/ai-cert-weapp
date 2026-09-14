/**
 * 读取代码模板文件
 */
const cloud = require('wx-server-sdk')
cloud.init()

exports.main = async (event, context) => {
  try {
    const res = await cloud.downloadFile({
      fileID: 'cloud://cloud1-d0g57699wf3dd062e.636c-cloud1-d0g57699wf3dd062e-1487644378/code-templates.json'
    })
    const content = res.fileContent.toString('utf-8')
    return JSON.parse(content)
  } catch (err) {
    return { error: err.message }
  }
}
