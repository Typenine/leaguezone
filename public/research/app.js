'use strict';
(function () {
  var state = {
    year: null, latest: null, years: [], throughWeek: 0,
    cache: new Map(), players: [], byId: new Map(), requestId: 0,
    remoteBase: '', remoteCatalog: null, sourceMode: 'backup',
    view: 'core', usage: new Map(), usageStatus: {}, usageManifest: null,
    score: 'half', query: '', position: 'ALL', sort: 'points',
    games: 1, week: 0, rookieOnly: false, limit: 40, compare: []
  };
  var $ = function (id) { return document.getElementById(id); };
  var escape = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return {'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c];
    });
  };
  var fmt = function (v, places) { return (Number(v) || 0).toFixed(places == null ? 1 : places); };
  var responseError = function (r) { if (!r.ok) throw Error('Research data is temporarily unavailable ('+r.status+')'); return r.json(); };
  var pointAdjustment = function () { return state.score === 'ppr' ? 0 : state.score === 'half' ? .5 : 1; };
  var score = function (p, row) { return row ? row[2] - pointAdjustment() * row[3] : p.p - pointAdjustment() * p.rec; };
  var link = function (id, year) { return '/research/players/'+encodeURIComponent(id)+'?season='+year; };
  var selectedRow = function (p) { return state.week ? p.w.find(function (w) { return w[0] === state.week; }) : null; };
  function validateData(d, year) {
    if (d.year !== year || !Array.isArray(d.players) || d.players.length < 100) {
      throw Error('Incomplete season file: '+year);
    }
    return d;
  }
  function remotePath(year) {
    var info=state.remoteCatalog&&state.remoteCatalog.files[String(year)];
    if (!info || !/^research\/v1\/objects\/20\d\d-[a-f0-9]{64}\.json$/.test(info.key)) return null;
    return state.remoteBase+'/'+info.key;
  }
  function loadData(year) {
    if (state.cache.has(year)) return state.cache.get(year);
    var url=remotePath(year);
    var localUrl='/research/data/'+year+'.json';
    var promise=url ?
      fetch(url, {cache:'default'}).then(responseError).then(function (d) {
        return validateData(d,year);
      }).then(function (d) {d._researchSource='r2';return d;})
      .catch(function () {
        // Last published, tested Vercel copy remains available during an R2 outage.
        return fetch(localUrl, {cache:'default'}).then(responseError).then(function (d) {
          d=validateData(d,year);d._researchSource='backup';return d;
        });
      }) :
      fetch(localUrl, {cache:'default'}).then(responseError).then(function (d) {
        d=validateData(d,year);d._researchSource='backup';return d;
      });
    state.cache.set(year,promise);
    promise.catch(function () {state.cache.delete(year);});
    return promise;
  }
  function catalogLooksValid(catalog) {
    if (!catalog || catalog.schema!==1 || !Array.isArray(catalog.years) ||
        !catalog.years.length || !catalog.files || typeof catalog.files!=='object') return false;
    return catalog.years.every(function (year) {
      var info=catalog.files[String(year)];
      return Number.isInteger(year) && year>=2000 &&
        info && /^research\/v1\/objects\/20\d\d-[a-f0-9]{64}\.json$/.test(info.key);
    });
  }
  function loadAvailableSeasons() {
    return fetch('/research/data-source.json', {cache:'no-store'}).then(responseError)
      .then(function (config) {
        var base=String(config.publicBase||'').replace(/\/+$/,'');
        if (!/^https:\/\/[^/]+$/i.test(base) || /\.r2\.dev$/i.test(new URL(base).hostname)) return null;
        return fetch(base+'/research/v1/catalog.json',{cache:'no-cache'}).then(responseError)
          .then(function (catalog) {
            if (!catalogLooksValid(catalog)) throw Error('Invalid research catalog');
            state.remoteBase=base;state.remoteCatalog=catalog;
            return {years:catalog.years,remote:true};
          }).catch(function () {return null;});
      }).catch(function () {return null;})
      .then(function (remote) {
        if (remote) return remote;
        return fetch('/research/data/seasons.json',{cache:'no-cache'}).then(responseError)
          .then(function (manifest) {return {years:manifest.years,remote:false};});
      });
  }
  function columns(pos) {
    return M.tableColumns(pos, state.week ? 'week' : 'season', state.view);
  }
  var M = window.LZResearchMetrics;
  var DASH = '\u2014';
  var SCORING_LABELS = {half:'Half PPR', ppr:'Full PPR', standard:'Standard'};
  state.listUrl = ''; state.listScroll = 0; state.pendingWeek = 0;
  state.rz = new Map(); state.rzStatus = {}; state.rzManifest = null;
  var RZ_VIEWS = ['redzone','goalline'];
  function opts(row) { return {scoring: state.score, row: row || null, throughWeek: state.throughWeek, usageStatus: state.usageStatus[state.year], rzStatus: state.rzStatus[state.year]}; }
  var USAGE_POS = ['QB','RB','WR','TE'];
  // Optional advanced usage: fetched only when a usage view, sort, profile or
  // comparison needs it; cached per season; failures leave core stats intact.
  // The same R2 catalog advertises base and advanced snapshots atomically.
  // Existing Vercel archives remain a fallback, but NEVER mix different weeks
  // or build versions. The fallback fails closed if the base has moved ahead.
  function advancedRemotePath(kind, year) {
    var group=state.remoteCatalog && state.remoteCatalog.datasets && state.remoteCatalog.datasets[kind];
    var info=group && group.schema===1 && group.files && group.files[String(year)];
    var base=state.remoteCatalog && state.remoteCatalog.files[String(year)];
    if (!info || !base || info.throughWeek!==base.throughWeek || info.baseUpdated!==base.updated ||
        !/^research\/v1\/objects\/20\d\d-[a-f0-9]{64}\.json$/.test(info.key)) return null;
    return state.remoteBase+'/'+info.key;
  }
  function advancedAvailability(kind, year) {
    var group=state.remoteCatalog && state.remoteCatalog.datasets && state.remoteCatalog.datasets[kind];
    if (group && group.schema===1 && group.years && group.years.indexOf(year)!==-1) return Promise.resolve(true);
    var name=kind==='usage'?'usageManifest':'rzManifest';
    if (!state[name]) state[name]=fetch('/research/data/'+kind+'/seasons.json',{cache:'no-cache'}).then(responseError);
    return state[name].then(function (manifest) {
      return !!(manifest && manifest.schema===1 && (manifest.years||[]).indexOf(year)!==-1);
    });
  }
  function fetchAdvanced(kind, year, base) {
    var remote=advancedRemotePath(kind, year);
    function valid(snapshot) {
      if (!snapshot || snapshot.schema!==1 || snapshot.year!==year) throw {unavailable:true};
      if (snapshot.throughWeek!==base.throughWeek || snapshot.baseUpdated!==base.updated) {
        throw {stale:true};
      }
      return snapshot;
    }
    function local() {
      return fetch('/research/data/'+kind+'/'+year+'.json',{cache:'default'}).then(responseError).then(valid);
    }
    // Prefer the matching immutable R2 object; only fall back to a matching
    // archived local copy if the remote object is temporarily inaccessible.
    return remote ? fetch(remote,{cache:'default'}).then(responseError).then(valid).catch(local) : local();
  }
  function ensureUsage(year) {
    if (state.usage.has(year)) return state.usage.get(year);
    state.usageStatus[year]='loading';
    var promise=advancedAvailability('usage',year).then(function (available) {
      if (!available) throw {unavailable:true};
      return loadData(year).then(function (base) {
        return fetchAdvanced('usage',year,base).then(function (snapshot) {
          M.attachUsage(base.players,snapshot);
        });
      });
    }).then(function () {state.usageStatus[year]='ready';}).catch(function (error) {
      state.usageStatus[year]=error && error.stale?'stale':error && error.unavailable?'unavailable':'error';
    }).then(function () {
      renderTable();renderCompare();
      if (/^\/research\/players\/[^/]+\/?$/.test(location.pathname)) renderRoute();
    });
    state.usage.set(year,promise);
    return promise;
  }
  function ensureRedzone(year) {
    if (state.rz.has(year)) return state.rz.get(year);
    state.rzStatus[year]='loading';
    var promise=advancedAvailability('redzone',year).then(function (available) {
      if (!available) throw {unavailable:true};
      return loadData(year).then(function (base) {
        return fetchAdvanced('redzone',year,base).then(function (snapshot) {
          M.attachRedzone(base.players,snapshot);
        });
      });
    }).then(function () {state.rzStatus[year]='ready';}).catch(function (error) {
      state.rzStatus[year]=error && error.stale?'stale':error && error.unavailable?'unavailable':'error';
    }).then(function () {
      renderTable();renderCompare();
      if (/^\/research\/players\/[^/]+\/?$/.test(location.pathname)) renderRoute();
    });
    state.rz.set(year,promise);
    return promise;
  }
  function rzNote(year) {
    var st = state.rzStatus[year || state.year];
    return st === 'ready' ? 'Red zone = plays snapped at or inside the opponent 20 (goal line: inside the 5), from nflverse play-by-play. Opportunities = carries + targets; a target counts whether or not it was caught. Two-point tries, kneel-downs and plays wiped out by penalties are excluded. Shares use the team he played for each week.' :
      st === 'stale' ? 'Red-zone figures are being updated to match the latest season statistics. Core and other available metrics remain usable.' :
      st === 'unavailable' ? 'Red-zone data is not available for '+(year || state.year)+'. Core statistics and advanced usage are unaffected.' :
      st === 'error' ? 'Red-zone data failed to load. Core statistics and advanced usage are unaffected.' : 'Loading red-zone data…';
  }
  function usageNote() {
    var st = state.usageStatus[state.year];
    return st === 'ready' ? 'Advanced usage from nflverse weekly player and team stats. Shares = player total ÷ team total in the same games (the team he played for that week).' :
      st === 'stale' ? 'Advanced usage is being updated to match the latest season statistics. Core statistics remain usable.' :
      st === 'unavailable' ? 'Advanced usage is not available for '+state.year+'. Core statistics are unaffected.' :
      st === 'error' ? 'Advanced usage failed to load. Core statistics are unaffected.' : 'Loading advanced usage…';
  }
  function evaluate(p, key, row) { return M.evaluate(key, p, opts(row)); }
  function stat(p, key, row) { return M.compute(key, p, opts(row)); }
  function shortPos(pos) { return pos === 'DEF' ? 'DST' : pos; }
  function missingMark(reason) {
    return '<span class="missing" title="'+escape(reason)+'"><span aria-hidden="true">'+DASH+'</span><span class="sr-only">'+escape(reason)+'</span></span>';
  }
  function display(p, key, row) {
    var r = evaluate(p, key, row);
    return r.value == null ? missingMark(r.missing) : escape(M.format(key, r.value));
  }
  function cell(p, key, row) {
    var qualified = M.isQualified(key, p, opts(row));
    var cls = 'num'+(key === state.sort ? ' sorted' : '')+(qualified ? '' : ' unqualified');
    return '<td class="'+cls+'"'+(qualified ? '' : ' title="Below qualifying volume for this ranking"')+'>'+display(p, key, row)+'</td>';
  }
  function sortOptions() {
    var defs = M.sortableMetrics(state.position, state.week ? 'week' : 'season');
    if (!defs.some(function (d) { return d.key === state.sort; })) state.sort = 'points';
    $('sort').innerHTML = M.SORT_GROUPS.map(function (group) {
      var items = defs.filter(function (d) { return d.group === group[0]; });
      return items.length ? '<optgroup label="'+escape(group[1])+'">'+items.map(function (d) {
        return '<option value="'+d.key+'">'+escape(d.label)+'</option>';
      }).join('')+'</optgroup>' : '';
    }).join('');
    $('sort').value = state.sort;
  }
  function ranked() {
    var q = state.query.toLowerCase().trim(), def = M.metric(state.sort) || M.metric('points');
    return state.players.filter(function (p) {
      return (!state.week || !!selectedRow(p)) &&
        (state.week || p.g >= state.games) &&
        (state.position === 'ALL' || p.pos === state.position) &&
        (!state.rookieOnly || p.ryr === state.year) &&
        (!q || p.n.toLowerCase().includes(q) || p.team.toLowerCase().includes(q));
    }).map(function (p) {
      var row = state.week ? selectedRow(p) : null;
      return {p: p, value: stat(p, def.key, row), qualified: M.isQualified(def.key, p, opts(row))};
    }).sort(function (a, b) {
      if ((a.value == null) !== (b.value == null)) return a.value == null ? 1 : -1;
      if (a.qualified !== b.qualified) return a.qualified ? -1 : 1;
      return M.compareValues(a.value, b.value, def.dir) || a.p.n.localeCompare(b.p.n);
    }).map(function (x) { return x.p; });
  }
  function sortContext() {
    var def = M.metric(state.sort);
    var parts = ['Sorted by '+def.label+(def.dir === 'asc' ? ', lowest first' : ', highest first'),
      SCORING_LABELS[state.score] || state.score,
      state.week ? 'Week '+state.week+' single-game stats' : 'Season stats; per-game values use recorded games only'];
    if (!state.week && state.games > 1) parts.push('Minimum '+state.games+' games');
    if (state.rookieOnly) parts.push('Verified rookies only');
    if (def.qualifier) parts.push('Under '+(def.rz ? (state.week ? def.qualifier.minWeek : def.qualifier.min) : M.qualifierThreshold({row: state.week ? true : null, throughWeek: state.throughWeek}))+
      ' '+def.qualifier.label+' listed after qualified players');
    $('sort-context').textContent = parts.join(' \u00b7 ');
  }
  function positionLeaders() {
    if (!$('leaders')) return;
    var cards = ['QB','RB','WR','TE','K','DEF'].map(function (pos) {
      var rankedPos = state.players.filter(function (p) {
        return p.pos === pos && (!state.week || !!selectedRow(p));
      }).sort(function (a,b) {
        return score(b,state.week?selectedRow(b):null)-score(a,state.week?selectedRow(a):null);
      });
      var p=rankedPos[0];
      return p ? '<button type="button" class="leader-card" data-profile="'+escape(p.id)+'" data-year="'+state.year+'">'+
        '<span class="pos">'+(pos==='DEF'?'DST':pos)+' LEADER</span><span class="name">'+escape(p.n)+'</span>'+
        '<span class="team">'+escape(p.team)+'</span><span class="value">'+fmt(score(p,state.week?selectedRow(p):null))+
        ' <span class="unit">FP</span></span></button>' : '';
    });
    $('leaders').innerHTML = cards.join('');
  }
  function renderTable() {
    var sortIsUsage = !!(M.metric(state.sort) && M.metric(state.sort).usage);
    if (sortIsUsage && state.view !== 'usage') { state.view = 'usage'; $('view').value = 'usage'; }
    var sortIsRz = !!(M.metric(state.sort) && M.metric(state.sort).rz);
    if (sortIsRz && RZ_VIEWS.indexOf(state.view) === -1) { state.view = 'redzone'; $('view').value = 'redzone'; }
    if (state.view === 'usage' && state.year) ensureUsage(state.year);
    if (RZ_VIEWS.indexOf(state.view) !== -1 && state.year) ensureRedzone(state.year);
    $('column-hint').textContent = {core:'Core production and efficiency',usage:'Passing, rushing and receiving opportunity',redzone:'Scoring opportunities inside the 20',goalline:'Scoring opportunities inside the 5'}[state.view]+
      (['K','DEF'].indexOf(state.position)!==-1 && state.view!=='core' ? ' · Advanced metrics focus on QB, RB, WR and TE' : '');
    $('usage-status').textContent = state.view === 'usage' ? usageNote() : RZ_VIEWS.indexOf(state.view) !== -1 ? rzNote() +
      (state.view === 'goalline' ? ' Conversion rates on fewer than 5 goal-line opportunities are listed after qualified players and are not predictive.' : '') : '';
    var list = ranked(), cols = columns(state.position), sortDef = M.metric(state.sort);
    $('result-count').textContent = list.length+(state.week?' weekly performances':' players');
    $('directory-title').textContent = state.year+' '+(state.week?'Week '+state.week:'Season')+' Fantasy Statistics';
    $('players-head').innerHTML = '<tr><th scope="col" class="sticky-name">Player</th>'+
      '<th scope="col">Pos</th><th scope="col">Team</th>'+
      cols.map(function (key) {
        var def = M.metric(key), active = key === state.sort;
        var sortable = key !== 'games';
        return '<th class="num'+(active?' sorted':'')+'" scope="col" title="'+escape(def.label)+'"'+
          (active?' aria-sort="'+(def.dir==='asc'?'ascending':'descending')+'"':'')+'>'+
          (sortable?'<button type="button" class="sort-head" data-sort-key="'+key+'">'+escape(def.short)+
            (active?(def.dir==='asc'?' \u25b2':' \u25bc'):'')+'</button>':escape(def.short))+'</th>';
      }).join('')+
      '<th scope="col">Compare</th></tr>';
    var selected = list.slice(0,state.limit);
    $('players-body').innerHTML = selected.map(function (p) {
      var row=state.week?selectedRow(p):null;
      var checked=state.compare.some(function (x) {return x.id===p.id&&x.year===state.year;});
      return '<tr><td class="sticky-name"><button type="button" class="player-button" data-profile="'+escape(p.id)+'" data-year="'+state.year+'">'+escape(p.n)+
        '</button>'+(p.ryr===state.year?'<span class="rookie-mark">R</span>':'')+'</td>'+
        '<td><span class="position-chip">'+escape(shortPos(p.pos))+'</span></td><td>'+escape(row?row[1]:p.team)+'</td>'+
        cols.map(function (key) { return cell(p, key, row); }).join('')+
        '<td><input class="check" type="checkbox" aria-label="Compare '+escape(p.n)+' '+state.year+
        '" data-compare="'+escape(p.id)+'" '+(checked?'checked':'')+'></td></tr>';
    }).join('') || '<tr><td class="empty" colspan="'+(cols.length+4)+'">No results match these filters.</td></tr>';
    var extraKey = ['points','ppg','games'].indexOf(state.sort) === -1 ? state.sort : null;
    $('mobile-results').innerHTML = selected.map(function (p) {
      var row=state.week?selectedRow(p):null;
      var stats='<span><b>'+fmt(stat(p,'points',row))+'</b> FP</span>'+
        (row?'<span><b>'+escape(row[0])+'</b> Week</span>':
          '<span><b>'+display(p,'ppg')+'</b> FP/G</span><span><b>'+escape(p.g)+'</b> Games</span>')+
        (extraKey?'<span class="sorted-stat"><b>'+display(p,extraKey,row)+'</b> '+escape(sortDef.short)+'</span>':'');
      var viewStats='';
      if (state.view!=='core' && ['QB','RB','WR','TE'].indexOf(p.pos)!==-1) {
        // The desktop table is hidden on phones, so render the selected
        // column view directly in each result card rather than only FP.
        var viewKeys=columns(p.pos).filter(function (key) {
          return ['games','points','ppg',extraKey].indexOf(key)===-1;
        }).slice(0,4);
        viewStats='<div class="mobile-view-stats" data-view="'+state.view+'">'+
          viewKeys.map(function (key) {
            var def=M.metric(key);
            return '<span class="mobile-view-metric" title="'+escape(def.label)+'"><b>'+display(p,key,row)+
              '</b><small>'+escape(def.short)+'</small></span>';
          }).join('')+'</div>';
      }
      return '<div class="mobile-result"><button type="button" class="mobile-name" data-profile="'+escape(p.id)+'" data-year="'+state.year+'">'+
        escape(p.n)+(p.ryr===state.year?' <span class="rookie-mark">R</span>':'')+' <span class="subdued">'+escape(shortPos(p.pos))+' \u00b7 '+escape(row?row[1]:p.team)+'</span></button>'+
        '<div class="mobile-stats">'+stats+'</div>'+viewStats+
        '<label class="mobile-compare"><input type="checkbox" class="check" data-compare="'+escape(p.id)+'" '+
        (state.compare.some(function (x) {return x.id===p.id&&x.year===state.year;})?'checked':'')+'> Compare</label></div>';
    }).join('') || (state.players.length ? '<p class="empty">No results match these filters.</p>' : '');
    $('shown-count').textContent = 'Showing '+selected.length+' of '+list.length;
    $('more').hidden = selected.length >= list.length;
    sortContext();
    positionLeaders();
    syncUrl();
  }
  function metric(label,val,note,missing) {
    return '<div class="metric"><span class="label">'+escape(label)+'</span><span class="value">'+
      (missing?missingMark(missing):escape(val))+'</span>'+(note?'<span class="note">'+escape(note)+'</span>':'')+'</div>';
  }
  function metricFor(p,key,label) {
    var r=evaluate(p,key);
    return metric(label||M.metric(key).label,M.format(key,r.value),null,r.value==null?r.missing:null);
  }
  function coverageNote(year,throughWeek) {
    return M.isSeasonComplete(year,throughWeek)?'Full regular season':'Through Week '+throughWeek+' (season in progress)';
  }
  function trendSvg(p) {
    var values = M.weeklyPoints(p, state.score).map(function (w) { return {week:w.week,fp:w.points}; });
    var avg = M.mean(values.map(function (v) {return v.fp;}));
    var positiveMax = Math.max(1, ...values.map(function (v) {return v.fp;}));
    var negativeMin = Math.min(0, ...values.map(function (v) {return v.fp;}));
    var low=Math.min(0,negativeMin), range=positiveMax-low||1;
    var lastWeek=Math.max(M.regularSeasonWeeks(state.year), ...values.map(function (v) {return v.week;}));
    var width=720,height=220,l=36,r=15,t=16,b=30;
    var x=function (week) { return l+(week-1)/(lastWeek-1)*(width-l-r); };
    var y=function (value) { return t+(positiveMax-value)/range*(height-t-b); };
    var coords = values.map(function (v) {return x(v.week).toFixed(1)+','+y(v.fp).toFixed(1);}).join(' ');
    var circles=values.map(function (v) {
      return '<circle cx="'+x(v.week)+'" cy="'+y(v.fp)+'" r="4" fill="#76d5bb"><title>Week '+
      v.week+': '+fmt(v.fp)+' fantasy points</title></circle>';
    }).join('');
    var lines=[0, .5, 1].map(function (pct) {
      var value=low+range*pct, ypos=y(value);
      return '<line x1="'+l+'" x2="'+(width-r)+'" y1="'+ypos+'" y2="'+ypos+'" stroke="#31445d"/>'+
        '<text x="0" y="'+(ypos+3)+'" fill="#a2b1c5" font-size="11">'+fmt(value,0)+'</text>';
    }).join('');
    var ticks=[1,4,7,10,13,16,lastWeek].map(function (week) {
      return '<text x="'+x(week)+'" y="'+(height-7)+'" fill="#a2b1c5" text-anchor="middle" font-size="11">'+week+'</text>';
    }).join('');
    var avgLine=avg==null?'':'<line class="avg-line" x1="'+l+'" x2="'+(width-r)+'" y1="'+y(avg)+'" y2="'+y(avg)+
      '" stroke="#e2bc71" stroke-dasharray="5 5"><title>Season average: '+fmt(avg)+' FP per recorded game</title></line>';
    return '<div class="trend-chart"><svg viewBox="0 0 '+width+' '+height+'" role="img" aria-label="'+escape(p.n)+
      ' weekly fantasy points in '+state.year+'"><g>'+lines+'</g>'+avgLine+
      (values.length>1?'<polyline points="'+coords+'" stroke="#76d5bb" stroke-width="2.5" fill="none"/>':'')+
      circles+ticks+'</svg></div>'+
      '<p class="subdued chart-key"><span class="key-dot"></span> Recorded games only (byes and missed games are skipped, not zero)'+
      (avg==null?'':' \u00b7 <span class="key-dash"></span> Season average '+fmt(avg)+' FP/G')+'</p>';
  }
  function recentForm(p) {
    var trend=M.usageTrend(p,state.score);
    if (!trend) return '<p class="subdued">Recent-versus-earlier usage needs at least '+(M.RECENT_WINDOW+2)+
      ' recorded games; '+escape(p.n)+' has '+p.g+' in '+state.year+'.</p>';
    var head='<thead><tr><th>Per game</th><th class="num">Last '+M.RECENT_WINDOW+' (Wk '+trend.recentWeeks.join(', ')+')</th>'+
      '<th class="num">Earlier '+trend.priorWeeks.length+' games</th><th class="num">Change</th></tr></thead>';
    var rows=trend.metrics.map(function (row) {
      var def=M.metric(row.key);
      var fmtVal=function (v) {return v==null?missingMark('Not recorded'):escape(M.format(row.key,v));};
      var change=M.formatDiff(row.key,row.change);
      var better=row.change==null||change==='Even'?'':((def.dir==='asc'?row.change<0:row.change>0)?' up':' down');
      return '<tr><td title="'+escape(def.label)+'">'+escape(def.short)+'</td><td class="num">'+fmtVal(row.recent)+'</td><td class="num">'+
        fmtVal(row.prior)+'</td><td class="num change'+better+'">'+(change==null?missingMark('Not comparable'):escape(change))+'</td></tr>';
    }).join('');
    return '<div class="table-scroll compact-table"><table class="recent-form">'+head+'<tbody>'+rows+'</tbody></table></div>'+
      '<p class="subdued">Compares the last '+M.RECENT_WINDOW+' recorded games with every earlier recorded game this season. '+
      'Bye weeks and missed games are excluded rather than counted as zero.</p>';
  }
  function careerUsageKeys(pos) {
    return {QB:['ppydPg','ruyPg'],RB:['touchPg','tgtPg'],WR:['tgtPg','ryPg'],TE:['tgtPg','ryPg'],K:['fgmPg'],DEF:['paPg']}[pos]||[];
  }
  var USAGE_WEEK_KEYS = {QB:['att','cmp','cmpPct','ypa','carShare'], RB:['carries','carShare','targets','tgtShare'],
    WR:['targets','tgtShare','ay','ayShare','adot','yac'], TE:['targets','tgtShare','ay','ayShare','adot','yac']};
  var USAGE_CHART_KEY = {QB:'att', RB:'carShare', WR:'tgtShare', TE:'tgtShare'};
  function usageVal(key,v) { return v==null?missingMark('Not recorded'):escape(M.format(key,v)); }
  function usageChart(p,key) {
    var pts=(p.u||[]).map(function (r) {
      var o=opts(); o.usageRows=[r]; return {week:r.week, team:r.team, v:M.compute(key,p,o)};
    });
    if (!pts.length) return '';
    var w=320,h=120,pad=18,max=Math.max.apply(null,pts.map(function (x) {return x.v||0;}).concat([0.0001]));
    var bw=(w-pad*2)/Math.max(state.throughWeek,1);
    var bars=pts.map(function (x) {
      var bh=x.v>0?(x.v/max)*(h-pad*2):0, bx=pad+(x.week-1)*bw;
      var label='Week '+x.week+' ('+x.team+'): '+(x.v==null?'not recorded':M.format(key,x.v));
      return '<rect x="'+bx.toFixed(1)+'" y="'+(h-pad-bh).toFixed(1)+'" width="'+Math.max(bw-2,2).toFixed(1)+'" height="'+bh.toFixed(1)+
        '"><title>'+escape(label)+'</title></rect>';
    }).join('');
    return '<div class="usage-chart"><svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+escape(p.n+' weekly '+M.metric(key).label.split(' (')[0]+' in '+state.year)+
      '">'+bars+'<text x="'+pad+'" y="12" class="axis">Max '+escape(M.format(key,max))+'</text></svg>'+
      '<p class="subdued">Weekly '+escape(M.metric(key).label.split(' (')[0].toLowerCase())+'. Gaps are weeks without stats (byes, inactive), not zero usage.</p></div>';
  }
  function usageSection(p) {
    var keys=M.USAGE_PROFILE_KEYS[p.pos];
    if (!keys) return '';
    ensureUsage(state.year);
    var st=state.usageStatus[state.year];
    var head='<section class="panel profile-section" id="usage-profile"><h2>Opportunity and usage</h2>'+
      '<p class="subdued">How much of the team\u2019s opportunity '+escape(p.n)+' received, measured separately from fantasy production. '+
      'Shares use the team he played for each week and only games with stats.</p>';
    if (st!=='ready') return head+'<p class="subdued" id="usage-state">'+escape(usageNote())+'</p></section>';
    var share=USAGE_CHART_KEY[p.pos], grid=keys.map(function (k) {return metricFor(p,k);}).join('');
    [3,5].forEach(function (n) {
      var v=M.usageWindow(p,share,n,opts());
      grid+=metric(M.metric(share).short+', last '+n,M.format(share,v),'Last '+n+' games with stats',v==null?'Needs '+n+'+ games with stats':null);
    });
    var t=M.opportunityTrend(p,opts());
    var trend=t?'<div class="table-scroll"><table class="usage-trend"><thead><tr><th>Opportunity</th><th class="num">Last 3</th><th class="num">Earlier</th><th class="num">Change</th></tr></thead><tbody>'+
      t.metrics.map(function (m) {
        return '<tr data-usage-trend="'+m.key+'"><td>'+escape(M.metric(m.key).label.split(' (')[0])+'</td><td class="num">'+usageVal(m.key,m.recent)+
          '</td><td class="num">'+usageVal(m.key,m.prior)+'</td><td class="num">'+(M.formatDiff(m.key,m.change)?escape(M.formatDiff(m.key,m.change)):missingMark('Not comparable'))+'</td></tr>';
      }).join('')+'</tbody></table></div><p class="subdued">Weeks '+t.recentWeeks.join(', ')+' vs. weeks '+t.priorWeeks.join(', ')+
      '. Share changes are percentage points, not percent growth.</p>':
      '<p class="subdued">Opportunity trends need at least '+(M.RECENT_WINDOW+2)+' games with stats.</p>';
    var wk=USAGE_WEEK_KEYS[p.pos], rows=[...p.w].sort(function (a,b) {return b[0]-a[0];});
    var table='<div class="table-scroll game-log"><table id="usage-weekly"><thead><tr><th>Week</th><th>Team</th>'+wk.map(function (k) {
      return '<th class="num" title="'+escape(M.metric(k).label)+'">'+escape(M.metric(k).short)+'</th>';}).join('')+'</tr></thead><tbody>'+
      rows.map(function (w) {return '<tr><td>'+w[0]+'</td><td>'+escape(w[1])+'</td>'+wk.map(function (k) {return '<td class="num">'+display(p,k,w)+'</td>';}).join('')+'</tr>';}).join('')+
      '</tbody></table></div>';
    return head+'<div class="profile-grid">'+grid+'</div><h3>Recent opportunity vs. earlier games</h3>'+trend+
      '<h3>Weekly opportunity</h3>'+usageChart(p,share)+table+'</section>';
  }
  function rzMetric(p,key,o) {
    var r=M.evaluate(key,p,o||opts()), def=M.metric(key), n=M.sampleSize(key,p,o||opts());
    var note=r.value!=null&&n!=null&&n<M.SMALL_SAMPLE[def.sample]?'Small sample ('+n+'): not predictive':null;
    return metric(def.label.split(' (')[0],M.format(key,r.value),note,r.value==null?r.missing:null);
  }
  function rzChart(p) {
    var rows=p.rz, h=150, pad=26, weeks=Math.max(state.throughWeek,1), w=Math.max(320,weeks*24+pad*2);
    var max=Math.max(1,...rows.map(function (r) {return (r.rzCar||0)+(r.rzTgt||0);}));
    var bw=Math.max(6,(w-pad*2)/weeks-6), y=function (v) {return h-pad-(v/max)*(h-pad*2);};
    var bars=rows.map(function (r) {
      var x=pad+(r.week-1)*(w-pad*2)/weeks+3, c=r.rzCar||0, t=r.rzTgt||0;
      return '<g data-rz-week="'+r.week+'"><title>Week '+r.week+' ('+escape(r.team)+'): '+c+' red-zone carries, '+t+' red-zone targets, '+
        ((r.i5Car||0)+(r.i5Tgt||0))+' inside the 5</title>'+
        '<rect class="rz-car" x="'+x+'" y="'+y(c)+'" width="'+bw+'" height="'+(h-pad-y(c))+'"></rect>'+
        '<rect class="rz-tgt" x="'+x+'" y="'+y(c+t)+'" width="'+bw+'" height="'+(y(c)-y(c+t))+'"></rect>'+
        '<text x="'+(x+bw/2)+'" y="'+(h-8)+'" text-anchor="middle">'+r.week+'</text></g>';
    }).join('');
    return '<div class="rz-chart"><svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+escape(p.n+' weekly red-zone carries and targets in '+state.year)+'">'+
      '<text x="4" y="14">'+max+'</text><line x1="'+pad+'" x2="'+(w-pad)+'" y1="'+(h-pad)+'" y2="'+(h-pad)+'"></line>'+bars+'</svg>'+
      '<p class="subdued"><span class="rz-key rz-car"></span> Carries <span class="rz-key rz-tgt"></span> Targets (stacked, per week). '+
      'Missing weeks are weeks without stats (byes, inactive), not zero opportunity.</p></div>';
  }
  function rzSection(p) {
    var groups=M.RZ_PROFILE_KEYS[p.pos];
    if (!groups) return '';
    ensureRedzone(state.year);
    var st=state.rzStatus[state.year];
    var head='<section class="panel profile-section" id="redzone-profile"><h2>Red-Zone and Goal-Line Usage</h2>'+
      '<p class="subdued">Scoring opportunity near the end zone, measured at the snap. '+(p.pos==='QB'?
        'Passing and rushing roles are shown separately; a passing touchdown is not counted as a QB carry or target.':
        'Rushing and receiving opportunities are shown separately; a target counts whether or not it was caught.')+'</p>';
    if (st!=='ready'||!p.rz) return head+'<p class="subdued" id="redzone-state">'+escape(rzNote())+'</p></section>';
    var t=M.rzTotals(p.rz), qb=p.pos==='QB';
    var zones=[['rz','Inside the 20'],['i10','Inside the 10'],['i5','Inside the 5']];
    var cnt=function (v) {return v==null?missingMark('Team totals missing for a week'):String(v);};
    var zoneTable='<div class="table-scroll"><table class="rz-zones" id="rz-zones"><thead><tr><th>Area</th><th class="num">Carries</th><th class="num">Rush TD</th>'+
      (qb?'':'<th class="num">Targets</th><th class="num">Rec TD</th>')+'<th class="num">Team share</th></tr></thead><tbody>'+
      zones.map(function (z) {
        var Z=z[0].charAt(0).toUpperCase()+z[0].slice(1), mine=qb?t[z[0]+'Car']:(t[z[0]+'Car']==null||t[z[0]+'Tgt']==null?null:t[z[0]+'Car']+t[z[0]+'Tgt']);
        var team=qb?t['team'+Z+'Car']:(t['team'+Z+'Car']==null||t['team'+Z+'Tgt']==null?null:t['team'+Z+'Car']+t['team'+Z+'Tgt']);
        var share=mine==null||!team?null:mine/team;
        return '<tr data-zone="'+z[0]+'"><td>'+z[1]+'</td><td class="num">'+cnt(t[z[0]+'Car'])+'</td><td class="num">'+cnt(t[z[0]+'RuTd'])+'</td>'+
          (qb?'':'<td class="num">'+cnt(t[z[0]+'Tgt'])+'</td><td class="num">'+cnt(t[z[0]+'ReTd'])+'</td>')+
          '<td class="num">'+(share==null?missingMark(team===0?'Team had no opportunities here':'Not recorded'):escape(M.format('rzOppShare',share)))+'</td></tr>';
      }).join('')+'</tbody></table></div><p class="subdued">Team share = '+(qb?'his carries \u00f7 team carries':'his carries + targets \u00f7 team carries + targets')+
      ' in the same area and games.</p>';
    var grid=Object.keys(groups).map(function (g) {
      return '<h3>'+escape(g)+'</h3><div class="profile-grid" data-rz-group="'+escape(g)+'">'+groups[g].map(function (k) {return rzMetric(p,k);}).join('')+'</div>';
    }).join('');
    var recent=[3,5].map(function (n) {
      return ['rzOppPg','rzOppShare'].map(function (k) {
        var v=M.rzWindow(p,k,n,opts());
        return metric(M.metric(k).short+', last '+n,M.format(k,v),'Last '+n+' games with stats',v==null?'Needs '+n+'+ games with stats':null);
      }).join('');
    }).join('');
    var tr=M.rzTrend(p,opts());
    var trend=tr?'<div class="table-scroll"><table class="rz-trend-table" id="rz-trend"><thead><tr><th>Opportunity</th><th class="num">Last 3</th><th class="num">Earlier</th><th class="num">Change</th></tr></thead><tbody>'+
      tr.metrics.map(function (m) {
        return '<tr data-rz-trend="'+m.key+'"><td>'+escape(M.metric(m.key).label.split(' (')[0])+'</td><td class="num">'+usageVal(m.key,m.recent)+
          '</td><td class="num">'+usageVal(m.key,m.prior)+'</td><td class="num">'+(M.formatDiff(m.key,m.change)?escape(M.formatDiff(m.key,m.change)):missingMark('Not comparable'))+'</td></tr>';
      }).join('')+'</tbody></table></div><p class="subdued">Weeks '+tr.recentWeeks.join(', ')+' vs. weeks '+tr.priorWeeks.join(', ')+'. Share changes are percentage points.</p>':
      '<p class="subdued">Red-zone trends need at least '+(M.RECENT_WINDOW+2)+' games with stats.</p>';
    var wk=qb?['rzAtt','rzPaTd','rzCar','i5Car','rzRuTd']:p.pos==='RB'?['rzCar','i5Car','rzRuTd','rzTgt','i5Tgt','rzReTd','rzOppShare']:['rzTgt','i10Tgt','i5Tgt','rzRec','rzReTd','rzTgtShare','rzOppShare'];
    var rows=[...p.w].sort(function (a,b) {return b[0]-a[0];});
    var table='<div class="table-scroll game-log"><table id="rz-weekly"><thead><tr><th>Week</th><th>Team</th>'+wk.map(function (k) {
      return '<th class="num" title="'+escape(M.metric(k).label)+'">'+escape(M.metric(k).short)+'</th>';}).join('')+'</tr></thead><tbody>'+
      rows.map(function (w) {return '<tr><td>'+w[0]+'</td><td>'+escape(w[1])+'</td>'+wk.map(function (k) {return '<td class="num">'+display(p,k,w)+'</td>';}).join('')+'</tr>';}).join('')+
      '</tbody></table></div>';
    return head+'<h3>Inside the 20, 10 and 5</h3>'+zoneTable+grid+
      '<p class="subdued">Opportunity volume and touchdown conversion are separate: 3 touchdowns on 12 goal-line carries is a different role from 3 on 3. '+
      'Rates on fewer than 10 opportunities (5 inside the 5, 20 pass attempts) are marked small sample and are not predictive.</p>'+
      '<h3>Recent red-zone opportunity</h3><div class="profile-grid">'+recent+'</div>'+trend+
      '<h3>Weekly red-zone opportunity</h3>'+(qb?'':rzChart(p))+table+'</section>';
  }
  function renderProfile(p) {
    var container=$('profile');
    if (!p) {container.hidden=true; return;}
    var ext=M.extremes(p,state.score), cons=M.consistency(p,state.score);
    var lowNote=ext.low?'Week '+ext.low.week:null, highNote=ext.high?'Week '+ext.high.week:null;
    var summary=metric('Fantasy points',fmt(score(p)),SCORING_LABELS[state.score])+
      metricFor(p,'ppg','Full-season average')+metric('Games with stats',p.g,'Games with a recorded stat')+
      metricFor(p,'last3','Last 3 games avg')+metricFor(p,'last5','Last 5 games avg')+
      metric('Season high',ext.high?fmt(ext.high.points):null,highNote,ext.high?null:'No recorded games')+
      metric('Season low',ext.low?fmt(ext.low.points):null,lowNote,ext.low?null:'No recorded games')+
      metric('Weekly std. dev.',cons.sd!=null?fmt(cons.sd):null,cons.sd!=null?'Lower is steadier':null,
        cons.sd!=null?null:'Needs '+M.MIN_CONSISTENCY_GAMES+'+ recorded games')+
      metricFor(p,'volatility','Volatility (SD / avg)');
    var positional=(M.PROFILE_KEYS[p.pos]||[]).map(function (key) {return metricFor(p,key);}).join('');
    var weekKeys=columns(p.pos).filter(function (k) {return k!=='games';});
    var history=[...p.w].sort(function (a,b) {return b[0]-a[0];});
    var logHead='<th>Week</th><th>Team</th>'+weekKeys.map(function (k) {
      return '<th class="num" title="'+escape(M.metric(k).label)+'">'+escape(M.metric(k).short)+'</th>';}).join('');
    var logRows=history.map(function (w) {
      return '<tr><td>'+w[0]+'</td><td>'+escape(w[1])+'</td>'+
        weekKeys.map(function (k) {return '<td class="num">'+display(p,k,w)+'</td>';}).join('')+'</tr>';
    }).join('');
    var complete=M.isSeasonComplete(state.year,state.throughWeek);
    var rookie=p.ryr===state.year?' \u00b7 Rookie':(p.ryr==null&&p.pos!=='DEF'?' \u00b7 Rookie status unverified':'');
    container.innerHTML='<button type="button" class="crumb" id="return-list">\u2190 Back to results</button>'+
      '<div class="section-head"><div><div class="eyebrow">'+escape(shortPos(p.pos))+' \u00b7 '+escape(p.team)+
      escape(rookie)+'</div><h2>'+escape(p.n)+'</h2></div>'+
      '<button type="button" class="btn outline" data-add-profile="'+escape(p.id)+'" data-year="'+state.year+'">Compare this season</button></div>'+
      (complete?'':'<p class="season-note" id="season-note">'+state.year+' season in progress: data through Week '+state.throughWeek+
        '. Totals are partial; use per-game and recent averages when comparing with completed seasons.</p>')+
      '<section class="profile-section" id="profile-summary"><h2>Fantasy production</h2>'+
      '<p class="subdued">'+escape(SCORING_LABELS[state.score])+' \u00b7 averages use recorded games only; bye weeks and missed games are not counted as zero.</p>'+
      '<div class="profile-grid">'+summary+'</div></section>'+
      '<section class="panel profile-section" id="recent-form"><h2>Recent usage vs. earlier games</h2>'+recentForm(p)+'</section>'+
      '<section class="profile-section" id="position-stats"><h2>'+escape(shortPos(p.pos))+' production and efficiency</h2>'+
      '<div class="profile-grid">'+positional+'</div>'+
      (p.pos==='DEF'?'<p class="subdued">DST points allowed are estimated from scoring by the opposing offense.</p>':'')+'</section>'+
      usageSection(p)+rzSection(p)+
      '<section class="panel profile-section"><h2>Weekly performance</h2><p class="subdued">Fantasy points by regular-season week \u00b7 '+
      escape(SCORING_LABELS[state.score])+'</p>'+trendSvg(p)+'</section>'+
      '<section class="profile-section"><div class="section-head"><h2>Career history</h2><span class="subdued">Available LeagueZone seasons</span></div>'+
      '<div id="career-history" aria-live="polite" class="subdued">Loading historical seasons\u2026</div></section>'+
      '<section class="profile-section"><h2>'+state.year+' game log</h2><div class="table-scroll game-log"><table><thead><tr>'+
      logHead+'</tr></thead><tbody>'+logRows+'</tbody></table></div></section>';
    container.hidden=false;
    renderCareer(p);
  }
  function renderCareer(p) {
    var request=state.requestId,year=state.year,usage=careerUsageKeys(p.pos);
    Promise.all(state.years.map(function (season) {
      return loadData(season).then(function (d) {
        return {year:season,throughWeek:d.throughWeek,player:d.players.find(function (x) {return x.id===p.id;})};
      }).catch(function () {return {year:season,error:true};});
    })).then(function (found) {
      if (request!==state.requestId || year!==state.year || !$('career-history')) return;
      var available=found.filter(function (f) {return f.player;});
      var errors=found.filter(function (f) {return f.error;});
      $('career-history').innerHTML=available.length?'<div class="table-scroll career-scroll"><table><thead><tr>'+
        '<th>Season</th><th>Actions</th><th>Team</th><th>GP</th><th class="num">FP</th><th class="num">PPG</th>'+
        usage.map(function (k) {return '<th class="num" title="'+escape(M.metric(k).label)+'">'+escape(M.metric(k).short)+'</th>';}).join('')+
        '<th>Coverage</th></tr></thead><tbody>'+
        available.map(function (f) {
          var o={scoring:state.score,throughWeek:f.throughWeek};
          var val=function (k) {var r=M.evaluate(k,f.player,o);return r.value==null?missingMark(r.missing):escape(M.format(k,r.value));};
          return '<tr'+(f.year===year?' class="current-row"':'')+'><td>'+f.year+'</td><td class="career-actions">'+
            '<a class="table-link" href="'+link(p.id,f.year)+'" data-career-nav="1">View</a> &middot; '+
            '<button class="mini-link" type="button" data-add-profile="'+escape(p.id)+'" data-year="'+f.year+'">Compare</button>'+
            '</td><td>'+escape(f.player.team)+'</td><td>'+f.player.g+'</td><td class="num">'+
            val('points')+'</td><td class="num">'+val('ppg')+'</td>'+
            usage.map(function (k) {return '<td class="num">'+val(k)+'</td>';}).join('')+
            '<td class="subdued">'+escape(coverageNote(f.year,f.throughWeek))+'</td></tr>';
        }).join('')+'</tbody></table></div>'+
        '<p class="subdued">Compare seasons by per-game values; totals for an in-progress season are partial.</p>':'<p>No other season data found.</p>';
      if (errors.length) $('career-history').insertAdjacentHTML('beforeend','<p class="subdued">Some earlier seasons were unavailable.</p>');
    });
  }
  function cmpOpts(item) { return {scoring:state.score,throughWeek:item.throughWeek,usageStatus:state.usageStatus[item.year],rzStatus:state.rzStatus[item.year]}; }
  function cmpVal(key,item) {
    var r=M.evaluate(key,item.player,cmpOpts(item));
    var n=M.sampleSize(key,item.player,cmpOpts(item)), def=M.metric(key);
    var small=r.value!=null&&n!=null&&n<M.SMALL_SAMPLE[def.sample];
    return {value:r.value,html:r.value==null?missingMark(r.missing):escape(M.format(key,r.value))+
      (small?' <span class="small-sample" title="Small sample: '+n+' opportunities">small sample ('+n+')</span>':'')};
  }
  function cmpRow(key,a,b) {
    var def=M.metric(key), va=cmpVal(key,a), vb=cmpVal(key,b);
    var diff=va.value!=null&&vb.value!=null?va.value-vb.value:null, text=M.formatDiff(key,diff);
    var lead=diff==null||text==='Even'?0:((def.dir==='asc'?diff<0:diff>0)?1:2);
    return '<div class="cmp-row" role="row" data-metric="'+key+'"><div class="cmp-label" role="rowheader">'+escape(def.label)+'</div>'+
      '<div class="cmp-val'+(lead===1?' lead':'')+'" role="cell"><span class="cmp-tag">A</span>'+va.html+'</div>'+
      '<div class="cmp-val'+(lead===2?' lead':'')+'" role="cell"><span class="cmp-tag">B</span>'+vb.html+'</div>'+
      '<div class="cmp-diff" role="cell"><span class="cmp-tag">A\u2212B</span>'+(text==null?missingMark('Not comparable: a value is missing'):escape(text))+'</div></div>';
  }
  function cmpSection(title,keys,a,b) {
    return keys.length?'<div class="cmp-section" role="rowgroup"><h3>'+escape(title)+'</h3>'+
      keys.map(function (k) {return cmpRow(k,a,b);}).join('')+'</div>':'';
  }
  function renderCompare() {
    var panel=$('compare-panel'), detail=$('compare-detail');
    panel.hidden=!state.compare.length;
    if (!state.compare.length) {detail.innerHTML='';return;}
    $('compare-grid').innerHTML=state.compare.map(function (item,i) {
      return '<div class="panel compare-card"><div class="eyebrow">'+(i?'B':'A')+' \u00b7 '+escape(item.year+' \u00b7 '+shortPos(item.pos))+'</div>'+
        '<h2>'+escape(item.name)+'</h2>'+
        metric('Fantasy points',fmt(M.compute('points',item.player,cmpOpts(item))),'Season total')+
        metric('Games with stats',item.player.g,coverageNote(item.year,item.throughWeek))+
        metric('Team',item.team)+
        '<button type="button" class="mini-link" data-remove-compare="'+item.year+':'+escape(item.id)+'">Remove</button></div>';
    }).join('');
    var label=SCORING_LABELS[state.score]||state.score;
    if (state.compare.length===1) {
      detail.innerHTML='';
      $('compare-notice').textContent='Select one more player or season to compare.';
      return;
    }
    var a=state.compare[0], b=state.compare[1], plan=M.comparisonPlan(a.pos,b.pos), notes=[];
    if (plan.usage.length) [a,b].forEach(function (x) { ensureUsage(x.year); });
    if (plan.redzone.length) [a,b].forEach(function (x) { ensureRedzone(x.year); });
    if (!plan.related) notes.push('Different position groups ('+shortPos(a.pos)+' vs '+shortPos(b.pos)+
      '): only fantasy scoring is compared. Position statistics are not comparable.');
    else if (!plan.same) notes.push('Different skill positions: only statistics recorded for both positions are compared.');
    var partial=[a,b].filter(function (x) {return !M.isSeasonComplete(x.year,x.throughWeek);});
    if (partial.length) notes.push(partial.map(function (x) {return x.year+' runs through Week '+x.throughWeek;})
      .filter(function (v,i,arr) {return arr.indexOf(v)===i;}).join('; ')+
      ' (season in progress). Rows use per-game and recent averages so partial and completed seasons compare fairly.');
    detail.innerHTML='<div class="cmp-notes">'+notes.map(function (n) {return '<p class="season-note">'+escape(n)+'</p>';}).join('')+'</div>'+
      '<div class="cmp-table" role="table" aria-label="Player comparison">'+
      '<div class="cmp-row cmp-head" role="row"><div role="columnheader">Statistic</div>'+
      '<div role="columnheader">A: '+escape(a.name+' '+a.year)+'</div><div role="columnheader">B: '+escape(b.name+' '+b.year)+'</div>'+
      '<div role="columnheader">Difference (A \u2212 B)</div></div>'+
      cmpSection('Fantasy production and consistency',plan.fantasy,a,b)+
      cmpSection('Per-game usage and efficiency',plan.positional,a,b)+
      (plan.usage.length?cmpSection('Opportunity shares and passing rates (per game or rate, never season totals)',plan.usage,a,b):'')+
      (plan.redzone.length?cmpSection('Red-zone and goal-line opportunity (per game, shares and conversion)',plan.redzone,a,b)+
        cmpSection('Red-zone season totals (context only; '+(a.player.g===b.player.g&&a.throughWeek===b.throughWeek?'same':'different')+' recorded games: '+a.player.g+' vs '+b.player.g+')',plan.redzoneTotals,a,b):'')+'</div>'+
      (plan.redzone.length?'<p class="subdued" id="rz-compare-note">'+escape(rzNote(a.year))+' Conversion rates marked small sample are descriptive only.</p>':'')+
      '<p class="subdued">Highlighted values are better. Lower is better for standard deviation, volatility and points allowed. '+
      'Recent averages use the last recorded games of each season.</p>';
    $('compare-notice').textContent='Comparing the selected seasons using '+label+' scoring.';
  }
  function addCompare(year,id) {
    var key=String(year)+':'+id;
    if (state.compare.some(function (x) {return x.year+':'+x.id===key;})) return;
    if (state.compare.length>=2) {
      $('compare-notice').textContent='Choose a maximum of two player-seasons. Clear a selection first.';
      $('compare-panel').hidden=false;
      return;
    }
    loadData(year).then(function (d) {
      var p=d.players.find(function (x) {return x.id===id;});
      if (!p || state.compare.some(function (x) {return x.year===year && x.id===id;})) return;
      state.compare.push({year:year,id:id,name:p.n,pos:p.pos,team:p.team,player:p,throughWeek:d.throughWeek});
      renderTable();renderCompare();
      if ($('compare-panel')) $('compare-panel').scrollIntoView({behavior:'smooth',block:'nearest'});
    }).catch(function (e) { $('error').hidden=false;$('error').textContent=e.message;});
  }
  function isListPath(path) { return /^\/research(\/players|\/stats)?\/?$/.test(path); }
  function filterSearch(year) {
    var s=new URLSearchParams();
    s.set('season',year||state.year);
    if (state.position!=='ALL') s.set('pos',state.position);
    if (state.score!=='half') s.set('scoring',state.score);
    if (state.sort!=='points') s.set('sort',state.sort);
    if (state.view!=='core') s.set('view',state.view);
    if (state.week) s.set('week',state.week);
    if (state.games!==1) s.set('min',state.games);
    if (state.rookieOnly) s.set('rookies','1');
    if (state.query.trim()) s.set('q',state.query.trim());
    return '?'+s.toString();
  }
  function syncUrl() {
    if (!isListPath(location.pathname) || !state.year) return;
    var next=location.pathname+filterSearch();
    if (next!==location.pathname+location.search) history.replaceState(history.state,'',next);
  }
  function setSelect(id,value,fallback) {
    var el=$(id), ok=Array.from(el.options).some(function (o) {return o.value===value;});
    el.value=ok?value:fallback;
    return el.value;
  }
  function readUrlFilters() {
    var s=new URLSearchParams(location.search);
    state.position=setSelect('position',s.get('pos')||'ALL','ALL');
    state.score=setSelect('scoring',s.get('scoring')||'half','half');
    state.games=Number(setSelect('games',s.get('min')||'1','1'));
    state.rookieOnly=$('rookies').checked=s.get('rookies')==='1';
    state.query=$('search').value=s.get('q')||'';
    state.sort=s.get('sort')||'points';
    state.view=setSelect('view',s.get('view')||'core','core');
    state.pendingWeek=Math.max(0,parseInt(s.get('week'),10)||0);
    state.limit=40;
  }
  function syncFilterNotes() {
    $('games').disabled=!!state.week;
    $('games-note').textContent=state.week?'Weekly rankings show players with a recorded game in Week '+state.week+'.':'';
  }
  function applyListState() {
    var wk=state.pendingWeek>=1&&state.pendingWeek<=state.throughWeek?state.pendingWeek:0;
    state.pendingWeek=0;$('week').value=String(wk);state.week=wk;
    sortOptions();syncFilterNotes();renderTable();renderCompare();
  }
  function updateFilters() {
    state.query=$('search').value;state.position=$('position').value;
    state.score=$('scoring').value;state.games=Number($('games').value);
    state.week=Number($('week').value);state.rookieOnly=$('rookies').checked;
    var requestedView=$('view').value;
    var viewChanged=requestedView!==state.view;
    state.sort=$('sort').value||state.sort;
    if (viewChanged) {
      var priorSort=M.metric(state.sort);
      if (priorSort && ((priorSort.usage && requestedView!=='usage') ||
          (priorSort.rz && RZ_VIEWS.indexOf(requestedView)===-1))) {
        state.sort='points';
      }
    }
    state.view=requestedView;sortOptions();state.limit=40;
    syncFilterNotes();
    renderTable();renderCompare();
    if (/^\/research\/players\/[^/]+\/?$/.test(location.pathname)) renderRoute();
  }
  function populateWeeks() {
    $('week').innerHTML='<option value="0">Season totals</option>'+
      Array.from({length:state.throughWeek},function (_,i) {
        return '<option value="'+(i+1)+'">Week '+(i+1)+'</option>';
      }).join('');
    var wk=state.pendingWeek>=1&&state.pendingWeek<=state.throughWeek?state.pendingWeek:0;
    state.pendingWeek=0;$('week').value=String(wk);state.week=wk;
    syncFilterNotes();
  }
  function renderRoute() {
    var path=location.pathname, match=path.match(/^\/research\/players\/([^/]+)\/?$/);
    var p=match?state.byId.get(decodeURIComponent(match[1])):null;
    $('overview').hidden=!!match || path.includes('/stats') || path.endsWith('/players');
    $('directory').hidden=!!match;
    if (match && !p) {
      $('profile').hidden=true;$('error').hidden=false;
      $('error').textContent='Player not found in this season. Choose another year or return to the directory.';
    } else { $('error').hidden=true;renderProfile(p); }
    $('page-title').textContent=match?(p?p.n:'Player not found'):
      path.includes('/stats')?'NFL fantasy stat leaders':path.endsWith('/players')?'Player research':'A clearer look at every player.';
    $('page-desc').textContent=match?'Recent form, efficiency, season comparisons and weekly game logs.':
      'Filter by season, week, position or rookies. Sort by per-game usage, efficiency, recent form and consistency.';
    document.querySelectorAll('[data-nav]').forEach(function (a) {
      var key=a.dataset.nav;
      a.setAttribute('aria-current',
        (key==='research'&&path==='/research' || key==='players'&&path.endsWith('/players') ||
         key==='stats'&&path.includes('/stats'))?'page':'false');
    });
    document.title=(p?p.n+' Stats | ':'Fantasy Research | ')+'LeagueZone';
  }
  function navigate(url,replace,scrollY) {
    var target=new URL(url,location.href);
    if (isListPath(location.pathname) && !isListPath(target.pathname)) {
      state.listPath=location.pathname;state.listScroll=window.scrollY;
    }
    var year=Number(target.searchParams.get('season'))||state.latest;
    if (!state.years.includes(year)) year=state.latest;
    if (replace) history.replaceState({},'',target.pathname+target.search);
    else history.pushState({},'',target.pathname+target.search);
    var list=isListPath(target.pathname);
    if (list) readUrlFilters();
    if (year!==state.year) loadSeason(year);
    else {state.requestId++;if (list) applyListState();renderRoute();}
    if (scrollY!=null && year===state.year) window.scrollTo(0,scrollY);
    else window.scrollTo({top:0,behavior:'smooth'});
  }
  function loadSeason(year) {
    if (!state.years.includes(year)) year=state.latest;
    state.year=year;state.players=[];state.byId=new Map();state.limit=40;
    $('year').value=String(year);
    $('data-stamp').textContent='Loading '+year+' statistics…';
    $('players-body').innerHTML='<tr><td class="empty">Loading season…</td></tr>';
    $('mobile-results').innerHTML='';
    $('leaders').innerHTML='<p class="empty">Loading season…</p>';
    $('profile').hidden=true;$('compare-panel').hidden=!state.compare.length;
    $('error').hidden=true;
    var token=++state.requestId;
    loadData(year).then(function (data) {
      if (token!==state.requestId) return;
      state.players=data.players;state.byId=new Map(data.players.map(function (p) {return [p.id,p];}));
      state.throughWeek=data.throughWeek;
      $('data-stamp').textContent=year+' Season · Through Week '+data.throughWeek+' · Updated '+data.updated;
      populateWeeks();sortOptions();renderTable();renderCompare();renderRoute();
      $('research-year-range').textContent=state.years[0]+'–'+state.latest;
    }).catch(function (error) {
      if (token!==state.requestId)return;
      $('data-stamp').textContent=year+' statistics unavailable';
      $('error').hidden=false;$('error').textContent=error.message||'Unable to load statistics';
      $('players-body').innerHTML='<tr><td class="empty">Unable to load statistics.</td></tr>';
    });
  }
  document.addEventListener('click',function (e) {
    var sortHead=e.target.closest('[data-sort-key]');
    if (sortHead) {state.sort=sortHead.dataset.sortKey;$('sort').value=state.sort;updateFilters();return;}
    var profile=e.target.closest('[data-profile]');
    if (profile) {navigate(link(profile.dataset.profile,Number(profile.dataset.year)));return;}
    var add=e.target.closest('[data-add-profile]');
    if (add) {addCompare(Number(add.dataset.year),add.dataset.addProfile);return;}
    var remove=e.target.closest('[data-remove-compare]');
    if (remove) {
      var key=remove.dataset.removeCompare;
      state.compare=state.compare.filter(function (x) {return x.year+':'+x.id!==key;});
      renderTable();renderCompare();return;
    }
    var back=e.target.closest('#return-list');
    if (back) {navigate((state.listPath||'/research/players')+filterSearch(),false,state.listScroll);return;}
    var anchor=e.target.closest('a[data-career-nav],a[href^="/research"]');
    if (anchor) {e.preventDefault();navigate(anchor.getAttribute('href'));return;}
  });
  function compareChanged(e) {
    var target=e.target.closest('[data-compare]');if (!target)return;
    var key=state.year+':'+target.dataset.compare;
    if (target.checked) addCompare(state.year,target.dataset.compare);
    else {state.compare=state.compare.filter(function (x) {return x.year+':'+x.id!==key;});renderTable();renderCompare();}
  }
  $('players-body').addEventListener('change',compareChanged);
  $('view').addEventListener('change',updateFilters);
  $('mobile-results').addEventListener('change',compareChanged);
  $('clear-compare').addEventListener('click',function () {state.compare=[];renderTable();renderCompare();});
  $('more').addEventListener('click',function () {state.limit+=40;renderTable();});
  $('reset-filters').addEventListener('click',function () {
    $('search').value='';$('position').value='ALL';$('view').value='core';$('scoring').value='half';$('games').value='1';
    $('week').value='0';$('rookies').checked=false;$('sort').value='points';state.sort='points';
    updateFilters();
  });
  ['search','position','scoring','games','week','rookies','sort'].forEach(function (id) {
    $(id).addEventListener(id==='search'?'input':'change',function () {
      if (id==='sort')state.sort=$('sort').value;
      updateFilters();
    });
  });
  $('year').addEventListener('change',function (e) {
    var year=Number(e.target.value);
    var path=location.pathname.match(/^\/research\/players\/[^/]+\/?$/)?'/research/players':location.pathname;
    if (state.week) state.pendingWeek=state.week;
    navigate(path+filterSearch(year),true);
  });
  if (isListPath(location.pathname)) readUrlFilters();
  window.addEventListener('popstate',function () {
    if (!isListPath(location.pathname)) return;
    readUrlFilters();
    var year=Number(new URLSearchParams(location.search).get('season'))||state.latest;
    if (year===state.year) applyListState();
  });
  window.addEventListener('popstate',function () {
    var year=Number(new URLSearchParams(location.search).get('season'))||state.latest;
    if (year!==state.year) loadSeason(year);
    else {state.requestId++;renderRoute();}
  });
  loadAvailableSeasons().then(function (manifest) {
    var years=(manifest.years||[]).filter(function (x) {return Number.isInteger(x)&&x>=2000;})
      .sort(function (a,b) {return a-b;});
    if (!years.length || new Set(years).size!==years.length) throw Error('Season index unavailable');
    state.years=years;state.latest=years[years.length-1];
    $('year').innerHTML=years.slice().reverse().map(function (y) {
      return '<option value="'+y+'">'+y+'</option>';
    }).join('');
    var preferred=Number(new URLSearchParams(location.search).get('season'));
    loadSeason(years.includes(preferred)?preferred:state.latest);
  }).catch(function (error) {
    $('error').hidden=false;$('error').textContent='Unable to load research seasons: '+error.message;
    $('data-stamp').textContent='Research unavailable';
  });
})();