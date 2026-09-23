/* ============================================================
   KD CLEANING SERVICES — form01
   ============================================================

   COMO O FORMULÁRIO FUNCIONA HOJE
   -------------------------------
   O lead vai por POST (JSON) para o Web3Forms, que entrega no
   e-mail cadastrado na access key. Depois o visitante é levado
   para a página /thanks/.

   ATENÇÃO — O DESTINO NÃO ESTÁ NESTE ARQUIVO. O Web3Forms amarra
   o e-mail à access key no momento em que ela é criada e não
   aceita campo de destinatário na requisição (é proteção contra
   abuso). Trocar o e-mail de destino = gerar uma access key nova
   em web3forms.com e substituir accessKey abaixo. Mexer aqui não
   muda para onde o lead vai.

   A access key fica exposta no JS, como em qualquer solução sem
   backend. Ela só permite enviar para o e-mail dela mesma, então
   o risco é spam no formulário, não vazamento. Se começar a
   chegar lixo, ligar o hCaptcha no painel do Web3Forms.

   SE O POST FALHAR
   ----------------
   O lead não se perde: cai no WhatsApp, que era o canal anterior.
   Essa é a única razão de whatsappLink() continuar aqui.
   ============================================================ */

var CONFIG = {
  whatsappNumber: '19089777791',   // formato internacional, só dígitos
  phoneDisplay:   '(908) 977-7791',
  endpoint:       'https://api.web3forms.com/submit',
  accessKey:      '93b640b5-7e6c-40f6-88d2-9d6d3dc08f81',
  thanksUrl:      '/thanks/',      // vazio = volta a mostrar o painel inline
  alsoOpenWhatsApp: false,         // o redirect substituiu; WhatsApp só em falha
  // cópia do lead para o Make; mesma URL em home.js e estimate.js
  webhookUrl:     'https://hook.us2.make.com/g6asyii26xloxrptsvma8j6lrmflou59'
};

