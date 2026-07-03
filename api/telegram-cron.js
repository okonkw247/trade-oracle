const axios = require('axios');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GROUP_CHAT_ID = process.env.TELEGRAM_GROUP_ID;
const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

const PAIRS = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CHF'];
const isJPY = (pair) => pair.includes('JPY');

// In-memory cache won't persist across invocations on serverless,
// so we use a simple threshold-based approach: only alert on strong
// signals (>=75% confidence) to limit noise. For real dedup across
// runs, wire this to Vercel KV / Upstash Redis later.

const calcEMA = (closes, period) => {
  if (closes.length < period) return null;
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < closes.length; i++) ema = closes[i] * k + ema * (1 - k);
  return ema;
};

const calcRSI = (closes, period = 14) => {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff; else losses += Math.abs(diff);
  }
  const rs = (gains / period) / (losses / period || 0.0001);
  return Math.round(100 - (100 / (1 + rs)));
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const isRateLimited = (err) => {
  const data = err?.response?.data;
  const status = err?.response?.status;
  if (status === 429) return true;
  if (data && typeof data === 'object' && data.code === 429) return true;
  if (data && data.status === 'error' && /limit/i.test(data.message || '')) return true;
  return false;
};

const withRetry = async (fn, retries = 2, delayMs = 2000) => {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (isRateLimited(err) && i < retries) {
        await sleep(delayMs * (i + 1));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
};

const sendMessage = async (text) => {
  try {
    const res = await axios.post(`${TG_API}/sendMessage`, {
      chat_id: GROUP_CHAT_ID,
      text,
      parse_mode: 'HTML',
    });
    return res.data.result;
  } catch (e) {
    console.error('Telegram send error:', e.response?.data || e.message);
    return null;
  }
};

const sendPhoto = async (buffer) => {
  try {
    const FormData = require('form-data');
    const form = new FormData();
    form.append('chat_id', GROUP_CHAT_ID);
    form.append('photo', buffer, { filename: 'chart.png', contentType: 'image/png' });
    await axios.post(`${TG_API}/sendPhoto`, form, { headers: form.getHeaders() });
  } catch (e) {
    console.error('Telegram sendPhoto error:', e.response?.data || e.message);
  }
};

const buildChartBuffer = async (candles, pair, signal) => {
  const recent = candles.slice(-40);
  const labels = recent.map(c => {
    const d = new Date(c.datetime);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  });
  const closes = recent.map(c => parseFloat(c.close));
  const highs = recent.map(c => parseFloat(c.high));
  const lows = recent.map(c => parseFloat(c.low));

  const isBuy = signal === 'BUY';
  const lineColor = isBuy ? '#10E08A' : '#FF4D6D';
  const fillColor = isBuy ? 'rgba(16,224,138,0.12)' : 'rgba(255,77,109,0.12)';

  const chartConfig = {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'High', data: highs, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'transparent', borderWidth: 1, pointRadius: 0, tension: 0.3 },
        { label: 'Low', data: lows, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'transparent', borderWidth: 1, pointRadius: 0, tension: 0.3 },
        { label: pair, data: closes, borderColor: lineColor, backgroundColor: fillColor, borderWidth: 3, pointRadius: 0, fill: true, tension: 0.35 },
      ],
    },
    options: {
      layout: { padding: { top: 30, right: 24, bottom: 10, left: 10 } },
      plugins: {
        legend: { display: false },
        title: { display: true, text: `${pair}  ·  ${signal} SIGNAL  ·  1M`, color: '#F1F5F9', font: { size: 20, weight: 'bold' }, padding: { bottom: 20 } },
      },
      scales: {
        x: { ticks: { color: '#64748B', maxTicksLimit: 6, font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: '#64748B', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.06)' }, position: 'right' },
      },
    },
  };

  const res = await axios.post('https://quickchart.io/chart', {
    chart: chartConfig,
    width: 900,
    height: 460,
    backgroundColor: '#0B0D14',
    version: '3',
    devicePixelRatio: 2,
  }, { responseType: 'arraybuffer', timeout: 15000 });

  return Buffer.from(res.data);
};

const formatSignalMessage = (pair, price, signal) => {
  const emoji = signal.signal === 'BUY' ? '🟢' : '🔴';
  let msg = `<b>⚡ TRADE ORACLE</b>\n`;
  msg += `${emoji} <b>${signal.signal} SIGNAL</b>  ·  <b>${pair}</b>\n`;
  msg += `━━━━━━━━━━━━━━━━━━\n`;
  msg += `💰 <b>${price}</b>\n`;
  msg += `\n📍 Entry  <code>${signal.entry}</code>\n`;
  msg += `🎯 TP1     <code>${signal.tp1}</code>\n`;
  if (signal.tp2) msg += `🎯 TP2     <code>${signal.tp2}</code>\n`;
  msg += `🛑 SL      <code>${signal.sl}</code>\n`;
  if (signal.rr) msg += `⚖️ R:R     ${signal.rr}\n`;
  msg += `\n📊 Confidence  <b>${signal.confidence}%</b>\n`;
  if (signal.timeframeBreakdown) {
    msg += `🕐 ${signal.timeframeBreakdown}`;
    if (signal.timeframeAlignment) msg += ` <i>(${signal.timeframeAlignment.replace(/ ALIGNMENT/, '')})</i>`;
    msg += `\n`;
  }
  if (signal.sentimentUsed && signal.sentimentScore !== null) {
    const sLabel = signal.sentimentScore >= 7 ? '🟢 Bullish' : signal.sentimentScore <= 3 ? '🔴 Bearish' : '🟡 Neutral';
    msg += `📰 News: ${sLabel} (${signal.sentimentScore}/10)\n`;
  }
  if (signal.reason) msg += `\n💬 <i>${signal.reason}</i>`;
  return msg;
};

