'use strict';
(function () {
  var O=window.LZOpportunities, panel=document.getElementById('tool-panel');
  var scoring='half', selectedPlayer='', search='', radarQuery='', radarPosition='ALL', radarLimit=36,
    receiptLimit=100, filter='all', request=0, context=null, lastTool=null;
  var LEDGER_KEY='lz_research_forward_receipts_v1', ledger=[], ledgerStatus='';
  try {var saved=JSON.parse(localStorage.getItem(LEDGER_KEY)||'[]');if (Array.isArray(saved)) ledger=saved.filter(function (r) {
    return r && typeof r.key==='string' && Number.isInteger(r.year) && r.signal && typeof r.signal.id==='string' &&
      Number.isInteger(r.signal.week) && ['rising','falling'].includes(r.signal.direction) &&
      Number.isFinite(r.signal.baseline);
  });} catch {ledgerStatus='Device storage is unavailable; new forward receipts cannot be saved.';}
  var esc=function (value) {return String(value==null?'':value).replace(/[&<>"']/g,function (c) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });};
  var signed=function (n) {return (n>0?'+':'')+n.toFixed(1);};
  var profile=function (s,y) {return '/research/players/'+encodeURIComponent(s.id)+'?season='+y;};
  function controls(ctx) {
    return '<div class="tool-controls"><label>Season<select id="tool-year">'+ctx.years.slice().reverse().map(function (y) {
      return '<option value="'+y+'"'+(y===ctx.year?' selected':'')+'>'+y+'</option>'; }).join('')+'</select></label>'+
      '<label>Fantasy scoring<select id="tool-scoring"><option value="half"'+(scoring==='half'?' selected':'')+'>Half PPR</option>'+
      '<option value="ppr"'+(scoring==='ppr'?' selected':'')+'>Full PPR</option><option value="standard"'+
      (scoring==='standard'?' selected':'')+'>Standard</option></select></label></div>';
  }
  function card(signal,year) {
    return '<article class="tool-card"><div class="tool-card-head"><div><span class="position-chip">'+esc(signal.pos)+'</span> '+
      '<a href="'+profile(signal,year)+'">'+esc(signal.name)+'</a> <small>'+esc(signal.team)+'</small></div>'+
      '<span class="role-label '+signal.direction+'">Volume '+signal.direction+'</span></div>'+
      '<div class="tool-numbers"><div><b>'+signed(signal.change)+'</b><small>'+esc(signal.metric)+'/game</small></div>'+
      '<div><b>'+signed(signal.scoringChange)+'</b><small>fantasy points/game</small></div></div>'+
      '<p class="subdued">Usage '+signal.baseline.toFixed(1)+' to '+signal.recent.toFixed(1)+' per game; fantasy points '+
      signal.scoringBefore.toFixed(1)+' to '+signal.scoringRecent.toFixed(1)+'.</p>'+
      '<p class="subdued">Weeks '+signal.baselineWeeks.join(', ')+' vs. '+signal.recentWeeks.join(', ')+'</p></article>';
  }
  function radar(ctx) {
    var signals=O.radar({players:ctx.players,throughWeek:ctx.throughWeek},scoring);
    var selected=signals.filter(function (s) {return (filter==='all'||s.direction===filter) &&
      (radarPosition==='ALL'||s.pos===radarPosition) &&
      (!radarQuery||s.name.toLowerCase().includes(radarQuery.toLowerCase())||s.team.toLowerCase().includes(radarQuery.toLowerCase()));});
    return controls(ctx)+'<p class="tool-explainer">A signal compares a player’s last two recorded games with the two before them. '+
      'The volume threshold is at least 1.5 opportunities per game and 15%. Byes and missed games are skipped. '+
      'QB pass attempts come from the core game log or advanced usage data. Fantasy scoring is a separate column, not part of the volume signal.</p>'+
      '<div class="radar-search"><label>Find player or NFL team<input type="search" id="radar-query" value="'+esc(radarQuery)+'" placeholder="Search signals"></label>'+
      '<label>Position<select id="radar-position">'+['ALL','QB','RB','WR','TE'].map(function (p) {
        return '<option value="'+p+'"'+(p===radarPosition?' selected':'')+'>'+(p==='ALL'?'All positions':p)+'</option>';}).join('')+'</select></label></div>'+
      '<div class="tool-filters" role="group" aria-label="Role direction">'+['all','rising','falling'].map(function (key) {
        return '<button type="button" data-role="'+key+'" aria-pressed="'+(filter===key)+'">'+
          ({all:'All',rising:'Rising',falling:'Falling'})[key]+'</button>';}).join('')+'</div>'+
      '<p class="subdued">'+signals.length+' signals through Week '+ctx.throughWeek+'. '+
        (ctx.players.some(function (p) {return p.pos==='QB' && (p.w||[]).some(function (w) {return Number.isInteger(w[15]);});})?'':
          ctx.usageStatus[ctx.year]==='loading'?'Loading QB pass attempts… ':ctx.usageStatus[ctx.year]!=='ready'?'QB signals unavailable because pass attempt data is missing. ':'')+
        'These describe observed usage, not an injury or role forecast.</p>'+
      '<p class="subdued">Showing '+Math.min(selected.length,radarLimit)+' of '+selected.length+' matching signals.</p>'+
      '<div class="tool-grid">'+(selected.length?selected.slice(0,radarLimit).map(function (s) {return card(s,ctx.year);}).join(''):
        '<p class="empty">No players meet these filters.</p>')+'</div>'+
      (selected.length>radarLimit?'<button class="btn outline" id="radar-more" type="button">Show more signals</button>':'')+
      '<p class="subdued">'+esc(ledgerStatus || ledger.filter(function (r) {return r.year===ctx.year;}).length+
        ' forward signals saved on this device for '+ctx.year+'. Open Receipts after later games to check outcomes.')+'</p>'+
      '<a class="tool-cta" href="/app">Find opportunities in a league</a>';
  }
  function receiptRow(r,year) {
    var s=r.signal;
    return '<article class="receipt-row"><div><a href="'+profile(s,year)+'">'+esc(s.name)+'</a> '+
      '<span class="subdued">'+esc(s.pos)+' · Week '+s.week+(r.recordedAt?' · Saved '+esc(r.recordedAt.slice(0,10)):'')+'</span><br><small>Volume '+s.direction+' · '+
      s.baseline+' to '+s.recent+' '+esc(s.metric)+'/game</small></div><div class="receipt-outcome"><span class="role-label '+
      (r.status==='confirmed'?'rising':r.status==='unresolved'?'steady':'falling')+'">'+esc(r.status)+'</span>'+
      '<small>'+(r.future==null?'Fewer than two later games':'Next games: '+r.future.toFixed(1)+' ('+signed(r.difference)+' vs. baseline)')+
      '</small></div></article>';
  }
  function receipts(ctx) {
    var rows=O.receipts({players:ctx.players,throughWeek:ctx.throughWeek},scoring),stats=O.summary(rows);
    var matching=rows.filter(function (r) {return filter==='all'||r.status===filter;});
    var shown=matching.slice(0,receiptLimit);
    var forward=O.resolveRecorded(ledger.filter(function (r) {return r.format===scoring;}),
      {year:ctx.year,players:ctx.players,throughWeek:ctx.throughWeek});
    var forwardStats=O.summary(forward);
    return controls(ctx)+'<section class="forward-receipts"><h2>Forward record on this device</h2>'+
      '<p class="tool-explainer">When you open the current-season Radar, its signals are saved with the observation date and cannot be changed by later stats. '+
      'This record lives in this browser and is lost if its storage is cleared; it is not yet a system-wide accuracy ledger.</p>'+
      '<div class="receipt-summary"><div><strong>'+forwardStats.total+'</strong><span>saved signals</span></div><div><strong>'+forwardStats.resolved+
      '</strong><span>resolved</span></div><div><strong>'+(forwardStats.rate==null?'—':forwardStats.rate+'%')+'</strong><span>confirmed among resolved</span></div></div>'+
      '<div class="receipt-list">'+(forward.length?forward.slice(0,20).map(function (r) {return receiptRow(r,ctx.year);}).join(''):
        '<p class="empty">No signals saved on this device for '+ctx.year+'.</p>')+'</div></section>'+
      '<h2>Historical replay</h2><p class="tool-explainer">For each week, the signal uses only stats available through that week. '+
      'A receipt is confirmed when the next two recorded games within three calendar weeks remain at least 1.5 and 15% '+
      'above or below the original baseline. Repeated signals for one player are spaced at least three weeks apart. Unresolved means fewer than two eligible later games. '+
      'These signals were reconstructed after the fact; they were not stored when originally made.</p>'+
      '<div class="receipt-summary"><div><strong>'+stats.total+'</strong><span>signals</span></div><div><strong>'+stats.resolved+
      '</strong><span>resolved</span></div><div><strong>'+(stats.rate==null?'—':stats.rate+'%')+'</strong><span>confirmed among resolved</span></div></div>'+
      '<div class="tool-filters" role="group" aria-label="Receipt status">'+['all','confirmed','not confirmed','unresolved'].map(function (key) {
        return '<button type="button" data-receipt="'+key+'" aria-pressed="'+(filter===key)+'">'+
          ({all:'All',confirmed:'Confirmed','not confirmed':'Not confirmed',unresolved:'Unresolved'})[key]+'</button>';}).join('')+'</div>'+
      '<p class="subdued">Showing '+shown.length+' of '+matching.length+' receipts. A confirmation rate on this threshold selection is a descriptive backtest, '+
      'not a verified forward prediction accuracy score.</p><div class="receipt-list">'+
      (shown.length?shown.map(function (r) {return receiptRow(r,ctx.year);}).join(''):
        '<p class="empty">No receipts match this filter.</p>')+'</div>'+
      (matching.length>receiptLimit?'<button class="btn outline" type="button" id="receipts-more">Show more receipts</button>':'');
  }
  function lab(ctx) {
    var choices=ctx.players.filter(function (p) {return ['QB','RB','WR','TE','K'].includes(p.pos);}).sort(function (a,b) {return a.n.localeCompare(b.n);});
    var selected=choices.find(function (p) {return p.id===selectedPlayer;});
    return controls(ctx)+'<p class="tool-explainer">Review per-game production across available seasons and players at the same career stage. '+
      'Career year uses verified rookie-season metadata. Historical comparisons are descriptive and do not imply a shared future trajectory.</p>'+
      '<label class="lab-search">Find a player<input id="lab-search" type="search" value="'+esc(search)+'" placeholder="Search by name" autocomplete="off"></label>'+
      '<div id="lab-results" class="lab-results">'+choices.filter(function (p) {return p.n.toLowerCase().includes(search.toLowerCase());})
        .slice(0,20).map(function (p) {return '<button type="button" data-lab-player="'+esc(p.id)+'"'+
          (selectedPlayer===p.id?' aria-current="true"':'')+'>'+esc(p.n)+' <small>'+esc(p.pos)+' · '+esc(p.team)+'</small></button>';}).join('')+'</div>'+
      '<div id="lab-detail" class="lab-detail">'+(selected?'<p class="subdued">Loading '+esc(selected.n)+'’s season history…</p>':
        '<p class="empty">Select a player to view career progression.</p>')+'</div>';
  }
  function labDetail(ctx, playerId, token) {
    Promise.all(ctx.years.map(function (y) {return ctx.loadData(y).catch(function () {return null;});})).then(function (all) {
      if (token!==request || !document.getElementById('lab-detail')) return;
      var seasons=all.filter(Boolean),history=O.development(seasons,playerId,scoring),current=history.find(function (x) {return x.year===ctx.year;});
      var missing=ctx.years.filter(function (y) {return !seasons.some(function (d) {return d.year===y;});});
      var detail=document.getElementById('lab-detail');
      if (!history.length) {detail.innerHTML='<p class="empty">No recorded season history for this player.</p>';return;}
      var prior=null;
      detail.innerHTML='<h2>'+esc(history[history.length-1].name)+'</h2>'+
        (missing.length?'<p class="season-note">Season data unavailable for '+missing.join(', ')+'; comparisons may be incomplete.</p>':'')+
        '<div class="table-scroll"><table class="lab-table"><thead><tr><th>Season</th><th>Career year</th><th>Games</th>'+
        '<th>FP/game</th><th>Change</th><th>Opportunities/game</th><th>Coverage</th></tr></thead><tbody>'+
        history.map(function (h) {var delta=prior?h.pointsPerGame-prior.pointsPerGame:null;prior=h;
          return '<tr><td>'+h.year+'</td><td>'+(h.careerYear==null?'Unverified':h.careerYear)+'</td><td>'+h.games+'</td>'+
            '<td>'+h.pointsPerGame.toFixed(1)+'</td><td>'+(delta==null?'—':signed(delta))+'</td><td>'+
            (h.opportunityPerGame==null?'—':h.opportunityPerGame.toFixed(1))+'</td><td>'+
            (h.complete?'Full season':'Through Week '+h.throughWeek)+'</td></tr>';}).join('')+'</tbody></table></div>'+
        '<p class="subdued">Opportunities/game: RB carries + targets; WR/TE targets. QB attempts and snap counts are not inferred here. '+
        'All averages use games with recorded statistics.</p><h3>Same-stage comparisons</h3>'+
        (function () {var peers=O.comparisons(seasons,current,scoring);return peers.length?'<p class="subdued">'+
          'Closest FP/game among completed seasons at career year '+current.careerYear+', same position, at least 8 recorded games. '+
          'Similar scoring does not mean similar talent or a forecast.</p><div class="tool-grid">'+peers.map(function (p) {
            return '<article class="tool-card"><a href="'+profile(p,p.year)+'">'+esc(p.name)+'</a> <small>'+p.year+
              '</small><p>'+p.pointsPerGame.toFixed(1)+' FP/game · '+p.games+' games</p></article>';}).join('')+'</div>':
          '<p class="subdued">Not enough comparable completed seasons with verified rookie years in the available history.</p>';})();
    });
  }
  function show(tool,ctx) {
    if (tool!==lastTool) {filter='all';radarLimit=36;receiptLimit=100;lastTool=tool;}
    context=ctx;request++;
    panel.hidden=!tool;
    if (!tool || !ctx.players.length) return;
    if (tool==='radar' || tool==='receipts') {
      if (!ctx.usageStatus[ctx.year]) ctx.ensureUsage(ctx.year).then(function () {
        if (location.pathname.match(/^\/research\/(radar|receipts)\/?$/)) window.LZResearchApp.refresh();
      });
    }
    if (tool==='radar' && ctx.year===ctx.years[ctx.years.length-1] && ctx.throughWeek<18) {
      var next=O.recordSignals(ledger,{year:ctx.year,throughWeek:ctx.throughWeek,players:ctx.players},scoring,new Date().toISOString());
      if (next.length!==ledger.length) {
        try {localStorage.setItem(LEDGER_KEY,JSON.stringify(next));ledger=next;ledgerStatus='';}
        catch {ledgerStatus='Device storage is unavailable; new forward receipts cannot be saved.';}
      }
    }
    if (tool==='development') {
      var requested=new URLSearchParams(location.search).get('player');
      if (requested && requested!==selectedPlayer) selectedPlayer=requested;
      if (!ctx.players.some(function (p) {return p.id===selectedPlayer;})) selectedPlayer='';
    }
    panel.innerHTML=tool==='radar'?radar(ctx):tool==='receipts'?receipts(ctx):lab(ctx);
    if (tool==='development' && selectedPlayer) labDetail(ctx,selectedPlayer,request);
  }
  panel.addEventListener('change',function (e) {
    if (e.target.id==='tool-year') {context.navigate(location.pathname+'?season='+e.target.value);return;}
    if (e.target.id==='tool-scoring') {scoring=e.target.value;show(location.pathname.split('/')[2],context);}
    if (e.target.id==='radar-position') {radarPosition=e.target.value;radarLimit=36;show('radar',context);}
  });
  panel.addEventListener('input',function (e) {
    if (e.target.id==='radar-query') {
      radarQuery=e.target.value;radarLimit=36;
      var caret=e.target.selectionStart;show('radar',context);
      var input=panel.querySelector('#radar-query');input.focus();input.setSelectionRange(caret,caret);
      return;
    }
    if (e.target.id!=='lab-search') return;
    search=e.target.value;
    var results=panel.querySelector('#lab-results');
    results.innerHTML=context.players.filter(function (p) {return ['QB','RB','WR','TE','K'].includes(p.pos) && p.n.toLowerCase().includes(search.toLowerCase());})
      .sort(function (a,b) {return a.n.localeCompare(b.n);}).slice(0,20).map(function (p) {
        return '<button type="button" data-lab-player="'+esc(p.id)+'">'+esc(p.n)+' <small>'+esc(p.pos)+' · '+esc(p.team)+'</small></button>';}).join('');
  });
  panel.addEventListener('click',function (e) {
    var role=e.target.closest('[data-role]'),receipt=e.target.closest('[data-receipt]'),player=e.target.closest('[data-lab-player]');
    if (role) {filter=role.dataset.role;radarLimit=36;show('radar',context);}
    if (receipt) {filter=receipt.dataset.receipt;receiptLimit=100;show('receipts',context);}
    if (e.target.closest('#radar-more')) {radarLimit+=36;show('radar',context);}
    if (e.target.closest('#receipts-more')) {receiptLimit+=100;show('receipts',context);}
    if (player) {selectedPlayer=player.dataset.labPlayer;history.replaceState({},'',location.pathname+'?season='+context.year+'&player='+encodeURIComponent(selectedPlayer));
      show('development',context);}
  });
  window.LZResearchTools={show:show};
})();
