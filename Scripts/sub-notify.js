/**
 * 订阅拉取通知
 * 
 * 参数
 * - [telegram_bot_token] Telegram Bot Token
 * - [telegram_chat_id] Telegram Chat ID
 * - [time_format] 时间格式 (可选，默认为"MM-DD HH:mm:ss")
 */

async function operator(proxies = [], targetPlatform, env) {
  const $ = $substore
  const telegram_chat_id = $arguments.telegram_chat_id
  const telegram_bot_token = $arguments.telegram_bot_token
  const time_format = $arguments.time_format || 'MM-DD HH:mm:ss'
  
  // 获取订阅名称
  let name = ''
  for (const [key, value] of Object.entries(env.source)) {
    if (!key.startsWith('_')) {
      name = value.displayName || value.name
      break
    }
  }
  if (!name) {
    const collection = env.source._collection
    name = collection.displayName || collection.name
  }
  
  // 获取当前时间
  const currentTime = formatDate(new Date(), time_format)
  
  // 获取节点数量
  const nodeCount = proxies.length
  
  // 生成要发送的消息
  const text = `${name}\n${currentTime}\n数量: ${nodeCount}`;
  
  // 发送 Telegram 通知
  if (telegram_chat_id && telegram_bot_token) {
    try {
      const response = await http({
        method: 'post',
        url: `https://api.telegram.org/bot${telegram_bot_token}/sendMessage`,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          chat_id: telegram_chat_id, 
          text: text
        }),
        retries: 2,
        timeout: 10000,
      })
    } catch (error) {
      $.error(`发送 Telegram 通知失败: ${error.message || error}`)
      $.error(`请检查您的Bot Token和Chat ID是否正确`)
    }
  } else {
    $.error(`缺少参数! telegram_chat_id=${telegram_chat_id}, telegram_bot_token=${telegram_bot_token ? '已设置' : '未设置'}`)
  }
  
  // 原样返回节点
  return proxies
  
  // 格式化日期函数
  function formatDate(date, format) {
    const pad = (n) => (n < 10 ? '0' + n : n)
    
    const year = date.getFullYear()
    const month = pad(date.getMonth() + 1)
    const day = pad(date.getDate())
    const hour = pad(date.getHours())
    const minute = pad(date.getMinutes())
    const second = pad(date.getSeconds())
    
    return format
      .replace('YYYY', year)
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hour)
      .replace('mm', minute)
      .replace('ss', second)
  }
  
  // 请求函数
  async function http(opt = {}) {
    const METHOD = opt.method || 'get'
    const TIMEOUT = parseFloat(opt.timeout || 10000)
    const RETRIES = parseFloat(opt.retries ?? 2)
    const RETRY_DELAY = parseFloat(opt.retry_delay ?? 1000)
    let count = 0
    
    const fn = async () => {
      try {
        return await $.http[METHOD]({ ...opt, timeout: TIMEOUT })
      } catch (e) {
        $.error(`HTTP请求错误: ${e.message || e}`)
        if (count < RETRIES) {
          count++
          const delay = RETRY_DELAY * count
          await $.wait(delay)
          return await fn()
        } else {
          throw e
        }
      }
    }
    return await fn()
  }
}