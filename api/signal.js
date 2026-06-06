const axios = require('axios');

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
{"signal":"BUY or SELL or WAIT","entry":number,"sl":number,"tp1":number,"tp2":number,"rr":"1:2","confidence":number 65-95,"reason":"max 10 words","action":"Start with OPEN BUY / OPEN SELL / WAIT then explain why in one sentence"}

STRICT RULES:
- SL must be minimum 10 pips from entry
- TP1 must be minimum 15 pips from entry
- TP2 must be minimum 25 pips from entry
- JPY pairs: 1 pip = 0.01. All others: 1 pip = 0.0001
- Base SL on swing high/low not just current price`
          },
          {
            role: 'user',
            content: `${pair} price:${price} trend:${trend} RSI:${rsi} high:${high} low:${low} last closes:${closes}. Give professional signal with realistic SL and TP.`
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
    res.json(JSON.parse(clean));
  } catch (err) {
    res.status(500).json({ error: 'Signal failed' });
  }
};
