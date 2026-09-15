/**
 * 小程序版本号的兜底值。
 *
 * 正式版会从 wx.getAccountInfoSync().miniProgram.version 拿到真实版本
 * （就是上传代码时在开发者工具里填的那个），这里的值只在开发版 /
 * 体验版下使用 —— 那两种环境 miniProgram.version 是空的。
 * 见 utils/version.js。
 */
export const APP_VERSION = '1.1.0'

/** 题型映射 */
export const QUESTION_TYPES = {
  judge: { label: '判断题', short: '判断' },
  single: { label: '单选题', short: '单选' },
  multiple: { label: '多选题', short: '多选' }
}

/** 答案信任度等级 */
export const ANSWER_STATUS = {
  verified: { label: '高可信已回填', color: 'tag-success' },
  manual: { label: '人工审核确认', color: 'tag-success' },
  review: { label: '低置信度待复核', color: 'tag-warning' },
  unverified: { label: '尚未回填参考答案', color: 'tag-danger' }
}

/** 模拟考试配比 */
export const EXAM_QUOTAS = { judge: 40, single: 140, multiple: 10 }
export const EXAM_DURATION = 90 * 60 * 1000 // 90 分钟
/** 考试记录最多展示的条数（列表最新在前，故取前 N 条即最近 N 次） */
export const EXAM_HISTORY_LIMIT = 5

/** 实操任务类型 */
export const TASK_TYPES = {
  code: { label: '代码填空' },
  document: { label: '文档作答' }
}

/** 实操进度状态 */
export const TASK_STATUSES = [
  { value: 'all', label: '全部' },
  { value: 'unattempted', label: '未开始' },
  { value: 'inProgress', label: '草稿' },
  { value: 'practiced', label: '已练习' },
  { value: 'needsReview', label: '待复盘' }
]

/**
 * 云函数名称。
 *
 * 原来还有个 AI_GRADE: 'aiGrade'，用于实操文档题的智能评测。
 * 微信把「AI 生成评语」归入深度合成类目，而该类目个人主体不开放，
 * 所以已整体移除：文档题改为直接展示参考答案，不再判分。
 * 详见 pages/practical/detail.js 的 submitGrade。
 */
export const CLOUD_FUNCTIONS = {
  SUBMIT_FEEDBACK: 'submitFeedback'
}

/** 本地存储 key */
export const STORAGE_KEYS = {
  EXAM_IN_PROGRESS: 'ai_cert_exam_in_progress'
}