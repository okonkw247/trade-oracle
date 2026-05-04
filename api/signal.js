const axios = require('axios');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const { pair, price, trend, rsi, high, low, closes } = req.body;
  if (!pair || !price) return res.status(400).json({ error: 'Missing data' });
  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.1-8b-instant',
        max_tokens: 500,
        messages: [
          {
            role: 'system',
            content: `You are an expert Forex trading analyst. Respond ONLY in this exact JSON format with no extra text:
{
  "signal": "BUY" or "SELL" or "WAIT",
  "entry": number,
  "sl": number,
  "tp1": number,
  "tp2": number,
  "rr": "1:2",
  "confidence": number between 50-95,
  "reason": "short reason",
  "action": "exactly what to do right now"
}`
          },
          {
            role: 'user',
            content: `Pair: ${pair}
Current price: ${price}
Trend: ${trend}
RSI: ${rsi}
20 candle high: ${high}
20 candle low: ${low}
Last 5 closes: ${closes}
Give me a trading signal now. Be confident based on RSI and trend.`
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    const text = response.data.choices[0].message.content;
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: 'Signal failed' });
  }
};
