/* Logique de l'exercice. Le contenu est reconstruit à partir du nom de ce script : CLE.js → CLE.json */
(function(){
  var SRC = document.currentScript.src;
  var CLE = decodeURIComponent(SRC.split('?')[0].split('#')[0].split('/').pop()).replace(/\.js$/,'');
  var JSON_URL = new URL(CLE + '.json', SRC).href;
  var K_MODE = CLE + ':mode', K_TAILLE = CLE + ':taille';

  var $ = function(s,r){ return (r||document).querySelector(s); };
  function el(tag,cls){ var e=document.createElement(tag); if(cls) e.className=cls; return e; }
  function esc(t){ return String(t).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];}); }
  function lire(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  function ecrire(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
  function melanger(a){ var b=a.slice(); for(var i=b.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=b[i]; b[i]=b[j]; b[j]=t; } return b; }
  function norm(s){ return String(s||'').toLowerCase().replace(/[’`]/g,"'").replace(/\s+/g,' ').trim(); }
  function sans(s){ return s.normalize('NFD').replace(/[\u0300-\u036f]/g,''); }

  var NOM = {i:'imparfait', ps:'passé simple'};
  var DATA=null, ET=[], cur=0;
  var mode = lire(K_MODE)==='trous' ? 'trous' : 'menu';   /* mémoire locale du dernier mode choisi */
  var taille = parseInt(lire(K_TAILLE),10) || 18;

  /* ===== Chargement ===== */
  function appliquer(d){
    DATA = d;
    $('#chargement').classList.remove('visible');
    document.title = d.titre || 'Exercice';
    $('#titre').textContent = d.titre || '';
    $('#sous-titre').textContent = d.sousTitre || '';
    var a = $('#aide');
    a.innerHTML = '<details open><summary>Comment choisir ?</summary><ul>' +
      (d.aide||[]).map(function(x){return '<li>'+esc(x)+'</li>';}).join('') + '</ul></details>';
    ET = d.textes.map(nouvelEtat);
    cur = 0;
    construireNav(); afficher();
  }
  fetch(JSON_URL).then(function(r){ if(!r.ok) throw new Error(); return r.json(); })
    .then(appliquer)
    .catch(function(){ $('#chargement').classList.add('visible'); });
  $('#chargement-fichier').addEventListener('change', function(ev){
    var f = ev.target.files[0]; if(!f) return;
    var fr = new FileReader();
    fr.onload = function(){ try{ appliquer(JSON.parse(fr.result)); }catch(x){ alert('Fichier JSON invalide.'); } };
    fr.readAsText(f);
  });

  /* ===== Outils : mode, taille ===== */
  function majMode(){
    $('#mode-menu').setAttribute('aria-pressed', mode==='menu');
    $('#mode-trous').setAttribute('aria-pressed', mode==='trous');
  }
  function choisirMode(m){ mode=m; ecrire(K_MODE,m); majMode(); if(DATA) afficher(); }
  $('#mode-menu').onclick = function(){ choisirMode('menu'); };
  $('#mode-trous').onclick = function(){ choisirMode('trous'); };
  function majTaille(){ document.documentElement.style.fontSize = taille+'px'; ecrire(K_TAILLE,taille); }
  $('#taille-plus').onclick = function(){ taille=Math.min(30,taille+2); majTaille(); };
  $('#taille-moins').onclick = function(){ taille=Math.max(14,taille-2); majTaille(); };
  majMode(); majTaille();

  /* ===== Données ===== */
  function ids(t){ var r=[],m,re=/\{(\d+)\}/g; while((m=re.exec(t.texte))) r.push(+m[1]); return r; }
  function trou(t,n){ return t.trous.filter(function(x){return +x.n===n;})[0]; }
  function nouvelEtat(t){
    var o={verifie:false,score:0,total:0,res:{},g:{}};
    ids(t).forEach(function(n){ o.g[n]={choix:null,saisie:'',ordre:melanger(['i','ps'])}; if(trou(t,n)) o.total++; });
    return o;
  }

  /* ===== Navigation ===== */
  function construireNav(){
    var nav=$('#nav'); nav.innerHTML='';
    DATA.textes.forEach(function(t,k){
      var b=el('button'); b.textContent=k+1; b.title=t.titre;
      b.onclick=function(){ aller(k); }; nav.appendChild(b);
    });
    var bb=el('button'); bb.textContent='★'; bb.title='Bilan'; bb.onclick=function(){ aller(DATA.textes.length); }; nav.appendChild(bb);
  }
  function majNav(){
    var bs=$('#nav').children;
    for(var k=0;k<bs.length;k++){
      bs[k].className=(k===cur?'actif ':'')+(ET[k]&&ET[k].verifie?'fait':'');
    }
  }
  function aller(k){ arreterVoix(); cur=k; afficher(); window.scrollTo({top:0,behavior:'smooth'}); }

  /* ===== Affichage ===== */
  function afficher(){
    var z=$('#ecran'); z.innerHTML='';
    if(cur>=DATA.textes.length) z.appendChild(vueBilan()); else z.appendChild(vueTexte(cur));
    majNav();
  }

  function vueTexte(k){
    var t=DATA.textes[k], e=ET[k];
    var carte=el('div','carte');
    carte.innerHTML='<h2>'+esc(t.titre)+'</h2><p class="source">'+esc(t.source||'')+'</p>';
    var zone=el('div','texte'), idx=0;
    t.texte.split(/\n\s*\n/).forEach(function(par){
      var p=el('p');
      par.split(/\{(\d+)\}/).forEach(function(s,j){
        if(j%2===0) p.appendChild(document.createTextNode(s));
        else p.appendChild(creerTrou(t,e,+s,++idx));
      });
      zone.appendChild(p);
    });
    carte.appendChild(zone);

    var act=el('div','actions');
    act.appendChild(bouton('🔊 Lire le texte','btn second',function(){ voix(texteAudio(t,e)); }));
    if(!e.verifie) act.appendChild(bouton('Vérifier','btn',function(){ verifier(k); }));
    else act.appendChild(bouton('Recommencer ce texte','btn second',function(){ ET[k]=nouvelEtat(t); afficher(); }));
    carte.appendChild(act);

    if(e.verifie){
      var pc=e.total?Math.round(e.score/e.total*100):0;
      var msg = pc>=90 ? 'Excellent !' : pc>=70 ? 'Très bien !' : pc>=50 ? 'Bon travail, tu progresses.' : 'Bon début : lis les explications en jaune puis recommence.';
      var r=el('div','resume'); r.textContent=e.score+' / '+e.total+' — '+msg; carte.appendChild(r);
      carte.appendChild(listeRevoir(t,e));
      var suite=el('div','actions');
      suite.appendChild(bouton(k+1<DATA.textes.length?'Texte suivant →':'Voir le bilan →','btn',function(){ aller(k+1); }));
      carte.appendChild(suite);
    }
    return carte;
  }

  function bouton(txt,cls,fn){ var b=el('button',cls); b.textContent=txt; b.onclick=fn; return b; }

  function creerTrou(t,e,n,idx){
    var d=trou(t,n);
    if(!d) return document.createTextNode('[?'+n+']');
    var g=e.g[n], w=el('span','trou');
    if(e.verifie){
      var r=e.res[n];
      w.className='trou '+(r.ok?'ok':'revoir');
      w.innerHTML='<sup>'+idx+'</sup>'+esc(d[d.t])+'<small>('+esc(d.inf)+')</small>';
      return w;
    }
    if(mode==='menu'){
      var s=el('select'); s.setAttribute('aria-label','Forme du verbe '+d.inf);
      var o0=el('option'); o0.value=''; o0.textContent='…'; s.appendChild(o0);
      g.ordre.forEach(function(c){ var o=el('option'); o.value=c; o.textContent=d[c]; if(g.choix===c) o.selected=true; s.appendChild(o); });
      s.onchange=function(){ g.choix=s.value||null; };
      w.appendChild(s);
    } else {
      var inp=el('input'); inp.type='text'; inp.value=g.saisie;
      inp.size=Math.max(8,d[d.t].length+2); inp.autocomplete='off'; inp.spellcheck=false;
      inp.setAttribute('autocapitalize','off'); inp.setAttribute('aria-label','Forme du verbe '+d.inf);
      inp.oninput=function(){ g.saisie=inp.value; };
      inp.onkeydown=function(ev){
        if(ev.key==='Enter'){ ev.preventDefault();
          var tous=[].slice.call(document.querySelectorAll('.texte input')); var p=tous.indexOf(inp);
          if(tous[p+1]) tous[p+1].focus(); }
      };
      w.appendChild(inp);
    }
    var inf=el('span','inf'); inf.textContent='('+d.inf+')'; w.appendChild(inf);
    return w;
  }

  /* ===== Vérification ===== */
  function verifier(k){
    var t=DATA.textes[k], e=ET[k], vides=0;
    ids(t).forEach(function(n){
      if(!trou(t,n)) return; var g=e.g[n];
      if(mode==='menu' ? !g.choix : !g.saisie.trim()) vides++;
    });
    if(vides && !confirm('Il reste '+vides+' trou(s) sans réponse. Vérifier quand même ?')) return;
    e.verifie=true; e.score=0; e.res={};
    ids(t).forEach(function(n){
      var d=trou(t,n); if(!d) return; var g=e.g[n];
      var r={ok:false,autre:false,accent:false,vide:false};
      if(mode==='menu'){
        r.vide=!g.choix; r.ok=(g.choix===d.t); r.autre=!!g.choix && !r.ok;
      } else {
        var s=norm(g.saisie); r.vide=!s;
        var bon=norm(d[d.t]), autre=norm(d[d.t==='i'?'ps':'i']);
        if(s===bon) r.ok=true;
        else if(s && sans(s)===sans(bon)){ r.ok=true; r.accent=true; }
        else if(s && sans(s)===sans(autre)) r.autre=true;
      }
      if(r.ok) e.score++;
      e.res[n]=r;
    });
    afficher();
  }

  function listeRevoir(t,e){
    var box=el('div','revoir-liste'), items=[], idx=0;
    ids(t).forEach(function(n){
      var d=trou(t,n); if(!d) return; idx++;
      var r=e.res[n];
      if(r.ok && !r.accent) return;
      var li='<li><b>'+idx+'.</b> ('+esc(d.inf)+') → <b>'+esc(d[d.t])+'</b> ('+NOM[d.t]+'). ';
      if(r.accent) li+='Attention à l\'orthographe et aux accents. ';
      else if(r.autre) li+='Tu avais pensé à l\'autre temps ; ici : ';
      li+=esc(d.e||'')+'</li>';
      items.push(li);
    });
    if(!items.length){ box.style.background='var(--ok-fond)'; box.style.borderColor='var(--ok)'; box.innerHTML='<h3>Rien à revoir : bravo !</h3>'; return box; }
    box.innerHTML='<h3>À revoir</h3><ol>'+items.join('')+'</ol>';
    var b=bouton('🔊 Lire les explications','petit',function(){
      voix(items.map(function(x){ return x.replace(/<[^>]+>/g,''); }).join(' '));
    });
    b.style.marginTop='8px'; box.appendChild(b);
    return box;
  }

  function vueBilan(){
    var carte=el('div','carte'), tot=0, sc=0, faits=0;
    carte.innerHTML='<h2>Bilan</h2>';
    DATA.textes.forEach(function(t,k){
      var e=ET[k]; tot+=e.total; sc+=e.score; if(e.verifie) faits++;
      var l=el('div','bilan-ligne');
      l.innerHTML='<span>'+esc(t.titre)+'</span><b>'+(e.verifie?e.score+' / '+e.total:'à faire')+'</b>';
      l.style.cursor='pointer'; l.onclick=function(){ aller(k); };
      carte.appendChild(l);
    });
    var r=el('div','resume');
    r.textContent = faits ? 'Total : '+sc+' / '+tot+(faits<DATA.textes.length?' (textes terminés : '+faits+' sur '+DATA.textes.length+')':'') : 'Fais d\'abord un texte pour voir ton bilan.';
    carte.appendChild(r);
    var act=el('div','actions');
    act.appendChild(bouton('↺ Tout recommencer','btn second',function(){ ET=DATA.textes.map(nouvelEtat); aller(0); }));
    carte.appendChild(act);
    return carte;
  }

  /* ===== Lecture audio (synthèse vocale du navigateur, français) ===== */
  function texteAudio(t,e){
    return t.texte.replace(/\{(\d+)\}/g,function(m,n){
      var d=trou(t,+n); if(!d) return ' ';
      return e.verifie ? d[d.t] : ' … ';
    }).replace(/\s+/g,' ');
  }
  function arreterVoix(){ if('speechSynthesis' in window) window.speechSynthesis.cancel(); }
  function voix(txt){
    if(!('speechSynthesis' in window)){ alert('La lecture audio n\'est pas disponible dans ce navigateur.'); return; }
    if(window.speechSynthesis.speaking){ window.speechSynthesis.cancel(); return; }
    var u=new SpeechSynthesisUtterance(txt); u.lang='fr-FR'; u.rate=.9;
    var v=window.speechSynthesis.getVoices().filter(function(x){return /^fr/i.test(x.lang);})[0];
    if(v) u.voice=v;
    window.speechSynthesis.speak(u);
  }
})();
