const axios = require('axios');

const enforcePips = (signal, entry, sl, tp1, tp2, pair) => {
  const pipSize = pair.includes('JPY') ? 0.01 : 0.0001;
  const minSL = 10 * pipSize;
  const minTP1 = 15 * pipSize;
  const minTP2 = 25 * pipSize;

  if (signal === 'BUY') {
    if (entry - sl < minSL) sl = parseFloat((entry - minSL).toFixed(5));
    if (tp1 - entry < minTP1) tp1 = parseFloat((entry + minTP1).toFixed(5));
    if (tp2 - entry < minTP2) tp2 = parseFloat((entry + minTP2).toFixed(5));
  } else if (signal === 'SELL') {
    if (sl - entry < minSL) sl = parseFloat((entry + minSL).toFixed(5));
    if (entry - tp1 < minTP1) tp1 = parseFloat((entry - minTP1).toFixed(5));
    if (entry - tp2 < minTP2) tp2 = parseFloat((entry - minTP2).toFixed(5));
  }
  return { sl, tp1, tp2 };
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { pair, price, trend, rsi, high, low, closes } = req.body;
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
            content: `You are an expert Forex trading analyst. Respond ONLY in this exact JSON format with no extra text:
{"signal":"BUY or SELL or WAIT","entry":number,"sl":number,"tp1":number,"tp2":number,"rr":"1:2","confidence":number 65-95,"reason":"max 10 words","action":"Start with OPEN BUY / OPEN SELL / WAIT then explain why in one sentence"}`
          },
          {
            role: 'user',
            content: `${pair} price:${price} trend:${trend} RSI:${rsi} high:${high} low:${low} last closes:${closes}. Give signal.`
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 8000
      }
    );
    const text = response.data.choices[0].message.content;
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    const fixed = enforcePips(parsed.signal, parsed.entry, parsed.sl, parsed.tp1, parsed.tp2, pair);
    parsed.sl = fixed.sl;
    parsed.tp1 = fixed.tp1;
    parsed.tp2 = fixed.tp2;

    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: 'Signal failed' });
  }
};
