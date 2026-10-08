'use strict';
// The script derives both companions from its own URL. No fixed activity name.
const scriptURL=new URL(document.currentScript.src);
const CONFIG_CACHE_KEY='exi-11-01-E1E94:situer-sur-un-planisphere:config-v1';
function sibling(suffix){const u=new URL(scriptURL);u.pathname=u.pathname.replace(/\.js$/,suffix);u.search='';u.hash='';return u.href}
function validateConfig(config){
const p=config?.map?.projection,e=config?.exercise;
if(config?.version!==1||!p||!e||!Number.isInteger(e.seriesLength)||e.seriesLength<1||e.seriesLength>55||!Array.isArray(e.latitudes)||!e.latitudes.length||!e.latitudes.every(v=>[-60,-30,0,30,60].includes(v))||!Array.isArray(e.longitudes)||!e.longitudes.length||!e.longitudes.every(v=>Number.isInteger(v)&&Math.abs(v)<=150&&v%30===0)||new Set(e.latitudes).size!==e.latitudes.length||new Set(e.longitudes).size!==e.longitudes.length||e.seriesLength>e.latitudes.length*e.longitudes.length||p.centerX!==560||p.centerY!==320||p.radiusX!==490||p.radiusY!==230||p.polarWidth!==.6)throw new Error('Le JSON ne correspond pas à cette activité.');
return config;
}
async function loadConfig(){
if(location.protocol!=='file:'){
const response=await fetch(sibling('.json'));
if(!response.ok)throw new Error('Configuration introuvable ('+response.status+')');
return validateConfig(await response.json());
}
const button=document.getElementById('importJSON'),input=document.getElementById('jsonFile'),status=document.getElementById('importStatus');
document.getElementById('localImport').hidden=false;
const expectedName=decodeURIComponent(new URL(sibling('.json')).pathname.split('/').pop());
let resolveInitial;
const firstLoad=new Promise(resolve=>{resolveInitial=resolve});
button.onclick=()=>input.click();
input.onchange=async()=>{
const file=input.files?.[0];if(!file)return;
try{
const config=validateConfig(JSON.parse(await file.text()));
try{localStorage.setItem(CONFIG_CACHE_KEY,JSON.stringify(config))}catch(error){}
status.textContent='JSON importé et mémorisé : '+file.name;
if(resolveInitial){const resolve=resolveInitial;resolveInitial=null;resolve(config)}else location.reload();
}catch(error){status.textContent='Import impossible : '+(error instanceof SyntaxError?'le fichier ne contient pas un JSON valide.':error.message)}finally{input.value=''}
};
try{
const saved=localStorage.getItem(CONFIG_CACHE_KEY);
if(saved){const config=validateConfig(JSON.parse(saved));resolveInitial=null;status.textContent='Données locales mémorisées. Utilise le bouton pour recharger '+expectedName+'.';return config}
}catch(error){}
status.textContent='Pour commencer, importe le fichier '+expectedName+'.';
return firstLoad;
}
(async()=>{
try {
for(const id of ['readTab','placeTab','validate','restart','clear'])document.getElementById(id).disabled=true;
const config=await loadConfig();
for(const id of ['readTab','placeTab','validate','restart','clear'])document.getElementById(id).disabled=false;
const P=config.map.projection,settings=config.exercise;

'use strict';
let KEY='exi-11-01-E1E94:mission-coordonnees-v1';let mode='read';const $=id=>document.getElementById(id);const NS='http://www.w3.org/2000/svg';
// One projection for every coastline, parallel, meridian, label and point.
function project(lon,lat){const t=lat/90;return [P.centerX+lon/180*P.radiusX*(P.polarWidth+(1-P.polarWidth)*Math.sqrt(Math.max(0,1-t*t))),P.centerY-t*P.radiusY]}
function el(tag,attrs,parent=$('map')){const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);parent.appendChild(n);return n}
function path(points){return points.map((p,i)=>(i?'L':'M')+project(...p).join(',')).join(' ')}
el('image',{href:sibling('.1.png'),x:0,y:0,width:1120,height:610});
const marker=el('g',{});el('circle',{r:10,fill:'#cc413a',stroke:'white','stroke-width':3},marker);const mt=el('text',{x:14,y:-12,'font-size':24,'font-weight':750,fill:'#a32927',stroke:'white','stroke-width':4,'paint-order':'stroke'},marker);mt.textContent='A';
const chosenMarker=el('g',{'pointer-events':'none'});el('circle',{r:10,fill:'#356cb6',stroke:'white','stroke-width':3},chosenMarker);const chosenLabel=el('text',{x:14,y:25,'font-size':18,fill:'#245390',stroke:'white','stroke-width':3,'paint-order':'stroke'},chosenMarker);chosenLabel.textContent='Ton clic';
const empty=()=>({version:1,series:[],index:0,results:[],errors:[],attempts:0,correct:0});let state=empty(),persistent=true;
try{const saved=JSON.parse(localStorage.getItem(KEY));if(saved&&saved.version===1&&Array.isArray(saved.series)&&saved.series.length===settings.seriesLength&&saved.series.every(p=>settings.latitudes.includes(p.lat)&&Number.isInteger(p.lon)&&Math.abs(p.lon)<=150&&p.lon%30===0)&&Array.isArray(saved.results)&&Array.isArray(saved.errors)&&Number.isInteger(saved.index)&&saved.index>=0&&saved.index<settings.seriesLength&&Number.isFinite(saved.attempts)&&Number.isFinite(saved.correct))state=saved}catch(e){persistent=false}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){persistent=false}$('storage').textContent=persistent?'Ta série, tes scores et tes erreurs sont enregistrés dans ce navigateur.':'La sauvegarde est indisponible dans ce navigateur. Tu peux quand même jouer.'}
function fresh(){let pool=[];for(const lat of settings.latitudes)for(const lon of settings.longitudes)pool.push({lat,lon});for(let i=pool.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}state.series=pool.slice(0,settings.seriesLength);state.index=0;state.results=[];save();render()}
function coord(p){return 'latitude '+Math.abs(p.lat)+'°'+(p.lat===0?'':p.lat>0?' N':' S')+' ; longitude '+Math.abs(p.lon)+'°'+(p.lon===0?'':p.lon>0?' E':' O')}
function render(){const p=state.series[state.index],r=state.results[state.index];marker.setAttribute('transform','translate('+project(p.lon,p.lat).join(' ')+')');marker.setAttribute('display',mode==='place'&&!r?'none':'inline');chosenMarker.setAttribute('display',mode==='place'&&r&&!r.ok?'inline':'none');if(mode==='place'&&r&&!r.ok)chosenMarker.setAttribute('transform','translate('+project(r.answer.eo==='O'?-r.answer.lon:r.answer.lon,r.answer.ns==='S'?-r.answer.lat:r.answer.lat).join(' ')+')');$('target').hidden=mode!=='place';$('target').textContent='Place A : '+coord(p);$('answerFields').hidden=mode==='place';$('readingHint').hidden=mode==='place';$('validate').hidden=mode==='place';$('instruction').textContent=mode==='place'?'Lis les coordonnées, puis clique sur la bonne intersection du quadrillage.':'Trouve la latitude et la longitude du point A.';$('map').setAttribute('class',mode==='place'?'placing':'');$('map').setAttribute('aria-label',mode==='place'?'Planisphère : clique pour placer le point A':'Planisphère avec un point A à repérer');$('progress').textContent='Point '+(state.index+1)+' / '+settings.seriesLength;$('lat').value=r?r.answer.lat:'';$('lon').value=r?r.answer.lon:'';$('ns').value=r?r.answer.ns:'N';$('eo').value=r?r.answer.eo:'E';for(const id of ['lat','lon','ns','eo','validate'])$(id).disabled=!!r;$('next').hidden=!r||state.index===settings.seriesLength-1;$('feedback').className=r?(r.ok?'good':'bad'):'';$('feedback').textContent=r?r.message:'';$('score').textContent='Cette série : '+state.results.filter(x=>x.ok).length+' / '+state.results.length+' réussis';$('total').textContent='Depuis le début : '+state.correct+' / '+state.attempts+' réussis';if(r&&state.index===settings.seriesLength-1)$('feedback').textContent+=' Série terminée ! Lance une nouvelle série.';$('count').textContent='('+state.errors.length+')';$('history').replaceChildren();state.errors.slice().reverse().forEach(e=>{let li=document.createElement('li');li.textContent=e.date+' — Ta réponse : '+e.answer+' → '+e.message+' Bonne réponse : '+coord(e.point)+'.';$('history').appendChild(li)});if(!state.errors.length){let li=document.createElement('li');li.textContent='Aucune erreur enregistrée.';$('history').appendChild(li)}}
$('form').addEventListener('submit',e=>{e.preventDefault();if(state.results[state.index])return;const p=state.series[state.index],a={lat:Number($('lat').value),lon:Number($('lon').value),ns:$('ns').value,eo:$('eo').value};const latOK=a.lat===Math.abs(p.lat)&&(p.lat===0||a.ns===(p.lat>0?'N':'S')),lonOK=a.lon===Math.abs(p.lon)&&(p.lon===0||a.eo===(p.lon>0?'E':'O'));const ok=latOK&&lonOK;const message=ok?'A+ — Bravo, les deux coordonnées sont correctes !':'A− — Latitude '+(latOK?'correcte':'incorrecte')+' ; longitude '+(lonOK?'correcte':'incorrecte')+'. Réponse : '+coord(p)+'.';state.results.push({ok,answer:a,message});state.attempts++;if(ok)state.correct++;else state.errors.push({date:new Date().toLocaleDateString('fr-FR'),point:p,answer:a.lat+'° '+a.ns+' ; '+a.lon+'° '+a.eo,message:'Latitude '+(latOK?'correcte':'incorrecte')+', longitude '+(lonOK?'correcte':'incorrecte')+'.'});save();render();if(!$('next').hidden)$('next').focus();else $('restart').focus()});

