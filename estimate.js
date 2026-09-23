/* ============================================================
   KD CLEANING SERVICES — /estimate/
   IIFE única, sem dependência externa.

   Formulário único (form01), tudo à vista, sem etapas. O envio é
   idêntico ao das outras páginas: POST em JSON para o Web3Forms,
   que manda o lead por e-mail, e depois redireciona para /thanks/.

   ⚠️ A access key está duplicada em três arquivos: script.js (LP),
   home.js (home) e aqui. Trocar em um e esquecer os outros manda
   parte dos leads para outra caixa de entrada.
   ============================================================ */
(function () {
  'use strict';

  var CONFIG = {
    whatsappNumber: '19089777791',
    phoneDisplay:   '(908) 977-7791',
    endpoint:       'https://api.web3forms.com/submit',
    accessKey:      '93b640b5-7e6c-40f6-88d2-9d6d3dc08f81',
    thanksUrl:      '/thanks/',   // vazio = volta a mostrar o painel inline
    alsoOpenWhatsApp: false,
    // cópia do lead para o Make; mesma URL em script.js e home.js
    webhookUrl:     'https://hook.us2.make.com/g6asyii26xloxrptsvma8j6lrmflou59'
  };

  /* chave própria de rascunho. A LP usa "kd_form01" e as duas páginas
     moram no mesmo domínio: repetir a chave faria um formulário ler o
     rascunho do outro. */
  var DRAFT_KEY = 'kd_estimate01';

  /* ---------- ano do rodapé ---------- */
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

  /* ---------- menu mobile ---------- */
  /* replicado do home.js: esta página não carrega aquele arquivo, e sem
     isto o botão de hambúrguer não abre nada no celular */
  var burger = document.getElementById('burger');
  var nav = document.getElementById('nav');

  if (burger && nav) {
    var setMenu = function (open) {
      nav.classList.toggle('open', open);
      document.body.classList.toggle('nav-lock', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    };

    burger.addEventListener('click', function (e) {
      e.stopPropagation();
      setMenu(!nav.classList.contains('open'));
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });
    document.addEventListener('click', function (e) {
      if (!nav.classList.contains('open')) return;
      if (nav.contains(e.target) || burger.contains(e.target)) return;
      setMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setMenu(false);
    });
  }

  /* ============================================================
     FORMULÁRIO
     ============================================================ */
  var form = document.getElementById('form01');
  if (!form) return;

  var btnSend  = document.getElementById('form01-submit');
  var status   = document.getElementById('form01-status');
  var done     = document.getElementById('form01-done');
  var sendText = btnSend.textContent;
  var started  = false;

  function field(name) { return form.querySelector('[name="' + name + '"]'); }
  function checked(name) {
    var el = form.querySelector('[name="' + name + '"]:checked');
    return el ? el.value : '';
  }

  /* ---------- serviço comercial muda as perguntas do bloco 2 ---------- */
  var COMMERCIAL = ['Commercial Cleaning', 'Office Cleaning'];
  function isCommercial() { return COMMERCIAL.indexOf(checked('service')) !== -1; }

  function syncBranch() {
    var com = isCommercial();
    form.querySelector('[data-branch="residential"]').hidden = com;
    form.querySelector('[data-branch="commercial"]').hidden = !com;
  }

  /* Zera o que está escondido: sem isto, quem escolhe "Office" depois de
     ter clicado em 3 quartos manda um lead de escritório com quartos. */
  function clearHiddenBranch() {
    var hide = isCommercial()
      ? ['bedrooms', 'bathrooms', 'pets']
      : ['property', 'restrooms'];
    hide.forEach(function (n) {
      form.querySelectorAll('[name="' + n + '"]').forEach(function (el) { el.checked = false; });
    });
  }

  form.querySelectorAll('[name="service"]').forEach(function (el) {
    el.addEventListener('change', function () {
      setError('service', '');
      syncBranch();
      save();
    });
  });

  /* ---------- validação ---------- */
  function setError(name, msg) {
    var slot = form.querySelector('[data-er="' + name + '"]');
    var wrap = slot ? slot.closest('.fld') : null;
    if (slot) slot.textContent = msg || '';
    if (wrap) wrap.classList.toggle('bad', !!msg);
    return !msg;
  }

  function validPhone(v) { return v.replace(/\D/g, '').length >= 10; }

  /* Valida tudo de uma vez, que é o que faz sentido num formulário sem
     etapas, e devolve o primeiro campo com erro para levar o foco até ele. */
  function validate() {
    var first = null;
    function check(name, ok, msg) {
      setError(name, ok ? '' : msg);
      if (!ok && !first) first = name;
    }

    check('service', !!checked('service'), 'Pick the service you need.');
    check('name',    !!field('name').value.trim(), 'Please enter your name.');
    check('phone',   validPhone(field('phone').value), 'Enter a valid phone number.');
    check('zip',     /^\d{5}$/.test(field('zip').value.trim()), 'Enter your 5-digit ZIP code.');

    var mail = field('email').value.trim();
    check('email', !mail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail), 'Check the email address.');

    return first;
  }

  function focusError(name) {
    var el = form.querySelector('[name="' + name + '"]');
    if (!el) return;
    var anchor = el.closest('.fld') || el.closest('.est-block') || el;
    var top = anchor.getBoundingClientRect().top + window.scrollY - 110;
    window.scrollTo({ top: top, behavior: 'smooth' });
    if (el.type !== 'radio') el.focus({ preventScroll: true });
  }

  /* primeira interação = form_start */
  form.addEventListener('input', onFirst, true);
  form.addEventListener('change', onFirst, true);
  function onFirst() {
    if (started) return;
    started = true;
    track('form_start', { form: 'estimate' });
  }

  /* erro some assim que a pessoa corrige */
  form.addEventListener('input', function (e) {
    if (e.target.name) setError(e.target.name, '');
    save();
  });
  form.addEventListener('change', save);

  /* ---------- rascunho ---------- */
  function save() {
    try {
      var d = {};
      form.querySelectorAll('input,select,textarea').forEach(function (el) {
        if (!el.name || el.name === 'company') return;
        if (el.type === 'radio') { if (el.checked) d[el.name] = el.value; }
        else d[el.name] = el.value;
      });
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    } catch (err) { /* sessionStorage bloqueado: rascunho é conveniência, não requisito */ }
  }

  function restore() {
    try {
      var raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      var d = JSON.parse(raw);
      Object.keys(d).forEach(function (k) {
        form.querySelectorAll('[name="' + k + '"]').forEach(function (el) {
          if (el.type === 'radio') { if (el.value === d[k]) el.checked = true; }
          else el.value = d[k];
        });
      });
    } catch (err) { /* rascunho corrompido: começa do zero */ }
  }

  /* ---------- envio ---------- */
  function collect() {
    clearHiddenBranch();

    var d = {
      name:      field('name').value.trim(),
      phone:     field('phone').value.trim(),
      zip:       field('zip').value.trim(),
      service:   checked('service'),
      frequency: checked('frequency'),
      source:    'Estimate page',
      form:      form.dataset.form,
      page_url:  window.location.href
    };

    var mail = field('email').value.trim();
    if (mail) d.email = mail;

    /* só entra no e-mail o que foi respondido: campo vazio no corpo da
       mensagem faz a cliente procurar informação que não existe */
    [['bedrooms','bedrooms'], ['bathrooms','bathrooms'], ['pets','pets'],
     ['property','property_type'], ['restrooms','restrooms'],
     ['contact_method','preferred_contact'], ['best_time','best_time']
    ].forEach(function (p) {
      var v = checked(p[0]);
      if (v) d[p[1]] = v;
    });

    ['sqft', 'preferred_date', 'heard_about'].forEach(function (n) {
      var el = field(n);
      if (el && el.value.trim()) d[n] = el.value.trim();
    });

    var msg = field('message');
    if (msg && msg.value.trim()) d.message = msg.value.trim();

    if (!d.frequency) delete d.frequency;
    return d;
  }

  /* O Web3Forms manda por e-mail todo campo que receber. O assunto segue
     o mesmo padrão das outras páginas para o filtro do Gmail pegar tudo. */
  function payload(d) {
    return Object.assign({
      access_key: CONFIG.accessKey,
      from_name:  'KD Cleaning Services — Website',
      subject:    'New estimate request: ' + (d.service || 'Cleaning') +
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
    var l = ['New cleaning estimate request from the website', ''];
    l.push('Name: ' + d.name);
    l.push('Phone: ' + d.phone);
    l.push('Service: ' + d.service);
    if (d.frequency) l.push('Frequency: ' + d.frequency);
    if (d.zip) l.push('ZIP: ' + d.zip);
    if (d.email) l.push('Email: ' + d.email);
    if (d.message) l.push('Details: ' + d.message);
    return 'https://wa.me/' + CONFIG.whatsappNumber + '?text=' + encodeURIComponent(l.join('\n'));
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    status.textContent = '';

    // honeypot
    if (field('company').value !== '') return;

    var bad = validate();
    if (bad) {
      status.textContent = 'Please check the highlighted fields.';
      focusError(bad);
      return;
    }

    var data = collect();
    sendHook(data);
    btnSend.disabled = true;
    btnSend.textContent = 'Sending...';

    function finish() {
      track('generate_lead', { service: data.service, form: data.form });
      try { sessionStorage.removeItem(DRAFT_KEY); } catch (err) {}

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
      btnSend.disabled = false;
      btnSend.textContent = sendText;
      status.textContent = 'Something went wrong. Please call us at ' + CONFIG.phoneDisplay + '.';
    }

    fetch(CONFIG.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload(data))
    })
    .then(function (r) { return r.json(); })
    .then(function (j) {
      /* o Web3Forms responde 200 com {success:false} quando a access key
         está errada — checar só r.ok daria sucesso falso e o lead sumiria
         em silêncio */
      if (!j || !j.success) throw new Error(j && j.message ? j.message : 'web3forms');
      if (CONFIG.alsoOpenWhatsApp) window.open(waLink(data), '_blank');
      finish();
    })
    .catch(function () {
      var w = window.open(waLink(data), '_blank');   // plano B: nenhum lead se perde
      if (!w) { fail(); return; }
      finish();
    });
  });

  /* ---------- início ---------- */
  restore();
  syncBranch();

})();
