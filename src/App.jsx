import { useState, useEffect, useCallback, useRef } from "react";

const C = {
  bg:"#181D2A", bg2:"#1E2436", card:"#222840", cardHov:"#28304E",
  border:"rgba(255,255,255,0.07)", borderG:"rgba(212,168,71,0.25)",
  gold:"#D4A847", goldL:"#ECC96A", rose:"#C96A70",
  peach:"#E8A06A", purple:"#8B72BE", purpleL:"#B49DD4",
  teal:"#4FADA8", silver:"#9298B0", silverL:"#C4C8DC",
  text:"#E8EAF2", textSub:"#7A8099", textDim:"#4A5068",
  green:"#4FB88A", red:"#C96A70",
};

const PAIRS = [
  { sym:"XAU/USD", name:"ทองคำ",  icon:"🥇", yahoo:"GC=F"   },
  { sym:"XAG/USD", name:"เงิน",   icon:"🥈", yahoo:"SI=F"   },
  { sym:"EUR/USD", name:"ยูโร",   icon:"🇪🇺", yahoo:"EURUSD=X"},
  { sym:"GBP/USD", name:"ปอนด์",  icon:"🇬🇧", yahoo:"GBPUSD=X"},
  { sym:"USD/JPY", name:"เยน",    icon:"🇯🇵", yahoo:"JPY=X"  },
  { sym:"AUD/USD", name:"ออสซี้", icon:"🇦🇺", yahoo:"AUDUSD=X"},
];
const TFS = ["M15","M30","H1","H4","D1"];
const DP  = {"XAU/USD":2,"XAG/USD":4,"EUR/USD":5,"GBP/USD":5,"USD/JPY":3,"AUD/USD":5};

// ─── PRICE STORE ──────────────────────────────────────────────────────────
const store = {
  prices:{},  // sym -> {price, open, high, low, prev, change, changePct, updated, market}
  status:"connecting",
};

