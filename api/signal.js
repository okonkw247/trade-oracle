const axios = require('axios');

const enforcePips = (signal, entry, sl, tp1, tp2, pair) => {
  const pip = pair.includes('JPY') ? 0.01 : 0.0001;
  if (signal === 'BUY') {
    if (entry - sl < pip * 10) sl = parseFloat((entry - pip * 10).toFixed(5));
    if (tp1 - entry < pip * 15) tp1 = parseFloat((entry + pip * 15).toFixed(5));
    if (tp2 - entry < pip * 25) tp2 = parseFloat((entry + pip * 25).toFixed(5));
  } else if (signal === 'SELL') {
    if (sl - entry < pip * 10) sl = parseFloat((entry + pip * 10).toFixed(5));
    if (entry - tp1 < pip * 15) tp1 = parseFloat((entry - pip * 15).toFixed(5));
    if (entry - tp2 < pip * 25) tp2 = parseFloat((entry - pip * 25).toFixed(5));
  }
  return { sl, tp1, tp2 };
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { pair, price, trend1m, trend15m, trend1h, rsi, high, low, closes, ema } = req.body;
  if (!pair || !price) return res.status(400).json({ error: 'Missing data' });

  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.1-8b-instant',
        max_tokens: 500,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content: `You are an expert Forex trading analyst using multi-timeframe confluence. Respond ONLY in this JSON format with no extra text:
{"signal":"BUY or SELL or WAIT","entry":number,"sl":number,"tp1":number,"tp2":number,"rr":"1:2","confidence":number 65-95,"reason":"max 10 words","action":"Start with OPEN BUY / OPEN SELL / WAIT then one sentence why"}

STRICT RULES:
- BUY only if: 1H=UPTREND AND 15M=UPTREND AND price > EMA AND RSI < 65
- SELL only if: 1H=DOWNTREND AND 15M=DOWNTREND AND price < EMA AND RSI > 35
- WAIT if timeframes conflict or conditions not met
- True oversold = RSI < 30, true overbought = RSI > 70
- SL minimum 10 pips, TP1 minimum 15 pips, TP2 minimum 25 pips
- Non-JPY: 1 pip = 0.0001. JPY: 1 pip = 0.01`
          },
          {
            role: 'user',
            content: `Pair: ${pair}
Price: ${price} | EMA(10,1H): ${ema}
1M Trend: ${trend1m} | 15M Trend: ${trend15m} | 1H Trend: ${trend1h}
RSI(14): ${rsi} | High: ${high} | Low: ${low}
Last 5 closes: ${closes}
Apply MTF confluence rules and give signal.`
          }
        ]
      },
      { headers: { Authorization: `Bearer ${process.env.GROQ_KEY}`, 'Content-Type': 'application/json' }, timeout: 8000 }
    );
    const text = response.data.choices[0].message.content;
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    const fixed = enforcePips(parsed.signal, parsed.entry, parsed.sl, parsed.tp1, parsed.tp2, pair);
    res.json({ ...parsed, ...fixed });
  } catch (err) {
    res.status(500).json({ error: 'Signal failed' });
  }
};
