import { useState, useEffect, useCallback } from "react";

// ─── ARCHITECTURE ─────────────────────────────────────────────────────────────
// Pure local CRM — no backend, no API calls. Data lives in your browser (localStorage).
// Assessments are produced by any LLM using prompts/assess.md and pasted into src/data/*.js

// ─── UTILS ────────────────────────────────────────────────────────────────────
function copyText(text, cb) {
  const fb=()=>{const t=document.createElement("textarea");t.value=text;t.style.cssText="position:fixed;top:-9999px;opacity:0;";document.body.appendChild(t);t.focus();t.select();try{document.execCommand("copy");if(cb)cb(true);}catch{if(cb)cb(false);}document.body.removeChild(t);};
  if(navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(()=>cb&&cb(true)).catch(fb); else fb();
}
const SK="be_fire_log_v1", SAK="be_arsenal_v1", SSK="be_streak_v1";
async function loadFL(){try{const r=await storage.get(SK);return r?JSON.parse(r.value):[];}catch{return[];}}
async function saveFL(l){try{await storage.set(SK,JSON.stringify(l));}catch{}}
async function loadAR(){try{const r=await storage.get(SAK);return r?JSON.parse(r.value):[];}catch{return[];}}
async function saveAR(d){try{await storage.set(SAK,JSON.stringify(d));}catch{}}
async function loadStreak(){try{const r=await storage.get(SSK);return r?JSON.parse(r.value):{};}catch{return{};}}
async function saveStreak(s){try{await storage.set(SSK,JSON.stringify(s));}catch{}}
function daysSince(iso){return Math.floor((Date.now()-new Date(iso).getTime())/86400000);}
function toDateKey(d){return d.toISOString().substring(0,10);}

import { SEED, FEED_DATE } from "./data/sample.js";
import { PROFILE } from "./config.js";
import { storage } from "./storage.js";

// ─── MINI COMPONENTS ─────────────────────────────────────────────────────────
function CopyBtn({text,label="COPY",style={}}){
  const [ok,setOk]=useState(false);
  return <button onClick={()=>copyText(text,v=>{if(v!==false){setOk(true);setTimeout(()=>setOk(false),2000);}})} style={{fontFamily:"'Orbitron',monospace",fontSize:8,letterSpacing:2,padding:"4px 10px",border:`1px solid ${ok?"#00ff88":"rgba(0,212,255,0.4)"}`,background:ok?"rgba(0,255,136,0.1)":"rgba(0,212,255,0.05)",color:ok?"#00ff88":"rgba(0,212,255,0.7)",cursor:"pointer",borderRadius:1,transition:"all 0.2s",...style}}>{ok?"✓ COPIED":label}</button>;
}

function Pulse({color="#00d4ff",size=6}){
  return <div style={{width:size,height:size,borderRadius:"50%",background:color,boxShadow:`0 0 ${size*2}px ${color}`,animation:"pulse 1.5s ease-in-out infinite",flexShrink:0}}/>;
}

// ─── RADAR CHART ─────────────────────────────────────────────────────────────
function RadarChart({score,isHot}){
  const r=38,cx=48,cy=48,axes=5;
  const pts=(val)=>Array.from({length:axes},(_,i)=>{
    const a=(i/axes)*2*Math.PI-Math.PI/2;
    const rv=(val/100)*r;
    return [cx+rv*Math.cos(a),cy+rv*Math.sin(a)];
  });
  const grid=[0.25,0.5,0.75,1];
  const col=isHot?"#ffa000":"#00d4ff";
  const scorePts=pts(score);
  return (
    <svg width={96} height={96}>
      {grid.map(g=>{ const gp=pts(g*100); return <polygon key={g} points={gp.map(p=>p.join(",")).join(" ")} fill="none" stroke={`${col}20`} strokeWidth="0.5"/>; })}
      {Array.from({length:axes},(_,i)=>{const a=(i/axes)*2*Math.PI-Math.PI/2;return <line key={i} x1={cx} y1={cy} x2={cx+r*Math.cos(a)} y2={cy+r*Math.sin(a)} stroke={`${col}30`} strokeWidth="0.5"/>;} )}
      <polygon points={scorePts.map(p=>p.join(",")).join(" ")} fill={`${col}20`} stroke={col} strokeWidth="1.5" style={{filter:`drop-shadow(0 0 4px ${col})`}}/>
      <circle cx={cx} cy={cy} r={3} fill={col} style={{filter:`drop-shadow(0 0 6px ${col})`}}/>
      <text x={cx} y={cy+1} textAnchor="middle" dominantBaseline="middle" style={{fill:col,fontSize:10,fontFamily:"'Orbitron',monospace",fontWeight:700}}>{score}</text>
    </svg>
  );
}

// ─── WAVEFORM (right panel only — small) ─────────────────────────────────────
function Waveform({active,color="#00d4ff"}){
  return (
    <div style={{display:"flex",alignItems:"center",gap:2,height:16}}>
      {Array.from({length:14},(_,i)=>(
        <div key={i} style={{width:2,background:color,opacity:active?0.7:0.15,borderRadius:1,
          height:active?undefined:2,
          animation:active?`wave ${0.4+i*0.07}s ease-in-out infinite alternate`:undefined}}/>
      ))}
    </div>
  );
}

// ─── CLOCK — isolated so only it re-renders every second ─────────────────────
function Clock(){
  const [t,setT]=useState(()=>new Date());
  useEffect(()=>{const id=setInterval(()=>setT(new Date()),1000);return()=>clearInterval(id);},[]);
  return(
    <span style={{fontSize:9,color:"rgba(0,212,255,0.5)",letterSpacing:1,fontVariantNumeric:"tabular-nums"}}>
      {t.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}
    </span>
  );
}

const CROSS_SESSION_CONTACTS = {};

// ─── STREAK MAP ───────────────────────────────────────────────────────────────
function StreakMap({ streakData }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthName = now.toLocaleString("en-GB", { month: "long" });
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const cells = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  let streak = 0;
  // Count consecutive days with activity, starting from today
  // If today has no entry yet, still count it as part of streak if yesterday had activity
  const todayKey = `${year}-${String(month+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  const startDay = streakData[todayKey] ? now.getDate() : now.getDate() - 1;
  for (let d = startDay; d >= 1; d--) {
    const key = `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    if (streakData[key]) streak++; else break;
  }
  const dayLabels = ["S","M","T","W","T","F","S"];
  return (
    <div style={{padding:"10px 12px",borderTop:"1px solid rgba(0,212,255,0.08)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
        <span style={{fontSize:7,letterSpacing:2,color:"rgba(0,212,255,0.4)"}}>DAILY STREAK</span>
        <span style={{fontSize:9,color:streak>0?"#ffa000":"rgba(0,212,255,0.2)",fontWeight:700}}>
          {streak>0?`${streak} 🔥`:"0"}
        </span>
      </div>
      <div style={{fontSize:6,color:"rgba(0,212,255,0.25)",letterSpacing:1,marginBottom:5}}>{monthName.toUpperCase()} {year}</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:1.5,marginBottom:2}}>
        {dayLabels.map((l,i)=><div key={i} style={{fontSize:6,color:"rgba(0,212,255,0.2)",textAlign:"center"}}>{l}</div>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:1.5}}>
        {cells.map((d,i)=>{
          if(!d) return <div key={`p${i}`}/>;
          const key=`${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
          const count=streakData[key]||0;
          const isToday=d===now.getDate();
          const bg=count>=5?"#ffa000":count>=3?"rgba(255,160,0,0.55)":count>=1?"rgba(0,212,255,0.45)":"rgba(0,212,255,0.05)";
          return <div key={key} title={`${key}: ${count} scan${count!==1?"s":""}`} style={{aspectRatio:"1",borderRadius:1.5,background:bg,border:isToday?"1px solid rgba(0,212,255,0.5)":"1px solid transparent",boxShadow:count>0?`0 0 3px ${bg}`:"none"}}/>;
        })}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:3,marginTop:5}}>
        <span style={{fontSize:6,color:"rgba(0,212,255,0.2)"}}>less</span>
        {["rgba(0,212,255,0.05)","rgba(0,212,255,0.45)","rgba(255,160,0,0.55)","#ffa000"].map((c,i)=>(
          <div key={i} style={{width:6,height:6,borderRadius:1,background:c}}/>
        ))}
        <span style={{fontSize:6,color:"rgba(0,212,255,0.2)"}}>more</span>
      </div>
    </div>
  );
}

export default function BulletEcho(){
  const [items,setItems]=useState([]);
  const [started,setStarted]=useState(false);
  const [running,setRunning]=useState(false);
  const [selected,setSelected]=useState(null);
  const [activeTab,setActiveTab]=useState("intel");
  const [fireLog,setFireLog]=useState([]);
  const [arsenal,setArsenal]=useState([]);
  const [view,setView]=useState("main"); // main | log | arsenal | sync
  const [recycleStep,setRecycleStep]=useState("idle");
  const [justFired,setJustFired]=useState(false);
  const [streak, setStreak] = useState({});

  useEffect(()=>{
    // ─── ONE-TIME CLEANUP: remove dead contacts from storage ─────────────────
    const DEAD_IDS = [];
    // Load fire log + merge cross-session contacts
    // Priority: stored entry > cross-session seed (preserves any status changes made in this browser)
    loadFL().then(async stored => {
      // Purge dead contacts from storage first
      const purged = stored.filter(e => !DEAD_IDS.includes(e.id));
      const map = {...Object.fromEntries(purged.map(e=>[e.id,e]))};
      // Inject cross-session contacts that aren't in local storage yet
      Object.entries(CROSS_SESSION_CONTACTS).forEach(([id, known]) => {
        if (!map[id]) {
          map[id] = {
            id,
            name: known.name,
            tagline: known.tagline,
            phUrl: known.phUrl,
            dateFired: known.dateFired,
            relationshipStatus: known.relationshipStatus,
            statusHistory: [{ status: known.relationshipStatus, date: known.dateFired }],
            seeded: true,
          };
        }
        // If stored entry has stale "pending" but cross-session knows it's "connected" — update it
        else if (known.relationshipStatus !== "pending" && map[id].relationshipStatus === "pending") {
          map[id] = { ...map[id], relationshipStatus: known.relationshipStatus };
        }
      });
      const finalLog = Object.values(map).sort((a,b)=>new Date(b.dateFired)-new Date(a.dateFired));
      setFireLog(finalLog);
      await saveFL(finalLog);
    });
    loadStreak().then(s => {
      const knownDays = {};
      // Math.max ensures seeded days always show minimum intensity
      // even if storage has 0 or missing value for that day
      const merged = {...s};
      Object.entries(knownDays).forEach(([date,val])=>{
        merged[date]=Math.max(merged[date]||0,val);
      });
      setStreak(merged);
      saveStreak(merged);
    });
  },[]);

  const sel=selected?items.find(i=>i.id===selected):null;
  const a=sel?.assessment;

  const stats={total:items.length,worthy:items.filter(i=>i.assessment?.worthMessaging).length,fired:items.filter(i=>i.status==="fired").length,killed:items.filter(i=>i.status==="killed"||i.status==="recycled").length,post:items.filter(i=>i.assessment?.postWorthy).length};

  const runAnalysis=useCallback(()=>{
    // Streak is managed on load — always exactly 1 per day regardless of reloads
    setStarted(true);setRunning(true);setSelected(null);setView("main");
    const loaded=SEED.map(p=>({
      id:p.id, product:p,
      assessment:p.assessment||null,
      status:p.assessment?(p.assessment.worthMessaging?"ready":"killed"):"crm-only"
    }));
    setTimeout(()=>{setItems(loaded);setRunning(false);},600);
  },[]);

  const onFire=useCallback((id,as)=>{
    setItems(prev=>prev.map(i=>i.id===id?{...i,status:"fired"}:i));
    const p=SEED.find(p=>p.id===id);
    const entry={
      id, name:p.name, tagline:p.tagline, phUrl:p.phUrl, url:p.url,
      category:p.category, upvotes:p.upvotes, score:as.score,
      founderPlay:p.founderPlay||false,
      positioning:as.positioning, opportunityAngle:as.opportunityAngle,
      claimsToChallenge:as.claimsToChallenge, architecturalObservation:as.architecturalObservation,
      messageTarget:as.messageTarget, linkedInUrl:as.linkedInUrl||null,
      connectionNote:as.connectionNote, linkedInMessage:as.linkedInMessage,
      theyreQuiet:as.replyToolkit?.theyreQuiet||null,
      theyreInterested:as.replyToolkit?.theyreInterested||null,
      theyreTheRightPerson:as.replyToolkit?.theyreTheRightPerson||null,
      dateFired:new Date().toISOString(),
      relationshipStatus:"pending",
      statusHistory:[{status:"pending",date:new Date().toISOString()}],
      seeded: false,
      cuUrl: CROSS_SESSION_CONTACTS[id]?.cuUrl || null,
    };
    // Add to fire log — Signal Board reads from this, updates immediately
    const log=[entry,...fireLog.filter(e=>e.id!==id)];
    setFireLog(log);
    saveFL(log);
    setJustFired(true);
    setTimeout(()=>setJustFired(false),3000);
  },[fireLog]);

  const onKill=useCallback(id=>{
    // Remove from fire log storage — prevents ghost entries in CRM Status panel
    setItems(prev=>prev.map(i=>i.id===id?{...i,status:"killed"}:i));
    const log=fireLog.filter(e=>e.id!==id);
    setFireLog(log);
    saveFL(log);
  },[fireLog]);

  const onRecycle=useCallback((id)=>{
    // Remove from fire log storage — recycled contacts don't belong in active CRM Status
    setItems(prev=>prev.map(i=>i.id===id?{...i,status:"recycled"}:i));
    const log=fireLog.filter(e=>e.id!==id);
    setFireLog(log);
    saveFL(log);
  },[fireLog]);
  const onQueuePost=useCallback((id,as)=>{
    const p=SEED.find(p=>p.id===id);
    const d={id:`${id}_${Date.now()}`,productId:id,productName:p.name,phUrl:p.phUrl,draft:as.linkedInAngle,dateQueued:new Date().toISOString(),status:"queued"};
    const arr=[d,...arsenal];setArsenal(arr);saveAR(arr);
  },[arsenal]);
  const onStatusChange=useCallback((id,ns)=>{
    const log=fireLog.map(e=>e.id===id?{...e,relationshipStatus:ns,statusHistory:[...(e.statusHistory||[]),{status:ns,date:new Date().toISOString()}]}:e);
    setFireLog(log);saveFL(log);
  },[fireLog]);

  const today=new Date();
  const dateStr=today.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}).toUpperCase();

  const syncPayload=`BE SYNC — ${today.toISOString().substring(0,10)}\nFeed: ${FEED_DATE}\nContacts: ${fireLog.length}\n\n`+fireLog.map((e,i)=>`── Contact ${i+1}: ${e.name}\nStatus: ${e.relationshipStatus||"pending"}\nFired: ${e.dateFired?.substring(0,10)}\nPH: ${e.phUrl||""}\nLI: ${e.linkedInUrl||"not captured"}\nScore: ${e.score||"?"}\n\nCONNECTION NOTE:\n${e.connectionNote||""}\n\nFULL MESSAGE:\n${e.linkedInMessage||""}\n\nQUIET FOLLOW-UP:\n${e.theyreQuiet||""}\n\nOPPORTUNITY:\n${e.opportunityAngle||""}\n\nSTATUS HISTORY:\n${(e.statusHistory||[]).map(h=>`  ${h.date?.substring(0,10)} → ${h.status}`).join("\n")}`).join("\n\n══════════\n\n");

  const SC={pending:"#ffa000",connected:"#00d4ff",replied:"#00ff88",nurture:"rgba(200,140,255,0.9)",ghosted:"#334455"};
  const STATUS_LIST=["pending","connected","replied","nurture","ghosted"];

  const noteLen=a?.connectionNote?.length||0;
  const noteColor=noteLen>280?"#ff4444":noteLen>240?"#ffa000":"rgba(0,212,255,0.5)";

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div style={{minHeight:"100vh",maxHeight:"100vh",background:"#000810",fontFamily:"'Orbitron',monospace",color:"#e8f4ff",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:rgba(0,212,255,0.3);}
        a:hover{opacity:0.7;}
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(1.4)}}
        @keyframes arcSpin{to{transform:rotate(360deg)}}
        @keyframes scanH{0%{transform:translateX(-100vw)}100%{transform:translateX(100vw)}}
        @keyframes wave{from{height:2px}to{height:16px}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes glow{0%,100%{box-shadow:0 0 8px rgba(0,212,255,0.3)}50%{box-shadow:0 0 20px rgba(0,212,255,0.7)}}
        @keyframes sweep{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
        @keyframes gridPulse{0%,100%{opacity:0.025}50%{opacity:0.055}}      `}</style>

      {/* Global grid bg */}
      <svg style={{position:"fixed",inset:0,width:"100%",height:"100%",animation:"gridPulse 5s ease-in-out infinite",pointerEvents:"none",zIndex:0}} xmlns="http://www.w3.org/2000/svg"><defs><pattern id="g" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#00d4ff" strokeWidth="0.25"/></pattern></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>

      {/* Scan line */}
      <div style={{position:"fixed",top:0,left:0,width:"30%",height:"1px",background:"linear-gradient(90deg,transparent,rgba(0,212,255,0.8),transparent)",animation:"scanH 6s linear infinite",pointerEvents:"none",zIndex:200}}/>

      {/* ── TOPBAR ─────────────────────────────────────────────────────────── */}
      <div style={{position:"relative",zIndex:10,flexShrink:0,borderBottom:"1px solid rgba(0,212,255,0.15)",background:"rgba(0,5,15,0.9)"}}>
        <div style={{height:2,background:"linear-gradient(90deg,transparent,#00d4ff 30%,#ffa000 70%,transparent)"}}/>
        <div style={{display:"flex",alignItems:"center",padding:"0 16px",height:44,gap:16}}>
          {/* Identity */}
          <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
            <div style={{position:"relative",width:28,height:28}}>
              <svg width={28} height={28} style={{position:"absolute",animation:"arcSpin 3s linear infinite"}}><circle cx={14} cy={14} r={11} fill="none" stroke="rgba(0,212,255,0.3)" strokeWidth="1.5"/><circle cx={14} cy={14} r={11} fill="none" stroke="#00d4ff" strokeWidth="1.5" strokeDasharray="17 52" strokeLinecap="round"/></svg>
              <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{width:6,height:6,borderRadius:"50%",background:"#00d4ff",boxShadow:"0 0 6px #00d4ff",animation:"pulse 2s ease-in-out infinite"}}/></div>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:900,letterSpacing:4,color:"#e8f4ff",lineHeight:1}}>BULLET ECHO</div>
              <div style={{fontSize:7,letterSpacing:2,color:"rgba(0,212,255,0.4)",marginTop:1}}>{PROFILE.headerTag}</div>
            </div>
          </div>
          <div style={{width:1,height:28,background:"rgba(0,212,255,0.15)"}}/>
          {/* Stats row */}
          {[["TGT",stats.total,"rgba(0,212,255,0.6)"],["HOT",stats.worthy,"#00d4ff"],["FIRED",stats.fired,"#ffa000"],["DEAD",stats.killed,"rgba(0,212,255,0.3)"],["POST✦",stats.post,"#ffa000"]].map(([l,v,c])=>(
            <div key={l} style={{textAlign:"center",flexShrink:0}}>
              <div style={{fontSize:7,letterSpacing:2,color:"rgba(0,212,255,0.4)",marginBottom:1}}>{l}</div>
              <div style={{fontSize:14,fontWeight:700,color:c,lineHeight:1,textShadow:`0 0 12px ${c}70`}}>{v}</div>
            </div>
          ))}
          <div style={{width:1,height:28,background:"rgba(0,212,255,0.15)"}}/>
          {/* Feed date + PH hint */}
          <div style={{flex:1,display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:8,letterSpacing:2,color:"rgba(0,212,255,0.4)",padding:"2px 8px",border:"1px solid rgba(0,212,255,0.15)"}}>{FEED_DATE}</span>
            <span style={{fontSize:7,color:"rgba(255,160,0,0.5)",letterSpacing:1}}>LOAD ASSESSMENTS FROM <span style={{color:"#ffa000",fontWeight:700}}>src/data</span> · AIM FOR 5-7 FIRES/DAY</span>
          </div>
          {/* Nav + clock */}
          <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
            {[["LOG",fireLog.length,"log"],["ARSENAL",arsenal.filter(a=>a.status==="queued").length,"arsenal"],["SYNC","↑","sync"]].map(([l,c,k])=>(
              <button key={k} onClick={()=>setView(v=>v===k?"main":k)} style={{padding:"3px 10px",fontSize:7,letterSpacing:2,border:"1px solid",borderRadius:1,cursor:"pointer",transition:"all 0.15s",fontFamily:"'Orbitron',monospace",background:view===k?"rgba(0,212,255,0.1)":"transparent",borderColor:view===k?"#00d4ff":"rgba(0,212,255,0.2)",color:view===k?"#00d4ff":"rgba(0,212,255,0.4)"}}>
                {l} {c!=="↑"?c:""}{c==="↑"?"↑":""}
              </button>
            ))}
            <div style={{width:1,height:20,background:"rgba(0,212,255,0.15)"}}/>
            {running&&<Pulse color="#ffa000"/>}
            <Clock/>
          </div>
        </div>
      </div>

      {/* ── MAIN BODY (3-column HUD) ────────────────────────────────────── */}
      <div style={{flex:1,display:"flex",overflow:"hidden",position:"relative",zIndex:1}}>

        {/* ── LEFT PANEL: TARGET LIST ───────────────────────────────────── */}
        <div style={{width:220,flexShrink:0,borderRight:"1px solid rgba(0,212,255,0.1)",display:"flex",flexDirection:"column",background:"rgba(0,3,12,0.7)"}}>
          {/* Panel header */}
          <div style={{padding:"8px 12px",borderBottom:"1px solid rgba(0,212,255,0.1)",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <Pulse size={5} color={running?"#ffa000":"rgba(0,212,255,0.5)"}/>
              <span style={{fontSize:7,letterSpacing:2,color:"rgba(0,212,255,0.5)"}}>TARGET MANIFEST</span>
            </div>
            <span style={{fontSize:7,color:"rgba(0,212,255,0.3)"}}>{SEED.length} TGT</span>
          </div>

          {/* Boot / target list */}
          {!started&&(
            <div style={{flex:1,display:"flex",flexDirection:"column",padding:12,gap:8,overflowY:"auto"}}>
              {SEED.map((p,i)=>(
                <div key={p.id} style={{padding:"8px 10px",border:"1px solid rgba(0,212,255,0.1)",background:"rgba(0,212,255,0.02)",animation:`fadeIn ${0.2+i*0.1}s ease`}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                    <span style={{fontSize:7,letterSpacing:1,color:"rgba(0,212,255,0.4)"}}>{String(i+1).padStart(2,"0")}</span>
                    <span style={{fontSize:7,color:"#ffa000",letterSpacing:1}}>▲{p.upvotes}</span>
                  </div>
                  <div style={{fontSize:10,fontWeight:700,color:"#e8f4ff",letterSpacing:0.5}}>{p.name}</div>
                  <div style={{fontSize:7,color:"rgba(0,212,255,0.4)",marginTop:2,letterSpacing:0.5}}>{p.category}</div>
                </div>
              ))}
              <button onClick={runAnalysis} style={{marginTop:8,padding:"10px",background:"rgba(0,212,255,0.06)",border:"1px solid #00d4ff",color:"#00d4ff",fontSize:8,fontWeight:700,cursor:"pointer",fontFamily:"'Orbitron',monospace",letterSpacing:3,boxShadow:"0 0 20px rgba(0,212,255,0.2)",animation:"glow 3s ease-in-out infinite"}}>
                ⚡ LOAD TARGETS
              </button>
            </div>
          )}

          {started&&(
            <div style={{flex:1,overflowY:"auto",padding:"6px 0"}}>
              {items.map(item=>{
                const isS=selected===item.id;
                const dead=item.status==="killed"||item.status==="recycled";
                const hot=item.assessment?.score>=80;
                const send=item.assessment?.worthMessaging;
                const ac=hot?"#ffa000":send?"#00d4ff":"rgba(0,212,255,0.2)";
                return (
                  <div key={item.id} onClick={()=>{setSelected(isS?null:item.id);setActiveTab("intel");setRecycleStep("idle");}}
                    style={{padding:"8px 12px",cursor:"pointer",borderLeft:`2px solid ${isS?ac:"transparent"}`,background:isS?"rgba(0,212,255,0.07)":"transparent",opacity:dead?0.35:1,transition:"all 0.15s",borderBottom:"1px solid rgba(0,212,255,0.05)"}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:6,marginBottom:3}}>
                      <span style={{fontSize:10,fontWeight:700,color:isS?"#e8f4ff":hot?"#ffa000":send?"#00d4ff":"rgba(232,244,255,0.5)",letterSpacing:0.5,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.product.name}</span>
                      <div style={{flexShrink:0,display:"flex",alignItems:"center",gap:4}}>
                        {item.status==="analyzing"&&<div style={{width:8,height:8,borderRadius:"50%",border:"1.5px solid #ffa000",borderTopColor:"transparent",animation:"arcSpin 0.8s linear infinite"}}/>}
                        {item.status==="crm-only"&&<div style={{width:8,height:8,borderRadius:"50%",background:"rgba(0,212,255,0.3)",boxShadow:"0 0 4px rgba(0,212,255,0.3)"}}/>}
                        {item.assessment&&<span style={{fontSize:9,fontWeight:700,color:ac}}>{item.assessment.score}</span>}
                        {item.status==="fired"&&<span style={{fontSize:7,color:"#00ff88"}}>✓</span>}
                        {item.assessment?.postWorthy&&<span style={{fontSize:8,color:"#ffa000"}}>✦</span>}
                      </div>
                    </div>
                    <div style={{fontSize:7,color:"rgba(0,212,255,0.35)",letterSpacing:0.3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.product.category} · ▲{item.product.upvotes}</div>
                    {item.assessment?.isRelaunch&&<div style={{fontSize:6,color:"#ff5500",letterSpacing:1,marginTop:2}}>↺ RELAUNCH</div>}
                  </div>
                );
              })}
              {!running&&<button onClick={runAnalysis} style={{margin:"8px 12px",padding:"6px",width:"calc(100% - 24px)",background:"transparent",border:"1px solid rgba(0,212,255,0.2)",color:"rgba(0,212,255,0.4)",fontSize:7,cursor:"pointer",fontFamily:"'Orbitron',monospace",letterSpacing:2}}>↺ RELOAD</button>}
            </div>
          )}
          {/* Streak map — always visible at bottom of left panel */}
          <StreakMap streakData={streak}/>
        </div>

        {/* ── CENTER PANEL: DETAIL / VIEWS ─────────────────────────────── */}
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>

          {/* LOG VIEW */}
          {view==="log"&&(
            <div style={{flex:1,overflowY:"auto",padding:16,animation:"fadeIn 0.2s ease"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
                <Pulse size={5} color="#00d4ff"/>
                <span style={{fontSize:8,letterSpacing:3,color:"#00d4ff"}}>FIRE LOG — {fireLog.length} CONTACTS</span>
              </div>
              {fireLog.length===0&&<div style={{fontSize:9,color:"rgba(0,212,255,0.3)",letterSpacing:2}}>EMPTY — FIRE A TARGET FIRST</div>}
              {[...fireLog].sort((a,b)=>new Date(b.dateFired)-new Date(a.dateFired)).map(e=>{
                const days=daysSince(e.dateFired);
                const cold=!e.seeded&&e.relationshipStatus==="pending"&&days>=3;
                const c=SC[e.relationshipStatus||"pending"]||"rgba(0,212,255,0.3)";
                return(
                  <div key={e.id} style={{marginBottom:12,padding:"12px",border:`1px solid ${c}30`,background:`${c}05`,animation:"fadeIn 0.2s ease"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                      <span style={{fontSize:12,fontWeight:700,color:cold?"#ff4444":"#e8f4ff",letterSpacing:0.5}}>{e.name}</span>
                      {cold&&<span style={{fontSize:7,color:"#ff4444",border:"1px solid #ff444430",padding:"1px 6px",letterSpacing:2}}>COLD {days}D</span>}
                      <button onClick={()=>onStatusChange(e.id,STATUS_LIST[(STATUS_LIST.indexOf(e.relationshipStatus||"pending")+1)%STATUS_LIST.length])} style={{fontSize:7,padding:"2px 8px",background:`${c}15`,border:`1px solid ${c}40`,color:c,cursor:"pointer",letterSpacing:1,fontFamily:"'Orbitron',monospace"}}>
                        {(e.relationshipStatus||"pending").toUpperCase()} →
                      </button>
                      <span style={{fontSize:7,color:"rgba(0,212,255,0.3)",marginLeft:"auto"}}>{new Date(e.dateFired).toLocaleDateString("en-GB")}</span>
                    </div>
                    <div style={{fontSize:8,color:"rgba(0,212,255,0.4)",marginBottom:8,letterSpacing:0.5}}>{e.tagline}</div>
                    {e.connectionNote&&(
                      <div style={{display:"flex",gap:8,alignItems:"center",background:"rgba(0,0,0,0.3)",padding:"8px 10px",marginBottom:6}}>
                        <span style={{fontSize:8,color:"rgba(232,244,255,0.6)",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",letterSpacing:0.3}}>"{e.connectionNote.substring(0,100)}..."</span>
                        <CopyBtn text={e.connectionNote} label="COPY"/>
                      </div>
                    )}
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      {e.phUrl&&<a href={e.phUrl} target="_blank" rel="noreferrer" style={{fontSize:7,color:"rgba(0,212,255,0.5)",letterSpacing:2,textDecoration:"none"}}>PH ↗</a>}
                      {e.linkedInUrl&&<a href={e.linkedInUrl} target="_blank" rel="noreferrer" style={{fontSize:7,color:"#ffa000",letterSpacing:2,textDecoration:"none"}}>LI ↗</a>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ARSENAL VIEW */}
          {view==="arsenal"&&(
            <div style={{flex:1,overflowY:"auto",padding:16,animation:"fadeIn 0.2s ease"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
                <Pulse size={5} color="#ffa000"/>
                <span style={{fontSize:8,letterSpacing:3,color:"#ffa000"}}>LINKEDIN ARSENAL — {arsenal.filter(a=>a.status==="queued").length} QUEUED</span>
              </div>
              {arsenal.length===0&&<div style={{fontSize:9,color:"rgba(255,160,0,0.3)",letterSpacing:2}}>EMPTY — QUEUE A POST FIRST</div>}
              {arsenal.filter(a=>a.status!=="discarded").map(d=>(
                <div key={d.id} style={{marginBottom:12,padding:"12px",border:"1px solid rgba(255,160,0,0.2)",background:"rgba(255,160,0,0.03)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                    <span style={{fontSize:11,fontWeight:700,color:"#e8f4ff"}}>{d.productName}</span>
                    <span style={{fontSize:7,color:d.status==="approved"?"#00d4ff":"#ffa000",letterSpacing:2}}>{d.status.toUpperCase()}</span>
                  </div>
                  <p style={{fontSize:9,color:"rgba(232,244,255,0.6)",lineHeight:1.7,marginBottom:10,letterSpacing:0.3,whiteSpace:"pre-wrap"}}>{d.draft}</p>
                  {d.status==="queued"&&<div style={{display:"flex",gap:8}}>
                    <button onClick={async()=>{copyText(d.draft);window.open("https://www.linkedin.com/feed/","_blank");const u=arsenal.map(a=>a.id===d.id?{...a,status:"approved"}:a);setArsenal(u);await saveAR(u);}} style={{padding:"6px 12px",background:"rgba(255,160,0,0.1)",border:"1px solid #ffa000",color:"#ffa000",fontSize:7,cursor:"pointer",fontFamily:"'Orbitron',monospace",letterSpacing:2}}>✦ APPROVE + COPY + LI</button>
                    <button onClick={async()=>{const u=arsenal.map(a=>a.id===d.id?{...a,status:"discarded"}:a);setArsenal(u);await saveAR(u);}} style={{padding:"6px 10px",background:"transparent",border:"1px solid rgba(0,212,255,0.2)",color:"rgba(0,212,255,0.3)",fontSize:7,cursor:"pointer",fontFamily:"'Orbitron',monospace",letterSpacing:2}}>DISCARD</button>
                  </div>}
                </div>
              ))}
            </div>
          )}

          {/* SYNC VIEW */}
          {view==="sync"&&(
            <div style={{flex:1,overflowY:"auto",padding:16,animation:"fadeIn 0.2s ease"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                <Pulse size={5} color="rgba(0,212,255,0.5)"/>
                <span style={{fontSize:8,letterSpacing:3,color:"rgba(0,212,255,0.6)"}}>EXPORT PAYLOAD</span>
              </div>
              <p style={{fontSize:8,color:"rgba(0,212,255,0.4)",marginBottom:14,lineHeight:1.8,letterSpacing:0.5}}>Copy payload → paste into your CRM, notes app, or an AI chat to sync your fires.</p>
              {fireLog.length===0?<div style={{fontSize:9,color:"rgba(0,212,255,0.3)",letterSpacing:2}}>NO CONTACTS TO SYNC</div>:(
                <>
                  <div style={{background:"rgba(0,0,0,0.4)",border:"1px solid rgba(0,212,255,0.1)",padding:10,marginBottom:12,maxHeight:200,overflowY:"auto"}}>
                    {fireLog.map(e=>(
                      <div key={e.id} style={{borderBottom:"1px solid rgba(0,212,255,0.06)",paddingBottom:6,marginBottom:6}}>
                        <span style={{fontSize:10,fontWeight:700,color:"#e8f4ff"}}>{e.name}</span>
                        <span style={{fontSize:8,color:"rgba(0,212,255,0.4)",marginLeft:8,letterSpacing:1}}>{e.relationshipStatus||"pending"} · {e.dateFired?.substring(0,10)}</span>
                      </div>
                    ))}
                  </div>
                  <CopyBtn text={syncPayload} label="COPY FULL SYNC PAYLOAD" style={{fontSize:8,padding:"8px 16px"}}/>
                </>
              )}
            </div>
          )}

          {/* MAIN — No selection */}
          {view==="main"&&!sel&&(
            <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
              {!started&&(
                <div style={{textAlign:"center",animation:"fadeIn 0.4s ease"}}>
                  <div style={{fontSize:9,letterSpacing:4,color:"rgba(0,212,255,0.3)",marginBottom:8}}>SYSTEM READY</div>
                  <div style={{fontSize:11,color:"rgba(0,212,255,0.5)",letterSpacing:2}}>{SEED.length} TARGETS LOADED · {FEED_DATE}</div>
                  <div style={{marginTop:16,fontSize:8,color:"rgba(255,160,0,0.5)",letterSpacing:1}}>SELECT TARGET FROM MANIFEST OR LOAD TARGETS</div>
                </div>
              )}
              {started&&!running&&(
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:9,letterSpacing:3,color:"rgba(0,212,255,0.4)",marginBottom:6}}>TARGETS READY</div>
                  <div style={{fontSize:28,fontWeight:900,color:"#00d4ff",textShadow:"0 0 30px rgba(0,212,255,0.5)"}}>{stats.worthy}</div>
                  <div style={{fontSize:8,letterSpacing:3,color:"rgba(0,212,255,0.4)",marginTop:4}}>ASSESSED · SELECT TO ENGAGE</div>
                  <div style={{fontSize:8,color:"rgba(255,160,0,0.5)",marginTop:8,letterSpacing:1}}>{SEED.length-stats.worthy} KILLED · {stats.worthy} READY</div>
                </div>
              )}
              {running&&(
                <div style={{textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",gap:14}}>
                  <div style={{position:"relative",width:80,height:80}}>
                    <svg width={80} height={80} style={{position:"absolute",animation:"arcSpin 1.5s linear infinite"}}><circle cx={40} cy={40} r={34} fill="none" stroke="rgba(0,212,255,0.15)" strokeWidth="2"/><circle cx={40} cy={40} r={34} fill="none" stroke="#00d4ff" strokeWidth="2" strokeDasharray="53 161" strokeLinecap="round"/></svg>
                    <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{width:10,height:10,borderRadius:"50%",background:"#00d4ff",boxShadow:"0 0 8px #00d4ff,0 0 24px #00d4ff",animation:"pulse 1s ease-in-out infinite"}}/></div>
                  </div>
                  <div style={{fontSize:9,letterSpacing:4,color:"#ffa000",animation:"blink 1s step-end infinite"}}>LOADING TARGETS</div>
                </div>
              )}
            </div>
          )}

          {/* MAIN — Target selected */}
          {view==="main"&&sel&&a&&(
            <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",animation:"fadeIn 0.2s ease"}}>
              {/* Target header */}
              <div style={{flexShrink:0,padding:"10px 16px",borderBottom:"1px solid rgba(0,212,255,0.1)",background:"rgba(0,3,12,0.5)",display:"flex",alignItems:"flex-start",gap:12}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:4}}>
                    {a.isRelaunch&&<span style={{fontSize:7,padding:"1px 6px",border:"1px solid #ff5500",color:"#ff5500",letterSpacing:2}}>↺ RELAUNCH</span>}
                    <span style={{fontSize:16,fontWeight:900,color:"#e8f4ff",letterSpacing:1,textShadow:a.worthMessaging?"0 0 20px rgba(0,212,255,0.4)":"none"}}>{sel.product.name}</span>
                    <span style={{fontSize:8,padding:"2px 8px",border:"1px solid rgba(0,212,255,0.2)",color:"rgba(0,212,255,0.6)",letterSpacing:1}}>{sel.product.category}</span>
                    <span style={{fontSize:9,color:"#ffa000",letterSpacing:1}}>▲{sel.product.upvotes}</span>
                  </div>
                  <div style={{fontSize:9,color:"rgba(0,212,255,0.5)",marginBottom:6,letterSpacing:0.3}}>{sel.product.tagline}</div>
                  <div style={{display:"flex",gap:10}}>
                    <a href={sel.product.phUrl} target="_blank" rel="noreferrer" style={{fontSize:7,color:"rgba(0,212,255,0.5)",letterSpacing:2,textDecoration:"none"}}>PH ↗</a>
                    {sel.product.url&&<a href={sel.product.url} target="_blank" rel="noreferrer" style={{fontSize:7,color:"rgba(0,212,255,0.5)",letterSpacing:2,textDecoration:"none"}}>SITE ↗</a>}
                    <a href={a.linkedInUrl||`https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(sel.product.name)}`} target="_blank" rel="noreferrer" style={{fontSize:7,color:a.linkedInUrl?"#ffa000":"rgba(0,212,255,0.5)",letterSpacing:2,textDecoration:"none"}}>{a.linkedInUrl?"LI★ ↗":"LI ↗"}</a>
                  </div>
                </div>
                <RadarChart score={a.score} isHot={a.score>=80}/>
              </div>

              {/* Tab bar */}
              <div style={{flexShrink:0,display:"flex",borderBottom:"1px solid rgba(0,212,255,0.1)",background:"rgba(0,0,0,0.3)"}}>
                {[["INTEL","intel"],["MESSAGE","msg"],["REPLIES","replies"],...(sel.status==="killed"||sel.status==="recycled"?[["RECYCLE","recycle"]]:[]),...(a.postWorthy?[["✦ POST","post"]]:[])].map(([l,k])=>(
                  <button key={k} onClick={()=>setActiveTab(k)} style={{padding:"7px 14px",fontSize:7,letterSpacing:2,cursor:"pointer",border:"none",borderBottom:`2px solid ${activeTab===k?"#00d4ff":"transparent"}`,background:"transparent",color:activeTab===k?"#00d4ff":"rgba(0,212,255,0.3)",fontFamily:"'Orbitron',monospace",transition:"all 0.15s",marginBottom:-1}}>
                    {l}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div style={{flex:1,overflowY:"auto",padding:14}}>
                {/* INTEL */}
                {activeTab==="intel"&&(
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    {[["POSITIONING",a.positioning,"#00d4ff"],["OPPORTUNITY",a.opportunityAngle,"#ffa000"],["CLAIM",a.claimsToChallenge,"#ff4444"],["ARCHITECTURE",a.architecturalObservation,"rgba(0,212,255,0.6)"]].map(([l,v,c])=>(
                      <div key={l} style={{background:"rgba(0,0,0,0.4)",border:`1px solid ${c}20`,borderLeft:`2px solid ${c}`,padding:"10px 12px"}}>
                        <div style={{fontSize:7,letterSpacing:2,color:c,marginBottom:6,fontWeight:700}}>{l}</div>
                        <p style={{fontSize:9,color:"rgba(232,244,255,0.8)",lineHeight:1.7,letterSpacing:0.3}}>{v}</p>
                      </div>
                    ))}
                    <div style={{gridColumn:"1/-1",background:"rgba(0,0,0,0.3)",border:"1px solid rgba(0,212,255,0.08)",padding:"10px 12px"}}>
                      <div style={{fontSize:7,letterSpacing:2,color:"rgba(0,212,255,0.3)",marginBottom:4}}>ASSESSMENT</div>
                      <p style={{fontSize:9,color:"rgba(0,212,255,0.4)",lineHeight:1.7,letterSpacing:0.3}}>{a.reasoning}</p>
                    </div>
                  </div>
                )}
                {/* MESSAGE */}
                {activeTab==="msg"&&(
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    <div style={{background:"rgba(0,0,0,0.4)",border:`1px solid ${noteLen>280?"#ff4444":noteLen>240?"#ffa000":"rgba(255,160,0,0.2)"}`,padding:12}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                        <span style={{fontSize:7,letterSpacing:2,color:"#ffa000"}}>CONNECTION NOTE</span>
                        <span style={{fontSize:8,color:noteColor,fontWeight:noteLen>280?700:400}}>{noteLen}/300{noteLen>280?" ⚠ OVER":""}</span>
                      </div>
                      <p style={{fontSize:9,color:"#e8f4ff",lineHeight:1.75,marginBottom:10,letterSpacing:0.3}}>{a.connectionNote}</p>
                      <CopyBtn text={a.connectionNote} label="COPY NOTE"/>
                    </div>
                    <div style={{background:"rgba(0,0,0,0.4)",border:"1px solid rgba(0,212,255,0.15)",padding:12}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                        <span style={{fontSize:7,letterSpacing:2,color:"#00d4ff"}}>FULL MESSAGE → {(a.messageTarget||"").toUpperCase()}</span>
                        <span style={{fontSize:8,color:"rgba(0,212,255,0.4)"}}>{a.linkedInMessage?.length}c</span>
                      </div>
                      <p style={{fontSize:9,color:"#e8f4ff",lineHeight:1.8,marginBottom:10,letterSpacing:0.3,whiteSpace:"pre-wrap"}}>{a.linkedInMessage}</p>
                      <CopyBtn text={a.linkedInMessage} label="COPY FULL MESSAGE"/>
                    </div>
                  </div>
                )}
                {/* REPLIES */}
                {activeTab==="replies"&&a.replyToolkit&&(
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {[["THEY'RE INTERESTED",a.replyToolkit.theyreInterested,"#00d4ff"],["THEY'RE QUIET",a.replyToolkit.theyreQuiet,"rgba(0,212,255,0.4)"],["LONG GAME",a.replyToolkit.theyreTheRightPerson,"#ffa000"]].filter(([,v])=>v).map(([l,v,c])=>(
                      <div key={l} style={{background:"rgba(0,0,0,0.4)",border:`1px solid ${c}20`,padding:"10px 12px",display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start"}}>
                        <div style={{flex:1}}>
                          <div style={{fontSize:7,letterSpacing:2,color:c,marginBottom:6}}>{l}</div>
                          <p style={{fontSize:9,color:"rgba(232,244,255,0.8)",lineHeight:1.7,letterSpacing:0.3}}>{v}</p>
                        </div>
                        <CopyBtn text={v} style={{flexShrink:0,alignSelf:"flex-end"}}/>
                      </div>
                    ))}
                  </div>
                )}
                {/* RECYCLE */}
                {activeTab==="recycle"&&(a.replyToolkit?.phCommentAngle||a.replyToolkit?.recycledComment)&&(
                  <div style={{background:"rgba(0,0,0,0.4)",border:"1px solid rgba(255,160,0,0.25)",padding:12}}>
                    <div style={{fontSize:7,letterSpacing:2,color:"#ffa000",marginBottom:4}}>PH COMMENT ANGLE</div>
                    <div style={{fontSize:7,color:"rgba(255,160,0,0.5)",marginBottom:10,letterSpacing:1,padding:"5px 8px",border:"1px solid rgba(255,160,0,0.2)",background:"rgba(255,160,0,0.05)",lineHeight:1.6}}>⚠ WRITE IN YOUR OWN WORDS — do not copy-paste this to PH</div>
                    <p style={{fontSize:11,color:"rgba(232,244,255,0.85)",lineHeight:1.85,marginBottom:14,letterSpacing:0.3,fontStyle:"italic",borderLeft:"2px solid rgba(255,160,0,0.4)",paddingLeft:10}}>{a.replyToolkit.phCommentAngle||a.replyToolkit.recycledComment}</p>
                    <div style={{fontSize:7,color:"rgba(0,212,255,0.35)",marginBottom:12,letterSpacing:0.5,lineHeight:1.7}}>Use this insight as inspiration. Write 2-3 sentences in your own voice. Your comment, your words.</div>
                    <button onClick={()=>window.open(sel.product.phUrl,"_blank")} style={{padding:"7px 14px",background:"transparent",border:"1px solid rgba(0,212,255,0.25)",color:"rgba(0,212,255,0.5)",fontSize:7,cursor:"pointer",fontFamily:"'Orbitron',monospace",letterSpacing:2,marginBottom:10}}>OPEN PH ↗</button>
                    {recycleStep==="idle"&&<div><button onClick={()=>setRecycleStep("pending")} style={{display:"block",padding:"7px 14px",background:"rgba(0,255,136,0.06)",border:"1px solid rgba(0,255,136,0.3)",color:"#00ff88",fontSize:7,cursor:"pointer",fontFamily:"'Orbitron',monospace",letterSpacing:2}}>I WROTE + POSTED MY OWN COMMENT</button></div>}
                    {recycleStep==="pending"&&(
                      <div>
                        <div style={{fontSize:8,color:"#ffa000",letterSpacing:2,marginBottom:8}}>CONFIRM — DID YOU POST IT?</div>
                        <div style={{display:"flex",gap:8}}>
                          <button onClick={()=>{onRecycle(sel.id,a);setRecycleStep("done");}} style={{padding:"7px 14px",background:"rgba(0,255,136,0.08)",border:"1px solid #00ff88",color:"#00ff88",fontSize:7,cursor:"pointer",fontFamily:"'Orbitron',monospace",letterSpacing:2}}>YES, POSTED</button>
                          <button onClick={()=>setRecycleStep("idle")} style={{padding:"7px 14px",background:"transparent",border:"1px solid rgba(0,212,255,0.15)",color:"rgba(0,212,255,0.3)",fontSize:7,cursor:"pointer",fontFamily:"'Orbitron',monospace",letterSpacing:2}}>NO, SKIP</button>
                        </div>
                      </div>
                    )}
                    {recycleStep==="done"&&<span style={{fontSize:9,color:"#00ff88",letterSpacing:2,display:"block",marginTop:8}}>✓ RECYCLED</span>}
                  </div>
                )}
                {/* POST */}
                {activeTab==="post"&&a.linkedInAngle&&(
                  <div style={{background:"rgba(0,0,0,0.4)",border:"1px solid rgba(255,160,0,0.2)",padding:12}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                      <span style={{fontSize:7,letterSpacing:2,color:"#ffa000"}}>YOUR POST ✦</span>
                      <span style={{fontSize:8,color:"rgba(255,160,0,0.4)"}}>{a.linkedInAngle.length}c</span>
                    </div>
                    <p style={{fontSize:9,color:"#e8f4ff",lineHeight:1.8,marginBottom:12,letterSpacing:0.3,whiteSpace:"pre-wrap"}}>{a.linkedInAngle}</p>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>{copyText(a.linkedInAngle);onQueuePost(sel.id,a);}} style={{padding:"7px 14px",background:"rgba(255,160,0,0.08)",border:"1px solid #ffa000",color:"#ffa000",fontSize:7,cursor:"pointer",fontFamily:"'Orbitron',monospace",letterSpacing:2}}>✦ COPY + QUEUE</button>
                      <CopyBtn text={a.linkedInAngle} label="COPY ONLY"/>
                    </div>
                  </div>
                )}

                {/* Action row */}
                <div style={{display:"flex",alignItems:"center",gap:10,marginTop:12,paddingTop:12,borderTop:"1px solid rgba(0,212,255,0.08)"}}>
                  {sel.status==="ready"&&<>
                    <button onClick={()=>{copyText(a.connectionNote||a.linkedInMessage);setTimeout(()=>window.open(a.messageTarget==="founder"?`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(sel.product.name)}`:`https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(sel.product.name)}`,"_blank"),500);onFire(sel.id,a);}} style={{padding:"9px 24px",background:"rgba(0,212,255,0.08)",border:"1px solid #00d4ff",color:"#00d4ff",fontSize:9,fontWeight:700,cursor:"pointer",fontFamily:"'Orbitron',monospace",letterSpacing:3,boxShadow:"0 0 20px rgba(0,212,255,0.2)",animation:"glow 3s ease-in-out infinite"}}>
                      {justFired?"✓ FIRED — LI OPENING":"⚡ FIRE →"}
                    </button>
                    <button onClick={()=>onKill(sel.id)} style={{padding:"9px 16px",background:"transparent",border:"1px solid rgba(0,212,255,0.2)",color:"rgba(0,212,255,0.4)",fontSize:8,cursor:"pointer",fontFamily:"'Orbitron',monospace",letterSpacing:2}}>KILL</button>
                  </>}
                  {sel.status==="fired"&&<span style={{fontSize:8,color:"#00ff88",letterSpacing:2}}>SENT ✓ — UPDATE STATUS IN LOG</span>}
                  {sel.status==="killed"&&<span style={{fontSize:8,color:"rgba(0,212,255,0.3)",letterSpacing:2}}>KILLED — SEE RECYCLE TAB</span>}
                  {sel.status==="recycled"&&<span style={{fontSize:8,color:"#00ff88",letterSpacing:2}}>RECYCLED ✓</span>}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL: SIGNAL BOARD ─────────────────────────────────── */}
        <div style={{width:170,flexShrink:0,borderLeft:"1px solid rgba(0,212,255,0.1)",display:"flex",flexDirection:"column",background:"rgba(0,3,12,0.7)",overflowY:"auto"}}>
          {/* Panel header */}
          <div style={{padding:"8px 12px",borderBottom:"1px solid rgba(0,212,255,0.1)",flexShrink:0}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <Pulse size={5} color="rgba(0,212,255,0.4)"/>
              <span style={{fontSize:7,letterSpacing:2,color:"rgba(0,212,255,0.4)"}}>SIGNAL BOARD</span>
            </div>
          </div>
          {/* Score distribution */}
          <div style={{padding:"10px 12px",borderBottom:"1px solid rgba(0,212,255,0.08)"}}>
            <div style={{fontSize:7,letterSpacing:2,color:"rgba(0,212,255,0.3)",marginBottom:8}}>SCORE MAP</div>
            {items.filter(i=>i.assessment).map(i=>{
              const sc=i.assessment.score;const hot=sc>=80;const send=sc>=58;
              const c=hot?"#ffa000":send?"#00d4ff":"rgba(0,212,255,0.2)";
              return(
                <div key={i.id} style={{marginBottom:6,cursor:"pointer"}} onClick={()=>{setSelected(i.id);setActiveTab("intel");setView("main");}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                    <span style={{fontSize:7,color:c,letterSpacing:0.5,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{i.product.name}</span>
                    <span style={{fontSize:7,color:c,fontWeight:700,flexShrink:0,marginLeft:4}}>{sc}</span>
                  </div>
                  <div style={{height:2,background:"rgba(0,212,255,0.1)",borderRadius:1}}>
                    <div style={{height:"100%",width:`${sc}%`,background:c,borderRadius:1,boxShadow:`0 0 4px ${c}`,transition:"width 0.8s ease"}}/>
                  </div>
                </div>
              );
            })}
            {items.filter(i=>i.status==="analyzing").map(i=>(
              <div key={i.id} style={{marginBottom:6}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                  <span style={{fontSize:7,color:"rgba(0,212,255,0.3)",letterSpacing:0.5}}>{i.product.name}</span>
                  <div style={{width:8,height:8,borderRadius:"50%",border:"1px solid #ffa000",borderTopColor:"transparent",animation:"arcSpin 0.8s linear infinite",flexShrink:0}}/>
                </div>
                <div style={{height:2,background:"rgba(255,160,0,0.15)",borderRadius:1,animation:"pulse 1s ease-in-out infinite"}}/>
              </div>
            ))}
          </div>
          {/* Pipeline status */}
          <div style={{padding:"10px 12px",borderBottom:"1px solid rgba(0,212,255,0.08)",flex:1,overflowY:"auto"}}>
            <div style={{fontSize:7,letterSpacing:2,color:"rgba(0,212,255,0.3)",marginBottom:8}}>CRM STATUS · {fireLog.length}</div>
            {fireLog.length===0&&<div style={{fontSize:8,color:"rgba(0,212,255,0.2)",letterSpacing:1}}>NO CONTACTS YET</div>}
            {[...fireLog].sort((a,b)=>new Date(b.dateFired)-new Date(a.dateFired)).map(e=>{
              const c=SC[e.relationshipStatus||"pending"]||"rgba(0,212,255,0.3)";
              const cuUrl = e.cuUrl || CROSS_SESSION_CONTACTS[e.id]?.cuUrl || null;
              const isFP = e.founderPlay || CROSS_SESSION_CONTACTS[e.id]?.founderPlay || false;
              const displayName = isFP ? `⚡ FP · ${e.name}` : e.name;
              return(
                <div key={e.id} style={{marginBottom:8}}>
                  {cuUrl
                    ? <a href={cuUrl} target="_blank" rel="noreferrer" style={{fontSize:8,fontWeight:700,color:isFP?"#ffa000":"#00d4ff",display:"block",marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textDecoration:"none",cursor:"pointer",letterSpacing:0.5}}
                        title="Open CRM record">{displayName} ↗</a>
                    : <div style={{fontSize:8,fontWeight:700,color:isFP?"#ffa000":"#e8f4ff",marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{displayName}</div>
                  }
                  <div style={{display:"flex",alignItems:"center",gap:4}}>
                    <div style={{width:5,height:5,borderRadius:"50%",background:c,boxShadow:`0 0 4px ${c}`,flexShrink:0}}/>
                    <span style={{fontSize:7,color:c,letterSpacing:1}}>{(e.relationshipStatus||"pending").toUpperCase()}</span>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Waveform live */}
          <div style={{padding:"10px 12px",borderBottom:"1px solid rgba(0,212,255,0.08)"}}>
            <div style={{fontSize:7,letterSpacing:2,color:"rgba(0,212,255,0.3)",marginBottom:8}}>ACTIVITY</div>
            <Waveform active={running} color="#00d4ff"/>
            <div style={{marginTop:6,fontSize:7,color:running?"#ffa000":"rgba(0,212,255,0.2)",letterSpacing:2,animation:running?"blink 1s step-end infinite":"none"}}>
              {running?"SCANNING...":"STANDBY"}
            </div>
          </div>
          {/* Date */}
          <div style={{padding:"10px 12px",marginTop:"auto"}}>
            <div style={{fontSize:7,letterSpacing:1,color:"rgba(0,212,255,0.2)",marginBottom:2}}>{dateStr}</div>
            <div style={{fontSize:7,letterSpacing:1,color:"rgba(0,212,255,0.15)"}}>v9.0</div>
          </div>
        </div>
      </div>
    </div>
  );
}
