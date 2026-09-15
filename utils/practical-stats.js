/**
 * 实操学习列表页数据层
 *   题型分组 / 精简标题 / 练习状态 / 进度 / 推荐练习
 * 分组维度是「题目类型」（流程设计、效果优化…），不使用业务领域。
 */
import { practicalTaskType } from './domain'

/* ═══════════ 题型分组 ═══════════ */

const CATEGORY_RULES = [
  { name: '培训大纲编写', re: /培训大纲/ },
  { name: '数据采集与处理指导', re: /指导$/ },
  { name: '效果优化', re: /效果优化/ },
  { name: '模型开发与测试', re: /模型.{0,4}测试|模型开发/ },
  { name: '数据分析与优化', re: /数据分析与优化/ },
  { name: '交互流程设计', re: /交互流程设计/ },
  { name: '数据清洗与标注', re: /数据清洗[和与]标注/ },
  { name: '流程设计', re: /流程设计/ }
]

export const CATEGORY_ORDER = [...CATEGORY_RULES.map((r) => r.name), '其他']

/** 完整原题名称（题干第一句，冒号前） */
export function fullTitleOf(q) {
  const t = String((q && q.question) || '').split('：')[0].trim()
  return t || '未命名任务'
}

/**
 * 精简名称：去掉「系统/业务/产品的」等填充词，超长截断
 * 目的：主标题一行放下，不被长标题挤压换行
 */
export function shortTitleOf(q, MAX = 18) {
  let s = fullTitleOf(q)
  if (!s) return ''
  s = s
    .replace(/业务模块|业务/g, '')
    .replace(/系统(中|里)?的?/g, '')
    .replace(/(中|里)的/g, '')
    .replace(/产品的|的/g, '')
    .replace(/\s+/g, '')
  if (s.length > MAX) s = `${s.slice(0, MAX - 1)}…`
  return s
}

/** 题目来源标签：2026 真题 / 2025 模拟 */
export function variantLabel(q) {
  const v = String((q && q.source_variant) || '')
  const y = (q && q.source_year) || ''
  if (/mock/i.test(v)) return `${y} 模拟`.trim()
  if (/formal/i.test(v)) return `${y} 真题`.trim()
  return y ? String(y) : ''
}

/** 题目类型文案 */
export function typeLabelOf(q) {
  const t = practicalTaskType(q)
  if (t === 'code') return '代码填空'
  if (t === 'mixed') return '混合题'
  return '文档作答'
}

/** 题型 -> 分组名 */
export function taskCategory(q) {
  const full = fullTitleOf(q)
  for (const r of CATEGORY_RULES) if (r.re.test(full)) return r.name
  return '其他'
}

/* ═══════════ 练习状态 ═══════════ */

export const STATUS_META = {
  new: { label: '未开始', badge: 'badge-new' },
  doing: { label: '进行中', badge: 'badge-doing' },
  done: { label: '已练习', badge: 'badge-done' }
}

function subsFor(submissions, qid) {
  return (submissions || []).filter((s) => String(s.questionId) === String(qid))
}

/** 未开始 / 进行中 / 已练习 */
export function taskStatus(submissions, qid) {
  const subs = subsFor(submissions, qid)
  if (!subs.length) return 'new'
  if (subs.some((s) => s.status === 'submitted')) return 'done'
  return 'doing'
}

/**
 * 进度：percent 为 null 表示无法计算（老草稿没记录总空数）
 * score / maxScore 来自最近一次验证或评测
 */
export function taskProgress(submissions, qid) {
  const subs = subsFor(submissions, qid)
  const done = subs.filter((s) => s.status === 'submitted').slice(-1)[0]
  const draft = subs.filter((s) => s.status === 'draft').slice(-1)[0]
  const rec = done || draft

  let percent = 0
  if (done) {
    percent = 100
  } else if (rec && rec.progress && rec.progress.total > 0) {
    percent = Math.round((rec.progress.filled / rec.progress.total) * 100)
  } else if (rec && rec.answer && rec.answer.blanks) {
    const filled = Object.keys(rec.answer.blanks).filter((k) => String(rec.answer.blanks[k] || '').trim()).length
    percent = filled > 0 ? null : 0
  }

  return {
    percent,
    score: rec && typeof rec.score === 'number' ? rec.score : null,
    maxScore: rec && typeof rec.maxScore === 'number' ? rec.maxScore : null
  }
}

/* ═══════════ 组装 ═══════════ */

/**
 * 把原始题目 + 本地提交记录 组装成列表项
 * @param {Array} questions 原始实操题
 * @param {Array} submissions 本地提交记录
 * @param {Set<String>} templateIds 有代码模板的题目 id
 */
