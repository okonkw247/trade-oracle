const axios = require('axios');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const response = await axios.get(
      `https://api.twelvedata.com/api_usage?apikey=${process.env.TWELVE_KEY}`
    );
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: 'Usage fetch failed' });
  }
};
