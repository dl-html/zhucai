import { useState, useEffect, useCallback } from "react";

// ── 初始预测事件 ──────────────────────────────────────────
const INITIAL_EVENTS = [
  { id: 1, title: "DeepSeek R3 正式发布", emoji: "🤖", yesPool: 8200, noPool: 1800, category: "AI" },
  { id: 2, title: "A股上证指数突破4000点", emoji: "📈", yesPool: 6100, noPool: 3900, category: "金融" },
  { id: 3, title: "鸿蒙系统国内市占率超越iOS", emoji: "📱", yesPool: 5400, noPool: 4600, category: "科技" },
  { id: 4, title: "周杰伦发布新专辑", emoji: "🎵", yesPool: 4800, noPool: 5200, category: "娱乐" },
  { id: 5, title: "《三体》好莱坞改编电影上映", emoji: "🎬", yesPool: 4200, noPool: 5800, category: "娱乐" },
  { id: 6, title: "比亚迪全球销量超越丰田", emoji: "🚗", yesPool: 3900, noPool: 6100, category: "汽车" },
  { id: 7, title: "台湾海峡爆发重大军事冲突", emoji: "⚠️", yesPool: 3100, noPool: 6900, category: "政治" },
  { id: 8, title: "中国载人登月成功", emoji: "🚀", yesPool: 2600, noPool: 7400, category: "航天" },
];

// ── 本地存储工具 ──────────────────────────────────────────
const storage = {
  get: (key) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; } },
  set: (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
};

function getPct(yes, no) {
  const total = yes + no;
  return total === 0 ? 50 : Math.round((yes / total) * 100);
}

function formatPts(n) {
  return n >= 10000 ? (n / 10000).toFixed(1) + "万" : Number(n).toLocaleString();
}

