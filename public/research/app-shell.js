/* Standalone Research app shell. Never leaks account data into public cache. */
(function () {
  'use strict';
  var STORE='leaguezone:saved-research:v1', MAX=100;
  var button=document.getElementById('lz-save-view');
  var feedback=document.getElementById('lz-saved-feedback');
  var ownership=document.getElementById('lz-player-leagues');
  var nav=document.querySelector('.lz-research-tabs');
  if(!button||!feedback||!ownership||!nav)return;
  var mode='unknown', items=[], pending=null, busy=false;

  function current() {
    var href=location.pathname+location.search;
    if(!/^\/research(?:\/(?:players(?:\/[^/]+)?|stats|radar|receipts|development))?\/?$/.test(location.pathname))return null;
    var title=(document.getElementById('page-title')||{}).textContent||'Fantasy Research';
    var player=/^\/research\/players\/([^/]+)\/?$/.exec(location.pathname);
    // Never save the overview heading as a player's name while research loads.
    if(player && (!title.trim() || title==='A clearer look at every player.' ||
      title==='Player not found' || title==='Player not found in this season.')) return null;
    if(player){
      var id;
      try{id=decodeURIComponent(player[1]);}catch{return null;}
      if(!/^[A-Za-z0-9._-]{1,80}$/.test(id))return null;
      return {key:'player:'+id,type:'player',title:title.slice(0,150),
        href:'/research/players/'+encodeURIComponent(id),savedAt:Date.now()};
    }
    return {key:'view:'+href,type:'view',title:title.slice(0,150),href:href,savedAt:Date.now()};
  }

  function readLocal() {
    try {
      var raw=JSON.parse(localStorage.getItem(STORE)||'[]');
      if(!Array.isArray(raw))return [];
      var seen={};
      return raw.slice(0,MAX).filter(function(item){
        if(!item||typeof item.href!=='string'||typeof item.title!=='string'||
          (item.type!=='player'&&item.type!=='view'))return false;
        var m=item.type==='player'&&/^\/research\/players\/([^/?]+)/.exec(item.href);
        if(m){
          var id;
          try{id=decodeURIComponent(m[1]);}catch{return false;}
          if(!/^[A-Za-z0-9._-]{1,80}$/.test(id))return false;
          item.key='player:'+id;item.href='/research/players/'+encodeURIComponent(id);
        }else item.key='view:'+item.href;
        if(seen[item.key])return false;
        seen[item.key]=true;return true;
      });
    }catch{return [];}
  }

  function writeLocal(next) {
    localStorage.setItem(STORE,JSON.stringify(next.slice(0,MAX)));
    items=next.slice(0,MAX);
  }

  async function request(method,payload) {
    var response=await fetch('/api/saved-research',{method:method,credentials:'same-origin',
      cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    if(!response.ok){
      var error=await response.json().catch(function(){return {}});
      throw Error(error.error||'Could not update your saved research.');
    }
    return response.json();
  }

  async function load() {
    if(mode==='account'||mode==='guest')return;
    if(pending)return pending;
    pending=(async function(){
      var response=await fetch('/api/saved-research',{credentials:'same-origin',cache:'no-store'});
      if(response.status===401){mode='guest';items=readLocal();return;}
      if(!response.ok)throw Error('Account bookmarks unavailable. Please retry.');
      var data=await response.json();
      if(!Array.isArray(data.items))throw Error('Invalid saved research response.');
      items=data.items;mode='account';
      var legacy=readLocal();
      if(legacy.length){
        await request('POST',{import:legacy});
        var refreshed=await fetch('/api/saved-research',{credentials:'same-origin',cache:'no-store'});
        if(!refreshed.ok)throw Error('Saved bookmarks imported, but could not reload the list.');
        var latest=await refreshed.json();
        if(!Array.isArray(latest.items))throw Error('Invalid updated bookmarks.');
        items=latest.items;
        var keys={};
        items.forEach(function(x){keys[x.key]=true});
        var unimported=legacy.filter(function(x){return !keys[x.key]});
        if(unimported.length){
          localStorage.setItem(STORE,JSON.stringify(unimported));
          setMessage(unimported.length+' bookmarks remain on this device because your account library is full.');
        }else localStorage.removeItem(STORE);
      }
    })();
    try{await pending;}
    catch(error){mode='error';throw error;}
    finally{pending=null;}
  }

  function setMessage(text){feedback.textContent=text;}
  function update() {
    var path=location.pathname;
    var selected=path==='/research'||path==='/research/radar'||
      path==='/research/receipts'||path==='/research/development'?'research':
      path.startsWith('/research/players')||path==='/research/stats'?'players':'';
    Array.prototype.forEach.call(nav.querySelectorAll('[data-tab]'),function(a){
      if(a.dataset.tab===selected)a.setAttribute('aria-current','page');
      else a.removeAttribute('aria-current');
    });
    var item=current();
    ownership.hidden=!(item&&item.type==='player');
    if(!ownership.hidden)ownership.href='/player-leagues/'+encodeURIComponent(item.key.slice(7));
    button.hidden=!item;
    if(!item)return;
    var present=items.some(function(v){return v.key===item.key});
    button.textContent=item.type==='player'?(present?'Unfollow player':'Follow player'):
      (present?'Remove saved view':'Save this research view');
    button.setAttribute('aria-pressed',String(present));
    button.disabled=busy;
    // Public research views stay static: only player pages read the account
    // library up front. A view's saved state is resolved when the user acts.
    if(mode==='unknown'&&item.type==='player'){
      load().then(update).catch(function(error){setMessage(error.message);update()});
    }
  }

  // A back/forward cache restore can follow a sign-out or account switch.
  // Discard the in-memory library so the next render re-reads the account.
  window.addEventListener('pageshow',function(event){
    if(!event.persisted)return;
    mode='unknown';items=[];setMessage('');update();
  });

  async function saveOrRemove(){
    if(busy)return;
    busy=true;button.disabled=true;setMessage('');
    try{
      await load();
      if(mode==='error')throw Error('Bookmarks unavailable. Please retry.');
      var item=current();
      if(!item)return;
      var present=items.some(function(v){return v.key===item.key});
      if(mode==='account'){
        await request(present?'DELETE':'POST',present?{key:item.key}:{item:item});
        if(present)items=items.filter(function(v){return v.key!==item.key});
        else items=[item].concat(items.filter(function(v){return v.key!==item.key})).slice(0,MAX);
        setMessage(present?'Removed from your account watchlist.':'Saved to your LeagueZone account.');
      }else{
        var next=present?items.filter(function(v){return v.key!==item.key}):
          [item].concat(items.filter(function(v){return v.key!==item.key}));
        writeLocal(next);
        setMessage(present?'Removed from this browser.':'Saved on this device. Sign in to sync.');
      }
    }catch(error){setMessage(error.message||'Unable to save research.');}
    finally{busy=false;update();}
  }

  button.addEventListener('click',function(){void saveOrRemove();});
  window.addEventListener('popstate',update);
  window.addEventListener('leaguezone:routechange',update);
  update();
})();
