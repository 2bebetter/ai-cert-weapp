/**
 * AI 判题云函数
 *
 * 纯透传转发：用户提供 API Key → 云函数转发给 LLM API → 返回判分结果
 * 不存储任何密钥，不记录任何作答内容。
 */
const fetch = require('node-fetch')

exports.main = async (event, context) => {
  const { action, apiKey, baseUrl, model, question, scoreItems, submission, reference } = event

  // 测试连接
  if (action === 'test') {
    try {
      const endpoint = (baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '').replace(/\/chat\/completions$/, '')
      const resp = await fetch(`${endpoint}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` }
      })
      return { ok: resp.ok, error: resp.ok ? undefined : `HTTP ${resp.status}` }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }

  // 判分
  if (!apiKey) return { error: '未提供 API Key' }
  if (!question || !scoreItems) return { error: '缺少题目或评分项' }

  const endpoint = (baseUrl || 'https://api.openai.com/v1')
    .replace(/\/$/, '')
    .replace(/\/chat\/completions$/, '')

  const isText = submission && typeof submission.text !== 'undefined'
  const subText = isText ? submission.text : JSON.stringify(submission || '')
  const refText = isText ? (reference?.text || reference || '') : JSON.stringify(reference || '')

  const prompt = buildPrompt(question, scoreItems, subText, refText, isText)

  try {
    const resp = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: '严格按给定参考答案判分，不要自行接受替代写法。' },
          { role: 'user', content: prompt }
        ]
      })
    })

    const body = await resp.json()
    if (!resp.ok) {
      return { error: `LLM API 返回 ${resp.status}: ${body.error?.message || '未知错误'}` }
    }

    const content = body.choices?.[0]?.message?.content || '{}'
    const raw = JSON.parse(content.replace(/^```json\s*/i, '').replace(/```$/i, '').trim())

    return normalizeGrade(raw, scoreItems)
  } catch (err) {
    return { error: `判分失败：${err.message}` }
  }
}

function buildPrompt(question, scoreItems, subText, refText, isText) {
  if (isText) {
    return `你是严格的文档作答评分器。根据题目要求和评分点逐项评阅考生的作答内容。每项分数只能是0到该项满分的整数。返回JSON对象 {"items":[{"id":"M1","score":0,"reason":"..."}]}。\n题目：${JSON.stringify(question)}\n评分点：${JSON.stringify(scoreItems)}\n考生作答：${subText}\n参考答案：${refText}`
  }
  return `你是严格的代码填空评分器。只依据考生实际提交代码和题目评分点评分。逐项检查：如果该评分项对应的代码仍包含下划线空缺，必须给该项0分。不要运行代码。每项分数只能是0到该项满分的整数。返回JSON对象 {"items":[{"id":"M1","score":0,"reason":"..."}]}。\n题目：${JSON.stringify(question)}\n评分点：${JSON.stringify(scoreItems)}\n考生提交代码：${subText}\n参考答案：${refText}`
}

function normalizeGrade(raw, scoreItems) {
  const returned = new Map((raw?.items || []).map((item, i) => [item.id || `M${i + 1}`, item]))
  const items = scoreItems.map((item, i) => {
    const id = item.id || `M${i + 1}`
    const result = returned.get(id)
    const score = Math.max(0, Math.min(Number(item.score), Number(result?.score) || 0))
    return { id, score, max_score: Number(item.score), reason: result?.reason || 'AI 未返回该评分项' }
  })
  return { total_score: items.reduce((s, item) => s + item.score, 0), items }
}