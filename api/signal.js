const axios = require('axios');

const calcEMA = (closes, period) => {
  if (closes.length < period) return null;
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < closes.length; i++) ema = closes[i] * k + ema * (1 - k);
  return ema;
};

const calcMACD = (closes) => {
  if (closes.length < 26) return null;
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  if (!ema12 || !ema26) return null;
  const macdLine = ema12 - ema26;
  const macdValues = [];
  for (let i = 9; i <= closes.length; i++) {
    const e12 = calcEMA(closes.slice(0, i), 12);
    const e26 = calcEMA(closes.slice(0, i), 26);
    if (e12 && e26) macdValues.push(e12 - e26);
  }
  const signalLine = macdValues.length >= 9 ? calcEMA(macdValues, 9) : null;
  const histogram = signalLine ? macdLine - signalLine : null;
  return { macdLine, signalLine, histogram };
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

const calcATR = (candles, period = 14) => {
  if (candles.length < period + 1) return null;
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const high = parseFloat(candles[i].high);
    const low = parseFloat(candles[i].low);
    const prevClose = parseFloat(candles[i - 1].close);
    trs.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }
  return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
};

const calcStochastic = (candles, period = 14) => {
  if (candles.length < period) return null;
  const recent = candles.slice(-period);
  const highest = Math.max(...recent.map(c => parseFloat(c.high)));
  const lowest = Math.min(...recent.map(c => parseFloat(c.low)));
  const close = parseFloat(candles[candles.length - 1].close);
  return Math.round(((close - lowest) / (highest - lowest)) * 100);
};

const calcBB = (closes, period = 20) => {
  if (closes.length < period) return null;
  const recent = closes.slice(-period);
  const mean = recent.reduce((a, b) => a + b, 0) / period;
  const std = Math.sqrt(recent.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period);
  return { upper: mean + 2 * std, middle: mean, lower: mean - 2 * std };
};

