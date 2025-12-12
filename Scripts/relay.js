/**
 * Sub-Store 节点中转/裂变脚本
 * *  使用方法:
 * 在脚本 URL 后添加 #mapping=IP@后缀
 *
 * *  参数说明:
 * 1. mapping: 必填。格式为 "IP@后缀"。多组用 "," 隔开。
 * 2. keep: 可选。默认为 false。填 "true" 保留原节点。
 *
 * * @example
 * .../relay.js#mapping=1.1.1.1@-联通,2.2.2.2@-电信&keep=false
 */

// 获取参数
const args = typeof $arguments !== "undefined" ? $arguments : {};
const MAPPING_STR = args.mapping ? decodeURIComponent(args.mapping) : "";
const KEEP_ORIGINAL = args.keep === "true";

// 解析配置
const CONFIGS = MAPPING_STR.split(",")
  .map(item => {
    item = item.trim();
    if (!item) return null;
    
    // 优化分割逻辑：找到第一个 @ 的位置，确保后缀里带 @ 也不怕
    const firstAt = item.indexOf("@");
    if (firstAt === -1) return null; // 没有 @ 则无效

    const ip = item.substring(0, firstAt).trim();
    const suffix = item.substring(firstAt + 1); // 不 trim 后缀，保留可能的空格设计
    
    if (!ip) return null;

    return { ip, suffix };
  })
  .filter(item => item !== null);

function operator(proxies = [], targetPlatform, context) {
  // 只有在节点列表不为空且配置为空时才报错，防止空跑干扰
  if (CONFIGS.length === 0) {
    return proxies;
  }

  const newProxies = [];

  proxies.forEach(proxy => {
    // 忽略无效节点
    if (!proxy.server) return;

    // 是否保留原节点
    if (KEEP_ORIGINAL) {
      newProxies.push(proxy);
    }

    // 生成裂变节点
    CONFIGS.forEach(config => {
      const newNode = JSON.parse(JSON.stringify(proxy));
      
      // 修改 IP
      newNode.server = config.ip;
      
      // 修改名字
      const originalName = proxy.name || "无名";
      newNode.name = originalName + config.suffix;
      
      newProxies.push(newNode);
    });
  });

  return newProxies;
}