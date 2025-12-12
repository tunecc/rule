/**
 * Sub-Store 顺序端口映射脚本
 * * * 核心功能: 
 * 按照节点顺序，一一对应分配端口。
 * * * * * 参数说明:
 * 1. mapping: (必填) 配置中转机的 IP 和后缀。格式: IP@后缀
 * 2. ports:   (可选) 用逗号隔开的端口列表。第1个节点用第1个端口，第2个用第2个...
 * * 如果不填此参数，脚本将默认保留原节点的端口。
 * 3. keep:    (可选) 默认为 false。填 "true" 则会在输出中保留原节点。
 * * * * * 示例场景:
 * 你有2个节点 (香港、日本)。
 * 香港需要用端口 1234，日本需要用端口 2345。
 * 中转机 IP 是 1.1.1.1 和 2.2.2.2。
 * * * * * URL 写法示例:
 * .../relay.js#mapping=1.1.1.1@-1Tr,2.2.2.2@-2Tr&ports=1234,2345&keep=true
 * .../relay.js#mapping=1.1.1.1@-1Tr,2.2.2.2@-2Tr&ports=1234,2345
 * https://raw.githubusercontent.com/tunecc/rule/refs/heads/main/Scripts/relay.js#mapping=1.1.1.1@-1Tr,2.2.2.2@-2Tr
 */

// 获取参数
const args = typeof $arguments !== "undefined" ? $arguments : {};
const MAPPING_STR = args.mapping ? decodeURIComponent(args.mapping) : "";
// 【核心】获取端口列表字符串，并分割成数组
const PORTS_STR = args.ports ? decodeURIComponent(args.ports) : "";
const PORT_LIST = PORTS_STR.split(",").map(p => parseInt(p.trim())).filter(p => !isNaN(p));
const KEEP_ORIGINAL = args.keep === "true";

// 解析 mapping 配置 (IP 和 后缀)
const CONFIGS = MAPPING_STR.split(",")
  .map(item => {
    item = item.trim();
    if (!item) return null;
    const firstAt = item.indexOf("@");
    if (firstAt === -1) return null;
    const ip = item.substring(0, firstAt).trim();
    const suffix = item.substring(firstAt + 1);
    if (!ip) return null;
    return { ip, suffix };
  })
  .filter(item => item !== null);

function operator(proxies = [], targetPlatform, context) {
  if (CONFIGS.length === 0) return proxies;

  const newProxies = [];

  // 遍历节点列表 (使用 index 来匹配端口)
  proxies.forEach((proxy, index) => {
    if (!proxy.server) return;
    
    // 如果开启保留原节点
    if (KEEP_ORIGINAL) newProxies.push(proxy);

    // 【核心逻辑】根据当前节点在列表中的顺序 (index)，去取对应的端口
    // 逻辑：尝试从 ports 列表中取第 index 个端口
    // 如果没取到 (比如没填 ports 参数，或节点数多于端口数)，则默认保留原端口 (proxy.port)
    let targetPort = proxy.port; 
    if (index < PORT_LIST.length) {
        targetPort = PORT_LIST[index];
    }

    // 遍历每一个中转 IP 配置
    CONFIGS.forEach(config => {
      const newNode = JSON.parse(JSON.stringify(proxy));
      
      // 1. 修改 IP (所有节点都用这个中转 IP)
      newNode.server = config.ip;

      // 2. 修改端口 (使用上面按顺序匹配到的 targetPort，如果没配 ports 则保持原样)
      newNode.port = targetPort;
      
      // 3. 修改名字
      const originalName = proxy.name || "无名";
      newNode.name = originalName + config.suffix;
      
      newProxies.push(newNode);
    });
  });

  return newProxies;
}