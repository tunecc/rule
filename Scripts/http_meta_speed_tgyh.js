/**
 *
 * 节点测速娱乐版(适配 Sub-Store Node.js 版)
 *
 * 原版：https://raw.githubusercontent.com/xream/scripts/main/surge/modules/sub-store-scripts/check/http_meta_speed.js
 * 
 * 说明: https://t.me/zhetengsha/1258
 *
 * 欢迎加入 Telegram 群组 https://t.me/zhetengsha
 *
 * HTTP META(https://github.com/xream/http-meta) 参数
 * - [http_meta_protocol] 协议 默认: http
 * - [http_meta_host] 服务地址 默认: 192.168.8.20
 * - [http_meta_port] 端口号 默认: 9876
 * - [http_meta_authorization] Authorization 默认无
 * - [http_meta_start_delay] 初始启动延时(单位: 毫秒) 默认: 3000
 * - [http_meta_proxy_timeout] 每个节点耗时(单位: 毫秒). 此参数是为了防止脚本异常退出未关闭核心. 设置过小将导致核心过早退出. 目前逻辑: 启动初始的延时 + 每个节点耗时. 默认: 10000
 *
 * 其它参数
 * - [timeout] 请求超时(单位: 毫秒) 默认 8000
 * - [retries] 重试次数 默认 0
 * - [retry_delay] 重试延时(单位: 毫秒) 默认 1000
 * - [concurrency] 并发数 默认 5
 * - [size] 测速大小(单位 MB). 默认 10
 * - [show_speed] 显示速度. 默认显示 注: 即使不开启这个参数, 节点上也会添加一个 _speed 字段
 * - [keep_incompatible] 保留当前客户端不兼容的协议. 默认保留.
 * - [cache] 使用缓存, 默认不使用缓存
 * - [min_speed] 最低速度阈值 (单位 Mbps). 默认 10
 * - [telegram_bot_token] Telegram Bot Token
 * - [telegram_chat_id] Telegram Chat ID
 * - [custom] 用户输入的自定义订阅名字
 */

