
/* Évaluation papier : PDF élève toujours téléchargeable (bouton permanent) et mis en avant à la fin. Fichier : THEME.evalPapier.eleve.pdf (THEME = nom de la page avant le premier point), cherché dans ressources/ puis à côté de la page. */
var Papier = (function () {
  var url = null, theme = decodeURIComponent((location.pathname.split('/').pop() || '')).split('.')[0];
  var libelle = '📄 Télécharger l’évaluation papier (PDF)';
  var st = document.createElement('style');
  st.textContent = '.papier-bandeau{max-width:940px;margin:0 auto;padding:8px 16px 0;text-align:right}.papier-lien,.papier-gros{display:inline-block;background:hsl(30 90% 38%);color:#fff;text-decoration:none;font:bold .9rem system-ui,sans-serif;padding:5px 14px;border-radius:999px;box-shadow:0 2px 5px rgba(0,0,0,.2)}.papier-gros{font-size:1.2rem;padding:12px 24px;border-radius:10px;margin-top:6px}.papier-lien:hover,.papier-gros:hover{filter:brightness(1.12)}.papier-fin{margin:18px auto;padding:18px 20px;border-radius:12px;border:3px solid hsl(30 90% 38%);background:#fbf1d6;color:#26231f;max-width:640px;text-align:center}.papier-fin h2{margin:0 0 6px}.papier-fin[hidden],.papier-bandeau[hidden],.papier-lien[hidden],.papier-gros[hidden]{display:none}';
  document.head.appendChild(st);
  function adresses() { var f = theme + '.evalPapier.eleve.pdf'; return ['ressources/' + f, f]; }
  function verifier(fin) {
    var a = adresses();
    if (url !== null) return fin(url);
    if (location.protocol === 'file:' || typeof fetch !== 'function') { url = a[0]; return fin(url); }
    fetch(a[0], { method: 'HEAD' }).then(function (r) { if (!r.ok) throw 0; url = a[0]; fin(url); })
      .catch(function () { fetch(a[1], { method: 'HEAD' }).then(function (r) { if (!r.ok) throw 0; url = a[1]; fin(url); }).catch(function () { url = ''; fin(''); }); });
  }
  function lien(cl) {
    var l = document.createElement('a'); l.className = cl; l.href = adresses()[0]; l.setAttribute('download', ''); l.target = '_blank'; l.rel = 'noopener'; l.textContent = libelle;
    verifier(function (u) { if (u) l.href = u; else l.hidden = true; });
    return l;
  }
  return {
    barre: function (avant) {
      if (!avant || document.getElementById('papier-fixe')) return;
      var b = document.createElement('div'); b.id = 'papier-fixe'; b.className = 'papier-bandeau'; b.appendChild(lien('papier-lien'));
      avant.parentNode.insertBefore(b, avant);
      verifier(function (u) { if (!u) b.hidden = true; });
    },
    bloc: function () {
      var c = document.createElement('section'); c.className = 'papier-fin';
      var h = document.createElement('h2'); h.textContent = 'Et maintenant, à toi d’écrire !';
      var p = document.createElement('p'); p.textContent = 'Ce quiz vérifie ce que tu sais. L’évaluation papier te demande d’écrire un raisonnement avec tes mots. Télécharge-la, imprime-la (ou recopie les questions sur une feuille) et essaie-toi.';
      c.appendChild(h); c.appendChild(p); c.appendChild(lien('papier-gros'));
      verifier(function (u) { if (!u) c.hidden = true; });
      return c;
    }
  };
})();

