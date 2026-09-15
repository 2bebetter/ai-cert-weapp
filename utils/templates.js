/**
 * 代码模板加载
 * 读取顺序：内存 → 本地文件缓存（秒回 + 后台静默刷新）→ 云函数
 * 同一时刻只跑一次网络请求，避免并发重复调用。
 *
 * 之前这里有两个问题，导致每次进答题页都要等一次云函数往返：
 *   1. 顺序反了 —— 先 await 云函数，只有失败时才读本地文件；
 *   2. 本地文件只读不写 —— 全项目没有任何地方写 code-templates.json，
 *      所以 readLocal() 永远返回 null，那个「本地兜底」是死代码。
 * 现在改为缓存优先，并在云函数返回后落盘。
 */

let memoryCache = null
let pending = null      // 首次加载进行中的 Promise
let refreshing = null   // 后台刷新进行中的 Promise

const LOCAL_PATH = () => `${wx.env.USER_DATA_PATH}/code-templates.json`

/** 读本地模板缓存；没有或已损坏时返回 null */
function readLocal() {
  try {
    const fs = wx.getFileSystemManager()
    const data = JSON.parse(fs.readFileSync(LOCAL_PATH(), 'utf-8'))
    if (data && typeof data === 'object' && Object.keys(data).length) return data
    return null
  } catch (e) {
    return null
  }
}

/** 写本地模板缓存，失败不影响使用 */
function writeLocal(data) {
  try {
    wx.getFileSystemManager().writeFileSync(
      LOCAL_PATH(), JSON.stringify(data), 'utf-8'
    )
  } catch (e) { /* 缓存非必须 */ }
}

/** 走云函数取模板，成功后写入内存与本地缓存 */
async function fetchTemplates() {
  const res = await wx.cloud.callFunction({ name: 'getTemplates' })
  const data = res && res.result
  if (!data || data.error || typeof data !== 'object') {
    throw new Error((data && data.error) || '云函数返回为空')
  }
  memoryCache = data
  writeLocal(data)
  return data
}

/** 后台静默刷新：不阻塞界面，失败不影响已有缓存 */
function refreshTemplates() {
  if (refreshing) return refreshing
  refreshing = fetchTemplates()
    .catch(() => null)
    .then((r) => {
      refreshing = null
      return r
    })
  return refreshing
}

/**
 * 取全部代码模板
 * @param {Boolean} force 强制走云函数（忽略内存与本地缓存）
 * @returns {Promise<Object>} { [questionId]: { segments, referenceAnswers } }
 */
export async function loadTemplates(force = false) {
  if (memoryCache && !force) return memoryCache

  // ① 本地缓存优先：命中就立刻返回，网络更新放到后台，不阻塞界面
  if (!force) {
    const local = readLocal()
    if (local) {
      memoryCache = local
      refreshTemplates()
      return local
    }
  }

  // ② 本地也没有（或强制刷新）：只能等网络，并发调用复用同一个请求
  if (pending) return pending
  pending = fetchTemplates()
    .catch((err) => {
      console.warn('getTemplates 云函数不可用:', err.message)
      // 云函数不可用时降级：退到本地缓存，再退到空对象。
      // 结果写进 memoryCache，避免每次进页面都重新等一次超时。
      const fallback = readLocal() || {}
      memoryCache = fallback
      return fallback
    })
    .then((r) => {
      pending = null
      return r
    })
  return pending
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
