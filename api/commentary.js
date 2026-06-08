const axios = require('axios');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { pair, price, trend1m, trend15m, trend1h, rsi, signal, confidence } = req.body;
  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.1-8b-instant',
        max_tokens: 150,
        temperature: 0.4,
        messages: [
          {
            role: 'system',
            content: 'You are a friendly forex analyst explaining market conditions to a beginner trader. Write 2-3 short sentences in plain English. No jargon. Be clear and direct.'
          },
          {
            role: 'user',
            content: `${pair} price: ${price}. Trends — 1M: ${trend1m}, 15M: ${trend15m}, 1H: ${trend1h}. RSI: ${rsi}. Signal: ${signal} at ${confidence}% confidence. Explain what is happening in the market right now in simple words.`
          }
        ]
      },
      { headers: { Authorization: `Bearer ${process.env.GROQ_KEY}`, 'Content-Type': 'application/json' }, timeout: 8000 }
    );
    res.json({ commentary: response.data.choices[0].message.content.trim() });
  } catch (err) {
    res.status(500).json({ error: 'Commentary failed' });
  }
};
