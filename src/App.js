import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const PAIRS = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CHF'];
const API = '';
const isJPY = (pair) => pair.includes('JPY');

export default function App() {
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
      setLoading(true);
      const sigRes = await axios.post(`${API}/api/signal`, {
        pair,
        price: latest.toFixed(decimals),
        trend: trendDir,
        rsi: rsiVal || 'N/A',
        high: high.toFixed(decimals),
        low: low.toFixed(decimals),
        closes: closes.slice(-5).map(c => c.toFixed(decimals)).join(', ')
      });
      setSignal(sigRes.data);
    } catch (err) {
      setError('Connection error — retrying...');
    }
    setLoading(false);
  }, [pair, price]);

  useEffect(() => {
    setSignal(null);
    setPrice(null);
    setRsi(null);
    setCandles([]);
    setTrend(null);
  }, [pair]);

  useEffect(() => {
    fetchAndAnalyze();
    const interval = setInterval(fetchAndAnalyze, 15000);
    return () => clearInterval(interval);
  }, [fetchAndAnalyze]);

  const signalColor = signal?.signal === 'BUY' ? '#00FF9D' : signal?.signal === 'SELL' ? '#FF4444' : '#888';
  const priceUp = price > prevPrice;
  const decimals = isJPY(pair) ? 3 : 5;

  const getRSIInfo = () => {
    if (!rsi) return { label: 'N/A', color: '#666' };
    if (rsi >= 70) return { label: `${rsi} OVERBOUGHT`, color: '#FF4444' };
    if (rsi <= 30) return { label: `${rsi} OVERSOLD`, color: '#00FF9D' };
    return { label: `${rsi} NEUTRAL`, color: '#888' };
  };
  const rsiInfo = getRSIInfo();

  return (
    <div style={{ background: '#080c10', minHeight: '100vh', color: '#fff', fontFamily: 'monospace', padding: '16px', maxWidth: '480px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <div style={{ color: '#00FF9D', fontSize: '22px', fontWeight: 'bold', letterSpacing: '3px' }}>TRADE</div>
          <div style={{ color: '#00FF9D', fontSize: '22px', fontWeight: 'bold', letterSpacing: '3px', marginTop: '-6px' }}>ORACLE</div>
        </div>
        <div style={{ fontSize: '10px', textAlign: 'right' }}>
          <div style={{ color: '#00FF9D99' }}>AI FOREX SIGNALS</div>
          {lastUpdated && <div style={{ color: '#00FF9D55' }}>⟳ {lastUpdated}</div>}
        </div>
      </div>

      {/* Pair Selector */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
        {PAIRS.map(p => (
          <button key={p} onClick={() => setPair(p)} style={{
            background: pair === p ? '#00FF9D' : '#0d1117',
            color: pair === p ? '#000' : '#555',
            border: `1px solid ${pair === p ? '#00FF9D' : '#ffffff11'}`,
            borderRadius: '6px', padding: '7px 12px',
            fontSize: '11px', fontFamily: 'monospace',
            cursor: 'pointer', whiteSpace: 'nowrap',
            fontWeight: pair === p ? 'bold' : 'normal'
          }}>{p}</button>
        ))}
      </div>

      {/* Price + RSI */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
        <div style={{ background: '#0d1117', border: '1px solid #00FF9D22', borderRadius: '12px', padding: '16px' }}>
          <div style={{ fontSize: '10px', color: '#444', marginBottom: '6px' }}>LIVE PRICE</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: price ? (priceUp ? '#00FF9D' : '#FF4444') : '#333' }}>
            {price ? price.toFixed(decimals) : '---'}
          </div>
          <div style={{ fontSize: '16px', marginTop: '2px' }}>
            {price && prevPrice ? (priceUp ? '▲' : '▼') : ''}
          </div>
        </div>
        <div style={{ background: '#0d1117', border: '1px solid #00FF9D22', borderRadius: '12px', padding: '16px' }}>
          <div style={{ fontSize: '10px', color: '#444', marginBottom: '6px' }}>RSI (14)</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: rsiInfo.color }}>{rsiInfo.label}</div>
          <div style={{ fontSize: '10px', color: '#333', marginTop: '4px' }}>5min candles</div>
        </div>
      </div>

      {/* Candle Summary */}
      {candles.length > 0 && (
        <div style={{ background: '#0d1117', border: '1px solid #ffffff08', borderRadius: '10px', padding: '12px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between' }}>
          {[
            { label: 'HIGH', value: Math.max(...candles.map(c => parseFloat(c.high))).toFixed(decimals), color: '#00FF9D' },
            { label: 'LOW', value: Math.min(...candles.map(c => parseFloat(c.low))).toFixed(decimals), color: '#FF4444' },
            { label: 'CANDLES', value: `${candles.length} × 5m`, color: '#fff' },
            { label: 'TREND', value: trend === 'UPTREND' ? '▲ UP' : '▼ DOWN', color: trend === 'UPTREND' ? '#00FF9D' : '#FF4444' },
          ].map(item => (
            <div key={item.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '9px', color: '#444' }}>{item.label}</div>
              <div style={{ fontSize: '12px', color: item.color, marginTop: '2px' }}>{item.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Signal Card */}
      <div style={{
        background: '#0d1117', border: `2px solid ${signalColor}33`,
        borderRadius: '14px', padding: '20px', marginBottom: '14px',
        position: 'relative', overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: signalColor }} />
        <div style={{ fontSize: '10px', color: '#444', marginBottom: '12px' }}>AI SIGNAL</div>

        {loading ? (
          <div style={{ color: '#00FF9D', fontSize: '14px', padding: '20px 0' }}>⟳ Analyzing market data...</div>
        ) : error ? (
          <div style={{ color: '#FF4444', fontSize: '13px' }}>⚠️ {error}</div>
        ) : signal ? (
          <>
            <div style={{ fontSize: '38px', fontWeight: 'bold', color: signalColor, letterSpacing: '4px', marginBottom: '18px' }}>
              {signal.signal === 'BUY' ? '🟢' : signal.signal === 'SELL' ? '🔴' : '⚪'} {signal.signal}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
              {[
                { label: 'ENTRY', value: signal.entry?.toFixed(decimals), color: '#fff' },
                { label: 'STOP LOSS', value: signal.sl?.toFixed(decimals), color: '#FF4444' },
                { label: 'TP 1', value: signal.tp1?.toFixed(decimals), color: '#00FF9D' },
                { label: 'TP 2', value: signal.tp2?.toFixed(decimals), color: '#00FF9D' },
              ].map(item => (
                <div key={item.label} style={{ background: '#080c10', borderRadius: '8px', padding: '10px' }}>
                  <div style={{ fontSize: '9px', color: '#444', marginBottom: '4px' }}>{item.label}</div>
                  <div style={{ fontSize: '15px', fontWeight: 'bold', color: item.color }}>{item.value || '---'}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', color: '#555' }}>R/R: <span style={{ color: '#00FF9D' }}>{signal.rr}</span></div>
              <div style={{ fontSize: '11px', color: '#555' }}>Confidence: <span style={{ color: signalColor }}>{signal.confidence}%</span></div>
            </div>
            <div style={{ background: `${signalColor}11`, border: `1px solid ${signalColor}33`, borderRadius: '8px', padding: '12px', marginBottom: '10px' }}>
              <div style={{ fontSize: '9px', color: '#444', marginBottom: '4px' }}>⚡ ACTION NOW</div>
              <div style={{ fontSize: '13px', color: signalColor, lineHeight: '1.5' }}>{signal.action}</div>
            </div>
            <div style={{ fontSize: '11px', color: '#444' }}>📊 {signal.reason}</div>
          </>
        ) : (
          <div style={{ color: '#333', fontSize: '13px', padding: '20px 0' }}>Loading signal...</div>
        )}
      </div>

      {/* Confidence Bar */}
      {signal && (
        <div style={{ background: '#0d1117', border: '1px solid #ffffff08', borderRadius: '10px', padding: '14px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ fontSize: '10px', color: '#444' }}>CONFIDENCE</div>
            <div style={{ fontSize: '11px', color: signalColor }}>{signal.confidence}%</div>
          </div>
          <div style={{ background: '#080c10', borderRadius: '99px', height: '6px', overflow: 'hidden' }}>
            <div style={{
              width: `${signal.confidence}%`, height: '100%',
              background: `linear-gradient(90deg, ${signalColor}, ${signalColor}88)`,
              borderRadius: '99px', transition: 'width 0.8s ease'
            }} />
          </div>
        </div>
      )}

      {/* Refresh Button */}
      <button onClick={fetchAndAnalyze} disabled={loading} style={{
        width: '100%', padding: '14px',
        background: loading ? '#0d1117' : '#00FF9D11',
        border: '1px solid #00FF9D33', borderRadius: '10px',
        color: loading ? '#333' : '#00FF9D',
        fontSize: '13px', fontFamily: 'monospace',
        cursor: loading ? 'not-allowed' : 'pointer',
        letterSpacing: '2px', marginBottom: '20px'
      }}>
        {loading ? '⟳ ANALYZING...' : '⟳ REFRESH SIGNAL'}
      </button>

      <div style={{ textAlign: 'center', fontSize: '9px', color: '#1a1a1a' }}>
        TRADE ORACLE • AI SIGNALS • NOT FINANCIAL ADVICE
      </div>
    </div>
  );
}
