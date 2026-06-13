import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const PAIRS = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CHF'];
const API = '';
const isJPY = (pair) => pair.includes('JPY');

const G = '#00C97F';
const G_LIGHT = '#E8FBF3';

const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #F7F8FA; overflow-x: hidden; -webkit-font-smoothing: antialiased; }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: #F7F8FA; }
    ::-webkit-scrollbar-thumb { background: #D1D5DB; border-radius: 4px; }
    @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
    @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
    @keyframes progressFill { 0%{width:0%} 100%{width:100%} }
    @keyframes slideIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    .fade-up { animation: fadeUp 0.5s ease forwards; }
    .pulse { animation: pulse 2s ease-in-out infinite; }
    .spin { animation: spin 1s linear infinite; }
    .slide-in { animation: slideIn 0.4s ease forwards; }
    input:focus { outline: none; }
    button:active { transform: scale(0.98); }
  `}</style>
);

const STEPS = [
  'Connecting to market feeds...',
  'Fetching live prices...',
  'Analysing timeframes...',
  'Calibrating AI engine...',
  'Loading dashboard...',
];

const SplashScreen = ({ onDone }) => {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep(s => {
        const next = s + 1;
        setProgress(Math.round((next / STEPS.length) * 100));
        if (next >= STEPS.length) { clearInterval(interval); setDone(true); return s; }
        return next;
      });
    }, 520);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (done) { const t = setTimeout(onDone, 400); return () => clearTimeout(t); }
  }, [done, onDone]);

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: '#fff', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', zIndex: 9999,
      fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '8px' }}>
          <div style={{ width: '36px', height: '36px', background: G, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontSize: '18px' }}>◈</span>
          </div>
          <span style={{ fontSize: '22px', fontWeight: '700', color: '#111', letterSpacing: '-0.5px' }}>Trade Oracle</span>
        </div>
        <p style={{ fontSize: '13px', color: '#6B7280' }}>AI-powered Forex signals</p>
      </div>
      <div style={{ width: '260px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ fontSize: '12px', color: '#6B7280' }}>{STEPS[step]}</span>
          <span style={{ fontSize: '12px', color: G, fontWeight: '600' }}>{progress}%</span>
        </div>
        <div style={{ background: '#F3F4F6', borderRadius: '99px', height: '4px', overflow: 'hidden' }}>
          <div style={{ height: '100%', background: G, borderRadius: '99px', width: `${progress}%`, transition: 'width 0.4s ease' }} />
        </div>
      </div>
    </div>
  );
};

const Badge = ({ label, up, th: bth = { card: '#fff', border: '#E5E7EB' } }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    background: bth.card, border: `1px solid ${bth.border}`, borderRadius: '10px',
    padding: '10px 8px', flex: 1,
  }}>
    <span style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: '500', letterSpacing: '0.5px', marginBottom: '4px' }}>{label}</span>
    <span style={{ fontSize: '11px', fontWeight: '700', color: up === null ? '#9CA3AF' : up ? G : '#EF4444' }}>
      {up === null ? '—' : up ? '▲ UP' : '▼ DOWN'}
    </span>
  </div>
);

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [dark, setDark] = useState(() => localStorage.getItem('to_dark') === 'true');
  const [pair, setPair] = useState('EUR/USD');
  const [price, setPrice] = useState(null);
  const [prevPrice, setPrevPrice] = useState(null);
  const [signal, setSignal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [candles, setCandles] = useState([]);
  const [rsi, setRsi] = useState(null);
  const [error, setError] = useState(null);
  const [marketClosed, setMarketClosed] = useState(false);
  const [trend, setTrend] = useState(null);
  const [trend15m, setTrend15m] = useState(null);
  const [trend1h, setTrend1h] = useState(null);
  const [lastSignal, setLastSignal] = useState(null);
  const [notifGranted, setNotifGranted] = useState(false);
  const [signalHistory, setSignalHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('to_signals') || '[]'); } catch { return []; }
  });
  const [usage, setUsage] = useState(null);
  const [signalsToday, setSignalsToday] = useState(0);
  const [commentary, setCommentary] = useState('');
  const [sentiment, setSentiment] = useState(null);
  const [showRiskCalc, setShowRiskCalc] = useState(false);
  const [riskBalance, setRiskBalance] = useState('1000');
  const [riskPercent, setRiskPercent] = useState('2');

  useEffect(() => {
    if ('Notification' in window) {
      Notification.requestPermission().then(p => setNotifGranted(p === 'granted'));
    }
  }, []);

  const fetchUsage = useCallback(async () => {
    try { const res = await axios.get(`${API}/api/usage`); setUsage(res.data); } catch {}
  }, []);

  useEffect(() => {
    fetchUsage();
    const i = setInterval(fetchUsage, 60000);
    return () => clearInterval(i);
  }, [fetchUsage]);

  const calculateRSI = (closes) => {
    if (closes.length < 14) return null;
    let gains = 0, losses = 0;
    for (let i = closes.length - 14; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff > 0) gains += diff; else losses += Math.abs(diff);
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

  const playAlert = (type) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = type === 'BUY' ? 880 : 440;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.6);
    } catch(e) {}
  };

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
      if (!res.data.values) { setMarketClosed(true); setLoading(false); return; }
      setMarketClosed(false);
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
        const c15 = res15m.data.values ? res15m.data.values.map(c => parseFloat(c.close)).reverse() : [];
        const c1h = res1h.data.values ? res1h.data.values.map(c => parseFloat(c.close)).reverse() : [];
        t15m = c15.length > 1 ? (c15[c15.length-1] > c15[0] ? 'UPTREND' : 'DOWNTREND') : trendDir;
        t1h = c1h.length > 1 ? (c1h[c1h.length-1] > c1h[0] ? 'UPTREND' : 'DOWNTREND') : trendDir;
        ema10_1h = calculateEMA(c1h, 10);
      } catch { t15m = trendDir; t1h = trendDir; }
      setTrend15m(t15m);
      setTrend1h(t1h);

      setLoading(true);
      const sigRes = await axios.post(`${API}/api/signal`, {
        pair, price: latest.toFixed(decimals),
        trend1m: trendDir, trend15m: t15m, trend1h: t1h,
        ema: ema10_1h ? ema10_1h.toFixed(decimals) : 'N/A',
        rsi: rsiVal || 'N/A', high: high.toFixed(decimals), low: low.toFixed(decimals),
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
        if ('serviceWorker' in navigator) {
          const emoji = sigRes.data.signal === 'BUY' ? '🟢' : '🔴';
          navigator.serviceWorker.ready.then(reg => {
            reg.showNotification(`${emoji} ${sigRes.data.signal} ${pair}`, {
              body: `Entry: ${sigRes.data.entry} | SL: ${sigRes.data.sl} | TP: ${sigRes.data.tp1} | ${sigRes.data.confidence}% confidence`,
              icon: '/logo192.png', badge: '/logo192.png', vibrate: [200, 100, 200],
            });
          });
        }
      }
      setLastSignal(sigRes.data.signal);
      setError(null);
    } catch {
      setError('Unable to fetch signal. Retrying...');
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
    const i = setInterval(fetchAndAnalyze, 60000);
    return () => clearInterval(i);
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
    const ticker = setInterval(pollCandles, 30000);
    return () => clearInterval(ticker);
  }, [pair]);

  const decimals = isJPY(pair) ? 3 : 5;
  const priceUp = price > prevPrice;
  const signalColor = signal?.signal === 'BUY' ? G : signal?.signal === 'SELL' ? '#EF4444' : '#6B7280';
  const signalBg = signal?.signal === 'BUY' ? G_LIGHT : signal?.signal === 'SELL' ? '#FEF2F2' : '#F9FAFB';
  const toggleDark = () => setDark(d => { const n = !d; localStorage.setItem('to_dark', String(n)); return n; });
  const th = {
    bg: dark ? '#0F1117' : '#F7F8FA',
    card: dark ? '#1A1D27' : '#ffffff',
    border: dark ? '#2A2D3E' : '#E5E7EB',
    text: dark ? '#F9FAFB' : '#111111',
    sub: dark ? '#6B7280' : '#6B7280',
    input: dark ? '#0F1117' : '#F9FAFB',
  };

  const getRSIInfo = () => {
    if (!rsi) return { label: 'N/A', color: '#9CA3AF' };
    if (rsi >= 70) return { label: `${rsi} · Overbought`, color: '#EF4444' };
    if (rsi <= 30) return { label: `${rsi} · Oversold`, color: G };
    return { label: `${rsi} · Neutral`, color: '#6B7280' };
  };
  const rsiInfo = getRSIInfo();

  const creditsUsed = usage?.current_usage || 0;
  const creditsTotal = usage?.daily_limit || 800;
  const creditsPercent = Math.round((creditsUsed / creditsTotal) * 100);
  const closed = signalHistory.filter(s => s.status !== 'open');
  const wins = closed.filter(s => s.status === 'win').length;
  const winRate = closed.length > 0 ? Math.round((wins / closed.length) * 100) : null;

  if (showSplash) return (
    <>
      <GlobalStyles />
      <SplashScreen onDone={() => setShowSplash(false)} />
    </>
  );

  return (
    <div style={{ background: th.bg, minHeight: '100vh', fontFamily: "'Inter', sans-serif", maxWidth: '480px', margin: '0 auto' }}>
      <GlobalStyles />

      <div style={{ background: th.card, borderBottom: `1px solid ${th.border}`, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '28px', height: '28px', background: G, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontSize: '14px' }}>◈</span>
          </div>
          <span style={{ fontSize: '15px', fontWeight: '700', color: th.text, letterSpacing: '-0.3px' }}>Trade Oracle</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: marketClosed ? '#EF4444' : price ? G : '#F59E0B' }} className={price && !marketClosed ? 'pulse' : ''} />
          <span style={{ fontSize: '11px', color: '#6B7280', fontWeight: '500' }}>
            {marketClosed ? 'Market Closed' : lastUpdated ? `Updated ${lastUpdated}` : 'Connecting...'}
          </span>
        </div>
        <button onClick={toggleDark} style={{ background: dark ? '#2A2D3E' : '#F3F4F6', border: 'none', borderRadius: '20px', width: '42px', height: '24px', cursor: 'pointer', position: 'relative', flexShrink: 0 }}>
          <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: dark ? G : '#fff', position: 'absolute', top: '3px', left: dark ? '21px' : '3px', transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
        </button>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
          {PAIRS.map(p => (
            <button key={p} onClick={() => setPair(p)} style={{
              background: pair === p ? G : '#fff',
              color: pair === p ? '#fff' : '#374151',
              border: `1px solid ${pair === p ? G : '#E5E7EB'}`,
              borderRadius: '8px', padding: '6px 14px',
              fontSize: '12px', fontWeight: '600',
              fontFamily: "'Inter', sans-serif",
              cursor: 'pointer', whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}>{p}</button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div style={{ background: th.card, border: `1px solid ${th.border}`, borderRadius: '12px', padding: '14px' }} className="fade-up">
            <div style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: '500', marginBottom: '6px' }}>Live Price</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: price ? (priceUp ? G : '#EF4444') : '#D1D5DB', fontFamily: "'DM Mono', monospace", letterSpacing: '-0.5px' }}>
              {price ? price.toFixed(decimals) : '-.-----'}
            </div>
            <div style={{ fontSize: '13px', color: priceUp ? G : '#EF4444', marginTop: '2px' }}>{price ? (priceUp ? '▲' : '▼') : ''}</div>
          </div>
          <div style={{ background: th.card, border: `1px solid ${th.border}`, borderRadius: '12px', padding: '14px' }} className="fade-up">
            <div style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: '500', marginBottom: '6px' }}>RSI (14)</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: rsiInfo.color, fontFamily: "'DM Mono', monospace" }}>{rsiInfo.label}</div>
            <div style={{ fontSize: '10px', color: '#D1D5DB', marginTop: '4px' }}>1min candles</div>
          </div>
        </div>

        {(trend || trend15m || trend1h) && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <Badge th={th} label="1M" up={trend === 'UPTREND' ? true : trend === 'DOWNTREND' ? false : null} />
            <Badge th={th} label="15M" up={trend15m === 'UPTREND' ? true : trend15m === 'DOWNTREND' ? false : null} />
            <Badge th={th} label="1H" up={trend1h === 'UPTREND' ? true : trend1h === 'DOWNTREND' ? false : null} />
          </div>
        )}

        {candles.length > 0 && (() => {
          const W = 360, H = 180;
          const RPad = 52, BPad = 18, LPad = 4, TPad = 8;
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
          const dec = pair.includes('JPY') ? 3 : 5;
          const priceTicks = Array.from({length: 5}, (_, i) => minP + (range * i / 4));
          const timeStep = Math.max(Math.floor(candles.length / 5), 1);
          const lastIdx = candles.length - 1;
          return (
            <div style={{ background: th.card, border: `1px solid ${th.border}`, borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px 4px' }}>
                <span style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: '500' }}>Live Chart · 1M</span>
                {signal && signal.signal !== 'WAIT' && (
                  <span style={{ fontSize: '11px', fontWeight: '600', color: signalColor }}>
                    {signal.signal === 'BUY' ? '▲' : '▼'} {signal.signal} @ {signal.entry?.toFixed(dec)}
                  </span>
                )}
              </div>
              <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
                {priceTicks.map((p,i) => (
                  <line key={i} x1={LPad} y1={py(p)} x2={W-RPad} y2={py(p)} stroke="#F3F4F6" strokeWidth="1"/>
                ))}
                {candles.map((c,i) => {
                  const o=parseFloat(c.open), cl=parseFloat(c.close), hi=parseFloat(c.high), lo=parseFloat(c.low);
                  const x=cx(i), col=cl>=o ? G : '#EF4444';
                  const bTop=Math.min(py(o),py(cl)), bH=Math.max(Math.abs(py(o)-py(cl)),1);
                  return (
                    <g key={i}>
                      <line x1={x} y1={py(hi)} x2={x} y2={py(lo)} stroke={col} strokeWidth="0.8" opacity="0.7"/>
                      <rect x={x-bW/2} y={bTop} width={bW} height={bH} fill={col} opacity="0.9"/>
                    </g>
                  );
                })}
                {signal && signal.signal !== 'WAIT' && [
                  {p:signal.entry, c:'#9CA3AF', l:'Entry'},
                  {p:signal.sl, c:'#EF4444', l:'SL'},
                  {p:signal.tp1, c:G, l:'TP1'},
                  {p:signal.tp2, c:'#6EE7B7', l:'TP2'},
                ].map(({p,c,l}) => p && p>=minP && p<=maxP ? (
                  <g key={l}>
                    <line x1={LPad} y1={py(p)} x2={W-RPad} y2={py(p)} stroke={c} strokeWidth="0.8" strokeDasharray="3,3"/>
                    <rect x={W-RPad+1} y={py(p)-7} width={RPad-2} height={13} fill="#fff"/>
                    <text x={W-RPad+4} y={py(p)+3} fill={c} fontSize="7" fontFamily="monospace">{l}</text>
                  </g>
                ) : null)}
                {signal && signal.signal === 'BUY' && (
                  <polygon points={`${cx(lastIdx)},${py(parseFloat(candles[lastIdx].low))+4} ${cx(lastIdx)-5},${py(parseFloat(candles[lastIdx].low))+12} ${cx(lastIdx)+5},${py(parseFloat(candles[lastIdx].low))+12}`} fill={G}/>
                )}
                {signal && signal.signal === 'SELL' && (
                  <polygon points={`${cx(lastIdx)},${py(parseFloat(candles[lastIdx].high))-4} ${cx(lastIdx)-5},${py(parseFloat(candles[lastIdx].high))-12} ${cx(lastIdx)+5},${py(parseFloat(candles[lastIdx].high))-12}`} fill="#EF4444"/>
                )}
                {priceTicks.map((p,i) => (
                  <text key={i} x={W-RPad+4} y={py(p)+3} fill="#9CA3AF" fontSize="6.5" fontFamily="monospace">{p.toFixed(dec)}</text>
                ))}
                {candles.map((c,i) => i % timeStep === 0 ? (
                  <text key={i} x={cx(i)} y={H-3} fill="#D1D5DB" fontSize="6" textAnchor="middle" fontFamily="monospace">
                    {c.datetime ? c.datetime.split(' ')[1]?.substring(0,5) : ''}
                  </text>
                ) : null)}
              </svg>
            </div>
          );
        })()}

        <div style={{ background: signal ? (dark ? (signal.signal==='BUY' ? '#0D2B1F' : signal.signal==='SELL' ? '#2B0D0D' : '#1A1D27') : signalBg) : th.card, border: `1px solid ${signal ? signalColor + '33' : '#E5E7EB'}`, borderRadius: '12px', padding: '16px', borderLeft: `3px solid ${signalColor}` }} className="fade-up">
          <div style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: '500', marginBottom: '12px' }}>AI Signal Engine</div>

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: G }}>
              <span className="spin" style={{ display: 'inline-block', fontSize: '14px' }}>⟳</span>
              <span style={{ fontSize: '13px', fontWeight: '500' }}>Analysing market data...</span>
            </div>
          ) : marketClosed ? (
            <div>
              <div style={{ fontSize: '22px', fontWeight: '700', color: '#F59E0B', marginBottom: '4px' }}>Market Closed</div>
              <p style={{ fontSize: '12px', color: '#6B7280', lineHeight: '1.5' }}>Forex markets are closed. Reopens Sunday 5:00 PM EST.</p>
            </div>
          ) : error ? (
            <div style={{ fontSize: '13px', color: '#EF4444', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>⚠</span> {error}
            </div>
          ) : signal ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                <div style={{ fontSize: '52px', fontWeight: '800', color: signalColor, letterSpacing: '-1px', lineHeight: '1' }}>{signal.signal}</div>
                <div>
                  <div style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '2px' }}>Confidence</div>
                  <div style={{ fontSize: '26px', fontWeight: '700', color: signalColor, fontFamily: "'DM Mono', monospace" }}>
                    {signal.confidence != null ? `${signal.confidence}%` : '—'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                {[
                  { label: 'Entry', value: signal.entry?.toFixed(decimals), color: '#111' },
                  { label: 'Stop Loss', value: signal.sl?.toFixed(decimals), color: '#EF4444' },
                  { label: 'Take Profit 1', value: signal.tp1?.toFixed(decimals), color: G },
                  { label: 'Take Profit 2', value: signal.tp2?.toFixed(decimals), color: G },
                ].map(item => (
                  <div key={item.label} style={{ background: th.card, border: `1px solid ${th.border}`, borderRadius: '8px', padding: '10px' }}>
                    <div style={{ fontSize: '10px', color: '#9CA3AF', marginBottom: '4px' }}>{item.label}</div>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: item.color, fontFamily: "'DM Mono', monospace" }}>{item.value || '—'}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '12px', color: '#6B7280' }}>
                <span>R/R <strong style={{ color: G }}>{signal.rr}</strong></span>
                <span>Pair <strong style={{ color: '#111' }}>{pair}</strong></span>
              </div>

              {signal.action && (
                <div style={{ background: '#fff', border: `1px solid ${G}33`, borderRadius: '8px', padding: '12px', borderLeft: `3px solid ${G}`, marginBottom: '8px' }}>
                  <div style={{ fontSize: '10px', color: G, fontWeight: '600', marginBottom: '4px' }}>⚡ What to do now</div>
                  <div style={{ fontSize: '13px', color: '#111', lineHeight: '1.5', fontWeight: '500' }}>{signal.action}</div>
                </div>
              )}

              {signal.confidence != null && signal.confidence < 75 && (
                <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', padding: '10px', marginBottom: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#B45309', fontWeight: '500' }}>⚠ Low confidence — consider skipping this trade</div>
                </div>
              )}

              {signal.reason && (
                <div style={{ marginTop: '8px', fontSize: '11px', color: '#9CA3AF', lineHeight: '1.5' }}>📊 {signal.reason}</div>
              )}
            </>
          ) : (
            <div style={{ fontSize: '13px', color: '#D1D5DB' }}>Initialising...</div>
          )}
        </div>

        <button onClick={fetchAndAnalyze} disabled={loading} style={{
          width: '100%', padding: '13px',
          background: loading ? '#F3F4F6' : G,
          border: 'none', borderRadius: '10px',
          color: loading ? '#9CA3AF' : '#fff',
          fontSize: '13px', fontWeight: '600',
          fontFamily: "'Inter', sans-serif",
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all 0.15s ease',
        }}>
          {loading ? '⟳ Analysing...' : '↻ Refresh Signal'}
        </button>

        {candles.length > 0 && (
          <div style={{ background: th.card, border: `1px solid ${th.border}`, borderRadius: '12px', padding: '14px' }}>
            <div style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: '500', marginBottom: '10px' }}>Market Overview</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px' }}>
              {[
                { label: 'High', value: Math.max(...candles.map(c => parseFloat(c.high))).toFixed(decimals), color: G },
                { label: 'Low', value: Math.min(...candles.map(c => parseFloat(c.low))).toFixed(decimals), color: '#EF4444' },
                { label: 'Candles', value: candles.length + 'x1M', color: '#111' },
                { label: 'Trend', value: trend === 'UPTREND' ? '▲ Up' : '▼ Down', color: trend === 'UPTREND' ? G : '#EF4444' },
              ].map(item => (
                <div key={item.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '9px', color: '#9CA3AF', marginBottom: '3px' }}>{item.label}</div>
                  <div style={{ fontSize: '11px', fontWeight: '600', color: item.color, fontFamily: "'DM Mono', monospace" }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {commentary && (
          <div style={{ background: th.card, border: `1px solid ${th.border}`, borderRadius: '12px', padding: '14px' }}>
            <div style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: '500', marginBottom: '8px' }}>🧠 AI Market Brief</div>
            <p style={{ fontSize: '13px', color: '#374151', lineHeight: '1.6' }}>{commentary}</p>
          </div>
        )}

        {sentiment && (
          <div style={{ background: th.card, border: `1px solid ${th.border}`, borderRadius: '12px', padding: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: '500' }}>Market Sentiment</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: sentiment.sentiment==='BULLISH' ? G : sentiment.sentiment==='BEARISH' ? '#EF4444' : '#6B7280' }}>
                  {sentiment.sentiment==='BULLISH' ? '▲' : sentiment.sentiment==='BEARISH' ? '▼' : '●'} {sentiment.sentiment}
                </span>
                <span style={{ fontSize: '18px', fontWeight: '700', color: sentiment.score>=6 ? G : sentiment.score<=4 ? '#EF4444' : '#6B7280', fontFamily: "'DM Mono', monospace" }}>{sentiment.score}/10</span>
              </div>
            </div>
            <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '8px' }}>{sentiment.summary}</p>
            {sentiment.factors && sentiment.factors.map((f,i) => (
              <div key={i} style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '3px' }}>• {f}</div>
            ))}
          </div>
        )}

        <div style={{ background: th.card, border: `1px solid ${th.border}`, borderRadius: '12px', overflow: 'hidden' }}>
          <button onClick={() => setShowRiskCalc(!showRiskCalc)} style={{
            width: '100%', padding: '14px', background: th.card, border: 'none',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            cursor: 'pointer', fontFamily: "'Inter', sans-serif",
          }}>
            <span style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>📐 Risk Calculator</span>
            <span style={{ fontSize: '12px', color: '#9CA3AF' }}>{showRiskCalc ? '▲' : '▼'}</span>
          </button>
          {showRiskCalc && signal && signal.signal !== 'WAIT' && (
            <div style={{ padding: '0 14px 14px', borderTop: '1px solid #F3F4F6' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', margin: '12px 0' }}>
                {[
                  { label: 'Account Balance ($)', val: riskBalance, set: setRiskBalance },
                  { label: 'Risk %', val: riskPercent, set: setRiskPercent },
                ].map(f => (
                  <div key={f.label}>
                    <div style={{ fontSize: '10px', color: '#9CA3AF', marginBottom: '4px' }}>{f.label}</div>
                    <input value={f.val} onChange={e => f.set(e.target.value)} style={{
                      width: '100%', border: '1px solid #E5E7EB', borderRadius: '6px',
                      padding: '8px 10px', fontSize: '13px', fontFamily: "'DM Mono', monospace",
                      color: th.text, background: th.input,
                    }} />
                  </div>
                ))}
              </div>
              {(() => {
                const bal = parseFloat(riskBalance) || 0;
                const rsk = parseFloat(riskPercent) || 0;
                const pip = pair.includes('JPY') ? 0.01 : 0.0001;
                const slPips = signal.sl ? Math.abs(signal.entry - signal.sl) / pip : 10;
                const riskAmt = bal * (rsk / 100);
                const lotSize = riskAmt / (slPips * 10);
                const tp1Profit = (Math.abs(signal.tp1 - signal.entry) / pip) * 10 * lotSize;
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {[
                      { label: 'Lot Size', value: lotSize.toFixed(2), color: G },
                      { label: 'Max Loss', value: '$' + riskAmt.toFixed(2), color: '#EF4444' },
                      { label: 'SL Pips', value: slPips.toFixed(1), color: '#111' },
                      { label: 'TP1 Profit', value: '$' + tp1Profit.toFixed(2), color: G },
                    ].map(item => (
                      <div key={item.label} style={{ background: th.input, border: `1px solid ${th.border}`, borderRadius: '8px', padding: '10px' }}>
                        <div style={{ fontSize: '10px', color: '#9CA3AF', marginBottom: '3px' }}>{item.label}</div>
                        <div style={{ fontSize: '16px', fontWeight: '700', color: item.color, fontFamily: "'DM Mono', monospace" }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
          {showRiskCalc && (!signal || signal.signal === 'WAIT') && (
            <div style={{ padding: '12px 14px', borderTop: '1px solid #F3F4F6', fontSize: '12px', color: '#9CA3AF', textAlign: 'center' }}>
              Waiting for an active signal...
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px' }}>
          {[
            { label: 'Win Rate', value: winRate != null ? winRate + '%' : '—', color: winRate != null ? (winRate >= 60 ? G : '#EF4444') : '#9CA3AF' },
            { label: 'Credits Used', value: creditsUsed, color: creditsPercent > 80 ? '#EF4444' : '#111' },
            { label: 'Signals Today', value: signalsToday, color: G },
          ].map(item => (
            <div key={item.label} style={{ background: th.card, border: `1px solid ${th.border}`, borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: '#9CA3AF', marginBottom: '4px' }}>{item.label}</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: item.color, fontFamily: "'DM Mono', monospace" }}>{item.value}</div>
            </div>
          ))}
        </div>

        {signalHistory.filter(s => s.signal !== 'WAIT').length > 0 && (
          <div>
            <div style={{ fontSize: '12px', color: '#6B7280', fontWeight: '600', marginBottom: '8px' }}>Signal History</div>
            {signalHistory.filter(s => s.signal !== 'WAIT').slice(0, 10).map(s => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 12px', marginBottom: '6px',
                background: th.card, border: `1px solid ${th.border}`, borderRadius: '10px',
                borderLeft: `3px solid ${s.signal==='BUY' ? G : '#EF4444'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: s.signal==='BUY' ? G : '#EF4444' }}>{s.signal}</span>
                  <div>
                    <div style={{ fontSize: '11px', color: '#374151', fontWeight: '500' }}>{s.pair}</div>
                    <div style={{ fontSize: '10px', color: '#9CA3AF' }}>{new Date(s.timestamp).toLocaleTimeString()}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', color: '#374151', fontFamily: "'DM Mono', monospace" }}>@ {s.entry}</div>
                  <div style={{ fontSize: '10px', color: s.confidence>=75 ? G : '#F59E0B' }}>{s.confidence}% conf</div>
                  <div style={{ fontSize: '10px', color: s.status==='win' ? G : s.status==='loss' ? '#EF4444' : '#9CA3AF' }}>
                    {s.status==='win' ? '✓ Win' : s.status==='loss' ? '✗ Loss' : '● Open'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ textAlign: 'center', fontSize: '10px', color: th.sub, padding: '8px 0 20px' }}>
          Trade Oracle · AI Signals · Not financial advice
        </div>
      </div>
    </div>
  );
}
