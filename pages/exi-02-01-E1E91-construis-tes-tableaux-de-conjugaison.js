/* =====================================================================
   Moteur du programme d'interrogation de conjugaison
   ---------------------------------------------------------------------
   Les trois fichiers du programme portent le même nom et se distinguent
   par leur extension (.html, .js, .json). Aucun n'a besoin de connaître
   le nom des autres : chacun déduit ce qu'il cherche de son propre nom.
     - le .html charge le .js qui porte son nom ;
     - le .js charge le .json qui porte son nom (données : verbes, temps
       à apprendre, planning) ;
     - l'interface (.html) est repérée par les id des éléments.
   Sections :
     1. Configuration
     2. Génération du PDF (sans passer par l'impression du navigateur)
     3. Chargement des données
     4. Fonctions liées à un verbe
     5. Sauvegarde locale de la progression
     6. Interface : liste des verbes et feuille
     7. Déroulement de l'interrogation
     8. Événements et démarrage
   ===================================================================== */
(function(){
'use strict';

/* ---------- 1. Configuration ---------- */
var CONFIG = {
  cleProgression: 'exi-02.01.E1E91-construis-tableaux:progression:v1',
  cleCopieDonnees: 'donnees-locales:exi-02.01.E1E91-construis-tes-tableaux-de-conjugaison:v1',
  clicsMode: 5,        /* nombre de clics rapides sur le titre pour le mode discret */
  delaiClicsMs: 3000,  /* fenêtre de temps pour ces clics */
  delaiBonneReponseMs: 700,
  attenteRepresentation: 2  /* nombre de questions avant de reposer une question ratée */
};
var $ = function(id){ return document.getElementById(id); };

/* Le fichier de données est celui qui porte le même nom que ce script, avec l'extension .json */
var URL_SCRIPT = (document.currentScript && document.currentScript.src) || '';
var URL_DONNEES = URL_SCRIPT.replace(/\.js(\?.*)?$/, '.json');
var NOM_DONNEES = decodeURIComponent(URL_DONNEES.split('?')[0].split('/').pop());
var EST_LOCAL = window.location.protocol === 'file:';

/* ---------- 2. Génération du PDF ---------- */
function construirePdf(verbName, texts, footer, tenses){
  var W = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,
    556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,
    667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,
    278,278,278,469,556,333,
    556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,
    334,260,334,584];
  function base(ch){ var c = ch.normalize('NFD').charAt(0); return c; }
  function tw(s, size){
    var t = 0;
    for(var i=0;i<s.length;i++){ var c = base(s.charAt(i)).charCodeAt(0); t += (c>=32 && c<=126) ? W[c-32] : 556; }
    return t*size/1000;
  }
  function esc(s){
    var o = '';
    for(var i=0;i<s.length;i++){
      var ch = s.charAt(i), c = ch.charCodeAt(0);
      if(c === 0x2019 || c === 0x2018) ch = "'";
      else if(c > 255) ch = '?';
      if(ch === '(' || ch === ')' || ch === '\\') o += '\\' + ch; else o += ch;
    }
    return o;
  }
  var H = 595, ops = [];
  function n(x){ return (Math.round(x*100)/100).toString(); }
  function line(x1,y1,x2,y2,w){ ops.push(n(w||0.8)+' w '+n(x1)+' '+n(H-y1)+' m '+n(x2)+' '+n(H-y2)+' l S'); }
  function rect(x,y,w,h){ ops.push('0.8 w '+n(x)+' '+n(H-y-h)+' '+n(w)+' '+n(h)+' re S'); }
  function text(s, x, y, size, font, color){
    ops.push('BT '+(color||'0 0 0')+' rg /'+(font||'F1')+' '+n(size)+' Tf '+n(x)+' '+n(H-y)+' Td ('+esc(s)+') Tj ET');
  }
  function ctext(s, cx, y, size, font, color){ text(s, cx - tw(s,size)/2, y, size, font, color); }
  var INK = '0.12 0.23 0.58';

  var X0 = 30, CW = 782, COL = CW/4;
  /* Verbe */
  var vy = 38, vs = 12;
  var pre = 'Verbe : ', mid = ' - ';
  var nameSize = 14, nameW = Math.max(110, tw(verbName, nameSize)+16), blank2 = 30;
  var total = tw(pre,vs) + nameW + tw(mid,vs) + blank2;
  var vx = 30 + CW/2 - total/2;
  text(pre, vx, vy, vs);
  var nx = vx + tw(pre,vs);
  line(nx, vy+2, nx+nameW, vy+2, 0.8);
  ctext(verbName, nx+nameW/2, vy, nameSize, 'F2', INK);
  var mx = nx + nameW;
  text(mid, mx, vy, vs);
  line(mx+tw(mid,vs), vy+2, mx+tw(mid,vs)+blank2, vy+2, 0.8);

  /* Indicatif */
  var top = 56, titleH = 18, headH = 18, padTop = 8, rowH = 27, nLines = 6;
  var bodyH = padTop + rowH*nLines, blockH = headH + bodyH;
  var boxH = titleH + 2*blockH;
  rect(X0, top, CW, boxH);
  ctext('Indicatif', X0+CW/2, top+13, 11);
  line(X0, top+titleH, X0+CW, top+titleH);
  var TN = tenses.map(function(t){ return [t.cle, t.label]; });
  function fitted(s, maxW){
    var size = 12.5;
    while(size > 7 && tw(s,size) > maxW) size -= 0.5;
    return size;
  }
  function cellLine(id, x, yBottom, w){
    var x1 = x + w*0.06, x2 = x + w*0.94;
    line(x1, yBottom, x2, yBottom, 0.8);
    var t = texts[id];
    if(t){ var sz = fitted(t, x2-x1-4); text(t, x1+2, yBottom-3.5, sz, 'F2', INK); }
  }
  TN.forEach(function(t, idx){
    var r = Math.floor(idx/4), c = idx%4;
    var x = X0 + c*COL, y = top + titleH + r*blockH;
    if(c > 0) line(x, y, x, y+blockH);
    if(r > 0) line(X0, y, X0+CW, y);
    ctext(t[1], x+COL/2, y+13, 11);
    line(x, y+headH, x+COL, y+headH);
    for(var i=0;i<nLines;i++){
      cellLine(t[0]+'-'+i, x, y+headH+padTop+rowH*(i+1), COL);
    }
  });

  /* Infinitif / Participe */
  var by = top + boxH + 20, sub = 18, lineRow = 32, bh = titleH + sub + lineRow;
  rect(X0, by, 2*COL, bh);
  ctext('Infinitif', X0+COL, by+13, 11);
  line(X0, by+titleH, X0+2*COL, by+titleH);
  line(X0+COL, by+titleH, X0+COL, by+bh);
  line(X0, by+titleH+sub, X0+2*COL, by+titleH+sub);
  text('Présent', X0+4, by+titleH+13, 11);
  text('Passé', X0+COL+4, by+titleH+13, 11);
  cellLine('infp', X0, by+bh-6, COL);
  cellLine('infpa', X0+COL, by+bh-6, COL);
  var px = X0+3*COL;
  rect(px, by, COL, bh);
  ctext('Participe', px+COL/2, by+13, 11);
  line(px, by+titleH, px+COL, by+titleH);
  text('Passé', px+4, by+titleH+13, 11);
  line(px, by+titleH+sub, px+COL, by+titleH+sub);
  cellLine('part', px, by+bh-6, COL);

  ctext(footer, X0+CW/2, by+bh+26, 8.5);

  var content = ops.join('\n');
  var objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R >> >> /Contents 4 0 R >>',
    '<< /Length '+content.length+' >>\nstream\n'+content+'\nendstream',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'
  ];
  var out = '%PDF-1.4\n', offs = [];
  objs.forEach(function(o,i){ offs.push(out.length); out += (i+1)+' 0 obj\n'+o+'\nendobj\n'; });
  var xref = out.length;
  out += 'xref\n0 '+(objs.length+1)+'\n0000000000 65535 f \n';
  offs.forEach(function(o){ out += ('0000000000'+o).slice(-10)+' 00000 n \n'; });
  out += 'trailer\n<< /Size '+(objs.length+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';
  var bytes = new Uint8Array(out.length);
  for(var i=0;i<out.length;i++) bytes[i] = out.charCodeAt(i) & 255;
  return bytes;
}

/* ---------- 3. Chargement des données ---------- */
var DATA = null, TEMPS = [], TEMPS_PAR_CLE = {}, VERBES = {}, PLAN = [];
var CLES_INDICATIF = [], CLES_TOUTES = [];
var TEMPS_SUPPL = [
  {cle:'infp',  label:'Infinitif présent'},
  {cle:'infpa', label:'Infinitif passé'},
  {cle:'part',  label:'Participe passé'}
];

function installerDonnees(data){
  if(!data || !Array.isArray(data.temps) || !Array.isArray(data.verbes) || !Array.isArray(data.planning)){
    throw new Error('Structure du fichier JSON incomplète');
  }
  DATA = data;
  TEMPS = data.temps; TEMPS_PAR_CLE = {}; VERBES = {}; PLAN = [];
  TEMPS.forEach(function(t){ TEMPS_PAR_CLE[t.cle] = t; });
  CLES_INDICATIF = TEMPS.map(function(t){ return t.cle; });
  CLES_TOUTES = CLES_INDICATIF.concat(TEMPS_SUPPL.map(function(t){ return t.cle; }));
  data.verbes.forEach(function(v){ VERBES[v.nom] = v; });
  data.planning.forEach(function(p){
    p.verbes.forEach(function(e){
      if(!VERBES[e.nom]){ console.warn('Verbe du planning absent de la liste : ' + e.nom); return; }
      PLAN.push({date:p.date, libelle:p.libelle, nom:e.nom, temps: e.temps === 'tous' ? CLES_TOUTES.slice() : e.temps.slice(), tous: e.temps === 'tous'});
    });
  });
}
function entree(nom){ return PLAN.filter(function(e){ return e.nom === nom; })[0]; }

/* ---------- 4. Fonctions liées à un verbe ---------- */
function formesDe(v, cle){
  var t = TEMPS_PAR_CLE[cle];
  if(!t) return null;
  if(t.compose) return v.auxiliaire && DATA.auxiliaires[v.auxiliaire] ? DATA.auxiliaires[v.auxiliaire][cle] || null : null;
  return v.formes && v.formes[cle] ? v.formes[cle] : null;
}
function participeAffiche(v, i){
  if(!v.accord) return v.participe;
  return v.participe + '(e)' + ['','','','s','(s)','s'][i];
}
function infinitifPasse(v){ return v.auxiliaire + ' ' + v.participe + (v.accord ? '(e)' : ''); }
function pronomDe(v, i, premiereForme){
  if(v.reflechi) return DATA.pronomsReflechis[i];
  if(i === 0 && /^[aeiouhâêîôûéèëï]/i.test(premiereForme)) return "j'";
  return DATA.pronoms[i];
}
function texteDePortee(e){
  if(e.tous) return 'À apprendre à tous les temps : indicatif (' + TEMPS.length + ' temps), infinitif présent et passé, participe passé.';
  var noms = [];
  CLES_TOUTES.forEach(function(k){
    if(e.temps.indexOf(k) < 0) return;
    var t = TEMPS_PAR_CLE[k] || TEMPS_SUPPL.filter(function(s){ return s.cle === k; })[0];
    noms.push(t.label.toLowerCase());
  });
  return 'Temps à remplir : ' + noms.join(', ') + '.';
}
function construireItems(v, cles){
  var items = [];
  TEMPS.forEach(function(t){
    if(cles.indexOf(t.cle) < 0) return;
    var formes = formesDe(v, t.cle);
    if(!formes){ console.warn('Formes manquantes : ' + v.nom + ' / ' + t.cle); return; }
    formes.forEach(function(f, i){
      var alts = f.split('|'), premiere = alts[0];
      var pr = pronomDe(v, i, premiere);
      var txt = pr + (/'$/.test(pr) ? '' : ' ') + premiere + (t.compose ? ' ' + participeAffiche(v, i) : '');
      items.push({id:t.cle + '-' + i, tense:t.cle, tlabel:t.label, comp:!!t.compose, p:i, alts:alts, pron:pr, text:txt});
    });
  });
  if(cles.indexOf('infp') >= 0)  items.push({id:'infp',  tense:'infp',  tlabel:'Infinitif présent', kind:'inf',   alts:[v.nom],         text:v.nom});
  if(cles.indexOf('infpa') >= 0) items.push({id:'infpa', tense:'infpa', tlabel:'Infinitif passé',   kind:'infpa', alts:[v.auxiliaire],  text:infinitifPasse(v)});
  if(cles.indexOf('part') >= 0)  items.push({id:'part',  tense:'part',  tlabel:'Participe passé',   kind:'part',  alts:[v.participe],   text:v.participe});
  return items;
}

/* ---------- 5. Sauvegarde locale de la progression ---------- */
var stockage = {verbe:null, faits:{}};
var stockageOK = true;
function lireStockage(){
  try{
    var brut = window.localStorage.getItem(CONFIG.cleProgression);
    if(brut){ var o = JSON.parse(brut); if(o && typeof o === 'object'){ stockage.verbe = o.verb || null; stockage.faits = o.done || {}; } }
  }catch(e){ stockageOK = false; }
}
function sauver(){
  try{ window.localStorage.setItem(CONFIG.cleProgression, JSON.stringify({verb:stockage.verbe, done:stockage.faits})); stockageOK = true; }
  catch(e){ stockageOK = false; }
  $('saved').textContent = stockageOK
    ? 'La progression est enregistrée automatiquement sur cet appareil.'
    : 'Attention : l\u2019enregistrement local n\u2019est pas disponible ici, la progression sera perdue à la fermeture de la page.';
}
function faitsDe(nom){ return stockage.faits[nom] || []; }

/* ---------- 6. Interface : liste des verbes et feuille ---------- */
var sel = $('verbSelect');
var TOTAUX = {};
function calculerTotaux(){
  TOTAUX = {};
  PLAN.forEach(function(e){ TOTAUX[e.nom] = construireItems(VERBES[e.nom], e.temps).length; });
}
function libelleProgression(nombre, total){
  return nombre + ' réponse' + (nombre > 1 ? 's' : '') + ' sur ' + total;
}
function libelleOption(e){
  var d = faitsDe(e.nom).length, tot = TOTAUX[e.nom];
  return e.nom + (d ? ' — ' + libelleProgression(d, tot) : '') + (d === tot ? ' ✓' : '');
}
function construireListe(courant){
  sel.innerHTML = '';
  var groupes = {};
  PLAN.forEach(function(e){
    if(!groupes[e.date]){
      var g = document.createElement('optgroup');
      groupes[e.date] = {el:g, tous:true};
      sel.appendChild(g);
    }
    if(!e.tous) groupes[e.date].tous = false;
    var o = document.createElement('option'); o.value = e.nom; o.textContent = libelleOption(e);
    groupes[e.date].el.appendChild(o);
  });
  PLAN.forEach(function(e){
    var g = groupes[e.date]; if(g.el.label) return;
    g.el.label = e.libelle + ' · ' + (g.tous ? 'tous les temps' : 'certains temps');
  });
  sel.value = courant;
}
function rafraichirLibelles(){
  Array.prototype.forEach.call(sel.options, function(o){ o.textContent = libelleOption(entree(o.value)); });
}
function construireGrille(){
  var grille = $('grid'); grille.innerHTML = '';
  TEMPS.forEach(function(t){
    var cell = document.createElement('div'); cell.className = 'tcell'; cell.id = 'tc-' + t.cle;
    var html = '<div class="head">' + t.label + '</div><div class="body">';
    for(var i = 0; i < 6; i++) html += '<div class="line" id="cell-' + t.cle + '-' + i + '"></div>';
    cell.innerHTML = html + '</div>';
    grille.appendChild(cell);
  });
}
function ecrireLigne(id, texte){
  var el = $('cell-' + id); if(!el) return;
  el.textContent = texte;
  el.style.fontSize = texte.length > 24 ? '0.85em' : texte.length > 19 ? '0.98em' : '';
}
function griser(el, off){ el.classList.toggle('off', !!off); }

/* ---------- 7. Déroulement de l'interrogation ---------- */
var verbe, entreeCourante, items, parId, restantes, aRepresenter, dernierTemps, courante, etat, minuteur, minuteurConfirm;

function chargerVerbe(nom){
  clearTimeout(minuteur);
  verbe = VERBES[nom]; entreeCourante = entree(nom);
  stockage.verbe = nom; sauver();
  items = construireItems(verbe, entreeCourante.temps); parId = {};
  items.forEach(function(it){ parId[it.id] = it; });

  $('verbName').textContent = verbe.nom;
  TEMPS.forEach(function(t){
    griser($('tc-' + t.cle), entreeCourante.temps.indexOf(t.cle) < 0);
    for(var i = 0; i < 6; i++) ecrireLigne(t.cle + '-' + i, '');
  });
  griser($('box-inf'),  entreeCourante.temps.indexOf('infp') < 0 && entreeCourante.temps.indexOf('infpa') < 0);
  griser($('box-part'), entreeCourante.temps.indexOf('part') < 0);
  ['infp', 'infpa', 'part'].forEach(function(id){ ecrireLigne(id, ''); });
  $('scope').textContent = texteDePortee(entreeCourante);

  var faits = faitsDe(nom).filter(function(id){ return parId[id]; });
  stockage.faits[nom] = faits;
  restantes = {}; items.forEach(function(it){ restantes[it.id] = true; });
  faits.forEach(function(id){ delete restantes[id]; ecrireLigne(id, parId[id].text); });
  aRepresenter = []; dernierTemps = null; courante = null; etat = 'ask';
  majProgression(); rafraichirLibelles();
  $('quiz').hidden = false; $('done').hidden = true;
  questionSuivante(true);
}
function nbRestantes(){ return Object.keys(restantes).length; }
function majProgression(){
  var total = items.length, f = total - nbRestantes();
  $('count').textContent = libelleProgression(f, total);
  $('bar').style.width = (f / total * 100) + '%';
}
function dansRepresentation(id){ return aRepresenter.some(function(r){ return r.id === id; }); }

function choisirSuivante(){
  var due = aRepresenter.filter(function(r){ return r.attente <= 0; })[0];
  if(due){ aRepresenter = aRepresenter.filter(function(r){ return r !== due; }); return parId[due.id]; }
  var pool = items.filter(function(it){ return restantes[it.id] && !dansRepresentation(it.id); });
  if(!pool.length){
    aRepresenter.sort(function(a, b){ return a.attente - b.attente; });
    return parId[aRepresenter.shift().id];
  }
  var autres = pool.filter(function(it){ return it.tense !== dernierTemps; });
  var src = autres.length ? autres : pool;
  return src[Math.floor(Math.random() * src.length)];
}

function questionSuivante(sansFocus){
  if(nbRestantes() === 0){ terminer(); return; }
  courante = choisirSuivante(); etat = 'ask'; dernierTemps = courante.tense;
  $('tense').textContent = courante.tlabel;
  var ligne = $('qrow'); ligne.innerHTML = '';
  function txt(cls, s){ var e = document.createElement('span'); e.className = cls; e.textContent = s; return e; }
  var input = document.createElement('input');
  input.id = 'answer'; input.type = 'text'; input.autocomplete = 'off';
  input.autocapitalize = 'off'; input.spellcheck = false; input.setAttribute('lang', 'fr');
  input.setAttribute('aria-label', 'Ta réponse');
  if(courante.kind === 'inf'){ ligne.appendChild(txt('pron', 'Infinitif présent :')); ligne.appendChild(input); }
  else if(courante.kind === 'infpa'){ ligne.appendChild(input); ligne.appendChild(txt('pron', verbe.participe + (verbe.accord ? '(e)' : ''))); ligne.appendChild(txt('hint', '(infinitif passé)')); }
  else if(courante.kind === 'part'){ ligne.appendChild(txt('pron', 'Participe passé :')); ligne.appendChild(input); }
  else {
    ligne.appendChild(txt('pron', courante.pron));
    ligne.appendChild(input);
    if(courante.comp) ligne.appendChild(txt('pron', participeAffiche(verbe, courante.p)));
  }
  $('validate').hidden = false; $('reveal').hidden = true; $('next').hidden = true;
  var fb = $('feedback'); fb.textContent = ''; fb.className = 'feedback';
  if(!sansFocus) input.focus();
}

function normaliser(s){ return s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[\u2019\u2018]/g, "'"); }

function valider(){
  if(etat !== 'ask') return;
  var input = $('answer');
  var val = normaliser(input.value);
  if(!val){ input.focus(); return; }
  var fb = $('feedback');
  aRepresenter.forEach(function(r){ r.attente--; });
  if(courante.alts.indexOf(val) >= 0){
    etat = 'good';
    delete restantes[courante.id];
    var liste = faitsDe(verbe.nom); if(liste.indexOf(courante.id) < 0) liste.push(courante.id);
    stockage.faits[verbe.nom] = liste; sauver();
    ecrireLigne(courante.id, courante.text);
    input.classList.add('good'); input.readOnly = true;
    fb.textContent = 'Bonne réponse !'; fb.className = 'feedback ok';
    $('validate').hidden = true;
    majProgression(); rafraichirLibelles();
    minuteur = setTimeout(questionSuivante, CONFIG.delaiBonneReponseMs);
  } else {
    etat = 'bad';
    aRepresenter.push({id:courante.id, attente:CONFIG.attenteRepresentation});
    input.classList.add('bad'); input.readOnly = true;
    fb.textContent = 'Ce n\u2019est pas la bonne réponse. Cette question reviendra plus tard.';
    fb.className = 'feedback ko';
    $('validate').hidden = true; $('reveal').hidden = false; $('next').hidden = false;
    $('next').focus();
  }
}
function montrerSolution(){
  $('feedback').textContent = 'Solution : ' + courante.alts.join(' ou ') + ' (la question reviendra quand même).';
  $('reveal').hidden = true;
}
function terminer(){ $('quiz').hidden = true; $('done').hidden = false; }

function telechargerPdf(){
  var textes = {};
  items.forEach(function(it){ var c = $('cell-' + it.id); if(c && c.textContent) textes[it.id] = c.textContent; });
  var slug = verbe.nom.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
  var boite = $('saved');
  try{
    var octets = construirePdf(verbe.nom, textes, $('foot').textContent, TEMPS);
    var url = URL.createObjectURL(new Blob([octets], {type:'application/pdf'}));
    var a = document.createElement('a');
    a.href = url; a.download = 'conjugaison-' + slug + '.pdf';
    document.body.appendChild(a); a.click(); a.remove();
    boite.textContent = 'PDF créé. S\u2019il ne se télécharge pas, ';
    var l = document.createElement('a'); l.href = url; l.download = a.download; l.target = '_blank'; l.textContent = 'clique ici pour l\u2019ouvrir.';
    boite.appendChild(l);
  }catch(e){
    boite.textContent = 'Impossible de créer le PDF : ' + e.message;
  }
}

/* Mode discret : clics rapides sur le titre = tableau du verbe affiché rempli d'un coup,
   sans rien enregistrer dans la progression. */
var clics = [];
function modeDiscret(){
  var now = Date.now();
  clics = clics.filter(function(t){ return now - t < CONFIG.delaiClicsMs; });
  clics.push(now);
  if(clics.length < CONFIG.clicsMode) return;
  clics = [];
  if(!items) return;
  clearTimeout(minuteur);
  items.forEach(function(it){ ecrireLigne(it.id, it.text); delete restantes[it.id]; });
  etat = 'done';
  majProgression(); terminer();
}

/* ---------- 8. Événements et démarrage ---------- */
function premierVerbeParDefaut(){
  var auj = new Date().toISOString().slice(0, 10);
  var prochain = PLAN.filter(function(e){ return e.date >= auj; })[0];
  return (prochain || PLAN[0]).nom;
}
function demarrer(data, source){
  installerDonnees(data);
  calculerTotaux(); construireGrille();
  var depart = (stockage.verbe && VERBES[stockage.verbe] && entree(stockage.verbe)) ? stockage.verbe : premierVerbeParDefaut();
  construireListe(depart);
  chargerVerbe(depart);
  $('dataStatus').textContent = 'Données : ' + source + '.';
  $('app').hidden = false; $('noData').hidden = true;
}
function lierEvenements(){
  $('validate').addEventListener('click', valider);
  $('next').addEventListener('click', function(){ questionSuivante(); });
  $('reveal').addEventListener('click', montrerSolution);
  sel.addEventListener('change', function(){ chargerVerbe(sel.value); });
  $('print').addEventListener('click', telechargerPdf);
  $('title').addEventListener('click', modeDiscret);

  var rb = $('restart');
  function annulerConfirm(){ clearTimeout(minuteurConfirm); rb.dataset.confirm = ''; rb.textContent = 'Recommencer ce verbe'; rb.classList.remove('danger'); }
  rb.addEventListener('click', function(){
    if(rb.dataset.confirm === '1'){
      annulerConfirm();
      stockage.faits[verbe.nom] = []; sauver(); chargerVerbe(verbe.nom);
    } else {
      rb.dataset.confirm = '1'; rb.textContent = 'Effacer la progression de ce verbe ? Clique pour confirmer'; rb.classList.add('danger');
      minuteurConfirm = setTimeout(annulerConfirm, 4000);
    }
  });

  document.addEventListener('keydown', function(e){
    if(e.key !== 'Enter') return;
    var tag = e.target && e.target.tagName;
    if(tag === 'BUTTON' || tag === 'SELECT' || tag === 'INPUT' && e.target.type === 'file') return;
    if(etat === 'ask') valider();
    else if(etat === 'bad') questionSuivante();
  });
  document.querySelectorAll('.accent').forEach(function(b){
    b.addEventListener('click', function(){
      var input = $('answer'); if(!input || input.readOnly) return;
      var s = input.selectionStart == null ? input.value.length : input.selectionStart;
      var e2 = input.selectionEnd == null ? s : input.selectionEnd;
      input.value = input.value.slice(0, s) + b.getAttribute('data-ch') + input.value.slice(e2);
      input.focus(); input.setSelectionRange(s + 1, s + 1);
    });
  });

  /* Chargement manuel du fichier de données .json (utile quand la page est ouverte depuis un fichier local,
     car le navigateur refuse alors de le lire tout seul). */
  $('dataFile').addEventListener('change', function(){
    var f = this.files && this.files[0]; if(!f) return;
    var input = this;
    var lecteur = new FileReader();
    lecteur.onload = function(){
      try{
        var data = JSON.parse(lecteur.result);
        demarrer(data, 'fichier « ' + f.name + ' » chargé à la main');
        var memorise = true;
        try{ window.localStorage.setItem(CONFIG.cleCopieDonnees, lecteur.result); }catch(e){ memorise = false; }
        $('dataStatus').textContent = memorise
          ? 'Données locales actualisées avec « ' + f.name + ' ».'
          : '« ' + f.name + ' » est chargé, mais le navigateur n’a pas permis de le mémoriser.';
      }catch(e){
        $('dataStatus').textContent = 'Fichier refusé : ' + e.message + '. La dernière copie valide est conservée.';
      }
      input.value = '';
    };
    lecteur.onerror = function(){ $('dataStatus').textContent = 'Le fichier sélectionné n’a pas pu être lu.'; input.value = ''; };
    lecteur.readAsText(f);
  });
}

function chargerDonnees(){
  if(EST_LOCAL){
    $('donnees').hidden = false;
    var copie = null;
    try{ copie = window.localStorage.getItem(CONFIG.cleCopieDonnees); }catch(e){}
    if(copie){
      try{
        demarrer(JSON.parse(copie), 'copie locale mémorisée');
        $('dataStatus').textContent = 'Application démarrée avec la copie locale mémorisée. Recharge le JSON ici après une modification.';
        return Promise.resolve();
      }catch(e){}
    }
    $('app').hidden = true;
    $('noData').hidden = false;
    $('noDataMessage').textContent = 'Le navigateur ne peut pas lire automatiquement le JSON en ouverture locale. Charge-le avec le bouton ci-dessous.';
    $('dataStatus').textContent = 'Sélectionne le fichier « ' + NOM_DONNEES + ' ».';
    return Promise.resolve();
  }

  return fetch(URL_DONNEES, {cache:'no-cache'})
    .then(function(r){ if(!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
    .then(function(texte){
      var data = JSON.parse(texte);
      demarrer(data, NOM_DONNEES);
    })
    .catch(function(error){
      $('app').hidden = true;
      $('noData').hidden = false;
      $('noDataMessage').textContent = 'Impossible de charger automatiquement « ' + NOM_DONNEES + ' » : ' + error.message + '.';
    });
}

lireStockage();
lierEvenements();
chargerDonnees();

})();
