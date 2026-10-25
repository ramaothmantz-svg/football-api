// Vercel serverless function: /api/matches
// Put your token in Vercel as an environment variable named FOOTBALL_DATA_TOKEN.

let cache = { at: 0, data: null };
const TTL = 60 * 1000; // serve the same data for 60 seconds

const day = (offset) =>
  new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);

const toStatus = (s) =>
  s === "IN_PLAY" || s === "PAUSED" ? "LIVE" : s === "FINISHED" ? "FT" : "NS";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (cache.data && Date.now() - cache.at < TTL) {
    return res.status(200).json(cache.data);
  }

  const url =
    "https://api.football-data.org/v4/matches?competitions=PL,CL,PD" +
    `&dateFrom=${day(0)}&dateTo=${day(1)}`;

  try {
    const r = await fetch(url, {
      headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_TOKEN },
    });

    // Rate limited: keep serving the last good copy
    if (r.status === 429) {
      return res.status(200).json(cache.data || { matches: [] });
    }
    if (!r.ok) {
      return res.status(502).json({ error: "Football API error", status: r.status });
    }

    const raw = await r.json();
    const matches = raw.matches.map((m) => ({
      id: m.id,
      league: m.competition.code,
      home: m.homeTeam.shortName || m.homeTeam.name,
      away: m.awayTeam.shortName || m.awayTeam.name,
      homeScore: m.score.fullTime.home,
      awayScore: m.score.fullTime.away,
      status: toStatus(m.status),
      kickoff: m.utcDate,
    }));

    cache = { at: Date.now(), data: { updated: new Date().toISOString(), matches } };
    return res.status(200).json(cache.data);
  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
}

