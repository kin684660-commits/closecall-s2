# 收盘见 CloseCall

公开源码：https://github.com/kin684660-commits/closecall-s2 · MIT

**你说会涨？留下判断，收盘见。**

[在线Demo](https://closecall.43.167.174.154.nip.io/) · [演示、运行收据与技术验证](https://closecall.43.167.174.154.nip.io/submission/index.html)

CloseCall 是人类与 AI 的美股预测校准工作台。AI 先独立作答并提交内容摘要，人类确认概率与理由后揭晓答案；到期按事先约定的价格规则核验，生成判断收据与 Brier 分数。不是自动交易机器人，不连接交易账户、不接受资金押注。

参赛：Bitget AI Base Camp Hackathon S2 · **AI Trading Desk / 开放主题**。与 Afterbell 独立：Afterbell 帮助形成有证据的投研判断；CloseCall 保存前瞻预测并追踪实际结果。共享了自主开发的日历思路及数据集成经验，未复制其他获奖项目源码。

## 使用流程

1. 选择 NVDA、AAPL、MSFT、TSLA、AMZN 或 META。
2. 选择原生美股收盘挑战，或明确标注的 Bitget 股票永续短时加赛。
3. 服务端取得真实数据，DeepSeek 独立提交 P(YES)、理由、引用和限制。
4. 用户在截止前提交 P(YES) 和理由。AI 输入不含用户答案；提交前不向浏览器返回 AI 答案或随机盐。
5. 原始规则、AI 与人类回答保留，原回答不可覆盖。后台 worker 负责到期核验，即使浏览器关闭也继续。
6. 查看真实结果、Brier 分数、证据与 JSON/Markdown 判断收据。主动选择公开才可分享对局。

## 定价与计分

- **原生美股收盘**：下一完整纽约交易日未复权日线收盘价是否严格高于取得的最近完整收盘基准；USD；不是含分红总收益。NYSE 日历覆盖 2026–2028，支持 DST、假日及提前收市。收盘20分钟后开始，Yahoo 日线与 Nasdaq 同日历史收盘交叉核验，差异 >0.1% 或任一源缺失则等待。超过48小时未通过则不计分；拆股等不适用场景拒绝核验。
- **股票永续加赛**：人类提交窗口180秒；封盘后5分钟开始，在120秒核验窗口内首次取得合格 Bitget ticker。行情时间也必须在窗口中且不得超过获取时间；比较 lastPrice，USDT。不是原生股票、可赎回代币、真实成交或收益。过期报价绝不补填。
- 平价归 NO。Brier = (p − y)²，p 为 P(YES)，y∈{0,1}，越低越好。展示固定50%基线；两个市场分开汇总，仅公开且双方参与、已核验的对局进入榜单。
- 榜单存在自选题和公开选择偏差；小样本不证明 AI 或人类稳定优势。模型概率是主观预测，未经过大样本校准。

## 数据与 AI

- Bitget 官方 `@bitget-ai/bitget-agent-sdk`：`discover → market.instruments/tickers/orderbook/candles`。发现阶段核验公开只读契约，身份核验为 stock / perpetual / USDT-FUTURES。
- Bitget 美股 MCP：真实调用 `initialize → guide → do_query equity_price_quote`。响应不成功或缺失会保留失败记录，不能宣称已取得。
- Yahoo Finance：原生股票身份、USD、交易所、日线 close 和纽约交易日映射；query1/query2均不可用时尝试Nasdaq精确历史作为备用基准，结算仍要求Yahoo与Nasdaq两个来源。公共数据延迟与可执行性不保证。
- Nasdaq：精确目标交易日历史 close 交叉核验；info 的日期级最新报价不用于结算。
- DeepSeek：服务端 OpenAI 兼容接口、JSON Schema / Zod 校验、已取得证据 ID 约束。提示中将资料视为不可信数据。引用关联验证不等于独立事实审计，系统不保证预测正确。

## 运行

需要 **Node.js 24**（内置 `node:sqlite`）。

```bash
npm ci
cp .env.example .env.local
# 仅在本机文件填 API key；随机生成至少32字符的会话与cron密钥。
npm run dev
```

另一个终端：

```bash
node --env-file=.env.local scripts/worker.mjs
```

打开 http://127.0.0.1:3011 。默认数据写入 `data/closecall.sqlite`；不要丢弃此目录，否则历史记录与身份关联会丢失。

生产：`npm run build` 后使用 Next standalone。部署说明见 [docs/DEPLOY.md](docs/DEPLOY.md)。密钥只在服务器环境中，任何 `NEXT_PUBLIC_*` 均不得存放密钥。

```bash
npm test
npm run verify:live
```

测试中的 `SYNTHETIC TEST FIXTURE` 仅用于验证软件规则，不进入 Demo、实际预测、成绩榜或实测报告。

## API

| 接口 | 作用 |
|---|---|
| POST /api/rounds | 真实取数并创建AI独立预测，返回隐藏答案的挑战 |
| GET /api/rounds | 当前访客及主动公开的对局 |
| GET /api/rounds/:id | 权限控制后的详情与审计事件 |
| POST /api/rounds/:id/commit | 截止前封存人类判断，揭晓AI答案 |
| POST /api/rounds/:id/settle | 本场创建者请求按既定规则核验 |
| GET /api/rounds/:id/export?format=json | 完整JSON，默认Markdown |
| GET /api/stats | 按市场分别统计公开已核验对局 |
| POST /api/cron | 受私有cron密钥保护的自动核验 |

## 安全与边界

签名 HttpOnly / SameSite 访客会话隔离私人对局；同源写请求校验；SQLite 持久化每日模型额度，重启不重置。默认按UTC日每天全局30次、每访客6次、间隔60秒、同时最多2个准备任务。访客可清Cookie换身份，因此单访客限流不是身份认证；全局额度仍持久。接口失败也占已预留额度，以免失败重试无限消耗。

回答使用随机盐 SHA-256 封存。SQLite 触发器阻止应用常规更新覆盖原回答和结果，审计追加哈希链。**不是链上存证、独立第三方时间证明，也不保证拥有数据库管理权的运营方无法修改存储。** JSON 提供内容与盐，用户可自行重算。

人类实际作答时间晚于AI，双方可能取得不同外部信息；此工具不是严格信息对等的科学实验。没有真实用户数据时如实披露，开发测试不能包装成用户认可。独立研究质量、大样本校准和长期留存仍需验证。

## 许可与来源

代码 MIT。图像由内置 imagegen 生成，提示记录在 [docs/ASSETS.md](docs/ASSETS.md)。行情和外部数据受各来源条款约束，MIT 不授予第三方数据再分发权。机制参考 Mimir / Precall 的承诺与核验思路；未复用其源码、品牌或既有成绩。

## 独立核验收据

`node --import tsx scripts/verify-receipt.ts receipt.json` 可重新核对AI/人类摘要、证据文本摘要、单条审计事件摘要及Brier。导出仅含本场审计事件，不证明跨其他私人对局的全局链连续性，也不证明资料真实或可信时间。
