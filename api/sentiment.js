const axios = require('axios');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { pair } = req.query;
  if (!pair) return res.status(400).json({ error: 'pair required' });
  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.1-8b-instant',
        max_tokens: 200,
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content: `You are a forex market sentiment analyst. Respond ONLY in this exact JSON format:
{"sentiment":"BULLISH or BEARISH or NEUTRAL","score":number 1-10,"summary":"one sentence max","factors":["factor1","factor2","factor3"]}`
          },
          {
            role: 'user',
            content: `What is the current market sentiment for ${pair}? Consider recent global economic conditions, USD strength, and major currency drivers. Score 1=very bearish, 10=very bullish.`
          }
        ]
      },
      { headers: { Authorization: `Bearer ${process.env.GROQ_KEY}`, 'Content-Type': 'application/json' }, timeout: 8000 }
    );
    const text = response.data.choices[0].message.content;
    const clean = text.replace(/```json|```/g, '').trim();
    res.json(JSON.parse(clean));
  } catch (err) {
    res.status(500).json({ error: 'Sentiment failed' });
  }
};