const enforcePips = (signal, entry, sl, tp1, tp2, pair, atr) => {
  const pip = pair.includes('JPY') ? 0.01 : 0.0001;
  const dec = pair.includes('JPY') ? 3 : 5;
  const slDist = atr ? Math.min(atr * 1.5, pip * 40) : pip * 15;
  const tp1Dist = slDist * 1.5;
  const tp2Dist = slDist * 2.5;
  if (signal === 'BUY') {
    if (!sl || sl >= entry || entry - sl > pip * 50 || entry - sl < pip * 8)
      sl = parseFloat((entry - slDist).toFixed(dec));
    if (!tp1 || tp1 - entry < pip * 12) tp1 = parseFloat((entry + tp1Dist).toFixed(dec));
    if (!tp2 || tp2 - entry < pip * 20) tp2 = parseFloat((entry + tp2Dist).toFixed(dec));
  } else if (signal === 'SELL') {
    if (!sl || sl <= entry || sl - entry > pip * 50 || sl - entry < pip * 8)
      sl = parseFloat((entry + slDist).toFixed(dec));
    if (!tp1 || entry - tp1 < pip * 12) tp1 = parseFloat((entry - tp1Dist).toFixed(dec));
    if (!tp2 || entry - tp2 < pip * 20) tp2 = parseFloat((entry - tp2Dist).toFixed(dec));
  }
  return { sl, tp1, tp2 };
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { pair, price, trend1m, trend15m, trend1h, rsi, high, low, closes, candles } = req.body;
  if (!pair || !price) return res.status(400).json({ error: 'Missing data' });

  const priceNum = parseFloat(price);
  const pip = pair.includes('JPY') ? 0.01 : 0.0001;
  const dec = pair.includes('JPY') ? 3 : 5;
  const closesArr = closes ? closes.split(',').map(Number).filter(Boolean) : [];

  const rsiVal = parseFloat(rsi) || calcRSI(closesArr) || 50;
  const macd = calcMACD(closesArr);
  const ema20 = calcEMA(closesArr, 20);
  const ema50 = calcEMA(closesArr, Math.min(50, closesArr.length));
  const stoch = candles ? calcStochastic(candles) : null;
  const bb = calcBB(closesArr);
  const atr = candles ? calcATR(candles) : null;
  const atrPips = atr ? Math.round(atr / pip) : null;

  const resistance = parseFloat(high);
  const support = parseFloat(low);
  const distToResistance = Math.round((resistance - priceNum) / pip);
  const distToSupport = Math.round((priceNum - support) / pip);

  const emaCross = ema20 && ema50 ? (ema20 > ema50 ? 'BULLISH' : 'BEARISH') : 'UNKNOWN';
  const macdSignal = macd ? (macd.histogram > 0 ? 'BULLISH' : 'BEARISH') : 'UNKNOWN';

  let bbPosition = 'MIDDLE';
  if (bb) {
    if (priceNum > bb.upper) bbPosition = 'ABOVE UPPER BAND';
    else if (priceNum < bb.lower) bbPosition = 'BELOW LOWER BAND';
    else if (priceNum > bb.middle) bbPosition = 'UPPER HALF';
    else bbPosition = 'LOWER HALF';
  }

  const bullishFactors = [];
  const bearishFactors = [];
  if (trend1h === 'UPTREND') bullishFactors.push('1H uptrend');
  if (trend15m === 'UPTREND') bullishFactors.push('15M uptrend');
  if (trend1m === 'UPTREND') bullishFactors.push('1M uptrend');
  if (rsiVal < 40) bullishFactors.push('RSI oversold');
  if (emaCross === 'BULLISH') bullishFactors.push('EMA bullish cross');
  if (macdSignal === 'BULLISH') bullishFactors.push('MACD bullish');
  if (bbPosition === 'BELOW LOWER BAND') bullishFactors.push('Below lower BB');
  if (stoch && stoch < 20) bullishFactors.push('Stoch oversold');
  if (distToSupport < 8) bullishFactors.push('At key support');

  if (trend1h === 'DOWNTREND') bearishFactors.push('1H downtrend');
  if (trend15m === 'DOWNTREND') bearishFactors.push('15M downtrend');
  if (trend1m === 'DOWNTREND') bearishFactors.push('1M downtrend');
  if (rsiVal > 60) bearishFactors.push('RSI overbought');
  if (emaCross === 'BEARISH') bearishFactors.push('EMA bearish cross');
  if (macdSignal === 'BEARISH') bearishFactors.push('MACD bearish');
  if (bbPosition === 'ABOVE UPPER BAND') bearishFactors.push('Above upper BB');
  if (stoch && stoch > 80) bearishFactors.push('Stoch overbought');
  if (distToResistance < 8) bearishFactors.push('At key resistance');

  const confluence = bullishFactors.length > bearishFactors.length
    ? 'BULLISH ' + bullishFactors.length + '/' + (bullishFactors.length + bearishFactors.length) + ' factors'
    : bearishFactors.length > bullishFactors.length
    ? 'BEARISH ' + bearishFactors.length + '/' + (bullishFactors.length + bearishFactors.length) + ' factors'
    : 'NEUTRAL';

  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        max_tokens: 250,
        temperature: 0.05,
        messages: [
          {
            role: 'system',
            content: `You are a professional institutional Forex trader with 20 years experience. You analyze technical confluence and generate high-probability signals.

Output ONLY valid JSON no markdown:
{"signal":"BUY|SELL|WAIT","entry":number,"sl":number,"tp1":number,"tp2":number,"rr":"1:2","confidence":number,"reason":"max 12 words","action":"one clear trade instruction"}

RULES:
- BUY: needs 1H=UPTREND + 15M=UPTREND + min 3 bullish factors. Confidence = 60 + (bullishFactors x 5), max 92
- SELL: needs 1H=DOWNTREND + 15M=DOWNTREND + min 3 bearish factors. Confidence = 60 + (bearishFactors x 5), max 92
- WAIT: if 1H and 15M conflict OR fewer than 3 factors align
- entry: use exact current price
- sl: use ATR-based distance provided, must be realistic forex price near entry
- tp1: 1.5x SL distance, tp2: 2.5x SL distance`
          },
          {
            role: 'user',
            content: 'PAIR: ' + pair + ' | PRICE: ' + price + '\n\nTRENDS: 1M=' + trend1m + ' 15M=' + trend15m + ' 1H=' + trend1h + '\nEMA Cross: ' + emaCross + ' (EMA20=' + (ema20 ? ema20.toFixed(dec) : 'N/A') + ' EMA50=' + (ema50 ? ema50.toFixed(dec) : 'N/A') + ')\n\nMOMENTUM:\nRSI: ' + rsiVal + (rsiVal < 30 ? ' OVERSOLD' : rsiVal > 70 ? ' OVERBOUGHT' : rsiVal < 45 ? ' bearish bias' : rsiVal > 55 ? ' bullish bias' : ' neutral') + '\nMACD: ' + macdSignal + (macd ? ' (hist: ' + (macd.histogram ? macd.histogram.toFixed(6) : 'N/A') + ')' : '') + '\nStochastic: ' + (stoch !== null ? stoch + '%' + (stoch < 20 ? ' OVERSOLD' : stoch > 80 ? ' OVERBOUGHT' : '') : 'N/A') + '\n\nVOLATILITY:\nATR: ' + (atrPips ? atrPips + ' pips' : 'N/A') + '\nBollinger: price ' + bbPosition + (bb ? ' (upper=' + bb.upper.toFixed(dec) + ' lower=' + bb.lower.toFixed(dec) + ')' : '') + '\nResistance: ' + high + ' (' + distToResistance + ' pips away)\nSupport: ' + low + ' (' + distToSupport + ' pips away)\n\nCONFLUENCE: ' + confluence + '\nBullish: ' + (bullishFactors.join(', ') || 'none') + '\nBearish: ' + (bearishFactors.join(', ') || 'none') + '\nLast 5 closes: ' + closes
          }
        ]
      },
      { headers: { Authorization: 'Bearer ' + process.env.GROQ_KEY, 'Content-Type': 'application/json' }, timeout: 12000 }
    );

    const text = response.data.choices[0].message.content;
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    const fixed = enforcePips(parsed.signal, parsed.entry, parsed.sl, parsed.tp1, parsed.tp2, pair, atr);
    res.json({ ...parsed, ...fixed, indicators: { rsi: rsiVal, macd: macdSignal, ema: emaCross, stoch, bbPosition, atrPips, confluence } });
  } catch (err) {
    console.error('Signal error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Signal failed' });
  }
};
