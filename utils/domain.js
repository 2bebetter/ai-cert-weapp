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
export function buildReviewQueues(questions, histories, reviewStates, favoriteIds = new Set()) {
  const wrong = []
  const repeatedWrong = []
  const notes = []
  const favorites = []
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
    if (favoriteIds.has(id)) {
      favorites.push(id)
    }
  }
  return { wrong, repeatedWrong, notes, favorites }
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

/**
 * 文档题子问拆分：按（1）（2）（3）… 分割题干
 * 返回 [{ id: 'doc-1', num: '1', prompt: '子问文本' }]
 * 无子问（如 4.x 大纲题）返回 []
 */
export function splitDocSubQuestions(question) {
  const text = question.question || ''
  const parts = text.split(/（(\d+)）/)
  const subs = []
  for (let i = 1; i < parts.length; i += 2) {
    const prompt = (parts[i + 1] || '').trim()
    if (prompt) {
      subs.push({ id: `doc-${parts[i]}`, num: parts[i], prompt })
    }
  }
  return subs
}

/** 判断文档题是否有多个子问 */
export function hasDocSubQuestions(question) {
  return splitDocSubQuestions(question).length > 1
}

// ---- 代码题规则判分 ----

/** pandas/numpy 常见 API 关键词 */
const PY_API = new Set([
  'read_csv','read_excel','read_json','read_sql','head','tail','info','describe',
  'shape','columns','dtypes','value_counts','groupby','agg','merge','concat',
  'dropna','fillna','drop','rename','apply','map','cut','qcut','pd.cut','pd.qcut',
  'pivot_table','crosstab','sort_values','unique','nunique','isnull','notnull',
  'astype','loc','iloc','to_csv','to_excel','np.where','np.array','np.mean',
  'np.median','np.std','sum','mean','max','min','count','size','plot','figure',
  'subplot','hist','boxplot','scatter','bar','barh','to_numpy','values',
  'reset_index','set_index','isna','notna','drop_duplicates','duplicated',
  'str.contains','str.replace','str.split','str.strip','replace','abs','round'
])

/** 从 score_item desc 提取关键词 */
function extractKeywords(desc) {
  const words = new Set()
  // 提取引号内容
  const quoteRe = /['"]([^'"]+)['"]/g
  let m
  while ((m = quoteRe.exec(desc)) !== null) {
    if (m[1].length > 1) words.add(m[1])
  }
  // 提取 PANDA_API
  for (const api of PY_API) {
    if (desc.toLowerCase().includes(api)) words.add(api)
  }
  // 提取中文函数动作词（常见）
  const cnWords = ['读取','加载','统计','计算','创建','划分','分配','判断','输出','显示','绘制','过滤','排序','合并','分组','转换']
  for (const w of cnWords) {
    if (desc.includes(w)) words.add(w)
  }
  return [...words]
}

/** 代码题规则判分 — 返回逐空结果 */
export function gradeCodeTask(userCode, scoreItems) {
  const code = (userCode || '').toLowerCase()
  const maxScore = (scoreItems || []).reduce((s, i) => s + Number(i.score), 0)
  let total = 0
  const items = (scoreItems || []).map((item) => {
    const desc = item.desc || ''
    const keywords = extractKeywords(desc)
    if (keywords.length === 0) {
      return { id: item.id, max_score: Number(item.score), score: 0, reason: '无法自动判定（需对照输出结果/截图），请自查' }
    }
    const hits = keywords.filter((k) => code.includes(String(k).toLowerCase()))
    const ratio = hits.length / keywords.length
    let score = 0
    if (ratio >= 1) score = Number(item.score)
    else if (ratio >= 0.5) score = Math.max(1, Math.round(Number(item.score) * 0.5))
    total += score
    return { id: item.id, max_score: Number(item.score), score, reason: `命中 ${hits.length}/${keywords.length} 个关键点` }
  })
  return { total_score: total, maxScore, items }
}

/**
 * 从模板 segments + 用户填空值构建逐空参考答案与判定
 * 返回 [{ blankId, hint, status, reference, explanation, commonMistake, contrast }]
 * status: 'correct' | 'wrong' | 'empty'
 */
export function buildBlankAnswers(segments, blankValues = {}) {
  if (!segments || !segments.length) return []
  const answers = []
  const ctx = { prevText: '' }
  for (const seg of segments) {
    if (seg.kind === 'text') {
      ctx.prevText = seg.value
    } else if (seg.kind === 'blank') {
      // 提取前一句注释作为 hint
      const lines = ctx.prevText.split('\n')
      const hintLines = lines.filter((l) => l.trim().startsWith('#'))
      const hint = hintLines.length > 0
        ? hintLines[hintLines.length - 1].replace(/^#\s*/, '')
        : '请参考上下文填写代码'

      const value = (blankValues[seg.id] || '').trim()
      // 从 hint 提取期望关键词
      const keywords = extractKeywords(hint)
      let status = 'empty'
      if (value) {
        status = keywords.some((k) => value.toLowerCase().includes(String(k).toLowerCase())) ? 'correct' : 'wrong'
      }

      answers.push({
        blankId: seg.id,
        hint,
        status,
        userValue: value,
        reference: hint,          // 无标准答案时展示提示
        explanation: `本空需要填写实现「${hint}」的代码，注意函数调用语法与参数`,
        commonMistake: ['函数名拼写错误（s 结尾、大小写）', '缺少括号或引号', '参数顺序/列名拼写错'].join('；'),
        contrast: '提示：该处为功能填空，参考上方代码模板中同位置的注释要求'
      })
    }
  }
  return answers
}

/** 从模板生成参考代码 lines（blank 带占位符） */
export function getCodeReferenceLines(segments) {
  const lines = []
  let current = []
  const flush = () => { if (current.length) { lines.push(current); current = [] } }
  for (const seg of segments) {
    if (seg.kind === 'text') {
      const parts = String(seg.value).split('\n')
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) flush()
        if (parts[i].length > 0) current.push({ kind: 'text', value: parts[i] })
      }
    } else {
      current.push({ kind: 'blank', id: seg.id, value: `【${seg.id}】` })
    }
  }
  flush()
  return lines
}

/** 通用常见错误提示 */
export const COMMON_MISTAKES = [
  '⚠️ 检查文件名、列名是否拼写正确（大小写敏感）',
  '⚠️ 调用函数后记得加括号，如 read_csv() 不是 read_csv',
  '⚠️ 赋值语句确认变量名一致，如 data = pd.read_csv(...)',
  '⚠️ 字符串记得加引号，如 data[\'列名\']',
  '⚠️ 检查导入语句：import pandas as pd / import numpy as np'
]

export { extractKeywords, PY_API }