/* Logique de l'exercice. Le fichier de contenu est reconstruit à partir du nom de ce script : racine.js → racine.json */
(function(){
  var LOCAL = typeof location !== 'undefined' && location.protocol === 'file:';
  var CACHE = 'donnees-v1:' + (typeof location !== 'undefined' ? decodeURIComponent(location.pathname.split('/').pop()) : 'test');
  function memoriser(obj) { if (LOCAL) { try { localStorage.setItem(CACHE, JSON.stringify(obj)); } catch(e) {} } }
  function lireDonnees(url, options) {
    if (LOCAL) { try { var c = localStorage.getItem(CACHE); if(c) return Promise.resolve({ok:true,json:function(){return Promise.resolve(JSON.parse(c));}}); } catch(e) {} }
    return fetch(url, options);
  }

  var SRC = document.currentScript.src;
  var RACINE = (function(n){var s=n.split('.');return s.length>2&&!/^(editeur|voc|menu|listeQuiz|html|js|json|css|\\d+)$/.test(s[1])?s[0]+'.'+s[1]:s[0];})(decodeURIComponent(SRC.split('?')[0].split('#')[0].split('/').pop()));
  var JSON_URL = new URL(RACINE + '.json', SRC).href;

  var $ = function(s,r){ return (r||document).querySelector(s); };
  function melanger(a){var b=a.slice();for(var i=b.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=b[i];b[i]=b[j];b[j]=t;}return b;}
  function esc(t){return String(t).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}

  var DATA = null, etat = null;

  /* ===== Chargement ===== */
  function appliquer(d){
    if (!d || !Array.isArray(d.sections) || !d.sections.length || d.sections.some(function(s){return !s.id || (s.type==='choix' ? !Array.isArray(s.questions) || s.questions.some(function(q){return !Array.isArray(q.o) || !Number.isInteger(q.r) || q.r<0 || q.r>=q.o.length;}) : !Array.isArray(s.lignes));})) throw new Error('Données invalides');
    memoriser(d);

    DATA = d;
    $('#chargement').hidden = !LOCAL; $('#chargement').classList.toggle('visible', LOCAL);
    document.title = d.titre || 'Révision';
    $('#titre').textContent = d.titre || '';
    $('#sous-titre').textContent = d.sousTitre || '';
    init();
  }
  function chargerAuto(){
    lireDonnees(JSON_URL).then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
      .then(appliquer)
      .catch(function(){ if(LOCAL){ $('#chargement').hidden=false; $('#chargement').classList.add('visible'); } else { var erreur=document.createElement('p'); erreur.textContent='Erreur : données non chargées.'; document.body.appendChild(erreur); } });
  }
  $('#chargement-fichier').addEventListener('change', function(e){
    var f = e.target.files[0]; if(!f) return;
    var fr = new FileReader();
    fr.onload = function(){ try{ appliquer(JSON.parse(fr.result)); }catch(err){ alert('Fichier JSON invalide.'); } };
    fr.readAsText(f);
  });
  $('#btn-recommencer').addEventListener('click', function(){ init(); window.scrollTo({top:0,behavior:'smooth'}); });

  /* ===== Initialisation ===== */
  function init(){
    etat = {};
    DATA.sections.forEach(function(s){
      etat[s.id] = { total: s.type==='choix' ? s.questions.length : s.lignes.length, repondu:0, score:0, fini:false };
    });
    rendre(); maj();
  }

  function rendre(){
    var c = $('#contenu'); c.innerHTML='';
    DATA.sections.forEach(function(s){
      var sec = document.createElement('section');
      sec.innerHTML = '<h2>'+esc(s.titre)+'</h2><p class="consigne">'+esc(s.consigne)+'</p>';
      if(s.type==='choix') rendreChoix(s,sec); else rendreAssoc(s,sec);
      var res = document.createElement('div');
      res.className='resultat-section'; res.id='res-'+s.id; sec.appendChild(res);
      c.appendChild(sec);
    });
    $('#final').classList.remove('visible');
  }

  function rendreChoix(s,sec){
    s.questions.forEach(function(q){
      var bloc = document.createElement('div'); bloc.className='question';
      var ordre = melanger(q.o.map(function(t,i){return {t:t,i:i};}));
      bloc.innerHTML = '<p>'+esc(q.q)+'</p><div class="options"></div><div class="explic">'+esc(q.e)+'</div>';
      var zone = $('.options',bloc);
      ordre.forEach(function(o){
        var b = document.createElement('button'); b.className='opt'; b.textContent=o.t;
        b.onclick=function(){
          var tous = Array.prototype.slice.call(zone.children);
          tous.forEach(function(x){x.disabled=true;});
          var juste = o.i===q.r;
          b.classList.add(juste?'ok':'ko');
          if(!juste){ tous.filter(function(x){return x.textContent===q.o[q.r];})[0].classList.add('ok'); }
          $('.explic',bloc).classList.add('visible');
          var st = etat[s.id]; st.repondu++; if(juste) st.score++;
          if(st.repondu===st.total) terminerSection(s);
          maj();
        };
        zone.appendChild(b);
      });
      sec.appendChild(bloc);
    });
  }

  function rendreAssoc(s,sec){
    var choix = melanger(s.lignes.map(function(l){return l.d;}));
    var conteneur = document.createElement('div');
    s.lignes.forEach(function(l){
      var div = document.createElement('div'); div.className='ligne';
      div.innerHTML = '<div class="gauche">'+esc(l.g)+'</div>'+
        '<select><option value="">— choisis —</option>'+choix.map(function(c){return '<option>'+esc(c)+'</option>';}).join('')+'</select>'+
        '<div class="correction">Réponse attendue : '+esc(l.d)+'</div>';
      conteneur.appendChild(div);
    });
    sec.appendChild(conteneur);
    var btn = document.createElement('button'); btn.className='btn'; btn.textContent='Vérifier';
    btn.onclick=function(){
      var selects = Array.prototype.slice.call(conteneur.querySelectorAll('select'));
      if(selects.some(function(x){return !x.value;})){ $('#res-'+s.id).textContent='Réponds à chaque ligne avant de vérifier.'; return; }
      var sc=0;
      selects.forEach(function(sel,i){
        var ligne = sel.parentElement; var ok = sel.value===s.lignes[i].d;
        ligne.classList.add(ok?'ok':'ko'); sel.disabled=true; if(ok) sc++;
      });
      btn.disabled=true;
      var st = etat[s.id]; st.repondu=st.total; st.score=sc;
      terminerSection(s); maj();
    };
    sec.appendChild(btn);
  }

  function terminerSection(s){
    var st = etat[s.id]; st.fini=true;
    $('#res-'+s.id).textContent='Section terminée : '+st.score+' / '+st.total;
    if(DATA.sections.every(function(x){return etat[x.id].fini;})) bilan();
  }

  /* ===== Score ===== */
  function maj(){
    var rep=0,tot=0,sc=0;
    DATA.sections.forEach(function(s){var e=etat[s.id];rep+=e.repondu;tot+=e.total;sc+=e.score;});
    $('#jauge').style.width=(tot?rep/tot*100:0)+'%';
    $('#progression').textContent=rep+' / '+tot+' réponses';
    $('#score-live').textContent='Score : '+sc;
  }

  function bilan(){
    var tot=0,sc=0,faibles=[];
    DATA.sections.forEach(function(s){var e=etat[s.id];tot+=e.total;sc+=e.score;
      if(e.score<e.total) faibles.push(s.titre+' ('+e.score+'/'+e.total+')');});
    $('#final-score').textContent=sc+' / '+tot;
    var p=sc/tot;
    $('#final-message').textContent = p===1 ? 'Parfait ! Tu maîtrises le sujet.'
      : p>=.75 ? 'Très bien ! Il ne reste que quelques détails à revoir.'
      : p>=.5 ? 'Bon début. Relis les explications des erreurs et réessaie.'
      : 'Courage ! Relis ton dossier puis recommence.';
    $('#final-detail').innerHTML = faibles.length
      ? '<li>À revoir :</li>'+faibles.map(function(f){return '<li>'+esc(f)+'</li>';}).join('')
      : '<li>Toutes les sections sont réussies.</li>';
    var f=$('#final'); if(!document.getElementById('papier-bloc')){var pb=Papier.bloc(); pb.id='papier-bloc'; f.insertBefore(pb, $('#btn-recommencer'));}
    f.classList.add('visible');
    f.scrollIntoView({behavior:'smooth',block:'center'});
  }

  Papier.barre(document.getElementById('contenu'));
  chargerAuto();
})();
