const axios = require('axios');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

const PAIRS = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CHF'];
const isJPY = (pair) => pair.includes('JPY');

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

const sendMessage = async (chatId, text, extra = {}) => {
  try {
    await axios.post(`${TG_API}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      ...extra,
    });
  } catch (e) {
    console.error('Telegram send error:', e.response?.data || e.message);
  }
};

const normalizePair = (input) => {
  const clean = input.toUpperCase().replace(/[^A-Z]/g, '');
  const match = PAIRS.find(p => p.replace('/', '') === clean);
  return match || null;
};

const fetchSignalForPair = async (pair, baseUrl) => {
  const decimals = isJPY(pair) ? 3 : 5;

  const priceRes = await axios.get(`${baseUrl}/api/price?pair=${encodeURIComponent(pair)}`);
  if (!priceRes.data.values) return { error: 'Market closed or no data available.' };

  const vals = priceRes.data.values.slice().reverse();
  const closes = vals.map(c => parseFloat(c.close));
  const latest = closes[closes.length - 1];
  const rsiVal = calcRSI(closes);
  const trendDir = latest > closes[0] ? 'UPTREND' : 'DOWNTREND';
  const high = Math.max(...vals.map(c => parseFloat(c.high)));
  const low = Math.min(...vals.map(c => parseFloat(c.low)));

  let t15m = 'NEUTRAL', t1h = 'NEUTRAL', ema10_1h = null;
  try {
    const [r15, r1h] = await Promise.all([
      axios.get(`${baseUrl}/api/price?pair=${encodeURIComponent(pair)}&interval=15min&outputsize=20`),
      axios.get(`${baseUrl}/api/price?pair=${encodeURIComponent(pair)}&interval=1h&outputsize=20`),
    ]);
    const c15 = r15.data.values ? r15.data.values.map(c => parseFloat(c.close)).reverse() : [];
    const c1h = r1h.data.values ? r1h.data.values.map(c => parseFloat(c.close)).reverse() : [];
    t15m = c15.length > 1 ? (c15[c15.length-1] > c15[0] ? 'UPTREND' : 'DOWNTREND') : trendDir;
    t1h = c1h.length > 1 ? (c1h[c1h.length-1] > c1h[0] ? 'UPTREND' : 'DOWNTREND') : trendDir;
    ema10_1h = calcEMA(c1h, 10);
  } catch { t15m = trendDir; t1h = trendDir; }

  const sigRes = await axios.post(`${baseUrl}/api/signal`, {
    pair, price: latest.toFixed(decimals),
    trend1m: trendDir, trend15m: t15m, trend1h: t1h,
    ema: ema10_1h ? ema10_1h.toFixed(decimals) : 'N/A',
    rsi: rsiVal || 'N/A', high: high.toFixed(decimals), low: low.toFixed(decimals),
    closes: closes.slice(-5).map(c => c.toFixed(decimals)).join(', '),
    candles: vals.slice(-20),
  });

  return { signal: sigRes.data, price: latest.toFixed(decimals), pair };
};

const formatSignalMessage = ({ signal, price, pair }) => {
  const emoji = signal.signal === 'BUY' ? '🟢' : signal.signal === 'SELL' ? '🔴' : '🟡';
  let msg = `${emoji} <b>${signal.signal}</b> — <b>${pair}</b>\n`;
  msg += `💰 Price: <code>${price}</code>\n`;
  if (signal.signal !== 'WAIT') {
    msg += `\n📍 Entry: <code>${signal.entry}</code>`;
    msg += `\n🎯 TP1: <code>${signal.tp1}</code>`;
    if (signal.tp2) msg += `\n🎯 TP2: <code>${signal.tp2}</code>`;
    msg += `\n🛑 SL: <code>${signal.sl}</code>`;
    if (signal.rr) msg += `\n⚖️ R:R ${signal.rr}`;
  }
  msg += `\n📊 Confidence: <b>${signal.confidence}%</b>`;
  if (signal.reason) msg += `\n💬 ${signal.reason}`;
  return msg;
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(200).json({ ok: true });

  const update = req.body;
  const msg = update.message;
  if (!msg || !msg.text) return res.status(200).json({ ok: true });

  const chatId = msg.chat.id;
  const text = msg.text.trim();
  const baseUrl = `https://${req.headers.host}`;

  try {
    if (text === '/start' || text === '/help') {
      await sendMessage(chatId,
        `⚡ <b>Trade Oracle Bot</b>\n\n` +
        `Commands:\n` +
        `/signal EURUSD — get a live signal\n` +
        `/pairs — list supported pairs\n\n` +
        `Supported: ${PAIRS.join(', ')}`
      );
    } else if (text === '/pairs') {
      await sendMessage(chatId, `📋 Supported pairs:\n${PAIRS.map(p => `• ${p}`).join('\n')}`);
    } else if (text.startsWith('/signal')) {
      const arg = text.replace('/signal', '').trim();
      const pair = normalizePair(arg || 'EURUSD');
      if (!pair) {
        await sendMessage(chatId, `❌ Unknown pair. Try one of: ${PAIRS.join(', ')}`);
      } else {
        await sendMessage(chatId, `⏳ Analyzing ${pair}...`);
        const result = await fetchSignalForPair(pair, baseUrl);
        if (result.error) {
          await sendMessage(chatId, `⚠️ ${result.error}`);
        } else {
          await sendMessage(chatId, formatSignalMessage(result));
        }
      }
    } else {
      await sendMessage(chatId, `Unknown command. Type /help for options.`);
    }
  } catch (err) {
    console.error('Bot error:', err.response?.data || err.message);
    await sendMessage(chatId, `⚠️ Something went wrong fetching that signal. Try again shortly.`);
  }

  res.status(200).json({ ok: true });
};
