#pragma once

namespace live {

inline constexpr const char* kPage = R"HTML(<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Live Book</title>
<style>
:root{--bg:#ECEFF2;--panel:#fff;--ink:#0E1822;--muted:#566574;--line:#D2D9E0;--soft:#F4F6F8;--bid:#1F62D6;--bidsoft:#D9E6FB;--ask:#C2410C;--asksoft:#FBE2D3;--ok:#0F7B4B;--bad:#B42318;
--mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;--sans:system-ui,-apple-system,"Segoe UI",sans-serif}
@media (prefers-color-scheme:dark){:root{--bg:#091117;--panel:#101B24;--ink:#E5EDF3;--muted:#92A3B2;--line:#213140;--soft:#0C151C;--bid:#6AA8FF;--bidsoft:#15304F;--ask:#FF9B5E;--asksoft:#46230F;--ok:#4FD39A;--bad:#FF8A80;color-scheme:dark}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 var(--sans);padding:24px max(16px,4vw) 48px}
.wrap{max-width:1040px;margin:0 auto;display:flex;flex-direction:column;gap:18px}
h1{font-size:clamp(24px,4vw,38px);line-height:1.08;margin:0;letter-spacing:-.02em}
.sub{color:var(--muted);font-size:14px;max-width:68ch;margin:6px 0 0}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:18px;min-width:0}
.grid{display:grid;grid-template-columns:minmax(0,420px) minmax(0,1fr);gap:20px}
@media(max-width:860px){.grid{grid-template-columns:minmax(0,1fr)}}
.num{font-family:var(--mono);font-variant-numeric:tabular-nums}
.ladder{border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--soft);margin-top:12px}
.lv{display:grid;grid-template-columns:minmax(0,1fr) 110px;height:26px;align-items:center;position:relative;font:13px var(--mono)}
.lv .bar{position:absolute;left:0;top:3px;bottom:3px;border-radius:3px}
.lv.a .bar{background:var(--asksoft)}.lv.b .bar{background:var(--bidsoft)}
.lv .q{position:relative;padding-left:10px}.lv .p{position:relative;text-align:right;padding-right:12px;font-weight:600}
.lv.a .p{color:var(--ask)}.lv.b .p{color:var(--bid)}
.mid{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;padding:8px 12px;background:var(--panel);border-block:1px solid var(--line);font:13px var(--mono)}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.stat{border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:var(--soft)}
.stat dt{font-size:12px;color:var(--muted)}.stat dd{margin:2px 0 0;font:600 20px var(--mono)}
canvas{width:100%;height:150px;display:block}
.dot{display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--muted);margin-right:8px}
.dot.live{background:var(--ok)}.dot.stale{background:var(--bad)}
.note{color:var(--muted);font-size:13px;max-width:78ch}
</style></head><body><div class="wrap">
<header><h1>Live BTC-USD order book</h1>
<p class="sub">A C++ engine rebuilding Coinbase's Level 2 book from the live stream. Python holds the websocket connection and pipes raw messages into the engine, which parses and applies each one.</p></header>
<section class="panel"><div class="grid">
<div><div><span class="dot" id="dot"></span><span id="state">connecting</span></div>
<div class="ladder" id="ladder"></div></div>
<div><h2 style="font-size:15px;margin:0">Mid price, last few minutes</h2><canvas id="spark"></canvas>
<dl class="stats" style="margin:14px 0 0" id="stats"></dl></div></div></section>
<p class="note">Latency is the time the engine spends parsing and applying one message, not network latency. This is Level 2 (totals per price), not order-by-order. The engine is the same one measured on NASDAQ ITCH data, with a text parser in front.</p>
</div><script>
const $=id=>document.getElementById(id),N=15,hist=[];
const lad=$("ladder"),rows={a:[],b:[]};
for(let i=N-1;i>=0;i--){const r=mk("a");rows.a[i]=r;lad.appendChild(r)}
const mid=document.createElement("div");mid.className="mid";mid.innerHTML='<span id="m"></span><span id="sp"></span>';lad.appendChild(mid);
for(let i=0;i<N;i++){const r=mk("b");rows.b[i]=r;lad.appendChild(r)}
function mk(c){const r=document.createElement("div");r.className="lv "+c;r.innerHTML='<div class="q"><span class="bar"></span><span class="n"></span></div><div class="p"></div>';return r}
function fill(r,l,max){const b=r.querySelector(".bar"),n=r.querySelector(".n"),p=r.querySelector(".p");if(!l){b.style.width="0";n.textContent="";p.textContent="";return}
b.style.width=(l[1]/max*100).toFixed(1)+"%";n.textContent=l[1].toFixed(4);p.textContent=l[0]}
const labels=[["Messages","messages"],["Messages / sec","msgs_per_sec"],["Process p50 (ns)","p50_ns"],["Process p99 (ns)","p99_ns"],["Sequence gaps","gaps"],["Crossed-book events","crossed_events"],["Levels tracked","levels"],["Snapshots","snapshots"],["Uptime (s)","uptime_s"]];
$("stats").innerHTML=labels.map(([t,k])=>`<div class="stat"><dt>${t}</dt><dd id="s_${k}">-</dd></div>`).join("");
function spark(){const c=$("spark"),w=c.clientWidth,h=150,d=devicePixelRatio||1;c.width=w*d;c.height=h*d;const x=c.getContext("2d");x.scale(d,d);x.clearRect(0,0,w,h);
if(hist.length<2)return;const lo=Math.min(...hist),hi=Math.max(...hist),sp=hi-lo||1;x.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue("--bid").trim()||"#1F62D6";x.lineWidth=1.5;x.beginPath();
hist.forEach((v,i)=>{const px=i/(hist.length-1)*(w-4)+2,py=h-6-(v-lo)/sp*(h-12);i?x.lineTo(px,py):x.moveTo(px,py)});x.stroke()}
async function tick(){try{const r=await fetch("/book",{cache:"no-store"});const d=await r.json();
const max=Math.max(1e-9,...d.bids.map(l=>l[1]),...d.asks.map(l=>l[1]));
for(let i=0;i<N;i++){fill(rows.b[i],d.bids[i],max);fill(rows.a[i],d.asks[i],max)}
if(d.bids[0]&&d.asks[0]){const b=+d.bids[0][0],a=+d.asks[0][0],m=(a+b)/2;$("m").textContent="mid "+m.toFixed(2);$("sp").textContent="spread "+(a-b).toFixed(2)+" ("+((a-b)/m*1e4).toFixed(2)+" bps)";
if(!hist.length||Date.now()-(hist.t||0)>1000){hist.push(m);hist.t=Date.now();if(hist.length>300)hist.shift()}}
labels.forEach(([t,k])=>{const v=d[k];$("s_"+k).textContent=typeof v==="number"?(k==="msgs_per_sec"||k==="uptime_s"?v.toFixed(1):v.toLocaleString()):v});
const live=d.age_ms<3000;$("dot").className="dot "+(live?"live":"stale");$("state").textContent=live?"live, last message "+d.age_ms+" ms ago":"stale, last message "+(d.age_ms/1000).toFixed(0)+" s ago";spark()}
catch(e){$("dot").className="dot stale";$("state").textContent="engine not reachable"}}
tick();setInterval(tick,250);
</script></body></html>)HTML";

}  // namespace live
