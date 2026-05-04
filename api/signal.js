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
        max_tokens: 300,
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content: `Forex analyst. Reply ONLY in JSON:
{"signal":"BUY or SELL or WAIT","entry":number,"sl":number,"tp1":number,"tp2":number,"rr":"1:2","confidence":number 50-95,"reason":"short","action":"what to do now"}`
          },
          {
            role: 'user',
            content: `${pair} price:${price} trend:${trend} RSI:${rsi} high:${high} low:${low} closes:${closes}`
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
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: 'Signal failed' });
  }
};
