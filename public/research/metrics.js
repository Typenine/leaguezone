'use strict';
// Pure statistical helpers for LeagueZone public research. No DOM, network or
// storage access, so the same file runs in the browser and in unit tests.
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LZResearchMetrics = api;
})(typeof self !== 'undefined' ? self : this, function () {
  // Compact weekly row contract published by scripts/build-nflverse-research.py.
  var WEEK_INDEX = {rec:3, tgt:4, ry:5, car:6, ruy:7, ppyd:8, pptd:9, pint:10, fgm:11, xpm:12, rut:13, rt:14};
  var DEF_WEEK_INDEX = {sacks:13, ints:14, fr:15, pa:16};
  var FIELDS = ['rec','tgt','ry','car','ruy','ppyd','pptd','pint','fgm','xpm','rut','rt','sacks','ints','fr','pa'];
  var ALL = ['QB','RB','WR','TE','K','DEF'];
  var APPLIES = {
    all: ALL, passing: ['QB'], rushing: ['QB','RB','WR','TE'],
    receiving: ['RB','WR','TE'], touches: ['RB','WR','TE'], kicking: ['K'], defense: ['DEF']
  };
  var SKILL = ['RB','WR','TE'];
  var MIN_CONSISTENCY_GAMES = 3;
  var RECENT_WINDOW = 3;
  var QUALIFIER = {perSeasonWeek: 2, singleGame: 3};
  var DIVIDE = ' \u00f7 ';

  function num(v) { v = Number(v); return isFinite(v) ? v : 0; }
  function ratio(numerator, denominator) { return denominator > 0 ? numerator / denominator : null; }
  function receptionAdjustment(scoring) { return scoring === 'ppr' ? 0 : scoring === 'half' ? 0.5 : 1; }
  function regularSeasonWeeks(year) { return year >= 2021 ? 18 : 17; }
  function isSeasonComplete(year, throughWeek) { return num(throughWeek) >= regularSeasonWeeks(year); }

  function emptyLine() {
    var line = {games: 0, pts: 0};
    FIELDS.forEach(function (f) { line[f] = 0; });
    return line;
  }
  function weekLine(player, row) {
    var line = emptyLine(), index = player.pos === 'DEF' ? DEF_WEEK_INDEX : WEEK_INDEX;
    line.games = 1; line.pts = num(row[2]); line.week = row[0]; line.team = row[1];
    Object.keys(index).forEach(function (f) { line[f] = num(row[index[f]]); });
    return line;
  }
  function seasonLine(player) {
    var line = emptyLine();
    line.games = num(player.g); line.pts = num(player.p);
    FIELDS.forEach(function (f) { line[f] = num(player[f]); });
    return line;
  }
  function sumLines(lines) {
    var total = emptyLine();
    lines.forEach(function (l) {
      total.games += l.games; total.pts += l.pts;
      FIELDS.forEach(function (f) { total[f] += l[f]; });
    });
    return total;
  }
  function fantasyPoints(line, scoring) { return line.pts - receptionAdjustment(scoring) * line.rec; }
  function sortedRows(player) {
    return (player.w || []).slice().sort(function (a, b) { return a[0] - b[0]; });
  }
  // One entry per recorded game. Byes and missed games have no row, so they
  // never enter averages as zero-point games.
  function weeklyPoints(player, scoring) {
    return sortedRows(player).map(function (row) {
      return {week: row[0], points: fantasyPoints(weekLine(player, row), scoring)};
    });
  }
  function mean(values) {
    if (!values.length) return null;
    return values.reduce(function (s, v) { return s + v; }, 0) / values.length;
  }
  // Population standard deviation across the recorded games themselves.
  function stdDev(values) {
    if (values.length < 2) return null;
    var avg = mean(values);
    return Math.sqrt(values.reduce(function (s, v) { return s + (v - avg) * (v - avg); }, 0) / values.length);
  }
  function recentAverage(player, n, scoring) {
    var games = weeklyPoints(player, scoring);
    if (games.length < n) return null;
    return mean(games.slice(-n).map(function (g) { return g.points; }));
  }
  function consistency(player, scoring) {
    var values = weeklyPoints(player, scoring).map(function (g) { return g.points; });
    var avg = mean(values);
    if (values.length < MIN_CONSISTENCY_GAMES) return {games: values.length, sd: null, volatility: null, mean: avg};
    var sd = stdDev(values);
    return {games: values.length, sd: sd, mean: avg, volatility: avg > 0 ? sd / avg : null};
  }
  // Ties resolve to the earliest week.
  function extremes(player, scoring) {
    var games = weeklyPoints(player, scoring);
    if (!games.length) return {high: null, low: null};
    var high = games[0], low = games[0];
    games.forEach(function (g) {
      if (g.points > high.points) high = g;
      if (g.points < low.points) low = g;
    });
    return {high: high, low: low};
  }

  function fewer(n) { return 'Fewer than ' + n + ' recorded games'; }
  function noVolume(label) { return function () { return 'No ' + label + ' recorded'; }; }
  function perGame(field) { return function (l) { return ratio(l[field], l.games); }; }
  function fp(l, c) { return fantasyPoints(l, c.scoring); }
  function m(key, short, label, group, applies, options) {
    var def = {key: key, short: short, label: label, group: group, applies: APPLIES[applies],
      season: true, week: true, dir: 'desc', decimals: 0, format: 'number'};
    Object.keys(options).forEach(function (k) { def[k] = options[k]; });
    return def;
  }
  var METRICS = [
    m('games','GP','Games played','fantasy','all',{week:false, value:function (l) { return l.games; }}),
    m('points','FP','Fantasy points','fantasy','all',{decimals:1, value:fp}),
    m('ppg','FP/G','Fantasy points per game','fantasy','all',{week:false, decimals:1,
      value:function (l,c) { return ratio(fp(l,c), l.games); }}),
    m('last3','L3 avg','Average fantasy points, last 3 recorded games','trend','all',{week:false, decimals:1,
      value:function (l,c) { return recentAverage(c.player,3,c.scoring); }, missing:function () { return fewer(3); }}),
    m('last5','L5 avg','Average fantasy points, last 5 recorded games','trend','all',{week:false, decimals:1,
      value:function (l,c) { return recentAverage(c.player,5,c.scoring); }, missing:function () { return fewer(5); }}),
    m('high','High','Highest single-game fantasy points','trend','all',{week:false, decimals:1,
      value:function (l,c) { var e=extremes(c.player,c.scoring).high; return e ? e.points : null; }}),
    m('low','Low','Lowest single-game fantasy points','trend','all',{week:false, decimals:1,
      value:function (l,c) { var e=extremes(c.player,c.scoring).low; return e ? e.points : null; }}),
    m('sd','Wk SD','Weekly fantasy-point standard deviation (lower is steadier)','trend','all',{week:false, decimals:1, dir:'asc',
      value:function (l,c) { return consistency(c.player,c.scoring).sd; }, missing:function () { return fewer(MIN_CONSISTENCY_GAMES); }}),
    m('volatility','Volatility','Weekly SD as a share of FP/G (lower is steadier)','trend','all',{week:false, format:'pct', decimals:0, dir:'asc',
      value:function (l,c) { return consistency(c.player,c.scoring).volatility; },
      missing:function (l,c) { return consistency(c.player,c.scoring).games < MIN_CONSISTENCY_GAMES ? fewer(MIN_CONSISTENCY_GAMES) : 'Average at or below zero points'; }}),

    m('passing','Pass yds','Passing yards','totals','passing',{value:function (l) { return l.ppyd; }}),
    m('ppydPg','Pass yds/G','Passing yards per game','usage','passing',{week:false, decimals:1, value:perGame('ppyd')}),
    m('passTD','Pass TD','Passing touchdowns','totals','passing',{value:function (l) { return l.pptd; }}),
    m('pptdPg','Pass TD/G','Passing touchdowns per game','usage','passing',{week:false, decimals:2, value:perGame('pptd')}),
    m('passINT','INT','Interceptions thrown','totals','passing',{dir:'asc', value:function (l) { return l.pint; }}),
    m('pintPg','INT/G','Interceptions thrown per game (lower is better)','usage','passing',{week:false, decimals:2, dir:'asc', value:perGame('pint')}),

    m('carries','Carries','Rushing attempts','totals','rushing',{value:function (l) { return l.car; }}),
    m('carPg','Car/G','Carries per game','usage','rushing',{week:false, decimals:1, value:perGame('car')}),
    m('rushing','Rush yds','Rushing yards','totals','rushing',{value:function (l) { return l.ruy; }}),
    m('ruyPg','Rush yds/G','Rushing yards per game','usage','rushing',{week:false, decimals:1, value:perGame('ruy')}),
    m('ypc','YPC','Yards per carry (rushing yards' + DIVIDE + 'carries)','efficiency','rushing',{decimals:1,
      value:function (l) { return ratio(l.ruy,l.car); }, missing:noVolume('carries'), qualifier:{field:'car', label:'carries'}}),
    m('rushTD','Rush TD','Rushing touchdowns','totals','rushing',{value:function (l) { return l.rut; }}),
    m('rutPg','Rush TD/G','Rushing touchdowns per game','usage','rushing',{week:false, decimals:2, value:perGame('rut')}),

    m('targets','Targets','Targets','totals','receiving',{value:function (l) { return l.tgt; }}),
    m('tgtPg','Tgt/G','Targets per game','usage','receiving',{week:false, decimals:1, value:perGame('tgt')}),
    m('receptions','Rec','Receptions','totals','receiving',{value:function (l) { return l.rec; }}),
    m('recPg','Rec/G','Receptions per game','usage','receiving',{week:false, decimals:1, value:perGame('rec')}),
    m('yards','Rec yds','Receiving yards','totals','receiving',{value:function (l) { return l.ry; }}),
    m('ryPg','Rec yds/G','Receiving yards per game','usage','receiving',{week:false, decimals:1, value:perGame('ry')}),
    m('catchPct','Catch %','Catch rate (receptions' + DIVIDE + 'targets)','efficiency','receiving',{format:'pct', decimals:1,
      value:function (l) { return ratio(l.rec,l.tgt); }, missing:noVolume('targets'), qualifier:{field:'tgt', label:'targets'}}),
    m('ypt','Y/Tgt','Yards per target (receiving yards' + DIVIDE + 'targets)','efficiency','receiving',{decimals:1,
      value:function (l) { return ratio(l.ry,l.tgt); }, missing:noVolume('targets'), qualifier:{field:'tgt', label:'targets'}}),
    m('ypr','Y/Rec','Yards per reception (receiving yards' + DIVIDE + 'receptions)','efficiency','receiving',{decimals:1,
      value:function (l) { return ratio(l.ry,l.rec); }, missing:noVolume('receptions'), qualifier:{field:'rec', label:'receptions'}}),
    m('recTD','Rec TD','Receiving touchdowns','totals','receiving',{value:function (l) { return l.rt; }}),
    m('rtPg','Rec TD/G','Receiving touchdowns per game','usage','receiving',{week:false, decimals:2, value:perGame('rt')}),

    m('touches','Touches','Touches (carries + receptions)','totals','touches',{value:function (l) { return l.car + l.rec; }}),
    m('touchPg','Touch/G','Touches per game (carries + receptions)','usage','touches',{week:false, decimals:1,
      value:function (l) { return ratio(l.car + l.rec, l.games); }}),
    m('ypTouch','Yds/Touch','Scrimmage yards per touch ((rush + rec yards)' + DIVIDE + 'touches)','efficiency','touches',{decimals:1,
      value:function (l) { return ratio(l.ruy + l.ry, l.car + l.rec); }, missing:noVolume('touches'),
      qualifier:{field:'touches', label:'touches'}}),

    m('fgm','FG made','Field goals made','totals','kicking',{value:function (l) { return l.fgm; }}),
    m('fgmPg','FG/G','Field goals made per game','usage','kicking',{week:false, decimals:2, value:perGame('fgm')}),
    m('xpm','PAT made','Extra points made','totals','kicking',{value:function (l) { return l.xpm; }}),
    m('xpmPg','PAT/G','Extra points made per game','usage','kicking',{week:false, decimals:2, value:perGame('xpm')}),

    m('sacks','Sacks','Defensive sacks','totals','defense',{decimals:1, value:function (l) { return l.sacks; }}),
    m('sacksPg','Sacks/G','Defensive sacks per game','usage','defense',{week:false, decimals:2, value:perGame('sacks')}),
    m('ints','INT','Interceptions','totals','defense',{value:function (l) { return l.ints; }}),
    m('intsPg','INT/G','Interceptions per game','usage','defense',{week:false, decimals:2, value:perGame('ints')}),
    m('fr','FR','Fumble recoveries','totals','defense',{value:function (l) { return l.fr; }}),
    m('frPg','FR/G','Fumble recoveries per game','usage','defense',{week:false, decimals:2, value:perGame('fr')}),
    m('pa','Pts allowed','Points allowed (scoreboard-based estimate)','totals','defense',{dir:'asc', value:function (l) { return l.pa; }}),
    m('paPg','PA/G','Points allowed per game (lower is better)','usage','defense',{week:false, decimals:1, dir:'asc', value:perGame('pa')})
  ];
  var BY_KEY = {};
  METRICS.forEach(function (def) { BY_KEY[def.key] = def; });

  var TREND = ['last3','last5','sd','high','low'];
  var TABLE_COLUMNS = {
    season: {
      ALL: ['games','points','ppg','targets','receptions','carries','yards','passing'].concat(TREND),
      QB: ['games','points','ppg','passing','ppydPg','passTD','passINT','carries','rushing','ypc','rushTD'].concat(TREND),
      RB: ['games','points','ppg','carries','carPg','rushing','ypc','rushTD','targets','tgtPg','receptions','recPg','catchPct','touchPg'].concat(TREND),
      WR: ['games','points','ppg','targets','tgtPg','receptions','recPg','catchPct','yards','ypt','ypr','recTD'].concat(TREND),
      K: ['games','points','ppg','fgm','fgmPg','xpm'].concat(TREND),
      DEF: ['games','points','ppg','sacks','ints','fr','pa','paPg'].concat(TREND)
    },
    week: {
      ALL: ['points','targets','receptions','carries','yards','passing'],
      QB: ['points','passing','passTD','passINT','carries','rushing','ypc','rushTD'],
      RB: ['points','carries','rushing','ypc','rushTD','targets','receptions','catchPct','yards','recTD','touches'],
      WR: ['points','targets','receptions','catchPct','yards','ypt','ypr','recTD'],
      K: ['points','fgm','xpm'],
      DEF: ['points','sacks','ints','fr','pa']
    }
  };
  TABLE_COLUMNS.season.TE = TABLE_COLUMNS.season.WR;
  TABLE_COLUMNS.week.TE = TABLE_COLUMNS.week.WR;
  var PROFILE_KEYS = {
    QB: ['passing','ppydPg','passTD','passINT','carries','rushing','ypc','rushTD'],
    RB: ['carries','carPg','rushing','ypc','targets','tgtPg','receptions','recPg','catchPct','yards','ypr','touchPg','ypTouch'],
    WR: ['targets','tgtPg','receptions','recPg','catchPct','yards','ryPg','ypt','ypr','recTD'],
    K: ['fgm','fgmPg','xpm','xpmPg'],
    DEF: ['sacks','sacksPg','ints','fr','pa','paPg']
  };
  PROFILE_KEYS.TE = PROFILE_KEYS.WR;
  var TREND_USAGE_KEYS = {
    QB: ['ppg','ppydPg','pptdPg','carPg','ruyPg'],
    RB: ['ppg','carPg','tgtPg','recPg','touchPg','ruyPg'],
    WR: ['ppg','tgtPg','recPg','ryPg','catchPct'],
    K: ['ppg','fgmPg','xpmPg'],
    DEF: ['ppg','sacksPg','intsPg','paPg']
  };
  TREND_USAGE_KEYS.TE = TREND_USAGE_KEYS.WR;
  var COMPARE_KEYS = {
    QB: ['ppydPg','pptdPg','pintPg','carPg','ruyPg','ypc','rutPg'],
    RB: ['carPg','ruyPg','ypc','tgtPg','recPg','ryPg','catchPct','ypr','touchPg','ypTouch','rutPg','rtPg'],
    WR: ['tgtPg','recPg','ryPg','catchPct','ypt','ypr','rtPg'],
    K: ['fgmPg','xpmPg'],
    DEF: ['sacksPg','intsPg','frPg','paPg']
  };
  COMPARE_KEYS.TE = COMPARE_KEYS.WR;
  var COMPARE_FANTASY = ['ppg','last3','last5','high','low','sd','volatility'];
  var SORT_GROUPS = [['fantasy','Fantasy'],['trend','Trends & consistency'],['usage','Per-game usage'],
    ['efficiency','Efficiency'],['totals','Totals']];

  function metric(key) { return BY_KEY[key] || null; }
  function applies(def, pos) { return !!def && def.applies.indexOf(pos) !== -1; }
  function context(player, options) {
    options = options || {};
    return {player: player, scoring: options.scoring || 'half', row: options.row || null,
      throughWeek: options.throughWeek || 0, mode: options.row ? 'week' : 'season'};
  }
  function lineFor(player, row) { return row ? weekLine(player, row) : seasonLine(player); }
  // Returns {value, missing}. value is null when the statistic is unavailable;
  // missing explains why so the UI never shows an unavailable value as zero.
  function evaluate(key, player, options) {
    var def = metric(key), c = context(player, options);
    if (!def) return {value: null, missing: 'Unknown statistic'};
    if (!applies(def, player.pos)) return {value: null, missing: 'Not applicable for ' + (player.pos === 'DEF' ? 'DST' : player.pos)};
    if (c.mode === 'week' ? !def.week : !def.season) return {value: null, missing: 'Season-only statistic'};
    var line = options && options.line ? options.line : lineFor(player, c.row);
    var value = def.value(line, c);
    if (value == null || !isFinite(value)) return {value: null, missing: def.missing ? def.missing(line, c) : 'Not recorded'};
    return {value: value, missing: null};
  }
  function compute(key, player, options) { return evaluate(key, player, options).value; }
  function qualifierThreshold(options) {
    return options && options.row ? QUALIFIER.singleGame : QUALIFIER.perSeasonWeek * Math.max(1, num(options && options.throughWeek));
  }
  function isQualified(key, player, options) {
    var def = metric(key);
    if (!def || !def.qualifier) return true;
    var line = lineFor(player, options && options.row);
    var volume = def.qualifier.field === 'touches' ? line.car + line.rec : line[def.qualifier.field];
    return volume >= qualifierThreshold(options);
  }
  function format(key, value) {
    var def = metric(key);
    if (value == null || !def) return null;
    if (def.format === 'pct') return (value * 100).toFixed(def.decimals) + '%';
    return value.toFixed(def.decimals);
  }
  function formatDiff(key, diff) {
    var def = metric(key);
    if (diff == null || !def) return null;
    var places = def.format === 'pct' ? def.decimals : Math.max(def.decimals, 1);
    var scaled = Math.abs(def.format === 'pct' ? diff * 100 : diff);
    if (Number(scaled.toFixed(places)) === 0) return 'Even';
    return (diff > 0 ? '+' : '\u2212') + scaled.toFixed(places) + (def.format === 'pct' ? ' pts' : '');
  }
  // Compares two values for sorting. Missing values always sort last.
  function compareValues(a, b, dir) {
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    return dir === 'asc' ? a - b : b - a;
  }
  function tableColumns(pos, mode) {
    var set = TABLE_COLUMNS[mode === 'week' ? 'week' : 'season'];
    return (set[pos] || set.ALL).slice();
  }
  function sortableMetrics(pos, mode) {
    var visible = tableColumns(pos, mode);
    return METRICS.filter(function (def) {
      if (def.key === 'games') return false;
      if (mode === 'week' ? !def.week : !def.season) return false;
      if (pos === 'ALL') return def.applies.length === ALL.length || visible.indexOf(def.key) !== -1;
      return applies(def, pos);
    });
  }
  // Last N recorded games versus every earlier recorded game in the same season.
  function usageTrend(player, scoring, windowSize) {
    var size = windowSize || RECENT_WINDOW, rows = sortedRows(player);
    if (rows.length < size + 2) return null;
    var recentRows = rows.slice(-size), priorRows = rows.slice(0, -size);
    var recent = sumLines(recentRows.map(function (r) { return weekLine(player, r); }));
    var prior = sumLines(priorRows.map(function (r) { return weekLine(player, r); }));
    var keys = TREND_USAGE_KEYS[player.pos] || ['ppg'];
    return {
      recentWeeks: recentRows.map(function (r) { return r[0]; }),
      priorWeeks: priorRows.map(function (r) { return r[0]; }),
      metrics: keys.map(function (key) {
        var a = evaluate(key, player, {scoring: scoring, line: recent}).value;
        var b = evaluate(key, player, {scoring: scoring, line: prior}).value;
        return {key: key, recent: a, prior: b, change: a == null || b == null ? null : a - b};
      })
    };
  }
  function comparisonPlan(posA, posB) {
    var same = posA === posB;
    var related = same || (SKILL.indexOf(posA) !== -1 && SKILL.indexOf(posB) !== -1);
    var positional = [];
    if (related) {
      (COMPARE_KEYS[posA] || []).concat(COMPARE_KEYS[posB] || []).forEach(function (key) {
        if (positional.indexOf(key) === -1 && applies(BY_KEY[key], posA) && applies(BY_KEY[key], posB)) positional.push(key);
      });
    }
    return {same: same, related: related, fantasy: COMPARE_FANTASY.slice(), positional: positional};
  }

  return {
    METRICS: METRICS, SORT_GROUPS: SORT_GROUPS, PROFILE_KEYS: PROFILE_KEYS, QUALIFIER: QUALIFIER,
    MIN_CONSISTENCY_GAMES: MIN_CONSISTENCY_GAMES, RECENT_WINDOW: RECENT_WINDOW,
    metric: metric, applies: applies, ratio: ratio, mean: mean, stdDev: stdDev,
    receptionAdjustment: receptionAdjustment, regularSeasonWeeks: regularSeasonWeeks, isSeasonComplete: isSeasonComplete,
    weekLine: weekLine, seasonLine: seasonLine, sumLines: sumLines, fantasyPoints: fantasyPoints,
    weeklyPoints: weeklyPoints, recentAverage: recentAverage, consistency: consistency, extremes: extremes,
    evaluate: evaluate, compute: compute, isQualified: isQualified, qualifierThreshold: qualifierThreshold,
    format: format, formatDiff: formatDiff, compareValues: compareValues,
    tableColumns: tableColumns, sortableMetrics: sortableMetrics, usageTrend: usageTrend, comparisonPlan: comparisonPlan
  };
});
