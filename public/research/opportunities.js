'use strict';
// Shared, deterministic research calculations. No DOM, network, database, or
// browser storage. All signals are derived from games available as of week N.
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LZOpportunities = api;
})(typeof self !== 'undefined' ? self : this, function () {
  var POSITIONS = ['QB', 'RB', 'WR', 'TE'];
  var round = function (n) { return Math.round(n * 10) / 10; };
  var mean = function (rows, fn) { return rows.reduce(function (sum, row) { return sum + fn(row); }, 0) / rows.length; };
  function gameVolume(player, row) {
    if (player.pos === 'RB') return (Number(row[6]) || 0) + (Number(row[4]) || 0);
    return Number(row[4]) || 0;
  }
  function weeks(player, asOf) {
    return (player.w || []).filter(function (r) { return r[0] <= asOf; }).sort(function (a, b) { return a[0] - b[0]; });
  }
  function volume(player, row) {
    if (player.pos !== 'QB') return gameVolume(player, row);
    if (Number.isInteger(row[15]) && row[15] >= 0) return row[15];
    var usage = (player.u || []).find(function (u) { return u.week === row[0] && u.team === row[1]; });
    return usage && usage.att != null ? usage.att : null;
  }
  function metric(player) { return player.pos === 'QB' ? 'pass attempts' : player.pos === 'RB' ? 'carries + targets' : 'targets'; }
  function scoring(player, row, format) {
    var ppr = Number(row[2]) || 0, receptions = Number(row[3]) || 0;
    return ppr - (format === 'ppr' ? 0 : format === 'standard' ? 1 : 0.5) * receptions;
  }
  function threshold(previous) { return Math.max(1.5, previous * 0.15); }
  function signal(player, asOf, format) {
    if (POSITIONS.indexOf(player.pos) < 0) return null;
    var games = weeks(player, asOf);
    if (games.length < 4) return null;
    var prior = games.slice(-4, -2), recent = games.slice(-2);
    // A role from Week 13 must not be advertised as a current Week 18 signal.
    if (recent[1][0] < asOf - 1) return null;
    var baseline = prior.map(function (r) { return volume(player, r); });
    var current = recent.map(function (r) { return volume(player, r); });
    if (baseline.concat(current).some(function (v) { return v == null; })) return null;
    var before = mean(baseline, function (x) { return x; });
    var after = mean(current, function (x) { return x; });
    var minimum=player.pos==='QB'?15:player.pos==='RB'?5:3;
    if (Math.max(before,after)<minimum) return null;
    var diff = after - before, direction = diff >= threshold(before) ? 'rising' : diff <= -threshold(before) ? 'falling' : 'steady';
    var fpBefore = mean(prior, function (r) { return scoring(player, r, format); });
    var fpAfter = mean(recent, function (r) { return scoring(player, r, format); });
    var fpDiff = fpAfter - fpBefore;
    var scoringDirection = fpDiff > 2 ? 'up' : fpDiff < -2 ? 'down' : 'flat';
    return {id:player.id,name:player.n,team:player.team,pos:player.pos,week:asOf,
      baselineWeeks:prior.map(function (r) { return r[0]; }),recentWeeks:recent.map(function (r) { return r[0]; }),
      baseline:round(before),recent:round(after),change:round(diff),direction:direction,metric:metric(player),
      scoringBefore:round(fpBefore),scoringRecent:round(fpAfter),scoringChange:round(fpDiff),scoringDirection:scoringDirection,
      sample:4};
  }
  function radar(data, format, asOf) {
    var week = asOf == null ? data.throughWeek : asOf;
    return (data.players || []).map(function (p) { return signal(p,week,format); })
      .filter(function (s) { return s && s.direction !== 'steady'; })
      .sort(function (a,b) { return Math.abs(b.change)-Math.abs(a.change) || a.name.localeCompare(b.name); });
  }
  // An as-of-week historical replay. Signals cannot see a later game; a
  // resolved receipt compares the NEXT two recorded games against the two
  // games already known at the signal week. Missing games remain pending.
  function receipts(data, format) {
    var result=[];
    (data.players || []).forEach(function (p) {
      if (POSITIONS.indexOf(p.pos) < 0) return;
      var played=weeks(p,data.throughWeek);
      var lastSignalWeek=-100;
      played.forEach(function (r) {
        var s=signal(p,r[0],format);
        if (!s || s.direction==='steady' || r[0]-lastSignalWeek<3) return;
        lastSignalWeek=r[0];
        var next=played.filter(function (w) { return w[0]>r[0] && w[0]<=r[0]+3; }).slice(0,2);
        var future=next.map(function (w) { return volume(p,w); });
        var resolved=next.length===2 && future.every(function (x) { return x!=null; });
        var actual=resolved ? mean(future,function (x) { return x; }) : null;
        // A signal is confirmed if its elevated/reduced role persists for
        // two more games relative to the original pre-signal baseline.
        var difference=resolved ? actual-s.baseline : null;
        var confirmed=resolved ? s.direction==='rising' ? difference>=threshold(s.baseline) : difference<=-threshold(s.baseline) : null;
        result.push({signal:s, status:resolved?(confirmed?'confirmed':'not confirmed'):'unresolved',
          nextWeeks:next.map(function (w) { return w[0]; }),future:actual==null?null:round(actual),
          difference:difference==null?null:round(difference)});
      });
    });
    return result.sort(function (a,b) { return b.signal.week-a.signal.week || a.signal.name.localeCompare(b.signal.name); });
  }
  function summary(rows) {
    var settled=rows.filter(function (r) {return r.status!=='unresolved';});
    var confirmed=settled.filter(function (r) {return r.status==='confirmed';}).length;
    return {total:rows.length,resolved:settled.length,confirmed:confirmed,
      rate:settled.length?round(confirmed/settled.length*100):null};
  }
  function recordSignals(existing, data, format, recordedAt) {
    var ledger=(existing||[]).slice(), seen=new Set(ledger.map(function (r) {return r.key;}));
    // Only an active, incomplete season is eligible. The caller must explicitly
    // request capture on the current-season Radar; backtests never enter this log.
    if (data.throughWeek>=18 || data.throughWeek<4) return ledger;
    radar(data,format).forEach(function (s) {
      var key=data.year+':'+s.week+':'+s.id+':'+format;
      if (seen.has(key)) return;
      ledger.push({key:key,year:data.year,format:format,recordedAt:recordedAt,signal:s});seen.add(key);
    });
    return ledger;
  }
  function resolveRecorded(ledger, data) {
    return (ledger||[]).filter(function (r) {return r.year===data.year;}).map(function (entry) {
      var p=(data.players||[]).find(function (candidate) {return candidate.id===entry.signal.id;});
      var s=entry.signal, follow=p?weeks(p,data.throughWeek).filter(function (w) {
        return w[0]>s.week && w[0]<=s.week+3;
      }).slice(0,2):[];
      var values=p?follow.map(function (w) {return volume(p,w);}):[];
      var resolved=follow.length===2 && values.every(function (v) {return v!=null;});
      var future=resolved?mean(values,function (v) {return v;}):null;
      var difference=resolved?future-s.baseline:null;
      var confirmed=resolved?(s.direction==='rising' ? difference>=threshold(s.baseline) : difference<=-threshold(s.baseline)):null;
      return {signal:s,recordedAt:entry.recordedAt,status:resolved?(confirmed?'confirmed':'not confirmed'):'unresolved',
        nextWeeks:follow.map(function (w) {return w[0];}),future:future==null?null:round(future),
        difference:difference==null?null:round(difference)};
    }).sort(function (a,b) {return b.signal.week-a.signal.week || a.signal.name.localeCompare(b.signal.name);});
  }
  function development(seasons, playerId, format) {
    return seasons.map(function (d) {
      var p=(d.players||[]).find(function (x) { return x.id===playerId; });
      if (!p || !p.g) return null;
      var points=mean(p.w,function (w) {return scoring(p,w,format);});
      var opportunities=p.pos==='QB' ? null : mean(p.w,function (w) {return gameVolume(p,w);});
      return {year:d.year,throughWeek:d.throughWeek,id:p.id,name:p.n,pos:p.pos,team:p.team,
        careerYear:p.ryr!=null?d.year-p.ryr+1:null,games:p.g,pointsPerGame:round(points),
        opportunityPerGame:opportunities==null?null:round(opportunities),complete:d.throughWeek>=18};
    }).filter(Boolean).sort(function (a,b) {return a.year-b.year;});
  }
  function comparisons(seasons, target, format) {
    if (!target || target.careerYear==null || target.careerYear<1 || target.games<4) return [];
    return seasons.flatMap(function (d) {
      return (d.players||[]).filter(function (p) {
        return p.id!==target.id && p.pos===target.pos && p.ryr!=null && d.year-p.ryr+1===target.careerYear && p.g>=8 && d.throughWeek>=18;
      }).map(function (p) {
        var fp=mean(p.w,function (w) {return scoring(p,w,format);});
        return {year:d.year,id:p.id,name:p.n,pos:p.pos,games:p.g,pointsPerGame:round(fp),
          difference:round(fp-target.pointsPerGame)};
      });
    }).sort(function (a,b) {return Math.abs(a.difference)-Math.abs(b.difference) || a.name.localeCompare(b.name);}).slice(0,5);
  }
  // Provider IDs are not GSIS IDs. Join only on a unique normalized name,
  // position, and NFL team. Ambiguous or absent matches remain unclassified.
  function ownership(players, teams, providerPlayers, catalog) {
    var normalized=function (s) {return String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase();};
    var identityName=function (s) {return normalized(String(s||'').replace(/(?:\s+|\.)\b(?:Jr|Sr|II|III|IV|V)\.?$/i,''));};
    var identityTeam=function (s) {var t=String(s||'').toUpperCase();return {LA:'LAR',JAC:'JAX',WSH:'WAS'}[t]||t;};
    var key=function (p) {return [identityName(p.name||p.fullName||p.n),normalized(p.position||p.pos),identityTeam(p.team||p.nflTeam)].join(':');};
    var lookup=new Map(), byGsis=new Map();
    Object.keys(providerPlayers||{}).forEach(function (id) {
      var candidate=key(providerPlayers[id]);
      if (!lookup.has(candidate)) lookup.set(candidate,[]);
      lookup.get(candidate).push(id);
    });
    (catalog||[]).forEach(function (p) {
      var candidate=key(p);
      if (!lookup.has(candidate)) lookup.set(candidate,[]);
      if (lookup.get(candidate).indexOf(p.id)===-1) lookup.get(candidate).push(p.id);
      var gsis=String(p.gsisId||'').trim();
      if (gsis) {
        if (!byGsis.has(gsis)) byGsis.set(gsis,[]);
        byGsis.get(gsis).push(p.id);
      }
    });
    var teamById=new Map();
    (teams||[]).forEach(function (team) { (team.players||[]).forEach(function (id) {teamById.set(id,team);}); });
    return players.map(function (p) {
      var gsis=byGsis.get(p.id)||[];
      var ids=gsis.length===1?gsis:lookup.get(key(p))||[];
      // NFL team labels for recently traded players may lag. Never assign an
      // owner based on name alone when the identity is not exact.
      var id=ids.length===1?ids[0]:null;
      return {player:p,providerId:id,owner:id?(teamById.get(id)||null):null,
        match:id?(catalog&&catalog.some(function (x) {return x.id===id;})?'catalog':'roster'):'unmatched'};
    });
  }
  return {signal:signal,radar:radar,receipts:receipts,summary:summary,recordSignals:recordSignals,resolveRecorded:resolveRecorded,
    development:development,comparisons:comparisons,ownership:ownership};
});
