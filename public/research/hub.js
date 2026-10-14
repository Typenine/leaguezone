'use strict';
// Player Hub helpers: positional context, weekly chart series and career
// progression. Pure functions over published research data (no DOM, network
// or storage), built on LZResearchMetrics so formulas are not duplicated.
(function (root, factory) {
  var api = function (M) { return factory(M); };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./metrics.js'));
  else root.LZPlayerHub = api(root.LZResearchMetrics);
})(typeof self !== 'undefined' ? self : this, function (M) {
  // Headline per-game numbers for each position. Keys must exist in metrics.js.
  var OVERVIEW_KEYS = {
    QB: ['ppg', 'attPg', 'ppydPg', 'cmpPct', 'ruyPg'],
    RB: ['ppg', 'carPg', 'tgtPg', 'carShare', 'rzOppPg'],
    WR: ['ppg', 'tgtPg', 'tgtShare', 'ayShare', 'adot'],
    K: ['ppg', 'fgmPg', 'xpmPg'],
    DEF: ['ppg', 'sacksPg', 'intsPg', 'paPg']
  };
  OVERVIEW_KEYS.TE = OVERVIEW_KEYS.WR;
  // Ranked among qualified players at the same position only.
  var RANK_KEYS = {
    QB: ['ppg', 'attPg', 'ppydPg'],
    RB: ['ppg', 'carPg', 'tgtPg', 'carShare'],
    WR: ['ppg', 'tgtPg', 'tgtShare'],
    K: ['ppg', 'fgmPg'],
    DEF: ['ppg', 'paPg']
  };
  RANK_KEYS.TE = RANK_KEYS.WR;
  // Single-game statistics a weekly chart can show without inventing data.
  var CHART_KEYS = {
    QB: ['points', 'att', 'passing', 'carries', 'rushing', 'carShare', 'rzOpp'],
    RB: ['points', 'carries', 'targets', 'rushing', 'yards', 'carShare', 'tgtShare', 'rzOpp'],
    WR: ['points', 'targets', 'receptions', 'yards', 'ay', 'tgtShare', 'rzOpp'],
    K: ['points', 'fgm', 'xpm'],
    DEF: ['points', 'sacks', 'pa']
  };
  CHART_KEYS.TE = CHART_KEYS.WR;
  // Per-game ranks need a real sample: at least half the weeks played so far.
  function minGames(throughWeek) { return Math.max(1, Math.ceil((Number(throughWeek) || 0) / 2)); }
  function copy(options) { var o = {}; Object.keys(options || {}).forEach(function (k) { o[k] = options[k]; }); return o; }
  function source(key) { var d = M.metric(key); return d ? (d.usage ? 'usage' : d.rz ? 'redzone' : 'base') : null; }
  function keysFor(map, pos) { return (map[pos] || []).filter(function (k) { return !!M.metric(k); }); }

  function qualifies(player, key, options) {
    return player.g >= minGames(options && options.throughWeek) && M.isQualified(key, player, options);
  }
  // Rank of player for key among qualified same-position players.
  // Returns null rank (with reason) instead of an unqualified "rank".
  function positionalRank(players, player, key, options) {
    var def = M.metric(key);
    if (!def || !M.applies(def, player.pos)) return null;
    var pool = (players || []).filter(function (p) { return p.pos === player.pos && qualifies(p, key, options); })
      .map(function (p) { return {id: p.id, value: M.compute(key, p, options)}; })
      .filter(function (x) { return x.value != null; })
      .sort(function (a, b) { return M.compareValues(a.value, b.value, def.dir) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); });
    var base = {key: key, population: pool.length, minGames: minGames(options && options.throughWeek),
      partial: !M.isSeasonComplete(options && options.year, options && options.throughWeek)};
    var value = M.compute(key, player, options);
    if (value == null) return Object.assign(base, {rank: null, value: null, reason: 'Not available'});
    if (!qualifies(player, key, options)) {
      return Object.assign(base, {rank: null, value: value, reason: player.g < base.minGames ?
        'Needs ' + base.minGames + '+ games with stats' : 'Below the ' + (def.qualifier ? def.qualifier.label : 'volume') + ' minimum'});
    }
    // Ties share the better rank.
    var better = pool.filter(function (x) { return M.compareValues(x.value, value, def.dir) < 0; }).length;
    var rank = better + 1;
    return Object.assign(base, {rank: rank, value: value, reason: null,
      percentile: pool.length > 1 ? Math.round((pool.length - rank) / (pool.length - 1) * 100) : null});
  }
  // One entry per regular-season week. Weeks without a game row are
  // {status:'no-game'} (bye, inactive or not yet played), never zero.
  function weeklySeries(player, key, options, lastWeek) {
    var def = M.metric(key), kind = source(key);
    if (!def || !def.week || !M.applies(def, player.pos)) return null;
    var byWeek = {};
    (player.w || []).forEach(function (w) { byWeek[w[0]] = w; });
    var last = Math.max(Number(lastWeek) || 0, (player.w || []).reduce(function (m, w) { return Math.max(m, w[0]); }, 0));
    var out = [];
    for (var week = 1; week <= last; week++) {
      var row = byWeek[week];
      if (!row) { out.push({week: week, team: null, value: null, status: 'no-game'}); continue; }
      var o = copy(options); o.row = row;
      var extra = kind === 'usage' ? player.u : kind === 'redzone' ? player.rz : null;
      if (extra) o[kind === 'usage' ? 'usageRows' : 'rzRows'] = extra.filter(function (r) { return r.week === week && r.team === row[1]; });
      var r = M.evaluate(key, player, o);
      out.push({week: week, team: row[1], value: r.value, status: r.value == null ? 'not-recorded' : 'ok', missing: r.missing});
    }
    return out;
  }
  function chartKeys(pos) { return keysFor(CHART_KEYS, pos); }
  function overviewKeys(pos) { return keysFor(OVERVIEW_KEYS, pos); }
  function rankKeys(pos) { return keysFor(RANK_KEYS, pos); }
  function needs(key) { return source(key); }

  // entries: [{year, throughWeek, player}] sorted any order. Values come from
  // M.evaluate so career and profile numbers always agree.
  function careerRows(entries, keys, scoring) {
    var rows = (entries || []).filter(function (e) { return e && e.player; }).slice()
      .sort(function (a, b) { return a.year - b.year; })
      .map(function (e) {
        var o = {scoring: scoring, throughWeek: e.throughWeek, year: e.year}, values = {};
        ['ppg', 'points'].concat(keys || []).forEach(function (k) { values[k] = M.compute(k, e.player, o); });
        var teams = [];
        (e.player.w || []).slice().sort(function (a, b) { return a[0] - b[0]; }).forEach(function (w) {
          if (w[1] && teams.indexOf(w[1]) === -1) teams.push(w[1]);
        });
        return {year: e.year, throughWeek: e.throughWeek, games: e.player.g, team: e.player.team,
          teams: teams.length ? teams : [e.player.team], partial: !M.isSeasonComplete(e.year, e.throughWeek), values: values};
      });
    rows.forEach(function (row, i) {
      var prev = i ? rows[i - 1] : null;
      row.previousYear = prev ? prev.year : null;
      // Consecutive seasons only; a gap year is not a year-over-year change.
      row.change = {};
      Object.keys(row.values).forEach(function (k) {
        row.change[k] = prev && prev.year === row.year - 1 && row.values[k] != null && prev.values[k] != null ?
          row.values[k] - prev.values[k] : null;
      });
    });
    var rated = rows.filter(function (r) { return r.values.ppg != null && r.games >= minGames(r.throughWeek); });
    var best = rated.slice().sort(function (a, b) { return b.values.ppg - a.values.ppg; })[0] || null;
    var worst = rated.slice().sort(function (a, b) { return a.values.ppg - b.values.ppg; })[0] || null;
    return {rows: rows, high: rated.length > 1 ? best : null, low: rated.length > 1 ? worst : null,
      firstYear: rows.length ? rows[0].year : null};
  }
  // Seasons a player could appear in: verified rookie year onward when known.
  function candidateSeasons(years, player) {
    var start = player && Number.isInteger(player.ryr) ? player.ryr : null;
    return (years || []).filter(function (y) { return start == null || y >= start; });
  }
  function seasonStatus(year, latest, throughWeek) {
    var complete = M.isSeasonComplete(year, throughWeek);
    return {current: year === latest, complete: complete,
      label: (year === latest ? (complete ? 'Latest season' : 'Current season') : 'Historical season') +
        (complete ? ' \u00b7 Final' : ' \u00b7 Through Week ' + throughWeek)};
  }
  return {OVERVIEW_KEYS: OVERVIEW_KEYS, RANK_KEYS: RANK_KEYS, CHART_KEYS: CHART_KEYS, minGames: minGames,
    positionalRank: positionalRank, weeklySeries: weeklySeries, chartKeys: chartKeys, overviewKeys: overviewKeys,
    rankKeys: rankKeys, needs: needs, careerRows: careerRows, candidateSeasons: candidateSeasons, seasonStatus: seasonStatus};
});
