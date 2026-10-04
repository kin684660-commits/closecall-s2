# 收盘见 CloseCall · 判断收据

NVDAUSDT 股票永续：封盘后5分钟核验窗口内的首次合格 lastPrice，是否严格高于基准 234.76 USDT？

- 市场：Bitget 股票永续短时加赛
- 状态：settled
- 封盘：2026-10-03T19:31:56.376Z
- 核验开始：2026-10-03T19:36:56.376Z
- 基准：234.76 USDT
- 基准来源：https://api.bitget.com/api/v3/market/tickers?category=USDT-FUTURES&symbol=NVDAUSDT
- 规则：Bitget官方SDK：目标时间到目标时间+120秒内，首次取得的有效ticker，要求行情ts也在窗口内、相对获取时间不超过120秒；不回填或外推。
- 平价归 NO；不执行交易。

## 人类
P(YES): 0.5

开发者功能验证：缺少短时方向优势，因此选择50%作为基线；此判断不代表真实用户使用或投资建议。

## AI
模型：deepseek-flash
P(YES): 0.42

看涨考虑：Bitget 永续最新 lastPrice 恰为 234.76，与基准相等；最近 1H K 线显示价格从 234.15 逐步抬升，最后一根收于 234.76，且买一 234.81 高于基准，说明封盘后核验窗口内若出现轻微上行，首次合格 lastPrice 可能严格高于 234.76。看跌考虑：基准本身就是当前 lastPrice，且卖一 234.82 仅略高、买一 234.81 仅略高，价格在基准附近窄幅震荡；最近多根 K 线高点多次触及 234.76 后回落，缺乏明确突破动能，首次合格 lastPrice 更可能等于或低于基准。证据稀疏：仅有原生美股日线收盘（约 225 附近，且为延迟/非逐笔）和 Bitget 永续快照，无法证明封盘后 5 分钟窗口内的具体首次成交价。

限制：原生美股日线收盘价与 NVDAUSDT 股票永续是不同工具，不能直接换算或证明永续在核验窗口内的首次 lastPrice。；所有 Bitget 快照均为单一时刻的延迟公共数据，未提供封盘后 5 分钟核验窗口内的逐笔或首次合格 lastPrice。；基准 234.76 恰等于当前 lastPrice，结果对微小价格变动和快照时点高度敏感，证据不足以给出高置信判断。

## 核验结果
结果：NO
终值：234.69
AI Brier: 0.17639999999999997
人类 Brier: 0.25
胜方：ai

## 内容摘要
AI: 019348e4570d64a7f42e79e334d9564f484af869729a455503a829b5e7679409
Human: 7be95b2792ba42d5333c6b291215c5b4a4751432b05cc924fad88deb2e14b270

## 证据
- [原生美股 · 最近完整交易日日线](https://query1.finance.yahoo.com/v8/finance/chart/NVDA?interval=1d&range=1mo) · 获取 2026-10-03T19:28:55.659Z · SHA256 d84d2fd13b8f85589e3d6e4109b5124de233eab9d356a17050dbc84de475a0e5
- [Bitget 官方 SDK · instruments](https://api.bitget.com/api/v3/market/instruments?category=USDT-FUTURES&symbol=NVDAUSDT) · 获取 2026-10-03T19:28:55.488Z · SHA256 166412f0f76b44599f6d2aa84841782312c267c3524ac31f4f4c9d12b46c050a
- [Bitget 官方 SDK · tickers](https://api.bitget.com/api/v3/market/tickers?category=USDT-FUTURES&symbol=NVDAUSDT) · 获取 2026-10-03T19:28:55.612Z · SHA256 9bcf043477902d6b07426bc4d997564a495af40af8467b635adcaeb3374265e2
- [Bitget 官方 SDK · candles](https://api.bitget.com/api/v3/market/candles?category=USDT-FUTURES&symbol=NVDAUSDT&interval=1H&limit=24) · 获取 2026-10-03T19:28:55.837Z · SHA256 5cf30d6990dead17a049dedc35c99ac7844a57624fa854a8afbc01381af9d67a
- [Bitget 官方 SDK · orderbook](https://api.bitget.com/api/v3/market/orderbook?category=USDT-FUTURES&symbol=NVDAUSDT&limit=5) · 获取 2026-10-03T19:28:55.897Z · SHA256 77ff068b2710c4cdf9e4ab8ff5124e76db74740fafe9d78a93625ffc3b464e6e

哈希证明内容一致性，不构成链上存证或独立第三方时间证明。完整字段与审计事件请下载 JSON。
