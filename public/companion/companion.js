/* LeagueZone companion UI. Shared between static Research and Next.js pages.
 * No backend/database requests on ordinary browsing; data loads on user action.
 */
(function () {
  'use strict';
  if (window.LZCompanion) return;
  var ICONS = {
    home:'<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>',
    research:'<path d="M3 19h18M5 16l5-5 4 3 5-8"/><circle cx="19" cy="6" r="1"/>',
    search:'<circle cx="10.7" cy="10.7" r="6.7"/><path d="m16 16 5 5"/>',
    saved:'<path d="M5 4h14v17l-7-5-7 5z"/>',
    leagues:'<path d="M3 9h18v12H3zM7 9V4h10v5"/><path d="M9 14h6"/>'
  };
  var tools = [
    {title:'Player research',url:'/research',section:'Research'},
    {title:'Player statistics',url:'/research/stats',section:'Research'},
    {title:'Opportunity Radar',url:'/research/radar',section:'Research'},
    {title:'Prediction Receipts',url:'/research/receipts',section:'Research'},
    {title:'Development Lab',url:'/research/development',section:'Research'},
    {title:'League websites',url:'/features',section:'LeagueZone'}
  ];
  var dock,overlay,dialog,authPromise=null,seasonPromise=null,userKey='guest',library=null,lastPath=location.pathname;
  var esc=function(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});};
  function icon(name){return '<svg viewBox="0 0 24 24" aria-hidden="true">'+ICONS[name]+'</svg>';}
  function safeUrl(url){try{var u=new URL(url,location.origin);return u.origin===location.origin&&u.pathname.startsWith('/research')?u.pathname+u.search:'';}catch{return '';}}
  function key(){return 'lz-companion-library-v1:'+userKey;}
  function empty(){return {players:[],views:[],updatedAt:0};}
  function validate(obj){
    if(!obj||typeof obj!=='object')return empty();
    var players=(Array.isArray(obj.players)?obj.players:[]).filter(function(p){return p&&/^[\w-]{1,70}$/.test(p.id)&&typeof p.name==='string'&&p.name.length<=100&&Number.isInteger(p.year);}).slice(0,80);
    var views=(Array.isArray(obj.views)?obj.views:[]).filter(function(v){return v&&typeof v.name==='string'&&v.name.length<=100&&safeUrl(v.url);}).slice(0,20);
    return {players:players,views:views,updatedAt:Number(obj.updatedAt)||0};
  }
  function read(){try{return validate(JSON.parse(localStorage.getItem(key())||'{}'));}catch{return empty();}}
  function persist(){library.updatedAt=Date.now();try{localStorage.setItem(key(),JSON.stringify(library));}catch{showMessage('Device storage is full or disabled. Your save may not persist.');}}
  function showMessage(s){var e=dialog&&dialog.querySelector('#lzc-status');if(e)e.textContent=s;}
  async function identity(){
    if(!authPromise) authPromise=fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'})
      .then(function(r){return r.ok?r.json():null;}).catch(function(){return null;});
    var a=await authPromise;
    var id=a&&a.user&&typeof a.user.id==='string'&&/^[0-9a-f-]{36}$/i.test(a.user.id)?a.user.id:null;
    var next=id||'guest';
    if(userKey!==next){userKey=next;library=read();}
    if(!library)library=read();
    return a;
  }
  async function hydrate(){
    var a=await identity();
    if(a&&userKey!=='guest'){
      try{
        var r=await fetch('/api/me/research-library',{credentials:'same-origin',cache:'no-store'});
        if(r.ok){
          var remote=validate(await r.json());
          if(remote.updatedAt>library.updatedAt) {library=remote;try{localStorage.setItem(key(),JSON.stringify(library));}catch{}}
          else if(library.updatedAt>remote.updatedAt) await send();
        }
      }catch {showMessage('Account sync is unavailable. Device saves remain accessible.');}
    }
  }
  async function send(){
    if(userKey==='guest')return;
    try{
      var r=await fetch('/api/me/research-library',{method:'PUT',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(library)});
      if(!r.ok)throw Error('Could not sync');
    }catch{showMessage('Saved on this device; account sync is unavailable.');}
  }
  function node(tag,cls,html){var e=document.createElement(tag);if(cls)e.className=cls;if(html)e.innerHTML=html;return e;}
  function close(){if(overlay)overlay.hidden=true;document.body.classList.remove('lzc-modal-open');}
  function open(title){
    if(!overlay)return;
    overlay.hidden=false;document.body.classList.add('lzc-modal-open');
    dialog.innerHTML='<button class="lzc-dismiss" type="button" aria-label="Close dialog">×</button><h2>'+esc(title)+'</h2><div id="lzc-main"></div><p id="lzc-status" class="lzc-muted" role="status"></p>';
    dialog.querySelector('.lzc-dismiss').addEventListener('click',close);
    return dialog.querySelector('#lzc-main');
  }
  function route(){
    var path=location.pathname;
    if(path!==lastPath){lastPath=path;authPromise=null;userKey='guest';library=null;}
    if(dock){
      dock.classList.toggle('lzc-hidden',path.startsWith('/l/')||/^\/(draft\/(room|overlay)|admin|login|register|setup)/.test(path));
      dock.querySelectorAll('a[data-lzc-tab]').forEach(function(a){
        var name=a.dataset.lzcTab, active=name==='home'?path==='/'||path==='/install':name==='research'?path.startsWith('/research'):name==='leagues'?path.startsWith('/app'):false;
        if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
      });
    }
    document.querySelectorAll('[data-lzc-watch]').forEach(function(btn){var saved=!!library&&library.players.some(function(p){return p.id===btn.dataset.lzcWatch;});btn.setAttribute('aria-pressed',String(saved));btn.textContent=saved?'Watching':'Watch player';});
    var saveButton=document.getElementById('lzc-save-view');
    if(saveButton){
      var isSaved=!!library&&library.views.some(function(v){return v.url===safeUrl(location.pathname+location.search);});
      saveButton.setAttribute('aria-pressed',String(isSaved));
      saveButton.textContent=isSaved?'View saved':'Save this view';
    }
  }
  async function dataset(){
    if(seasonPromise)return seasonPromise;
    seasonPromise=fetch('/research/data/seasons.json',{cache:'force-cache'}).then(function(r){if(!r.ok)throw Error('No season index');return r.json();})
      .then(function(idx){var years=idx.years||[],year=Math.max.apply(null,years);if(!Number.isInteger(year))throw Error('No seasons');return fetch('/research/data/'+year+'.json',{cache:'force-cache'}).then(function(r){if(!r.ok)throw Error('Research unavailable');return r.json();}).then(function(d){return {year:year,players:(d.players||[])};});})
      .catch(function(){seasonPromise=null;return {year:null,players:[]};});
    return seasonPromise;
  }
  function searchResults(needle,season,leagues){
    var q=needle.trim().toLocaleLowerCase(),results=[];
    if(!q)return tools.map(function(t){return {...t};});
    results=tools.filter(function(t){return t.title.toLowerCase().includes(q);});
    var people=season.players.filter(function(p){return p.n&&p.n.toLowerCase().includes(q);}).sort(function(a,b){
      var aa=a.n.toLowerCase().startsWith(q)?0:1,bb=b.n.toLowerCase().startsWith(q)?0:1;
      return aa-bb||a.n.localeCompare(b.n);
    }).slice(0,12);
    people.forEach(function(p){results.push({title:p.n,url:'/research/players/'+encodeURIComponent(p.id)+'?season='+season.year,section:(p.pos||'')+' · '+(p.team||'NFL')});});
    (leagues||[]).filter(function(l){return l.leagueName.toLowerCase().includes(q)||l.teamName.toLowerCase().includes(q);}).slice(0,6)
      .forEach(function(l){results.push({title:l.leagueName,url:'/l/'+encodeURIComponent(l.leagueSlug),section:'My league'});});
    return results.slice(0,22);
  }
  async function search(){
    var body=open('Search LeagueZone');if(!body)return;
    body.innerHTML='<p>Find NFL players, research tools and your own leagues.</p><label for="lzc-query">Search</label><input type="search" id="lzc-query" placeholder="Player, tool, or league" autocomplete="off"><div class="lzc-results" id="lzc-results"></div>';
    var input=body.querySelector('#lzc-query'),results=body.querySelector('#lzc-results'),a=await identity(),season=await dataset(),leagues=a&&a.leagues||[];
    if(overlay.hidden)return;
    function render(){
      var matches=searchResults(input.value,season,leagues);
      results.innerHTML=matches.length?matches.map(function(x){return '<a class="lzc-result" href="'+esc(x.url)+'"><strong>'+esc(x.title)+'</strong><small>'+esc(x.section)+'</small></a>';}).join(''):'<p>No matches in the available research season. Try a different name.</p>';
    }
    render();input.addEventListener('input',render);input.focus();
  }
  function listItem(x,label){
    return '<div class="lzc-result"><a style="color:inherit;min-width:0;flex:1" href="'+esc(label==='player'?'/research/players/'+encodeURIComponent(x.id)+'?season='+x.year:x.url)+'">'+esc(x.name)+'</a>'+
      '<button type="button" class="lzc-action secondary" data-lzc-delete="'+esc(label==='player'?x.id:x.url)+'" data-lzc-kind="'+label+'" aria-label="Remove '+esc(x.name)+'">Remove</button></div>';
  }
  async function saved(){
    var body=open('Saved research');if(!body)return;
    body.innerHTML='<p>Players and research views you have saved for later.</p><div id="lzc-library">Loading saves…</div>';
    await hydrate();if(overlay.hidden)return;
    function render(){
      var list=body.querySelector('#lzc-library');
      list.innerHTML='<div class="lzc-section"><h3>Watchlist ('+library.players.length+')</h3><div class="lzc-results">'+
        (library.players.length?library.players.map(function(x){return listItem(x,'player');}).join(''):'<p class="lzc-muted">Open any player profile to add them here.</p>')+'</div></div>'+
        '<div class="lzc-section"><h3>Saved research views ('+library.views.length+')</h3><div class="lzc-results">'+
        (library.views.length?library.views.map(function(x){return listItem(x,'view');}).join(''):'<p class="lzc-muted">Use Save this view while browsing research.</p>')+'</div></div>'+
        '<div class="lzc-section"><div class="lzc-actions"><a class="lzc-action secondary" href="/settings/notifications">Notification settings</a><a class="lzc-action secondary" href="/research">Open research</a></div></div>';
      list.querySelectorAll('[data-lzc-delete]').forEach(function(btn){btn.addEventListener('click',function(){
        if(btn.dataset.lzcKind==='player')library.players=library.players.filter(function(x){return x.id!==btn.dataset.lzcDelete;});
        else library.views=library.views.filter(function(x){return x.url!==btn.dataset.lzcDelete;});
        persist();void send();route();render();
      });});
    }
    render();
  }
  async function watch(id,name,year){
    if(!id||!name||!Number.isInteger(year))return;
    await hydrate();
    var ix=library.players.findIndex(function(p){return p.id===id;});
    if(ix>=0)library.players.splice(ix,1);
    else if(library.players.length>=80){showMessage('Watchlist limit is 80 players. Remove one before adding another.');return;}
    else library.players.unshift({id:id,name:name.slice(0,100),year:year});
    persist();void send();route();
  }
  async function saveView(){
    await hydrate();
    var url=safeUrl(location.pathname+location.search);if(!url)return;
    var label=(document.querySelector('#page-title')||document.querySelector('h1'));
    var name=label&&label.textContent.trim()||'Research view';
    if(!library.views.some(function(x){return x.url===url})){
      library.views.unshift({name:name.slice(0,100),url:url});
      library.views=library.views.slice(0,20);persist();void send();
    }
    var b=document.getElementById('lzc-save-view');if(b){b.textContent='View saved';b.setAttribute('aria-pressed','true');}
  }
  async function checkLeagues(id,name,year){
    var body=open('Check '+name+' in my leagues');if(!body)return;
    body.innerHTML='<p>Check the current owner or availability using your league roster snapshot.</p><div class="lzc-results" id="lzc-leagues">Loading your leagues…</div>';
    var auth=await identity(),root=body.querySelector('#lzc-leagues');
    if(overlay.hidden)return;
    var leagues=auth&&auth.leagues||[];
    root.innerHTML=leagues.length?leagues.map(function(l){return '<a class="lzc-result" href="/l/'+encodeURIComponent(l.leagueSlug)+'/opportunities?player='+encodeURIComponent(id)+'"><strong>'+esc(l.leagueName)+'</strong><small>Check roster</small></a>';}).join(''):
      '<p>'+(auth&&auth.authenticated?'No connected leagues in this account.':'Sign in to a LeagueZone account with a connected league to check roster ownership. <a href="/login?next='+encodeURIComponent('/research/players/'+id+'?season='+year)+'">Sign in</a>')+'</p>';
  }
  function initialize(){
    if(document.querySelector('.lzc-dock'))return;
    dock=node('nav','lzc-dock');dock.setAttribute('aria-label','LeagueZone mobile app navigation');
    dock.innerHTML='<a data-lzc-tab="home" href="/?view=public">'+icon('home')+'Home</a>'+
      '<a data-lzc-tab="research" href="/research">'+icon('research')+'Research</a>'+
      '<button type="button" data-lzc-search>'+icon('search')+'Search</button>'+
      '<button type="button" data-lzc-saved>'+icon('saved')+'Saved</button>'+
      '<a data-lzc-tab="leagues" href="/app">'+icon('leagues')+'My Leagues</a>';
    overlay=node('section','lzc-overlay');overlay.hidden=true;overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','LeagueZone tools');
    dialog=node('div','lzc-dialog');overlay.appendChild(dialog);
    overlay.addEventListener('click',function(e){if(e.target===overlay)close();});
    document.body.appendChild(dock);document.body.appendChild(overlay);
    document.addEventListener('click',function(e){
      var t=e.target.closest('[data-lzc-search],[data-lzc-saved],[data-lzc-watch],[data-lzc-save-view],[data-lzc-player-leagues]');
      if(!t)return;
      e.preventDefault();
      if(t.hasAttribute('data-lzc-search'))void search();
      else if(t.hasAttribute('data-lzc-saved'))void saved();
      else if(t.hasAttribute('data-lzc-save-view'))void saveView();
      else if(t.hasAttribute('data-lzc-watch'))void watch(t.dataset.lzcWatch,t.dataset.lzcName,Number(t.dataset.lzcYear));
      else if(t.hasAttribute('data-lzc-player-leagues'))void checkLeagues(t.dataset.lzcPlayerLeagues,t.dataset.lzcName,Number(t.dataset.lzcYear));
    });
    document.addEventListener('keydown',function(e){if(e.key==='Escape')close();if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();void search();}});
    overlay.addEventListener('click',function(e){if(e.target.closest('a'))close();});
    document.addEventListener('leaguezone:navigated',route);
    window.addEventListener('leaguezone:open-search',function(){void search();});
    window.addEventListener('leaguezone:open-saved',function(){void saved();});
    window.addEventListener('popstate',route);
    route();
  }
  window.LZCompanion={
    openSearch:search,openSaved:saved,checkLeagues:checkLeagues,watch:watch,route:route,
    isWatching:function(id){return !!library&&library.players.some(function(p){return p.id===id;});}
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize);
  else initialize();
})();
