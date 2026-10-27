// Effets communs aux pages Garden Garden (accueil, restaurant, hôtel).
// Chaque bloc vérifie que l'élément existe : une page sans visite virtuelle ou sans galerie ne plante pas.
function gscroll(id){ var el = document.getElementById(id); if(el) el.scrollIntoView({behavior:'smooth'}); }

(function(){
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Préchargeur : on le retire une fois la page prête (avec un plafond de sécurité)
  window.addEventListener('load', function(){
    setTimeout(function(){ document.body.classList.add('loaded'); }, 600);
  });
  setTimeout(function(){ document.body.classList.add('loaded'); }, 2600);

  // Reveal au scroll
  var obs=new IntersectionObserver(function(entries){
    entries.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); obs.unobserve(e.target);} });
  },{threshold:0.14});
  document.querySelectorAll('.reveal').forEach(function(el){obs.observe(el)});

  // Compteurs animés
  var counted = false;
  var statsband = document.querySelector('.statsband');
  var countObs = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(e.isIntersecting && !counted){
        counted = true;
        document.querySelectorAll('.n[data-count]').forEach(function(el){
          var target = parseFloat(el.getAttribute('data-count'));
          var isDecimal = target % 1 !== 0;
          var duration = 1400;
          var start = null;
          function step(ts){
            if(!start) start = ts;
            var progress = Math.min((ts - start) / duration, 1);
            var current = target * progress;
            el.textContent = isDecimal ? current.toFixed(1) : Math.floor(current);
            if(progress < 1) requestAnimationFrame(step);
            else el.textContent = isDecimal ? target.toFixed(1) : target;
          }
          requestAnimationFrame(step);
        });
      }
    });
  },{threshold:0.4});
  if(statsband) countObs.observe(statsband);

  // Défilement : ombre de nav, barre de progression, parallaxe du hero
  var nav = document.getElementById('mainNav');
  var prog = document.getElementById('progress');
  var heroBg = document.getElementById('heroBg');
  var heroContent = document.getElementById('heroContent');
  window.addEventListener('scroll', function(){
    var y = window.scrollY;
    if(nav) nav.classList.toggle('scrolled', y > 40);
    var h = document.documentElement.scrollHeight - window.innerHeight;
    if(prog) prog.style.width = (h > 0 ? (y / h * 100) : 0) + '%';
    if(!reduceMotion && heroBg && heroContent && y < window.innerHeight){
      heroBg.style.transform = 'translateY(' + (y * 0.18) + 'px)';
      heroContent.style.transform = 'translateY(' + (y * 0.3) + 'px)';
      heroContent.style.opacity = Math.max(0, 1 - y / (window.innerHeight * 0.85));
    }
  });

  // Accueil qui défile : les photos du hero se succèdent en fondu (une toutes les 5 secondes)
  var slides = document.querySelectorAll('#heroBg .hero-slide');
  if(slides.length > 1){
    var sIdx = 0;
    var sDots = document.querySelectorAll('.hero-dots button');
    var showSlide = function(i){
      slides[sIdx].classList.remove('on');
      if(sDots[sIdx]) sDots[sIdx].classList.remove('active');
      sIdx = (i + slides.length) % slides.length;
      var img = slides[sIdx].querySelector('img');
      if(img && img.getAttribute('data-src')){ img.src = img.getAttribute('data-src'); img.removeAttribute('data-src'); }
      slides[sIdx].classList.add('on');
      if(sDots[sIdx]) sDots[sIdx].classList.add('active');
      var lbl = document.getElementById('heroSlideLabel');
      if(lbl) lbl.textContent = slides[sIdx].getAttribute('data-label') || '';
    };
    // Précharge la photo suivante pour éviter un écran vide au premier fondu
    var preload = function(){
      Array.prototype.forEach.call(slides, function(s){
        var img = s.querySelector('img[data-src]');
        if(img){ img.src = img.getAttribute('data-src'); img.removeAttribute('data-src'); }
      });
    };
    window.addEventListener('load', function(){ setTimeout(preload, 800); });
    var timer = null;
    var start = function(){ if(!reduceMotion){ clearInterval(timer); timer = setInterval(function(){ showSlide(sIdx + 1); }, 5000); } };
    Array.prototype.forEach.call(sDots, function(d, di){
      d.addEventListener('click', function(){ showSlide(di); start(); });
    });
    start();
  }

  // Lucioles dorées dans le hero (canvas, léger)
  if(!reduceMotion){
    var cv = document.getElementById('fireflies');
    if(cv && cv.getContext){
      var ctx = cv.getContext('2d');
      function size(){ cv.width = cv.offsetWidth; cv.height = cv.offsetHeight; }
      size(); window.addEventListener('resize', size);
      var N = window.innerWidth < 820 ? 12 : 24, pts = [];
      for(var i = 0; i < N; i++){
        pts.push({ x:Math.random(), y:Math.random(), r:1 + Math.random()*2.2,
                   vx:(Math.random()-.5)*.0005, vy:(Math.random()-.5)*.0004, p:Math.random()*6.28 });
      }
      (function loop(t){
        ctx.clearRect(0, 0, cv.width, cv.height);
        for(var i = 0; i < pts.length; i++){
          var p = pts[i];
          p.x += p.vx; p.y += p.vy;
          if(p.x < 0) p.x = 1; if(p.x > 1) p.x = 0;
          if(p.y < 0) p.y = 1; if(p.y > 1) p.y = 0;
          var a = .2 + .5 * (.5 + .5 * Math.sin(t * .0012 + p.p));
          ctx.beginPath();
          ctx.arc(p.x * cv.width, p.y * cv.height, p.r, 0, 6.28);
          ctx.fillStyle = 'rgba(216,180,122,' + a + ')';
          ctx.shadowColor = 'rgba(216,180,122,.8)';
          ctx.shadowBlur = 8;
          ctx.fill();
        }
        requestAnimationFrame(loop);
      })(0);
    }
  }

  // Inclinaison 3D des images au survol (souris uniquement)
  if(window.matchMedia('(hover:hover)').matches && !reduceMotion){
    document.querySelectorAll('.tilt').forEach(function(el){
      el.addEventListener('mousemove', function(ev){
        var r = el.getBoundingClientRect();
        var px = (ev.clientX - r.left) / r.width - .5;
        var py = (ev.clientY - r.top) / r.height - .5;
        el.style.transform = 'perspective(900px) rotateX(' + (py * -6) + 'deg) rotateY(' + (px * 8) + 'deg) scale(1.02)';
      });
      el.addEventListener('mouseleave', function(){ el.style.transform = ''; });
    });
  }

  // Barre sticky après le hero
  var hero = document.querySelector('.hero');
  var sticky = document.getElementById('gsticky');
  if(hero && sticky){
    var stickyObs = new IntersectionObserver(function(entries){
      entries.forEach(function(e){ sticky.classList.toggle('show', !e.isIntersecting); });
    },{threshold:0});
    stickyObs.observe(hero);
  }

  // Visite virtuelle : changement de pièce avec transition 3D
  var stage = document.getElementById('visiteStage');
  if(stage){
    var vImg = document.getElementById('visiteImg');
    var vTitle = document.getElementById('visiteTitle');
    var vDesc = document.getElementById('visiteDesc');
    document.querySelectorAll('.vroom').forEach(function(btn){
      btn.addEventListener('click', function(){
        if(btn.classList.contains('active')) return;
        document.querySelectorAll('.vroom').forEach(function(b){ b.classList.remove('active'); });
        btn.classList.add('active');
        stage.classList.add('switching');
        setTimeout(function(){
          vImg.src = btn.getAttribute('data-img');
          vImg.alt = 'Visite virtuelle — ' + btn.getAttribute('data-title');
          vTitle.textContent = btn.getAttribute('data-title');
          vDesc.textContent = btn.getAttribute('data-desc');
          stage.classList.remove('switching');
        }, reduceMotion ? 0 : 260);
      });
    });
  }

  // Assiettes : retournement au clic/tactile en plus du survol souris
  document.querySelectorAll('.flip').forEach(function(el){
    el.addEventListener('click', function(){ el.classList.toggle('flipped'); });
    el.addEventListener('keydown', function(ev){
      if(ev.key === 'Enter' || ev.key === ' '){ ev.preventDefault(); el.classList.toggle('flipped'); }
    });
  });

  // Galeries photo avec flèches et points (chambre, jardin) : les photos sont dans data-slides
  // sous la forme « image|légende ; image|légende ».
  document.querySelectorAll('[data-slides]').forEach(function(box){
    var img = box.querySelector('img');
    var caption = box.querySelector('.hphoto-caption');
    var dotsWrap = box.querySelector('.hphoto-dots');
    var list = box.getAttribute('data-slides').split(';').map(function(s){
      var p = s.trim().split('|'); return { src:p[0].trim(), label:(p[1] || '').trim() };
    });
    var prefix = box.getAttribute('data-alt') || '';
    var idx = 0;
    dotsWrap.innerHTML = '';
    var dots = list.map(function(s, i){
      var d = document.createElement('button');
      d.type = 'button'; d.className = 'hdot' + (i === 0 ? ' active' : '');
      d.setAttribute('aria-label', 'Photo ' + (i + 1));
      d.addEventListener('click', function(ev){ ev.stopPropagation(); show(i); });
      dotsWrap.appendChild(d);
      return d;
    });
    function show(i){
      idx = (i + list.length) % list.length;
      box.classList.add('switching');
      setTimeout(function(){
        img.src = list[idx].src;
        img.alt = prefix + list[idx].label;
        if(caption) caption.textContent = list[idx].label;
        dots.forEach(function(d, di){ d.classList.toggle('active', di === idx); });
        box.classList.remove('switching');
      }, reduceMotion ? 0 : 220);
    }
    box.querySelector('.hphoto-prev').addEventListener('click', function(ev){ ev.stopPropagation(); show(idx - 1); });
    box.querySelector('.hphoto-next').addEventListener('click', function(ev){ ev.stopPropagation(); show(idx + 1); });
  });
})();
