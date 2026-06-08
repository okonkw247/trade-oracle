import { useState, useEffect, useCallback } from 'react';
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

const [trend15m, setTrend15m] = useState(null);
  // eslint-disable-next-line
const [trend1h, setTrend1h] = useState(null);

const playAlert = (type) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = type === 'BUY' ? 880 : 440;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
  } catch(e) {}
};

const [commentary, setCommentary] = useState('');
  const [sentiment, setSentiment] = useState(null);
  const [showRiskCalc, setShowRiskCalc] = useState(false);
  const [riskBalance, setRiskBalance] = useState('1000');
  const [riskPercent, setRiskPercent] = useState('2');

  const fetchCommentary = async (pair, price, trend1m, trend15m, trend1h, rsi, signal, confidence) => {
    try {
      const res = await axios.post(`${API}/api/commentary`, { pair, price, trend1m, trend15m, trend1h, rsi, signal, confidence });
      if (res.data.commentary) setCommentary(res.data.commentary);
    } catch(e) {}
  };

  const fetchSentiment = async (pair) => {
    try {
      const res = await axios.get(`${API}/api/sentiment?pair=${encodeURIComponent(pair)}`);
      if (res.data.sentiment) setSentiment(res.data);
    } catch(e) {}
  };

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
      fetchCommentary(pair, latest.toFixed(decimals), trendDir, t15m, t1h, rsiVal, sigRes.data.signal, sigRes.data.confidence);
      if (sigRes.data.signal !== 'WAIT' && sigRes.data.signal !== lastSignal && sigRes.data.confidence >= 75) {
        playAlert(sigRes.data.signal);
      }
      if (sigRes.data.signal !== 'WAIT') {
        const newEntry = { id: Date.now(), pair, signal: sigRes.data.signal, entry: sigRes.data.entry, sl: sigRes.data.sl, tp1: sigRes.data.tp1, confidence: sigRes.data.confidence, timestamp: new Date().toISOString(), status: 'open' };
        setSignalHistory(prev => {
          const checked = prev.map(s => {
            if (s.status !== 'open' || s.pair !== pair) return s;
            if (s.signal === 'BUY') { if (latest >= s.tp1) return {...s, status:'win'}; if (latest <= s.sl) return {...s, status:'loss'}; }
            else { if (latest <= s.tp1) return {...s, status:'win'}; if (latest >= s.sl) return {...s, status:'loss'}; }
            return s;
          });
          const lastForPair = checked.find(s => s.pair === pair);
          const fiveMinAgo = Date.now() - 5 * 60 * 1000;
          if (lastForPair && lastForPair.signal === newEntry.signal && new Date(lastForPair.timestamp).getTime() > fiveMinAgo) return checked;
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
    setCommentary(''); setSentiment(null);
    fetchSentiment(pair);
  }, [pair]);



  useEffect(() => {
    fetchAndAnalyze();
    const interval = setInterval(fetchAndAnalyze, 60000);
    return () => clearInterval(interval);
  }, [fetchAndAnalyze]);

  useEffect(() => {
    const pollCandles = async () => {
      try {
        const res = await axios.get(`${API}/api/price?pair=${encodeURIComponent(pair)}`);
        if (!res.data.values) return;
        const vals = res.data.values.reverse();
        setCandles(vals);
        const latest = parseFloat(vals[vals.length - 1].close);
        setPrevPrice(p => p);
        setPrice(latest);
      } catch(e) {}
    };
    const ticker = setInterval(pollCandles, 5000);
    return () => clearInterval(ticker);
  }, [pair]);

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
          const W = 360, H = 210;
          const RPad = 54, BPad = 16, LPad = 4, TPad = 6;
          const cW = W - LPad - RPad, cH = H - TPad - BPad;
          const highs = candles.map(c => parseFloat(c.high));
          const lows = candles.map(c => parseFloat(c.low));
          const rawMin = Math.min(...lows), rawMax = Math.max(...highs);
          const rangePad = (rawMax - rawMin) * 0.15 || 0.0005;
          const minP = rawMin - rangePad, maxP = rawMax + rangePad;
          const range = maxP - minP;
          const py = p => TPad + cH - ((p - minP) / range) * cH;
          const slotW = cW / candles.length;
          const bW = Math.max(slotW * 0.65, 1.5);
          const cx = i => LPad + (i + 0.5) * slotW;
          const dec = pair && pair.includes('JPY') ? 3 : 5;
          const levels = 5;
          const priceTicks = Array.from({length: levels}, (_, i) => minP + (range * i / (levels-1)));
          const timeStep = Math.max(Math.floor(candles.length / 5), 1);
          const sigColor = signal && signal.signal === 'BUY' ? '#00FF9D' : '#FF3B3B';
          const lastIdx = candles.length - 1;
          const lastLo = parseFloat(candles[lastIdx].low);
          const lastHi = parseFloat(candles[lastIdx].high);
          return (
            <div style={{ marginBottom:'10px', background:'#050508', border:'1px solid #ffffff08', borderRadius:'2px', overflow:'hidden' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 10px 2px' }}>
                <div style={{ fontSize:'8px', color:'#333', letterSpacing:'2px' }}>LIVE CHART • 1M</div>
                {signal && signal.signal !== 'WAIT' && (
                  <div style={{ fontSize:'8px', fontWeight:'700', color: sigColor, letterSpacing:'1px' }}>
                    {signal.signal === 'BUY' ? '▲' : '▼'} {signal.signal} @ {signal.entry}
                  </div>
                )}
              </div>
              <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display:'block' }}>
                {/* Grid */}
                {priceTicks.map((p,i) => (
                  <line key={i} x1={LPad} y1={py(p)} x2={W-RPad} y2={py(p)} stroke="#ffffff05" strokeWidth="1"/>
                ))}
                <line x1={W-RPad} y1={TPad} x2={W-RPad} y2={TPad+cH} stroke="#ffffff11" strokeWidth="0.5"/>

                {/* Candles */}
                {candles.map((c,i) => {
                  const o=parseFloat(c.open), cl=parseFloat(c.close);
                  const hi=parseFloat(c.high), lo=parseFloat(c.low);
                  const x=cx(i), col=cl>=o?'#00FF9D':'#FF3B3B';
                  const bTop=Math.min(py(o),py(cl)), bH=Math.max(Math.abs(py(o)-py(cl)),1);
                  return (
                    <g key={i}>
                      <line x1={x} y1={py(hi)} x2={x} y2={py(lo)} stroke={col} strokeWidth="0.7" opacity="0.9"/>
                      <rect x={x-bW/2} y={bTop} width={bW} height={bH} fill={col} opacity="0.95"/>
                    </g>
                  );
                })}

                {/* Signal lines */}
                {signal && signal.signal !== 'WAIT' && [
                  {p:signal.entry, c:'#ffffff55', l:'ENTRY'},
                  {p:signal.sl, c:'#FF3B3B', l:'SL'},
                  {p:signal.tp1, c:'#00FF9D', l:'TP1'},
                  {p:signal.tp2, c:'#00FF9D77', l:'TP2'},
                ].map(({p,c,l}) => p && p>=minP && p<=maxP ? (
                  <g key={l}>
                    <line x1={LPad} y1={py(p)} x2={W-RPad} y2={py(p)} stroke={c} strokeWidth="0.8" strokeDasharray="4,3"/>
                    <rect x={W-RPad+1} y={py(p)-7} width={RPad-2} height={13} fill="#050508"/>
                    <text x={W-RPad+3} y={py(p)+3} fill={c} fontSize="7" fontFamily="monospace">{l}</text>
                    <text x={W-3} y={py(p)+3} fill={c} fontSize="6.5" fontFamily="monospace" textAnchor="end">{typeof p === 'number' ? p.toFixed(dec) : p}</text>
                  </g>
                ) : null)}

                {/* BUY arrow */}
                {signal && signal.signal === 'BUY' && (
                  <g>
                    <polygon points={`${cx(lastIdx)},${py(lastLo)+4} ${cx(lastIdx)-6},${py(lastLo)+14} ${cx(lastIdx)+6},${py(lastLo)+14}`} fill="#00FF9D" opacity="0.9"/>
                    <text x={cx(lastIdx)} y={py(lastLo)+24} fill="#00FF9D" fontSize="6.5" textAnchor="middle" fontWeight="bold" fontFamily="monospace">BUY</text>
                  </g>
                )}

                {/* SELL arrow */}
                {signal && signal.signal === 'SELL' && (
                  <g>
                    <polygon points={`${cx(lastIdx)},${py(lastHi)-4} ${cx(lastIdx)-6},${py(lastHi)-14} ${cx(lastIdx)+6},${py(lastHi)-14}`} fill="#FF3B3B" opacity="0.9"/>
                    <text x={cx(lastIdx)} y={py(lastHi)-17} fill="#FF3B3B" fontSize="6.5" textAnchor="middle" fontWeight="bold" fontFamily="monospace">SELL</text>
                  </g>
                )}

                {/* Price labels */}
                {priceTicks.map((p,i) => (
                  <text key={i} x={W-RPad+3} y={py(p)+3} fill="#444" fontSize="6.5" fontFamily="monospace">{p.toFixed(dec)}</text>
                ))}

                {/* Time labels */}
                {candles.map((c,i) => i % timeStep === 0 ? (
                  <text key={i} x={cx(i)} y={H-2} fill="#2a2a2a" fontSize="6" textAnchor="middle" fontFamily="monospace">
                    {c.datetime ? c.datetime.split(' ')[1]?.substring(0,5) : ''}
                  </text>
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
                  <div style={{ fontSize: '28px', fontWeight: '700', color: signalColor }}>{signal.confidence != null ? `${signal.confidence}%` : signal.signal === 'WAIT' ? '—' : '%'}</div>
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
            {signal.confidence < 75 && (
              <div style={{ margin: '12px', padding: '10px', background: '#FF9B0011', border: '1px solid #FF9B0044', borderLeft: '3px solid #FF9B00' }}>
                <div style={{ fontSize: '9px', color: '#FF9B00', letterSpacing: '2px', marginBottom: '4px' }}>⚠ WEAK SIGNAL</div>
                <div style={{ fontSize: '11px', color: '#FF9B00' }}>Confidence {signal.confidence != null ? `${signal.confidence}%` : signal.signal === 'WAIT' ? '—' : '%'} — Consider skipping this trade</div>
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

        {/* AI Market Commentary */}
        {commentary ? (
          <div style={{ marginBottom:'10px', padding:'14px', background:'#0a0a0f', border:'1px solid #ffffff08', borderLeft:'3px solid #00FF9D' }}>
            <div style={{ fontSize:'8px', color:'#00FF9D', letterSpacing:'2px', marginBottom:'8px' }}>🧠 AI MARKET BRIEF</div>
            <div style={{ fontSize:'12px', color:'#aaa', lineHeight:'1.7' }}>{commentary}</div>
          </div>
        ) : signal && (
          <div style={{ marginBottom:'10px', padding:'12px', background:'#0a0a0f', border:'1px solid #ffffff08' }}>
            <div style={{ fontSize:'8px', color:'#333', letterSpacing:'2px' }}>🧠 AI MARKET BRIEF</div>
            <div style={{ fontSize:'10px', color:'#333', marginTop:'6px' }}>Generating commentary...</div>
          </div>
        )}

        {/* News Sentiment */}
        {sentiment && (
          <div style={{ marginBottom:'10px', padding:'14px', background:'#0a0a0f', border:`1px solid ${sentiment.sentiment==='BULLISH'?'#00FF9D33':sentiment.sentiment==='BEARISH'?'#FF3B3B33':'#ffffff11'}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
              <div style={{ fontSize:'8px', color:'#333', letterSpacing:'2px' }}>📰 MARKET SENTIMENT</div>
              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                <div style={{ fontSize:'10px', fontWeight:'700', color: sentiment.sentiment==='BULLISH'?'#00FF9D':sentiment.sentiment==='BEARISH'?'#FF3B3B':'#888' }}>
                  {sentiment.sentiment==='BULLISH'?'▲':sentiment.sentiment==='BEARISH'?'▼':'●'} {sentiment.sentiment}
                </div>
                <div style={{ fontSize:'18px', fontWeight:'700', color: sentiment.score>=6?'#00FF9D':sentiment.score<=4?'#FF3B3B':'#888' }}>{sentiment.score}/10</div>
              </div>
            </div>
            <div style={{ fontSize:'10px', color:'#555', marginBottom:'8px' }}>{sentiment.summary}</div>
            {sentiment.factors && sentiment.factors.map((f,i) => (
              <div key={i} style={{ fontSize:'9px', color:'#333', marginBottom:'3px' }}>• {f}</div>
            ))}
          </div>
        )}

        {/* Risk Calculator */}
        <div style={{ marginBottom:'10px' }}>
          <button onClick={() => setShowRiskCalc(!showRiskCalc)} style={{ width:'100%', padding:'12px', background:'transparent', border:'1px solid #ffffff11', color:'#555', fontSize:'10px', fontFamily:"'JetBrains Mono', monospace", cursor:'pointer', letterSpacing:'2px', textAlign:'left' }}>
            📐 RISK CALCULATOR {showRiskCalc ? '▲' : '▼'}
          </button>
          {showRiskCalc && signal && signal.signal !== 'WAIT' && (
            <div style={{ padding:'14px', background:'#0a0a0f', border:'1px solid #ffffff08', borderTop:'none' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'14px' }}>
                <div>
                  <div style={{ fontSize:'8px', color:'#333', letterSpacing:'1px', marginBottom:'6px' }}>ACCOUNT BALANCE ($)</div>
                  <input value={riskBalance} onChange={e => setRiskBalance(e.target.value)} style={{ width:'100%', background:'#050508', border:'1px solid #ffffff11', color:'#fff', padding:'8px', fontSize:'12px', fontFamily:"'JetBrains Mono', monospace", boxSizing:'border-box' }} />
                </div>
                <div>
                  <div style={{ fontSize:'8px', color:'#333', letterSpacing:'1px', marginBottom:'6px' }}>RISK %</div>
                  <input value={riskPercent} onChange={e => setRiskPercent(e.target.value)} style={{ width:'100%', background:'#050508', border:'1px solid #ffffff11', color:'#fff', padding:'8px', fontSize:'12px', fontFamily:"'JetBrains Mono', monospace", boxSizing:'border-box' }} />
                </div>
              </div>
              {(() => {
                const bal = parseFloat(riskBalance) || 0;
                const rsk = parseFloat(riskPercent) || 0;
                const pip = pair.includes('JPY') ? 0.01 : 0.0001;
                const slPips = signal.sl ? Math.abs(signal.entry - signal.sl) / pip : 10;
                const riskAmt = bal * (rsk / 100);
                const pipVal = 10;
                const lotSize = riskAmt / (slPips * pipVal);
                const maxLoss = riskAmt;
                const tp1Profit = (Math.abs(signal.tp1 - signal.entry) / pip) * pipVal * lotSize;
                return (
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1px', background:'#ffffff08' }}>
                    {[
                      { label:'LOT SIZE', value: lotSize.toFixed(2), color:'#00FF9D' },
                      { label:'MAX LOSS', value:`$${maxLoss.toFixed(2)}`, color:'#FF3B3B' },
                      { label:'SL PIPS', value: slPips.toFixed(1), color:'#fff' },
                      { label:'TP1 PROFIT', value:`$${tp1Profit.toFixed(2)}`, color:'#00FF9D' },
                    ].map(item => (
                      <div key={item.label} style={{ background:'#050508', padding:'10px' }}>
                        <div style={{ fontSize:'8px', color:'#333', letterSpacing:'1px', marginBottom:'4px' }}>{item.label}</div>
                        <div style={{ fontSize:'16px', fontWeight:'700', color:item.color }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
          {showRiskCalc && (!signal || signal.signal === 'WAIT') && (
            <div style={{ padding:'12px', background:'#0a0a0f', border:'1px solid #ffffff08', borderTop:'none', fontSize:'10px', color:'#333', textAlign:'center' }}>
              Waiting for active signal to calculate risk...
            </div>
          )}
        </div>

        {/* Signal History */}
        {signalHistory.filter(s => s.signal !== 'WAIT').length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '9px', color: '#333', letterSpacing: '2px', marginBottom: '10px' }}>SIGNAL HISTORY</div>
            {signalHistory.filter(s => s.signal !== 'WAIT').slice(0, 10).map(s => (
              <div key={s.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 12px', marginBottom:'4px', background:'#0a0a0f', border:`1px solid ${s.signal==='BUY'?'#00FF9D22':'#FF3B3B22'}`, borderLeft:`3px solid ${s.signal==='BUY'?'#00FF9D':'#FF3B3B'}` }}>
                <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                  <div style={{ fontSize:'14px', fontWeight:'700', color: s.signal==='BUY'?'#00FF9D':'#FF3B3B', fontFamily:"'Bebas Neue', sans-serif", letterSpacing:'2px' }}>{s.signal}</div>
                  <div>
                    <div style={{ fontSize:'9px', color:'#fff', letterSpacing:'1px' }}>{s.pair}</div>
                    <div style={{ fontSize:'8px', color:'#333' }}>{new Date(s.timestamp).toLocaleTimeString()}</div>
                  </div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:'10px', color:'#555' }}>@ {s.entry}</div>
                  <div style={{ fontSize:'9px', color: s.confidence>=75?'#00FF9D':'#FF9B00' }}>{s.confidence}% conf</div>
                  <div style={{ fontSize:'8px', color: s.status==='win'?'#00FF9D':s.status==='loss'?'#FF3B3B':'#333' }}>
                    {s.status==='win'?'✓ WIN':s.status==='loss'?'✗ LOSS':'● OPEN'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ textAlign: 'center', fontSize: '8px', color: '#111', letterSpacing: '2px', marginBottom: '20px' }}>
          TRADE ORACLE • AI SIGNALS • NOT FINANCIAL ADVICE
        </div>
      </div>
    </div>
  );
}
