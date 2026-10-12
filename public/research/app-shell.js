'use strict';
(function(){
var nav=document.createElement('nav');
nav.className='lz-research-tabs';
nav.setAttribute('aria-label','LeagueZone app navigation');
[['/?view=public','Home'],['/research','Research'],['/research/players','Players'],['/app','My Leagues'],['/profile','Profile']].forEach(function(item){
 var a=document.createElement('a');a.href=item[0];a.textContent=item[1];nav.appendChild(a);
});
document.body.appendChild(nav);
var headerNav=document.querySelector('.site-head .nav');
if(headerNav){[['/search','Search'],['/saved','Saved']].forEach(function(item){var a=document.createElement('a');a.href=item[0];a.textContent=item[1];headerNav.appendChild(a)})}
var row=document.querySelector('.meta-row');
if(!row)return;
var save=document.createElement('button');save.type='button';save.className='btn outline';save.textContent='Save this research view';
var status=document.createElement('span');status.setAttribute('role','status');status.className='subdued';
row.appendChild(save);row.appendChild(status);
save.addEventListener('click',function(){
 var href=location.pathname+location.search;
 var player=location.pathname.split('/')[2]==='players'&&location.pathname.split('/')[3];
 var title=document.getElementById('page-title');
 var item={key:(player?'player:':'view:')+href,type:player?'player':'view',title:(title&&title.textContent||document.title).slice(0,150),href:href,savedAt:Date.now()};
 try{var list=JSON.parse(localStorage.getItem('leaguezone:saved-research:v1')||'[]');
 if(!Array.isArray(list))list=[];
 list=list.filter(function(x){return x&&x.key!==item.key});
 list.unshift(item);
 localStorage.setItem('leaguezone:saved-research:v1',JSON.stringify(list.slice(0,100)));
 status.textContent='Saved on this device.';
 }catch(e){status.textContent='Browser storage unavailable.';}
});
var lookup=document.createElement('a');lookup.className='btn outline';lookup.textContent='Check player in my leagues';row.appendChild(lookup);
function sync(){var parts=location.pathname.split('/');lookup.hidden=!(parts[2]==='players'&&parts[3]);if(!lookup.hidden)lookup.href='/player-leagues/'+encodeURIComponent(parts[3]);}
sync();window.addEventListener('popstate',sync);document.addEventListener('click',function(){setTimeout(sync,0)});
})();