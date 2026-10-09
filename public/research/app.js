'use strict';
(function () {
  var state = { players:[], byId:new Map(), score:'half', query:'', position:'ALL', sort:'points', games:1, limit:60, compare:new Set(), throughWeek:0 };
  var el = function(id){ return document.getElementById(id); };
  var escape = function(v){ return String(v==null?'':v).replace(/[&<>"']/g,function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); };
  var fmt = function(n,d){ return (Number(n)||0).toFixed(d==null?1:d); };
  function score(p) { return (p.p||0) - (state.score==='half'?.5*(p.rec||0):state.score==='standard'?(p.rec||0):0); }
  function ppg(p) { return p.g?score(p)/p.g:0; }
  function statistic(p,sort) {
    if(sort==='ppg')return ppg(p);
    if(sort==='targets')return p.tgt||0;
    if(sort==='touches')return (p.car||0)+(p.rec||0);
    if(sort==='yards')return p.ry||0;
    if(sort==='snaps')return p.snap||0;
    return score(p);
  }
  function profileUrl(id){return '/research/players/'+encodeURIComponent(id);}
  function positionLeaders() {
    var host=el('leaders');if(!host)return;
    host.innerHTML=['QB','RB','WR','TE','K'].map(function(pos){
      var list=state.players.filter(function(p){return p.pos===pos&&p.g>0}).sort(function(a,b){return score(b)-score(a)});
      var p=list[0];return p?'<button class="leader-card" data-profile="'+escape(p.id)+'"><span class="pos">'+pos+' LEADER</span><span class="name">'+escape(p.n)+'</span><span class="team">'+escape(p.team)+'</span><span class="value">'+fmt(score(p))+' <span class="unit">FP</span></span></button>':'';
    }).join('');
  }
  function filtered() {
    var q=state.query.toLowerCase().trim();
    return state.players.filter(function(p){return p.g>=state.games&&(state.position==='ALL'||p.pos===state.position)&&(!q||p.n.toLowerCase().includes(q)||p.team.toLowerCase().includes(q));})
      .sort(function(a,b){return statistic(b,state.sort)-statistic(a,state.sort)||a.n.localeCompare(b.n);});
  }
  function renderTable() {
    var list=filtered(); el('result-count').textContent=list.length+' players';
    var subset=list.slice(0,state.limit);
    el('players-body').innerHTML=subset.map(function(p){
      return '<tr><td><button class="player-button" data-profile="'+escape(p.id)+'">'+escape(p.n)+'</button></td>'+
      '<td><span class="position-chip">'+escape(p.pos)+'</span></td><td>'+escape(p.team)+'</td>'+
      '<td class="num">'+p.g+'</td><td class="num">'+fmt(score(p))+'</td><td class="num">'+fmt(ppg(p))+'</td>'+
      '<td class="num">'+p.tgt+'</td><td class="num">'+p.rec+'</td><td class="num">'+p.car+'</td><td class="num">'+p.ry+'</td>'+
      '<td><input aria-label="Compare '+escape(p.n)+'" class="check" type="checkbox" data-compare="'+escape(p.id)+'" '+(state.compare.has(p.id)?'checked':'')+'></td></tr>';
    }).join('')||'<tr><td colspan="11" class="empty">No players match these filters.</td></tr>';
    el('shown-count').textContent='Showing '+subset.length+' of '+list.length+' players';
    el('more').hidden=subset.length>=list.length;
    positionLeaders();
  }
  function metric(label,value){return '<div class="metric"><span class="label">'+escape(label)+'</span><span class="value">'+escape(value)+'</span></div>';}
  function renderProfile(p){
    if(!p){el('profile').hidden=true;return;}
    var history=[...p.w].sort(function(a,b){return b[0]-a[0];});
    var adjustments=state.score==='half'?.5:state.score==='standard'?1:0;
    var html='<button class="crumb" id="return-list">← Back to player directory</button><div class="section-head">'+
      '<div><div class="eyebrow">'+escape(p.pos)+' · '+escape(p.team)+'</div><h2>'+escape(p.n)+'</h2></div>'+
      '<button class="btn outline" data-add-profile="'+escape(p.id)+'">Add to comparison</button></div>'+
      '<div class="profile-grid">'+metric('Fantasy points',fmt(score(p)))+metric('Points / game',fmt(ppg(p)))+
      metric('Games played',p.g)+metric('Targets',p.tgt)+metric('Receptions',p.rec)+
      metric('Receiving yards',p.ry)+metric('Carries',p.car)+metric('Rushing yards',p.ruy)+'</div>'+
      '<h2>2026 game log</h2><div class="table-scroll"><table><thead><tr><th>Week</th><th>Team</th><th class="num">Fantasy points</th><th class="num">Targets</th><th class="num">Receptions</th><th class="num">Rec yards</th><th class="num">Carries</th><th class="num">Rush yards</th></tr></thead><tbody>';
    html+=history.map(function(w){return '<tr><td>'+w[0]+'</td><td>'+escape(w[1])+'</td><td class="num">'+fmt(w[2]-adjustments*w[3])+'</td><td class="num">'+w[4]+'</td><td class="num">'+w[3]+'</td><td class="num">'+w[5]+'</td><td class="num">'+w[6]+'</td><td class="num">'+w[7]+'</td></tr>';}).join('');
    el('profile').innerHTML=html+'</tbody></table></div>';el('profile').hidden=false;
  }
  function renderCompare(){
    var ids=[...state.compare],panel=el('compare-panel');
    panel.hidden=ids.length===0;if(!ids.length)return;
    el('compare-grid').innerHTML=ids.map(function(id){var p=state.byId.get(id);if(!p)return '';
      return '<div class="panel"><div class="eyebrow">'+escape(p.pos)+' · '+escape(p.team)+'</div><h2>'+escape(p.n)+'</h2>'+
      metric('Fantasy points',fmt(score(p)))+metric('Points / game',fmt(ppg(p)))+metric('Targets',p.tgt)+
      metric('Receptions',p.rec)+metric('Carries',p.car)+metric('Receiving yards',p.ry)+'</div>';
    }).join('');
  }
  function navigate(path){
    history.pushState({},'',path);renderRoute();window.scrollTo({top:0,behavior:'smooth'});
  }
  function renderRoute() {
    var path=location.pathname,match=path.match(/^\/research\/players\/([^/]+)\/?$/);
    var p=match?state.byId.get(decodeURIComponent(match[1])):null;
    el('overview').hidden=!!match||path.includes('/stats')||path.endsWith('/players');
    el('directory').hidden=!!match;
    renderProfile(p);
    if(match&&!p){el('error').hidden=false;el('error').textContent='Player not found in this public snapshot.';}
    else if(state.players.length){el('error').hidden=true;}
    el('page-title').textContent=match?(p?p.n:'Player not found'):path.includes('/stats')?'Fantasy stat leaders':path.endsWith('/players')?'NFL player directory':'A clearer look at every player.';
    el('page-desc').textContent=match?'Weekly game logs and season statistics. Data is presented independently of fantasy league ownership.':
      'Search NFL players, compare season performance, and explore scoring under standard, half-PPR, or PPR formats.';
    document.querySelectorAll('[data-nav]').forEach(function(a){var key=a.getAttribute('data-nav');a.setAttribute('aria-current',key==='research'&&path==='/research'||key==='players'&&path.endsWith('/players')||key==='stats'&&path.includes('/stats')?'page':'false');});
    document.title=(p?p.n+' Stats | ': 'Fantasy Research | ')+'LeagueZone';
  }
  document.addEventListener('click',function(e){
    var t=e.target.closest('[data-profile]');if(t){navigate(profileUrl(t.getAttribute('data-profile')));return;}
    var add=e.target.closest('[data-add-profile]');if(add){var id=add.getAttribute('data-add-profile');if(state.compare.size<2||state.compare.has(id)){state.compare.add(id);renderTable();renderCompare();el('compare-panel').scrollIntoView({behavior:'smooth'});}return;}
    var back=e.target.closest('#return-list');if(back){navigate('/research/players');return;}
    var nav=e.target.closest('a[href^="/research"]');if(nav){e.preventDefault();navigate(nav.getAttribute('href'));}
  });
  el('players-body').addEventListener('change',function(e){
    var t=e.target.closest('[data-compare]');if(!t)return;
    var id=t.getAttribute('data-compare');
    if(t.checked&&state.compare.size>=2&&!state.compare.has(id)){t.checked=false;return;}
    if(t.checked)state.compare.add(id);else state.compare.delete(id);
    renderCompare();
  });
  el('clear-compare').addEventListener('click',function(){state.compare.clear();renderTable();renderCompare();});
  el('more').addEventListener('click',function(){state.limit+=60;renderTable();});
  ['search','position','scoring','sort','games'].forEach(function(id){
    el(id).addEventListener(id==='search'?'input':'change',function(e){
      state.query=el('search').value;state.position=el('position').value;state.score=el('scoring').value;state.sort=el('sort').value;state.games=Number(el('games').value);
      state.limit=60;renderTable();renderCompare();renderRoute();
    });
  });
  window.addEventListener('popstate',renderRoute);
  fetch('/research/data/2026.json',{cache:'default'}).then(function(r){if(!r.ok)throw new Error('Statistics are temporarily unavailable');return r.json();}).then(function(data){
    if(!Array.isArray(data.players)||data.players.length<100)throw new Error('Player data is incomplete');
    state.players=data.players;state.byId=new Map(data.players.map(function(p){return [p.id,p];}));state.throughWeek=data.throughWeek;
    el('data-stamp').textContent='2026 Season · Through Week '+data.throughWeek+' · Updated '+data.updated;
    renderTable();renderCompare();renderRoute();
  }).catch(function(error){el('data-stamp').textContent='Statistics unavailable';el('error').hidden=false;el('error').textContent=error.message||'Unable to load player data';el('players-body').innerHTML='<tr><td colspan="11" class="empty">Unable to load statistics.</td></tr>';});
})();