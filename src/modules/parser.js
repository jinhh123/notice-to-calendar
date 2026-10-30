// 生成随机颜色
function getRandomColor() {
  const colors = [
    '#1677ff', '#52c41a', '#faad14', '#eb2f96',
    '#13c2c2', '#722ed1', '#fa541c', '#1890ff',
  ]
  return colors[Math.floor(Math.random() * colors.length)]
}

// 修正 AI 可能提取错的年份
function fixDateYear(dateStr) {
  if (!dateStr) return ''
  const currentYear = new Date().getFullYear()
  // 如果 AI 给了 "2023-10-20" 这种格式，强行替换成 2026
  const match = dateStr.match(/\d{4}-(\d{2})-(\d{2})/)
  if (match) {
    return `${currentYear}-${match[1]}-${match[2]}`
  }
  return dateStr
}

export async function parseText(text) {
  try {
    const currentYear = new Date().getFullYear()

    // 构造给 DeepSeek 的提示词（明确告知当前年份）
    const systemPrompt = `你是一个校园通知信息提取助手。当前年份是 ${currentYear}年。从用户提供的通知文本中提取以下字段，返回 JSON：
- title: 日程标题（如"关于XX的通知"），没有则填"未命名日程"
- time: 时间描述（如"10月15日14点"），如果是持续日程则留空
- location: 地点
- items: 需要携带的物品数组（如 ["学生证", "笔记本"]）
- unit: 发布单位
- credit: 学分（字符串或数字）
- isImportant: 是否紧急/重要（布尔值 true/false）
- isDuration: 是否为持续多天日程（布尔值 true/false）
- startDate: 开始日期（必须用 YYYY-MM-DD 格式，且年份必须是 ${currentYear}）
- endDate: 结束日期（必须用 YYYY-MM-DD 格式，且年份必须是 ${currentYear}）

只返回 JSON，不要任何其他文字。如果某字段不存在，填空字符串或空数组。`

    const response = await fetch('/api/deepseek', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1
      })
    })

    if (!response.ok) throw new Error(`接口返回 ${response.status}`)

    const data = await response.json()
    if (!data.choices || !data.choices[0]) throw new Error('AI 返回数据格式错误')

    const result = JSON.parse(data.choices[0].message.content)
    result.source = text
    result.color = getRandomColor()

    // 补齐字段并修复年份
    if (!result.items) result.items = []
    if (result.isImportant === undefined) result.isImportant = false
    if (result.isDuration === undefined) result.isDuration = false
    
    // 修复 AI 提取的年份错误
    result.startDate = fixDateYear(result.startDate)
    result.endDate = fixDateYear(result.endDate)
    if (!result.time) result.time = ''

    // 如果 AI 漏填了起止日期，但提取了时间，尝试用本地逻辑补充
    // 注意：localFallbackParse 现在会抛错，这里必须单独兜住，避免把 AI 的有效结果一起丢掉
    if (result.isDuration && (!result.startDate || !result.endDate)) {
      try {
        const localCheck = localFallbackParse(text)
        if (localCheck.isDuration) {
          result.startDate = localCheck.startDate
          result.endDate = localCheck.endDate
        }
      } catch (e) {
        // 本地也判断不出日期，保留 AI 的原始结果
      }
    }

    return result
  } catch (err) {
    console.warn('AI 解析失败，已降级使用本地正则:', err.message)
    return localFallbackParse(text)
  }
}

// 明确日期：10月15日 / 10-15 / 2026-10-15
const DATE_RE = /(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]?|\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[-/]\d{1,2}/
// 明确的活动动作词
const ACTION_WORDS = [
  '开会', '会议', '例会', '班会', '活动', '讲座', '报告', '宣讲', '座谈', '研讨',
  '培训', '课程', '上课', '实验', '考试', '答辩', '面试', '招聘', '比赛', '竞赛',
  '报名', '签到', '缴费', '领取', '体检', '演出', '晚会', '展览', '典礼', '仪式',
  '提交', '截止', '投稿', '实习', '实践'
]