export function buildTaskList(questions, submissions, templateIds) {
  return (questions || []).map((q) => {
    const id = String(q.id)
    const status = taskStatus(submissions, id)
    const prog = taskProgress(submissions, id)
    return {
      id,
      full: fullTitleOf(q),
      short: shortTitleOf(q),
      variant: variantLabel(q),
      category: taskCategory(q),
      type: practicalTaskType(q),
      typeLabel: typeLabelOf(q),
      scoreTotal: q.score_total || 0,
      hasTemplate: templateIds ? templateIds.has(id) : true,
      status,
      statusLabel: STATUS_META[status].label,
      statusBadge: STATUS_META[status].badge,
      percent: prog.percent,
      score: prog.score,
      maxScore: prog.maxScore,
      // 进行中才展示进度条文案
      progressText: status === 'doing'
        ? `进度${prog.percent == null ? '—' : `${prog.percent}%`}｜当前得分${prog.score == null ? '未评分' : `${prog.score} 分`}`
        : ''
    }
  })
}

/**
 * 筛选：保持原有下拉语义
 * 状态 0全部 1未开始 2草稿 3已练习 4待复盘
 * 类型 0全部 1代码填空 2文档作答 3混合题
 */
export function applyTaskFilters(tasks, statusIndex, typeIndex) {
  const typeMap = { 1: 'code', 2: 'document', 3: 'mixed' }
  return (tasks || []).filter((t) => {
    if (typeIndex > 0 && t.type !== typeMap[typeIndex]) return false
    switch (statusIndex) {
      case 1: return t.status === 'new'
      case 2: return t.status === 'doing'
      case 3: return t.status === 'done'
      // 待复盘：已练习但没拿满分（有做错的题需要复盘）
      case 4: return t.status === 'done' && t.score != null && t.maxScore != null && t.score < t.maxScore
      default: return true
    }
  })
}

/** 三项统计 */
export function buildStats(tasks) {
  const list = tasks || []
  return {
    total: list.length,
    practiced: list.filter((t) => t.status === 'done').length,
    inProgress: list.filter((t) => t.status === 'doing').length,
    unattempted: list.filter((t) => t.status === 'new').length
  }
}

/**
 * 推荐练习（最多 2 条）
 *   ① 进行中未完成
 *   ② 薄弱类型（已练习但没满分的题所属类型）里的新题
 *   ③ 兜底：新题
 * 无模板的题不可练，不参与推荐
 */
export function buildRecommendations(tasks) {
  const out = []
  const taken = new Set()
  const push = (t, reason, action) => {
    if (out.length >= 2 || taken.has(t.id)) return
    taken.add(t.id)
    out.push({ id: t.id, short: t.short, full: t.full, reason, action })
  }

  // ① 进行中
  ;(tasks || []).filter((t) => t.hasTemplate && t.status === 'doing')
    .forEach((t) => push(t, '上次做到一半，继续完成', '继续练习'))

  // ② 薄弱类型
  if (out.length < 2) {
    const weak = new Set()
    ;(tasks || []).forEach((t) => {
      if (t.status === 'done' && t.score != null && t.maxScore != null && t.score < t.maxScore) {
        weak.add(t.category)
      }
    })
    if (weak.size) {
      ;(tasks || []).filter((t) => t.hasTemplate && t.status === 'new' && weak.has(t.category))
        .forEach((t) => push(t, '薄弱专项巩固练习', '开始练习'))
    }
  }

  // ③ 兜底
  if (out.length < 2) {
    ;(tasks || []).filter((t) => t.hasTemplate && t.status === 'new')
      .forEach((t) => push(t, '新题推荐练习', '开始练习'))
  }

  return out
}

/**
 * 按题型分组
 * @param {Boolean} collapsedMap { [分组名]: true } 表示该组被折叠
 */
export function buildGroups(tasks, collapsedMap) {
  const map = new Map()
  ;(tasks || []).forEach((t) => {
    if (!map.has(t.category)) map.set(t.category, [])
    map.get(t.category).push(t)
  })

  const order = [...CATEGORY_ORDER, ...map.keys()]
  const seen = new Set()
  const groups = []
  for (const name of order) {
    if (seen.has(name) || !map.has(name)) continue
    seen.add(name)
    const list = map.get(name)
    groups.push({
      name,
      total: list.length,
      done: list.filter((t) => t.status === 'done').length,
      collapsed: !!(collapsedMap && collapsedMap[name]),
      tasks: list
    })
  }
  return groups
}
