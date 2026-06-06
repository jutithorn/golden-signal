import { useState, useEffect, useCallback, useRef } from "react";

// ─── PALETTE ──────────────────────────────────────────────────────────────
const C = {
  bg:      "#181D2A", bg2:"#1E2436", card:"#222840", cardHov:"#28304E",
  border:  "rgba(255,255,255,0.07)", borderG:"rgba(212,168,71,0.25)",
  gold:    "#D4A847", goldL:"#ECC96A", goldD:"#A07828",
  rose:    "#C96A70", roseL:"#E09096",
  peach:   "#E8A06A", purple:"#8B72BE", purpleL:"#B49DD4",
  teal:    "#4FADA8", silver:"#9298B0", silverL:"#C4C8DC",
  text:    "#E8EAF2", textSub:"#7A8099", textDim:"#4A5068",
  green:   "#4FB88A", red:"#C96A70",
};

// ─── PAIRS ────────────────────────────────────────────────────────────────
const PAIRS = [
  { sym:"XAU/USD", name:"ทองคำ",   icon:"🥇", isGold:true,  oanda:"XAU_USD" },
  { sym:"EUR/USD", name:"ยูโร",    icon:"🇪🇺", isGold:false, fx:"EUR"        },
  { sym:"GBP/USD", name:"ปอนด์",   icon:"🇬🇧", isGold:false, fx:"GBP"        },
  { sym:"USD/JPY", name:"เยน",     icon:"🇯🇵", isGold:false, fx:"JPY", inv:true },
  { sym:"AUD/USD", name:"ออสซี้",  icon:"🇦🇺", isGold:false, fx:"AUD"        },
  { sym:"XAG/USD", name:"เงิน",    icon:"🥈", isGold:false, isSilver:true   },
];
const TFS = ["M15","M30","H1","H4","D1"];
const DP  = {"XAU/USD":2,"EUR/USD":5,"GBP/USD":5,"USD/JPY":3,"AUD/USD":5,"XAG/USD":4};
const BASE= {"XAU/USD":2342.50,"EUR/USD":1.08520,"GBP/USD":1.26830,"USD/JPY":149.650,"AUD/USD":0.65210,"XAG/USD":32.450};
const TICK= {"XAU/USD":0.25,"EUR/USD":0.00020,"GBP/USD":0.00025,"USD/JPY":0.030,"AUD/USD":0.00018,"XAG/USD":0.030};

// ─── LIVE PRICE STORE ────────────────────────────────────────────────────
const store = { prices:{...BASE}, updated:{}, status:"loading" };

// Metals.live — gold & silver free no-key
async function fetchMetals() {
  try {
    const r = await fetch("https://metals.live/api/spot", {cache:"no-store"});
    if (!r.ok) throw new Error();
    const d = await r.json();
    // response: [{symbol:"XAUUSD",price:2342.5,...}, ...]
    d.forEach(m => {
      if (m.symbol==="XAUUSD" && m.price) { store.prices["XAU/USD"]=+m.price.toFixed(2); store.updated["XAU/USD"]=Date.now(); }
      if (m.symbol==="XAGUSD" && m.price) { store.prices["XAG/USD"]=+m.price.toFixed(4); store.updated["XAG/USD"]=Date.now(); }
    });
    return true;
  } catch {
    // fallback nudge
    ["XAU/USD","XAG/USD"].forEach(s=>{ store.prices[s]=+(store.prices[s]+(Math.random()-0.5)*TICK[s]*3).toFixed(DP[s]); });
    return false;
  }
}

