/* C022 Hearing Solution Cambodia — bilingual (EN/KH) language engine.
   Shared localStorage key with the booking system: c022Language ("en" | "kh").
   Applies translations to every [data-i18n] / [data-i18n-placeholder] / [data-i18n-aria]
   element from window.C022_I18N (see js/translations.js). Does not touch data-* logic
   attributes (product ids, brand keys, image paths, etc.). */
(function () {
  var STORAGE_KEY = 'c022Language';
  var DEFAULT_LANG = 'en';

  function getLang() {
    try {
      var saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'kh') return saved;
    } catch (e) {}
    return DEFAULT_LANG;
  }

  function setLang(lang) {
    if (lang !== 'en' && lang !== 'kh') return;
    try { window.localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
    applyLang(lang);
  }

  function translate(key, lang) {
    var dict = window.C022_I18N && window.C022_I18N[lang];
    if (dict && Object.prototype.hasOwnProperty.call(dict, key)) return dict[key];
    var fallback = window.C022_I18N && window.C022_I18N.en;
    return (fallback && fallback[key]) || null;
  }

  function applyLang(lang) {
    document.documentElement.lang = lang === 'kh' ? 'km' : 'en';
    document.documentElement.setAttribute('data-lang', lang);
    if (document.body) {
      document.body.classList.toggle('lang-kh', lang === 'kh');
      document.body.classList.toggle('lang-en', lang !== 'kh');
    }

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var value = translate(el.getAttribute('data-i18n'), lang);
      if (value != null) el.innerHTML = value;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var value = translate(el.getAttribute('data-i18n-placeholder'), lang);
      if (value != null) el.setAttribute('placeholder', value);
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
      var value = translate(el.getAttribute('data-i18n-aria'), lang);
      if (value != null) el.setAttribute('aria-label', value);
    });

    document.querySelectorAll('.lang-btn').forEach(function (btn) {
      var isActive = btn.getAttribute('data-lang-btn') === lang;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });

    document.title = lang === 'kh'
      ? 'Hearing Solution Cambodia | ការថែទាំការស្តាប់'
      : 'Hearing Solution Cambodia | Hearing Care';

    document.dispatchEvent(new CustomEvent('c022:langchange', { detail: { lang: lang } }));
  }

  function init() {
    applyLang(getLang());
    document.querySelectorAll('.lang-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setLang(btn.getAttribute('data-lang-btn'));
      });
    });
  }

  // Keep in sync if the language is changed in another tab (e.g. the booking tab).
  window.addEventListener('storage', function (event) {
    if (event.key === STORAGE_KEY && (event.newValue === 'en' || event.newValue === 'kh')) {
      applyLang(event.newValue);
    }
  });

  window.C022_LANG = { get: getLang, set: setLang, translate: translate, STORAGE_KEY: STORAGE_KEY };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
