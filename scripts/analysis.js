diff --git a//dev/null b/scripts/analysis.js
index 0000000000000000000000000000000000000000..a11e957e64593672b5b62eb4450090cf684fead5 100644
--- a//dev/null
 b/scripts/analysis.js
@@ -0,0 1,299 @@
/**
 * analysis.js
 *
 * This module contains lightweight heuristics to approximate the three analysis cases.
 * Each case starts from market-implied probabilities and applies contextual nudges.
 * The heuristics are intentionally transparent so data scientists can replace them with
 * models (expected goals, Poisson, Bayesian nets, etc.) without refactoring the UI layer.
 */

import { impliedProbability, normalizeProbabilities, computeEdge, EDGE_THRESHOLD, isDerby } from './utils.js';

const WEAK_DATA_LEAGUES = new Set([239, 253, 272, 302]);

function extractMarketProbabilities(markets) {
  const matchOdds = markets['1X2'];
  if (!matchOdds) return null;
  const probs = {};
  matchOdds.forEach((entry) => {
    const key = entry.label.toLowerCase().startsWith('home') ? 'Home' : entry.label.toLowerCase().startsWith('away') ? 'Away' : 'Draw';
    probs[key] = impliedProbability(entry.odd);
  });
  if (!probs.Home || !probs.Away || !probs.Draw) return null;
  return normalizeProbabilities(probs);
}

function buildReason(base, adjustments) {
  const parts = [];
  if (base) parts.push(base);
  if (adjustments.length) parts.push(adjustments.join(' · '));
  return parts.join(' | ');
}

function applyCaseAdjustments(caseId, baseProbs, markets, context) {
  const adjustments = { Home: 0, Draw: 0, Away: 0 };
  const notes = [];

  const btts = markets.BTTS || [];
  const ou = markets.OU25 || [];
  const dc = markets.DC || [];
  const dnb = markets.DNB || [];

  const yesOdd = btts.find((o) => o.label.toLowerCase().includes('yes'))?.odd;
  const noOdd = btts.find((o) => o.label.toLowerCase().includes('no'))?.odd;
  const overOdd = ou.find((o) => o.label.toLowerCase().includes('over'))?.odd;
  const underOdd = ou.find((o) => o.label.toLowerCase().includes('under'))?.odd;

  const boost = (side, value, reason) => {
    adjustments[side] = value;
    notes.push(`${side} ${value > 0 ? '' : ''}${(value * 100).toFixed(1)}% – ${reason}`);
  };

  if (caseId >= 2) {
    if (yesOdd && yesOdd < 1.75) {
      boost('Draw', 0.02, 'High BTTS yes suggests both score');
    }
    if (overOdd && underOdd && overOdd < underOdd) {
      boost('Home', 0.02, 'Over 2.5 favours proactive favourite');
      boost('Away', 0.01, 'Higher tempo helps underdog goals');
    }
    const dc1x = dc.find((o) => o.label === '1X');
    const dcx2 = dc.find((o) => o.label === 'X2');
    if (dc1x && Number(dc1x.odd) < 1.4) {
      boost('Home', 0.03, 'Bookmakers protecting home/draw double chance');
    }
    if (dcx2 && Number(dcx2.odd) < 1.5) {
      boost('Away', 0.02, 'Market respects away resilience');
    }
    if (dnb.length === 2) {
      const homeDnb = Number(dnb.find((o) => o.label.toLowerCase().includes('home'))?.odd);
      const awayDnb = Number(dnb.find((o) => o.label.toLowerCase().includes('away'))?.odd);
      if (homeDnb && awayDnb && homeDnb < awayDnb) {
        boost('Home', 0.015, 'Draw No Bet leans home');
      } else if (homeDnb && awayDnb && awayDnb < homeDnb) {
        boost('Away', 0.015, 'Draw No Bet hedges to away');
      }
    }
  }

  if (caseId >= 3) {
    if (context.isDerby) {
      boost('Draw', 0.015, 'Derby volatility');
    }
    if (baseProbs.Home > 0.62) {
      boost('Home', -0.03, 'Home bias correction');
    }
    if (baseProbs.Away > 0.5) {
      boost('Away', -0.02, 'Away block adjustment');
    }
    if (context.isMidweek) {
      boost('Away', 0.01, 'Possible midweek rotation');
      boost('Draw', 0.01, 'European hangover hedge');
    }
    if (context.leagueWeakData) {
      boost('Draw', 0.015, 'Weak data league precaution');
    }
    if (overOdd && underOdd && underOdd < overOdd) {
      boost('Draw', 0.018, 'Low score undervaluation');
    }
    if (yesOdd && noOdd && noOdd < yesOdd) {
      boost('Away', 0.012, 'BTTS No suits counter approach');
    }
    if (dcx2 && Number(dcx2.odd) < 1.65 && baseProbs.Home > 0.45) {
      boost('Home', -0.02, 'Reverse upset trap');
    }
    if (context.formTrend === 'away') {
      boost('Away', 0.025, 'Form momentum override');
      boost('Home', -0.02, 'Downgrade inflated favourite');
    } else if (context.formTrend === 'home') {
      boost('Home', 0.02, 'Positive home form trend');
    }
    if (context.counterVsPress === 'away') {
      boost('Away', 0.018, 'Counter v high press exposure');
    }
  }

  const adjusted = {
    Home: Math.max(baseProbs.Home  adjustments.Home, 0.0001),
    Draw: Math.max(baseProbs.Draw  adjustments.Draw, 0.0001),
    Away: Math.max(baseProbs.Away  adjustments.Away, 0.0001),
  };

  const normalized = normalizeProbabilities(adjusted);
  return { probabilities: normalized, notes };
}

