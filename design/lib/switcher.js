
(function () {
  "use strict";
  var TIERS = ["rich", "balanced", "solid", "a11y"];
  var NUMERALS = ["auto", "arabic", "western"];
  var TIER_LABEL = { rich: "غنيّ", balanced: "متوازن", solid: "صلب", a11y: "وصولية" };
  var TIER_LABEL_EN = { rich: "Rich", balanced: "Balanced", solid: "Solid", a11y: "A11y" };
  var KEY = "nibras-ms-state";
  var root = document.documentElement;

  var state = { tier: "rich", theme: "dark", lang: "ar", numeral: "auto" };

  // العملة الواعية بالـlocale (رمز قصير). الطويل في tokens.json (currency.long).
  var CURR = { ar: "ل.س", en: "SYP" };

  // مفردات UI محدودة (lookup) — وحدات وعبارات متكرّرة مميّزة، ثنائية الاتجاه.
  // مرتّبة الأطول→الأقصر لمنع التطابق الجزئي. (بحث a11y: جدول مفردات منتهٍ مُنسَّق.)
  var GLOSSARY = [
    ["غير متوفّر", "Out of stock"], ["غير متوفر", "Out of stock"],
    ["هذا الأسبوع", "this week"], ["آخر تحديث", "Updated"], ["تفاصيل المؤشّر", "Index details"],
    ["أسطوانة", "cylinder"], ["صفيحة", "tin"], ["أرغفة", "loaves"], ["عيّنات", "samples"],
    ["عيّنة", "sample"], ["متوفّر", "In stock"], ["متوفر", "In stock"], ["محال", "shops"],
    ["ربطة", "bundle"], ["رغيف", "loaf"], ["قارورة", "bottle"], ["علبة", "box"],
    ["كيس", "bag"], ["شحيح", "Scarce"], ["محل", "shop"], ["لتر", "L"], ["كغ", "kg"], ["غرام", "g"],
    ["ألف", "K"], ["كم", "km"], ["متاجر قريبة منك", "Stores near you"], ["عرض الكل", "View all"]
  ];

  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function clamp(v, list, def) { return list.indexOf(v) >= 0 ? v : def; }

  function readURL() {
    try {
      var p = new URLSearchParams(window.location.search);
      if (p.get("tier")) state.tier = clamp(p.get("tier"), TIERS, state.tier);
      if (p.get("theme")) state.theme = clamp(p.get("theme"), ["dark", "light"], state.theme);
      if (p.get("lang")) state.lang = clamp(p.get("lang"), ["ar", "en"], state.lang);
      if (p.get("numeral")) state.numeral = clamp(p.get("numeral"), NUMERALS, state.numeral);
      return p.has("tier") || p.has("theme") || p.has("lang") || p.has("numeral");
    } catch (e) { return false; }
  }
  function readStore() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || "null");
      if (s && s.tier) {
        state.tier = clamp(s.tier, TIERS, state.tier);
        state.theme = clamp(s.theme, ["dark", "light"], state.theme);
        state.lang = clamp(s.lang, ["ar", "en"], state.lang);
        state.numeral = clamp(s.numeral, NUMERALS, state.numeral);
      }
    } catch (e) {}
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

  function westernDigits() {
    return state.numeral === "auto" ? (state.lang === "en") : (state.numeral === "western");
  }

  // الشعار حسب الوضع (canon §3): الملف المعتمد الصحيح لكل سمة — بلا إعادة تلوين.
  function swapLogos() {
    var imgs = document.querySelectorAll("img[data-logo]");
    for (var i = 0; i < imgs.length; i++) {
      var base = imgs[i].getAttribute("data-logo");
      imgs[i].setAttribute("src", base + "/nibras_logo_" + state.theme + ".png");
    }
  }

  function swapLang() {
    var ar = state.lang === "ar";
    var nodes = document.querySelectorAll("[data-ar],[data-en]");
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      // (أ) لا تمسح أيقونة/أبناء: عنصر يحوي أبناء عناصر (زرّ أيقونيّ فيه <svg>) يُترَك للـrelabel.
      if (n.firstElementChild) continue;
      var t = ar ? n.getAttribute("data-ar") : n.getAttribute("data-en");
      // (ب) truthy فقط: تخطَّ null والسلسلة الفارغة (نمط واسمات CSS «<span data-ar>…»</span>» في الخريطة).
      if (t) n.textContent = t;
    }
    swapAttrs(ar);
  }

  // (ج) ترجمة السمات التفاعليّة: data-{ar,en}-{placeholder,label,title,alt} → placeholder/aria-label/title/alt.
  // يحلّ فجوة AG2 i18n (٤٠+ شاشة): حقول الإدخال والأزرار الأيقونيّة تترجم في EN دون مسح الأيقونة.
  function swapAttrs(ar) {
    var MAP = [["placeholder", "placeholder"], ["label", "aria-label"], ["title", "title"], ["alt", "alt"],
               ["ph", "placeholder"], ["lbl", "aria-label"], ["ttl", "title"]];   // aliases مختصرة
    for (var m = 0; m < MAP.length; m++) {
      var key = MAP[m][0], attr = MAP[m][1];
      var els = document.querySelectorAll("[data-ar-" + key + "],[data-en-" + key + "]");
      for (var i = 0; i < els.length; i++) {
        var v = ar ? els[i].getAttribute("data-ar-" + key) : els[i].getAttribute("data-en-" + key);
        if (v) els[i].setAttribute(attr, v);
      }
    }
  }

  // ── تحويلات الأرقام (bijective/idempotent) ──
  function toEnDigits(s) {
    return s.replace(/[٠-٩]/g, function (d) { return String.fromCharCode(d.charCodeAt(0) - 0x0660 + 48); })
            .replace(/٬/g, ",").replace(/٫/g, ".");
  }
  function toArDigits(s) {
    var out = "";
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (ch >= "0" && ch <= "9" && !/[A-Za-z]/.test(out.slice(-1))) {
        out += String.fromCharCode(ch.charCodeAt(0) - 48 + 0x0660);
      } else { out += ch; }
    }
    return out.replace(/([٠-٩]),(?=[٠-٩])/g, "$1٬").replace(/([٠-٩])\.(?=[٠-٩])/g, "$1٫");
  }

  // ── العملة + المفردات ──
  function glossAr2En(s) {
    for (var i = 0; i < GLOSSARY.length; i++) {
      var re = new RegExp("(^|[^\\u0621-\\u064A])" + esc(GLOSSARY[i][0]) + "(?![\\u0621-\\u064A])", "g");
      s = s.replace(re, "$1" + GLOSSARY[i][1]);
    }
    return s;
  }
  function glossEn2Ar(s) {
    for (var i = 0; i < GLOSSARY.length; i++) {
      var re = new RegExp("\\b" + esc(GLOSSARY[i][1]) + "\\b", "g");
      s = s.replace(re, GLOSSARY[i][0]);
    }
    return s;
  }

  function transform(s, en, western) {
    s = en ? s.replace(/ل\.‏?\s?س/g, CURR.en) : s.replace(/\bSYP\b/g, CURR.ar);   // currency
    s = en ? glossAr2En(s) : glossEn2Ar(s);                                            // finite UI vocab
    s = western ? toEnDigits(s) : toArDigits(s);                                       // numerals
    return s;
  }

  function relabel() {
    var en = state.lang === "en", western = westernDigits();
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode;
        if (!p) return NodeFilter.FILTER_REJECT;
        if (p.nodeName === "SCRIPT" || p.nodeName === "STYLE") return NodeFilter.FILTER_REJECT;
        if (p.closest && p.closest(".ms-sw")) return NodeFilter.FILTER_REJECT;   // لا تلمس لوحة المبدّل
        return /\S/.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    var node, nodes = [];
    while ((node = walker.nextNode())) nodes.push(node);
    for (var i = 0; i < nodes.length; i++) {
      var v = nodes[i].nodeValue, nv = transform(v, en, western);
      if (nv !== v) nodes[i].nodeValue = nv;
    }
  }

  function syncFrames() {
    var frames = document.querySelectorAll("iframe[data-ms-src]");
    for (var i = 0; i < frames.length; i++) {
      var f = frames[i], base = f.getAttribute("data-ms-src");
      var q = "tier=" + state.tier + "&theme=" + state.theme + "&lang=" + state.lang + "&numeral=" + state.numeral;
      var url = base + (base.indexOf("?") >= 0 ? "&" : "?") + q;
      if (f.getAttribute("src") !== url) f.setAttribute("src", url);
    }
  }

  function reflectControls() {
    var btns = document.querySelectorAll("[data-set]");
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i], kind = b.getAttribute("data-set"), val = b.getAttribute("data-val");
      var on = (kind === "tier" && val === state.tier) || (kind === "theme" && val === state.theme) ||
               (kind === "lang" && val === state.lang) || (kind === "numeral" && val === state.numeral);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    }
  }

  function apply() {
    for (var i = 0; i < TIERS.length; i++) root.classList.remove("tier-" + TIERS[i]);
    root.classList.add("tier-" + state.tier);
    root.setAttribute("data-theme", state.theme);
    root.setAttribute("lang", state.lang);
    root.setAttribute("dir", state.lang === "en" ? "ltr" : "rtl");
    swapLogos();
    swapLang();
    relabel();          // عملة + مفردات + أرقام (locale-aware)
    reflectControls();
    syncFrames();
    save();
    try { window.dispatchEvent(new CustomEvent("ms:change", { detail: Object.assign({}, state) })); } catch (e) {}
  }

  function set(kind, val) { state[kind] = val; apply(); }

  function injectStyles() {
    if (document.getElementById("ms-sw-style")) return;
    var css =
      ".ms-sw{position:sticky;inset-block-start:0;z-index:50;display:flex;flex-wrap:wrap;align-items:center;gap:12px;" +
      "padding:8px 12px;background:var(--bg-surface);border-block-end:1px solid var(--line-hairline);" +
      "font-family:var(--font-ar-body);box-shadow:var(--elev-1)}" +
      ".ms-sw__group{display:inline-flex;align-items:center;gap:6px}" +
      ".ms-sw__cap{font-size:var(--type-label-size);font-weight:600;color:var(--ink-tertiary)}" +
      ".ms-sw__seg{display:inline-flex;gap:2px;padding:3px;background:var(--bg-input);border:1px solid var(--line-strong);border-radius:var(--radius-pill)}" +
      ".ms-sw__btn{min-height:32px;min-width:36px;padding:0 10px;border:0;border-radius:var(--radius-pill);background:transparent;" +
      "color:var(--ink-secondary);font-family:var(--font-ar-body);font-size:var(--type-caption-size);font-weight:600;cursor:pointer}" +
      ".ms-sw__btn[aria-pressed='true']{background:var(--accent-brand);color:var(--bg-canvas)}" +
      ".ms-sw__btn:focus-visible{outline:var(--focus-ring-width) solid var(--accent-brand);outline-offset:var(--focus-ring-offset)}" +
      ".ms-sw__spacer{margin-inline-start:auto;font-size:var(--type-label-size);color:var(--ink-tertiary)}";
    var s = document.createElement("style");
    s.id = "ms-sw-style"; s.textContent = css; document.head.appendChild(s);
  }

  function seg(kind, items, labels, labelsEn) {
    var html = '<span class="ms-sw__seg" role="group">';
    for (var i = 0; i < items.length; i++) {
      var v = items[i];
      html += '<button type="button" class="ms-sw__btn" data-set="' + kind + '" data-val="' + v + '" ' +
        'data-ar="' + labels[v] + '" data-en="' + (labelsEn ? labelsEn[v] : labels[v]) + '">' + labels[v] + "</button>";
    }
    return html + "</span>";
  }

  function buildPanel(host) {
    injectStyles();
    host.className = "ms-sw";
    host.setAttribute("role", "toolbar");
    host.setAttribute("aria-label", "مبدّل الطبقة والسمة واللغة والأرقام");
    host.innerHTML =
      '<span class="ms-sw__group"><span class="ms-sw__cap" data-ar="الطبقة" data-en="Tier">الطبقة</span>' +
        seg("tier", TIERS, TIER_LABEL, TIER_LABEL_EN) + "</span>" +
      '<span class="ms-sw__group"><span class="ms-sw__cap" data-ar="السمة" data-en="Theme">السمة</span>' +
        seg("theme", ["dark", "light"], { dark: "داكن", light: "فاتح" }, { dark: "Dark", light: "Light" }) + "</span>" +
      '<span class="ms-sw__group"><span class="ms-sw__cap" data-ar="اللغة" data-en="Lang">اللغة</span>' +
        seg("lang", ["ar", "en"], { ar: "عربي", en: "EN" }, { ar: "AR", en: "EN" }) + "</span>" +
      '<span class="ms-sw__group"><span class="ms-sw__cap" data-ar="الأرقام" data-en="Numerals">الأرقام</span>' +
        seg("numeral", NUMERALS, { auto: "تلقائي", arabic: "١٢٣", western: "123" }, { auto: "Auto", arabic: "١٢٣", western: "123" }) + "</span>" +
      '<span class="ms-sw__spacer" data-ar="نظام مواد نِبراس V5" data-en="Nibras Material System V5">نظام مواد نِبراس V5</span>';

    host.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest("[data-set]") : null;
      if (!b) return;
      set(b.getAttribute("data-set"), b.getAttribute("data-val"));
    });
  }

  function wireExternal() {
    document.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest("[data-set]") : null;
      if (!b || b.closest(".ms-sw")) return;            // لوحة المبدّل تتولّى أزرارها
      set(b.getAttribute("data-set"), b.getAttribute("data-val"));
    });
  }

  function init() {
    var fromURL = readURL();
    if (!fromURL) readStore();
    var host = document.getElementById("ms-switcher");
    if (host) buildPanel(host);
    wireExternal();
    apply();
  }

  window.NibrasSwitcher = {
    set: set,
    get: function () { return Object.assign({}, state); },
    apply: apply,
    TIERS: TIERS, NUMERALS: NUMERALS
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