(function () {
  'use strict';

  var form     = document.getElementById('form01');
  var submit   = document.getElementById('form01-submit');
  var status   = document.getElementById('form01-status');
  var success  = document.getElementById('form01-success');
  var nextBtn  = document.getElementById('form01-next');
  var backBtn  = document.getElementById('form01-back');
  var progress = document.getElementById('form01-progress');
  var stepLbl  = document.getElementById('form01-steplabel');
  var stepsBar = document.querySelector('.steps-bar');

  if (!form) return;

  /* ---------- controle dos 2 passos ---------- */
  var LABELS = {
    1: 'Step 1 of 2 · About your home',
    2: 'Step 2 of 2 · Where to send your quote'
  };
  var currentStep = 1;

  function goToStep(n) {
    currentStep = n;

    form.querySelectorAll('.form-step').forEach(function (panel) {
      panel.classList.toggle('is-active', panel.dataset.step === String(n));
    });
    stepsBar.querySelectorAll('.step-dot').forEach(function (dot) {
      dot.classList.toggle('is-active', Number(dot.dataset.step) <= n);
    });

    progress.style.width = n === 2 ? '100%' : '0%';
    stepLbl.textContent = LABELS[n];
    status.textContent = '';

    // foco no primeiro campo do passo, sem puxar a rolagem
    var first = form.querySelector('.form-step.is-active input, .form-step.is-active select');
    if (first) first.focus({ preventScroll: true });
  }

  /* ---------- ano do rodapé ---------- */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ============================================================
     PERSISTÊNCIA DO FORMULÁRIO
     Formulário de múltiplos passos não pode perder dado se a pessoa
     recarregar, girar a tela ou sair para checar o CEP e voltar.
     Guarda em sessionStorage (morre quando fecha a aba) e limpa no envio.
     ============================================================ */
  var STORE_KEY = 'kd_form01';
  var SAVE_FIELDS = ['f-name', 'f-phone', 'f-email', 'f-zip', 'f-beds', 'f-baths', 'f-notes'];

  function saveDraft() {
    try {
      var d = {};
      SAVE_FIELDS.forEach(function (id) { d[id] = document.getElementById(id).value; });
      var svc = form.querySelector('input[name="service"]:checked');
      d.service = svc ? svc.value : '';
      sessionStorage.setItem(STORE_KEY, JSON.stringify(d));
    } catch (e) { /* modo privado bloqueia storage: segue sem salvar */ }
  }

  function restoreDraft() {
    try {
      var raw = sessionStorage.getItem(STORE_KEY);
      if (!raw) return;
      var d = JSON.parse(raw);
      SAVE_FIELDS.forEach(function (id) {
        if (d[id]) document.getElementById(id).value = d[id];
      });
      if (d.service) {
        var radio = form.querySelector('input[name="service"][value="' + d.service + '"]');
        if (radio) radio.checked = true;
      }
    } catch (e) { /* ignora rascunho corrompido */ }
  }

  function clearDraft() {
    try { sessionStorage.removeItem(STORE_KEY); } catch (e) {}
  }

  form.addEventListener('input', saveDraft);
  form.addEventListener('change', saveDraft);
  restoreDraft();

  /* ---------- primeiro toque no formulário ----------
     Sem este evento não dá para calcular taxa de conclusão:
     só se sabe quem enviou, não quem começou e desistiu. */
  var started = false;
  form.addEventListener('focusin', function () {
    if (started) return;
    started = true;
    track('form_start', { form: 'form01' });
  });

  /* ---------- máscara de telefone US ---------- */
  var phone = document.getElementById('f-phone');
  phone.addEventListener('input', function () {
    var d = this.value.replace(/\D/g, '').slice(0, 10);
    if (d.length > 6)      this.value = '(' + d.slice(0,3) + ') ' + d.slice(3,6) + '-' + d.slice(6);
    else if (d.length > 3) this.value = '(' + d.slice(0,3) + ') ' + d.slice(3);
    else if (d.length > 0) this.value = '(' + d + ')';
    else                   this.value = '';
  });

  /* ---------- ZIP só números ---------- */
  var zip = document.getElementById('f-zip');
  zip.addEventListener('input', function () {
    this.value = this.value.replace(/\D/g, '').slice(0, 5);
  });

  /* ---------- CTAs dos cards pré-selecionam o serviço ---------- */
  document.querySelectorAll('[data-preselect]').forEach(function (link) {
    link.addEventListener('click', function () {
      var want = this.getAttribute('data-preselect');
      var radio = form.querySelector('input[name="service"][value="' + want + '"]');
      if (radio) radio.checked = true;
      // volta pro passo 1 já com o serviço marcado, foco em Bedrooms
      if (currentStep !== 1) goToStep(1);
      setTimeout(function () { document.getElementById('f-beds').focus({ preventScroll: true }); }, 600);
    });
  });

  /* ---------- validação ---------- */
  var RULES = {
    'f-name':  { msg: 'Please tell us your first name.',           test: function (v) { return v.trim().length >= 2; } },
    'f-phone': { msg: 'Please enter a valid 10 digit phone number.', test: function (v) { return v.replace(/\D/g, '').length === 10; } },
    'f-zip':   { msg: 'Please enter your 5 digit ZIP code.',       test: function (v) { return /^\d{5}$/.test(v); } },
    // opcional: vazio passa, preenchido tem que ter cara de e-mail
    'f-email': { msg: 'Please check your email address.',          test: function (v) { v = v.trim(); return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); } },
    'f-beds':  { msg: 'Please select the number of bedrooms.',     test: function (v) { return v !== ''; } },
    'f-baths': { msg: 'Please select the number of bathrooms.',    test: function (v) { return v !== ''; } }
  };

  function setError(id, message) {
    var el = document.getElementById(id) || form.querySelector('[name="' + id + '"]');
    var wrapper = el ? el.closest('.field') : null;
    var slot = form.querySelector('[data-err-for="' + id + '"]');
    if (wrapper) wrapper.classList.toggle('invalid', !!message);
    if (slot) slot.textContent = message || '';
  }

  // quais campos pertencem a cada passo
  var STEP_FIELDS = {
    1: ['service', 'f-beds', 'f-baths', 'f-zip'],
    2: ['f-name', 'f-phone', 'f-email']
  };

  function validateStep(n) {
    var firstBad = null;

    STEP_FIELDS[n].forEach(function (id) {
      if (id === 'service') {
        var service = form.querySelector('input[name="service"]:checked');
        setError('service', service ? '' : 'Please choose the type of cleaning.');
        if (!service && !firstBad) firstBad = form.querySelector('input[name="service"]');
        return;
      }
      var el = document.getElementById(id);
      var ok = RULES[id].test(el.value);
      setError(id, ok ? '' : RULES[id].msg);
      if (!ok && !firstBad) firstBad = el;
    });

    if (firstBad) {
      firstBad.focus();
      firstBad.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    return true;
  }

  // limpa o erro assim que a pessoa corrige
  form.addEventListener('input', function (e) {
    var field = e.target.closest('.field');
    if (field && field.classList.contains('invalid')) {
      var id = e.target.id || e.target.name;
      if (RULES[id] && RULES[id].test(e.target.value)) setError(id, '');
    }
  });
  form.addEventListener('change', function (e) {
    if (e.target.name === 'service') setError('service', '');
  });

  /* ============================================================
     MENSAGEM CONDICIONAL POR TIPO DE SERVIÇO
     A oferta de 10% vale SÓ para regular cleaning. A mensagem
     precisa deixar isso explícito no momento da escolha, não só
     nas condições no rodapé.
     ============================================================ */
  var SERVICE_NOTE = {
    'Regular Cleaning': {
      text: "You're eligible for 10% off your first regular cleaning.",
      tone: 'is-offer'
    },
    'Deep Cleaning': null, // sem mensagem de desconto, por especificação
    'Not Sure Yet': {
      text: "We'll help you choose the right service. The 10% new-client offer applies to regular cleaning only.",
      tone: 'is-info'
    }
  };

  var noteEl = document.getElementById('service-note');

  function renderServiceNote() {
    var picked = form.querySelector('input[name="service"]:checked');
    var note = picked ? SERVICE_NOTE[picked.value] : null;

    if (!note) {
      noteEl.hidden = true;
      noteEl.textContent = '';
      noteEl.className = 'service-note';
      return;
    }
    noteEl.textContent = note.text;
    noteEl.className = 'service-note ' + note.tone;
    noteEl.hidden = false;
  }

  form.addEventListener('change', function (e) {
    if (e.target.name === 'service') renderServiceNote();
  });
  renderServiceNote(); // cobre o rascunho restaurado do sessionStorage

  /* valida ao sair do campo, não enquanto digita:
     erro que aparece no meio da digitação irrita e faz desistir */
  SAVE_FIELDS.forEach(function (id) {
    var el = document.getElementById(id);
    if (!RULES[id]) return;
    el.addEventListener('blur', function () {
      if (this.value === '') return;               // campo vazio ainda não é erro
      var ok = RULES[id].test(this.value);
      setError(id, ok ? '' : RULES[id].msg);
    });
  });

  /* ---------- monta os dados ---------- */
  function collect() {
    var service = form.querySelector('input[name="service"]:checked');
    var value   = service ? service.value : '';
    return {
      first_name: document.getElementById('f-name').value.trim(),
      phone:      document.getElementById('f-phone').value.trim(),
      email:      document.getElementById('f-email').value.trim(),
      zip:        document.getElementById('f-zip').value.trim(),
      service:    value,
      bedrooms:   document.getElementById('f-beds').value,
      bathrooms:  document.getElementById('f-baths').value,
      notes:      document.getElementById('f-notes').value.trim(),
      source:     'Landing Page - Google Ads',
      // a oferta só existe para regular cleaning
      offer:      value === 'Regular Cleaning' ? '10% off first regular cleaning' : 'none',
      page_url:   window.location.href
    };
  }

  /* Envelope do Web3Forms. Ele manda por e-mail todo campo que
     receber, então os nomes de collect() viram as linhas do e-mail.
     subject é o que a cliente lê na caixa de entrada sem abrir. */
  function payload(d) {
    return Object.assign({
      access_key: CONFIG.accessKey,
      from_name:  'KD Cleaning Services — Landing Page',
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

  function whatsappLink(d) {
    var lines = [
      'New quote request from the website',
      '',
      'Name: ' + d.first_name,
      'Phone: ' + d.phone,
      'ZIP: ' + d.zip,
      'Service: ' + d.service,
      'Bedrooms: ' + d.bedrooms,
      'Bathrooms: ' + d.bathrooms
    ];
    if (d.email) lines.push('Email: ' + d.email);
    if (d.notes) lines.push('Notes: ' + d.notes);
    lines.push('', d.service === 'Regular Cleaning'
      ? 'Offer: 10% off first regular cleaning'
      : 'Offer: not applicable (regular cleaning only)');

    return 'https://wa.me/' + CONFIG.whatsappNumber + '?text=' + encodeURIComponent(lines.join('\n'));
  }

  /* ---------- rastreamento de conversão ---------- */
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

  /* ---------- navegação entre os passos ---------- */
  nextBtn.addEventListener('click', function () {
    if (!validateStep(1)) return;
    track('form_step_1', { service: (form.querySelector('input[name="service"]:checked') || {}).value });
    goToStep(2);
  });

  backBtn.addEventListener('click', function () { goToStep(1); });

  // Enter no passo 1 avança em vez de enviar
  form.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && currentStep === 1 && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      nextBtn.click();
    }
  });

  /* ---------- envio ---------- */
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    status.textContent = '';

    // honeypot: se estiver preenchido, é bot
    if (document.getElementById('f-company').value !== '') return;

    // revalida os dois passos antes de enviar
    if (!validateStep(1)) { goToStep(1); return; }
    if (!validateStep(2)) return;

    var data = collect();
    sendHook(data);
    submit.disabled = true;
    submit.textContent = 'Sending...';

    /* mensagem de sucesso muda conforme o serviço escolhido:
       prometer desconto para quem pediu deep cleaning geraria
       frustração na hora de mandar o orçamento */
    var SUCCESS_MSG = {
      'Regular Cleaning': "We received your details and will text your quote shortly, with 10% off your first regular cleaning included.",
      'Deep Cleaning':    "We received your details and will text your deep cleaning quote shortly.",
      'Not Sure Yet':     "We'll review your cleaning needs and help you choose the most appropriate service."
    };

    /* mapeia o serviço para a variante de texto da /thanks/. A página
       precisa disso pelo mesmo motivo do SUCCESS_MSG: prometer o
       desconto para quem pediu deep cleaning gera frustração depois. */
    var THANKS_SLUG = {
      'Regular Cleaning': 'regular',
      'Deep Cleaning':    'deep',
      'Not Sure Yet':     'unsure'
    };

    function done() {
      clearDraft();
      track('generate_lead', { service: data.service, zip: data.zip, value: 200, currency: 'USD' });

      if (CONFIG.thanksUrl) {
        /* o track() acima dispara pixels de conversão; alguns usam
           imagem, que a navegação cancelaria. O respiro curto deixa
           eles saírem antes de trocar de página. */
        var url = CONFIG.thanksUrl + (THANKS_SLUG[data.service] ? '?s=' + THANKS_SLUG[data.service] : '');
        setTimeout(function () { window.location.href = url; }, 120);
        return;
      }

      var msgEl = document.getElementById('form01-success-msg');
      if (msgEl && SUCCESS_MSG[data.service]) msgEl.textContent = SUCCESS_MSG[data.service];

      form.hidden = true;
      stepsBar.hidden = true;
      stepLbl.hidden = true;
      success.hidden = false;
      success.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function fail(message) {
      submit.disabled = false;
      submit.textContent = 'Send My Request';
      status.textContent = message;
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
           key está errada ou o envio foi barrado — checar só r.ok
           daria sucesso falso e o lead sumiria em silêncio */
        if (!j || !j.success) throw new Error(j && j.message ? j.message : 'web3forms');
        if (CONFIG.alsoOpenWhatsApp) window.open(whatsappLink(data), '_blank');
        done();
      })
      .catch(function () {
        // se o envio falhar, o lead não se perde: cai no WhatsApp
        window.open(whatsappLink(data), '_blank');
        done();
      });
    } else {
      var win = window.open(whatsappLink(data), '_blank');
      if (!win) {
        // popup bloqueado: navega na mesma aba
        window.location.href = whatsappLink(data);
        return;
      }
      done();
    }
  });

})();
