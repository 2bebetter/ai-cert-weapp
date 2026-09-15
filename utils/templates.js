/**
 * 代码模板加载（云函数 → 本地文件缓存 → 内存缓存）
 * 列表页和答题页共用，避免重复请求。
 */

let memoryCache = null

const LOCAL_PATH = () => `${wx.env.USER_DATA_PATH}/code-templates.json`

function readLocal() {
  try {
    const fs = wx.getFileSystemManager()
    return JSON.parse(fs.readFileSync(LOCAL_PATH(), 'utf-8'))
  } catch (e) {
    return null
  }
}

/**
 * 取全部代码模板
 * @param {Boolean} force 强制走云函数（忽略内存缓存）
 * @returns {Promise<Object>} { [questionId]: { segments, referenceAnswers } }
 */
export async function loadTemplates(force = false) {
  if (!force && memoryCache) return memoryCache

  let data = null
  try {
    const res = await wx.cloud.callFunction({ name: 'getTemplates' })
    if (res && res.result && !res.result.error && typeof res.result === 'object') {
      data = res.result
    }
  } catch (err) {
    console.warn('getTemplates 云函数不可用:', err.message)
  }

  if (!data) data = readLocal()
  if (!data) data = {}

  memoryCache = data
  return data
}

/** 已同步取内存缓存（未加载过则为 null） */
export function peekTemplates() {
  return memoryCache
}

/**
 * 有代码模板的题目 id 集合
 * @returns {Promise<Set<String>>}
 */
export async function loadTemplateIds(force = false) {
  const t = await loadTemplates(force)
  return new Set(Object.keys(t || {}))
}