// ── 全局样式 ──────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@700;900&family=Noto+Sans+SC:wght@300;400;500;700&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  :root{
    --red:#E8341A;--gold:#D4A017;--gold-light:#F5C842;
    --dark:#0D0D0D;--dark2:#141414;--dark3:#1C1C1C;--dark4:#252525;
    --border:rgba(212,160,23,0.2);
  }
  body{background:#0D0D0D;color:#F0EAD6;font-family:'Noto Sans SC',sans-serif;min-height:100vh}
  input,textarea,button{font-family:'Noto Sans SC',sans-serif}
  ::-webkit-scrollbar{width:4px}
  ::-webkit-scrollbar-track{background:#141414}
  ::-webkit-scrollbar-thumb{background:#D4A017;border-radius:2px}
  @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
  @keyframes popIn{
    0%{opacity:0;transform:translate(-50%,-50%) scale(0.8)}
    20%{opacity:1;transform:translate(-50%,-50%) scale(1.05)}
    80%{opacity:1;transform:translate(-50%,-50%) scale(1)}
    100%{opacity:0;transform:translate(-50%,-50%) scale(0.95)}
  }
`;

// ── 主组件 ────────────────────────────────────────────────
export default function App() {
  const [user, setUser]       = useState(null);
  const [users, setUsers]     = useState({});
  const [events, setEvents]   = useState(INITIAL_EVENTS);
  const [comments, setComments] = useState({});
  const [page, setPage]       = useState("market");
  const [modal, setModal]     = useState(null);
  const [betAmt, setBetAmt]   = useState(100);
  const [loginMode, setLoginMode] = useState("login");
  const [loginForm, setLoginForm] = useState({ name: "", pass: "" });
  const [toast, setToast]     = useState(null);
  const [commentText, setCommentText] = useState({});

  // 初始化：从 localStorage 读取数据
  useEffect(() => {
    const savedUsers    = storage.get("zhucai-users");
    const savedEvents   = storage.get("zhucai-events");
    const savedComments = storage.get("zhucai-comments");
    const savedSession  = storage.get("zhucai-session");
    if (savedUsers)    setUsers(savedUsers);
    if (savedEvents)   setEvents(savedEvents);
    if (savedComments) setComments(savedComments);
    if (savedSession)  setUser(savedSession);
  }, []);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  // ── 注册 / 登录 ──────────────────────────────────────────
  const handleLogin = () => {
    if (!loginForm.name.trim()) return showToast("请输入用户名", "error");
    if (loginMode === "register") {
      if (users[loginForm.name]) return showToast("用户名已存在", "error");
      const newUser = {
        name: loginForm.name, pass: loginForm.pass,
        points: 1000, joined: Date.now(), positions: {}
      };
      const newUsers = { ...users, [loginForm.name]: newUser };
      setUsers(newUsers);
      storage.set("zhucai-users", newUsers);
      setUser(loginForm.name);
      storage.set("zhucai-session", loginForm.name);
      showToast("🎉 注册成功！送你1000积分");
      setPage("market");
    } else {
      const u = users[loginForm.name];
      if (!u) return showToast("用户不存在", "error");
      if (u.pass !== loginForm.pass) return showToast("密码错误", "error");
      setUser(loginForm.name);
      storage.set("zhucai-session", loginForm.name);
      showToast(`欢迎回来，${loginForm.name}！`);
      setPage("market");
    }
  };

  const logout = () => {
    setUser(null);
    storage.set("zhucai-session", null);
    showToast("已退出登录");
  };

  const currentUser = user ? users[user] : null;

  // ── 投注 ─────────────────────────────────────────────────
  const handleBet = () => {
    if (!modal) return;
    const amt = parseInt(betAmt);
    if (!amt || amt < 10) return showToast("最少投注10积分", "error");
    if (amt > currentUser.points) return showToast("积分不足", "error");

    const ev   = events.find(e => e.id === modal.eventId);
    const side = modal.side;
    const pct  = side === "yes"
      ? getPct(ev.yesPool, ev.noPool) / 100
      : (100 - getPct(ev.yesPool, ev.noPool)) / 100;
    const potentialWin = Math.round(amt / pct);

    const newEvents = events.map(e => {
      if (e.id !== modal.eventId) return e;
      return {
        ...e,
        yesPool: side === "yes" ? e.yesPool + amt : e.yesPool,
        noPool:  side === "no"  ? e.noPool  + amt : e.noPool,
      };
    });

    const pos    = currentUser.positions[modal.eventId] || { yesAmt: 0, noAmt: 0 };
    const newPos = { ...pos, [`${side}Amt`]: pos[`${side}Amt`] + amt };

    const newUsers = {
      ...users,
      [user]: {
        ...currentUser,
        points: currentUser.points - amt,
        positions: { ...currentUser.positions, [modal.eventId]: newPos },
      },
    };

    setEvents(newEvents);  storage.set("zhucai-events", newEvents);
    setUsers(newUsers);    storage.set("zhucai-users", newUsers);
    setModal(null);
    setBetAmt(100);
    showToast(`✅ 投注成功！若判断正确可获 ${formatPts(potentialWin)} 积分`);
  };

  // ── 评论 ─────────────────────────────────────────────────
  const handleComment = (evId) => {
    if (!user) return showToast("请先登录", "error");
    const txt = (commentText[evId] || "").trim();
    if (!txt) return;
    const newComments = {
      ...comments,
      [evId]: [...(comments[evId] || []), { user, text: txt, time: Date.now() }],
    };
    setComments(newComments);
    storage.set("zhucai-comments", newComments);
    setCommentText({ ...commentText, [evId]: "" });
  };

  // ── UI ───────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#0D0D0D", backgroundImage: "radial-gradient(ellipse 80% 40% at 50% 0%, rgba(212,160,23,0.07) 0%, transparent 70%)" }}>
      <style>{STYLES}</style>

      {/* TOAST */}
      {toast && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 9999, background: toast.type === "error" ? "#C0392B" : "#1a5c35", color: "white", padding: "12px 24px", borderRadius: 8, fontSize: 14, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.5)", whiteSpace: "nowrap", pointerEvents: "none" }}>
          {toast.msg}
        </div>
      )}

      {/* BET MODAL */}
      {modal && (
        <div onClick={() => setModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#1C1C1C", border: "1px solid rgba(212,160,23,0.35)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 380 }}>
            {(() => {
              const ev    = events.find(e => e.id === modal.eventId);
              const pct   = modal.side === "yes" ? getPct(ev.yesPool, ev.noPool) : 100 - getPct(ev.yesPool, ev.noPool);
              const amt   = parseInt(betAmt) || 0;
              const potWin = pct > 0 ? Math.round(amt / (pct / 100)) : 0;
              return (
                <>
                  <div style={{ fontSize: 13, color: "rgba(240,234,214,0.5)", marginBottom: 6 }}>你正在投注</div>
                  <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>{ev.emoji} {ev.title}</div>
                  <div style={{ display: "inline-block", padding: "4px 14px", borderRadius: 20, background: modal.side === "yes" ? "rgba(232,52,26,0.2)" : "rgba(42,107,204,0.2)", color: modal.side === "yes" ? "#ff6b52" : "#6BA3E8", fontSize: 13, fontWeight: 700, marginBottom: 20 }}>
                    {modal.side === "yes" ? "✅ 做多（会发生）" : "📉 做空（不会发生）"}
                  </div>

                  {/* 快选金额 */}
                  <div style={{ fontSize: 12, color: "rgba(240,234,214,0.45)", marginBottom: 8 }}>
                    投注积分（你有 {formatPts(currentUser?.points || 0)} 积分）
                  </div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    {[50, 100, 500, 1000].map(v => (
                      <button key={v} onClick={() => setBetAmt(v)} style={{ flex: 1, padding: "7px 0", borderRadius: 6, border: `1px solid ${betAmt == v ? "#D4A017" : "rgba(240,234,214,0.15)"}`, background: betAmt == v ? "rgba(212,160,23,0.15)" : "transparent", color: betAmt == v ? "#F5C842" : "rgba(240,234,214,0.55)", fontSize: 13, cursor: "pointer" }}>
                        {v}
                      </button>
                    ))}
                  </div>
                  <input type="number" value={betAmt} onChange={e => setBetAmt(e.target.value)} style={{ width: "100%", background: "#252525", border: "1px solid rgba(212,160,23,0.3)", borderRadius: 8, padding: "10px 14px", color: "#F0EAD6", fontSize: 15, outline: "none", marginBottom: 16 }} />

                  {/* 预估收益 */}
                  <div style={{ background: "#252525", borderRadius: 8, padding: "12px 14px", marginBottom: 20, fontSize: 13 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ color: "rgba(240,234,214,0.5)" }}>当前概率</span>
                      <span style={{ fontWeight: 700, color: "#F5C842" }}>{pct}%</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "rgba(240,234,214,0.5)" }}>若判断正确可获得</span>
                      <span style={{ fontWeight: 700, color: "#4CAF50" }}>+{formatPts(potWin)} 积分</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => { setModal(null); setBetAmt(100); }} style={{ flex: 1, padding: "11px 0", borderRadius: 8, border: "1px solid rgba(240,234,214,0.2)", background: "transparent", color: "rgba(240,234,214,0.55)", fontSize: 14, cursor: "pointer" }}>取消</button>
                    <button onClick={handleBet} style={{ flex: 2, padding: "11px 0", borderRadius: 8, border: "none", background: "linear-gradient(90deg,#D4A017,#F5C842)", color: "#0D0D0D", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>确认投注</button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* NAV */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(13,13,13,0.95)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(212,160,23,0.2)", height: 58, display: "flex", alignItems: "center", padding: "0 20px", gap: 8 }}>
        <div style={{ fontFamily: "Noto Serif SC", fontSize: 20, fontWeight: 900, color: "#D4A017", textShadow: "0 0 20px rgba(212,160,23,0.5)", marginRight: 12, cursor: "pointer" }} onClick={() => setPage("market")}>
          筑<span style={{ color: "#E8341A" }}>彩</span>
        </div>
        {["market", "portfolio", "leaderboard"].map(p => (
          <button key={p} onClick={() => setPage(p)} style={{ padding: "6px 14px", borderRadius: 20, border: `1px solid ${page === p ? "rgba(212,160,23,0.6)" : "rgba(240,234,214,0.12)"}`, background: page === p ? "rgba(212,160,23,0.12)" : "transparent", color: page === p ? "#F5C842" : "rgba(240,234,214,0.45)", fontSize: 13, cursor: "pointer" }}>
            {{ market: "市场", portfolio: "我的持仓", leaderboard: "排行榜" }[p]}
          </button>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          {currentUser ? (
            <>
              <div style={{ fontSize: 13, color: "#F5C842", fontWeight: 700 }}>{formatPts(currentUser.points)} 积分</div>
              <div style={{ fontSize: 13, color: "rgba(240,234,214,0.45)" }}>{user}</div>
              <button onClick={logout} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid rgba(240,234,214,0.2)", background: "transparent", color: "rgba(240,234,214,0.45)", fontSize: 12, cursor: "pointer" }}>退出</button>
            </>
          ) : (
            <button onClick={() => setPage("login")} style={{ padding: "7px 18px", borderRadius: 6, border: "none", background: "#E8341A", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>登录 / 注册</button>
          )}
        </div>
      </nav>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 16px 80px" }}>

        {/* ── 登录页 ── */}
        {page === "login" && (
          <div style={{ maxWidth: 380, margin: "40px auto" }}>
            <div style={{ fontFamily: "Noto Serif SC", fontSize: 26, fontWeight: 900, color: "#D4A017", textAlign: "center", marginBottom: 6 }}>
              筑<span style={{ color: "#E8341A" }}>彩</span>
            </div>
            <div style={{ textAlign: "center", fontSize: 13, color: "rgba(240,234,214,0.4)", marginBottom: 32 }}>中文预测市场 · 新用户赠送 1000 积分</div>
            <div style={{ background: "#141414", border: "1px solid rgba(212,160,23,0.2)", borderRadius: 16, padding: 28 }}>
              <div style={{ display: "flex", background: "#252525", borderRadius: 8, padding: 4, marginBottom: 24 }}>
                {["login", "register"].map(m => (
                  <button key={m} onClick={() => setLoginMode(m)} style={{ flex: 1, padding: "8px 0", borderRadius: 6, border: "none", background: loginMode === m ? "#1C1C1C" : "transparent", color: loginMode === m ? "#F5C842" : "rgba(240,234,214,0.4)", fontSize: 14, fontWeight: loginMode === m ? 600 : 400, cursor: "pointer" }}>
                    {m === "login" ? "登录" : "注册"}
                  </button>
                ))}
              </div>
              {[["name", "用户名", "text"], ["pass", "密码", "password"]].map(([f, label, type]) => (
                <div key={f} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, color: "rgba(240,234,214,0.4)", marginBottom: 6 }}>{label}</div>
                  <input type={type} value={loginForm[f]} onChange={e => setLoginForm({ ...loginForm, [f]: e.target.value })} onKeyDown={e => e.key === "Enter" && handleLogin()} style={{ width: "100%", background: "#252525", border: "1px solid rgba(212,160,23,0.2)", borderRadius: 8, padding: "10px 14px", color: "#F0EAD6", fontSize: 14, outline: "none" }} />
                </div>
              ))}
              <button onClick={handleLogin} style={{ width: "100%", padding: "12px 0", borderRadius: 8, border: "none", background: "linear-gradient(90deg,#D4A017,#F5C842)", color: "#0D0D0D", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 8 }}>
                {loginMode === "login" ? "登录" : "注册并获得 1000 积分"}
              </button>
            </div>
          </div>
        )}

        {/* ── 市场页 ── */}
        {page === "market" && (
          <>
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontFamily: "Noto Serif SC", fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
                《黑神话：悟空2》发售前，哪些事会先发生？
              </div>
              <div style={{ fontSize: 13, color: "rgba(240,234,214,0.4)" }}>
                截止 2026年12月31日 · {events.reduce((s, e) => s + e.yesPool + e.noPool, 0).toLocaleString()} 积分已投入
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 160px", gap: 12, padding: "6px 16px", fontSize: 11, color: "rgba(240,234,214,0.3)", letterSpacing: 1, marginBottom: 6 }}>
              <div>预测事件</div><div style={{ textAlign: "center" }}>概率</div><div style={{ textAlign: "center" }}>操作</div>
            </div>

            {events.map((ev, i) => {
              const pct     = getPct(ev.yesPool, ev.noPool);
              const userPos = currentUser?.positions?.[ev.id];
              return (
                <div key={ev.id} style={{ background: "#141414", border: "1px solid rgba(212,160,23,0.15)", borderRadius: 12, marginBottom: 10, overflow: "hidden", animation: `fadeUp 0.4s ${i * 0.05}s both` }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 160px", gap: 12, alignItems: "center", padding: "16px 16px 12px" }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 3 }}>{ev.emoji} {ev.title}</div>
                      <div style={{ fontSize: 11, color: "rgba(240,234,214,0.3)" }}>{(ev.yesPool + ev.noPool).toLocaleString()} 积分已投入</div>
                      {userPos && (
                        <div style={{ marginTop: 5, display: "flex", gap: 6 }}>
                          {userPos.yesAmt > 0 && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "rgba(232,52,26,0.15)", color: "#ff6b52" }}>做多 {userPos.yesAmt}</span>}
                          {userPos.noAmt  > 0 && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "rgba(42,107,204,0.15)", color: "#6BA3E8" }}>做空 {userPos.noAmt}</span>}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: "#F5C842", fontFamily: "Noto Serif SC" }}>{pct}%</div>
                      <div style={{ height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2, marginTop: 4, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: pct + "%", background: "linear-gradient(90deg,#D4A017,#F5C842)", borderRadius: 2, transition: "width 0.8s" }} />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 7 }}>
                      {[["yes", "做多", "#ff6b52", "rgba(232,52,26,0.1)", "rgba(232,52,26,0.35)", pct],
                        ["no",  "做空", "#6BA3E8", "rgba(42,107,204,0.1)", "rgba(42,107,204,0.35)", 100-pct]].map(([side, label, color, bg, border, p]) => (
                        <button key={side} onClick={() => { if (!user) { showToast("请先登录", "error"); return; } setModal({ eventId: ev.id, side }); }}
                          style={{ flex: 1, padding: "9px 0", borderRadius: 7, border: `1px solid ${border}`, background: bg, color, fontSize: 12, fontWeight: 700, cursor: "pointer", lineHeight: 1.6 }}>
                          {label}<br/><span style={{ fontSize: 11, opacity: 0.7 }}>{p}¢</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 评论区 */}
                  <div style={{ borderTop: "1px solid rgba(212,160,23,0.1)", padding: "12px 16px", background: "#111" }}>
                    {(comments[ev.id] || []).slice(-3).map((c, ci) => (
                      <div key={ci} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                        <div style={{ width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(135deg,#333,#555)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0, color: "#D4A017", fontWeight: 700 }}>
                          {c.user[0].toUpperCase()}
                        </div>
                        <div style={{ flex: 1, background: "#1C1C1C", borderRadius: 7, padding: "7px 10px", fontSize: 12, color: "rgba(240,234,214,0.65)", lineHeight: 1.6 }}>
                          <span style={{ color: "#D4A017", fontWeight: 600, marginRight: 6 }}>{c.user}</span>{c.text}
                        </div>
                      </div>
                    ))}
                    <div style={{ display: "flex", gap: 8 }}>
                      <input value={commentText[ev.id] || ""} onChange={e => setCommentText({ ...commentText, [ev.id]: e.target.value })} onKeyDown={e => e.key === "Enter" && handleComment(ev.id)}
                        placeholder={user ? "发表观点… (Enter发送)" : "登录后发表评论"}
                        disabled={!user}
                        style={{ flex: 1, background: "#1C1C1C", border: "1px solid rgba(212,160,23,0.15)", borderRadius: 7, padding: "7px 12px", color: "#F0EAD6", fontSize: 12, outline: "none" }} />
                      <button onClick={() => handleComment(ev.id)} style={{ padding: "0 14px", borderRadius: 7, border: "none", background: "rgba(212,160,23,0.2)", color: "#F5C842", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>发送</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* ── 持仓页 ── */}
        {page === "portfolio" && (
          <>
            <div style={{ fontFamily: "Noto Serif SC", fontSize: 22, fontWeight: 700, marginBottom: 24 }}>我的持仓</div>
            {!user ? (
              <div style={{ textAlign: "center", padding: 60, color: "rgba(240,234,214,0.4)" }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
                <div style={{ marginBottom: 16 }}>请先登录查看持仓</div>
                <button onClick={() => setPage("login")} style={{ padding: "10px 28px", borderRadius: 8, border: "none", background: "#E8341A", color: "white", fontSize: 14, cursor: "pointer" }}>去登录</button>
              </div>
            ) : Object.keys(currentUser?.positions || {}).length === 0 ? (
              <div style={{ textAlign: "center", padding: 60, color: "rgba(240,234,214,0.4)" }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>📭</div>
                <div style={{ marginBottom: 16 }}>还没有任何持仓，去市场参与预测吧！</div>
                <button onClick={() => setPage("market")} style={{ padding: "10px 28px", borderRadius: 8, border: "none", background: "linear-gradient(90deg,#D4A017,#F5C842)", color: "#0D0D0D", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>前往市场</button>
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 28 }}>
                  {[
                    { label: "当前积分", value: formatPts(currentUser.points), color: "#F5C842" },
                    { label: "持仓数量", value: Object.keys(currentUser.positions).length + " 个", color: "#F0EAD6" },
                    { label: "总投入", value: formatPts(Object.values(currentUser.positions).reduce((s, p) => s + (p.yesAmt || 0) + (p.noAmt || 0), 0)), color: "#ff6b52" },
                  ].map(s => (
                    <div key={s.label} style={{ background: "#141414", border: "1px solid rgba(212,160,23,0.15)", borderRadius: 12, padding: "18px 20px" }}>
                      <div style={{ fontSize: 12, color: "rgba(240,234,214,0.4)", marginBottom: 6 }}>{s.label}</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontFamily: "Noto Serif SC" }}>{s.value}</div>
                    </div>
                  ))}
                </div>
                {Object.entries(currentUser.positions).map(([evId, pos]) => {
                  const ev = events.find(e => e.id === parseInt(evId));
                  if (!ev) return null;
                  const pct = getPct(ev.yesPool, ev.noPool);
                  return (
                    <div key={evId} style={{ background: "#141414", border: "1px solid rgba(212,160,23,0.15)", borderRadius: 12, padding: "18px 20px", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{ev.emoji} {ev.title}</div>
                        <div style={{ display: "flex", gap: 8 }}>
                          {pos.yesAmt > 0 && <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 10, background: "rgba(232,52,26,0.15)", color: "#ff6b52" }}>做多 {pos.yesAmt} 积分</span>}
                          {pos.noAmt  > 0 && <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 10, background: "rgba(42,107,204,0.15)", color: "#6BA3E8" }}>做空 {pos.noAmt} 积分</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color: "#F5C842" }}>{pct}%</div>
                        <div style={{ fontSize: 11, color: "rgba(240,234,214,0.4)" }}>当前概率</div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </>
        )}

        {/* ── 排行榜 ── */}
        {page === "leaderboard" && (
          <>
            <div style={{ fontFamily: "Noto Serif SC", fontSize: 22, fontWeight: 700, marginBottom: 24 }}>积分排行榜</div>
            {Object.keys(users).length === 0 ? (
              <div style={{ textAlign: "center", padding: 60, color: "rgba(240,234,214,0.4)" }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>🏆</div>
                <div>还没有用户，快去注册成为第一名！</div>
              </div>
            ) : (
              [...Object.entries(users)]
                .sort((a, b) => b[1].points - a[1].points)
                .map(([name, u], i) => (
                  <div key={name} style={{ background: i < 3 ? "rgba(212,160,23,0.06)" : "#141414", border: `1px solid ${i < 3 ? "rgba(212,160,23,0.3)" : "rgba(212,160,23,0.12)"}`, borderRadius: 12, padding: "16px 20px", marginBottom: 8, display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: ["linear-gradient(135deg,#D4A017,#F5C842)", "linear-gradient(135deg,#888,#ccc)", "linear-gradient(135deg,#a05a2c,#cd7f32)"][i] || "#252525", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: i < 3 ? "#0D0D0D" : "rgba(240,234,214,0.5)", flexShrink: 0 }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 600 }}>
                        {name} {name === user && <span style={{ fontSize: 11, color: "#D4A017" }}>（你）</span>}
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(240,234,214,0.4)", marginTop: 2 }}>{Object.keys(u.positions || {}).length} 个持仓</div>
                    </div>
                    <div style={{ fontFamily: "Noto Serif SC", fontSize: 20, fontWeight: 700, color: i < 3 ? "#F5C842" : "#F0EAD6" }}>{formatPts(u.points)}</div>
                    <div style={{ fontSize: 11, color: "rgba(240,234,214,0.4)" }}>积分</div>
                  </div>
                ))
            )}
          </>
        )}

      </div>
    </div>
  );
}
