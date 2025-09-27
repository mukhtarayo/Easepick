diff --git a//dev/null b/scripts/api.js
index 0000000000000000000000000000000000000000..1d20fd9f14302f5ecc35645da47efcb209857939 100644
--- a//dev/null
 b/scripts/api.js
@@ -0,0 1,241 @@
import { CONFIG } from './config.js';

const DEFAULT_BOOKMAKER = 8; // Bet365 id in API-FOOTBALL

function buildHeaders() {
  const headers = {
    'Content-Type': 'application/json',
    'x-apisports-key': CONFIG.API_KEY || '',
  };
  if (CONFIG.RAPID_API_KEY) {
    headers['x-rapidapi-key'] = CONFIG.RAPID_API_KEY;
    headers['x-rapidapi-host'] = 'v3.football.api-sports.io';
  }
  return headers;
}

async function safeFetch(url) {
  const response = await fetch(url, {
    headers: buildHeaders(),
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }
  const payload = await response.json();
  return payload;
}

function isDemoMode() {
  return !CONFIG.API_KEY || CONFIG.DEMO;
}

function mockFixtures() {
  return {
    response: [
      {
        fixture: {
          id: 12345,
          date: new Date().toISOString(),
          venue: { name: 'Allianz Arena', city: 'Munich' },
        },
        league: {
          id: 78,
          name: 'Bundesliga',
          country: 'Germany',
          logo: 'https://media.api-sports.io/football/leagues/78.png',
        },
        teams: {
          home: { id: 157, name: 'FC Bayern' },
          away: { id: 165, name: 'Borussia Dortmund' },
        },
        goals: { home: null, away: null },
      },
      {
        fixture: {
          id: 12346,
          date: new Date(Date.now()  7200000).toISOString(),
          venue: { name: 'Deutsche Bank Park', city: 'Frankfurt' },
        },
        league: {
          id: 78,
          name: 'Bundesliga',
          country: 'Germany',
          logo: 'https://media.api-sports.io/football/leagues/78.png',
        },
        teams: {
          home: { id: 169, name: 'Eintracht Frankfurt' },
          away: { id: 172, name: 'RB Leipzig' },
        },
        goals: { home: null, away: null },
      },
    ],
  };
}

function mockOdds(fixtureId) {
  const base = {
    12345: {
      '1X2': [
        { label: 'Home', odd: 1.65 },
        { label: 'Draw', odd: 4.2 },
        { label: 'Away', odd: 4.6 },
      ],
      BTTS: [
        { label: 'Yes', odd: 1.72 },
        { label: 'No', odd: 2.05 },
      ],
      OU25: [
        { label: 'Over 2.5', odd: 1.68 },
        { label: 'Under 2.5', odd: 2.1 },
      ],
      DC: [
        { label: '1X', odd: 1.18 },
        { label: '12', odd: 1.25 },
        { label: 'X2', odd: 2.15 },
      ],
      CS: [
        { label: '2-1', odd: 8.5 },
        { label: '3-1', odd: 12 },
        { label: '1-1', odd: 9.5 },
        { label: '2-2', odd: 13 },
        { label: '1-0', odd: 11 },
      ],
      DNB: [
        { label: 'Home', odd: 1.28 },
        { label: 'Away', odd: 3.25 },
      ],
    },
    12346: {
      '1X2': [
        { label: 'Home', odd: 2.55 },
        { label: 'Draw', odd: 3.4 },
        { label: 'Away', odd: 2.65 },
      ],
      BTTS: [
        { label: 'Yes', odd: 1.65 },
        { label: 'No', odd: 2.2 },
      ],
      OU25: [
        { label: 'Over 2.5', odd: 1.78 },
        { label: 'Under 2.5', odd: 1.98 },
      ],
      DC: [
        { label: '1X', odd: 1.52 },
        { label: '12', odd: 1.35 },
        { label: 'X2', odd: 1.5 },
      ],
      CS: [
        { label: '2-2', odd: 12 },
        { label: '1-1', odd: 7.5 },
        { label: '2-1', odd: 9.5 },
        { label: '1-2', odd: 10.5 },
        { label: '0-1', odd: 11.5 },
      ],
      DNB: [
        { label: 'Home', odd: 1.85 },
        { label: 'Away', odd: 1.87 },
      ],
    },
  };
  return base[fixtureId] || {};
}

export async function fetchFixtures(params) {
  if (isDemoMode()) {
    return mockFixtures();
  }
  const { date, league, season } = params;
  const url = new URL(`${CONFIG.API_HOST}/fixtures`);
  if (date) url.searchParams.set('date', date);
  if (league) url.searchParams.set('league', league);
  if (season) url.searchParams.set('season', season);
  return safeFetch(url.toString());
}

export async function fetchOddsForFixture(fixtureId) {
  if (isDemoMode()) {
    return { response: [{ league: {}, fixture: { id: fixtureId }, bookmakers: [] }], markets: mockOdds(fixtureId) };
  }
  const url = new URL(`${CONFIG.API_HOST}/odds`);
  url.searchParams.set('fixture', fixtureId);
  url.searchParams.set('bookmaker', DEFAULT_BOOKMAKER);
  return safeFetch(url.toString());
}

export async function fetchLeagueLogo(league) {
  if (league?.logo) return league.logo;
  if (!league?.id) return null;
  if (isDemoMode()) {
    return 'https://media.api-sports.io/football/leagues/78.png';
  }
  try {
    const url = new URL(`${CONFIG.API_HOST}/leagues`);
    url.searchParams.set('id', league.id);
    const payload = await safeFetch(url.toString());
    return payload?.response?.[0]?.league?.logo || null;
  } catch (err) {
    return null;
  }
}

export function mapOddsResponse(apiOdds) {
  if (CONFIG.DEMO) {
    return apiOdds.markets;
  }
  const mapped = {};
  const bookmakers = apiOdds?.response?.[0]?.bookmakers || [];
  const marketMap = {
    'Match Winner': '1X2',
    'Both Teams To Score': 'BTTS',
    'Goals Over/Under': 'OU',
    'Double Chance': 'DC',
    'Correct Score': 'CS',
    'Draw No Bet': 'DNB',
  };
  bookmakers.forEach((bookmaker) => {
    const bets = Array.isArray(bookmaker?.bets) ? bookmaker.bets : [];
    bets.forEach((bet) => {
      const key = marketMap[bet?.name];
      if (!key) return;

      const values = Array.isArray(bet?.values) ? bet.values : [];
      if (key === 'OU') {
        const over = values.find((value) => {
          const selection = value?.value?.toLowerCase();
          return value?.handicap === '2.5' && selection?.includes('over');
        });
        const under = values.find((value) => {
          const selection = value?.value?.toLowerCase();
          return value?.handicap === '2.5' && selection?.includes('under');
        });
        if (over && under) {
          const overOdd = Number(over?.odd);
          const underOdd = Number(under?.odd);
          const overLabel = `${over?.value ?? ''} ${over?.handicap ?? ''}`.trim();
          const underLabel = `${under?.value ?? ''} ${under?.handicap ?? ''}`.trim();
          if (overLabel && underLabel && !Number.isNaN(overOdd) && !Number.isNaN(underOdd)) {
            mapped.OU25 = [
              { label: overLabel, odd: overOdd },
              { label: underLabel, odd: underOdd },
            ];
          }
        }
      } else {
        const selections = values
          .map((value) => {
            const label = value?.handicap
              ? `${value?.value ?? ''} ${value.handicap}`.trim()
              : value?.value;
            const odd = Number(value?.odd);
            if (!label || Number.isNaN(odd)) {
              return null;
            }
            return { label, odd };
          })
          .filter(Boolean);

        if (selections.length) {
          mapped[key] = selections;
        }
      }
    });
  });
  return mapped;
}

export async function getFixturesWithOdds(params, onProgress) {
  const fixturesPayload = await fetchFixtures(params);
  const fixtures = fixturesPayload?.response || [];
  const results = [];
  for (const fixture of fixtures) {
    if (typeof onProgress === 'function') {
      onProgress(`Loading odds for fixture ${fixture.fixture?.id}`);
    }
    try {
      const oddsPayload = await fetchOddsForFixture(fixture.fixture?.id);
      const markets = mapOddsResponse(oddsPayload);
      results.push({ fixture, markets });
    } catch (err) {
      results.push({ fixture, markets: {}, error: err.message });
    }
  }
  return results;
}