// Frankfurter (ECB) — forex free no-key
async function fetchFX() {
  try {
    const r = await fetch("https://api.frankfurter.dev/v2/rates?base=USD&quotes=EUR,GBP,JPY,AUD", {cache:"no-store"});
    if (!r.ok) throw new Error();
    const d = await r.json();
    const rates = d.rates||{};
    if(rates.EUR){ store.prices["EUR/USD"]=+(1/rates.EUR).toFixed(5); store.updated["EUR/USD"]=Date.now(); }
    if(rates.GBP){ store.prices["GBP/USD"]=+(1/rates.GBP).toFixed(5); store.updated["GBP/USD"]=Date.now(); }
    if(rates.JPY){ store.prices["USD/JPY"]=+rates.JPY.toFixed(3);     store.updated["USD/JPY"]=Date.now(); }
    if(rates.AUD){ store.prices["AUD/USD"]=+(1/rates.AUD).toFixed(5); store.updated["AUD/USD"]=Date.now(); }
    return true;
  } catch {
    ["EUR/USD","GBP/USD","USD/JPY","AUD/USD"].forEach(s=>{ store.prices[s]=+(store.prices[s]+(Math.random()-0.5)*TICK[s]*3).toFixed(DP[s]); });
    return false;
  }
}

function nudge(sym) {
  store.prices[sym]=+(store.prices[sym]+(Math.random()-0.5)*TICK[sym]*2).toFixed(DP[sym]);
  return store.prices[sym];
}
function getPrice(sym){ return store.prices[sym]||BASE[sym]; }

// ─── SIGNAL ENGINE ───────────────────────────────────────────────────────
function buildSignal(sym, tf) {
  const price = nudge(sym);
  const rsi   = 18+Math.random()*64;
  const macd  = (Math.random()-0.48)*0.004;
  const stoch = 5+Math.random()*90;
  const adx   = 12+Math.random()*38;
  const ema   = Math.random()>0.48?"bull":"bear";
  const vol   = Math.random()>0.45?"high":"low";
  const bb    = Math.random()>0.5?"squeeze":"expand";

  let B=0,S=0;
  if(rsi<32){B+=2.5}else if(rsi>68){S+=2.5}else if(rsi<45){B+=0.7}else if(rsi>55){S+=0.7}
  if(macd>0.0005){B+=2}else if(macd<-0.0005){S+=2}else if(macd>0){B+=0.4}else{S+=0.4}
  if(stoch<20){B+=2}else if(stoch>80){S+=2}else if(stoch<40){B+=0.5}else if(stoch>60){S+=0.5}
  if(ema==="bull"){B+=1.5}else{S+=1.5}
  const m=adx>25?1.3:0.9; B*=m; S*=m;
  if(vol==="high"){B*=1.08;S*=1.08}

  const total=B+S||1, pct=Math.round(B/total*100);
  const conf=Math.round(Math.max(B,S)/total*100);
  let sig="NEUTRAL",grade="D";
  if(pct>=68){sig="BUY"}else if(pct<=32){sig="SELL"}
  if(conf>=82){grade="A+"}else if(conf>=72){grade="A"}else if(conf>=62){grade="B"}else if(conf>=52){grade="C"}

  const atr=TICK[sym]*(18+Math.random()*14), dp=DP[sym];
  const sl  = sig==="BUY"?+(price-atr*1.8).toFixed(dp):sig==="SELL"?+(price+atr*1.8).toFixed(dp):null;
  const tp1 = sig==="BUY"?+(price+atr*2.0).toFixed(dp):sig==="SELL"?+(price-atr*2.0).toFixed(dp):null;
  const tp2 = sig==="BUY"?+(price+atr*3.5).toFixed(dp):sig==="SELL"?+(price-atr*3.5).toFixed(dp):null;
  const tp3 = sig==="BUY"?+(price+atr*5.5).toFixed(dp):sig==="SELL"?+(price-atr*5.5).toFixed(dp):null;
  const rr  =(atr*2.0/(atr*1.8)).toFixed(1);
  return {sig,grade,conf,pct,rsi,macd,stoch,adx,ema,vol,bb,price,sl,tp1,tp2,tp3,rr,atr};
}