function determineContext(entry) {
  const date = new Date(entry.fixture.fixture?.date);
  const isMidweek = [2, 3, 4].includes(date.getUTCDay());
  const leagueWeakData = WEAK_DATA_LEAGUES.has(entry.fixture.league?.id);
  const formTrend = deriveFormTrend(entry.markets);
  const counterVsPress = deriveCounterPressSignal(entry.markets);
  return {
    isDerby: isDerby(entry.fixture),
    isMidweek,
    leagueWeakData,
    formTrend,
    counterVsPress,
  };
}

function deriveFormTrend(markets) {
  const dc = markets.DC || [];
  const oneX = dc.find((o) => o.label === '1X');
  const xTwo = dc.find((o) => o.label === 'X2');
  if (!oneX || !xTwo) return null;
  if (Number(xTwo.odd) < Number(oneX.odd) - 0.15) return 'away';
  if (Number(oneX.odd) < Number(xTwo.odd) - 0.15) return 'home';
  return null;
}

function deriveCounterPressSignal(markets) {
  const btts = markets.BTTS || [];
  const yesOdd = Number(btts.find((o) => o.label.toLowerCase().includes('yes'))?.odd);
  const ou = markets.OU25 || [];
  const overOdd = Number(ou.find((o) => o.label.toLowerCase().includes('over'))?.odd);
  if (yesOdd && overOdd && yesOdd > 1.8 && overOdd > 1.85) {
    return 'away';
  }
  return null;
}

function classifyPick(factorPick, marketProbabilities, factorProbabilities, context) {
  const marketProb = marketProbabilities[factorPick];
  const factorProb = factorProbabilities[factorPick];
  const edge = computeEdge(factorProb, marketProb);
  const outcome = {
    edge,
    status: 'FLAG',
    flagThreshold: '',
  };

  if (context.isDerby) {
    outcome.status = 'FLAG';
    outcome.flagThreshold = 'Derby safeguard';
    return outcome;
  }

  if (edge !== null && edge >= EDGE_THRESHOLD) {
    outcome.status = 'PICK';
    outcome.flagThreshold = `Edge ${edge.toFixed(2)} ≥ ${EDGE_THRESHOLD}`;
  } else {
    outcome.status = 'FLAG';
    outcome.flagThreshold = edge === null ? 'Missing odds' : `Edge ${edge?.toFixed(2)} < ${EDGE_THRESHOLD}`;
  }
  return outcome;
}

