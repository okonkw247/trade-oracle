const { Redis } = require('@upstash/redis');

const redis = Redis.fromEnv();

// ── SIGNAL RELAY ──────────────────────────────────────────────────
// Bridges Telegram bot signals to the MT5 Expert Advisor.
// Each user's latest actionable signal is stored under signal:{userId}.
// The EA polls GET with its userId + a lastSeen timestamp; only signals
// newer than lastSeen are returned, so the EA never double-executes
// the same trade on every poll.

const getSignalKey = (userId) => `signal:${userId}`;

const saveSignal = async (userId, signal) => {
  const payload = {
    ...signal,
    issuedAt: Date.now(),
  };
  await redis.set(getSignalKey(userId), payload, { ex: 60 * 60 * 24 }); // expire after 24h
  return payload;
};

const getSignal = async (userId) => {
  return await redis.get(getSignalKey(userId));
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Shared secret so random people can't push fake signals or scrape yours.
  const authHeader = req.headers['authorization'];
  if (process.env.EA_BRIDGE_SECRET && authHeader !== `Bearer ${process.env.EA_BRIDGE_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'POST') {
    const { userId, pair, signal, entry, sl, tp1, tp2, confidence } = req.body;
    if (!userId || !pair || !signal) {
      return res.status(400).json({ error: 'Missing userId, pair, or signal' });
    }
    if (!['BUY', 'SELL'].includes(signal)) {
      return res.status(400).json({ error: 'Signal must be BUY or SELL to relay to EA' });
    }
    try {
      const saved = await saveSignal(userId, { pair, signal, entry, sl, tp1, tp2, confidence });
      return res.status(200).json({ ok: true, saved });
    } catch (err) {
      console.error('Relay save error:', err.message);
      return res.status(500).json({ error: 'Failed to save signal' });
    }
  }

  if (req.method === 'GET') {
    const { userId, since } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    try {
      const signal = await getSignal(userId);
      if (!signal) return res.status(200).json({ signal: null });

      // If EA passes `since` (last processed timestamp), only return
      // signals issued after that to avoid re-executing the same trade.
      const sinceMs = since ? parseInt(since, 10) : 0;
      if (signal.issuedAt <= sinceMs) {
        return res.status(200).json({ signal: null });
      }
      return res.status(200).json({ signal });
    } catch (err) {
      console.error('Relay get error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch signal' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
