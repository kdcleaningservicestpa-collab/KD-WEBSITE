/* ============================================================
   KD CLEANING SERVICES — Site institucional

   Dois formulários na página (hero e contato). Ambos usam a classe
   .qform e são inicializados pelo mesmo initForm(), então não há
   ID duplicado e a lógica não é escrita duas vezes.

   O lead vai por POST (JSON) para o Web3Forms, que entrega no e-mail
   cadastrado na access key, e depois o visitante vai para /thanks/.

   ATENÇÃO — O DESTINO NÃO ESTÁ NESTE ARQUIVO. O Web3Forms amarra o
   e-mail à access key quando ela é criada e não aceita campo de
   destinatário na requisição. Para mudar o e-mail, gerar uma access
   key nova em web3forms.com. A key é a MESMA da LP: trocar em um
   arquivo e esquecer o outro faz metade dos leads mudar de caixa.

   Se o POST falhar, o lead cai no WhatsApp como plano B.
   ============================================================ */

var CONFIG = {
  whatsappNumber: '19089777791',
  phoneDisplay:   '(908) 977-7791',
  // e-mail público da cliente (Gmail). NÃO é o destino do formulário:
  // esse continua amarrado à access key do Web3Forms.
  email:          'kdcleaningservicestpa@gmail.com',
  endpoint:       'https://api.web3forms.com/submit',
  accessKey:      '93b640b5-7e6c-40f6-88d2-9d6d3dc08f81',
  thanksUrl:      '/thanks/',   // vazio = volta a mostrar o painel inline
  alsoOpenWhatsApp: false,
  // cópia do lead para o Make; mesma URL em script.js e estimate.js
  webhookUrl:     'https://hook.us2.make.com/uj8xu8klbwka1mdommvl8s1jxfouk9er'
};