function hasScheduleSignal(text) {
  if (DATE_RE.test(text)) return true
  return ACTION_WORDS.some(w => text.includes(w))
}

// 本地正则解析（备用方案）
function localFallbackParse(text) {
  const normalized = String(text || '')

  // 兜底门槛：既没有日期也没有动作词，直接判定为无效文本
  if (!hasScheduleSignal(normalized)) {
    throw new Error('文本中未检测到有效日程')
  }

  const now = new Date()
  const currentYear = now.getFullYear()
  const result = {
    title: '未命名日程', time: '', location: '', items: [], unit: '',
    credit: '', source: text, isImportant: false, isDuration: false,
    startDate: '', endDate: '', color: getRandomColor()
  }

  const durationMatch = text.match(/(\d{1,2})月(\d{1,2})日\s*[-—至到~]\s*(?:(\d{1,2})月)?(\d{1,2})日/)
  if (durationMatch) {
    result.isDuration = true
    const startM = durationMatch[1].padStart(2, '0')
    const startD = durationMatch[2].padStart(2, '0')
    const endM = durationMatch[3] ? durationMatch[3].padStart(2, '0') : startM
    const endD = durationMatch[4].padStart(2, '0')
    result.startDate = `${currentYear}-${startM}-${startD}`
    result.endDate = `${currentYear}-${endM}-${endD}`
    result.time = `${durationMatch[1]}月${durationMatch[2]}日-${endM}月${endD}日`
  } else {
    const timePatterns = [/(\d{1,2}月\d{1,2}日[^\s，,。；;]*)/, /(明天[^\s，,。；;]*)/, /(今天[^\s，,。；;]*)/, /(\d{1,2}[:：]\d{2})/]
    for (const p of timePatterns) {
      const m = text.match(p)
      if (m) { result.time = m[1]; break }
    }
  }

  const titleMatch = text.match(/(关于[^的]{2,20}的通知)/)
  if (titleMatch) result.title = titleMatch[1]

  const locMatch = text.match(/([^\s，,。；;]{2,15}(报告厅|图书馆|教学楼|体育馆|会议室|楼|室|厅|馆|场))/)
  if (locMatch) result.location = locMatch[1]

  const itemMatches = text.match(/带([^\s，,。；;]+)/g)
  if (itemMatches) result.items = itemMatches.map(s => s.replace(/^带/, ''))

  const unitMatch = text.match(/([^\s，,。；;]{2,10}(学院|学部|系|处|中心|办公室))/)
  if (unitMatch) result.unit = unitMatch[1]

  const creditMatch = text.match(/(\d+(\.\d+)?)\s*学分/)
  if (creditMatch) result.credit = creditMatch[1]

  return result
}

// 中国无夏令时，固定 UTC+8
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000
const ONE_DAY_MS = 24 * 60 * 60 * 1000

// 按北京时间拼出 YYYY-MM-DD，不受运行环境时区影响
function toBeijingDateString(date = new Date()) {
  const shifted = new Date(date.getTime() + BEIJING_OFFSET_MS)
  const y = shifted.getUTCFullYear()
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0')
  const d = String(shifted.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// 日期规范化（日历组件依赖此函数）
export function normalizeDate(timeStr) {
  if (!timeStr) return ''
  const now = new Date()

  const mdMatch = timeStr.match(/(\d{1,2})月(\d{1,2})日/)
  if (mdMatch) {
    const currentYear = toBeijingDateString(now).slice(0, 4)
    const month = mdMatch[1].padStart(2, '0')
    const day = mdMatch[2].padStart(2, '0')
    return `${currentYear}-${month}-${day}`
  }
  if (timeStr.includes('明天')) {
    // 先按毫秒加一天，再折算北京时间（中国无夏令时，24h 恒等一天）
    return toBeijingDateString(new Date(now.getTime() + ONE_DAY_MS))
  }
  if (timeStr.includes('今天')) {
    return toBeijingDateString(now)
  }
  return ''
}