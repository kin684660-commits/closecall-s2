# 收盘见 CloseCall · 判断收据

NVDAUSDT 股票永续：封盘后5分钟核验窗口内的首次合格 lastPrice，是否严格高于基准 234.76 USDT？

- 市场：Bitget 股票永续短时加赛
- 状态：settled
- 封盘：2026-10-03T20:09:00.345Z
- 核验开始：2026-10-03T20:14:00.345Z
- 基准：234.76 USDT
- 基准来源：https://api.bitget.com/api/v3/market/tickers?category=USDT-FUTURES&symbol=NVDAUSDT
- 规则：Bitget官方SDK：目标时间到目标时间+120秒内，首次取得的有效ticker，要求行情ts也在窗口内、相对获取时间不超过120秒；不回填或外推。
- 平价归 NO；不执行交易。

## 人类
P(YES): 0.5

开发者云端教程验证：短时方向证据不足，使用50%中性基线；用于功能验证，不代表投资建议或真实用户认可。

## AI
模型：deepseek-flash
P(YES): 0.42

永续最新 lastPrice 恰为 234.76，与基准完全相等，按“严格高于”规则当前即为 NO，且盘口买一 234.76、卖一 234.77 显示价格紧贴基准，突破需额外买盘推动。偏多因素是近几根 1H K 线收在 234.69–234.76、24h 高点 235.01，说明上方仍有试探空间；偏空因素是 funding 为 0、成交清淡，缺乏持续上行动能。原生美股日线 233.95 仅作无关背景，不能与永续价格直接比较。

限制：证据稀疏：仅有单一交易所快照，无封盘后 5 分钟窗口的实际成交数据。；lastPrice 等于基准时按规则判 NO，任何微小回落都会强化该结果。；原生美股日线与股票永续为不同工具、时间戳不同，不可作为溢价或收敛依据。；本预测不构成投资建议，不保证收益。

## 核验结果
结果：YES
终值：234.94
AI Brier: 0.3364000000000001
人类 Brier: 0.25
胜方：human

## 内容摘要
AI: 79655100cf80d05a6a3ef9fbc47d81f0ca6ee54a80628bd6321dae330386b7f8
Human: 2f5000cecb560a59d4f5722360842472a0522bc9b01e9ba004bf6bf6188f31f0

## 证据
- [原生美股 · 最近完整交易日日线](https://api.nasdaq.com/api/quote/NVDA/historical?assetclass=stocks&fromdate=2026-08-29&todate=2026-10-03&limit=40) · 获取 2026-10-03T20:06:00.345Z · SHA256 0ad683a516536defa5a6c522504d10d5e867b66f5d97b3d5bd3f716eade25bd0
- [Bitget 官方 SDK · instruments](https://api.bitget.com/api/v3/market/instruments?category=USDT-FUTURES&symbol=NVDAUSDT) · 获取 2026-10-03T20:05:59.665Z · SHA256 166412f0f76b44599f6d2aa84841782312c267c3524ac31f4f4c9d12b46c050a
- [Bitget 官方 SDK · orderbook](https://api.bitget.com/api/v3/market/orderbook?category=USDT-FUTURES&symbol=NVDAUSDT&limit=5) · 获取 2026-10-03T20:05:59.771Z · SHA256 8040d64905ca0cc631e6bea5964fdef38676a62a472d6f680d17e3551c98e765
- [Bitget 官方 SDK · candles](https://api.bitget.com/api/v3/market/candles?category=USDT-FUTURES&symbol=NVDAUSDT&interval=1H&limit=24) · 获取 2026-10-03T20:05:59.773Z · SHA256 f01c927dfd0121f3888a1b3224e7b94ebf8e6680af694362de2bebc68aa789cc
- [Bitget 官方 SDK · tickers](https://api.bitget.com/api/v3/market/tickers?category=USDT-FUTURES&symbol=NVDAUSDT) · 获取 2026-10-03T20:05:59.774Z · SHA256 8f97a7c0ac5370beb3cef0201a3e26038ff45952751ee22ef63f4f3cc0c0bb45

哈希证明内容一致性，不构成链上存证或独立第三方时间证明。完整字段与审计事件请下载 JSON。