(function () {
  'use strict';

  var yr = document.getElementById('yr');
  if (yr) yr.textContent = new Date().getFullYear();

  /* ---------- rastreamento ---------- */
  function track(name, params) {
    if (typeof gtag === 'function') gtag('event', name, params || {});
    if (typeof fbq === 'function') fbq('track', name === 'generate_lead' ? 'Lead' : 'Contact');
    if (window.dataLayer) window.dataLayer.push(Object.assign({ event: name }, params || {}));
  }

  document.querySelectorAll('[data-track="call"]').forEach(function (el) {
    el.addEventListener('click', function () {
      track('click_to_call', { phone: CONFIG.phoneDisplay });
    });
  });

  /* mailto: canal secundário. Evento próprio para não inflar o
     click_to_call, que é conversão primária no Google Ads. */
  document.querySelectorAll('[data-track="email"]').forEach(function (el) {
    el.addEventListener('click', function () {
      track('click_to_email', { email: CONFIG.email });
    });
  });

  /* ---------- menu mobile ---------- */
  var burger = document.getElementById('burger');
  var nav = document.getElementById('nav');

  if (burger && nav) {
    function setMenu(open) {
      nav.classList.toggle('open', open);
      document.body.classList.toggle('nav-lock', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }

    burger.addEventListener('click', function (e) {
      e.stopPropagation();
      setMenu(!nav.classList.contains('open'));
    });

    // fecha ao tocar em qualquer link
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });

    // fecha ao tocar fora da gaveta
    document.addEventListener('click', function (e) {
      if (!nav.classList.contains('open')) return;
      if (nav.contains(e.target) || burger.contains(e.target)) return;
      setMenu(false);
    });

    // fecha no Esc e devolve o foco ao botão
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('open')) {
        setMenu(false);
        burger.focus();
      }
    });

    // se voltar ao desktop com a gaveta aberta, destrava a rolagem
    window.addEventListener('resize', function () {
      if (window.innerWidth > 900 && nav.classList.contains('open')) setMenu(false);
    });
  }

  /* ============================================================
     SCROLL-SPY + BARRA DE PROGRESSO
     Numa one page de 10 blocos, sem isso o visitante perde a noção
     de onde está.
     ============================================================ */
  (function initScrollSpy () {
    var prog  = document.getElementById('hdrProg');
    var hdr   = document.querySelector('.hdr');
    var links = Array.prototype.slice.call(document.querySelectorAll('.nav a[href^="#"]:not(.nav-cta)'));
    var map   = [];

    links.forEach(function (a) {
      var sec = document.querySelector(a.getAttribute('href'));
      if (sec) map.push({ link: a, sec: sec });
    });

    function update() {
      if (prog) {
        var max = document.documentElement.scrollHeight - window.innerHeight;
        prog.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + '%';
      }

      /* O coração pendurado na base do header (.hdr::after) só existe com a
         página no topo, que é a costura header/hero — o mesmo lugar em que
         ele aparece na referência. Lá o header NÃO é fixo e sai de cena ao
         rolar; aqui ele é fixo, e sem isto o coração desce a página inteira
         passando por cima de texto (chegou a cair em cima do "WHY CHOOSE US").
         O CSS faz a saída em fade. */
      if (hdr) hdr.classList.toggle('is-stuck', window.scrollY > 10);

      if (!map.length) return;

      var line = window.scrollY + (window.innerHeight * 0.32);
      var active = null;
      map.forEach(function (m) {
        if (m.sec.offsetTop <= line) active = m;
      });
      map.forEach(function (m) { m.link.classList.toggle('on', m === active); });
    }

    var raf;
    window.addEventListener('scroll', function () {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    }, { passive: true });
    window.addEventListener('resize', update);
    update();
  })();

  /* ============================================================
     BARRA FIXA MOBILE — vai para o formulário MAIS PRÓXIMO
     Apontar sempre para #contact arremessava quem estava no topo
     para o fim da página, passando por cima do formulário do hero.
     ============================================================ */
  (function initMobileCta () {
    var cta = document.querySelector('.mb-cta');
    if (!cta) return;

    var targets = ['heroQuote', 'contact']
      .map(function (id) { return document.getElementById(id); })
      .filter(Boolean);
    if (targets.length < 2) return;

    cta.addEventListener('click', function (e) {
      e.preventDefault();

      // getBoundingClientRect().top já é a distância até o topo da
      // viewport, então o menor valor absoluto é o formulário mais perto
      var near = targets.reduce(function (best, el) {
        var d = Math.abs(el.getBoundingClientRect().top);
        return (best === null || d < best.d) ? { el: el, d: d } : best;
      }, null);

      var hdr = document.querySelector('.hdr');
      var offset = (hdr ? hdr.offsetHeight : 84) + 12;
      var top = near.el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: top, behavior: 'smooth' });

      // foca o primeiro campo depois da rolagem
      setTimeout(function () {
        var f = near.el.querySelector('.qform [name="name"]');
        if (f) f.focus({ preventScroll: true });
      }, 700);
    });
  })();

  /* ============================================================
     CARROSSEL DE SERVIÇOS
     Rolagem nativa com scroll-snap: funciona no toque sem JS,
     as setas e os pontos são só um atalho por cima disso.
     ============================================================ */
  (function initCarousel () {
    var root = document.getElementById('svcCar');
    if (!root) return;

    var track = root.querySelector('.car-track');
    var prev  = root.querySelector('.car-prev');
    var next  = root.querySelector('.car-next');
    var dots  = root.querySelector('.car-dots');

    // recalculado a cada uso: o filtro esconde cards e a contagem muda
    var cards = [];
    function readCards() {
      cards = Array.prototype.slice.call(track.children).filter(function (c) {
        return !c.hidden;
      });
    }
    readCards();
    if (!cards.length) return;

    function step() {
      var a = cards[0].getBoundingClientRect();
      var b = cards[1] ? cards[1].getBoundingClientRect() : null;
      return b ? (b.left - a.left) : a.width;
    }
    function perView() {
      return Math.max(1, Math.round(track.clientWidth / step()));
    }
    function pages() {
      return Math.max(1, Math.ceil(cards.length / perView()));
    }
    function current() {
      return Math.min(pages() - 1, Math.round(track.scrollLeft / (step() * perView())));
    }

    function buildDots() {
      dots.innerHTML = '';
      var total = pages();
      dots.hidden = total < 2;
      for (var i = 0; total > 1 && i < total; i++) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'car-dot';
        b.setAttribute('aria-label', 'Go to slide ' + (i + 1));
        b.dataset.i = i;
        dots.appendChild(b);
      }
      syncDots();
    }

    /* Só é carrossel se houver transbordo de verdade.
       Residencial e comercial têm 3 cards cada e o desktop mostra 3 por
       vez: sem esta checagem as setas ficavam na tela, habilitadas, sem
       nada para rolar. Medir scrollWidth x clientWidth é mais confiável
       que contar cards — o número de colunas muda por breakpoint e o
       filtro muda a contagem. */
    function syncMode() {
      var rolavel = track.scrollWidth - track.clientWidth > 2;
      root.classList.toggle('is-static', !rolavel);

      if (rolavel) {
        track.setAttribute('tabindex', '0');
        buildDots();
        return;
      }
      // sem rolagem não é região rolável: sai da ordem de tabulação
      track.removeAttribute('tabindex');
      track.scrollLeft = 0;
      dots.hidden = true;
      dots.innerHTML = '';
      // as setas estão escondidas pelo CSS, mas o disabled tem que
      // acompanhar mesmo assim: o DOM não deve descrever um estado falso
      syncDots();
    }

    function syncDots() {
      var c = current();
      dots.querySelectorAll('.car-dot').forEach(function (d, i) {
        d.classList.toggle('on', i === c);
      });
      var max = track.scrollWidth - track.clientWidth - 2;
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft >= max;
    }

    function go(dir) {
      track.scrollBy({ left: dir * step() * perView(), behavior: 'smooth' });
    }

    prev.addEventListener('click', function () { go(-1); });
    next.addEventListener('click', function () { go(1); });

    dots.addEventListener('click', function (e) {
      var d = e.target.closest('.car-dot');
      if (!d) return;
      track.scrollTo({ left: Number(d.dataset.i) * step() * perView(), behavior: 'smooth' });
    });

    // teclado: setas navegam quando a trilha tem foco
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); go(-1); }
    });

    var raf;
    track.addEventListener('scroll', function () {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(syncDots);
    });
    // no resize a contagem de colunas muda, então o modo pode virar nos
    // dois sentidos: 3 colunas sem rolagem viram 2 colunas com rolagem
    var rafResize;
    window.addEventListener('resize', function () {
      cancelAnimationFrame(rafResize);
      rafResize = requestAnimationFrame(syncMode);
    });

    syncMode();

    /* ---------- filtro residencial / comercial ---------- */
    var filter = document.querySelector('.svc-filter');
    if (filter) {
      filter.addEventListener('click', function (e) {
        var btn = e.target.closest('.sf-btn');
        if (!btn) return;

        var cat = btn.dataset.cat;
        filter.querySelectorAll('.sf-btn').forEach(function (b) {
          var on = b === btn;
          b.classList.toggle('is-on', on);
          b.setAttribute('aria-selected', on ? 'true' : 'false');
        });

        Array.prototype.slice.call(track.children).forEach(function (card) {
          card.hidden = (card.dataset.cat || '').indexOf(cat) === -1;
        });

        // volta ao início e reavalia: trocar de aba muda a contagem e
        // pode ligar ou desligar o carrossel
        track.scrollTo({ left: 0, behavior: 'auto' });
        readCards();
        syncMode();
      });

      // estado inicial: residencial, a persona principal do mapeamento
      var first = filter.querySelector('.sf-btn.is-on');
      if (first) {
        Array.prototype.slice.call(track.children).forEach(function (card) {
          card.hidden = (card.dataset.cat || '').indexOf(first.dataset.cat) === -1;
        });
        readCards();
        syncMode();
      }
    }
  })();

  /* ============================================================
     FORMULÁRIOS
     ============================================================ */
  var RULES = {
    name:    { msg: 'Please enter your name.',                     ok: function (v) { return v.trim().length >= 2; } },
    phone:   { msg: 'Please enter a valid 10 digit phone number.', ok: function (v) { return v.replace(/\D/g, '').length === 10; } },
    zip:     { msg: 'Please enter your 5 digit ZIP code.',         ok: function (v) { return /^\d{5}$/.test(v); } },
    service: { msg: 'Please select a service.',                    ok: function (v) { return v !== ''; } }
  };

  function initForm(form) {
    var wrap   = form.parentElement;
    var submit = form.querySelector('.qform-submit');
    var status = form.querySelector('.qform-status');
    var done   = wrap.querySelector('.qform-done');
    var label  = submit.textContent;

    // só valida os campos que existem neste formulário
    var fields = Object.keys(RULES).filter(function (n) {
      return form.querySelector('[name="' + n + '"]');
    });

    function field(n) { return form.querySelector('[name="' + n + '"]'); }

    function setErr(n, msg) {
      var el = field(n);
      var box = el.closest('.fld');
      var slot = form.querySelector('[data-er="' + n + '"]');
      if (box) box.classList.toggle('bad', !!msg);
      if (slot) slot.textContent = msg || '';
    }

    function validate() {
      var bad = null;
      fields.forEach(function (n) {
        var el = field(n);
        var good = RULES[n].ok(el.value);
        setErr(n, good ? '' : RULES[n].msg);
        if (!good && !bad) bad = el;
      });
      if (bad) {
        bad.focus();
        bad.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return false;
      }
      return true;
    }

    /* máscara de telefone US */
    var phone = field('phone');
    if (phone) {
      phone.addEventListener('input', function () {
        var d = this.value.replace(/\D/g, '').slice(0, 10);
        if (d.length > 6)      this.value = '(' + d.slice(0,3) + ') ' + d.slice(3,6) + '-' + d.slice(6);
        else if (d.length > 3) this.value = '(' + d.slice(0,3) + ') ' + d.slice(3);
        else if (d.length > 0) this.value = '(' + d;
        else                   this.value = '';
      });
    }

    var zip = field('zip');
    if (zip) {
      zip.addEventListener('input', function () {
        this.value = this.value.replace(/\D/g, '').slice(0, 5);
      });
    }

    /* limpa o erro assim que a pessoa corrige */
    form.addEventListener('input', function (e) {
      var n = e.target.name;
      if (RULES[n] && e.target.closest('.fld').classList.contains('bad') && RULES[n].ok(e.target.value)) {
        setErr(n, '');
      }
    });
    form.addEventListener('change', function (e) {
      if (e.target.name === 'service' && e.target.value) setErr('service', '');
    });

    /* valida ao sair do campo, nunca enquanto digita */
    fields.forEach(function (n) {
      field(n).addEventListener('blur', function () {
        if (this.value === '') return;
        setErr(n, RULES[n].ok(this.value) ? '' : RULES[n].msg);
      });
    });

    /* primeiro toque, para medir taxa de conclusão */
    var started = false;
    form.addEventListener('focusin', function () {
      if (started) return;
      started = true;
      track('form_start', { form: form.dataset.form });
    });

    function collect() {
      var d = {
        name:     field('name').value.trim(),
        phone:    field('phone').value.trim(),
        service:  field('service').value,
        source:   'Institutional site',
        form:     form.dataset.form,
        page_url: window.location.href
      };
      if (zip) d.zip = zip.value.trim();
      var msg = form.querySelector('[name="message"]');
      if (msg) d.message = msg.value.trim();
      return d;
    }

    /* Envelope do Web3Forms: ele manda por e-mail todo campo recebido.
       O "form" (hero ou contact) vai junto para a cliente saber de
       qual bloco da página o lead veio. */
    function payload(d) {
      return Object.assign({
        access_key: CONFIG.accessKey,
        from_name:  'KD Cleaning Services — Website',
        subject:    'New quote request: ' + (d.service || 'Cleaning') +
                    (d.zip ? ' — ZIP ' + d.zip : '')
      }, d);
    }

    /* Cópia do lead para o webhook do Make, em paralelo ao Web3Forms.
       Não decide nada: se o Make cair, o e-mail continua chegando.
       sendBeacon + form-urlencoded de propósito — é requisição "simples",
       sem preflight de CORS, e o navegador entrega mesmo depois do
       redirect para /thanks/, que um fetch comum cancelaria. */
    function sendHook(d) {
      if (!CONFIG.webhookUrl) return;
      var body = new URLSearchParams();
      Object.keys(d).forEach(function (k) { body.append(k, d[k]); });
      try {
        if (navigator.sendBeacon && navigator.sendBeacon(CONFIG.webhookUrl, body)) return;
      } catch (err) {}
      try {
        fetch(CONFIG.webhookUrl, { method: 'POST', mode: 'no-cors', keepalive: true, body: body });
      } catch (err) {}
    }

    function waLink(d) {
      var l = [
        'New cleaning quote request from the website',
        '',
        'Name: ' + d.name,
        'Phone: ' + d.phone,
        'Service: ' + d.service
      ];
      if (d.zip) l.push('ZIP: ' + d.zip);
      if (d.message) l.push('Details: ' + d.message);
      return 'https://wa.me/' + CONFIG.whatsappNumber + '?text=' + encodeURIComponent(l.join('\n'));
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      status.textContent = '';

      // honeypot
      if (form.querySelector('[name="company"]').value !== '') return;
      if (!validate()) return;

      var data = collect();
      sendHook(data);
      submit.disabled = true;
      submit.textContent = 'Sending...';

      function finish() {
        track('generate_lead', { service: data.service, form: data.form });

        if (CONFIG.thanksUrl) {
          /* o track() acima dispara pixels de conversão; alguns usam
             imagem, que a navegação cancelaria. O respiro curto deixa
             eles saírem antes de trocar de página. */
          var slug = /deep/i.test(data.service) ? 'deep'
                   : /regular/i.test(data.service) ? 'regular' : '';
          var url = CONFIG.thanksUrl + (slug ? '?s=' + slug : '');
          setTimeout(function () { window.location.href = url; }, 120);
          return;
        }

        form.hidden = true;
        done.hidden = false;
        done.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      function fail() {
        submit.disabled = false;
        submit.textContent = label;
        status.textContent = 'Something went wrong. Please call us at ' + CONFIG.phoneDisplay + '.';
      }

      if (CONFIG.endpoint) {
        fetch(CONFIG.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(payload(data))
        })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          /* o Web3Forms responde 200 com {success:false} quando a access
             key está errada — checar só r.ok daria sucesso falso e o
             lead sumiria em silêncio */
          if (!j || !j.success) throw new Error(j && j.message ? j.message : 'web3forms');
          if (CONFIG.alsoOpenWhatsApp) window.open(waLink(data), '_blank');
          finish();
        })
        .catch(function () {
          var w = window.open(waLink(data), '_blank');  // plano B
          if (!w) { fail(); return; }
          finish();
        });
      } else {
        var w = window.open(waLink(data), '_blank');
        if (!w) { window.location.href = waLink(data); return; }
        finish();
      }
    });
  }

  document.querySelectorAll('.qform').forEach(initForm);

  /* ---------- entrada escalonada das pílulas de bairro ---------- */
  (function initAreaList () {
    var list = document.getElementById('areaList');
    if (!list) return;

    // sem IntersectionObserver ou com movimento reduzido, mostra direto
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in window)) {
      list.classList.add('in');
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        list.classList.add('in');
        io.disconnect();
      });
    }, { threshold: 0.25 });

    io.observe(list);
  })();

  /* ---------- mapa da área de atendimento ---------- */
  /* Leaflet + tiles escuros da CARTO (sem chave de API). Os pontos são o
     centro aproximado de cada comunidade do briefing e o contorno é
     ilustrativo — não é limite municipal nem cobertura por CEP. */
  (function () {
    var box = document.getElementById('ct-map-canvas');
    if (!box) return;

    /* Pinos-âncora, não a lista inteira. A cobertura são 21 cidades, mas
       21 rótulos viram mancha ilegível no celular. Estes 10 espalham por
       todo o território e cada um puxa uma região: quem mora em Largo se
       reconhece no pino de Clearwater. Quem quer a lista completa tem a
       faixa de Service Areas no rodapé. */
    var AREAS = [
      { name: 'Tampa',          lat: 27.9506, lng: -82.4572, base: true },
      { name: 'St. Petersburg', lat: 27.7676, lng: -82.6403 },
      { name: 'Clearwater',     lat: 27.9659, lng: -82.8001 },
      { name: 'Palm Harbor',    lat: 28.0781, lng: -82.7637 },
      { name: 'Wesley Chapel',  lat: 28.2397, lng: -82.3277 },
      { name: 'Lutz',           lat: 28.1511, lng: -82.4615 },
      { name: 'Westchase',      lat: 28.0570, lng: -82.6115 },
      { name: 'Brandon',        lat: 27.9378, lng: -82.2859 },
      { name: 'Riverview',      lat: 27.8661, lng: -82.3265 },
      { name: 'Plant City',     lat: 28.0186, lng: -82.1126 }
    ];
    /* Contorno ilustrativo da cobertura, esticado para a baía inteira:
       Pasco ao norte, Plant City a leste, Ruskin ao sul e a península de
       Pinellas a oeste. Não é limite municipal nem cobertura por CEP. */
    var COVER = [
      [28.32, -82.78], [28.34, -82.28], [28.06, -82.03],
      [27.68, -82.24], [27.66, -82.58], [27.72, -82.78], [28.12, -82.86]
    ];

    /* CDN bloqueado: volta para o embed simples do Google em vez de caixa vazia */
    if (!window.L) {
      var fb = document.createElement('iframe');
      fb.src = 'https://maps.google.com/maps?q=Tampa,%20Florida&z=10&output=embed';
      fb.title = 'KD Cleaning Services area map, Tampa, Florida';
      fb.loading = 'lazy';
      fb.referrerPolicy = 'no-referrer-when-downgrade';
      box.appendChild(fb);
      return;
    }

    var touch = L.Browser.mobile;
    var map = L.map(box, {
      zoomControl: false,
      scrollWheelZoom: false,   /* não sequestra a rolagem da página */
      dragging: !touch,         /* no celular, arrastar o mapa travaria o scroll */
      touchZoom: !touch,
      tap: false
    });
    if (!touch) L.control.zoom({ position: 'topright' }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);

    L.polygon(COVER, {
      color: '#6EC1E4', weight: 1.5, opacity: .75, dashArray: '6 5',
      fillColor: '#6EC1E4', fillOpacity: .1, interactive: false
    }).addTo(map);

    var pts = [];
    AREAS.forEach(function (a) {
      pts.push([a.lat, a.lng]);
      L.marker([a.lat, a.lng], {
        keyboard: false,
        interactive: false,
        icon: L.divIcon({
          className: 'mk' + (a.base ? ' is-base' : ''),
          iconSize: [11, 11], iconAnchor: [5, 5],
          html: '<span class="mk-dot"></span><span class="mk-lbl">' + a.name + '</span>'
        })
      }).addTo(map);
    });

    map.fitBounds(L.latLngBounds(pts), { padding: [42, 42], maxZoom: 11 });

    /* a coluna só ganha altura depois que o grid resolve o layout */
    setTimeout(function () { map.invalidateSize(); }, 250);
    window.addEventListener('resize', function () { map.invalidateSize(); });
  })();

  /* ---------- links dos cards pré-selecionam o serviço ---------- */
  var contactService = document.querySelector('[data-form="contact"] [name="service"]');
  document.querySelectorAll('[data-service]').forEach(function (link) {
    link.addEventListener('click', function () {
      if (!contactService) return;
      var want = this.getAttribute('data-service');
      for (var i = 0; i < contactService.options.length; i++) {
        if (contactService.options[i].value === want) { contactService.selectedIndex = i; break; }
      }
      setTimeout(function () {
        var n = document.querySelector('[data-form="contact"] [name="name"]');
        if (n) n.focus({ preventScroll: true });
      }, 600);
    });
  });

})();
