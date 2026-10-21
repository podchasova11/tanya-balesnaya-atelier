(function () {
  /* ---------- меню ---------- */
  var burger = document.querySelector('.nav__burger');
  var list = document.querySelector('.nav__list');
  if (burger && list) {
    burger.addEventListener('click', function () {
      var open = list.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    list.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        list.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ---------- подсветка пункта меню при прокрутке ---------- */
  var links = Array.prototype.slice.call(document.querySelectorAll('.nav__list a'));
  var map = {};
  links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && map[en.target.id]) {
          links.forEach(function (l) { l.classList.remove('is-active'); });
          map[en.target.id].classList.add('is-active');
        }
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) io.observe(el);
    });
  }

  /* ---------- форма заявки ---------- */
  var form = document.getElementById('requestForm');
  if (!form) return;

  var PHONE_FALLBACK = '+7 926 605-21-14';
  var nameInput = form.elements.name;
  var phoneInput = form.elements.phone;
  var consentInput = form.elements.consent;
  var submitBtn = form.querySelector('button[type="submit"]');
  var status = form.querySelector('.form__status');
  var sending = false;

  function digitsOf(v) {
    var d = String(v).replace(/\D/g, '');
    if (!d) return '';
    if (d[0] === '8') d = '7' + d.slice(1);
    else if (d[0] !== '7') d = '7' + d;
    return d.slice(0, 11);
  }

  function formatPhone(d) {
    if (!d) return '';
    var r = '+7';
    if (d.length > 1) r += ' (' + d.slice(1, 4);
    if (d.length >= 4) r += ')';
    if (d.length > 4) r += ' ' + d.slice(4, 7);
    if (d.length > 7) r += '-' + d.slice(7, 9);
    if (d.length > 9) r += '-' + d.slice(9, 11);
    return r;
  }

  phoneInput.addEventListener('input', function (e) {
    var d = digitsOf(phoneInput.value);
    if (d === '7' && e.inputType && e.inputType.indexOf('delete') === 0) d = '';
    phoneInput.value = formatPhone(d);
  });

  function setError(input, msg) {
    var box = document.getElementById('err-' + input.name);
    if (box) box.textContent = msg || '';
    if (msg) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }

  function validate() {
    var bad = [];
    var name = nameInput.value.trim();
    if (name.length < 2) { setError(nameInput, 'Введите имя'); bad.push(nameInput); }
    else setError(nameInput, '');

    if (digitsOf(phoneInput.value).length !== 11) {
      setError(phoneInput, 'Введите телефон полностью, например +7 926 000-00-00');
      bad.push(phoneInput);
    } else setError(phoneInput, '');

    if (!consentInput.checked) {
      setError(consentInput, 'Нужно согласие на обработку персональных данных');
      bad.push(consentInput);
    } else setError(consentInput, '');
    return bad;
  }

  [nameInput, phoneInput].forEach(function (i) {
    i.addEventListener('input', function () { if (i.getAttribute('aria-invalid')) setError(i, ''); });
  });
  consentInput.addEventListener('change', function () { if (consentInput.checked) setError(consentInput, ''); });

  function showStatus(kind, html) {
    status.hidden = false;
    status.className = 'form__status' + (kind === 'ok' ? ' form__status--ok' : '');
    status.innerHTML = html;
  }

  function failMessage(code) {
    if (code === 429) return 'Слишком много заявок подряд. Попробуйте чуть позже или позвоните: <a href="tel:+79266052114">' + PHONE_FALLBACK + '</a>.';
    return 'Не удалось отправить заявку. Позвоните нам: <a href="tel:+79266052114">' + PHONE_FALLBACK + '</a> или напишите в мессенджер.';
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending) return;
    status.hidden = true;

    var bad = validate();
    if (bad.length) { bad[0].focus(); return; }

    // ловушка для ботов: поле скрыто от людей
    if (form.elements.website && form.elements.website.value) {
      showStatus('ok', 'Спасибо! Заявка отправлена, мы свяжемся с вами в ближайшее время.');
      form.reset();
      return;
    }

    var payload = {
      name: nameInput.value.trim(),
      phone: '+' + digitsOf(phoneInput.value),
      message: form.elements.message.value.trim(),
      consent: true
    };

    sending = true;
    submitBtn.disabled = true;
    var label = submitBtn.textContent;
    submitBtn.textContent = 'Отправляем…';

    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 15000) : null;

    fetch(form.getAttribute('action'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      if (res.ok) {
        showStatus('ok', 'Спасибо! Заявка отправлена, мы свяжемся с вами в ближайшее время.');
        form.reset();
      } else {
        showStatus('err', failMessage(res.status));
      }
    }).catch(function () {
      showStatus('err', failMessage(0));
    }).then(function () {
      if (timer) clearTimeout(timer);
      sending = false;
      submitBtn.disabled = false;
      submitBtn.textContent = label;
    });
  });
})();
