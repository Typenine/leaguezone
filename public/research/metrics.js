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

  // Optional advanced usage (scripts/build-research-usage.py, usage schema 1).
  // Rows keep raw numerators plus the denominators of the team the player
  // actually played for that week; shares are sum(player) / sum(team).
  var USAGE_INDEX = {att:2, cmp:3, pyd:4, car:5, tgt:6, rec:7, ay:8, yac:9};
  var USAGE_FIELDS = ['att','cmp','pyd','car','tgt','rec','ay','yac'];
  var TEAM_INDEX = {teamAtt:1, teamCar:2, teamTgt:3, teamAy:4};
  var TEAM_FIELDS = ['teamAtt','teamCar','teamTgt','teamAy'];
  function nullable(v) { return v == null || !isFinite(Number(v)) ? null : Number(v); }
  function uratio(a, b) { return a == null || b == null ? null : ratio(a, b); }
  function attachUsage(players, usage) {
    var teams = {}, attached = 0;
    Object.keys(usage.teams || {}).forEach(function (team) {
      usage.teams[team].forEach(function (r) { teams[team + ':' + r[0]] = r; });
    });
    players.forEach(function (p) {
      var rows = (usage.players || {})[p.id] || [];
      p.u = rows.map(function (r) {
        var t = teams[r[1] + ':' + r[0]], line = {week: r[0], team: r[1]};
        USAGE_FIELDS.forEach(function (f) { line[f] = nullable(r[USAGE_INDEX[f]]); });
        TEAM_FIELDS.forEach(function (f) { line[f] = t ? nullable(t[TEAM_INDEX[f]]) : null; });
        return line;
      }).sort(function (a, b) { return a.week - b.week; });
      if (rows.length) attached++;
    });
    return attached;
  }
  // Sums usage rows. A field is null if any row lacks it, so a partial total
  // is never presented as complete.
  function usageTotals(rows) {
    var t = {games: rows.length};
    USAGE_FIELDS.concat(TEAM_FIELDS).forEach(function (f) {
      t[f] = rows.reduce(function (s, r) { return s == null || r[f] == null ? null : s + r[f]; }, 0);
    });
    return t;
  }
  function usageRows(player, c) {
    if (!player.u) return null;
    if (c.usageRows) return c.usageRows;
    if (!c.row) return player.u;
    return player.u.filter(function (r) { return r.week === c.row[0]; });
  }
  function usageMissing(c) {
    return c.usageStatus === 'unavailable' ? 'Advanced usage not available for this season' :
      c.usageStatus === 'error' ? 'Advanced usage failed to load' : 'Advanced usage loading';
  }
  // Optional red-zone data (scripts/build-research-redzone.py, schema 1).
  // One line per base weekly row: player counts plus the denominators of the
  // team he played for that week. A missing player row with a present team row
  // is a real zero; a missing team row makes the whole week unavailable.
  var RZ_FIELDS = ['rzCar','i10Car','i5Car','rzRuTd','i10RuTd','i5RuTd','rzTgt','i10Tgt','i5Tgt','rzRec','rzReTd','i10ReTd','i5ReTd','rzAtt','i5Att','rzPaTd'];
  var RZ_TEAM_FIELDS = ['rzCar','i10Car','i5Car','rzTgt','i10Tgt','i5Tgt'];
  var RZ_POS = ['QB','RB','WR','TE'];
  function attachRedzone(players, data) {
    var teams = {}, pf = (data.fields || {}).player || [], tf = (data.fields || {}).team || [], attached = 0;
    Object.keys(data.teams || {}).forEach(function (team) {
      data.teams[team].forEach(function (r) { teams[team + ':' + r[0]] = r; });
    });
    players.forEach(function (p) {
      if (RZ_POS.indexOf(p.pos) === -1) return;
      var own = {};
      ((data.players || {})[p.id] || []).forEach(function (r) { own[r[0]] = r; });
      p.rz = sortedRows(p).map(function (w) {
        var t = teams[w[1] + ':' + w[0]], r = own[w[0]], line = {week: w[0], team: w[1]};
        RZ_FIELDS.forEach(function (f) {
          var i = pf.indexOf(f);
          line[f] = !t ? null : r && r[1] === w[1] ? nullable(r[i]) : 0;
        });
        RZ_TEAM_FIELDS.forEach(function (f) { line['team' + f.charAt(0).toUpperCase() + f.slice(1)] = t ? nullable(t[tf.indexOf(f)]) : null; });
        return line;
      });
      attached++;
    });
    return attached;
  }
  var RZ_TEAM_KEYS = RZ_TEAM_FIELDS.map(function (f) { return 'team' + f.charAt(0).toUpperCase() + f.slice(1); });
  function rzTotals(rows) {
    var t = {games: rows.length};
    RZ_FIELDS.concat(RZ_TEAM_KEYS).forEach(function (f) {
      t[f] = rows.reduce(function (s, r) { return s == null || r[f] == null ? null : s + r[f]; }, 0);
    });
    return t;
  }
  function rzRows(player, c) {
    if (!player.rz) return null;
    if (c.rzRows) return c.rzRows;
    if (!c.row) return player.rz;
    return player.rz.filter(function (r) { return r.week === c.row[0]; });
  }
  function rzMissing(c) {
    return c.rzStatus === 'unavailable' ? 'Red-zone data not available for this season' :
      c.rzStatus === 'error' ? 'Red-zone data failed to load' : 'Red-zone data loading';
  }
  function add(a, b) { return a == null || b == null ? null : a + b; }
  var METRICS = [
    m('games','GP','Games with a recorded stat (nflverse lists no row for games without one)','fantasy','all',{week:false, value:function (l) { return l.games; }}),
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
  function u(key, short, label, applies, options) { options.usage = true; return m(key, short, label, 'advanced', applies, options); }
  var PASS_QUAL = {field:'att', label:'pass attempts', perWeek:14, single:10};
  METRICS = METRICS.concat([
    u('att','Att','Pass attempts','passing',{value:function (l) { return l.att; }}),
    u('cmp','Cmp','Pass completions','passing',{value:function (l) { return l.cmp; }}),
    u('cmpPct','Comp %','Completion percentage (completions' + DIVIDE + 'pass attempts)','passing',{format:'pct', decimals:1,
      value:function (l) { return uratio(l.cmp,l.att); }, missing:noVolume('pass attempts'), qualifier:PASS_QUAL}),
    u('ypa','Y/A','Passing yards per attempt (passing yards' + DIVIDE + 'pass attempts; sacks are not attempts)','passing',{decimals:1,
      value:function (l) { return uratio(l.pyd,l.att); }, missing:noVolume('pass attempts'), qualifier:PASS_QUAL}),
    u('attPg','Att/G','Pass attempts per game','passing',{week:false, decimals:1, value:function (l) { return uratio(l.att,l.games); }}),
    u('cmpPg','Cmp/G','Completions per game','passing',{week:false, decimals:1, value:function (l) { return uratio(l.cmp,l.games); }}),
    u('tgtShare','Tgt share','Target share (player targets' + DIVIDE + 'team targets in the same games)','receiving',{format:'pct', decimals:1,
      value:function (l) { return uratio(l.tgt,l.teamTgt); }, missing:function () { return 'No team targets recorded'; }}),
    u('ay','Air yds','Air yards (yards downfield at the catch point on every target, caught or not)','receiving',{value:function (l) { return l.ay; }}),
    u('ayShare','AY share','Air-yards share (player air yards' + DIVIDE + 'team air yards in the same games)','receiving',{format:'pct', decimals:1,
      value:function (l) { return l.teamAy > 0 ? uratio(l.ay,l.teamAy) : null; }, missing:function () { return 'Team air yards not positive'; }}),
    u('adot','aDOT','Average depth of target (air yards' + DIVIDE + 'targets)','receiving',{decimals:1,
      value:function (l) { return uratio(l.ay,l.tgt); }, missing:noVolume('targets'), qualifier:{field:'tgt', label:'targets'}}),
    u('yac','YAC','Receiving yards after catch','receiving',{value:function (l) { return l.yac; }}),
    u('yacPerRec','YAC/Rec','Yards after catch per reception (YAC' + DIVIDE + 'receptions)','receiving',{decimals:1,
      value:function (l) { return uratio(l.yac,l.rec); }, missing:noVolume('receptions'), qualifier:{field:'rec', label:'receptions'}}),
    u('carShare','Car share','Carry share (player carries' + DIVIDE + 'team carries in the same games; team carries include QB scrambles and kneel-downs)','rushing',{format:'pct', decimals:1,
      value:function (l) { return uratio(l.car,l.teamCar); }, missing:function () { return 'No team carries recorded'; }})
  ]);
  function r(key, short, label, applies, options) { options.rz = true; return m(key, short, label, 'redzone', applies, options); }
  APPLIES.offense = RZ_POS;
  function rzv(f) { return function (l) { return l[f]; }; }
  function rzr(a, b) { return function (l) { return a(l) == null || b(l) == null ? null : ratio(a(l), b(l)); }; }
  function opp(z) { return function (l) { return add(l[z + 'Car'], l[z + 'Tgt']); }; }
  function teamOpp(z) { return function (l) { var Z = z.charAt(0).toUpperCase() + z.slice(1); return add(l['team' + Z + 'Car'], l['team' + Z + 'Tgt']); }; }
  function tds(z) { return function (l) { return add(l[z + 'RuTd'], l[z + 'ReTd']); }; }
  function none(label) { return function () { return 'No ' + label; }; }
  var RZQ = function (field, min, label) { return {field: field, min: min, minWeek: 2, label: label}; };
  METRICS = METRICS.concat([
    r('rzCar','RZ car','Red-zone carries (snapped at or inside the opponent 20; kneel-downs excluded)','rushing',{value:rzv('rzCar')}),
    r('i10Car','Car in 10','Carries snapped inside the opponent 10','rushing',{value:rzv('i10Car')}),
    r('i5Car','Car in 5','Goal-line carries (snapped inside the opponent 5)','rushing',{value:rzv('i5Car')}),
    r('rzRuTd','RZ rush TD','Rushing touchdowns on red-zone carries','rushing',{value:rzv('rzRuTd')}),
    r('rzCarShare','RZ car share','Red-zone carry share (player red-zone carries' + DIVIDE + 'team red-zone carries in the same games)','rushing',{format:'pct', decimals:1,
      value:rzr(rzv('rzCar'), rzv('teamRzCar')), missing:none('team red-zone carries')}),
    r('glCarShare','GL car share','Goal-line carry share (carries inside the 5' + DIVIDE + 'team carries inside the 5)','rushing',{format:'pct', decimals:1,
      value:rzr(rzv('i5Car'), rzv('teamI5Car')), missing:none('team goal-line carries')}),
    r('rzRuTdRate','RZ rush TD %','Red-zone rushing TD rate (red-zone rushing TDs' + DIVIDE + 'red-zone carries)','rushing',{format:'pct', decimals:1,
      value:rzr(rzv('rzRuTd'), rzv('rzCar')), missing:none('red-zone carries'), qualifier:RZQ('rzCar', 10, 'red-zone carries'), sample:'rzCar'}),
    r('rzTgt','RZ tgt','Red-zone targets (caught or not, snapped at or inside the opponent 20)','receiving',{value:rzv('rzTgt')}),
    r('i10Tgt','Tgt in 10','Targets snapped inside the opponent 10','receiving',{value:rzv('i10Tgt')}),
    r('i5Tgt','Tgt in 5','Goal-line targets (snapped inside the opponent 5)','receiving',{value:rzv('i5Tgt')}),
    r('rzRec','RZ rec','Red-zone receptions','receiving',{value:rzv('rzRec')}),
    r('rzReTd','RZ rec TD','Receiving touchdowns on red-zone targets','receiving',{value:rzv('rzReTd')}),
    r('rzTgtShare','RZ tgt share','Red-zone target share (player red-zone targets' + DIVIDE + 'team red-zone targets in the same games)','receiving',{format:'pct', decimals:1,
      value:rzr(rzv('rzTgt'), rzv('teamRzTgt')), missing:none('team red-zone targets')}),
    r('rzTgtTdRate','RZ tgt TD %','Red-zone target TD rate (red-zone receiving TDs' + DIVIDE + 'red-zone targets)','receiving',{format:'pct', decimals:1,
      value:rzr(rzv('rzReTd'), rzv('rzTgt')), missing:none('red-zone targets'), qualifier:RZQ('rzTgt', 10, 'red-zone targets'), sample:'rzTgt'}),
    r('rzOpp','RZ opp','Red-zone opportunities (carries + targets)','offense',{value:opp('rz')}),
    r('i10Opp','Opp in 10','Opportunities inside the 10 (carries + targets)','offense',{value:opp('i10')}),
    r('i5Opp','GL opp','Goal-line opportunities (carries + targets inside the 5)','offense',{value:opp('i5')}),
    r('rzOppPg','RZ opp/G','Red-zone opportunities per game with stats','offense',{week:false, decimals:1, value:function (l) { return opp('rz')(l) == null ? null : ratio(opp('rz')(l), l.games); }}),
    r('i5OppPg','GL opp/G','Goal-line opportunities per game with stats','offense',{week:false, decimals:2, value:function (l) { return opp('i5')(l) == null ? null : ratio(opp('i5')(l), l.games); }}),
    r('rzOppShare','RZ opp share','Red-zone opportunity share (player carries + targets' + DIVIDE + 'team carries + targets in the red zone, same games)','offense',{format:'pct', decimals:1,
      value:rzr(opp('rz'), teamOpp('rz')), missing:none('team red-zone opportunities')}),
    r('glOppShare','GL opp share','Goal-line opportunity share (player carries + targets' + DIVIDE + 'team carries + targets inside the 5)','offense',{format:'pct', decimals:1,
      value:rzr(opp('i5'), teamOpp('i5')), missing:none('team goal-line opportunities')}),
    r('rzTd','RZ TD','Red-zone rushing + receiving touchdowns (passing TDs excluded)','offense',{value:tds('rz')}),
    r('i5Td','GL TD','Rushing + receiving touchdowns on goal-line opportunities','offense',{value:tds('i5')}),
    r('rzTdPerOpp','RZ TD/opp','Red-zone touchdowns per opportunity (red-zone TDs' + DIVIDE + 'red-zone opportunities)','offense',{format:'pct', decimals:1,
      value:rzr(tds('rz'), opp('rz')), missing:none('red-zone opportunities'), qualifier:RZQ('rzOpp', 10, 'red-zone opportunities'), sample:'rzOpp'}),
    r('i5TdRate','GL TD %','Goal-line conversion (goal-line TDs' + DIVIDE + 'goal-line opportunities)','offense',{format:'pct', decimals:1,
      value:rzr(tds('i5'), opp('i5')), missing:none('goal-line opportunities'), qualifier:RZQ('i5Opp', 5, 'goal-line opportunities'), sample:'i5Opp'}),
    r('rzAtt','RZ pass att','Red-zone pass attempts (sacks excluded)','passing',{value:rzv('rzAtt')}),
    r('i5Att','Pass att in 5','Pass attempts inside the opponent 5','passing',{value:rzv('i5Att')}),
    r('rzPaTd','RZ pass TD','Passing touchdowns thrown from the red zone','passing',{value:rzv('rzPaTd')}),
    r('rzPaTdRate','RZ pass TD %','Red-zone passing TD rate (red-zone passing TDs' + DIVIDE + 'red-zone pass attempts)','passing',{format:'pct', decimals:1,
      value:rzr(rzv('rzPaTd'), rzv('rzAtt')), missing:none('red-zone pass attempts'), qualifier:RZQ('rzAtt', 20, 'red-zone pass attempts'), sample:'rzAtt'})
  ]);
  function rzVolume(field, l) { return field === 'rzOpp' ? opp('rz')(l) : field === 'i5Opp' ? opp('i5')(l) : l[field]; }
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
  // Advanced usage view: opportunity columns, loaded on demand.
  var USAGE_COLUMNS = {
    season: {
      ALL: ['games','points','ppg','tgtShare','carShare','ayShare','adot'],
      QB: ['games','points','ppg','att','cmp','cmpPct','ypa','attPg','cmpPg','carShare'],
      RB: ['games','points','ppg','carShare','carPg','tgtShare','tgtPg','yac','yacPerRec'],
      WR: ['games','points','ppg','tgtShare','tgtPg','ay','ayShare','adot','yac','yacPerRec']
    },
    week: {
      ALL: ['points','tgtShare','carShare','ayShare','adot'],
      QB: ['points','att','cmp','cmpPct','ypa','carShare'],
      RB: ['points','carShare','carries','tgtShare','targets','yac'],
      WR: ['points','targets','tgtShare','ay','ayShare','adot','yac']
    }
  };
  USAGE_COLUMNS.season.TE = USAGE_COLUMNS.season.WR;
  USAGE_COLUMNS.week.TE = USAGE_COLUMNS.week.WR;
  var USAGE_PROFILE_KEYS = {
    QB: ['att','cmp','cmpPct','ypa','attPg','cmpPg','carShare'],
    RB: ['carShare','tgtShare','yac','yacPerRec'],
    WR: ['tgtShare','ay','ayShare','adot','yac','yacPerRec']
  };
  USAGE_PROFILE_KEYS.TE = USAGE_PROFILE_KEYS.WR;
  // Opportunity trend keys: recent vs earlier, shown as absolute change.
  var USAGE_TREND_KEYS = {
    QB: ['attPg','cmpPct','ypa','carShare'],
    RB: ['carShare','carPg','tgtShare','tgtPg'],
    WR: ['tgtShare','tgtPg','ayShare','adot']
  };
  USAGE_TREND_KEYS.TE = USAGE_TREND_KEYS.WR;
  var COMPARE_USAGE_KEYS = {
    QB: ['attPg','cmpPg','cmpPct','ypa','carShare'],
    RB: ['carShare','tgtShare','yacPerRec'],
    WR: ['tgtShare','ayShare','adot','yacPerRec']
  };
  COMPARE_USAGE_KEYS.TE = COMPARE_USAGE_KEYS.WR;
  var RZ_COLUMNS = {
    season: {
      ALL: ['games','points','ppg','rzOpp','rzOppPg','rzOppShare','i5Opp','rzTd','rzTdPerOpp'],
      QB: ['games','points','ppg','rzAtt','rzPaTd','rzPaTdRate','rzCar','i5Car','rzRuTd','rzCarShare'],
      RB: ['games','points','ppg','rzCar','i10Car','i5Car','rzCarShare','glCarShare','rzRuTd','rzRuTdRate','rzTgt','rzOppPg','rzOppShare'],
      WR: ['games','points','ppg','rzTgt','i10Tgt','i5Tgt','rzTgtShare','rzRec','rzReTd','rzTgtTdRate','rzOppPg']
    },
    week: {
      ALL: ['points','rzOpp','rzOppShare','i5Opp','rzTd'],
      QB: ['points','rzAtt','rzPaTd','rzCar','i5Car','rzRuTd'],
      RB: ['points','rzCar','i10Car','i5Car','rzCarShare','rzRuTd','rzTgt'],
      WR: ['points','rzTgt','i10Tgt','i5Tgt','rzTgtShare','rzRec','rzReTd']
    }
  };
  RZ_COLUMNS.season.TE = RZ_COLUMNS.season.WR; RZ_COLUMNS.week.TE = RZ_COLUMNS.week.WR;
  var GL_SEASON = ['games','points','i5Car','i5Tgt','i5Opp','i5OppPg','glOppShare','i5Td','i5TdRate'];
  var GL_COLUMNS = {season: {ALL: GL_SEASON, QB: GL_SEASON, RB: GL_SEASON, WR: GL_SEASON, TE: GL_SEASON},
    week: {ALL: ['points','i5Car','i5Tgt','i5Opp','glOppShare','i5Td']}};
  ['QB','RB','WR','TE'].forEach(function (pos) { GL_COLUMNS.week[pos] = GL_COLUMNS.week.ALL; });
  var VIEW_COLUMNS = {usage: USAGE_COLUMNS, redzone: RZ_COLUMNS, goalline: GL_COLUMNS};
  var RZ_PROFILE_KEYS = {
    QB: {Passing: ['rzAtt','i5Att','rzPaTd','rzPaTdRate'], Rushing: ['rzCar','i5Car','rzRuTd','rzCarShare']},
    RB: {'Goal line': ['i5Car','glCarShare','i5Opp','i5TdRate'], Rushing: ['rzCar','i10Car','rzCarShare','rzRuTd','rzRuTdRate'], Receiving: ['rzTgt','rzTgtShare','rzReTd']},
    WR: {Receiving: ['rzTgt','i10Tgt','i5Tgt','rzTgtShare','rzRec','rzReTd','rzTgtTdRate'], 'Goal line': ['i5Opp','glOppShare','i5TdRate']}
  };
  RZ_PROFILE_KEYS.TE = RZ_PROFILE_KEYS.WR;
  var RZ_TREND_KEYS = ['rzOppPg','rzOppShare','i5OppPg','glOppShare'];
  var COMPARE_RZ_KEYS = {
    QB: ['rzOppPg','rzCarShare','rzPaTdRate','rzTdPerOpp'],
    RB: ['rzOppPg','rzOppShare','rzCarShare','i5OppPg','glOppShare','rzTdPerOpp','i5TdRate'],
    WR: ['rzOppPg','rzOppShare','rzTgtShare','i5OppPg','glOppShare','rzTdPerOpp']
  };
  COMPARE_RZ_KEYS.TE = COMPARE_RZ_KEYS.WR;
  var COMPARE_RZ_TOTALS = ['rzOpp','i5Opp','rzTd'];
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
    ['efficiency','Efficiency'],['advanced','Advanced usage'],['redzone','Red zone'],['totals','Totals']];

  function metric(key) { return BY_KEY[key] || null; }
  function applies(def, pos) { return !!def && def.applies.indexOf(pos) !== -1; }
  function context(player, options) {
    options = options || {};
    return {player: player, scoring: options.scoring || 'half', row: options.row || null,
      throughWeek: options.throughWeek || 0, mode: options.row ? 'week' : 'season',
      usageStatus: options.usageStatus || null, usageRows: options.usageRows || null,
      rzStatus: options.rzStatus || null, rzRows: options.rzRows || null};
  }
  function lineFor(player, row) { return row ? weekLine(player, row) : seasonLine(player); }
  // Returns {value, missing}. value is null when the statistic is unavailable;
  // missing explains why so the UI never shows an unavailable value as zero.
  function evaluate(key, player, options) {
    var def = metric(key), c = context(player, options);
    if (!def) return {value: null, missing: 'Unknown statistic'};
    if (!applies(def, player.pos)) return {value: null, missing: 'Not applicable for ' + (player.pos === 'DEF' ? 'DST' : player.pos)};
    if (c.mode === 'week' ? !def.week : !def.season) return {value: null, missing: 'Season-only statistic'};
    var line;
    if (def.usage) {
      var rows = usageRows(player, c);
      if (!rows) return {value: null, missing: usageMissing(c)};
      if (!rows.length) return {value: null, missing: c.row ? 'No advanced usage row for this week' : 'No advanced usage rows'};
      line = usageTotals(rows);
    } else if (def.rz) {
      var zr = rzRows(player, c);
      if (!zr) return {value: null, missing: rzMissing(c)};
      if (!zr.length) return {value: null, missing: c.row ? 'No red-zone row for this week' : 'No games with stats'};
      line = rzTotals(zr);
    } else line = options && options.line ? options.line : lineFor(player, c.row);
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
    if (def.usage) {
      var c = context(player, options), rows = usageRows(player, c);
      if (!rows) return true;
      var vol = usageTotals(rows)[def.qualifier.field] || 0;
      var q = def.qualifier;
      return vol >= (q.perWeek ? (c.row ? q.single : q.perWeek * Math.max(1, num(c.throughWeek))) : qualifierThreshold(options));
    }
    if (def.rz) {
      var rc = context(player, options), zrows = rzRows(player, rc);
      if (!zrows) return true;
      return (rzVolume(def.qualifier.field, rzTotals(zrows)) || 0) >= (rc.row ? def.qualifier.minWeek : def.qualifier.min);
    }
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
  function tableColumns(pos, mode, view) {
    var extra = VIEW_COLUMNS[view];
    var set = (extra && (extra.season[pos] || pos === 'ALL') ? extra : TABLE_COLUMNS)[mode === 'week' ? 'week' : 'season'];
    return (set[pos] || set.ALL).slice();
  }
  function sortableMetrics(pos, mode, view) {
    var visible = tableColumns(pos, mode).concat(tableColumns(pos, mode, 'usage'), tableColumns(pos, mode, 'redzone'), tableColumns(pos, mode, 'goalline'));
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
    var usage = [];
    if (related) {
      (COMPARE_USAGE_KEYS[posA] || []).concat(COMPARE_USAGE_KEYS[posB] || []).forEach(function (key) {
        if (usage.indexOf(key) === -1 && applies(BY_KEY[key], posA) && applies(BY_KEY[key], posB)) usage.push(key);
      });
    }
    var redzone = [], redzoneTotals = [];
    if (related) {
      (COMPARE_RZ_KEYS[posA] || []).concat(COMPARE_RZ_KEYS[posB] || []).forEach(function (key) {
        if (redzone.indexOf(key) === -1 && applies(BY_KEY[key], posA) && applies(BY_KEY[key], posB)) redzone.push(key);
      });
      redzoneTotals = COMPARE_RZ_TOTALS.filter(function (key) { return applies(BY_KEY[key], posA) && applies(BY_KEY[key], posB); });
    }
    return {same: same, related: related, fantasy: COMPARE_FANTASY.slice(), positional: positional, usage: usage, redzone: redzone, redzoneTotals: redzoneTotals};
  }
  // Opportunity windows from recorded usage rows only (byes have no row).
  // window(n) = last n rows; trend = last n rows vs every earlier row. Changes
  // are absolute (percentage points for shares), never % change from a base.
  function usageWindow(player, key, n, options) {
    if (!player.u || player.u.length < n) return null;
    var o = {}; Object.keys(options || {}).forEach(function (k) { o[k] = options[k]; });
    o.usageRows = player.u.slice(-n); o.row = null;
    return compute(key, player, o);
  }
  function opportunityTrend(player, options, windowSize) {
    var size = windowSize || RECENT_WINDOW, rows = player.u;
    if (!rows || rows.length < size + 2) return null;
    var keys = (USAGE_TREND_KEYS[player.pos] || []);
    function at(sub, key) {
      var o = {}; Object.keys(options || {}).forEach(function (k) { o[k] = options[k]; });
      o.usageRows = sub; o.row = null;
      return def(key) ? compute(key, player, o) : null;
    }
    function def(key) { return metric(key) && metric(key).usage ? metric(key) : null; }
    var recentRows = rows.slice(-size), priorRows = rows.slice(0, -size);
    return {recentWeeks: recentRows.map(function (r) { return r.week; }), priorWeeks: priorRows.map(function (r) { return r.week; }),
      metrics: keys.map(function (key) {
        var a, b;
        if (def(key)) { a = at(recentRows, key); b = at(priorRows, key); }
        else {
          var weekRows = sortedRows(player), recentSet = recentRows.map(function (r) { return r.week; });
          var lr = sumLines(weekRows.filter(function (w) { return recentSet.indexOf(w[0]) !== -1; }).map(function (w) { return weekLine(player, w); }));
          var lp = sumLines(weekRows.filter(function (w) { return recentSet.indexOf(w[0]) === -1; }).map(function (w) { return weekLine(player, w); }));
          a = compute(key, player, {scoring: options && options.scoring, line: lr});
          b = compute(key, player, {scoring: options && options.scoring, line: lp});
        }
        return {key: key, recent: a, prior: b, change: a == null || b == null ? null : a - b};
      })};
  }

  // Red-zone windows and trends over recorded games only (byes have no row).
  function rzCopy(options, rows) { var o = {}; Object.keys(options || {}).forEach(function (k) { o[k] = options[k]; }); o.rzRows = rows; o.row = null; return o; }
  function rzWindow(player, key, n, options) {
    if (!player.rz || player.rz.length < n) return null;
    return compute(key, player, rzCopy(options, player.rz.slice(-n)));
  }
  function rzTrend(player, options, windowSize) {
    var size = windowSize || RECENT_WINDOW, rows = player.rz;
    if (!rows || rows.length < size + 2) return null;
    var recentRows = rows.slice(-size), priorRows = rows.slice(0, -size);
    return {recentWeeks: recentRows.map(function (r) { return r.week; }), priorWeeks: priorRows.map(function (r) { return r.week; }),
      metrics: RZ_TREND_KEYS.filter(function (k) { return applies(BY_KEY[k], player.pos); }).map(function (key) {
        var a = compute(key, player, rzCopy(options, recentRows)), b = compute(key, player, rzCopy(options, priorRows));
        return {key: key, recent: a, prior: b, change: a == null || b == null ? null : a - b};
      })};
  }
  // Denominator behind a rate, for small-sample labels.
  function sampleSize(key, player, options) {
    var def = metric(key);
    if (!def || !def.sample || !def.rz) return null;
    var c = context(player, options), rows = rzRows(player, c);
    return rows ? rzVolume(def.sample, rzTotals(rows)) : null;
  }
  var SMALL_SAMPLE = {rzCar: 10, rzTgt: 10, rzOpp: 10, i5Opp: 5, rzAtt: 20};
  return {
    attachRedzone: attachRedzone, rzTotals: rzTotals, rzWindow: rzWindow, rzTrend: rzTrend, sampleSize: sampleSize, SMALL_SAMPLE: SMALL_SAMPLE,
    RZ_PROFILE_KEYS: RZ_PROFILE_KEYS, RZ_COLUMNS: RZ_COLUMNS, GL_COLUMNS: GL_COLUMNS, RZ_POS: RZ_POS,
    attachUsage: attachUsage, usageTotals: usageTotals, usageWindow: usageWindow, opportunityTrend: opportunityTrend,
    USAGE_PROFILE_KEYS: USAGE_PROFILE_KEYS, USAGE_TREND_KEYS: USAGE_TREND_KEYS, USAGE_COLUMNS: USAGE_COLUMNS,
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