function buildModeRow(mode, entry, marketPick, factorPick, reason, context, outcome, probabilities, marketProbabilities, notes) {
  const fixture = entry.fixture.fixture;
  const league = entry.fixture.league;
  const dt = fixture?.date || '';
  const teamFavour = factorPick === 'Home' ? entry.fixture.teams?.home?.name : factorPick === 'Away' ? entry.fixture.teams?.away?.name : 'Split';
  const factorConfidence = probabilities[factorPick] ?? null;
  const edgeMargin = outcome.edge;
  const checklistTag = notes.map((note) => note.split('–')[1]?.trim()).filter(Boolean).join(', ');
  const row = {
    'Leagues': `${league?.name || 'League'} (${league?.country || ''})`.trim(),
    'UTC/Local Time': dt,
    'Market pick': marketPick,
    'Factor pick': factorPick,
    'Reason for factor pick': reason,
    'Team Favour side': teamFavour,
    'Factor confidence %': factorConfidence !== null ? factorConfidence * 100 : null,
    'Flag threshold': outcome.flagThreshold,
    'Edge margin': edgeMargin,
    'Checklist tag': checklistTag || 'Baseline',
    outcome,
    fixture,
    league,
  };

  if (mode === 'C') {
    return {
      'Winner mode %': (marketProbabilities[marketPick] * 100).toFixed(1),
      'Value mode %': (probabilities[factorPick] * 100).toFixed(1),
      Remark: outcome.status,
      Reason: reason,
      fixture,
      league,
      outcome,
    };
  }

  if (mode === 'D') {
    const clone = { ...row };
    delete clone['Checklist tag'];
    return clone;
  }

  return row;
}

export function analyzeFixtures(entries, filters = []) {
  const filtered = filters.length
    ? entries.filter((entry) => {
        const home = entry.fixture.teams?.home?.name?.toLowerCase() || '';
        const away = entry.fixture.teams?.away?.name?.toLowerCase() || '';
        const slug = `${home} vs ${away}`;
        const revSlug = `${away} vs ${home}`;
        return filters.some((filter) => slug.includes(filter) || revSlug.includes(filter));
      })
    : entries;

  const analysis = {
    B: [],
    C: [],
    D: [],
    picks: 0,
    flags: 0,
  };

  filtered.forEach((entry) => {
    const baseProbabilities = extractMarketProbabilities(entry.markets);
    if (!baseProbabilities) return;
    const marketPick = Object.entries(baseProbabilities).sort((a, b) => b[1] - a[1])[0][0];
    const context = determineContext(entry);

    const case1 = applyCaseAdjustments(1, baseProbabilities, entry.markets, context);
    const case1Pick = Object.entries(case1.probabilities).sort((a, b) => b[1] - a[1])[0][0];
    const case1Outcome = classifyPick(
      case1Pick,
      baseProbabilities,
      case1.probabilities,
      context
    );
    const case1Reason = buildReason('Market efficiency baseline', case1.notes);
    const rowB = buildModeRow('B', entry, marketPick, case1Pick, case1Reason, context, case1Outcome, case1.probabilities, baseProbabilities, case1.notes);
    analysis.B.push(rowB);

    const case2 = applyCaseAdjustments(2, baseProbabilities, entry.markets, context);
    const case2Pick = Object.entries(case2.probabilities).sort((a, b) => b[1] - a[1])[0][0];
    const case2Outcome = classifyPick(
      case2Pick,
      baseProbabilities,
      case2.probabilities,
      context
    );
    const case2Reason = buildReason('Fundamental  technical overlay', case2.notes);
    const rowC = buildModeRow('C', entry, marketPick, case2Pick, case2Reason, context, case2Outcome, case2.probabilities, baseProbabilities, case2.notes);
    analysis.C.push(rowC);

    const case3 = applyCaseAdjustments(3, baseProbabilities, entry.markets, context);
    const case3Pick = Object.entries(case3.probabilities).sort((a, b) => b[1] - a[1])[0][0];
    const case3Outcome = classifyPick(
      case3Pick,
      baseProbabilities,
      case3.probabilities,
      context
    );
    const case3Reason = buildReason('Comprehensive bias  situational filters', case3.notes);
    const rowD = buildModeRow('D', entry, marketPick, case3Pick, case3Reason, context, case3Outcome, case3.probabilities, baseProbabilities, case3.notes);
    analysis.D.push(rowD);

    if (case3Outcome.status === 'PICK') analysis.picks = 1;
    else analysis.flags = 1;
  });

  return analysis;
}