const analyzePair = async (pair, baseUrl) => {
  const decimals = isJPY(pair) ? 3 : 5;

  const priceRes = await withRetry(() => axios.get(`${baseUrl}/api/price?pair=${encodeURIComponent(pair)}`));
  if (!priceRes.data.values) return null;

  const vals = priceRes.data.values.slice().reverse();
  const closes = vals.map(c => parseFloat(c.close));
  const latest = closes[closes.length - 1];
  const rsiVal = calcRSI(closes);
  const trendDir = latest > closes[0] ? 'UPTREND' : 'DOWNTREND';
  const high = Math.max(...vals.map(c => parseFloat(c.high)));
  const low = Math.min(...vals.map(c => parseFloat(c.low)));

  let t15m = 'NEUTRAL', t1h = 'NEUTRAL', t4h = 'NEUTRAL', ema10_1h = null;
  let sentimentScore = null, sentimentSummary = null;
  try {
    const [r15, r1h, r4h, rSent] = await withRetry(() => Promise.all([
      axios.get(`${baseUrl}/api/price?pair=${encodeURIComponent(pair)}&interval=15min&outputsize=20`),
      axios.get(`${baseUrl}/api/price?pair=${encodeURIComponent(pair)}&interval=1h&outputsize=20`),
      axios.get(`${baseUrl}/api/price?pair=${encodeURIComponent(pair)}&interval=4h&outputsize=20`),
      axios.get(`${baseUrl}/api/sentiment?pair=${encodeURIComponent(pair)}`).catch(() => null),
    ]));
    const c15 = r15.data.values ? r15.data.values.map(c => parseFloat(c.close)).reverse() : [];
    const c1h = r1h.data.values ? r1h.data.values.map(c => parseFloat(c.close)).reverse() : [];
    const c4h = r4h.data.values ? r4h.data.values.map(c => parseFloat(c.close)).reverse() : [];
    t15m = c15.length > 1 ? (c15[c15.length-1] > c15[0] ? 'UPTREND' : 'DOWNTREND') : trendDir;
    t1h = c1h.length > 1 ? (c1h[c1h.length-1] > c1h[0] ? 'UPTREND' : 'DOWNTREND') : trendDir;
    t4h = c4h.length > 1 ? (c4h[c4h.length-1] > c4h[0] ? 'UPTREND' : 'DOWNTREND') : t1h;
    ema10_1h = calcEMA(c1h, 10);
    if (rSent && rSent.data && rSent.data.score) {
      sentimentScore = rSent.data.score;
      sentimentSummary = rSent.data.summary;
    }
  } catch { t15m = trendDir; t1h = trendDir; t4h = trendDir; }

  const sigRes = await withRetry(() => axios.post(`${baseUrl}/api/signal`, {
    pair, price: latest.toFixed(decimals),
    trend1m: trendDir, trend15m: t15m, trend1h: t1h, trend4h: t4h,
    ema: ema10_1h ? ema10_1h.toFixed(decimals) : 'N/A',
    rsi: rsiVal || 'N/A', high: high.toFixed(decimals), low: low.toFixed(decimals),
    closes: closes.slice(-5).map(c => c.toFixed(decimals)).join(', '),
    candles: vals.slice(-20),
    sentimentScore, sentimentSummary,
  }));

  return { signal: sigRes.data, price: latest.toFixed(decimals), candles: vals };
};

module.exports = async (req, res) => {
  const authHeader = req.headers['authorization'];
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const baseUrl = `https://${req.headers.host}`;
  const results = [];

  for (let i = 0; i < PAIRS.length; i++) {
    const pair = PAIRS[i];
    try {
      const result = await analyzePair(pair, baseUrl);
      if (result && result.signal.signal !== 'WAIT' && result.signal.confidence >= 75) {
        await sendMessage(formatSignalMessage(pair, result.price, result.signal));
        if (result.candles?.length) {
          try {
            const buf = await buildChartBuffer(result.candles, pair, result.signal.signal);
            await sendPhoto(buf);
          } catch (chartErr) { console.error('Chart error:', chartErr.message); }
        }
        results.push({ pair, sent: true, signal: result.signal.signal, confidence: result.signal.confidence });
      } else {
        results.push({ pair, sent: false, confidence: result?.signal?.confidence ?? null });
      }
    } catch (err) {
      const errDetail = err.response?.data?.error?.message || err.response?.data?.message || err.response?.data || err.message;
      results.push({ pair, error: errDetail, status: err.response?.status });
    }

    // Throttle between pairs to stay under TwelveData's 8 req/min free-tier limit,
    // while keeping total runtime within Vercel's serverless timeout window.
    if (i < PAIRS.length - 1) await sleep(9000);
  }

  res.status(200).json({ ok: true, results });
};
