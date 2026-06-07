import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

const PAIRS = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CHF'];
const API = '';
const isJPY = (pair) => pair.includes('JPY');

const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=JetBrains+Mono:wght@300;400;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #050508; overflow-x: hidden; }
    ::-webkit-scrollbar { width: 2px; }
    ::-webkit-scrollbar-track { background: #050508; }
    ::-webkit-scrollbar-thumb { background: #00FF9D; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
    @keyframes glow { 0%,100%{box-shadow:0 0 20px #00FF9D22} 50%{box-shadow:0 0 40px #00FF9D55} }
    @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
    @keyframes ticker { 0%{transform:translateX(100%)} 100%{transform:translateX(-100%)} }
    @keyframes logoReveal { 0%{opacity:0;transform:scale(0.8)} 100%{opacity:1;transform:scale(1)} }
    @keyframes lineExpand { 0%{width:0} 100%{width:120px} }
    @keyframes textFade { 0%{opacity:0;transform:translateY(10px)} 100%{opacity:1;transform:translateY(0)} }
    @keyframes progressFill { 0%{width:0%} 100%{width:100%} }
    .fade-up { animation: fadeUp 0.6s ease forwards; }
    .glow-card { animation: glow 3s ease-in-out infinite; }
    .pulse { animation: pulse 2s ease-in-out infinite; }
    .scanline-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,157,0.015) 2px, rgba(0,255,157,0.015) 4px);
      pointer-events: none; z-index: 998;
    }
  `}</style>
);

const SplashScreen = ({ onDone }) => {
  useEffect(() => {
    const timer = setTimeout(onDone, 3000);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: '#050508', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', zIndex: 9999,
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      <div style={{
        border: '2px solid #00FF9D', padding: '30px 40px',
        textAlign: 'center', animation: 'logoReveal 0.8s ease forwards',
        position: 'relative',
      }}>
        {['topLeft','topRight','bottomLeft','bottomRight'].map(pos => (
          <div key={pos} style={{
            position: 'absolute', width: '12px', height: '12px',
            borderTop: pos.includes('top') ? '3px solid #00FF9D' : 'none',
            borderBottom: pos.includes('bottom') ? '3px solid #00FF9D' : 'none',
            borderLeft: pos.includes('Left') ? '3px solid #00FF9D' : 'none',
            borderRight: pos.includes('Right') ? '3px solid #00FF9D' : 'none',
            top: pos.includes('top') ? -3 : 'auto',
            bottom: pos.includes('bottom') ? -3 : 'auto',
            left: pos.includes('Left') ? -3 : 'auto',
            right: pos.includes('Right') ? -3 : 'auto',
          }} />
        ))}
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '80px', color: '#00FF9D', lineHeight: '1', letterSpacing: '8px' }}>TRADE</div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '80px', color: '#fff', lineHeight: '1', letterSpacing: '8px' }}>ORACLE</div>
        <div style={{ height: '2px', background: '#00FF9D', margin: '16px auto', animation: 'lineExpand 1s ease 0.5s forwards', width: 0 }} />
        <div style={{ fontSize: '10px', color: '#00FF9D88', letterSpacing: '6px', animation: 'textFade 0.8s ease 1s forwards', opacity: 0 }}>AI FOREX SIGNALS</div>
      </div>
      <div style={{ width: '200px', marginTop: '40px' }}>
        <div style={{ fontSize: '9px', color: '#333', letterSpacing: '2px', marginBottom: '8px', textAlign: 'center' }}>INITIALIZING...</div>
        <div style={{ background: '#0a0a0f', height: '2px', overflow: 'hidden' }}>
          <div style={{ height: '100%', background: '#00FF9D', animation: 'progressFill 2.5s ease forwards', width: '0%' }} />
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [pair, setPair] = useState('EUR/USD');
  const [price, setPrice] = useState(null);
  const [prevPrice, setPrevPrice] = useState(null);
  const [signal, setSignal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [candles, setCandles] = useState([]);
  const [rsi, setRsi] = useState(null);
  const [error, setError] = useState(null);
  const [trend, setTrend] = useState(null);
  const [lastSignal, setLastSignal] = useState(null);
  const [notifGranted, setNotifGranted] = useState(false);
  const [signalHistory, setSignalHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('to_signals') || '[]'); } catch { return []; }
  });
  const [usage, setUsage] = useState(null);
  const [signalsToday, setSignalsToday] = useState(0);

  useEffect(() => {
    if ('Notification' in window) {
      Notification.requestPermission().then(p => setNotifGranted(p === 'granted'));
    }
  }, []);

  const fetchUsage = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/usage`);
      setUsage(res.data);
    } catch (err) {
      console.error('Usage fetch failed');
    }
  }, []);

  useEffect(() => {
    fetchUsage();
    const interval = setInterval(fetchUsage, 60000);
    return () => clearInterval(interval);
  }, [fetchUsage]);

  const calculateRSI = (closes) => {
    if (closes.length < 14) return null;
    let gains = 0, losses = 0;
    for (let i = closes.length - 14; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff > 0) gains += diff;
      else losses += Math.abs(diff);
    }
    const rs = (gains / 14) / (losses / 14);
    return Math.round(100 - (100 / (1 + rs)));
  };

  const calculateEMA = (closes, period) => {
  if (closes.length < period) return null;
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < closes.length; i++) ema = closes[i] * k + ema * (1 - k);
  return ema;
};

