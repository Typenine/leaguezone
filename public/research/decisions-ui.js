'use strict';
// Public Phase 5 Decision Center. Displays verified changes with plain-language
// context and links to authorized roster lookup; no account or Neon reads here.
(function () {
  var D=window.LZDecisions, scoring='half', category='all', position='ALL', query='', limit=24;
  var context=null, container=null, listeners=false;
  function esc(x) {return String(x==null?'':x).replace(/[&<>"']/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });}
  function signed(x){return (x>0?'+':'')+Number(x).toFixed(1);}
  function playerUrl(d,year){return '/research/players/'+encodeURIComponent(d.id)+'?season='+year;}
  function card(d,year) {
    var s=d.signal;
    return '<article class="decision-card decision-'+esc(d.category)+'">'+
      '<div class="decision-card-top"><span class="decision-tag">'+esc(d.label)+'</span>'+
      '<span class="subdued">Week '+s.week+' · '+esc(d.pos)+'</span></div>'+
      '<h3><a href="'+playerUrl(d,year)+'">'+esc(d.name)+'</a> <small>'+esc(d.team)+'</small></h3>'+
      '<p class="decision-headline">'+esc(d.heading)+'</p><p>'+esc(d.why)+'</p>'+
      '<div class="decision-metrics"><div><span>'+esc(s.metric)+'/game</span>'+
      '<strong>'+s.baseline.toFixed(1)+' to '+s.recent.toFixed(1)+'</strong>'+
      '<small>'+signed(s.change)+' per game</small></div>'+
      '<div><span>Fantasy points/game</span>'+
      '<strong>'+s.scoringBefore.toFixed(1)+' to '+s.scoringRecent.toFixed(1)+'</strong>'+
      '<small>'+signed(s.scoringChange)+' per game</small></div></div>'+
      (d.context?'<p class="decision-warning">'+esc(d.context)+'</p>':'')+
      '<p class="decision-next"><strong>Before acting:</strong> '+esc(d.next)+'</p>'+
      '<div class="decision-card-links"><a href="'+playerUrl(d,year)+'">See supporting stats</a>'+
      '<a href="/player-leagues/'+encodeURIComponent(d.id)+'">Check my leagues</a></div></article>';
  }
  function markup(ctx) {
    if (!D || !ctx.players) return '<p class="empty">Decision research is unavailable right now.</p>';
    var all=D.build({players:ctx.players,throughWeek:ctx.throughWeek},scoring);
    var search=query.trim().toLowerCase();
    var matches=all.filter(function(d) {
      return (category==='all'||d.category===category) &&
        (position==='ALL'||d.pos===position) &&
        (!search||d.name.toLowerCase().includes(search)||d.team.toLowerCase().includes(search));
    });
    var counts={all:all.length,watch:0,momentum:0,risk:0};
    all.forEach(function(d){counts[d.category]++;});
    return '<div class="decision-intro"><div class="eyebrow">Make the data useful</div>'+
      '<h2>What should I pay attention to?</h2>'+
      '<p>Evidence-backed player findings from the latest validated stats. These are research leads, not injury forecasts, roster recommendations or verified free agents.</p>'+
      '<div class="decision-steps"><span>Spot a change</span><span>Understand why</span><span>Check your league</span></div></div>'+
      '<div class="tool-controls decision-controls"><label>Season<select id="decision-year">'+ctx.years.slice().reverse().map(function(y) {
        return '<option value="'+y+'"'+(y===ctx.year?' selected':'')+'>'+y+'</option>';
      }).join('')+'</select></label>'+
      '<label>Scoring<select id="decision-scoring">'+[['half','Half PPR'],['ppr','Full PPR'],['standard','Standard']].map(function(v) {
        return '<option value="'+v[0]+'"'+(scoring===v[0]?' selected':'')+'>'+v[1]+'</option>';
      }).join('')+'</select></label></div>'+
      '<div class="decision-filters"><div class="decision-tabs" role="group" aria-label="What are you looking for?">'+
      [['all','All findings'],['watch','Players to watch'],['momentum','Growing roles'],['risk','Warning signs']].map(function(v) {
        return '<button type="button" data-decision="'+v[0]+'" aria-pressed="'+(category===v[0])+'">'+
        v[1]+' <small>'+counts[v[0]]+'</small></button>';
      }).join('')+'</div>'+
      '<div class="decision-search"><label>Position<select id="decision-position">'+
      ['ALL','QB','RB','WR','TE'].map(function(p){return '<option value="'+p+'"'+(p===position?' selected':'')+'>'+
      (p==='ALL'?'All positions':p)+'</option>';}).join('')+'</select></label>'+
      '<label>Player or NFL team<input id="decision-query" type="search" placeholder="Search findings" value="'+esc(query)+'"></label></div></div>'+
      '<p class="subdued decision-count" role="status">Showing '+Math.min(matches.length,limit)+' of '+matches.length+
      ' matching findings through Week '+ctx.throughWeek+'. We compare the latest two recorded games against the two before them. This is a four-game observation, not a projection.</p>'+
      '<div class="decision-grid">'+(matches.length?matches.slice(0,limit).map(function(d){return card(d,ctx.year);}).join(''):
      '<div class="empty">No eligible four-game signals match these filters. Try another position or season, or check again after the next validated refresh.</div>')+'</div>'+
      (matches.length>limit?'<button type="button" id="decision-more" class="btn outline">Show more findings</button>':'')+
      '<section class="decision-foot"><h3>Turn a finding into a decision</h3><p>Review league ownership, scoring and lineup requirements before acting. A rising role does not guarantee a breakout, waiver availability or a fair trade price.</p>'+
      '<div class="decision-footer-links"><a href="/app/connect-sleeper">Personalize with Sleeper</a><a href="/app">My leagues</a><a href="/research/radar">Raw Radar signals</a>'+
      '<a href="/weekly">Weekly matchups</a><a href="/availability">Injury reports</a></div></section>';
  }
  function render(){if(context&&container)container.innerHTML=markup(context);}
  function show(ctx,panel) {
    context=ctx; container=panel;
    if (!ctx.usageStatus[ctx.year]) ctx.ensureUsage(ctx.year).then(function() {
      if (location.pathname==='/research/decisions') window.LZResearchApp.refresh();
    });
    if (!ctx.rzStatus[ctx.year]) ctx.ensureRedzone(ctx.year).then(function() {
      if (location.pathname==='/research/decisions') window.LZResearchApp.refresh();
    });
    if (!listeners) {
      listeners=true;
      panel.addEventListener('change',function(e){
        if (!e.target.id || !e.target.id.startsWith('decision-')) return;
        if(e.target.id==='decision-year'){context.navigate('/research/decisions?season='+e.target.value);return;}
        if(e.target.id==='decision-scoring')scoring=e.target.value;
        if(e.target.id==='decision-position')position=e.target.value;
        limit=24;render();
      });
      panel.addEventListener('input',function(e){
        if(e.target.id!=='decision-query')return;
        query=e.target.value;limit=24;
        var start=e.target.selectionStart;render();
        var input=panel.querySelector('#decision-query');
        if(input){input.focus();input.setSelectionRange(start,start);}
      });
      panel.addEventListener('click',function(e){
        var target=e.target.closest('[data-decision]');
        if(target){category=target.dataset.decision;limit=24;render();}
        if(e.target.closest('#decision-more')){limit+=24;render();}
      });
    }
    render();
  }
  window.LZDecisionTools={show:show};
})();