function switchMode(nextMode){if(nextMode===mode)return;save();mode=nextMode;KEY=mode==='read'?'exi-11-01-E1E94:mission-coordonnees-v1':'exi-11-01-E1E94:mission-coordonnees-placement-v1';state=empty();try{const s=JSON.parse(localStorage.getItem(KEY));if(s&&s.version===1&&Array.isArray(s.series)&&s.series.length===settings.seriesLength&&s.series.every(p=>settings.latitudes.includes(p.lat)&&Number.isInteger(p.lon)&&Math.abs(p.lon)<=150&&p.lon%30===0)&&Array.isArray(s.results)&&Array.isArray(s.errors)&&Number.isInteger(s.index)&&s.index>=0&&s.index<settings.seriesLength&&Number.isFinite(s.attempts)&&Number.isFinite(s.correct))state=s}catch(e){}$('readTab').setAttribute('aria-selected',mode==='read');$('placeTab').setAttribute('aria-selected',mode==='place');$('exercise').setAttribute('aria-labelledby',mode==='read'?'readTab':'placeTab');if(!state.series.length)fresh();else{render();save()}}
$('readTab').onclick=()=>switchMode('read');$('placeTab').onclick=()=>switchMode('place');
// Invert the very same projection, then select the nearest grid intersection.
function placePoint(x,y,tolerance=20){if(mode!=='place'||state.results[state.index])return;const rawLat=(P.centerY-y)/P.radiusY*90;if(Math.abs(rawLat)>75)return;const t=rawLat/90,rawLon=(x-P.centerX)/(P.radiusX*(P.polarWidth+(1-P.polarWidth)*Math.sqrt(1-t*t)))*180;if(Math.abs(rawLon)>165)return;const lat=Math.round(rawLat/30)*30,lon=Math.round(rawLon/30)*30;if(Math.abs(lat)>60||Math.abs(lon)>150)return;const xy=project(lon,lat);if(Math.hypot(x-xy[0],y-xy[1])>tolerance){$('feedback').className='';$('feedback').textContent='Clique plus près d’une intersection du quadrillage.';return}const p=state.series[state.index],latOK=lat===p.lat,lonOK=lon===p.lon,ok=latOK&&lonOK,a={lat:Math.abs(lat),ns:lat<0?'S':'N',lon:Math.abs(lon),eo:lon<0?'O':'E'};const message=ok?'A+ — Bravo, tu as placé le point au bon endroit !':'A− — Latitude '+(latOK?'correcte':'incorrecte')+' ; longitude '+(lonOK?'correcte':'incorrecte')+'. Le point rouge A montre la bonne position ; le point bleu montre ton clic.';state.results.push({ok,answer:a,message});state.attempts++;if(ok)state.correct++;else state.errors.push({date:new Date().toLocaleDateString('fr-FR'),point:p,answer:coord({lat,lon}),message:'Latitude '+(latOK?'correcte':'incorrecte')+', longitude '+(lonOK?'correcte':'incorrecte')+'.'});save();render()}
$('map').addEventListener('click',e=>{if(mode!=='place')return;const matrix=$('map').getScreenCTM();if(!matrix)return;const point=$('map').createSVGPoint();point.x=e.clientX;point.y=e.clientY;const local=point.matrixTransform(matrix.inverse());placePoint(local.x,local.y,Math.min(25,16/Math.abs(matrix.a)))});
$('next').onclick=()=>{if(state.results[state.index]&&state.index<settings.seriesLength-1){state.index++;save();render();$('lat').focus()}};$('restart').onclick=fresh;$('clear').onclick=()=>{state.errors=[];state.attempts=0;state.correct=0;save();render()};if(!state.series.length)fresh();else{render();save()}

} catch(error) {document.getElementById('feedback').textContent='Chargement impossible. Vérifie le fichier JSON compagnon et la présence des quatre fichiers dans le même dossier.';document.getElementById('feedback').className='bad';console.error(error)}
})();