const chartRef = useRef(null);
const chartContainerRef = useRef(null);
const candleSeriesRef = useRef(null);
const [trend15m, setTrend15m] = useState(null);
  // eslint-disable-next-line
const [trend1h, setTrend1h] = useState(null);

const fetchAndAnalyze = useCallback(async () => {
    setError(null);
    try {
      const res = await axios.get(`${API}/api/price?pair=${encodeURIComponent(pair)}`);
      if (!res.data.values) return;
      const vals = res.data.values.reverse();
      const closes = vals.map(c => parseFloat(c.close));
      const latest = closes[closes.length - 1];
      setPrevPrice(price);
      setPrice(latest);
      setCandles(vals);
      setLastUpdated(new Date().toLocaleTimeString());
      const rsiVal = calculateRSI(closes);
      setRsi(rsiVal);
      const trendDir = latest > closes[0] ? 'UPTREND' : 'DOWNTREND';
      setTrend(trendDir);
      const high = Math.max(...vals.map(c => parseFloat(c.high)));
      const low = Math.min(...vals.map(c => parseFloat(c.low)));
      const decimals = isJPY(pair) ? 3 : 5;

      let t15m = 'NEUTRAL', t1h = 'NEUTRAL', ema10_1h = null;
      try {
        const [res15m, res1h] = await Promise.all([
          axios.get(`${API}/api/price?pair=${encodeURIComponent(pair)}&interval=15min&outputsize=20`),
          axios.get(`${API}/api/price?pair=${encodeURIComponent(pair)}&interval=1h&outputsize=20`)
        ]);
        const closes15m = res15m.data.values ? res15m.data.values.map(c => parseFloat(c.close)).reverse() : [];
        const closes1h = res1h.data.values ? res1h.data.values.map(c => parseFloat(c.close)).reverse() : [];
        t15m = closes15m.length > 1 ? (closes15m[closes15m.length-1] > closes15m[0] ? 'UPTREND' : 'DOWNTREND') : trendDir;
        t1h = closes1h.length > 1 ? (closes1h[closes1h.length-1] > closes1h[0] ? 'UPTREND' : 'DOWNTREND') : trendDir;
        ema10_1h = calculateEMA(closes1h, 10);
      } catch (mtfErr) { t15m = trendDir; t1h = trendDir; }
      setTrend15m(t15m);
      setTrend1h(t1h);

      setLoading(true);
      const sigRes = await axios.post(`${API}/api/signal`, {
        pair, price: latest.toFixed(decimals),
        trend1m: trendDir, trend15m: t15m, trend1h: t1h,
        ema: ema10_1h ? ema10_1h.toFixed(decimals) : 'N/A',
        rsi: rsiVal || 'N/A', high: high.toFixed(decimals),
        low: low.toFixed(decimals),
        closes: closes.slice(-5).map(c => c.toFixed(decimals)).join(', ')
      });
      setSignal(sigRes.data);
      setSignalsToday(s => s + 1);
      if (sigRes.data.signal !== 'WAIT') {
        const newEntry = { id: Date.now(), pair, signal: sigRes.data.signal, entry: sigRes.data.entry, sl: sigRes.data.sl, tp1: sigRes.data.tp1, confidence: sigRes.data.confidence, timestamp: new Date().toISOString(), status: 'open' };
        setSignalHistory(prev => {
          const checked = prev.map(s => {
            if (s.status !== 'open' || s.pair !== pair) return s;
            if (s.signal === 'BUY') { if (latest >= s.tp1) return {...s, status:'win'}; if (latest <= s.sl) return {...s, status:'loss'}; }
            else { if (latest <= s.tp1) return {...s, status:'win'}; if (latest >= s.sl) return {...s, status:'loss'}; }
            return s;
          });
          const updated = [newEntry, ...checked].slice(0, 100);
          localStorage.setItem('to_signals', JSON.stringify(updated));
          return updated;
        });
      }
      if (notifGranted && sigRes.data.signal !== lastSignal && sigRes.data.signal !== 'WAIT') {
        const emoji = sigRes.data.signal === 'BUY' ? '🟢' : '🔴';
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then(reg => {
            reg.showNotification(`${emoji} ${sigRes.data.signal} ${pair}`, {
              body: `Entry: ${sigRes.data.entry} | SL: ${sigRes.data.sl} | TP: ${sigRes.data.tp1} | ${sigRes.data.confidence}% confidence`,
              icon: '/logo192.png',
              badge: '/logo192.png',
              vibrate: [200, 100, 200],
            });
          });
        }
        setLastSignal(sigRes.data.signal);
      }
    } catch (err) {
      setError('FEED ERROR — RETRYING');
    }
    setLoading(false);
  }, [pair, price, notifGranted, lastSignal]);

  useEffect(() => {
    setSignal(null); setPrice(null); setRsi(null); setCandles([]); setTrend(null);
  }, [pair]);



  useEffect(() => {
    fetchAndAnalyze();
    const interval = setInterval(fetchAndAnalyze, 60000);
    return () => clearInterval(interval);
  }, [fetchAndAnalyze]);

  const signalColor = signal?.signal === 'BUY' ? '#00FF9D' : signal?.signal === 'SELL' ? '#FF3B3B' : '#666';
  const priceUp = price > prevPrice;
  const decimals = isJPY(pair) ? 3 : 5;

  const getRSIInfo = () => {
    if (!rsi) return { label: 'N/A', color: '#444' };
    if (rsi >= 70) return { label: `${rsi} OVERBOUGHT`, color: '#FF3B3B' };
    if (rsi <= 30) return { label: `${rsi} OVERSOLD`, color: '#00FF9D' };
    return { label: `${rsi} NEUTRAL`, color: '#888' };
  };
  const rsiInfo = getRSIInfo();

  const cardStyle = {
    background: 'linear-gradient(135deg, #0a0a0f 0%, #0d0d14 100%)',
    border: '1px solid #ffffff08',
    padding: '16px', marginBottom: '10px',
    position: 'relative', overflow: 'hidden',
  };

  const creditsUsed = usage?.current_usage || 0;
  const creditsTotal = usage?.daily_limit || 800;
  const creditsPercent = Math.round((creditsUsed / creditsTotal) * 100);
  const creditsColor = creditsPercent > 80 ? '#FF3B3B' : creditsPercent > 50 ? '#FFD700' : '#00FF9D';

  if (showSplash) return (
    <>
      <GlobalStyles />
      <SplashScreen onDone={() => setShowSplash(false)} />
    </>
  );

  return (
    <div style={{ background: '#050508', minHeight: '100vh', color: '#fff', fontFamily: "'JetBrains Mono', monospace", maxWidth: '480px', margin: '0 auto', position: 'relative' }}>
      <GlobalStyles />
      <div className="scanline-overlay" />

      {/* Top Bar */}
      <div style={{ background: '#00FF9D', padding: '6px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '10px', color: '#000', fontWeight: '700', letterSpacing: '3px' }}>TRADE ORACLE v1.0</div>
        <div style={{ fontSize: '10px', color: '#000', fontWeight: '600' }}>
          {lastUpdated ? `⟳ ${lastUpdated}` : 'CONNECTING...'}
        </div>
      </div>

      {/* Ticker */}
      <div style={{ background: '#0a0a0f', borderBottom: '1px solid #ffffff08', padding: '8px 0', overflow: 'hidden', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'inline-block', animation: 'ticker 20s linear infinite', fontSize: '10px', color: '#00FF9D55', letterSpacing: '2px' }}>
          {PAIRS.map(p => `  ${p}  •  `).join('')}{PAIRS.map(p => `  ${p}  •  `).join('')}
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        {/* Header */}
        <div className="fade-up" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '52px', color: '#00FF9D', lineHeight: '0.9', letterSpacing: '4px' }}>TRADE</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '52px', color: '#fff', lineHeight: '0.9', letterSpacing: '4px' }}>ORACLE</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '9px', color: '#333', letterSpacing: '2px' }}>AI FOREX</div>
            <div style={{ fontSize: '9px', color: '#333', letterSpacing: '2px' }}>SIGNALS</div>
            <div style={{ width: '6px', height: '6px', background: price ? '#00FF9D' : '#FF3B3B', marginLeft: 'auto', marginTop: '6px' }} className={price ? 'pulse' : ''} />
          </div>
        </div>

        {/* Credits Dashboard */}
        <div style={{ ...cardStyle, marginBottom: '10px' }} className="fade-up">
          <div style={{ fontSize: '9px', color: '#333', letterSpacing: '2px', marginBottom: '12px' }}>API CREDITS DASHBOARD</div>
          {(() => { const closed = signalHistory.filter(s => s.status !== 'open'); const wins = closed.filter(s => s.status === 'win').length; const wr = closed.length > 0 ? Math.round((wins/closed.length)*100) : null; return wr !== null ? (
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px', padding:'8px', background: wr>=60?'#00FF9D11':'#FF3B3B11', border:`1px solid ${wr>=60?'#00FF9D33':'#FF3B3B33'}` }}>
              <div style={{ fontSize:'8px', color:'#333', letterSpacing:'1px' }}>WIN RATE <span style={{ fontSize:'9px', color:'#555' }}>({closed.length} signals)</span></div>
              <div style={{ fontSize:'22px', fontWeight:'700', color: wr>=60?'#00FF9D':'#FF3B3B' }}>{wr}%</div>
            </div>
          ) : null; })()}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '8px', color: '#333', letterSpacing: '1px', marginBottom: '4px' }}>USED TODAY</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: creditsColor }}>{creditsUsed}</div>
            </div>
            <div style={{ textAlign: 'center', borderLeft: '1px solid #ffffff08', borderRight: '1px solid #ffffff08' }}>
              <div style={{ fontSize: '8px', color: '#333', letterSpacing: '1px', marginBottom: '4px' }}>DAILY LIMIT</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: '#fff' }}>{creditsTotal}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '8px', color: '#333', letterSpacing: '1px', marginBottom: '4px' }}>SIGNALS</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: '#00FF9D' }}>{signalsToday}</div>
            </div>
          </div>
          <div style={{ fontSize: '8px', color: '#333', letterSpacing: '1px', marginBottom: '6px' }}>
            CREDITS REMAINING: <span style={{ color: creditsColor }}>{creditsTotal - creditsUsed}</span>
          </div>
          <div style={{ background: '#050508', height: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${creditsPercent}%`, height: '100%', background: creditsColor, transition: 'width 0.5s ease' }} />
          </div>
        </div>

        {/* Pair Selector */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', overflowX: 'auto', paddingBottom: '4px' }}>
          {PAIRS.map(p => (
            <button key={p} onClick={() => setPair(p)} style={{
              background: pair === p ? '#00FF9D' : 'transparent',
              color: pair === p ? '#000' : '#333',
              border: `1px solid ${pair === p ? '#00FF9D' : '#ffffff11'}`,
              padding: '6px 12px', fontSize: '10px',
              fontFamily: "'JetBrains Mono', monospace",
              cursor: 'pointer', whiteSpace: 'nowrap',
              fontWeight: pair === p ? '700' : '400',
              letterSpacing: '1px', transition: 'all 0.2s'
            }}>{p}</button>
          ))}
        </div>

        {/* Price + RSI */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
          <div style={cardStyle} className="fade-up">
            <div style={{ position: 'absolute', top: 0, left: 0, width: '3px', height: '100%', background: priceUp ? '#00FF9D' : '#FF3B3B' }} />
            <div style={{ fontSize: '9px', color: '#333', letterSpacing: '2px', marginBottom: '8px', paddingLeft: '8px' }}>LIVE PRICE</div>
            <div style={{ fontSize: '26px', fontWeight: '700', color: price ? (priceUp ? '#00FF9D' : '#FF3B3B') : '#222', paddingLeft: '8px', letterSpacing: '-1px' }}>
              {price ? price.toFixed(decimals) : '-.-----'}
            </div>
            <div style={{ fontSize: '14px', color: price && prevPrice ? (priceUp ? '#00FF9D' : '#FF3B3B') : 'transparent', paddingLeft: '8px', marginTop: '2px' }}>
              {priceUp ? '▲' : '▼'}
            </div>
          </div>

          <div style={cardStyle} className="fade-up">
            <div style={{ position: 'absolute', top: 0, left: 0, width: '3px', height: '100%', background: rsiInfo.color }} />
            <div style={{ fontSize: '9px', color: '#333', letterSpacing: '2px', marginBottom: '8px', paddingLeft: '8px' }}>RSI (14)</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: rsiInfo.color, paddingLeft: '8px', lineHeight: '1.3' }}>{rsiInfo.label}</div>
            <div style={{ fontSize: '9px', color: '#222', paddingLeft: '8px', marginTop: '4px' }}>1MIN CANDLES</div>
          </div>
        </div>

        {/* Market Stats */}
        {candles.length > 0 && (
          <div style={{ ...cardStyle, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0', padding: '0' }} className="fade-up">
            {[
              { label: 'HIGH', value: Math.max(...candles.map(c => parseFloat(c.high))).toFixed(decimals), color: '#00FF9D' },
              { label: 'LOW', value: Math.min(...candles.map(c => parseFloat(c.low))).toFixed(decimals), color: '#FF3B3B' },
              { label: 'CANDLES', value: `${candles.length}×1M`, color: '#fff' },
              { label: 'TREND', value: trend === 'UPTREND' ? '▲ UP' : '▼ DOWN', color: trend === 'UPTREND' ? '#00FF9D' : '#FF3B3B' },
            ].map((item, i) => (
              <div key={item.label} style={{ textAlign: 'center', padding: '10px 4px', borderLeft: i > 0 ? '1px solid #ffffff08' : 'none' }}>
                <div style={{ fontSize: '8px', color: '#333', letterSpacing: '1px', marginBottom: '4px' }}>{item.label}</div>
                <div style={{ fontSize: '11px', fontWeight: '700', color: item.color }}>{item.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* MTF Badges */}
        {(trend15m || trend1h) && (
          <div style={{ display:'flex', gap:'6px', marginBottom:'10px' }}>
            {[
              { label:'1M', value: trend, color: trend==='UPTREND'?'#00FF9D':'#FF3B3B' },
              { label:'15M', value: trend15m, color: trend15m==='UPTREND'?'#00FF9D':'#FF3B3B' },
              { label:'1H', value: trend1h, color: trend1h==='UPTREND'?'#00FF9D':'#FF3B3B' },
            ].map(t => (
              <div key={t.label} style={{ flex:1, padding:'8px', background:'#0a0a0f', border:`1px solid ${t.color}33`, textAlign:'center' }}>
                <div style={{ fontSize:'8px', color:'#333', letterSpacing:'1px', marginBottom:'4px' }}>{t.label}</div>
                <div style={{ fontSize:'9px', fontWeight:'700', color: t.color }}>{t.value ? (t.value==='UPTREND'?'▲ UP':'▼ DOWN') : '...'}</div>
              </div>
            ))}
          </div>
        )}

        {candles.length > 0 && (() => {
          const w = 340, h = 160, pad = 8;
          const highs = candles.map(c => parseFloat(c.high));
          const lows = candles.map(c => parseFloat(c.low));
          const minP = Math.min(...lows), maxP = Math.max(...highs);
          const range = maxP - minP || 0.0001;
          const cw = Math.max((w - pad*2) / candles.length - 1, 1);
          const py = p => h - pad - ((p - minP) / range) * (h - pad*2);
          return (
            <div style={{ marginBottom:'10px', background:'#050508', border:'1px solid #ffffff08', overflow:'hidden' }}>
              <div style={{ fontSize:'9px', color:'#333', letterSpacing:'2px', padding:'8px 12px' }}>LIVE CHART • 1M CANDLES</div>
              <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display:'block' }}>
                {candles.map((c, i) => {
                  const o = parseFloat(c.open), cl = parseFloat(c.close);
                  const hi = parseFloat(c.high), lo = parseFloat(c.low);
                  const x = pad + i * ((w - pad*2) / candles.length);
                  const color = cl >= o ? '#00FF9D' : '#FF3B3B';
                  return (
                    <g key={i}>
                      <line x1={x+cw/2} y1={py(hi)} x2={x+cw/2} y2={py(lo)} stroke={color} strokeWidth="0.5"/>
                      <rect x={x} y={Math.min(py(o),py(cl))} width={cw} height={Math.max(Math.abs(py(o)-py(cl)),1)} fill={color}/>
                    </g>
                  );
                })}
                {signal && signal.signal !== 'WAIT' && [
                  { p: signal.entry, c:'#ffffff88', l:'E' },
                  { p: signal.sl, c:'#FF3B3B', l:'SL' },
                  { p: signal.tp1, c:'#00FF9D', l:'TP1' },
                  { p: signal.tp2, c:'#00FF9D88', l:'TP2' },
                ].map(({p,c,l}) => p && p >= minP && p <= maxP ? (
                  <g key={l}>
                    <line x1={pad} y1={py(p)} x2={w-pad} y2={py(p)} stroke={c} strokeWidth="0.8" strokeDasharray="3,2"/>
                    <text x={w-pad-1} y={py(p)-2} fill={c} fontSize="7" textAnchor="end">{l}</text>
                  </g>
                ) : null)}
              </svg>
            </div>
          );
        })()}

        {/* Signal Card */}
        <div style={{ ...cardStyle, border: `1px solid ${signalColor}44` }} className={signal ? 'glow-card fade-up' : 'fade-up'}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, transparent, ${signalColor}, transparent)` }} />
          <div style={{ position: 'absolute', top: 0, left: 0, width: '3px', height: '100%', background: signalColor }} />
          <div style={{ fontSize: '9px', color: '#333', letterSpacing: '3px', marginBottom: '16px', paddingLeft: '12px' }}>AI SIGNAL ENGINE</div>

          {loading ? (
            <div style={{ color: '#00FF9D', fontSize: '12px', paddingLeft: '12px', letterSpacing: '2px' }} className="pulse">⟳ ANALYZING MARKET DATA...</div>
          ) : error ? (
            <div style={{ color: '#FF3B3B', fontSize: '12px', paddingLeft: '12px' }}>⚠ {error}</div>
          ) : signal ? (
            <>
              <div style={{ paddingLeft: '12px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '72px', color: signalColor, lineHeight: '1', letterSpacing: '6px' }}>{signal.signal}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ fontSize: '9px', color: '#333', letterSpacing: '1px' }}>CONFIDENCE</div>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: signalColor }}>{signal.confidence}%</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: '#ffffff08', marginBottom: '12px' }}>
                {[
                  { label: 'ENTRY', value: signal.entry?.toFixed(decimals), color: '#fff' },
                  { label: 'STOP LOSS', value: signal.sl?.toFixed(decimals), color: '#FF3B3B' },
                  { label: 'TAKE PROFIT 1', value: signal.tp1?.toFixed(decimals), color: '#00FF9D' },
                  { label: 'TAKE PROFIT 2', value: signal.tp2?.toFixed(decimals), color: '#00FF9D' },
                ].map(item => (
                  <div key={item.label} style={{ background: '#0a0a0f', padding: '12px' }}>
                    <div style={{ fontSize: '8px', color: '#333', letterSpacing: '1px', marginBottom: '6px' }}>{item.label}</div>
                    <div style={{ fontSize: '18px', fontWeight: '700', color: item.color, letterSpacing: '-0.5px' }}>{item.value || '---'}</div>
                  </div>
                ))}
              </div>

              <div style={{ paddingLeft: '12px', paddingRight: '12px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '10px', color: '#444' }}>R/R <span style={{ color: '#00FF9D', fontWeight: '700' }}>{signal.rr}</span></div>
                <div style={{ fontSize: '10px', color: '#444' }}>PAIR <span style={{ color: '#fff', fontWeight: '700' }}>{pair}</span></div>
              </div>

              
            {signal.action && (
              <div style={{ margin: '12px', padding: '12px', background: '#00FF9D11', border: '1px solid #00FF9D44', borderLeft: '3px solid #00FF9D' }}>
                <div style={{ fontSize: '8px', color: '#00FF9D', letterSpacing: '2px', marginBottom: '8px' }}>⚡ WHAT TO DO NOW</div>
                <div style={{ fontSize: '13px', color: '#fff', lineHeight: '1.6', fontWeight: '600' }}>{signal.action}</div>
              </div>
            )}
            <div style={{ paddingLeft: '12px', paddingRight: '12px', marginBottom: '12px', fontSize: '10px', color: '#444', lineHeight: '1.5' }}>📊 {signal.reason}</div>
            </>
          ) : (
            <div style={{ color: '#222', fontSize: '12px', paddingLeft: '12px', letterSpacing: '1px' }}>INITIALIZING...</div>
          )}
        </div>

        {/* Refresh Button */}
        <button onClick={fetchAndAnalyze} disabled={loading} style={{
          width: '100%', padding: '16px', background: 'transparent',
          border: `1px solid ${loading ? '#ffffff11' : '#00FF9D44'}`,
          color: loading ? '#333' : '#00FF9D',
          fontSize: '11px', fontFamily: "'JetBrains Mono', monospace",
          cursor: loading ? 'not-allowed' : 'pointer',
          letterSpacing: '4px', marginBottom: '10px', transition: 'all 0.2s'
        }}>
          {loading ? '⟳ ANALYZING...' : '⟳ REFRESH SIGNAL'}
        </button>

        <div style={{ textAlign: 'center', fontSize: '8px', color: '#111', letterSpacing: '2px', marginBottom: '20px' }}>
          TRADE ORACLE • AI SIGNALS • NOT FINANCIAL ADVICE
        </div>
      </div>
    </div>
  );
}
