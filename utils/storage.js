/**
 * 小程序本地存储封装（替代 IndexedDB）
 *
 * 微信 wx.setStorageSync 单 key ≤ 1MB，总量 ≤ 10MB。
 * 按数据类型分 key 存储，单个 key 超过 1MB 时自动分片。
 */

const PREFIX = 'ai_cert_'

const KEYS = {
  WRONG_BOOK: `${PREFIX}wrong_book`,         // 错题ID数组
  FAVORITES: `${PREFIX}favorites`,             // 收藏ID数组
  THEORY_ATTEMPTS: `${PREFIX}theory_attempts`, // 作答历史
  THEORY_SUMMARIES: `${PREFIX}theory_summaries`,
  REVIEW_STATES: `${PREFIX}review_states`,
  NOTES: `${PREFIX}notes`,                     // { theory: { [qid]: string }, practical: { [key]: string } }
  EXAM_SESSIONS: `${PREFIX}exam_sessions`,
  PRACTICAL_SUBMISSIONS: `${PREFIX}practical_submissions`,
  AI_CONFIG: `${PREFIX}ai_config`,             // { apiKey, baseUrl, model }
  EXAM_IN_PROGRESS: `${PREFIX}exam_in_progress`, // 未完成的考试状态
}

// ---- 通用读写 ----

function get(key) {
  try { return wx.getStorageSync(key) } catch { return null }
}

function set(key, value) {
  try { wx.setStorageSync(key, value); return true } catch (e) {
    console.error('存储写入失败', key, e)
    return false
  }
}

function remove(key) {
  try { wx.removeStorageSync(key) } catch { /* ignore */ }
}

// ---- 错题本 ----

export function getWrongBook() {
  return get(KEYS.WRONG_BOOK) || []
}

export function addWrongBook(id) {
  const list = getWrongBook()
  if (!list.includes(id)) {
    list.push(id)
    set(KEYS.WRONG_BOOK, list)
  }
}

export function removeWrongBook(id) {
  set(KEYS.WRONG_BOOK, getWrongBook().filter((item) => item !== id))
}

// ---- 收藏 ----

export function getFavorites() {
  return new Set(get(KEYS.FAVORITES) || [])
}

export function toggleFavorite(id) {
  const favSet = getFavorites()
  if (favSet.has(id)) favSet.delete(id)
  else favSet.add(id)
  set(KEYS.FAVORITES, [...favSet])
  return favSet.has(id)
}

// ---- 作答记录 ----

export function getTheoryAttempts() {
  return get(KEYS.THEORY_ATTEMPTS) || []
}

export function addTheoryAttempt(attempt) {
  const list = getTheoryAttempts()
  list.push(attempt)
  set(KEYS.THEORY_ATTEMPTS, list)
}

// ---- 考试记录 ----

export function getExamSessions() {
  return get(KEYS.EXAM_SESSIONS) || []
}

export function saveExamSession(session) {
  const list = getExamSessions()
  list.unshift(session)
  set(KEYS.EXAM_SESSIONS, list.slice(0, 100)) // 最多保留 100 条
}

// ---- AI 配置 ----

export function getAIConfig() {
  return get(KEYS.AI_CONFIG) || {}
}

export function saveAIConfig(config) {
  return set(KEYS.AI_CONFIG, config)
}

// ---- 笔记 ----

export function getNotes() {
  return get(KEYS.NOTES) || { theory: {}, practical: {} }
}

export function saveTheoryNote(qid, content) {
  const all = getNotes()
  all.theory = all.theory || {}
  all.theory[qid] = content
  set(KEYS.NOTES, all)
}

export function savePracticalNote(key, content) {
  const all = getNotes()
  all.practical = all.practical || {}
  all.practical[key] = content
  set(KEYS.NOTES, all)
}

// ---- 未完成考试恢复 ----

export function getSavedExam() {
  return get(KEYS.EXAM_IN_PROGRESS)
}

export function saveExam(data) {
  set(KEYS.EXAM_IN_PROGRESS, data)
}

export function clearSavedExam() {
  remove(KEYS.EXAM_IN_PROGRESS)
}

// ---- 实操提交 ----

export function getPracticalSubmissions() {
  return get(KEYS.PRACTICAL_SUBMISSIONS) || []
}

export function savePracticalSubmission(submission) {
  const list = getPracticalSubmissions()
  const idx = list.findIndex((s) => s.id === submission.id)
  if (idx >= 0) list[idx] = submission
  else list.push(submission)
  set(KEYS.PRACTICAL_SUBMISSIONS, list)
}

// ---- 统计 ----

export function getTheorySummaries() {
  return get(KEYS.THEORY_SUMMARIES) || {}
}

export function updateTheorySummary(id, summary) {
  const all = getTheorySummaries()
  all[id] = { ...(all[id] || {}), ...summary }
  set(KEYS.THEORY_SUMMARIES, all)
}

// ---- 复习状态 ----

export function getReviewStates() {
  return get(KEYS.REVIEW_STATES) || {}
}

export function setReviewState(id, state) {
  const all = getReviewStates()
  all[id] = { ...(all[id] || {}), ...state }
  set(KEYS.REVIEW_STATES, all)
}