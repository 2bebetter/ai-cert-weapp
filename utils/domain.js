/**
 * 判分与统计纯函数 — 从现有项目直接迁移
 */

function normalized(keys) {
  return [...(keys ?? [])].map(String).sort()
}

/** 理论题判分（判断/单选/多选） */
export function scoreTheory(question, selectedKeys) {
  if (!question.answer || !question.answer.length) return { correct: false, score: 0 }
  const expected = normalized(question.answer)
  const actual = normalized(selectedKeys)
  const correct = expected.length === actual.length && expected.every((key, index) => key === actual[index])
  return { correct, score: correct ? 1 : 0 }
}

/** 实操题评分点自评 */
export function scorePractical(question, checkedIndexes) {
  const checked = new Set(checkedIndexes)
  const score = question.score_items.reduce((total, item, index) => total + (checked.has(index) ? Number(item.score) : 0), 0)
  return { score, maxScore: Number(question.score_total), complete: score === Number(question.score_total) }
}

/** 作答记录累加 */
export function recordAttempt(previous, answer, correct, updatedAt = new Date().toISOString()) {
  return {
    attemptCount: (previous?.attemptCount ?? 0) + 1,
    firstAnswer: previous?.firstAnswer ?? [...answer],
    firstCorrect: previous?.firstCorrect ?? correct,
    lastAnswer: [...answer],
    lastCorrect: correct,
    updatedAt
  }
}

/** 知识点统计 */
export function buildKnowledgeStats(attempts) {
  const stats = {}
  for (const attempt of attempts) {
    const key = attempt.knowledge_point || '未分类'
    stats[key] ??= { correct: 0, total: 0, accuracy: 0 }
    stats[key].total += 1
    if (attempt.correct) stats[key].correct += 1
    stats[key].accuracy = Math.round((stats[key].correct / stats[key].total) * 100)
  }
  return stats
}

/** 题型统计 */
export function buildTypeStats(attempts) {
  const stats = {
    judge: { correct: 0, total: 0, accuracy: 0 },
    single: { correct: 0, total: 0, accuracy: 0 },
    multiple: { correct: 0, total: 0, accuracy: 0 }
  }
  for (const attempt of attempts) {
    if (!stats[attempt.type]) continue
    stats[attempt.type].total += 1
    if (attempt.correct) stats[attempt.type].correct += 1
  }
  for (const value of Object.values(stats)) value.accuracy = value.total ? Math.round((value.correct / value.total) * 100) : 0
  return stats
}

/** 生成模拟试卷（判断40 + 单选140 + 多选10） */
export function buildTheoryExam(questions, random = Math.random) {
  const quotas = { judge: 40, single: 140, multiple: 10 }
  const exam = []
  for (const [type, quota] of Object.entries(quotas)) {
    const pool = questions.filter((q) => q.type === type && q.answer?.length)
    if (pool.length < quota) throw new Error(`${type} 题库中有答案的题目不足 ${quota} 道`)
    const shuffled = [...pool]
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const target = Math.floor(random() * (index + 1))
      ;[shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]]
    }
    exam.push(...shuffled.slice(0, quota))
  }
  // 全部混洗
  for (let index = exam.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    ;[exam[index], exam[target]] = [exam[target], exam[index]]
  }
  return exam
}

/** 模拟考试每道题得分 */
export function scoreTheoryExam(question, selectedKeys) {
  if (!scoreTheory(question, selectedKeys).correct) return 0
  return question.type === 'multiple' ? 1 : 0.5
}

/** 理论题进度汇总 */
export function buildTheoryProgress(questions, attempts, reviewStates, summaries) {
  const total = questions.length
  const attemptedSet = new Set()
  let correctCount = 0
  for (const a of attempts) {
    attemptedSet.add(String(a.questionId))
    if (a.correct) correctCount++
  }
  const attempted = attemptedSet.size
  return {
    total,
    attempted,
    unattempted: total - attempted,
    dueReview: 0,
    repeatedWrong: 0,
    correctCount,
    accuracy: attempted ? Math.round((correctCount / attempts.length) * 100) : 0
  }
}

/** 实践题进度汇总 */
export function buildPracticalProgress(tasks, submissions) {
  const total = tasks.length
  let attempted = 0
  let practiced = 0
  let inProgress = 0
  let needsReview = 0
  for (const task of tasks) {
    const subs = submissions.filter((s) => s.canonicalId === task.canonicalId)
    if (subs.length === 0) continue
    attempted++
    const hasSubmit = subs.some((s) => s.status === 'submitted')
    const hasDraft = subs.some((s) => s.status === 'draft')
    if (hasSubmit) practiced++
    else if (hasDraft) inProgress++
    else needsReview++
  }
  return { total, attempted, practiced, inProgress, needsReview, unattempted: total - attempted }
}

/** 构建复习队列 */
export function buildReviewQueues(questions, histories, reviewStates) {
  const wrong = []
  const repeatedWrong = []
  const notes = []
  for (const q of questions) {
    const id = String(q.id)
    const state = reviewStates[id] || {}
    const history = histories[id]
    if (state.wrong && !state.wrongSuppressed) {
      wrong.push(id)
      if (history?.attemptCount >= 2 && history.lastCorrect === false) {
        repeatedWrong.push(id)
      }
    }
    if (state.note && !state.noteSuppressed) {
      notes.push(id)
    }
  }
  return { wrong, repeatedWrong, notes }
}

const TYPE_LABELS = { judge: '判断题', single: '单选题', multiple: '多选题' }
export function getTypeLabel(type) { return TYPE_LABELS[type] || type }

/** 根据版本号判定实操题类型 */
const VERSION_PATTERN = /(\d+\.\d+\.\d+)/

export function practicalTaskType(question) {
  const ver = (question.question || '').match(VERSION_PATTERN)?.[1] || ''
  const major = ver.split('.')[0]
  const minor = ver.split('.')[1]
  // 1.2.x, 3.1.x, 4.x.x → 文档题
  if (major === '4') return 'document'
  if (major === '1' && minor === '2') return 'document'
  if (major === '3' && minor === '1') return 'document'
  // 2.x.x, 3.2.x → 混合题（代码+文档）
  if (major === '2') return 'mixed'
  if (major === '3' && minor === '2') return 'mixed'
  // 1.1.x → 纯代码
  return 'code'
}

/** 文本填空模板：4.1.x 培训大纲编写类题目的模板 */
export function getTextFillTemplate(question) {
  const ver = (question.question || '').match(VERSION_PATTERN)?.[1] || ''
  // 4.x.x 文档题目前不需要特殊模板处理
  return null
}