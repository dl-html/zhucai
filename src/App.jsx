import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://ovubazqhoviiohiltxyx.supabase.co",
  "sb_publishable_49bqn6RdI7ExXpvTxIswJQ_SDOdz-iB"
);

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@700;900&family=Noto+Sans+SC:wght@300;400;500;700&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#0D0D0D;color:#F0EAD6;font-family:'Noto Sans SC',sans-serif;min-height:100vh}
  input,button{font-family:'Noto Sans SC',sans-serif}
  ::-webkit-scrollbar{width:4px}
  ::-webkit-scrollbar-thumb{background:#D4A017;border-radius:2px}
  @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
`;

function getPct(yes, no) {
  const t = yes + no;
  return t === 0 ? 50 : Math.round((yes / t) * 100);
}
function fmt(n) {
  return n >= 10000 ? (n / 10000).toFixed(1) + "万" : Number(n).toLocaleString();
}

export default function App() {
  const [user, setUser]         = useState(null);
  const [events, setEvents]     = useState([]);
  const [comments, setComments] = useState({});
  const [page, setPage]         = useState("market");
  const [modal, setModal]       = useState(null);
  const [betAmt, setBetAmt]     = useState(100);
  const [loginMode, setLoginMode] = useState("login");
  const [form, setForm]         = useState({ name: "", pass: "" });
  const [toast, setToast]       = useState(null);
  const [commentText, setCommentText] = useState({});
  const [userRow, setUserRow]   = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading]   = useState(true);

  const toast$ = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    const saved = localStorage.getItem("zhucai-user");
    if (saved) setUser(saved);
    loadEvents();
  }, []);

  useEffect(() => {
    if (user) { loadUserRow(user); loadAllUsers(); }
  }, [user]);

  async function loadEvents() {
    setLoading(true);
    const { data: ev } = await supabase.from("events").select("*").order("id");
    if (ev) setEvents(ev);
    const { data: cd } = await supabase.from("comments").select("*").order("time", { ascending: true });
    if (cd) {
      const map = {};
      cd.forEach(c => { if (!map[c.event_id]) map[c.event_id] = []; map[c.event_id].push(c); });
      setComments(map);
    }
    setLoading(false);
  }

  async function loadUserRow(name) {
    const { data } = await supabase.from("users").select("*").eq("name", name).single();
    if (data) setUserRow(data);
  }

  async function loadAllUsers() {
    const { data } = await supabase.from("users").select("*").order("points", { ascending: false });
    if (data) setAllUsers(data);
  }

  async function handleLogin() {
    if (!form.name.trim()) return toast$("请输入用户名", "err");
    if (loginMode === "register") {
      const { data: exists } = await supabase.from("users").select("name").eq("name", form.name).single();
      if (exists) return toast$("用户名已存在", "err");
      const { error } = await supabase.from("users").insert({
        name: form.name, pass: form.pass, points: 1000, joined: Date.now(), positions: {}
      });
      if (error) return toast$("注册失败", "err");
      toast$("🎉 注册成功！送你1000积分");
      setUser(form.name); localStorage.setItem("zhucai-user", form.name);
      loadUserRow(form.name); loadAllUsers(); setPage("market");
    } else {
      const { data } = await supabase.from("users").select("*").eq("name", form.name).single();
      if (!data) return toast$("用户不存在", "err");
      if (data.pass !== form.pass) return toast$("密码错误", "err");
      setUser(form.name); setUserRow(data);
      localStorage.setItem("zhucai-user", form.name);
      toast$(`欢迎回来，${form.name}！`); loadAllUsers(); setPage("market");
    }
  }

  function logout() {
    setUser(null); setUserRow(null);
    localStorage.removeItem("zhucai-user");
    toast$("已退出登录");
  }

  async function handleBet() {
    const amt = parseInt(betAmt);
    if (!amt || amt < 10) return toast$("最少投注10积分", "err");
    if (amt > userRow.points) return toast$("积分不足", "err");
    const ev   = events.find(e => e.id === modal.eventId);
    const side = modal.side;
    const pct  = side === "yes" ? getPct(ev.yes_pool, ev.no_pool) / 100 : (100 - getPct(ev.yes_pool, ev.no_pool)) / 100;
    const potWin = Math.round(amt / pct);
    const update = side === "yes" ? { yes_pool: ev.yes_pool + amt } : { no_pool: ev.no_pool + amt };
    await supabase.from("events").update(update).eq("id", ev.id);
    const pos    = userRow.positions || {};
    const cur    = pos[ev.id] || { yesAmt: 0, noAmt: 0 };
    const newPos = { ...pos, [ev.id]: { ...cur, [`${side}Amt`]: cur[`${side}Amt`] + amt } };
    await supabase.from("users").update({ points: userRow.points - amt, positions: newPos }).eq("name", user);
    setEvents(events.map(e => e.id !== ev.id ? e : { ...e, ...update }));
    setUserRow({ ...userRow, points: userRow.points - amt, positions: newPos });
    setModal(null); setBetAmt(100);
    toast$(`✅ 投注成功！若判断正确可获 ${fmt(potWin)} 积分`);
    loadAllUsers();
  }

  async function handleComment(evId) {
    const txt = (commentText[evId] || "").trim();
    if (!txt) return;
    const { data } = await supabase.from("comments").insert({ event_id: evId, username: user, text: txt, time: Date.now() }).select().single();
    if (data) {
      setComments(prev => ({ ...prev, [evId]: [...(prev[evId] || []), data] }));
      setCommentText(prev => ({ ...prev, [evId]: "" }));
    }
  }

  const sc = { card: { background:"#141414", border:"1px solid rgba(212,160,23,0.15)", borderRadius:12 }, muted: { color:"rgba(240,234,214,0.4)" } };

  return (
    <div style={{ minHeight:"100vh", background:"#0D0D0D", backgroundImage:"radial-gradient(ellipse 80% 40% at 50% 0%,rgba(212,160,23,0.07) 0%,transparent 70%)" }}>
      <style>{STYLES}</style>

      {toast && <div style={{ position:"fixed", top:20, left:"50%", transform:"translateX(-50%)", zIndex:9999, background:toast.type==="err"?"#c0392b":"#1a5c35", color:"#fff", padding:"11px 22px", borderRadius:8, fontSize:14, fontWeight:600, boxShadow:"0 4px 20px rgba(0,0,0,0.5)", pointerEvents:"none", whiteSpace:"nowrap" }}>{toast.msg}</div>}

      {modal && (
        <div onClick={()=>setModal(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div onClick={e=>e.stopPropagation()} style={{ ...sc.card, border:"1px solid rgba(212,160,23,0.35)", padding:28, width:"100%", maxWidth:380 }}>
            {(()=>{
              const ev=events.find(e=>e.id===modal.eventId);
              const pct=modal.side==="yes"?getPct(ev.yes_pool,ev.no_pool):100-getPct(ev.yes_pool,ev.no_pool);
              const amt=parseInt(betAmt)||0;
              const potW=pct>0?Math.round(amt/(pct/100)):0;
              return <>
                <div style={{ fontSize:12, ...sc.muted, marginBottom:6 }}>你正在投注</div>
                <div style={{ fontSize:17, fontWeight:700, marginBottom:10 }}>{ev.emoji} {ev.title}</div>
                <div style={{ display:"inline-block", padding:"4px 14px", borderRadius:20, marginBottom:20, fontSize:13, fontWeight:700, background:modal.side==="yes"?"rgba(232,52,26,0.2)":"rgba(42,107,204,0.2)", color:modal.side==="yes"?"#ff6b52":"#6BA3E8" }}>
                  {modal.side==="yes"?"✅ 做多（会发生）":"📉 做空（不会发生）"}
                </div>
                <div style={{ fontSize:12, ...sc.muted, marginBottom:8 }}>投注积分（你有 {fmt(userRow?.points||0)} 积分）</div>
                <div style={{ display:"flex", gap:8, marginBottom:10 }}>
                  {[50,100,500,1000].map(v=>(
                    <button key={v} onClick={()=>setBetAmt(v)} style={{ flex:1, padding:"7px 0", borderRadius:6, border:`1px solid ${betAmt==v?"#D4A017":"rgba(240,234,214,0.15)"}`, background:betAmt==v?"rgba(212,160,23,0.15)":"transparent", color:betAmt==v?"#F5C842":"rgba(240,234,214,0.5)", fontSize:13, cursor:"pointer" }}>{v}</button>
                  ))}
                </div>
                <input type="number" value={betAmt} onChange={e=>setBetAmt(e.target.value)} style={{ width:"100%", background:"#252525", border:"1px solid rgba(212,160,23,0.3)", borderRadius:8, padding:"10px 14px", color:"#F0EAD6", fontSize:15, outline:"none", marginBottom:16 }} />
                <div style={{ background:"#252525", borderRadius:8, padding:"12px 14px", marginBottom:20, fontSize:13 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}><span style={sc.muted}>当前概率</span><span style={{ fontWeight:700, color:"#F5C842" }}>{pct}%</span></div>
                  <div style={{ display:"flex", justifyContent:"space-between" }}><span style={sc.muted}>若判断正确可获得</span><span style={{ fontWeight:700, color:"#4CAF50" }}>+{fmt(potW)} 积分</span></div>
                </div>
                <div style={{ display:"flex", gap:10 }}>
                  <button onClick={()=>{setModal(null);setBetAmt(100);}} style={{ flex:1, padding:"11px 0", borderRadius:8, border:"1px solid rgba(240,234,214,0.2)", background:"transparent", color:"rgba(240,234,214,0.5)", fontSize:14, cursor:"pointer" }}>取消</button>
                  <button onClick={handleBet} style={{ flex:2, padding:"11px 0", borderRadius:8, border:"none", background:"linear-gradient(90deg,#D4A017,#F5C842)", color:"#0D0D0D", fontSize:14, fontWeight:700, cursor:"pointer" }}>确认投注</button>
                </div>
              </>;
            })()}
          </div>
        </div>
      )}

      <nav style={{ position:"sticky", top:0, zIndex:100, background:"rgba(13,13,13,0.95)", backdropFilter:"blur(16px)", borderBottom:"1px solid rgba(212,160,23,0.2)", height:58, display:"flex", alignItems:"center", padding:"0 20px", gap:8 }}>
        <div onClick={()=>setPage("market")} style={{ fontFamily:"Noto Serif SC", fontSize:20, fontWeight:900, color:"#D4A017", textShadow:"0 0 20px rgba(212,160,23,0.5)", marginRight:12, cursor:"pointer" }}>筑<span style={{ color:"#E8341A" }}>彩</span></div>
        {["market","portfolio","leaderboard"].map(p=>(
          <button key={p} onClick={()=>setPage(p)} style={{ padding:"6px 14px", borderRadius:20, border:`1px solid ${page===p?"rgba(212,160,23,0.6)":"rgba(240,234,214,0.12)"}`, background:page===p?"rgba(212,160,23,0.12)":"transparent", color:page===p?"#F5C842":"rgba(240,234,214,0.45)", fontSize:13, cursor:"pointer" }}>
            {{"market":"市场","portfolio":"我的持仓","leaderboard":"排行榜"}[p]}
          </button>
        ))}
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:12 }}>
          {userRow ? <>
            <span style={{ fontSize:13, color:"#F5C842", fontWeight:700 }}>{fmt(userRow.points)} 积分</span>
            <span style={{ fontSize:13, ...sc.muted }}>{user}</span>
            <button onClick={logout} style={{ padding:"5px 12px", borderRadius:6, border:"1px solid rgba(240,234,214,0.2)", background:"transparent", color:"rgba(240,234,214,0.45)", fontSize:12, cursor:"pointer" }}>退出</button>
          </> : <button onClick={()=>setPage("login")} style={{ padding:"7px 18px", borderRadius:6, border:"none", background:"#E8341A", color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer" }}>登录 / 注册</button>}
        </div>
      </nav>

      <div style={{ maxWidth:900, margin:"0 auto", padding:"32px 16px 80px" }}>

        {page==="login" && (
          <div style={{ maxWidth:380, margin:"40px auto" }}>
            <div style={{ fontFamily:"Noto Serif SC", fontSize:26, fontWeight:900, color:"#D4A017", textAlign:"center", marginBottom:6 }}>筑<span style={{ color:"#E8341A" }}>彩</span></div>
            <div style={{ textAlign:"center", fontSize:13, ...sc.muted, marginBottom:32 }}>中文预测市场 · 新用户赠送 1000 积分</div>
            <div style={{ ...sc.card, padding:28 }}>
              <div style={{ display:"flex", background:"#252525", borderRadius:8, padding:4, marginBottom:24 }}>
                {["login","register"].map(m=>(
                  <button key={m} onClick={()=>setLoginMode(m)} style={{ flex:1, padding:"8px 0", borderRadius:6, border:"none", background:loginMode===m?"#1C1C1C":"transparent", color:loginMode===m?"#F5C842":"rgba(240,234,214,0.4)", fontSize:14, fontWeight:loginMode===m?600:400, cursor:"pointer" }}>
                    {m==="login"?"登录":"注册"}
                  </button>
                ))}
              </div>
              {[["name","用户名","text"],["pass","密码","password"]].map(([f,label,type])=>(
                <div key={f} style={{ marginBottom:14 }}>
                  <div style={{ fontSize:12, ...sc.muted, marginBottom:6 }}>{label}</div>
                  <input type={type} value={form[f]} onChange={e=>setForm({...form,[f]:e.target.value})} onKeyDown={e=>e.key==="Enter"&&handleLogin()} style={{ width:"100%", background:"#252525", border:"1px solid rgba(212,160,23,0.2)", borderRadius:8, padding:"10px 14px", color:"#F0EAD6", fontSize:14, outline:"none" }} />
                </div>
              ))}
              <button onClick={handleLogin} style={{ width:"100%", padding:"12px 0", borderRadius:8, border:"none", background:"linear-gradient(90deg,#D4A017,#F5C842)", color:"#0D0D0D", fontSize:15, fontWeight:700, cursor:"pointer", marginTop:8 }}>
                {loginMode==="login"?"登录":"注册并获得 1000 积分"}
              </button>
            </div>
          </div>
        )}

        {page==="market" && <>
          <div style={{ marginBottom:28 }}>
            <div style={{ fontFamily:"Noto Serif SC", fontSize:22, fontWeight:700, marginBottom:6 }}>《黑神话：悟空2》发售前，哪些事会先发生？</div>
            <div style={{ fontSize:13, ...sc.muted }}>截止 2026年12月31日 · {events.reduce((a,e)=>a+e.yes_pool+e.no_pool,0).toLocaleString()} 积分已投入</div>
          </div>
          {loading ? <div style={{ textAlign:"center", padding:60, ...sc.muted }}>加载中…</div> : events.map((ev,i)=>{
            const pct=getPct(ev.yes_pool,ev.no_pool);
            const userPos=userRow?.positions?.[ev.id];
            return (
              <div key={ev.id} style={{ ...sc.card, marginBottom:10, overflow:"hidden", animation:`fadeUp 0.35s ${i*0.04}s both` }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 80px 164px", gap:12, alignItems:"center", padding:"16px 16px 12px" }}>
                  <div>
                    <div style={{ fontSize:15, fontWeight:500, marginBottom:3 }}>{ev.emoji} {ev.title}</div>
                    <div style={{ fontSize:11, ...sc.muted }}>{(ev.yes_pool+ev.no_pool).toLocaleString()} 积分已投入</div>
                    {userPos && <div style={{ marginTop:5, display:"flex", gap:6 }}>
                      {userPos.yesAmt>0&&<span style={{ fontSize:11, padding:"2px 8px", borderRadius:10, background:"rgba(232,52,26,0.15)", color:"#ff6b52" }}>做多 {userPos.yesAmt}</span>}
                      {userPos.noAmt>0&&<span style={{ fontSize:11, padding:"2px 8px", borderRadius:10, background:"rgba(42,107,204,0.15)", color:"#6BA3E8" }}>做空 {userPos.noAmt}</span>}
                    </div>}
                  </div>
                  <div style={{ textAlign:"center" }}>
                    <div style={{ fontSize:20, fontWeight:700, color:"#F5C842", fontFamily:"Noto Serif SC" }}>{pct}%</div>
                    <div style={{ height:3, background:"rgba(255,255,255,0.08)", borderRadius:2, marginTop:4, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:pct+"%", background:"linear-gradient(90deg,#D4A017,#F5C842)", borderRadius:2, transition:"width 0.8s" }} />
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:7 }}>
                    {[["yes","做多","#ff6b52","rgba(232,52,26,0.1)","rgba(232,52,26,0.35)",pct],
                      ["no","做空","#6BA3E8","rgba(42,107,204,0.1)","rgba(42,107,204,0.35)",100-pct]].map(([side,label,color,bg,border,p])=>(
                      <button key={side} onClick={()=>{if(!user){toast$("请先登录","err");return;}setModal({eventId:ev.id,side});}} style={{ flex:1, padding:"9px 0", borderRadius:7, border:`1px solid ${border}`, background:bg, color, fontSize:12, fontWeight:700, cursor:"pointer", lineHeight:1.6 }}>
                        {label}<br/><span style={{ fontSize:11, opacity:0.7 }}>{p}¢</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ borderTop:"1px solid rgba(212,160,23,0.1)", padding:"12px 16px", background:"#111" }}>
                  {(comments[ev.id]||[]).slice(-3).map((c,ci)=>(
                    <div key={ci} style={{ display:"flex", gap:8, marginBottom:8 }}>
                      <div style={{ width:26, height:26, borderRadius:"50%", background:"linear-gradient(135deg,#333,#555)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:"#D4A017", fontWeight:700, flexShrink:0 }}>{c.username[0].toUpperCase()}</div>
                      <div style={{ flex:1, background:"#1C1C1C", borderRadius:7, padding:"7px 10px", fontSize:12, color:"rgba(240,234,214,0.65)", lineHeight:1.6 }}>
                        <span style={{ color:"#D4A017", fontWeight:600, marginRight:6 }}>{c.username}</span>{c.text}
                      </div>
                    </div>
                  ))}
                  <div style={{ display:"flex", gap:8 }}>
                    <input value={commentText[ev.id]||""} onChange={e=>setCommentText({...commentText,[ev.id]:e.target.value})} onKeyDown={e=>e.key==="Enter"&&handleComment(ev.id)} placeholder={user?"发表观点… (Enter发送)":"登录后发表评论"} disabled={!user} style={{ flex:1, background:"#1C1C1C", border:"1px solid rgba(212,160,23,0.15)", borderRadius:7, padding:"7px 12px", color:"#F0EAD6", fontSize:12, outline:"none" }} />
                    <button onClick={()=>handleComment(ev.id)} style={{ padding:"0 14px", borderRadius:7, border:"none", background:"rgba(212,160,23,0.2)", color:"#F5C842", fontSize:12, cursor:"pointer", fontWeight:600 }}>发送</button>
                  </div>
                </div>
              </div>
            );
          })}
        </>}

        {page==="portfolio" && <>
          <div style={{ fontFamily:"Noto Serif SC", fontSize:22, fontWeight:700, marginBottom:24 }}>我的持仓</div>
          {!user ? (
            <div style={{ textAlign:"center", padding:60, ...sc.muted }}>
              <div style={{ fontSize:40, marginBottom:16 }}>🔒</div>
              <div style={{ marginBottom:16 }}>请先登录查看持仓</div>
              <button onClick={()=>setPage("login")} style={{ padding:"10px 28px", borderRadius:8, border:"none", background:"#E8341A", color:"#fff", fontSize:14, cursor:"pointer" }}>去登录</button>
            </div>
          ) : !userRow||Object.keys(userRow.positions||{}).length===0 ? (
            <div style={{ textAlign:"center", padding:60, ...sc.muted }}>
              <div style={{ fontSize:40, marginBottom:16 }}>📭</div>
              <div style={{ marginBottom:16 }}>还没有任何持仓</div>
              <button onClick={()=>setPage("market")} style={{ padding:"10px 28px", borderRadius:8, border:"none", background:"linear-gradient(90deg,#D4A017,#F5C842)", color:"#0D0D0D", fontSize:14, fontWeight:700, cursor:"pointer" }}>前往市场</button>
            </div>
          ) : <>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14, marginBottom:28 }}>
              {[{label:"当前积分",value:fmt(userRow.points),color:"#F5C842"},{label:"持仓数量",value:Object.keys(userRow.positions).length+" 个",color:"#F0EAD6"},{label:"总投入",value:fmt(Object.values(userRow.positions).reduce((a,p)=>a+(p.yesAmt||0)+(p.noAmt||0),0)),color:"#ff6b52"}].map(item=>(
                <div key={item.label} style={{ ...sc.card, padding:"18px 20px" }}>
                  <div style={{ fontSize:12, ...sc.muted, marginBottom:6 }}>{item.label}</div>
                  <div style={{ fontSize:22, fontWeight:700, color:item.color, fontFamily:"Noto Serif SC" }}>{item.value}</div>
                </div>
              ))}
            </div>
            {Object.entries(userRow.positions).map(([evId,pos])=>{
              const ev=events.find(e=>e.id===parseInt(evId));
              if(!ev) return null;
              return (
                <div key={evId} style={{ ...sc.card, padding:"18px 20px", marginBottom:10, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div style={{ fontSize:15, fontWeight:600, marginBottom:8 }}>{ev.emoji} {ev.title}</div>
                    <div style={{ display:"flex", gap:8 }}>
                      {pos.yesAmt>0&&<span style={{ fontSize:12, padding:"3px 10px", borderRadius:10, background:"rgba(232,52,26,0.15)", color:"#ff6b52" }}>做多 {pos.yesAmt} 积分</span>}
                      {pos.noAmt>0&&<span style={{ fontSize:12, padding:"3px 10px", borderRadius:10, background:"rgba(42,107,204,0.15)", color:"#6BA3E8" }}>做空 {pos.noAmt} 积分</span>}
                    </div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:20, fontWeight:700, color:"#F5C842" }}>{getPct(ev.yes_pool,ev.no_pool)}%</div>
                    <div style={{ fontSize:11, ...sc.muted }}>当前概率</div>
                  </div>
                </div>
              );
            })}
          </>}
        </>}

        {page==="leaderboard" && <>
          <div style={{ fontFamily:"Noto Serif SC", fontSize:22, fontWeight:700, marginBottom:24 }}>积分排行榜</div>
          {allUsers.length===0 ? (
            <div style={{ textAlign:"center", padding:60, ...sc.muted }}>
              <div style={{ fontSize:40, marginBottom:16 }}>🏆</div>
              <div>还没有用户，快去注册成为第一名！</div>
            </div>
          ) : allUsers.map((u,i)=>(
            <div key={u.name} style={{ ...sc.card, border:`1px solid ${i<3?"rgba(212,160,23,0.3)":"rgba(212,160,23,0.12)"}`, background:i<3?"rgba(212,160,23,0.05)":"#141414", padding:"16px 20px", marginBottom:8, display:"flex", alignItems:"center", gap:16 }}>
              <div style={{ width:36, height:36, borderRadius:"50%", background:["linear-gradient(135deg,#D4A017,#F5C842)","linear-gradient(135deg,#888,#ccc)","linear-gradient(135deg,#a05a2c,#cd7f32)"][i]||"#252525", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:700, color:i<3?"#0D0D0D":"rgba(240,234,214,0.5)", flexShrink:0 }}>{i+1}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:15, fontWeight:600 }}>{u.name}{u.name===user&&<span style={{ fontSize:11, color:"#D4A017" }}> （你）</span>}</div>
                <div style={{ fontSize:11, ...sc.muted, marginTop:2 }}>{Object.keys(u.positions||{}).length} 个持仓</div>
              </div>
              <div style={{ fontFamily:"Noto Serif SC", fontSize:20, fontWeight:700, color:i<3?"#F5C842":"#F0EAD6" }}>{fmt(u.points)}</div>
              <div style={{ fontSize:11, ...sc.muted }}>积分</div>
            </div>
          ))}
        </>}

      </div>
    </div>
  );
}