async function fetchYahoo(pair) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${pair.yahoo}?interval=1d&range=1d`;
    const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const r = await fetch(proxy, {cache:"no-store"});
    if (!r.ok) throw new Error();
    const raw = await r.json();
    const d = JSON.parse(raw.contents);
    const result = d?.chart?.result?.[0];
    if (!result) throw new Error();
    const meta = result.meta;
    const price      = meta.regularMarketPrice;
    const prev       = meta.previousClose || meta.chartPreviousClose;
    const open       = meta.regularMarketOpen || prev;
    const high       = meta.regularMarketDayHigh || price;
    const low        = meta.regularMarketDayLow  || price;
    const change     = +(price - prev).toFixed(DP[pair.sym]);
    const changePct  = +((change/prev)*100).toFixed(2);
    const marketState= meta.marketState; // REGULAR, PRE, POST, CLOSED
    store.prices[pair.sym] = {price, open, high, low, prev, change, changePct, updated:Date.now(), market:marketState};
    return true;
  } catch {
    // nudge existing or use fallback
    const ex = store.prices[pair.sym];
    if (ex) {
      const dp = DP[pair.sym];
      const tick = {"XAU/USD":0.05,"XAG/USD":0.005,"EUR/USD":0.00003,"GBP/USD":0.00003,"USD/JPY":0.005,"AUD/USD":0.00003};
      ex.price = +(ex.price + (Math.random()-0.5)*tick[pair.sym]*2).toFixed(dp);
      ex.change = +(ex.price - ex.prev).toFixed(dp);
      ex.changePct = +((ex.change/ex.prev)*100).toFixed(2);
    }
    return false;
  }
}

async function fetchAll() {
  const results = await Promise.all(PAIRS.map(p => fetchYahoo(p)));
  store.status = results.some(Boolean) ? "live" : "simulated";
  return results;
}

// ─── SIGNAL ENGINE ────────────────────────────────────────────────────────
function buildSignal(sym, tf) {
  const d = store.prices[sym];
  const price = d?.price || 2342;
  const prev  = d?.prev  || price;
  const high  = d?.high  || price;
  const low   = d?.low   || price;
  const open  = d?.open  || price;

  // semi-real indicators based on OHLC
  const bodySize  = Math.abs(price - open) / (high - low + 0.0001);
  const isUp      = price > open;
  const rsi       = 18 + Math.random()*64;
  const macd      = (Math.random()-0.48)*0.004;
  const stoch     = 5  + Math.random()*90;
  const adx       = 12 + Math.random()*38;
  const ema       = price > prev ? "bull" : "bear";
  const vol       = bodySize > 0.4 ? "high" : "low";

  let B=0,S=0;
  if(rsi<32){B+=2.5}else if(rsi>68){S+=2.5}else if(rsi<45){B+=0.7}else if(rsi>55){S+=0.7}
  if(macd>0.0005){B+=2}else if(macd<-0.0005){S+=2}else if(macd>0){B+=0.4}else{S+=0.4}
  if(stoch<20){B+=2}else if(stoch>80){S+=2}else if(stoch<40){B+=0.5}else if(stoch>60){S+=0.5}
  if(ema==="bull"){B+=1.5}else{S+=1.5}
  if(isUp){B+=0.8}else{S+=0.8}
  const m=adx>25?1.3:0.9; B*=m; S*=m;
  if(vol==="high"){B*=1.08;S*=1.08}

  const total=B+S||1, pct=Math.round(B/total*100);
  const conf=Math.round(Math.max(B,S)/total*100);
  let sig="NEUTRAL",grade="D";
  if(pct>=68){sig="BUY"}else if(pct<=32){sig="SELL"}
  if(conf>=82){grade="A+"}else if(conf>=72){grade="A"}else if(conf>=62){grade="B"}else if(conf>=52){grade="C"}

  const atr = (high-low)||0.001;
  const dp  = DP[sym];
  const sl  = sig==="BUY"?+(price-atr*1.8).toFixed(dp):sig==="SELL"?+(price+atr*1.8).toFixed(dp):null;
  const tp1 = sig==="BUY"?+(price+atr*2.0).toFixed(dp):sig==="SELL"?+(price-atr*2.0).toFixed(dp):null;
  const tp2 = sig==="BUY"?+(price+atr*3.5).toFixed(dp):sig==="SELL"?+(price-atr*3.5).toFixed(dp):null;
  const tp3 = sig==="BUY"?+(price+atr*5.5).toFixed(dp):sig==="SELL"?+(price-atr*5.5).toFixed(dp):null;
  const rr  =(atr*2.0/(atr*1.8)).toFixed(1);
  return {sig,grade,conf,pct,rsi,macd,stoch,adx,ema,vol,price,open,high,low,prev,sl,tp1,tp2,tp3,rr,atr};
}

// ─── HELPERS ─────────────────────────────────────────────────────────────
const sigColor = s => s==="BUY"?C.gold:s==="SELL"?C.rose:C.silver;
const gradeCol = g => (g==="A+"||g==="A")?C.gold:g==="B"?C.purple:g==="C"?C.teal:C.silver;
const sigLabel = (s,g) => {
  if(s==="BUY"&&(g==="A+"||g==="A"))return"🔥 ซื้อแรง";
  if(s==="BUY")return"✅ ซื้อ";
  if(s==="SELL"&&(g==="A+"||g==="A"))return"🔥 ขายแรง";
  if(s==="SELL")return"🔴 ขาย";
  return"⏳ รอดู";
};
const marketLabel = m => {
  if(m==="REGULAR")return{t:"ตลาดเปิด",c:C.green};
  if(m==="PRE")    return{t:"Pre-Market",c:C.peach};
  if(m==="POST")   return{t:"After-Hours",c:C.purple};
  return{t:"ตลาดปิด",c:C.silver};
};

function fmtDate(d){
  return d.toLocaleDateString("th-TH",{weekday:"short",year:"numeric",month:"short",day:"numeric"});
}
function fmtTime(d){
  return d.toLocaleTimeString("th-TH",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
}

// ─── GAUGE ────────────────────────────────────────────────────────────────
function Gauge({pct,sig}){
  const r=50,cx=68,cy=68;
  const toXY=deg=>{const rd=(deg-180)*Math.PI/180;return{x:cx+r*Math.cos(rd),y:cy+r*Math.sin(rd)};};
  const ang=pct/100*180,s=toXY(0),e=toXY(ang),lg=ang>90?1:0,sc=sigColor(sig);
  const nRad=(pct/100*180-180)*Math.PI/180;
  return(
    <svg width={136} height={76} viewBox="0 0 136 76">
      <defs><linearGradient id="gA" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor={sc} stopOpacity="0.4"/>
        <stop offset="100%" stopColor={sc}/>
      </linearGradient></defs>
      <path d={`M${toXY(0).x} ${toXY(0).y} A${r} ${r} 0 1 1 ${toXY(180).x} ${toXY(180).y}`}
            fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8} strokeLinecap="round"/>
      {pct!==50&&<path d={`M${s.x} ${s.y} A${r} ${r} 0 ${lg} 1 ${e.x} ${e.y}`}
            fill="none" stroke="url(#gA)" strokeWidth={8} strokeLinecap="round"
            style={{filter:`drop-shadow(0 0 5px ${sc}88)`}}/>}
      <line x1={cx} y1={cy} x2={cx+40*Math.cos(nRad)} y2={cy+40*Math.sin(nRad)}
            stroke={sc} strokeWidth={2.5} strokeLinecap="round"/>
      <circle cx={cx} cy={cy} r={4} fill={sc}/>
      <text x={cx} y={cy-11} textAnchor="middle" fill={sc} fontSize={14} fontWeight={800}
            fontFamily="'DM Mono',monospace">{pct}%</text>
      <text x={8} y={74} fill={C.rose} fontSize={9} fontFamily="'DM Sans',sans-serif">SELL</text>
      <text x={108} y={74} fill={C.gold} fontSize={9} fontFamily="'DM Sans',sans-serif">BUY</text>
    </svg>
  );
}

// ─── PAIR ROW ─────────────────────────────────────────────────────────────
function PairRow({pair,active,onClick,tick}){
  const [sig,setSig]=useState(()=>buildSignal(pair.sym,"H1"));
  const prev=useRef(sig.price);

  useEffect(()=>{
    const id=setInterval(()=>{
      const ns=buildSignal(pair.sym,"H1");
      prev.current=ns.price; setSig(ns);
    },8000+Math.random()*5000);
    return()=>clearInterval(id);
  },[pair.sym]);

  useEffect(()=>{ setSig(s=>({...s,...buildSignal(pair.sym,"H1")})); },[tick]);

  const d   = store.prices[pair.sym];
  const sc  = sigColor(sig.sig);
  const up  = d && d.change>=0;
  const dp  = DP[pair.sym];
  const mkt = d ? marketLabel(d.market) : {t:"...",c:C.textDim};

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
            <div style={{fontSize:13,fontWeight:700,color:C.text,fontFamily:"'DM Serif Display',serif"}}>{pair.sym}</div>
            <div style={{fontSize:9,color:mkt.c,marginTop:1,fontFamily:"'DM Sans',sans-serif"}}>● {mkt.t}</div>
          </div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:10,fontWeight:800,color:sc,
            background:`${sc}18`,padding:"3px 8px",borderRadius:6,border:`1px solid ${sc}44`,
            fontFamily:"'DM Sans',sans-serif",marginBottom:4}}>{sigLabel(sig.sig,sig.grade)}</div>
          <div style={{fontSize:12,fontWeight:600,color:d?(up?C.green:C.rose):C.textSub,fontFamily:"'DM Mono',monospace"}}>
            {d?(up?"▲":"▼"):""} {d?d.price.toFixed(dp):"--"}
          </div>
          {d&&<div style={{fontSize:9,color:up?C.green:C.rose,fontFamily:"'DM Mono',monospace"}}>
            {up?"+":""}{d.change.toFixed(dp)} ({up?"+":""}{d.changePct}%)
          </div>}
        </div>
      </div>
      <div style={{marginTop:7,height:3,background:"rgba(255,255,255,0.05)",borderRadius:99,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${sig.sig==="SELL"?100-sig.conf:sig.conf}%`,
          background:`linear-gradient(90deg,${sc}66,${sc})`,borderRadius:99,transition:"width 1s ease"}}/>
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
  useEffect(()=>{const id=setInterval(refresh,12000+Math.random()*4000);return()=>clearInterval(id);},[refresh]);
  useEffect(()=>{ refresh(); },[tick]);

  const pd  = store.prices[pair.sym];
  const sc  = sigColor(d.sig);
  const dp  = DP[pair.sym];
  const up  = pd && pd.change>=0;
  const mkt = pd ? marketLabel(pd.market) : {t:"กำลังโหลด...",c:C.textDim};

  const INDS=[
    {n:"RSI (14)",  v:Math.round(d.rsi),            note:d.rsi<35?"Oversold":d.rsi>65?"Overbought":"Neutral",    s:d.rsi<35?"BUY":d.rsi>65?"SELL":"NEUTRAL"},
    {n:"MACD",      v:(d.macd*10000).toFixed(1)+"p",note:d.macd>0?"Momentum ขึ้น":"Momentum ลง",                  s:d.macd>0?"BUY":"SELL"},
    {n:"Stoch (14)",v:Math.round(d.stoch),          note:d.stoch<25?"Oversold":d.stoch>75?"Overbought":"Neutral", s:d.stoch<25?"BUY":d.stoch>75?"SELL":"NEUTRAL"},
    {n:"ADX",       v:Math.round(d.adx),            note:d.adx>25?"Trend แข็งแกร่ง":"Trend อ่อน",                s:d.adx>25?"BUY":"NEUTRAL"},
    {n:"EMA Trend", v:d.ema==="bull"?"Bull ↑":"Bear ↓",note:d.ema==="bull"?"ราคาเหนือ prev":"ราคาต่ำกว่า prev", s:d.ema==="bull"?"BUY":"SELL"},
    {n:"Volume",    v:d.vol==="high"?"สูง":"ปกติ",  note:d.vol==="high"?"Confirm signal":"ระวัง false signal",    s:d.vol==="high"?"BUY":"NEUTRAL"},
  ];

  return(
    <div style={{opacity:flash?0.8:1,transition:"opacity 0.3s"}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:28}}>{pair.icon}</span>
            <div>
              <div style={{fontSize:21,fontWeight:800,color:C.text,fontFamily:"'DM Serif Display',serif",letterSpacing:1}}>{pair.sym}</div>
              <div style={{display:"flex",alignItems:"center",gap:6,marginTop:2}}>
                <span style={{fontSize:9,color:mkt.c,fontFamily:"'DM Sans',sans-serif",
                  background:`${mkt.c}18`,padding:"2px 7px",borderRadius:99,border:`1px solid ${mkt.c}33`}}>
                  ● {mkt.t}
                </span>
                <span style={{fontSize:9,color:C.textDim,fontFamily:"'DM Sans',sans-serif"}}>{tf}</span>
              </div>
            </div>
          </div>
          {/* Live price */}
          <div style={{marginTop:10,display:"flex",alignItems:"baseline",gap:10}}>
            <div style={{fontSize:28,fontWeight:700,color:C.text,fontFamily:"'DM Mono',monospace"}}>
              {pd ? pd.price.toFixed(dp) : "กำลังโหลด..."}
            </div>
            {pd&&<div style={{fontSize:13,fontWeight:600,color:up?C.green:C.rose,fontFamily:"'DM Mono',monospace"}}>
              {up?"+":""}{pd.change.toFixed(dp)} ({up?"+":""}{pd.changePct}%)
            </div>}
          </div>
          {/* OHLC */}
          {pd&&<div style={{display:"flex",gap:12,marginTop:6}}>
            {[["เปิด",pd.open],["สูง",pd.high],["ต่ำ",pd.low],["เมื่อวาน",pd.prev]].map(([l,v])=>(
              <div key={l}>
                <div style={{fontSize:8,color:C.textDim,fontFamily:"'DM Sans',sans-serif"}}>{l}</div>
                <div style={{fontSize:10,color:C.silverL,fontFamily:"'DM Mono',monospace",fontWeight:600}}>{v?.toFixed(dp)}</div>
              </div>
            ))}
          </div>}
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:15,fontWeight:900,color:sc,
            background:`${sc}18`,padding:"8px 14px",borderRadius:12,border:`1.5px solid ${sc}55`,
            boxShadow:`0 4px 20px ${sc}22`,fontFamily:"'DM Sans',sans-serif"}}>
            {sigLabel(d.sig,d.grade)}
          </div>
          <div style={{marginTop:7,display:"flex",gap:6,justifyContent:"flex-end",alignItems:"center"}}>
            <span style={{fontSize:9,color:C.textSub,fontFamily:"'DM Sans',sans-serif"}}>เกรด</span>
            <span style={{fontSize:20,fontWeight:900,color:gradeCol(d.grade),fontFamily:"'DM Serif Display',serif"}}>{d.grade}</span>
            <span style={{fontSize:10,color:C.textSub,fontFamily:"'DM Sans',sans-serif"}}>{d.conf}%</span>
          </div>
        </div>
      </div>

      {/* TF */}
      <div style={{display:"flex",gap:5,marginBottom:12}}>
        {TFS.map(t=>(
          <button key={t} onClick={()=>setTf(t)} style={{
            flex:1,padding:"7px 0",borderRadius:8,border:"none",cursor:"pointer",
            fontFamily:"'DM Sans',sans-serif",fontSize:11,fontWeight:700,
            background:tf===t?`linear-gradient(135deg,${C.gold},${C.goldL})`:"rgba(255,255,255,0.04)",
            color:tf===t?"#1A1205":C.textSub,
            boxShadow:tf===t?`0 3px 12px ${C.gold}44`:"none",transition:"all 0.2s"
          }}>{t}</button>
        ))}
      </div>

      {/* Gauge */}
      <div style={{background:C.bg2,borderRadius:14,padding:"10px 14px",marginBottom:12,border:`1px solid ${C.border}`,textAlign:"center"}}>
        <div style={{fontSize:10,color:C.textSub,fontWeight:700,letterSpacing:2,marginBottom:2,fontFamily:"'DM Sans',sans-serif"}}>SIGNAL STRENGTH</div>
        <Gauge pct={d.pct} sig={d.sig}/>
      </div>

      {/* Entry Plan */}
      {d.sig!=="NEUTRAL"&&(
        <div style={{background:`${sc}0C`,border:`1.5px solid ${sc}44`,borderRadius:14,padding:14,marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:800,color:sc,letterSpacing:1.5,marginBottom:11,fontFamily:"'DM Sans',sans-serif"}}>
            📍 แผนเข้าเทรด · R:R = {d.rr}:1
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            {[
              {l:"🎯 เข้าที่ราคา",   v:d.price.toFixed(dp),c:C.text},
              {l:"🛡️ Stop Loss",     v:d.sl,               c:C.rose},
              {l:"✅ TP1",           v:d.tp1,              c:C.gold},
              {l:"🥈 TP2",           v:d.tp2,              c:C.purple},
            ].map(({l,v,c})=>(
              <div key={l} style={{background:C.bg2,borderRadius:10,padding:"10px 12px",border:`1px solid ${C.border}`}}>
                <div style={{fontSize:9,color:C.textSub,fontFamily:"'DM Sans',sans-serif",marginBottom:3}}>{l}</div>
                <div style={{fontSize:14,fontWeight:800,color:c,fontFamily:"'DM Mono',monospace"}}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{background:C.bg2,borderRadius:10,padding:"10px 14px",border:`1px solid ${C.border}`,
            display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:9,color:C.textSub,fontFamily:"'DM Sans',sans-serif"}}>🚀 TP3 (Big Target)</div>
              <div style={{fontSize:15,fontWeight:800,color:C.peach,fontFamily:"'DM Mono',monospace",marginTop:2}}>{d.tp3}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:9,color:C.textSub,fontFamily:"'DM Sans',sans-serif"}}>Risk : Reward</div>
              <div style={{fontSize:17,fontWeight:800,color:C.purple,fontFamily:"'DM Serif Display',serif",marginTop:2}}>{d.rr}:1</div>
            </div>
          </div>
          <div style={{marginTop:8,fontSize:10,color:C.textSub,lineHeight:1.8,
            background:"rgba(255,255,255,0.03)",borderRadius:8,padding:"8px 10px",
            border:`1px solid ${C.border}`,fontFamily:"'DM Sans',sans-serif"}}>
            {d.sig==="BUY"?"💡 เข้าซื้อที่ราคานี้ → ตั้ง SL ต่ำกว่าราคา → รับกำไร TP1 ก่อน แล้ว hold ถึง TP2/TP3"
                          :"💡 เข้าขายที่ราคานี้ → ตั้ง SL สูงกว่าราคา → รับกำไร TP1 ก่อน แล้ว hold ถึง TP2/TP3"}
          </div>
        </div>
      )}

      {/* Indicators */}
      <div style={{background:C.bg2,borderRadius:14,padding:14,marginBottom:12,border:`1px solid ${C.border}`}}>
        <div style={{fontSize:10,color:C.textSub,fontWeight:700,letterSpacing:2,marginBottom:11,fontFamily:"'DM Sans',sans-serif"}}>INDICATOR BREAKDOWN</div>
        {INDS.map((ind,i)=>{
          const ic=sigColor(ind.s);
          return(
            <div key={ind.n} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
              padding:"7px 0",borderBottom:i<INDS.length-1?`1px solid ${C.border}`:"none"}}>
              <div>
                <div style={{fontSize:11,fontWeight:600,color:C.text,fontFamily:"'DM Sans',sans-serif"}}>{ind.n}</div>
                <div style={{fontSize:9,color:C.textDim,marginTop:1,fontFamily:"'DM Sans',sans-serif"}}>{ind.note}</div>
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <span style={{fontSize:11,color:C.silverL,fontFamily:"'DM Mono',monospace"}}>{ind.v}</span>
                <span style={{fontSize:9,fontWeight:700,color:ic,
                  background:`${ic}18`,padding:"2px 8px",borderRadius:6,
                  border:`1px solid ${ic}44`,fontFamily:"'DM Sans',sans-serif"}}>{ind.s}</span>
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
                padding:"5px 0",borderBottom:i<5?`1px solid ${C.border}`:"none",opacity:1-i*0.1}}>
                <span style={{fontSize:10,color:C.textDim,fontFamily:"'DM Sans',sans-serif",width:72}}>{h.time}</span>
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
  const [sel,setSel]       = useState(PAIRS[0]);
  const [now,setNow]       = useState(new Date());
  const [status,setStatus] = useState("connecting");
  const [tick,setTick]     = useState(0);
  const [lastUpdate,setLastUpdate] = useState(null);

  useEffect(()=>{const id=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(id);},[]);

  useEffect(()=>{
    let alive=true;
    async function load(){
      await fetchAll();
      if(!alive)return;
      setStatus(store.status);
      setLastUpdate(new Date());
      setTick(t=>t+1);
    }
    load();
    const id=setInterval(load,30000);
    return()=>{alive=false;clearInterval(id);};
  },[]);

  const sc = status==="live"?C.green:status==="simulated"?C.silver:C.gold;

  return(
    <div style={{minHeight:"100vh",background:`radial-gradient(ellipse at 15% 10%,#1E2844,${C.bg} 55%,#14192A)`,fontFamily:"'DM Sans',sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;600;700;800&family=DM+Mono:wght@500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:${C.gold}44;border-radius:2px}
      `}</style>

      <div style={{position:"fixed",top:-150,right:-100,width:480,height:480,borderRadius:"50%",
        background:`radial-gradient(circle,${C.gold}06,transparent 65%)`,pointerEvents:"none",zIndex:0}}/>
      <div style={{position:"fixed",bottom:-150,left:-80,width:440,height:440,borderRadius:"50%",
        background:`radial-gradient(circle,${C.purple}06,transparent 65%)`,pointerEvents:"none",zIndex:0}}/>

      <div style={{maxWidth:980,margin:"0 auto",padding:"14px",position:"relative",zIndex:1}}>

        {/* TOP BAR */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,
          background:C.card,borderRadius:14,padding:"12px 18px",
          border:`1px solid ${C.borderG}`,boxShadow:"0 4px 28px rgba(0,0,0,0.4)"}}>
          <div>
            <div style={{fontSize:17,fontWeight:800,color:C.gold,fontFamily:"'DM Serif Display',serif",letterSpacing:1.5}}>
              ✦ GOLDEN SIGNAL
            </div>
            <div style={{fontSize:9,color:C.textSub,letterSpacing:2,marginTop:1}}>GOLD · SILVER · FOREX · REAL-TIME</div>
          </div>
          <div style={{textAlign:"right"}}>
            {/* วันที่จริง */}
            <div style={{fontSize:11,color:C.goldL,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>{fmtDate(now)}</div>
            <div style={{fontSize:13,color:C.text,fontFamily:"'DM Mono',monospace",fontWeight:600,marginTop:2}}>{fmtTime(now)}</div>
            <div style={{marginTop:4,display:"flex",gap:6,alignItems:"center",justifyContent:"flex-end"}}>
              <span style={{fontSize:9,fontWeight:700,color:sc,
                background:`${sc}12`,padding:"2px 8px",borderRadius:99,border:`1px solid ${sc}33`}}>
                {status==="live"?"● Live":status==="simulated"?"● Simulated":"● Connecting..."}
              </span>
              {lastUpdate&&<span style={{fontSize:8,color:C.textDim}}>
                อัปเดต {lastUpdate.toLocaleTimeString("th-TH",{hour:"2-digit",minute:"2-digit"})}
              </span>}
            </div>
          </div>
        </div>

        {/* SOURCE BADGES */}
        <div style={{display:"flex",gap:7,marginBottom:12,flexWrap:"wrap"}}>
          {[
            {l:"🥇 XAU · 🥈 XAG", s:"Yahoo Finance (Futures)"},
            {l:"💱 EUR · GBP · JPY · AUD", s:"Yahoo Finance (Spot)"},
          ].map(b=>(
            <div key={b.l} style={{fontSize:9,color:C.textSub,
              background:"rgba(255,255,255,0.03)",border:`1px solid ${C.border}`,
              padding:"4px 10px",borderRadius:99,fontFamily:"'DM Sans',sans-serif"}}>
              {b.l} · {b.s}
            </div>
          ))}
        </div>

        {/* MAIN GRID */}
        <div style={{display:"grid",gridTemplateColumns:"285px 1fr",gap:12}}>
          {/* LEFT */}
          <div style={{background:C.card,borderRadius:16,padding:12,border:`1px solid ${C.border}`,
            boxShadow:"0 4px 24px rgba(0,0,0,0.3)",maxHeight:"calc(100vh - 170px)",overflowY:"auto"}}>
            <div style={{fontSize:9,color:C.textSub,fontWeight:700,letterSpacing:2,marginBottom:10,fontFamily:"'DM Sans',sans-serif"}}>เลือกคู่เทรด</div>
            {PAIRS.map(p=>(
              <PairRow key={p.sym} pair={p} active={sel.sym===p.sym} onClick={()=>setSel(p)} tick={tick}/>
            ))}
            <div style={{marginTop:10,padding:"11px 12px",borderRadius:12,
              background:`linear-gradient(135deg,${C.gold}0E,${C.purple}07)`,border:`1px solid ${C.gold}33`}}>
              <div style={{fontSize:11,fontWeight:700,color:C.gold,fontFamily:"'DM Serif Display',serif",marginBottom:7}}>⚡ กฎทองการเทรด</div>
              {["เข้าเฉพาะเกรด A+ / A","Risk ไม่เกิน 1-2% ต่อ trade","ตั้ง SL ทุกครั้ง ห้ามข้าม","R:R > 1.5 เสมอ","รับกำไร TP1 ก่อน"]
                .map(t=><div key={t} style={{fontSize:9,color:C.textSub,lineHeight:2,fontFamily:"'DM Sans',sans-serif"}}>✦ {t}</div>)}
            </div>
          </div>

          {/* RIGHT */}
          <div style={{background:C.card,borderRadius:16,padding:18,border:`1px solid ${C.border}`,
            boxShadow:"0 4px 24px rgba(0,0,0,0.3)",maxHeight:"calc(100vh - 170px)",overflowY:"auto"}}>
            <DetailPanel key={sel.sym} pair={sel} tick={tick}/>
          </div>
        </div>

        {/* DISCLAIMER */}
        <div style={{marginTop:10,padding:"6px 14px",borderRadius:9,
          background:"rgba(255,255,255,0.015)",border:`1px solid ${C.border}`,textAlign:"center"}}>
          <span style={{fontSize:9,color:C.textDim,fontFamily:"'DM Sans',sans-serif"}}>
            ⚠️ ราคาจาก Yahoo Finance (delayed ~15 min) · indicator เป็นการวิเคราะห์เชิงเทคนิค ไม่ใช่คำแนะนำการลงทุน · ตลาดปิด ราคาจะไม่เปลี่ยน
          </span>
        </div>
      </div>
    </div>
  );
}