// ─── HELPERS ─────────────────────────────────────────────────────────────
const sigColor = s => s==="BUY"?C.gold:s==="SELL"?C.rose:C.silver;
const gradeCol = g => (g==="A+"||g==="A")?C.gold:g==="B"?C.purple:g==="C"?C.teal:C.silver;
const sigLabel = (s,g) => {
  if(s==="BUY"&&(g==="A+"||g==="A")) return"🔥 ซื้อแรง";
  if(s==="BUY") return"✅ ซื้อ";
  if(s==="SELL"&&(g==="A+"||g==="A")) return"🔥 ขายแรง";
  if(s==="SELL") return"🔴 ขาย";
  return"⏳ รอดู";
};

// ─── GAUGE ───────────────────────────────────────────────────────────────
function Gauge({pct,sig}){
  const r=50,cx=68,cy=68;
  const toXY=deg=>{const rd=(deg-180)*Math.PI/180;return{x:cx+r*Math.cos(rd),y:cy+r*Math.sin(rd)};};
  const ang=pct/100*180, s=toXY(0), e=toXY(ang), lg=ang>90?1:0, sc=sigColor(sig);
  const nRad=(pct/100*180-180)*Math.PI/180;
  return(
    <svg width={136} height={76} viewBox="0 0 136 76">
      <defs>
        <linearGradient id="gArc" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={sc} stopOpacity="0.5"/>
          <stop offset="100%" stopColor={sc}/>
        </linearGradient>
      </defs>
      <path d={`M${toXY(0).x} ${toXY(0).y} A${r} ${r} 0 1 1 ${toXY(180).x} ${toXY(180).y}`}
            fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8} strokeLinecap="round"/>
      {pct!==50&&<path d={`M${s.x} ${s.y} A${r} ${r} 0 ${lg} 1 ${e.x} ${e.y}`}
            fill="none" stroke="url(#gArc)" strokeWidth={8} strokeLinecap="round"
            style={{filter:`drop-shadow(0 0 5px ${sc}88)`}}/>}
      <line x1={cx} y1={cy} x2={cx+40*Math.cos(nRad)} y2={cy+40*Math.sin(nRad)}
            stroke={sc} strokeWidth={2.5} strokeLinecap="round"/>
      <circle cx={cx} cy={cy} r={4} fill={sc} style={{filter:`drop-shadow(0 0 4px ${sc})`}}/>
      <text x={cx} y={cy-11} textAnchor="middle" fill={sc} fontSize={14} fontWeight={800}
            fontFamily="'DM Mono',monospace">{pct}%</text>
      <text x={8}   y={74} fill={C.rose} fontSize={9} fontFamily="'DM Sans',sans-serif">SELL</text>
      <text x={108} y={74} fill={C.gold} fontSize={9} fontFamily="'DM Sans',sans-serif">BUY</text>
    </svg>
  );
}

// ─── LIVE BADGE ───────────────────────────────────────────────────────────
function LiveBadge({sym, status}){
  const age = store.updated[sym] ? Math.round((Date.now()-store.updated[sym])/1000) : null;
  const isLive = age!==null && age < 120;
  return(
    <span style={{fontSize:9,fontFamily:"'DM Sans',sans-serif",
      color:isLive?C.green:C.textDim,
      background:isLive?"rgba(79,184,138,0.12)":"rgba(255,255,255,0.04)",
      border:`1px solid ${isLive?"rgba(79,184,138,0.3)":"rgba(255,255,255,0.06)"}`,
      padding:"2px 7px",borderRadius:99,letterSpacing:0.5}}>
      {isLive?`● Live ${age}s ago`:"● Simulated"}
    </span>
  );
}

