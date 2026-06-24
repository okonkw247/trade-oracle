const axios = require('axios');

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
  const isSell = signal === 'SELL';
  const lineColor = isBuy ? '#10E08A' : isSell ? '#FF4D6D' : '#818CF8';
  const fillColor = isBuy ? 'rgba(16,224,138,0.12)' : isSell ? 'rgba(255,77,109,0.12)' : 'rgba(129,140,248,0.12)';

  const chartConfig = {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'High',
          data: highs,
          borderColor: 'rgba(255,255,255,0.08)',
          backgroundColor: 'transparent',
          borderWidth: 1,
          pointRadius: 0,
          tension: 0.3,
        },
        {
          label: 'Low',
          data: lows,
          borderColor: 'rgba(255,255,255,0.08)',
          backgroundColor: 'transparent',
          borderWidth: 1,
          pointRadius: 0,
          tension: 0.3,
        },
        {
          label: pair,
          data: closes,
          borderColor: lineColor,
          backgroundColor: fillColor,
          borderWidth: 3,
          pointRadius: 0,
          fill: true,
          tension: 0.35,
        },
      ],
    },
    options: {
      layout: { padding: { top: 30, right: 24, bottom: 10, left: 10 } },
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: `${pair}  ·  ${signal || 'ANALYSIS'}  ·  1M`,
          color: '#F1F5F9',
          font: { size: 20, weight: 'bold', family: "'Helvetica Neue', Arial" },
          padding: { bottom: 20 },
        },
      },
      scales: {
        x: {
          ticks: { color: '#64748B', maxTicksLimit: 6, font: { size: 11 } },
          grid: { color: 'rgba(255,255,255,0.04)' },
        },
        y: {
          ticks: { color: '#64748B', font: { size: 11 } },
          grid: { color: 'rgba(255,255,255,0.06)' },
          position: 'right',
        },
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

const sendPhoto = async (chatId, buffer, caption = '') => {
  try {
    const FormData = require('form-data');
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('photo', buffer, { filename: 'chart.png', contentType: 'image/png' });
    if (caption) { form.append('caption', caption); form.append('parse_mode', 'HTML'); }
    const res = await axios.post(`${TG_API}/sendPhoto`, form, { headers: form.getHeaders() });
    return res.data.result;
  } catch (e) {
    console.error('Telegram sendPhoto error:', e.response?.data || e.message);
    return null;
  }
};

const editPhoto = async (chatId, messageId, buffer, caption = '') => {
  try {
    const FormData = require('form-data');
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('message_id', messageId);
    const media = { type: 'photo', media: 'attach://chart.png' };
    if (caption) { media.caption = caption; media.parse_mode = 'HTML'; }
    form.append('media', JSON.stringify(media));
    form.append('chart.png', buffer, { filename: 'chart.png', contentType: 'image/png' });
    await axios.post(`${TG_API}/editMessageMedia`, form, { headers: form.getHeaders() });
    return true;
  } catch (e) {
    console.error('Telegram editPhoto error:', e.response?.data || e.message);
    return false;
  }
};

const sendMessage = async (chatId, text, extra = {}) => {
  try {
    const res = await axios.post(`${TG_API}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      ...extra,
    });
    return res.data.result;
  } catch (e) {
    console.error('Telegram send error:', e.response?.data || e.message);
    return null;
  }
};

const editMessage = async (chatId, messageId, text, extra = {}) => {
  try {
    await axios.post(`${TG_API}/editMessageText`, {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'HTML',
      ...extra,
    });
  } catch (e) {
    console.error('Telegram edit error:', e.response?.data || e.message);
  }
};

const answerCallback = async (callbackQueryId, text = '') => {
  try {
    await axios.post(`${TG_API}/answerCallbackQuery`, {
      callback_query_id: callbackQueryId,
      text,
    });
  } catch (e) {
    console.error('Telegram answerCallback error:', e.response?.data || e.message);
  }
};

const pairKeyboard = () => ({
  inline_keyboard: [
    PAIRS.slice(0, 3).map(p => ({ text: p, callback_data: `sig:${p}` })),
    PAIRS.slice(3).map(p => ({ text: p, callback_data: `sig:${p}` })),
  ],
});

const refreshButton = (pair, chartMsgId) => ({
  inline_keyboard: [
    [{ text: '🔄 Refresh', callback_data: chartMsgId ? `sig:${pair}:${chartMsgId}` : `sig:${pair}` }],
    PAIRS.slice(0, 3).map(p => ({ text: p, callback_data: `sig:${p}` })),
    PAIRS.slice(3).map(p => ({ text: p, callback_data: `sig:${p}` })),
  ],
});

const normalizePair = (input) => {
  const clean = input.toUpperCase().replace(/[^A-Z]/g, '');
  const match = PAIRS.find(p => p.replace('/', '') === clean);
  return match || null;
};

const isRateLimited = (err) => {
  const data = err?.response?.data;
  const status = err?.response?.status;
  if (status === 429) return true;
  if (data && typeof data === 'object' && data.code === 429) return true;
  if (data && data.status === 'error' && /limit/i.test(data.message || '')) return true;
  return false;
};

const withRetry = async (fn, retries = 2, delayMs = 1500) => {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (isRateLimited(err) && i < retries) {
        await new Promise(r => setTimeout(r, delayMs * (i + 1)));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
};

const fetchSignalForPair = async (pair, baseUrl) => {
  const decimals = isJPY(pair) ? 3 : 5;

  let priceRes;
  try {
    priceRes = await withRetry(() => axios.get(`${baseUrl}/api/price?pair=${encodeURIComponent(pair)}`));
  } catch (err) {
    if (isRateLimited(err)) return { error: 'Market data provider is rate-limited right now. Please wait ~30s and try again.' };
    throw err;
  }
  if (!priceRes.data.values) return { error: 'Market closed or no data available.' };

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

  let sigRes;
  try {
    sigRes = await withRetry(() => axios.post(`${baseUrl}/api/signal`, {
      pair, price: latest.toFixed(decimals),
      trend1m: trendDir, trend15m: t15m, trend1h: t1h, trend4h: t4h,
      ema: ema10_1h ? ema10_1h.toFixed(decimals) : 'N/A',
      rsi: rsiVal || 'N/A', high: high.toFixed(decimals), low: low.toFixed(decimals),
      closes: closes.slice(-5).map(c => c.toFixed(decimals)).join(', '),
      candles: vals.slice(-20),
      sentimentScore, sentimentSummary,
    }));
  } catch (err) {
    if (isRateLimited(err)) return { error: 'AI signal engine is rate-limited. Please wait ~30s and try again.' };
    return { error: 'Signal engine error. Please try again shortly.' };
  }

  return { signal: sigRes.data, price: latest.toFixed(decimals), pair, candles: vals };
};

const formatSignalMessage = ({ signal, price, pair }) => {
  const isBuy = signal.signal === 'BUY';
  const isSell = signal.signal === 'SELL';
  const emoji = isBuy ? '🟢' : isSell ? '🔴' : '🟡';
  const tag = isBuy ? 'BUY SIGNAL' : isSell ? 'SELL SIGNAL' : 'WAIT';

  let msg = `<b>⚡ TRADE ORACLE</b>\n`;
  msg += `${emoji} <b>${tag}</b>  ·  <b>${pair}</b>\n`;
  msg += `━━━━━━━━━━━━━━━━━━\n`;
  msg += `💰 <b>${price}</b>\n`;

  if (signal.signal !== 'WAIT') {
    msg += `\n📍 Entry  <code>${signal.entry}</code>\n`;
    msg += `🎯 TP1     <code>${signal.tp1}</code>\n`;
    if (signal.tp2) msg += `🎯 TP2     <code>${signal.tp2}</code>\n`;
    msg += `🛑 SL      <code>${signal.sl}</code>\n`;
    if (signal.rr) msg += `⚖️ R:R     ${signal.rr}\n`;
  }

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

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(200).json({ ok: true });

  const update = req.body;
  const baseUrl = `https://${req.headers.host}`;

  // ── Handle button taps ──
  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message.chat.id;
    const messageId = cb.message.message_id;
    const data = cb.data || '';

    if (data.startsWith('sig:')) {
      const parts = data.replace('sig:', '').split(':');
      const pair = parts[0];
      const existingChartMsgId = parts[1] ? parseInt(parts[1], 10) : null;

      await answerCallback(cb.id, `Analyzing ${pair}...`);
      await editMessage(chatId, messageId, `⏳ Analyzing ${pair}...`);
      try {
        const result = await fetchSignalForPair(pair, baseUrl);
        if (result.error) {
          await editMessage(chatId, messageId, `⚠️ ${result.error}`, { reply_markup: pairKeyboard() });
        } else {
          let chartMsgId = existingChartMsgId;
          if (result.candles?.length) {
            try {
              const buf = await buildChartBuffer(result.candles, pair, result.signal.signal);
              if (existingChartMsgId) {
                const ok = await editPhoto(chatId, existingChartMsgId, buf);
                if (!ok) {
                  const sent = await sendPhoto(chatId, buf);
                  chartMsgId = sent?.message_id || null;
                }
              } else {
                const sent = await sendPhoto(chatId, buf);
                chartMsgId = sent?.message_id || null;
              }
            } catch (chartErr) { console.error('Chart error:', chartErr.message); }
          }
          await editMessage(chatId, messageId, formatSignalMessage(result), { reply_markup: refreshButton(pair, chartMsgId) });
        }
      } catch (err) {
        console.error('Bot callback error:', err.response?.data || err.message);
        await editMessage(chatId, messageId, `⚠️ Something went wrong. Tap a pair to retry.`, { reply_markup: pairKeyboard() });
      }
    }
    return res.status(200).json({ ok: true });
  }

  // ── Handle text messages ──
  const msg = update.message;
  if (!msg || !msg.text) return res.status(200).json({ ok: true });

  const chatId = msg.chat.id;
  const text = msg.text.trim();

  try {
    if (text === '/start' || text === '/help') {
      await sendMessage(chatId,
        `⚡ <b>Trade Oracle Bot</b>\n\n` +
        `Commands:\n` +
        `/signal — tap a pair for a live signal\n` +
        `/signal EURUSD — direct signal lookup\n` +
        `/pairs — list supported pairs\n\n` +
        `Supported: ${PAIRS.join(', ')}`
      );
    } else if (text === '/pairs') {
      await sendMessage(chatId, `📋 Supported pairs:\n${PAIRS.map(p => `• ${p}`).join('\n')}`);
    } else if (text.startsWith('/signal')) {
      const arg = text.replace('/signal', '').trim();
      if (!arg) {
        await sendMessage(chatId, `📡 Choose a pair:`, { reply_markup: pairKeyboard() });
        return res.status(200).json({ ok: true });
      }
      const pair = normalizePair(arg);
      if (!pair) {
        await sendMessage(chatId, `❌ Unknown pair. Choose one:`, { reply_markup: pairKeyboard() });
      } else {
        const sent = await sendMessage(chatId, `⏳ Analyzing ${pair}...`);
        const result = await fetchSignalForPair(pair, baseUrl);
        const messageId = sent?.message_id;
        if (result.error) {
          if (messageId) await editMessage(chatId, messageId, `⚠️ ${result.error}`, { reply_markup: pairKeyboard() });
          else await sendMessage(chatId, `⚠️ ${result.error}`);
        } else {
          let chartMsgId = null;
          if (result.candles?.length) {
            try {
              const buf = await buildChartBuffer(result.candles, pair, result.signal.signal);
              const sentPhoto = await sendPhoto(chatId, buf);
              chartMsgId = sentPhoto?.message_id || null;
            } catch (chartErr) { console.error('Chart error:', chartErr.message); }
          }
          if (messageId) await editMessage(chatId, messageId, formatSignalMessage(result), { reply_markup: refreshButton(pair, chartMsgId) });
          else await sendMessage(chatId, formatSignalMessage(result), { reply_markup: refreshButton(pair, chartMsgId) });
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
