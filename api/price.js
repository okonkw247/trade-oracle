const axios = require('axios');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { pair } = req.query;
  if (!pair) return res.status(400).json({ error: 'pair required' });
  try {
    const response = await axios.get(
      `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(pair)}&interval=1min&outputsize=30&apikey=${process.env.TWELVE_KEY}`
    );
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: 'Price fetch failed' });
  }
};
