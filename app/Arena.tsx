"use client";
import { useEffect, useState } from "react";
type R = any;
const names: Record<string, string> = {
  NVDA: "NVIDIA",
  AAPL: "Apple",
  MSFT: "Microsoft",
  TSLA: "Tesla",
  AMZN: "Amazon",
  META: "Meta",
};
const stateName: Record<string, string> = {
  open: "等待你的判断",
  locked: "已封盘 · 等待核验",
  settled: "已到期核验",
  unresolved: "数据不足 · 不计分",
  expired: "已过期",
};
const time = (s: string) =>
  new Date(s).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
const nyTime = (s: string) =>
  new Date(s).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
function Left({ seconds }: { seconds: number }) {
  if (seconds <= 0) return <span>已到时</span>;
  const h = Math.floor(seconds / 3600),
    m = Math.floor((seconds % 3600) / 60),
    s = seconds % 60;
  return (
    <span>
      {h ? `${h}h ` : ""}
      {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  );
}
function Spark({ values }: { values: number[] }) {
  if (values.length < 2)
    return <p className="subtle">价格序列未取得，不绘制虚构走势</p>;
  const lo = Math.min(...values),
    hi = Math.max(...values);
  const points = values
    .map(
      (p, i) =>
        `${(i / (values.length - 1)) * 700},${90 - ((p - lo) / (hi - lo || 1)) * 70}`,
    )
    .join(" ");
  return (
    <svg viewBox="0 0 700 110" role="img" aria-label="真实取得的历史价格走势">
      <defs>
        <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c6ff00" stopOpacity=".3" />
          <stop offset="100%" stopColor="#c6ff00" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,110 ${points} 700,110`} fill="url(#fade)" />
      <polyline points={points} stroke="#c6ff00" strokeWidth="2" fill="none" />
    </svg>
  );
}
export default function Arena({ initialId }: { initialId?: string }) {
  const [rounds, setRounds] = useState<R[]>([]),
    [active, setActive] = useState<R | null>(null),
    [tab, setTab] = useState("arena"),
    [symbol, setSymbol] = useState("NVDA"),
    [mode, setMode] = useState("close"),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [prob, setProb] = useState(50),
    [reason, setReason] = useState(""),
    [alias, setAlias] = useState("杉 · 挑战者"),
    [publish, setPublish] = useState(false),
    [tick, setTick] = useState(Date.now()),
    [stats, setStats] = useState<any>(null),
    [elapsed, setElapsed] = useState(0),
    [copied, setCopied] = useState(false);
  function goToTab(next: string) {
    setTab(next);
    requestAnimationFrame(() =>
      window.scrollTo({ top: 0, behavior: "instant" }),
    );
  }
  async function load() {
    const r = await fetch("/api/rounds"),
      body = await r.json();
    if (body.rounds) {
      setRounds(body.rounds);
      if (active) {
        const found = body.rounds.find((x: R) => x.id === active.id);
        if (found) setActive(found);
      }
    }
    const s = await fetch("/api/stats");
    setStats(await s.json());
  }
  useEffect(() => {
    load().catch(() => setError("无法连接竞技场，请稍后重试"));
    if (initialId)
      fetch("/api/rounds/" + initialId)
        .then((r) => r.json())
        .then((r) => (r.id ? setActive(r) : setError(r.error)))
        .catch(() => {});
  }, []);
  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!busy) return;
    setElapsed(0);
    const t = setInterval(() => setElapsed((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);
  useEffect(() => {
    if (!active || ["settled", "unresolved", "expired"].includes(active.status))
      return;
    const t = setInterval(async () => {
      try {
        const response = await fetch("/api/rounds/" + active.id);
        const r = await response.json();
        if (r.id) setActive(r);
      } catch {}
    }, 10000);
    return () => clearInterval(t);
  }, [active?.id, active?.status]);
  async function create() {
    setBusy("prepare");
    setError("");
    try {
      const response = await fetch("/api/rounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, mode }),
      });
      const r = await response.json();
      if (!response.ok) throw Error(r.error);
      setActive(r);
      setTab("arena");
      setReason("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function commit() {
    setBusy("commit");
    setError("");
    try {
      const response = await fetch(`/api/rounds/${active.id}/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          probability: prob / 100,
          thesis: reason,
          alias,
          public: publish,
        }),
      });
      const r = await response.json();
      if (!response.ok) throw Error(r.error);
      setActive(r);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function settle() {
    setBusy("settle");
    setError("");
    try {
      const response = await fetch(`/api/rounds/${active.id}/settle`, {
        method: "POST",
      });
      const r = await response.json();
      if (!response.ok) throw Error(r.error);
      setActive(r);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function share() {
    if (!active.public) {
      setError("本场未选择公开，仅可下载私人收据。下一场封存前可勾选公开。");
      return;
    }
    await navigator.clipboard.writeText(location.origin + "/r/" + active.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }
  const locked =
    active && (active.human || tick >= Date.parse(active.rules.lockAt));
  const seconds = active
    ? Math.floor(
        (Date.parse(locked ? active.rules.settleAt : active.rules.lockAt) -
          tick) /
          1000,
      )
    : 0;
  const prices =
    active?.rules.mode === "sprint"
      ? active.rules.baseline.candles?.map((x: any) => x.close)
      : (() => {
          try {
            const raw = JSON.parse(
              active?.evidence.find((e: any) => e.id === "native-daily")
                ?.text || "[]",
            );
            return (Array.isArray(raw) ? raw : raw.history || []).map(
              (x: any) => x.price,
            );
          } catch {
            return [];
          }
        })();
  const result = active?.result;
  return (
    <>
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark">↗</span>
          <strong>
            收盘见<span>CloseCall</span>
          </strong>
        </a>
        <nav aria-label="主要导航">
          {[
            ["arena", "竞技场"],
            ["history", "判断档案"],
            ["score", "校准榜"],
            ["rules", "规则与证据"],
          ].map(([k, label]) => (
            <button
              key={k}
              className={tab === k ? "selected" : ""}
              aria-pressed={tab === k}
              onClick={() => goToTab(k)}
            >
              {label}
            </button>
          ))}
        </nav>
        <a className="outline small" href="/submission/index.html">
          项目与验证 ↗
        </a>
      </header>
      <main>
        {tab === "arena" && (
          <>
            <section className="hero" aria-labelledby="hero-title">
              <div className="studio-ring" aria-hidden="true" />
              <div className="hero-art-wrap" aria-hidden="true">
                <img className="hero-art" src="/art/closing-bell.webp" alt="" />
                <span className="art-caption">THE CLOSING BELL</span>
              </div>
              <span className="hero-block block-one" aria-hidden="true" />
              <span className="hero-block block-two" aria-hidden="true" />
              <div className="hero-copy">
                <div className="eyebrow">
                  <span className="dot" /> HUMAN × AI / 独立判断，真实核验
                </div>
                <h1 id="hero-title">
                  你说会涨？
                  <br />
                  <em>
                    收盘见<span>。</span>
                  </em>
                </h1>
                <p>
                  别只说你看好。
                  <br />
                  留下概率与理由，让时间来对答案。
                </p>
                <div className="hero-actions">
                  <button
                    className="primary hero-start"
                    onClick={() => {
                      setTab("arena");
                      requestAnimationFrame(() =>
                        document
                          .getElementById("round-launch")
                          ?.scrollIntoView({
                            behavior: matchMedia(
                              "(prefers-reduced-motion: reduce)",
                            ).matches
                              ? "instant"
                              : "smooth",
                            block: "start",
                          }),
                      );
                    }}
                  >
                    和 AI 来一场 <span>↗</span>
                  </button>
                  <button
                    className="hero-rule"
                    onClick={() => goToTab("rules")}
                  >
                    如何对答案？ →
                  </button>
                </div>
              </div>
              <div className="hero-foot">
                <span>
                  <b>01</b> 留下判断 / CALL
                </span>
                <span>
                  <b>02</b> 封存答案 / SEAL
                </span>
                <span>
                  <b>03</b> 到点核验 / CHECK
                </span>
              </div>
            </section>
            <div className="editorial-strip">
              <span>NO HINDSIGHT. JUST YOUR CALL.</span>
              <span>
                不靠事后解释。凭事前判断。 <b>↘</b>
              </span>
            </div>
          </>
        )}
        {error && (
          <div role="alert" className="error">
            <span>{error}</span>
            <button onClick={() => setError("")}>关闭</button>
          </div>
        )}
        {tab === "arena" && (
          <>
            <section className="arena-grid">
              <aside id="round-launch" className="panel launch">
                <div className="section-label">01 / SET THE STAGE</div>
                <h2>下一场，选谁？</h2>
                <p className="subtle">6 家美股公司 · 两种独立市场</p>
                <div className="symbols">
                  {Object.entries(names).map(([k, n]) => (
                    <button
                      key={k}
                      className={symbol === k ? "chosen" : ""}
                      aria-pressed={symbol === k}
                      onClick={() => setSymbol(k)}
                      disabled={!!busy}
                    >
                      <span className={"ticker-icon " + k.toLowerCase()}>
                        {k.slice(0, 1)}
                      </span>
                      <strong>
                        {k}
                        <small>{n}</small>
                      </strong>
                      {symbol === k && <span className="check">✓</span>}
                    </button>
                  ))}
                </div>
                <div className="mode-options">
                  <button
                    className={mode === "close" ? "on" : ""}
                    aria-pressed={mode === "close"}
                    onClick={() => setMode("close")}
                  >
                    <strong>美股收盘挑战</strong>
                    <small>下一完整交易日 · 原生股票 · USD</small>
                  </button>
                  <button
                    className={mode === "sprint" ? "on" : ""}
                    aria-pressed={mode === "sprint"}
                    onClick={() => setMode("sprint")}
                  >
                    <strong>股票永续加赛</strong>
                    <small>封盘后 5 分钟 · Bitget 永续 · USDT</small>
                  </button>
                </div>
                <p className="tiny">
                  两种市场各自定价、各自计分。加赛不会被记作美股收盘预测或实盘交易。
                </p>
                <button
                  className="primary full"
                  onClick={create}
                  disabled={!!busy}
                >
                  {busy === "prepare"
                    ? `真实数据与 AI 准备中 · ${elapsed}s`
                    : "发起人机挑战 ↗"}
                </button>
                {busy === "prepare" && (
                  <p className="tiny mint">
                    正在请求官方只读工具与 DeepSeek。资料缺失时会停止，通常需要
                    20–60 秒。
                  </p>
                )}
              </aside>
              <section className="panel stage">
                {!active ? (
                  <div className="empty-stage">
                    <span className="section-label">
                      THE NEXT CALL IS YOURS
                    </span>
                    <h2>
                      直觉，
                      <br />
                      敢不敢<span>对答案？</span>
                    </h2>
                    <p>
                      选择标的与市场，开启第一场。
                      <br />
                      AI 会先独立回答，但在你封存之前，答案不会揭晓。
                    </p>
                    <div className="contestants">
                      <div>
                        <span className="avatar human">↗</span>
                        <strong>人类</strong>
                        <small>你的概率与理由</small>
                      </div>
                      <b>VS</b>
                      <div>
                        <span className="avatar machine">◇</span>
                        <strong>AI</strong>
                        <small>DeepSeek 独立作答</small>
                      </div>
                    </div>
                    <div className="honest-note">
                      这里没有预填胜率、虚构玩家或样例收益。
                      <br />
                      每场成绩，都从真实提交开始。
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="round-top">
                      <span className="pill">
                        {active.rules.mode === "close"
                          ? "原生美股 · 收盘场"
                          : "股票永续 · 短时加赛"}
                      </span>
                      <span className={"status " + (result ? "mint" : "")}>
                        {stateName[active.status]}
                      </span>
                    </div>
                    <h2 className="question">
                      {active.rules.symbol}
                      {active.rules.mode === "sprint" ? "USDT" : ""}
                      <br />
                      <span>
                        {active.rules.mode === "close"
                          ? "下一交易日收盘，会高于基准吗？"
                          : "封盘后 5 分钟，会高于基准吗？"}
                      </span>
                    </h2>
                    <div className="baseline">
                      <div>
                        <small>
                          封存基准 · {active.rules.baseline.currency}
                        </small>
                        <strong>
                          {active.rules.baseline.price.toLocaleString("en-US", {
                            maximumFractionDigits: 4,
                          })}
                        </strong>
                      </div>
                      <div className="countdown">
                        <small>
                          {result ? "已核验" : locked ? "距核验开始" : "距封盘"}
                        </small>
                        <strong>
                          {result ? "✓" : <Left seconds={seconds} />}
                        </strong>
                      </div>
                    </div>
                    <div className="chart">
                      <Spark values={prices || []} />
                      <small>
                        实际取得的历史价格，仅供背景参考 ·{" "}
                        {active.rules.baseline.provider}
                      </small>
                    </div>
                    {!locked && active.mine ? (
                      <div className="prediction-form">
                        <div className="form-title">
                          <strong>你的 P(YES)</strong>
                          <span>{prob}%</span>
                        </div>
                        <input
                          aria-label="上涨概率"
                          type="range"
                          min="5"
                          max="95"
                          value={prob}
                          onChange={(e) => setProb(Number(e.target.value))}
                        />
                        <div className="range-label">
                          <span>更倾向 NO</span>
                          <span>更倾向 YES</span>
                        </div>
                        <label className="field-label" htmlFor="reason">
                          为什么这样判断？
                        </label>
                        <textarea
                          id="reason"
                          maxLength={1000}
                          placeholder="留下可复盘的理由：什么支持它？什么会让你判断失效？"
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                        />
                        <div className="inline-input">
                          <label>
                            显示名称
                            <input
                              value={alias}
                              maxLength={24}
                              onChange={(e) => setAlias(e.target.value)}
                            />
                          </label>
                          <label className="checkbox">
                            <input
                              type="checkbox"
                              checked={publish}
                              onChange={(e) => setPublish(e.target.checked)}
                            />
                            公开本场判断、理由及成绩
                          </label>
                        </div>
                        <button
                          className="primary full"
                          disabled={!!busy || reason.trim().length < 5}
                          onClick={commit}
                        >
                          {busy === "commit"
                            ? "封存中…"
                            : "封存我的判断 · 揭晓 AI 答案"}
                        </button>
                        <p className="tiny">
                          提交后不能覆盖。未勾选公开时，仅当前浏览器访客会话可访问。
                        </p>
                      </div>
                    ) : (
                      <div className="duel">
                        <PredictionCard
                          type="human"
                          p={active.human}
                          score={result?.humanBrier}
                          alias={active.alias}
                        />
                        <div className="versus">VS</div>
                        <PredictionCard
                          type="ai"
                          p={active.ai}
                          score={result?.aiBrier}
                          alias="DeepSeek"
                        />
                      </div>
                    )}
                    {result && (
                      <div className="verdict">
                        <div>
                          <span className="section-label">VERIFIED RESULT</span>
                          <h3>
                            {result.outcome
                              ? "YES · 高于基准"
                              : "NO · 未高于基准"}
                          </h3>
                          <p>
                            终值 {result.terminal.price}{" "}
                            {result.terminal.currency} ·{" "}
                            {result.delta >= 0 ? "+" : ""}
                            {result.delta.toFixed(3)}%
                          </p>
                        </div>
                        <strong>
                          {result.winner === "human"
                            ? "你赢了这一轮"
                            : result.winner === "ai"
                              ? "AI 赢了这一轮"
                              : result.winner === "tie"
                                ? "这一轮平局"
                                : "AI 单方记录"}
                        </strong>
                      </div>
                    )}
                    {locked && !result && (
                      <div className="waiting">
                        <span className="dot" />
                        <div>
                          <strong>
                            {active.status === "unresolved"
                              ? "本场不计分"
                              : "原判断已保留，等待事实到场。"}
                          </strong>
                          <p>
                            {active.error ||
                              "未到期不提前裁定；到期由后台按规则获取真实数据。"}
                          </p>
                        </div>
                        {active.mine && active.status !== "unresolved" && (
                          <button
                            className="outline"
                            disabled={!!busy || seconds > 0}
                            onClick={settle}
                          >
                            {busy === "settle" ? "核验中…" : "核验结果"}
                          </button>
                        )}
                      </div>
                    )}
                    <details className="rule-detail">
                      <summary>展开本场时间与裁定规则</summary>
                      <p>{active.rules.question}</p>
                      <dl>
                        <dt>封盘 · 你的当地时间</dt>
                        <dd>{time(active.rules.lockAt)}</dd>
                        <dt>封盘 · 纽约</dt>
                        <dd>{nyTime(active.rules.lockAt)} ET</dd>
                        <dt>核验开始 · 当地时间</dt>
                        <dd>{time(active.rules.settleAt)}</dd>
                        <dt>截止核验 · 当地时间</dt>
                        <dd>{time(active.rules.expiresAt)}</dd>
                        <dt>基准观测时间</dt>
                        <dd>{time(active.rules.baseline.observedAt)}</dd>
                      </dl>
                      <p>{active.rules.settlementPolicy}</p>
                      <p>
                        终值严格大于基准为 YES，平价归
                        NO。股票收盘价采用未复权价格，不代表含分红总收益。
                      </p>
                    </details>
                    <div className="actions">
                      <button
                        className="outline"
                        onClick={() => goToTab("receipt")}
                      >
                        查看证据与收据 →
                      </button>
                      <button className="outline" onClick={share}>
                        {copied ? "链接已复制 ✓" : "分享本场"}
                      </button>
                    </div>
                  </>
                )}
              </section>
            </section>
            <section className="principles">
              {[
                [
                  "01",
                  "先留下判断",
                  "AI 先独立作答。你的选择不会进入模型输入。",
                ],
                [
                  "02",
                  "再交给时间",
                  "原答案与规则封存。过期提交由服务端拒绝。",
                ],
                [
                  "03",
                  "最后看证据",
                  "真实行情按约定核验。数据不够，就暂不计分。",
                ],
              ].map(([n, t, d]) => (
                <div key={n}>
                  <span>{n}</span>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
              ))}
            </section>
          </>
        )}
        {tab === "history" && (
          <section className="panel archive">
            <div className="section-label">CALLS, NOT HINDSIGHT</div>
            <h2>判断档案</h2>
            <p className="subtle">
              包括当前访客的私人记录，以及主动公开的对局。未公开记录不向其他访客展示。
            </p>
            {rounds.length === 0 ? (
              <div className="empty">
                尚无记录。发起第一场真实挑战，留下第一张判断收据。
              </div>
            ) : (
              rounds.map((r) => (
                <button
                  className="history-row"
                  key={r.id}
                  onClick={() => {
                    setActive(r);
                    setTab("arena");
                  }}
                >
                  <span className="ticker-icon">
                    {r.rules.symbol.slice(0, 1)}
                  </span>
                  <div>
                    <strong>
                      {r.rules.symbol} ·{" "}
                      {r.rules.mode === "close" ? "美股收盘" : "股票永续加赛"}
                    </strong>
                    <small>
                      {r.alias} · {time(r.createdAt)} ·{" "}
                      {r.public ? "公开" : "私人"}
                    </small>
                  </div>
                  <span>{stateName[r.status]}</span>
                  <b>↗</b>
                </button>
              ))
            )}
          </section>
        )}
        {tab === "score" && (
          <section className="panel archive">
            <div className="section-label">CONFIDENCE HAS A COST</div>
            <h2>校准榜</h2>
            <p>
              敢说 90%，也要承受猜错的分数。Brier = (预测概率 −
              实际结果)²，越低越好。
            </p>
            <div className="score-grid">
              {stats?.groups.map((g: any) => (
                <div className="score-card" key={g.mode}>
                  <span className="pill">
                    {g.mode === "close" ? "美股收盘" : "股票永续加赛"}
                  </span>
                  <h3>
                    {g.n}
                    <small>场已核验公开对局</small>
                  </h3>
                  <dl>
                    <dt>人类平均 Brier</dt>
                    <dd>
                      {g.humanBrier === null ? "—" : g.humanBrier.toFixed(4)}
                    </dd>
                    <dt>AI 平均 Brier</dt>
                    <dd>{g.aiBrier === null ? "—" : g.aiBrier.toFixed(4)}</dd>
                    <dt>固定 50% 基线</dt>
                    <dd>
                      {g.baselineBrier === null
                        ? "—"
                        : g.baselineBrier.toFixed(4)}
                    </dd>
                  </dl>
                  {g.n === 0 && (
                    <p className="tiny">尚无已核验成绩，等待真实对局。</p>
                  )}
                </div>
              ))}
            </div>
            <p className="notice">{stats?.warning}</p>
            <p className="tiny">
              Brier
              衡量概率预测，不是收益率。参与者可自行选题和决定是否公开，因此榜单存在选择偏差；暂不做统计显著性或校准优劣声明。
            </p>
          </section>
        )}
        {tab === "receipt" && active && (
          <section className="panel archive">
            <div className="section-label">THE ORIGINAL CALL SURVIVES</div>
            <h2>判断收据 · {active.rules.symbol}</h2>
            <div className="receipt-grid">
              <div>
                <p>{active.rules.question}</p>
                <div className="hash-box">
                  <small>AI 封存摘要 · SHA-256</small>
                  <code>{active.aiHash}</code>
                  <small>人类封存摘要</small>
                  <code>{active.humanHash || "尚未提交"}</code>
                  <p className="mint">
                    {active.proof
                      ? `导出内容复核：AI ${active.proof.aiValid ? "一致 ✓" : "不一致"} · 人类 ${active.proof.humanValid === null ? "未提交" : active.proof.humanValid ? "一致 ✓" : "不一致"}`
                      : "AI 内容尚未揭晓"}
                  </p>
                </div>
                <div className="actions">
                  <a
                    className="primary"
                    href={`/api/rounds/${active.id}/export`}
                  >
                    Markdown 收据 ↓
                  </a>
                  <a
                    className="outline"
                    href={`/api/rounds/${active.id}/export?format=json`}
                  >
                    完整 JSON ↓
                  </a>
                </div>
                <p className="tiny">
                  哈希与追加审计支持内容核对，不是链上存证，也不能证明运营方无法修改数据库。
                </p>
              </div>
              <img
                className="receipt-bell"
                src="/art/closing-bell.webp"
                alt="收盘见金属铃铛品牌视觉"
              />
            </div>
            <h3>实际工具调用</h3>
            <div className="traces">
              {active.traces.map((t: any, i: number) => (
                <div key={i}>
                  <span className={t.status === "success" ? "mint" : "amber"}>
                    {t.status === "success" ? "✓" : "!"}
                  </span>
                  <strong>{t.tool}</strong>
                  <small>{t.durationMs}ms</small>
                  {t.error && <p>{t.error}</p>}
                </div>
              ))}
            </div>
            <h3>
              原始证据 ·{" "}
              {active.evidence.length + (active.result?.evidence?.length || 0)}{" "}
              份
            </h3>
            {[...active.evidence, ...(active.result?.evidence || [])].map(
              (e: any, i: number) => (
                <details className="evidence" key={i}>
                  <summary>
                    {e.title}
                    <span>
                      {e.role === "settlement"
                        ? "到期数据"
                        : e.role === "baseline"
                          ? "基准"
                          : "研究背景"}
                    </span>
                  </summary>
                  <a href={e.url} target="_blank" rel="noreferrer">
                    查看来源 ↗
                  </a>
                  <p className="tiny">
                    取得时间 {e.retrievedAt} · SHA256 {e.hash}
                  </p>
                  <pre>{e.text}</pre>
                </details>
              ),
            )}
          </section>
        )}
        {tab === "rules" && (
          <section className="panel archive rules-page">
            <div className="section-label">RULES BEFORE RESULTS</div>
            <h2>先约定规则，再看结果。</h2>
            <div className="rule-columns">
              <div>
                <h3>你的信心如何计分？</h3>
                <p>
                  概率是你认为 YES 发生的可能性。实际发生记为 1，否则记为
                  0。Brier 分数取两者差值的平方，越低越好。
                </p>
                <p>
                  例如，预测 80% 且发生：0.04；预测 80%
                  但未发生：0.64。这是公式示例，不是任何玩家的实测成绩。
                </p>
                <h3>为什么先封存 AI？</h3>
                <p>
                  AI
                  使用取得的固定数据包独立预测，不会收到人类答案。公开其带随机盐的内容摘要；人类提交后揭晓内容与盐，可以重算核对。
                </p>
                <p>
                  人类提交的时间可能晚于
                  AI，因此双方信息时刻存在差异。此竞技不是严格控制的信息对等科学实验。
                </p>
              </div>
              <div>
                <h3>两种市场如何区分？</h3>
                <p>
                  收盘挑战针对原生美股日线收盘价，以 USD 计价。加赛针对 Bitget
                  股票类 USDT 永续合约的
                  lastPrice，短时观测不能替代美股收盘结果。
                </p>
                <h3>数据缺失时怎么办？</h3>
                <p>
                  未到期：等待。报价过期、交易日不符、两源冲突：重试。超过约定窗口仍不合格：不计分。价格裁定由程序执行，不交给模型投票。
                </p>
                <h3>目前的边界</h3>
                <p>
                  支持六只股票的二元价格题。未接入押金、资金结算或交易执行。哈希不是第三方时间证明。模型概率尚未得到大样本校准。
                </p>
              </div>
            </div>
            <a className="outline" href="/submission/index.html">
              完整方法与验证记录 ↗
            </a>
          </section>
        )}
      </main>
      <footer>
        <a className="brand" href="/">
          <span className="brand-mark">↗</span>
          <strong>
            收盘见<span>CloseCall</span>
          </strong>
        </a>
        <p>
          判断有期限，证据有出处。
          <br />
          <small>研究与预测校准工具 · 无交易执行 · 无资金押注</small>
        </p>
        <a
          href="/submission/closecall-source.zip"
          target="_blank"
          rel="noreferrer"
        >
          开源代码 ↗
        </a>
      </footer>
    </>
  );
}
function PredictionCard({
  type,
  p,
  score,
  alias,
}: {
  type: string;
  p: any;
  score: number | null | undefined;
  alias: string;
}) {
  return (
    <article className={"prediction-card " + type}>
      <div className="identity">
        <span className={"avatar " + (type === "ai" ? "machine" : "human")}>
          {type === "ai" ? "◇" : "↗"}
        </span>
        <strong>
          {alias}
          <small>
            {type === "ai" ? "AI · 独立模型预测" : "人类 · 独立判断"}
          </small>
        </strong>
      </div>
      {p ? (
        <>
          <div className="probability">
            {Math.round(p.probability * 100)}
            <span>%</span>
            <small>P(YES) · 主观预测</small>
          </div>
          <p className="thesis">{p.thesis}</p>
          {type === "ai" && (
            <p className="tiny amber">
              模型原始理由，仅校验引用关联；内容可能有误，请核对原文。
            </p>
          )}
          {p.caveats?.length > 0 && (
            <details>
              <summary>限制与不确定性</summary>
              <ul>
                {p.caveats.map((x: string, i: number) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </details>
          )}
          {score != null && (
            <div className="brier">
              <small>本场 Brier · 越低越好</small>
              <strong>{score.toFixed(4)}</strong>
            </div>
          )}
        </>
      ) : (
        <p className="subtle">未提交判断</p>
      )}
    </article>
  );
}