async function operator(proxies = [], targetPlatform, env) {
  const cacheEnabled = $arguments.cache;
  const cache = scriptResourceCache;
  const http_meta_host = $arguments.http_meta_host ?? '192.168.8.20';
  const http_meta_port = $arguments.http_meta_port ?? 9876;
  const http_meta_protocol = $arguments.http_meta_protocol ?? 'http';
  const http_meta_authorization = $arguments.http_meta_authorization ?? '';
  const http_meta_api = `${http_meta_protocol}://${http_meta_host}:${http_meta_port}`;

  const http_meta_start_delay = parseFloat($arguments.http_meta_start_delay ?? 3000);
  const http_meta_proxy_timeout = parseFloat($arguments.http_meta_proxy_timeout ?? 10000);

  const keepIncompatible = $arguments.keep_incompatible ?? true;
  const minSpeed = parseFloat($arguments.min_speed ?? 10); // 最低速度阈值
  const bytes = ($arguments.size || 10) * 1024 * 1024;
  const url = `https://speed.cloudflare.com/__down?bytes=${bytes}`;
  const showSpeed = $arguments.show_speed ?? true;

  const telegram_bot_token = $arguments.telegram_bot_token;
  const telegram_chat_id = $arguments.telegram_chat_id;

  // 获取订阅名称，如果未定义则使用默认值
  const sub = env.source[proxies?.[0]?._subName || proxies?.[0]?.subName];
  const subName = sub?.displayName || sub?.name;
  const custom = $arguments.custom || subName || '默认订阅';
  
  // 添加日志记录自定义订阅名称
  $.info(`自定义订阅名称: ${custom}`);

  const validProxies = [];
  const incompatibleProxies = [];
  const internalProxies = [];
  const failedProxies = [];

  // 处理代理节点
  proxies.map((proxy, index) => {
    try {
      const node = ProxyUtils.produce([{ ...proxy }], 'ClashMeta', 'internal')?.[0];
      if (node) {
        for (const key in proxy) {
          if (/^_/i.test(key)) {
            node[key] = proxy[key];
          }
        }
        internalProxies.push({ ...node, _proxies_index: index });
      } else {
        if (keepIncompatible) {
          incompatibleProxies.push(proxy);
        }
      }
    } catch (e) {
      $.error(e);
    }
  });

  $.info(`核心支持节点数: ${internalProxies.length}/${proxies.length}`);
  if (!internalProxies.length) return proxies;

  const http_meta_timeout = http_meta_start_delay + internalProxies.length * http_meta_proxy_timeout;

  let http_meta_pid;
  let http_meta_ports = [];

  // 启动 HTTP META
  const res = await http({
    retries: 0,
    method: 'post',
    url: `${http_meta_api}/start`,
    headers: {
      'Content-type': 'application/json',
      Authorization: http_meta_authorization,
    },
    body: JSON.stringify({
      proxies: internalProxies,
      timeout: http_meta_timeout,
    }),
  });

  let body = res.body;
  try {
    body = JSON.parse(body);
  } catch (e) {}

  const { ports, pid } = body;
  if (!pid || !ports) {
    throw new Error(`======== HTTP META 启动失败 ====\n${body}`);
  }

  http_meta_pid = pid;
  http_meta_ports = ports;
  $.info(
    `\n======== HTTP META 启动 ====\n[端口] ${ports}\n[PID] ${pid}\n[超时] 若未手动关闭 ${
      Math.round(http_meta_timeout / 60 / 10) / 100
    } 分钟后自动关闭\n`
  );

  $.info(`等待 ${http_meta_start_delay / 1000} 秒后开始检测`);
  await $.wait(http_meta_start_delay);

  const concurrency = parseInt($arguments.concurrency || 5); // 一组并发数
  await executeAsyncTasks(
    internalProxies.map(proxy => () => check(proxy)),
    { concurrency }
  );

  // 停止 HTTP META
  try {
    const res = await http({
      method: 'post',
      url: `${http_meta_api}/stop`,
      headers: {
        'Content-type': 'application/json',
        Authorization: http_meta_authorization,
      },
      body: JSON.stringify({
        pid: [http_meta_pid],
      }),
    });
    $.info(`\n======== HTTP META 关闭 ====\n${JSON.stringify(res, null, 2)}`);
  } catch (e) {
    $.error(e);
  }

  // 发送 Telegram 通知
  if (telegram_chat_id && telegram_bot_token && validProxies.length > 0) {
    try {
      // 找出最快和最慢节点
      const fastestProxy = validProxies.reduce((fastest, proxy) => proxy._speed > fastest._speed ? proxy : fastest, validProxies[0]);
      const slowestProxy = validProxies.reduce((slowest, proxy) => proxy._speed < slowest._speed ? proxy : slowest, validProxies[0]);

      // 构建消息内容，使用 MarkdownV2 格式并转义必要字符
      const escapeMarkdownV2 = (text) => {
        const escapeChars = /([_|*[\]()~`>#+\-=|{}.!])/g;
        return text.replace(escapeChars, '\\$1');
      };

      const escapedCustom = escapeMarkdownV2(custom);
      const escapedFastestName = escapeMarkdownV2(fastestProxy.name);
      const escapedSlowestName = escapeMarkdownV2(slowestProxy.name);
      const nodeCount = validProxies.length;

      const text = `${escapedCustom}speedtest\n最快节点为：${escapedFastestName}\n最慢节点为：${escapedSlowestName}\n共${nodeCount}个节点`;

      // 发送消息
      await http({
        method: 'post',
        url: `https://api.telegram.org/bot${telegram_bot_token}/sendMessage`,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          chat_id: telegram_chat_id, 
          text, 
          parse_mode: 'MarkdownV2'
        }),
      });
  }

  return (keepIncompatible ? [...validProxies, ...incompatibleProxies] : validProxies).sort(
    (a, b) => b._speed - a._speed
  );

  // 测试代理速度的函数
  async function check(proxy) {
    const id = cacheEnabled
      ? `http-meta:speed:${JSON.stringify(
          Object.fromEntries(
            Object.entries(proxy).filter(([key]) => !/^(name|collectionName|subName|id|_.*)$/i.test(key))
          )
        )}`
      : undefined;
    try {
      const cached = cache.get(id);
      if (cacheEnabled && cached) {
        $.info(`[${proxy.name}] 使用缓存`);
        if (cached.speed) {
          if (cached.speed >= minSpeed) {
            validProxies.push({
              ...proxy,
              name: `${showSpeed ? `[${cached.speed}M] ` : ''}${proxy.name}`,
              _speed: cached.speed,
            });
          }
        }
        return;
      }

      const index = internalProxies.indexOf(proxy);
      const startedAt = Date.now();
      const res = await http({
        proxy: `http://${http_meta_host}:${http_meta_ports[index]}`,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Mobile/15E148 Safari/604.1',
        },
        url,
      });
      
      const status = parseInt(res.status || res.statusCode || 200);
      const latency = `${Date.now() - startedAt}`;
      const speed = Math.round((bytes / 1024 / 1024 / (latency / 1000)) * 8);
      $.info(`[${proxy.name}] status: ${status}, latency: ${latency}, speed: ${speed} M`);
      
      if (speed >= minSpeed) {
        validProxies.push({
          ...proxy,
          name: `${showSpeed ? `[${speed}M]` : ''}${proxy.name}`,
          _speed: speed,
        });
        if (cacheEnabled) {
          $.info(`[${proxy.name}] 设置成功缓存`);
          cache.set(id, { speed });
        }
      } else {
        if (cacheEnabled) {
          $.info(`[${proxy.name}] 设置失败缓存`);
          cache.set(id, {});
        }
      }
    } catch (e) {
      $.error(`[${proxy.name}] ${e.message ?? e}`);
      if (cacheEnabled) {
        $.info(`[${proxy.name}] 设置失败缓存`);
        cache.set(id, {});
      }
    }
  }
  
  // HTTP 请求的封装函数，支持重试机制
  async function http(opt = {}) {
    const METHOD = opt.method || $arguments.method || 'get';
    const TIMEOUT = parseFloat(opt.timeout || $arguments.timeout || 8000);
    const RETRIES = parseFloat(opt.retries ?? $arguments.retries ?? 0);
    const RETRY_DELAY = parseFloat(opt.retry_delay ?? $arguments.retry_delay ?? 1000);
    let count = 0;
    const fn = async () => {
      try {
        return await $.http[METHOD]({ ...opt, timeout: TIMEOUT });
      } catch (e) {
        if (count < RETRIES) {
          count++;
          const delay = RETRY_DELAY * count;
          await $.wait(delay);
          return await fn();
        } else {
          throw e;
        }
      }
    };
    return await fn();
  }

  // 执行异步任务的封装函数，支持并发控制
  function executeAsyncTasks(tasks, { wrap, result, concurrency = 1 } = {}) {
    return new Promise(async (resolve, reject) => {
      try {
        let running = 0;
        const results = [];
        let index = 0;

        function executeNextTask() {
          while (index < tasks.length && running < concurrency) {
            const taskIndex = index++;
            const currentTask = tasks[taskIndex];
            running++;

            currentTask()
              .then(data => {
                if (result) {
                  results[taskIndex] = wrap ? { data } : data;
                }
              })
              .catch(error => {
                if (result) {
                  results[taskIndex] = wrap ? { error } : error;
                }
              })
              .finally(() => {
                running--;
                executeNextTask();
              });
          }

          if (running === 0) {
            return resolve(result ? results : undefined);
          }
        }

        executeNextTask();
      } catch (e) {
        reject(e);
      }
    });
  }
}