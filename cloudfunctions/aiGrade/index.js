/**
 * AI 判题云函数
 *
 * 纯透传转发：用户提供 API Key → 云函数转发给 LLM API → 返回判分结果
 * 使用原生 https 模块，无外部依赖，冷启动更快。
 */
const https = require('https')
const http = require('http')

function request(url, options, body) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https')
    const mod = isHttps ? https : http
    const u = new URL(url)
    const req = mod.request(
      {
        hostname: u.hostname,
        port: u.port || (isHttps ? 443 : 80),
        path: u.pathname + u.search,
        method: options.method || 'GET',
        headers: options.headers || {},
        timeout: 25000
      },
      (res) => {
        const chunks = []
        res.on('data', (chunk) => chunks.push(chunk))
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          try {
            resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(text) })
          } catch {
            resolve({ status: res.statusCode, headers: res.headers, data: text })
          }
        })
      }
    )
    req.on('error', (e) => reject(e))
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')) })
    if (body) req.write(body)
    req.end()
  })
}

exports.main = async (event, context) => {
  const { action, apiKey, baseUrl, model, question, scoreItems, submission } = event

  const endpoint = (baseUrl || 'https://api.openai.com/v1')
    .replace(/\/$/, '')
    .replace(/\/chat\/completions$/, '')

  // 测试连接
  if (action === 'test') {
    try {
      const resp = await request(`${endpoint}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` }
      })
      return { ok: resp.status >= 200 && resp.status < 300, error: resp.data?.error?.message || `HTTP ${resp.status}` }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }

  // 判分
  if (!apiKey) return { error: '未提供 API Key' }
  if (!question || !scoreItems) return { error: '缺少题目或评分项' }

  const subText = (submission && submission.text) || ''
  const prompt = buildPrompt(question, scoreItems, subText)

  try {
    const resp = await request(
      `${endpoint}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        }
      },
      JSON.stringify({
        model: model || 'deepseek-chat',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: '严格按给定参考答案判分，不要自行接受替代写法。' },
          { role: 'user', content: prompt }
        ]
      })
    )

    if (resp.status >= 400) {
      return { error: `LLM API 返回 ${resp.status}: ${resp.data?.error?.message || '未知错误'}` }
    }

    const content = resp.data?.choices?.[0]?.message?.content
    if (!content) return { error: 'AI 未返回内容' }

    const raw = JSON.parse(content.replace(/^```json\s*/i, '').replace(/```$/i, '').trim())
    return normalizeGrade(raw, scoreItems)
  } catch (err) {
    return { error: `判分失败：${err.message}` }
  }
}

function buildPrompt(question, scoreItems, subText) {
  return `你是严格的代码/文档评分器。根据题目要求和评分点逐项评阅考生的作答内容。每项分数只能是0到该项满分的整数。返回JSON对象 {"items":[{"id":"M1","score":0,"reason":"..."}]}。\n题目：${JSON.stringify(question)}\n评分点：${JSON.stringify(scoreItems)}\n考生作答：${subText}`
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