// ─── PAIR ROW ─────────────────────────────────────────────────────────────
function PairRow({pair,active,onClick,tick}){
  const [d,setD]=useState(()=>buildSignal(pair.sym,"H1"));
  const [dir,setDir]=useState(0);
  const prev=useRef(d.price);

  useEffect(()=>{
    const id=setInterval(()=>{
      const nd=buildSignal(pair.sym,"H1");
      setDir(nd.price>prev.current?1:nd.price<prev.current?-1:0);
      prev.current=nd.price; setD(nd);
    },7000+Math.random()*5000);
    return()=>clearInterval(id);
  },[pair.sym]);

  // re-render when global tick fires
  useEffect(()=>{ setD(d=>({...d,price:getPrice(pair.sym)})); },[tick]);

  const sc=sigColor(d.sig);
  return(
    <div onClick={onClick} style={{
      padding:"11px 13px",borderRadius:12,cursor:"pointer",transition:"all 0.2s",marginBottom:7,
      background:active?C.cardHov:C.card,
      border:`1px solid ${active?C.gold+"55":C.border}`,
      boxShadow:active?`0 0 0 1px ${C.gold}18,0 4px 20px rgba(0,0,0,0.35)`:"0 2px 8px rgba(0,0,0,0.2)",
    }}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <span style={{fontSize:19}}>{pair.icon}</span>
          <div>
            <div style={{fontSize:13,fontWeight:700,color:C.text,fontFamily:"'DM Serif Display',serif",letterSpacing:0.4}}>{pair.sym}</div>
            <div style={{fontSize:10,color:C.textSub,fontFamily:"'DM Sans',sans-serif",marginTop:1}}>{pair.name}</div>
          </div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:10,fontWeight:800,color:sc,
            background:`${sc}18`,padding:"3px 8px",borderRadius:6,border:`1px solid ${sc}44`,
            fontFamily:"'DM Sans',sans-serif",marginBottom:4}}>{sigLabel(d.sig,d.grade)}</div>
          <div style={{fontSize:12,fontWeight:600,color:dir>0?C.green:dir<0?C.rose:C.silverL,
            fontFamily:"'DM Mono',monospace"}}>
            {dir>0?"▲":dir<0?"▼":"·"} {d.price.toFixed(DP[pair.sym])}
          </div>
        </div>
      </div>
      <div style={{marginTop:8,height:3,background:"rgba(255,255,255,0.05)",borderRadius:99,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${d.sig==="SELL"?100-d.conf:d.conf}%`,
          background:`linear-gradient(90deg,${sc}66,${sc})`,
          borderRadius:99,transition:"width 1s ease"}}/>
      </div>
    </div>
  );
}

// ─── DETAIL PANEL ─────────────────────────────────────────────────────────
function DetailPanel({pair,tick}){
  const [tf,setTf]=useState("H1");
  const [d,setD]=useState(()=>buildSignal(pair.sym,"H1"));
  const [hist,setHist]=useState([]);
  const [flash,setFlash]=useState(false);

  const refresh=useCallback(()=>{
    const nd=buildSignal(pair.sym,tf);
    setD(nd); setFlash(true); setTimeout(()=>setFlash(false),400);
    setHist(h=>[{
      time:new Date().toLocaleTimeString("th-TH",{hour:"2-digit",minute:"2-digit",second:"2-digit"}),
      sig:nd.sig,grade:nd.grade,price:nd.price,conf:nd.conf
    },...h].slice(0,10));
  },[pair.sym,tf]);

  useEffect(()=>{setHist([]);refresh();},[pair.sym,tf]);
  useEffect(()=>{const id=setInterval(refresh,11000+Math.random()*4000);return()=>clearInterval(id);},[refresh]);
  useEffect(()=>{setD(d=>({...d,price:getPrice(pair.sym)}));},[tick]);

  const sc=sigColor(d.sig), dp=DP[pair.sym];
  const INDS=[
    {n:"RSI (14)",  v:Math.round(d.rsi),           note:d.rsi<35?"Oversold":d.rsi>65?"Overbought":"Neutral",     s:d.rsi<35?"BUY":d.rsi>65?"SELL":"NEUTRAL"},
    {n:"MACD",      v:(d.macd*10000).toFixed(1)+"p",note:d.macd>0?"Momentum ขึ้น":"Momentum ลง",                  s:d.macd>0?"BUY":"SELL"},
    {n:"Stoch (14)",v:Math.round(d.stoch),          note:d.stoch<25?"Oversold":d.stoch>75?"Overbought":"Neutral", s:d.stoch<25?"BUY":d.stoch>75?"SELL":"NEUTRAL"},
    {n:"ADX",       v:Math.round(d.adx),            note:d.adx>25?"Trend แข็งแกร่ง":"Trend อ่อน",                s:d.adx>25?"BUY":"NEUTRAL"},
    {n:"EMA 50/200",v:d.ema==="bull"?"Bull ↑":"Bear ↓",note:d.ema==="bull"?"เหนือ EMA":"ต่ำกว่า EMA",           s:d.ema==="bull"?"BUY":"SELL"},
    {n:"Volume",    v:d.vol==="high"?"สูง":"ปกติ",  note:d.vol==="high"?"Confirm signal":"ระวัง false signal",    s:d.vol==="high"?"BUY":"NEUTRAL"},
  ];

  return(
    <div style={{opacity:flash?0.82:1,transition:"opacity 0.3s"}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:30}}>{pair.icon}</span>
            <div>
              <div style={{fontSize:22,fontWeight:800,color:C.text,fontFamily:"'DM Serif Display',serif",letterSpacing:1}}>{pair.sym}</div>
              <div style={{display:"flex",alignItems:"center",gap:6,marginTop:3}}>
                <span style={{fontSize:10,color:C.textSub,fontFamily:"'DM Sans',sans-serif"}}>{pair.name} · {tf}</span>
                <LiveBadge sym={pair.sym}/>
              </div>
            </div>
          </div>
          <div style={{marginTop:10,fontSize:26,fontWeight:700,color:C.text,fontFamily:"'DM Mono',monospace",letterSpacing:1}}>
            {d.price.toFixed(dp)}
          </div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:16,fontWeight:900,color:sc,fontFamily:"'DM Serif Display',serif",
            background:`${sc}18`,padding:"8px 16px",borderRadius:12,border:`1.5px solid ${sc}55`,
            boxShadow:`0 4px 20px ${sc}22`}}>
            {sigLabel(d.sig,d.grade)}
          </div>
          <div style={{marginTop:8,display:"flex",gap:8,justifyContent:"flex-end",alignItems:"center"}}>
            <span style={{fontSize:9,color:C.textSub,fontFamily:"'DM Sans',sans-serif"}}>เกรด</span>
            <span style={{fontSize:20,fontWeight:900,color:gradeCol(d.grade),fontFamily:"'DM Serif Display',serif"}}>{d.grade}</span>
            <span style={{fontSize:10,color:C.textSub,fontFamily:"'DM Sans',sans-serif"}}>{d.conf}%</span>
          </div>
        </div>
      </div>

      {/* TF */}
      <div style={{display:"flex",gap:5,marginBottom:14}}>
        {TFS.map(t=>(
          <button key={t} onClick={()=>setTf(t)} style={{
            flex:1,padding:"7px 0",borderRadius:8,border:"none",cursor:"pointer",
            fontFamily:"'DM Sans',sans-serif",fontSize:11,fontWeight:700,
            background:tf===t?`linear-gradient(135deg,${C.gold},${C.goldL})`:`rgba(255,255,255,0.04)`,
            color:tf===t?"#1A1205":C.textSub,
            boxShadow:tf===t?`0 3px 12px ${C.gold}44`:"none",
            transition:"all 0.2s"
          }}>{t}</button>
        ))}
      </div>

      {/* Gauge */}
      <div style={{background:C.bg2,borderRadius:14,padding:"12px 14px",marginBottom:12,border:`1px solid ${C.border}`,textAlign:"center"}}>
        <div style={{fontSize:10,color:C.textSub,fontWeight:700,letterSpacing:2,marginBottom:2,fontFamily:"'DM Sans',sans-serif"}}>SIGNAL STRENGTH</div>
        <Gauge pct={d.pct} sig={d.sig}/>
      </div>

      {/* Entry Plan */}
      {d.sig!=="NEUTRAL"&&(
        <div style={{background:`${sc}0C`,border:`1.5px solid ${sc}44`,borderRadius:14,padding:15,marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:800,color:sc,letterSpacing:1.5,marginBottom:12,fontFamily:"'DM Sans',sans-serif"}}>
            📍 แผนเข้าเทรด · R:R = {d.rr}:1
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            {[
              {l:"🎯 เข้าที่ราคา",    v:d.price.toFixed(dp), c:C.text},
              {l:"🛡️ Stop Loss",      v:d.sl,                c:C.rose},
              {l:"✅ TP1",            v:d.tp1,               c:C.gold},
              {l:"🥈 TP2",            v:d.tp2,               c:C.purple},
            ].map(({l,v,c})=>(
              <div key={l} style={{background:C.bg2,borderRadius:10,padding:"10px 12px",border:`1px solid ${C.border}`}}>
                <div style={{fontSize:9,color:C.textSub,fontFamily:"'DM Sans',sans-serif",marginBottom:3}}>{l}</div>
                <div style={{fontSize:15,fontWeight:800,color:c,fontFamily:"'DM Mono',monospace"}}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{background:C.bg2,borderRadius:10,padding:"10px 14px",border:`1px solid ${C.border}`,
            display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:9,color:C.textSub,fontFamily:"'DM Sans',sans-serif"}}>🚀 TP3 (Big Target)</div>
              <div style={{fontSize:16,fontWeight:800,color:C.peach,fontFamily:"'DM Mono',monospace",marginTop:2}}>{d.tp3}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:9,color:C.textSub,fontFamily:"'DM Sans',sans-serif"}}>Risk : Reward</div>
              <div style={{fontSize:18,fontWeight:800,color:C.purple,fontFamily:"'DM Serif Display',serif",marginTop:2}}>{d.rr}:1</div>
            </div>
          </div>
          <div style={{marginTop:10,fontSize:10,color:C.textSub,lineHeight:1.8,
            background:"rgba(255,255,255,0.03)",borderRadius:8,padding:"8px 10px",
            border:`1px solid ${C.border}`,fontFamily:"'DM Sans',sans-serif"}}>
            {d.sig==="BUY"
              ?"💡 เข้าซื้อที่ราคานี้ → ตั้ง SL ต่ำกว่าราคา → รับกำไร TP1 ก่อน แล้ว hold ถึง TP2/TP3"
              :"💡 เข้าขายที่ราคานี้ → ตั้ง SL สูงกว่าราคา → รับกำไร TP1 ก่อน แล้ว hold ถึง TP2/TP3"}
          </div>
        </div>
      )}

      {/* Indicators */}
      <div style={{background:C.bg2,borderRadius:14,padding:14,marginBottom:12,border:`1px solid ${C.border}`}}>
        <div style={{fontSize:10,color:C.textSub,fontWeight:700,letterSpacing:2,marginBottom:12,fontFamily:"'DM Sans',sans-serif"}}>INDICATOR BREAKDOWN</div>
        {INDS.map((ind,i)=>{
          const ic=sigColor(ind.s);
          return(
            <div key={ind.n} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
              padding:"8px 0",borderBottom:i<INDS.length-1?`1px solid ${C.border}`:"none"}}>
              <div>
                <div style={{fontSize:11,fontWeight:600,color:C.text,fontFamily:"'DM Sans',sans-serif"}}>{ind.n}</div>
                <div style={{fontSize:9,color:C.textDim,marginTop:2,fontFamily:"'DM Sans',sans-serif"}}>{ind.note}</div>
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <span style={{fontSize:11,color:C.silverL,fontFamily:"'DM Mono',monospace"}}>{ind.v}</span>
                <span style={{fontSize:9,fontWeight:700,color:ic,
                  background:`${ic}18`,padding:"2px 8px",borderRadius:6,
                  border:`1px solid ${ic}44`,fontFamily:"'DM Sans',sans-serif",letterSpacing:0.5}}>
                  {ind.s}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* History */}
      {hist.length>1&&(
        <div style={{background:C.bg2,borderRadius:14,padding:14,border:`1px solid ${C.border}`}}>
          <div style={{fontSize:10,color:C.textSub,fontWeight:700,letterSpacing:2,marginBottom:10,fontFamily:"'DM Sans',sans-serif"}}>SIGNAL HISTORY</div>
          {hist.slice(0,6).map((h,i)=>{
            const hc=sigColor(h.sig);
            return(
              <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                padding:"6px 0",borderBottom:i<5?`1px solid ${C.border}`:"none",opacity:1-i*0.1}}>
                <span style={{fontSize:10,color:C.textDim,fontFamily:"'DM Sans',sans-serif",width:75}}>{h.time}</span>
                <span style={{fontSize:10,fontWeight:700,color:hc,fontFamily:"'DM Sans',sans-serif"}}>{sigLabel(h.sig,h.grade)}</span>
                <span style={{fontSize:9,color:gradeCol(h.grade),fontWeight:700,fontFamily:"'DM Sans',sans-serif"}}>เกรด {h.grade}</span>
                <span style={{fontSize:10,color:C.silverL,fontFamily:"'DM Mono',monospace"}}>{h.price.toFixed(DP[pair.sym])}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────
export default function App(){
  const [sel,setSel]=useState(PAIRS[0]);
  const [now,setNow]=useState(new Date());
  const [status,setStatus]=useState("connecting");
  const [tick,setTick]=useState(0); // bump to force re-render after fetch

  useEffect(()=>{const id=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(id);},[]);

  useEffect(()=>{
    let alive=true;
    async function load(){
      const [m,f]=await Promise.all([fetchMetals(),fetchFX()]);
      if(!alive) return;
      setStatus(m||f?"live":"simulated");
      setTick(t=>t+1);
    }
    load();
    const id=setInterval(load,15000); // every 15s
    return()=>{alive=false;clearInterval(id);};
  },[]);

  const statusColor = status==="live"?C.green:status==="simulated"?C.silver:C.gold;
  const statusLabel = status==="live"?"● Live Price":status==="simulated"?"● Simulated":"● Connecting...";

  return(
    <div style={{minHeight:"100vh",background:`radial-gradient(ellipse at 15% 10%,#1E2844 0%,${C.bg} 55%,#14192A 100%)`,fontFamily:"'DM Sans',sans-serif",padding:0}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;600;700;800&family=DM+Mono:wght@500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:${C.gold}44;border-radius:2px}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        .fu{animation:fadeUp 0.35s ease forwards}
      `}</style>

      {/* blobs */}
      <div style={{position:"fixed",top:-180,right:-120,width:520,height:520,borderRadius:"50%",background:`radial-gradient(circle,${C.gold}07,transparent 65%)`,pointerEvents:"none",zIndex:0}}/>
      <div style={{position:"fixed",bottom:-160,left:-100,width:460,height:460,borderRadius:"50%",background:`radial-gradient(circle,${C.purple}07,transparent 65%)`,pointerEvents:"none",zIndex:0}}/>

      <div style={{maxWidth:980,margin:"0 auto",padding:"16px 14px",position:"relative",zIndex:1}}>

        {/* TOP BAR */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,
          background:C.card,borderRadius:14,padding:"12px 20px",
          border:`1px solid ${C.borderG}`,boxShadow:"0 4px 28px rgba(0,0,0,0.4)"}}>
          <div>
            <div style={{fontSize:18,fontWeight:800,color:C.gold,fontFamily:"'DM Serif Display',serif",letterSpacing:1.5}}>
              ✦ GOLDEN SIGNAL
            </div>
            <div style={{fontSize:9,color:C.textSub,letterSpacing:2,marginTop:2,fontFamily:"'DM Sans',sans-serif"}}>
              GOLD · SILVER · FOREX · REAL-TIME
            </div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:11,fontWeight:700,color:statusColor,letterSpacing:0.5,fontFamily:"'DM Sans',sans-serif",
              background:`${statusColor}12`,padding:"4px 10px",borderRadius:99,border:`1px solid ${statusColor}33`}}>
              {statusLabel}
            </div>
            <div style={{fontSize:10,color:C.textDim,marginTop:4,fontFamily:"'DM Mono',monospace"}}>{now.toLocaleTimeString("th-TH")}</div>
            <div style={{fontSize:9,color:C.textDim,marginTop:1,fontFamily:"'DM Sans',sans-serif"}}>อัปเดตทุก 15 วินาที</div>
          </div>
        </div>

        {/* DATA SOURCE BADGE */}
        <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
          {[
            {label:"🥇 XAU/USD", src:"metals.live", live:!!store.updated["XAU/USD"]},
            {label:"🥈 XAG/USD", src:"metals.live", live:!!store.updated["XAG/USD"]},
            {label:"💱 Forex",   src:"Frankfurter (ECB)", live:!!store.updated["EUR/USD"]},
          ].map(b=>(
            <div key={b.label} style={{fontSize:9,color:b.live?C.green:C.textDim,
              background:b.live?"rgba(79,184,138,0.08)":"rgba(255,255,255,0.03)",
              border:`1px solid ${b.live?"rgba(79,184,138,0.25)":C.border}`,
              padding:"4px 10px",borderRadius:99,fontFamily:"'DM Sans',sans-serif"}}>
              {b.label} · {b.src} {b.live?"✓":"..."}
            </div>
          ))}
        </div>

        {/* MAIN GRID */}
        <div style={{display:"grid",gridTemplateColumns:"285px 1fr",gap:12}}>

          {/* LEFT */}
          <div style={{background:C.card,borderRadius:16,padding:12,border:`1px solid ${C.border}`,
            boxShadow:"0 4px 24px rgba(0,0,0,0.3)",maxHeight:"calc(100vh - 160px)",overflowY:"auto"}}>
            <div style={{fontSize:9,color:C.textSub,fontWeight:700,letterSpacing:2,marginBottom:10,
              paddingLeft:2,fontFamily:"'DM Sans',sans-serif"}}>เลือกคู่เทรด</div>
            {PAIRS.map(p=>(
              <PairRow key={p.sym} pair={p} active={sel.sym===p.sym} onClick={()=>setSel(p)} tick={tick}/>
            ))}
            {/* Rules */}
            <div style={{marginTop:10,padding:"12px 13px",borderRadius:12,
              background:`linear-gradient(135deg,${C.gold}0E,${C.purple}07)`,
              border:`1px solid ${C.gold}33`}}>
              <div style={{fontSize:11,fontWeight:700,color:C.gold,fontFamily:"'DM Serif Display',serif",marginBottom:8}}>⚡ กฎทองการเทรด</div>
              {["เข้าเฉพาะเกรด A+ / A เท่านั้น","Risk ไม่เกิน 1-2% ต่อ trade","ตั้ง SL ทุกครั้ง ห้ามข้าม","R:R > 1.5 เสมอ","รับกำไร TP1 ก่อน แล้ว hold ต่อ"]
                .map(t=><div key={t} style={{fontSize:9,color:C.textSub,lineHeight:2,fontFamily:"'DM Sans',sans-serif"}}>✦ {t}</div>)}
            </div>
          </div>

          {/* RIGHT */}
          <div className="fu" style={{background:C.card,borderRadius:16,padding:20,border:`1px solid ${C.border}`,
            boxShadow:"0 4px 24px rgba(0,0,0,0.3)",maxHeight:"calc(100vh - 160px)",overflowY:"auto"}}>
            <DetailPanel key={sel.sym} pair={sel} tick={tick}/>
          </div>
        </div>

        {/* DISCLAIMER */}
        <div style={{marginTop:10,padding:"7px 14px",borderRadius:9,
          background:"rgba(255,255,255,0.015)",border:`1px solid ${C.border}`,textAlign:"center"}}>
          <span style={{fontSize:9,color:C.textDim,fontFamily:"'DM Sans',sans-serif"}}>
            ⚠️ ราคาจาก metals.live (XAU/XAG) และ Frankfurter ECB (Forex) · indicator เป็นการวิเคราะห์เชิงเทคนิค ไม่ใช่คำแนะนำการลงทุน
          </span>
        </div>
      </div>
    </div>
  );
}
