'use strict';
(function () {
  var state = {
    year: null, latest: null, years: [], throughWeek: 0,
    cache: new Map(), players: [], byId: new Map(), requestId: 0,
    remoteBase: '', remoteCatalog: null, sourceMode: 'backup',
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
    var standard = [
      ['GP','games'], ['FP','points'], ['PPG','ppg']
    ];
    var extra = pos === 'QB' ? [
      ['Pass yds','passing'],['Pass TD','passTD'],['INT','passINT'],['Rush yds','rushing']
    ] : pos === 'RB' ? [
      ['Rush yds','rushing'],['Carries','carries'],['Targets','targets'],
      ['Receptions','receptions'],['Rush TD','rushTD']
    ] : pos === 'WR' || pos === 'TE' ? [
      ['Targets','targets'],['Receptions','receptions'],['Rec yds','yards'],['Rec TD','recTD']
    ] : pos === 'K' ? [
      ['FG made','fgm'],['PAT made','xpm']
    ] : pos === 'DEF' ? [
      ['Sacks','sacks'],['INT','ints'],['FR','fr'],['Pts allowed','pa']
    ] : [
      ['Targets','targets'],['Receptions','receptions'],['Carries','carries'],
      ['Rec yds','yards'],['Pass yds','passing']
    ];
    return standard.concat(extra);
  }
  function stat(p, key, row) {
    if (key === 'games') return row ? 1 : p.g;
    if (key === 'points') return score(p, row);
    if (key === 'ppg') return row ? score(p, row) : (p.g ? score(p)/p.g : 0);
    var season = {
      targets:'tgt', receptions:'rec', carries:'car', yards:'ry', rushing:'ruy',
      rushTD:'rut', recTD:'rt', passing:'ppyd', passTD:'pptd', passINT:'pint',
      fgm:'fgm', xpm:'xpm', sacks:'sacks', ints:'ints', fr:'fr', pa:'pa'
    };
    var weekIndex = {
      targets:4, receptions:3, carries:6, yards:5, rushing:7, passing:8,
      passTD:9, passINT:10, fgm:11, xpm:12, sacks:13, ints:14, fr:15, pa:16,
      rushTD:13, recTD:14
    };
    if (row && weekIndex[key] != null) return Number(row[weekIndex[key]]) || 0;
    return Number(p[season[key]]) || 0;
  }
  function sortableKeys() {
    return columns(state.position).filter(function (c) { return c[1] !== 'games'; }).concat([
      ['Touches','touches']
    ]);
  }
  function sortOptions() {
    var select = $('sort');
    var options = sortableKeys();
    if (!options.some(function (x) {return x[1] === state.sort;})) state.sort = 'points';
    select.innerHTML = options.map(function (x) {
      return '<option value="'+x[1]+'">'+escape(x[0])+'</option>';
    }).join('');
    select.value = state.sort;
  }
  function ranked() {
    var q = state.query.toLowerCase().trim();
    var list = state.players.filter(function (p) {
      return (!state.week || !!selectedRow(p)) &&
        (state.week || p.g >= state.games) &&
        (state.position === 'ALL' || p.pos === state.position) &&
        (!state.rookieOnly || p.ryr === state.year) &&
        (!q || p.n.toLowerCase().includes(q) || p.team.toLowerCase().includes(q));
    });
    return list.sort(function (a,b) {
      var ar = state.week ? selectedRow(a) : null, br = state.week ? selectedRow(b) : null;
      var av = state.sort === 'touches' ? stat(a,'carries',ar)+stat(a,'receptions',ar) : stat(a,state.sort,ar);
      var bv = state.sort === 'touches' ? stat(b,'carries',br)+stat(b,'receptions',br) : stat(b,state.sort,br);
      return bv-av || a.n.localeCompare(b.n);
    });
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
    var list = ranked(), cols = columns(state.position);
    $('result-count').textContent = list.length+(state.week?' weekly performances':' players');
    $('directory-title').textContent = state.year+' '+(state.week?'Week '+state.week:'Season')+' Fantasy Statistics';
    $('players-head').innerHTML = '<tr><th scope="col" class="sticky-name">Player</th>'+
      '<th scope="col">Pos</th><th scope="col">Team</th>'+
      cols.map(function (col) { return '<th class="num" scope="col">'+col[0]+'</th>'; }).join('')+
      '<th scope="col">Compare</th></tr>';
    var selected = list.slice(0,state.limit);
    $('players-body').innerHTML = selected.map(function (p) {
      var row=state.week?selectedRow(p):null;
      var checked=state.compare.some(function (x) {return x.id===p.id&&x.year===state.year;});
      return '<tr><td class="sticky-name"><button type="button" class="player-button" data-profile="'+escape(p.id)+'" data-year="'+state.year+'">'+escape(p.n)+
        '</button>'+(p.ryr===state.year?'<span class="rookie-mark">R</span>':'')+'</td>'+
        '<td><span class="position-chip">'+(p.pos==='DEF'?'DST':escape(p.pos))+'</span></td><td>'+escape(row?row[1]:p.team)+'</td>'+
        cols.map(function (col) {
          var v=stat(p,col[1],row);
          return '<td class="num">'+(col[1]==='points'||col[1]==='ppg'||col[1]==='sacks'?fmt(v):escape(v))+'</td>';
        }).join('')+'<td><input class="check" type="checkbox" aria-label="Compare '+escape(p.n)+' '+state.year+
        '" data-compare="'+escape(p.id)+'" '+(checked?'checked':'')+'></td></tr>';
    }).join('') || '<tr><td class="empty" colspan="'+(cols.length+4)+'">No results match these filters.</td></tr>';
    $('mobile-results').innerHTML = selected.map(function (p) {
      var row=state.week?selectedRow(p):null;
      return '<div class="mobile-result"><button type="button" class="mobile-name" data-profile="'+escape(p.id)+'" data-year="'+state.year+'">'+
        escape(p.n)+' <span class="subdued">'+escape(p.pos==='DEF'?'DST':p.pos)+' · '+escape(row?row[1]:p.team)+'</span></button>'+
        '<div class="mobile-stats"><span><b>'+fmt(stat(p,'points',row))+'</b> FP</span><span><b>'+
        fmt(stat(p,'ppg',row))+'</b> PPG</span><span><b>'+escape(stat(p,'games',row))+'</b> GP</span></div>'+
        '<label class="mobile-compare"><input type="checkbox" class="check" data-compare="'+escape(p.id)+'" '+
        (state.compare.some(function (x) {return x.id===p.id&&x.year===state.year;})?'checked':'')+'> Compare</label></div>';
    }).join('');
    $('shown-count').textContent = 'Showing '+selected.length+' of '+list.length;
    $('more').hidden = selected.length >= list.length;
    positionLeaders();
  }
  function metric(label,val) {
    return '<div class="metric"><span class="label">'+escape(label)+'</span><span class="value">'+escape(val)+'</span></div>';
  }
  function profileCols(p) {
    return columns(p.pos).filter(function (x) {return x[1]!=='ppg'&&x[1]!=='games';});
  }
  function trendSvg(p) {
    var values = p.w.map(function (w) { return {week:w[0],fp:score(p,w)}; });
    var positiveMax = Math.max(1, ...values.map(function (v) {return v.fp;}));
    var negativeMin = Math.min(0, ...values.map(function (v) {return v.fp;}));
    var low=Math.min(0,negativeMin), range=positiveMax-low||1;
    var width=720,height=220,l=36,r=15,t=16,b=30;
    var x=function (week) { return l+(week-1)/17*(width-l-r); };
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
    var ticks=[1,4,7,10,13,16,18].map(function (week) {
      return '<text x="'+x(week)+'" y="'+(height-7)+'" fill="#a2b1c5" text-anchor="middle" font-size="11">'+week+'</text>';
    }).join('');
    return '<div class="trend-chart"><svg viewBox="0 0 '+width+' '+height+'" role="img" aria-label="'+escape(p.n)+
      ' weekly fantasy points in '+state.year+'"><g>'+lines+'</g>'+
      (values.length>1?'<polyline points="'+coords+'" stroke="#76d5bb" stroke-width="2.5" fill="none"/>':'')+
      circles+ticks+'</svg></div>';
  }
  function renderProfile(p) {
    var container=$('profile');
    if (!p) {container.hidden=true; return;}
    var head=profileCols(p);
    var total=metric('Fantasy points',fmt(score(p)))+metric('Points/game',fmt(score(p)/p.g))+metric('Games played',p.g);
    total+=head.map(function (c) {return metric(c[0],c[1]==='points'?fmt(stat(p,c[1])):stat(p,c[1]));}).join('');
    var history=[...p.w].reverse();
    var logHead='<th>Week</th><th>Team</th>'+head.map(function (c) {return '<th class="num">'+c[0]+'</th>';}).join('');
    var logRows=history.map(function (w) {
      return '<tr><td>'+w[0]+'</td><td>'+escape(w[1])+'</td>'+
        head.map(function (c) {var v=stat(p,c[1],w);return '<td class="num">'+
          (c[1]==='points'||c[1]==='sacks'?fmt(v):escape(v))+'</td>';}).join('')+'</tr>';
    }).join('');
    container.innerHTML='<button type="button" class="crumb" id="return-list">← Back to players</button>'+
      '<div class="section-head"><div><div class="eyebrow">'+escape(p.pos==='DEF'?'DST':p.pos)+' · '+escape(p.team)+
      (p.ryr===state.year?' · Rookie':'')+'</div><h2>'+escape(p.n)+'</h2></div>'+
      '<button type="button" class="btn outline" data-add-profile="'+escape(p.id)+'" data-year="'+state.year+'">Compare this season</button></div>'+
      '<div class="profile-grid">'+total+'</div>'+
      '<section class="panel profile-section"><h2>Weekly performance</h2><p class="subdued">Fantasy points by regular-season week · '+escape(state.score.toUpperCase())+'</p>'+
      trendSvg(p)+'</section>'+
      '<section class="profile-section"><div class="section-head"><h2>Career history</h2><span class="subdued">Available LeagueZone seasons</span></div>'+
      '<div id="career-history" aria-live="polite" class="subdued">Loading historical seasons…</div></section>'+
      '<section class="profile-section"><h2>'+state.year+' game log</h2><div class="table-scroll game-log"><table><thead><tr>'+
      logHead+'</tr></thead><tbody>'+logRows+'</tbody></table></div></section>';
    container.hidden=false;
    var request=state.requestId,year=state.year;
    Promise.all(state.years.map(function (season) {
      return loadData(season).then(function (d) {
        return {year:season,player:d.players.find(function (x) {return x.id===p.id;})};
      }).catch(function () {return {year:season,error:true};});
    })).then(function (found) {
      if (request!==state.requestId || year!==state.year || !$('career-history')) return;
      var available=found.filter(function (f) {return f.player;});
      var errors=found.filter(function (f) {return f.error;});
      $('career-history').innerHTML=available.length?'<div class="table-scroll career-scroll"><table><thead><tr>'+
        '<th>Season</th><th>Team</th><th>GP</th><th class="num">FP</th><th class="num">PPG</th><th>Actions</th></tr></thead><tbody>'+
        available.map(function (f) {
          return '<tr><td>'+f.year+'</td><td>'+escape(f.player.team)+'</td><td>'+f.player.g+'</td><td class="num">'+
            fmt(f.player.p-pointAdjustment()*f.player.rec)+'</td><td class="num">'+
            fmt((f.player.p-pointAdjustment()*f.player.rec)/f.player.g)+'</td><td>'+
            '<a class="table-link" href="'+link(p.id,f.year)+'" data-career-nav="1">View</a> · '+
            '<button class="mini-link" type="button" data-add-profile="'+escape(p.id)+'" data-year="'+f.year+'">Compare</button>'+
            '</td></tr>';
        }).join('')+'</tbody></table></div>':'<p>No other season data found.</p>';
      if (errors.length) $('career-history').insertAdjacentHTML('beforeend','<p class="subdued">Some earlier seasons were unavailable.</p>');
    });
  }
  function renderCompare() {
    var panel=$('compare-panel');
    panel.hidden=!state.compare.length;
    if (!state.compare.length) return;
    $('compare-grid').innerHTML=state.compare.map(function (item) {
      var cached=state.cache.get(item.year);
      return '<div class="panel"><div class="eyebrow">'+escape(item.year+' · '+item.pos)+'</div>'+
        '<h2>'+escape(item.name)+'</h2>'+
        metric('Fantasy points',fmt(item.points-pointAdjustment()*item.rec))+
        metric('Points/game',fmt((item.points-pointAdjustment()*item.rec)/item.games))+
        metric('Games played',item.games)+
        metric('Team',item.team)+
        '<button type="button" class="mini-link" data-remove-compare="'+item.year+':'+escape(item.id)+'">Remove</button></div>';
    }).join('');
    $('compare-notice').textContent=state.compare.length===1?'Select one more player or season to compare.':
      'Comparing the selected seasons using '+state.score+' scoring.';
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
      state.compare.push({year:year,id:id,name:p.n,pos:p.pos,team:p.team,points:p.p,rec:p.rec,games:p.g});
      renderTable();renderCompare();
      if ($('compare-panel')) $('compare-panel').scrollIntoView({behavior:'smooth',block:'nearest'});
    }).catch(function (e) { $('error').hidden=false;$('error').textContent=e.message;});
  }
  function updateFilters() {
    state.query=$('search').value;state.position=$('position').value;
    state.score=$('scoring').value;state.games=Number($('games').value);
    state.week=Number($('week').value);state.rookieOnly=$('rookies').checked;
    sortOptions();state.sort=$('sort').value;state.limit=40;
    $('games').disabled=!!state.week;
    $('games-note').textContent=state.week?'Weekly rankings show players with a recorded game.':'';
    renderTable();renderCompare();
    if (/^\/research\/players\/[^/]+\/?$/.test(location.pathname)) renderRoute();
  }
  function populateWeeks() {
    $('week').innerHTML='<option value="0">Season totals</option>'+
      Array.from({length:state.throughWeek},function (_,i) {
        return '<option value="'+(i+1)+'">Week '+(i+1)+'</option>';
      }).join('');
    $('week').value='0';state.week=0;
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
    $('page-desc').textContent=match?'Historical performance, season comparisons and weekly game logs.':
      'Filter by season, week, position or rookies. Compare historical fantasy production and individual player statistics.';
    document.querySelectorAll('[data-nav]').forEach(function (a) {
      var key=a.dataset.nav;
      a.setAttribute('aria-current',
        (key==='research'&&path==='/research' || key==='players'&&path.endsWith('/players') ||
         key==='stats'&&path.includes('/stats'))?'page':'false');
    });
    document.title=(p?p.n+' Stats | ':'Fantasy Research | ')+'LeagueZone';
  }
  function navigate(url,replace) {
    var target=new URL(url,location.href);
    var year=Number(target.searchParams.get('season'))||state.latest;
    if (!state.years.includes(year)) year=state.latest;
    if (replace) history.replaceState({},'',target.pathname+target.search);
    else history.pushState({},'',target.pathname+target.search);
    if (year!==state.year) loadSeason(year);
    else {state.requestId++;renderRoute();}
    window.scrollTo({top:0,behavior:'smooth'});
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
      $('data-stamp').textContent=year+' Season · Through Week '+data.throughWeek+' · Updated '+data.updated+
        (data._researchSource==='r2'?' · R2 live data':' · Last validated backup');
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
    if (back) {navigate('/research/players?season='+state.year);return;}
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
  $('mobile-results').addEventListener('change',compareChanged);
  $('clear-compare').addEventListener('click',function () {state.compare=[];renderTable();renderCompare();});
  $('more').addEventListener('click',function () {state.limit+=40;renderTable();});
  ['search','position','scoring','games','week','rookies','sort'].forEach(function (id) {
    $(id).addEventListener(id==='search'?'input':'change',function () {
      if (id==='sort')state.sort=$('sort').value;
      updateFilters();
    });
  });
  $('year').addEventListener('change',function (e) {
    var year=Number(e.target.value);
    var path=location.pathname.match(/^\/research\/players\/[^/]+\/?$/)?'/research/players':location.pathname;
    navigate(path+'?season='+year,true);
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