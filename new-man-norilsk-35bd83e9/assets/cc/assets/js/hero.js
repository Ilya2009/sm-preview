/* barber-pole-hero-v3 -- hero.js
 * One IIFE, classic <script> (no ES modules -- must run from file://).
 * Sections: config -> guard -> hours -> layout/fit -> renderer -> state -> input -> qa.
 * No fetch(), no getImageData, no CDN, no network. See BUILD_SPEC.md.
 */
(function () {
  "use strict";

  /* ============================================================
   * 0. DOM refs
   * ========================================================== */
  var heroEl = document.getElementById("hero");
  var wallEl = document.getElementById("wall"); // 2026-09-22: cursor-parallax target, section 9b
  var laneEl = document.getElementById("lane");
  var laneRestEl = document.getElementById("laneRest");
  var navEl = document.getElementById("nav");
  var titleEl = document.getElementById("title");
  var mottoEl = document.getElementById("motto");
  var ledeEl = document.getElementById("lede");
  var actionsEl = document.getElementById("actions");
  var ctaEl = document.getElementById("cta");
  var ctaLabelEl = document.getElementById("ctaLabel");
  var signStatusEl = document.getElementById("signStatus");
  var signStatusTextEl = document.getElementById("signStatusText");
  var outlineSignEl = document.getElementById("outlineSign");
  var stackedSignEl = document.getElementById("stackedSign");
  var poleEl = document.getElementById("pole");
  var poleMediaEl = document.getElementById("poleMedia");
  var polePosterEl = document.getElementById("polePoster");
  var poleCanvasEl = document.getElementById("poleCanvas");
  // poleBoltEl is now the single real on/off control (a <button>, not a decorative div) --
  // see section 8 below. poleBoltTipEl is its first-hover text hint.
  var poleBoltEl = document.getElementById("poleBolt");
  var poleBoltTipEl = document.getElementById("poleBoltTip");
  var sideSlogansEl = document.getElementById("sideSlogans");
  var sideSloganAEl = document.getElementById("sideSloganA");
  var sideSloganBEl = document.getElementById("sideSloganB");
  var sideSloganCEl = document.getElementById("sideSloganC"); // 2026-09-22: 3rd fact slot
  var phoneLineEl = document.getElementById("phoneLine"); // 2026-09-22: relocated out of side-slogans
  var phoneLineLinkEl = document.getElementById("phoneLineLink");
  var factsInlineEl = document.getElementById("factsInline"); // 2026-09-22 (craft pass): fallback row, see layoutSpill()
  var spillEl = document.getElementById("spill");

  var ctx2d = document.createElement("canvas").getContext("2d");

  /* ============================================================
   * 1. Config resolution + QA query overrides (read-only, no storage)
   * ========================================================== */
  var params = new URLSearchParams(location.search);
  function qp(name) { return params.has(name) ? params.get(name) : null; }

  var RAW_CONFIG = window.HERO_CONFIG || {};
  var CONFIG = {};
  for (var k in RAW_CONFIG) { if (Object.prototype.hasOwnProperty.call(RAW_CONFIG, k)) CONFIG[k] = RAW_CONFIG[k]; }

  var qName = qp("name");
  if (qName) CONFIG.name = qName;

  var qCity = qp("city");
  if (qCity) CONFIG.cityIn = qCity;

  var qAccentRaw = qp("accent");
  if (qAccentRaw) {
    var hexCandidate = qAccentRaw.replace(/^%23/i, "").replace(/^#/, "");
    if (/^[0-9a-fA-F]{6}$/.test(hexCandidate) || /^[0-9a-fA-F]{3}$/.test(hexCandidate)) {
      CONFIG.brandAccent = "#" + hexCandidate;
    } else {
      console.warn("HERO ?accent invalid, ignored:", qAccentRaw);
    }
  }

  var qStateRaw = qp("state");
  var FORCED_STATE = null;
  if (qStateRaw === "on" || qStateRaw === "off") FORCED_STATE = qStateRaw;
  else if (qStateRaw != null) console.warn("HERO ?state invalid, ignored:", qStateRaw);

  var qNowRaw = qp("now");
  var FORCED_NOW = null;
  if (qNowRaw) {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/.test(qNowRaw)) {
      var parsedNow = new Date(qNowRaw);
      if (!isNaN(parsedNow.getTime())) FORCED_NOW = parsedNow;
    }
    if (!FORCED_NOW) console.warn("HERO ?now invalid (need offset or Z), ignored:", qNowRaw);
  }

  var qHoursRaw = qp("hours");
  var FORCE_NO_HOURS = qHoursRaw === "none";
  if (qHoursRaw != null && qHoursRaw !== "none") console.warn("HERO ?hours invalid, ignored:", qHoursRaw);

  var qMotionRaw = qp("motion");
  var FORCE_REDUCE_MOTION = qMotionRaw === "reduce";
  if (qMotionRaw != null && qMotionRaw !== "reduce") console.warn("HERO ?motion invalid, ignored:", qMotionRaw);

  var qFrameRaw = qp("frame");
  var FORCED_FRAME = null;
  if (qFrameRaw != null) {
    var fnum = Number(qFrameRaw);
    if (Number.isFinite(fnum) && fnum >= 0) FORCED_FRAME = fnum;
    else console.warn("HERO ?frame invalid, ignored:", qFrameRaw);
  }

  // 2026-09-22: ?speed= and ?mc= removed together with the pointer-driven variable-speed
  // motor and its crossfade renderer (see section 7/8 below) -- there is no longer a
  // continuous playback speed or a blended in-between frame to tune, only a fixed 24fps
  // whole-frame cadence, so both query params would have nothing left to control.

  /* ============================================================
   * 2. guardAccent -- sRGB <-> OKLCH, WCAG contrast, no libraries
   * ========================================================== */
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function hexToRgb01(hex) {
    var h = String(hex).replace(/^#/, "");
    if (h.length === 3) h = h.split("").map(function (c) { return c + c; }).join("");
    var num = parseInt(h, 16);
    if (!isFinite(num)) num = 0;
    return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255];
  }
  function rgb01ToHex(rgb) {
    return "#" + rgb.map(function (c) {
      var v = Math.round(clamp01(c) * 255);
      var s = v.toString(16);
      return s.length < 2 ? "0" + s : s;
    }).join("");
  }
  function srgbToLinear(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function linearToSrgb(c) { c = clamp01(c); return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; }

  function linearToOklab(r, g, b) {
    var l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
    var m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
    var s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
    var l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
    return [
      0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
      1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
      0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
    ];
  }
  function oklabToLinear(L, a, b) {
    var l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    var m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    var s_ = L - 0.0894841775 * a - 1.2914855480 * b;
    var l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
    return [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
    ];
  }
  function rgb01ToOklch(rgb) {
    var lin = [srgbToLinear(rgb[0]), srgbToLinear(rgb[1]), srgbToLinear(rgb[2])];
    var lab = linearToOklab(lin[0], lin[1], lin[2]);
    return { L: lab[0], C: Math.hypot(lab[1], lab[2]), h: Math.atan2(lab[2], lab[1]) };
  }
  function oklchToRgb01(L, C, h) {
    var lin = oklabToLinear(L, C * Math.cos(h), C * Math.sin(h));
    return [linearToSrgb(lin[0]), linearToSrgb(lin[1]), linearToSrgb(lin[2])];
  }
  function oklchToLinearRaw(L, C, h) { return oklabToLinear(L, C * Math.cos(h), C * Math.sin(h)); }
  function inGamut(lin) { return lin[0] >= -1e-4 && lin[0] <= 1 + 1e-4 && lin[1] >= -1e-4 && lin[1] <= 1 + 1e-4 && lin[2] >= -1e-4 && lin[2] <= 1 + 1e-4; }
  function relLuminance01(rgb) { return 0.2126 * srgbToLinear(rgb[0]) + 0.7152 * srgbToLinear(rgb[1]) + 0.0722 * srgbToLinear(rgb[2]); }
  function contrastToBlack(rgb) { return (relLuminance01(rgb) + 0.05) / 0.05; }

  function guardAccent(hex) {
    var raw = hex;
    var rgb0 = hexToRgb01(hex);
    var oklch = rgb01ToOklch(rgb0);
    var L = oklch.L, C = oklch.C, h = oklch.h;
    var guard = "none";
    var used;

    if (C < 0.04 && L < 0.5) {
      used = hexToRgb01("#ece7de");
      guard = "neutral";
    } else {
      var rgb = oklchToRgb01(L, C, h);
      var contrast = contrastToBlack(rgb);
      if (contrast < 4.5) {
        guard = "lifted";
        var iter = 0;
        while (contrast < 4.5 && iter < 500) {
          iter++;
          var atCap = L >= 0.80 - 1e-9;
          L = Math.min(0.80, L + 0.02);
          var lin = oklchToLinearRaw(L, C, h);
          if (!inGamut(lin)) C = Math.max(0, C - 0.005);
          rgb = oklchToRgb01(L, C, h);
          contrast = contrastToBlack(rgb);
          if (atCap && contrast < 4.5) break;
        }
        if (contrast < 4.5) {
          used = hexToRgb01("#ece7de");
          guard = "neutral";
        } else {
          used = rgb;
        }
      } else {
        used = rgb;
      }
      if (guard !== "neutral") {
        var oklch2 = rgb01ToOklch(used);
        if (oklch2.L > 0.93) {
          used = oklchToRgb01(0.93, oklch2.C, oklch2.h);
          guard = "lifted";
        }
      }
    }

    var usedHex = rgb01ToHex(used);
    var finalContrast = contrastToBlack(used);

    var outlineAlpha = 0.62;
    function outlineContrastAt(a) {
      var blended = [used[0] * a, used[1] * a, used[2] * a]; // blended over #000
      return contrastToBlack(blended);
    }
    var guardIter = 0;
    while (outlineContrastAt(outlineAlpha) < 3 && outlineAlpha < 1 && guardIter < 20) {
      outlineAlpha = Math.min(1, outlineAlpha + 0.06);
      guardIter++;
    }

    var lab0 = linearToOklab(srgbToLinear(rgb0[0]), srgbToLinear(rgb0[1]), srgbToLinear(rgb0[2]));
    var lab1 = linearToOklab(srgbToLinear(used[0]), srgbToLinear(used[1]), srgbToLinear(used[2]));
    var dE = Math.hypot(lab0[0] - lab1[0], lab0[1] - lab1[1], lab0[2] - lab1[2]);

    var result = {
      raw: raw,
      used: usedHex,
      guard: guard,
      contrast: Math.round(finalContrast * 100) / 100,
      outlineAlpha: Math.round(outlineAlpha * 100) / 100,
      dE: Math.round(dE * 1000) / 1000,
    };
    console.info("HERO accent guard", result);
    if (dE > 0.12) console.warn("accent shifted — manual review", result);
    return result;
  }

  var accentResult = guardAccent(CONFIG.brandAccent || "#2f7df4");
  document.documentElement.setAttribute("data-accent-guard", accentResult.guard);
  heroEl.style.setProperty("--accent", accentResult.used);
  var accentRgb255 = hexToRgb01(accentResult.used).map(function (c) { return Math.round(c * 255); });
  var accentRgbStr = accentRgb255.join(" ");
  heroEl.style.setProperty("--accent-outline", "rgb(" + accentRgbStr + " / " + accentResult.outlineAlpha + ")");

  // 2026-09-22: a SECOND, separate OKLCH guard for the much fainter "brand accent reflected in
  // chrome + wall spill" effect (section 6d below) -- deliberately not the same rules as
  // guardAccent() above (that one protects text-on-black contrast, this one protects a subtle
  // decorative tint from going invisible/muddy on brushed metal). Computed here (next to the
  // other OKLCH guard, same raw brandAccent input) so both guards are easy to compare; only
  // actually *used* once FEATURES exists, see chromeTintActive() in section 6d.
  //  - chroma < 0.05 (black/white/grey brand colors): disable outright, nothing to tint with.
  //  - L < 0.35: lift to 0.55 -- too-dark colors would tint the chrome almost-black, invisible.
  //  - L > 0.9: lower to 0.8 -- too-light colors would tint it almost-white, also invisible.
  //  - chroma capped at 0.15 regardless of input -- this reads as a soft edge glow, not a
  //    saturated logo color painted on the metal.
  function guardChromeTint(hex) {
    var rgb0 = hexToRgb01(hex);
    var oklch = rgb01ToOklch(rgb0);
    var L = oklch.L, C = oklch.C, h = oklch.h;
    if (C < 0.05) return { enabled: false, rgb255: null };
    if (L < 0.35) L = 0.55;
    else if (L > 0.9) L = 0.8;
    if (C > 0.15) C = 0.15;
    var lin = oklchToLinearRaw(L, C, h);
    var iter = 0;
    while (!inGamut(lin) && C > 0 && iter < 200) {
      C = Math.max(0, C - 0.004);
      lin = oklchToLinearRaw(L, C, h);
      iter++;
    }
    var rgb = oklchToRgb01(L, C, h);
    var rgb255 = rgb.map(function (c) { return Math.round(clamp01(c) * 255); });
    // 2026-09-22 (cap brightness fix): also expose the raw hue (h) and gamut-capped target
    // chroma (C, already <=0.15 and reduced further above if it fell outside sRGB at this
    // reference L) -- ensureChromeTintLayer() below needs these two alone (never this
    // function's own L, which was only ever a reference point for picking a legible rgb255
    // swatch for the wall-spill mix) to recolor each chrome pixel at THAT PIXEL's OWN OKLab L
    // instead of this guard's L, which is what actually keeps the shell's real luminosity
    // (see the ensureChromeTintLayer()/drawFrame() comments just below for why).
    return { enabled: true, rgb255: rgb255, h: h, C: C };
  }
  var chromeTintGuard = guardChromeTint(CONFIG.brandAccent || "#2f7df4");

  /* ============================================================
   * 3. Hours + status (fact only, never driven by the switch)
   * ========================================================== */
  var DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  var DAY_RU_LOC = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];
  var TIME_RE = /^([01]\d|2[0-3]):[0-5]\d-(([01]\d|2[0-3]):[0-5]\d|24:00)$/;
  var WEEKDAY_IDX = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

  function toMinutes(hhmm) {
    if (hhmm === "24:00") return 1440;
    var p = hhmm.split(":");
    return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
  }
  function fmtHM(min) {
    min = ((min % 1440) + 1440) % 1440;
    var h = Math.floor(min / 60), m = min % 60;
    return (h < 10 ? "0" + h : "" + h) + ":" + (m < 10 ? "0" + m : "" + m);
  }

  function validateHours(hours) {
    if (FORCE_NO_HOURS) return null;
    if (!hours || typeof hours !== "object" || !hours.timezone) return null;
    try {
      // eslint-disable-next-line no-new
      new Intl.DateTimeFormat("ru", { timeZone: hours.timezone });
    } catch (e) {
      console.warn("HERO hours: invalid timezone", hours.timezone);
      return null;
    }
    var week = hours.week || {};
    var parsed = {};
    var any = false;
    for (var i = 0; i < 7; i++) {
      var key = DAY_KEYS[i];
      var list = week[key] || [];
      if (!Array.isArray(list)) { console.warn("HERO hours: invalid day list", key); return null; }
      var dayOut = [];
      for (var j = 0; j < list.length; j++) {
        var s = list[j];
        if (typeof s !== "string" || !TIME_RE.test(s)) { console.warn("HERO hours: bad interval", key, s); return null; }
        dayOut.push(s);
        any = true;
      }
      parsed[key] = dayOut;
    }
    if (!any) { console.warn("HERO hours: all days empty"); return null; }
    return { timezone: hours.timezone, week: parsed };
  }

  function buildMergedIntervals(parsed) {
    var raw = [];
    for (var i = 0; i < 7; i++) {
      var key = DAY_KEYS[i];
      (parsed.week[key] || []).forEach(function (str) {
        var parts = str.split("-");
        var sm = toMinutes(parts[0]);
        var em = toMinutes(parts[1]);
        var s = i * 1440 + sm;
        var e = i * 1440 + em;
        if (e <= s) e += 1440;
        raw.push([s, e]);
      });
    }
    var dup = [];
    raw.forEach(function (iv) {
      dup.push([iv[0], iv[1]]);
      dup.push([iv[0] - 10080, iv[1] - 10080]);
      dup.push([iv[0] + 10080, iv[1] + 10080]);
    });
    dup.sort(function (a, b) { return a[0] - b[0]; });
    var merged = [];
    dup.forEach(function (iv) {
      var last = merged[merged.length - 1];
      if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1]);
      else merged.push(iv.slice());
    });
    return merged;
  }

  function nowPartsInZone(tz, now) {
    var parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(now);
    var map = {};
    parts.forEach(function (p) { map[p.type] = p.value; });
    return map;
  }

  function computeHoursStatus(parsedHours, now) {
    var merged = buildMergedIntervals(parsedHours);
    var map = nowPartsInZone(parsedHours.timezone, now);
    var dayIdx = WEEKDAY_IDX[map.weekday];
    var nowMin = dayIdx * 1440 + parseInt(map.hour, 10) * 60 + parseInt(map.minute, 10);

    var current = null;
    for (var i = 0; i < merged.length; i++) {
      if (merged[i][0] <= nowMin && nowMin < merged[i][1]) { current = merged[i]; break; }
    }
    if (current) {
      var span = current[1] - current[0];
      if (span >= 10080) return { valid: true, isOpen: true, text: "Открыто круглосуточно" };
      return { valid: true, isOpen: true, text: "Открыто до " + fmtHM(current[1]) };
    }
    var next = null;
    for (var k = 0; k < merged.length; k++) {
      if (merged[k][0] > nowMin) { next = merged[k]; break; }
    }
    if (!next) return { valid: true, isOpen: false, text: "Закрыто" };
    var absDay = Math.floor(next[0] / 1440);
    var deltaDay = absDay - dayIdx;
    var openStr = fmtHM(next[0]);
    if (deltaDay === 0) return { valid: true, isOpen: false, text: "Закрыто · откроемся в " + openStr };
    if (deltaDay === 1) return { valid: true, isOpen: false, text: "Закрыто · откроемся завтра в " + openStr };
    var openDayIdx = ((absDay % 7) + 7) % 7;
    return { valid: true, isOpen: false, text: "Закрыто · откроемся в " + DAY_RU_LOC[openDayIdx] + " в " + openStr };
  }

  var parsedHours = validateHours(CONFIG.hours);
  var hoursState = { valid: false, isOpen: true, text: "" };
  function refreshHoursState() {
    if (!parsedHours) { hoursState = { valid: false, isOpen: true, text: "" }; return hoursState; }
    var now = FORCED_NOW || new Date();
    hoursState = computeHoursStatus(parsedHours, now);
    return hoursState;
  }
  refreshHoursState();

  /* ============================================================
   * 4. Content population (config -> DOM, no facts invented)
   * ========================================================== */
  document.documentElement.lang = "ru";
  var displayName = (CONFIG.nameCase === "asis") ? CONFIG.name : String(CONFIG.name || "").toLocaleUpperCase("ru");
  document.title = CONFIG.seoTitle || ((CONFIG.name || "Барбершоп") + " — барбершоп " + (CONFIG.cityIn || "")); /* chrome-cut adaptation patch P1 */
  var metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute("content", CONFIG.seoDescription || CONFIG.lede || ""); /* chrome-cut adaptation patch P2 */

  (CONFIG.nav || []).forEach(function (item) {
    var a = document.createElement("a");
    a.href = item.href || "#";
    a.textContent = item.label || "";
    navEl.appendChild(a);
  });

  // 2026-09-22 (craft2): the .motto element was removed from index.html (user: "СТИЛЬ. ХАРАКТЕР.
  // ЛЮДИ. убери с главного"). Kept only as a null-safe legacy path: if an adaptation ever puts
  // the element back AND sets CONFIG.motto, it renders; otherwise nothing, no gap.
  var hasMotto = !!(mottoEl && CONFIG.motto && String(CONFIG.motto).trim());
  if (mottoEl) {
    mottoEl.textContent = hasMotto ? String(CONFIG.motto).toLocaleUpperCase("ru") : "";
    mottoEl.hidden = !hasMotto;
  }

  var hasLede = !!(CONFIG.lede && String(CONFIG.lede).trim());
  ledeEl.textContent = hasLede ? CONFIG.lede : "";
  ledeEl.hidden = !hasLede;

  ctaLabelEl.textContent = CONFIG.ctaLabel || "Записаться";
  var ctaHref = CONFIG.bookingHref || (CONFIG.phone && CONFIG.phone.href) || null;
  if (ctaHref) {
    ctaEl.href = ctaHref;
  } else {
    ctaEl.style.display = "none";
    console.error("HERO: no bookingHref and no phone -- CTA hidden", CONFIG.name);
  }

  outlineSignEl.textContent = ((CONFIG.outlineLabel || "Barbershop") + "\n" + (CONFIG.cityIn || "")).toLocaleUpperCase("ru");
  stackedSignEl.textContent = ((CONFIG.outlineLabel || "Barbershop") + "\n" + (CONFIG.cityIn || "")).toLocaleUpperCase("ru");
  stackedSignEl.setAttribute("data-active", "1");

  // BUILD_SPEC 4.3 asks for "small horizontal caps in 2-4 lines, a short rule under each, as
  // in the reference" -- the reference itself breaks each side slogan one word per line
  // ("БОЛЬШЕ / ЧЕМ / СТРИЖКА"). Config only supplies a plain phrase, so wrap it the same way:
  // one word per line, capped at 4 lines (any extra trailing words join the last line rather
  // than growing a 5th).
  function buildSideSloganLines(phrase) {
    var words = String(phrase || "").trim().split(/\s+/).filter(Boolean);
    if (!words.length) return "";
    var MAX_LINES = 4;
    var lines = words.length <= MAX_LINES ? words : words.slice(0, MAX_LINES - 1).concat([words.slice(MAX_LINES - 1).join(" ")]);
    return lines.join("\n");
  }

  // 2026-09-22: real facts (CONFIG.facts, up to 3 -- a big number + small caption each) take
  // priority over the two decorative word-wrapped slogans in this same right-hand column; falls
  // back to the old slogan rendering when facts is empty/absent so adaptations without facts
  // data yet keep working unchanged. A fact needs a non-empty `value` to render at all -- one
  // without it is dropped silently, never shown as an empty number.
  var factsList = Array.isArray(CONFIG.facts)
    ? CONFIG.facts.filter(function (f) { return f && f.value != null && String(f.value).trim() !== ""; }).slice(0, 3)
    : [];
  var sideItemEls = [sideSloganAEl, sideSloganBEl, sideSloganCEl];
  if (factsList.length) {
    sideSlogansEl.setAttribute("data-mode", "facts");
    sideItemEls.forEach(function (el, i) {
      var f = factsList[i];
      if (!f) { el.hidden = true; el.textContent = ""; return; }
      el.hidden = false;
      el.textContent = "";
      var valueEl = document.createElement("span");
      valueEl.className = "side-slogans__fact-value";
      valueEl.textContent = String(f.value);
      el.appendChild(valueEl);
      if (f.label != null && String(f.label).trim() !== "") {
        var labelEl = document.createElement("span");
        labelEl.className = "side-slogans__fact-label";
        labelEl.textContent = f.label;
        el.appendChild(labelEl);
      }
    });
  } else {
    sideSlogansEl.setAttribute("data-mode", "slogans");
    var slogans = (CONFIG.sideSlogans || []).slice(0, 2);
    sideSloganAEl.textContent = buildSideSloganLines(slogans[0]);
    sideSloganBEl.textContent = buildSideSloganLines(slogans[1]);
    sideSloganAEl.hidden = !slogans[0];
    sideSloganBEl.hidden = !slogans[1];
    sideSloganCEl.hidden = true;
    sideSloganCEl.textContent = "";
  }

  // 2026-09-22 (craft pass, point A.1): the SAME facts/slogans content, built once as a compact
  // single-line row under the CTA -- shown instead of the right-hand column (#sideSlogans) only
  // when layoutSpill() (below) finds no room for the column even after shrinking the pole to its
  // floor width. A real business fact must stay visible on every desktop width, never just
  // silently dropped for lack of space.
  (function buildFactsInlineContent() {
    factsInlineEl.textContent = "";
    var items = factsList.length
      ? factsList.map(function (f) { return { value: String(f.value), label: (f.label != null && String(f.label).trim() !== "") ? String(f.label) : "" }; })
      : (CONFIG.sideSlogans || []).slice(0, 2).filter(Boolean).map(function (s) { return { value: null, label: String(s) }; });
    items.forEach(function (it) {
      var chip = document.createElement("span");
      chip.className = "facts-inline__item";
      if (it.value != null) {
        var v = document.createElement("b");
        v.className = "facts-inline__value";
        v.textContent = it.value;
        chip.appendChild(v);
        if (it.label) {
          var l = document.createElement("span");
          l.className = "facts-inline__label";
          l.textContent = " " + it.label;
          chip.appendChild(l);
        }
      } else {
        chip.textContent = it.label;
      }
      factsInlineEl.appendChild(chip);
    });
    factsInlineEl.setAttribute("data-has-content", items.length ? "1" : "0");
  })();

  // 2026-09-22: relocated out of the right-hand side-slogans/facts column (was a vertical
  // writing-mode link + an on-screen "Демо-данные" label there) into .phone-line, a plain
  // horizontal secondary line under the CTA/status row. The demo flag is kept as a data
  // attribute only now (per this section's brief -- "не на экране"), never rendered as text.
  if (CONFIG.phone && CONFIG.phone.display) {
    phoneLineLinkEl.href = CONFIG.phone.href || "#";
    phoneLineLinkEl.textContent = CONFIG.phone.display;
    phoneLineEl.hidden = false;
  } else {
    phoneLineEl.hidden = true;
  }
  phoneLineEl.setAttribute("data-demo", CONFIG.demo ? "1" : "0");

  // Reveal (or keep hidden) the hours status line *before* any layout/measure pass runs --
  // otherwise measureAndLayout() sizes the stacked pole zone against a shorter lane (status
  // line still `hidden` from its HTML default) and boot()'s later updateStatusDom() call grows
  // the lane after the fact, overlapping the vertical outline sign underneath the pole zone.
  updateStatusDom();

  /* ============================================================
   * 5. Layout mode + geometry
   * ========================================================== */
  var mqWide = window.matchMedia("(min-width:900px) and (min-aspect-ratio:6/5)");
  var mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  function isReducedMotion() { return FORCE_REDUCE_MOTION || mqReduce.matches; }
  function layoutMode() { return mqWide.matches ? "wide" : "stacked"; }

  var GEOM = {}; // recomputed by measureAndLayout()

  function syncHHVar() {
    var h = heroEl.getBoundingClientRect().height;
    document.documentElement.style.setProperty("--hh", h + "px");
    return h;
  }

  /* ---- text measurement helpers (canvas, no layout reads in hot path) ---- */
  // Must mirror --display-tracking in assets/css/hero.css. 2026-09-22 v2: 0 (no extra
  // tracking) -- the legible instance (XTRA:468, ratio 4.312) was chosen and measured
  // at 0em specifically to keep counters open; negative tracking is not applied on top
  // of it (see the CSS comment for the full rationale). Left as a named constant (not
  // inlined) so the still-supported letterSpacing-aware code path below keeps working
  // unchanged if a future adaptation's CSS ever sets --display-tracking to a non-zero
  // value again.
  var DISPLAY_LETTER_SPACING_EM = 0;
  function emWidthDisplay(text) {
    ctx2d.font = "700 200px \"Hero Display\"";
    if ("letterSpacing" in ctx2d) ctx2d.letterSpacing = (DISPLAY_LETTER_SPACING_EM * 200).toFixed(2) + "px";
    var w = ctx2d.measureText(text).width;
    if (!("letterSpacing" in ctx2d) && text.length > 1) {
      // Fallback for a canvas 2D context without letterSpacing support (older engine):
      // approximate the same tracking by adding it once per inter-glyph gap.
      w += DISPLAY_LETTER_SPACING_EM * 200 * (text.length - 1);
    }
    return w / 200;
  }

  /* ---- fitSign: outline placard (wide) or vertical sign (stacked) ---- */
  // 0.125 (was 0.152 under Oswald) -- recalibrated 2026-09-22 against the pixel-measured
  // outline-sign height in references/approved-hero-direction-2026-09-21.png (~25% of hh for
  // the two-line block at line-height:1) so the sign no longer starves the title's own vertical
  // budget in fitTitleWide() below -- see that function's T formula.
  var FS_SIGN_MIN_WIDE = 28, FS_SIGN_CAP_WIDE = 0.125;
  var FS_SIGN_MIN_STACKED = 22, FS_SIGN_CAP_STACKED = 64;

  /* Real per-visual-line width of the outline placard's text node, via Range.getClientRects().
     The placard is one <p> whose lines are joined by "\n" (white-space:pre-line) -- when one
     joined line is even ~1px wider than the analytic canvas estimate below, it silently
     soft-wraps at its own space into an *extra* visual line, while the outer element's
     scrollWidth stays <= laneW throughout (the newly-wrapped fragments are each individually
     narrower than laneW). That defeats a plain "el.scrollWidth > laneW" check, so this measures
     actual rendered lines instead: fragments sharing the same `top` (a bare "\n" itself
     measures as a zero-width rect) are merged into one row per line that Chrome really drew. */
  function outlineSignVisualRows() {
    var tn = outlineSignEl.firstChild;
    if (!tn) return [];
    var range = document.createRange();
    range.selectNodeContents(tn);
    var raw = range.getClientRects();
    var rows = [];
    for (var i = 0; i < raw.length; i++) {
      var r = raw[i];
      if (r.width <= 0) continue;
      var last = rows[rows.length - 1];
      if (last && Math.abs(last.top - r.top) < 0.5) {
        last.right = Math.max(last.right, r.left + r.width);
      } else {
        rows.push({ top: r.top, left: r.left, right: r.left + r.width });
      }
    }
    return rows;
  }

  function fitSignWide(hhPx, laneWpx) {
    var line1 = (CONFIG.outlineLabel || "Barbershop").toLocaleUpperCase("ru");
    var line2 = (CONFIG.cityIn || "").toLocaleUpperCase("ru");
    var lines = [line1, line2];
    var maxEm = Math.max.apply(null, lines.map(emWidthDisplay));
    var fs = Math.floor(Math.min(laneWpx / maxEm, FS_SIGN_CAP_WIDE * hhPx));
    if (fs < FS_SIGN_MIN_WIDE) {
      fs = FS_SIGN_MIN_WIDE;
      // still doesn't fit at the floor -> allow splitting the city line at the last space/hyphen
      if (maxEm * fs > laneWpx + 0.5) {
        var splitAt = Math.max(line2.lastIndexOf(" "), line2.lastIndexOf("-"));
        if (splitAt > 0) {
          var head = line2.slice(0, splitAt + 1).trim();
          var tail = line2.slice(splitAt + 1).trim();
          if (tail && head.length > 0 && head.length < 4) {
            // A lone short token (e.g. the "В" preposition) reads as a rendering bug sitting
            // alone on its own line -- glue it to line 1 instead ("BARBERSHOP В" /
            // "ЕКАТЕРИНБУРГЕ"), keeping the approved reference's 2-line composition for this
            // copy shape instead of a 3-line orphan.
            lines = [(line1 + " " + head).trim(), tail];
          } else {
            lines = [line1, head, tail];
          }
          maxEm = Math.max.apply(null, lines.map(emWidthDisplay));
          fs = Math.max(FS_SIGN_MIN_WIDE, Math.floor(Math.min(laneWpx / maxEm, FS_SIGN_CAP_WIDE * hhPx)));
        }
      }
    }
    outlineSignEl.textContent = lines.join("\n");
    outlineSignEl.style.setProperty("--sign-fs", fs + "px");

    // The canvas em-width estimate above is a close but not exact match for Chrome's own
    // text-layout metrics of this display font (the same gap attemptTitleFitWide() already
    // guards against for the title) -- re-verify against the live DOM and nudge the font down
    // until every intended line both stays inside laneW *and* hasn't silently soft-wrapped into
    // an extra line, instead of trusting the analytic estimate alone.
    var rows = outlineSignVisualRows();
    var guardIter = 0;
    function overflowing() {
      if (rows.length > lines.length) return true; // an intended line quietly wrapped into two
      for (var i = 0; i < rows.length; i++) { if (rows[i].right - rows[i].left > laneWpx + 0.5) return true; }
      return false;
    }
    while (fs > FS_SIGN_MIN_WIDE && overflowing() && guardIter < 200) {
      fs -= 1;
      outlineSignEl.style.setProperty("--sign-fs", fs + "px");
      rows = outlineSignVisualRows();
      guardIter++;
    }
    return { fs: fs, lines: lines.length };
  }

  function fitSignStacked(zoneHpx) {
    var line1 = (CONFIG.outlineLabel || "Barbershop").toLocaleUpperCase("ru");
    var line2 = (CONFIG.cityIn || "").toLocaleUpperCase("ru");
    var lines = [line1, line2];
    var maxEm = Math.max.apply(null, lines.map(emWidthDisplay));
    var lengthAvail = Math.max(60, zoneHpx - 32);
    var fs = Math.max(FS_SIGN_MIN_STACKED, Math.floor(Math.min(lengthAvail / maxEm, FS_SIGN_CAP_STACKED)));
    stackedSignEl.textContent = lines.join("\n");
    stackedSignEl.style.setProperty("--stacked-sign-fs", fs + "px");
    return { fs: fs, lines: lines.length };
  }

  /* ---- fitTitle ---- */
  var LH = 0.98;

  function buildTitleLineCandidates(text) {
    if (CONFIG.nameLines && CONFIG.nameLines.length) return [CONFIG.nameLines.slice()];
    var words = text.split(/\s+/).filter(Boolean);
    var candidates = [[words.join(" ")]];
    for (var i = 1; i < words.length; i++) {
      candidates.push([words.slice(0, i).join(" "), words.slice(i).join(" ")]);
    }
    return candidates;
  }

  function renderTitleLines(lines, fsPx) {
    titleEl.innerHTML = "";
    lines.forEach(function (line) {
      var span = document.createElement("span");
      span.className = "title__line";
      span.setAttribute("data-text", line);
      span.textContent = line;
      titleEl.appendChild(span);
    });
    titleEl.style.setProperty("--title-fs", fsPx + "px");
  }

  // Each .title__line is display:block + white-space:nowrap inside an inline-block parent
  // capped by max-width:100% -- when the nowrap text wants to be wider than that cap, the BOX
  // itself stays clamped (getBoundingClientRect().width silently reports the clamped box, not
  // the true text extent) while the glyphs visually overflow past it. scrollWidth is what
  // actually grows to the unclamped content width in Chrome, so that is the correct measure
  // for both the overflow guard and the reference-recommended "title.scrollWidth <= laneW"
  // acceptance check in BUILD_SPEC.md section 8.5.
  function titleMaxLineWidth() {
    var lines = titleEl.querySelectorAll(".title__line");
    var max = 0;
    for (var i = 0; i < lines.length; i++) max = Math.max(max, lines[i].scrollWidth);
    return max;
  }

  // Renders one candidate at its computed size, then decrements to HARD_FLOOR while it still
  // overflows either the lane width or the pole gutter. Returns the outcome so the caller can
  // fall back to the other 1-line/2-line candidate if this one still doesn't fit at the floor
  // (an adversarial long name at a short viewport can make the "preferred" candidate from the
  // BUILD_SPEC 4.5 formula lose out to the floor clamp; trying the alternate before declaring
  // "fail" keeps the hero visually intact instead of just reporting a broken state).
  function attemptTitleFitWide(rec, fs, HARD_FLOOR, laneW, bodyLeft, gutter) {
    fs = Math.max(fs, HARD_FLOOR);
    renderTitleLines(rec.lines, fs);
    titleEl.setAttribute("data-ready", "1");
    var titleRect = titleEl.getBoundingClientRect();
    var maxLineW = titleMaxLineWidth();
    var guardIter = 0;
    while (fs > HARD_FLOOR && (maxLineW > laneW + 0.5 || titleRect.left + maxLineW > bodyLeft - gutter) && guardIter < 200) {
      fs -= 1;
      titleEl.style.setProperty("--title-fs", fs + "px");
      titleRect = titleEl.getBoundingClientRect();
      maxLineW = titleMaxLineWidth();
      guardIter++;
    }
    var overflowPx = Math.max(maxLineW - laneW, titleRect.left + maxLineW - (bodyLeft - gutter));
    return { fs: fs, overflowPx: overflowPx, fits: overflowPx <= 0.5 };
  }

  function fitTitleWide() {
    var hh = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--hh")) || heroEl.getBoundingClientRect().height;
    var laneRect = laneEl.getBoundingClientRect();
    var heroRect = heroEl.getBoundingClientRect();
    var laneW = laneRect.width;
    var navBottom = navEl.getBoundingClientRect().bottom - heroRect.top;
    var restH = laneRestEl.getBoundingClientRect().height;
    var signH = outlineSignEl.getBoundingClientRect().height;
    // Recalibrated 2026-09-22 against references/approved-hero-direction-2026-09-21.png (pixel-
    // measured there: title cap-height ~140px = ~24.6% of hh at the same 1024x568 frame this
    // reference was captured at). The old (0.044+0.03+0.05)*hh + 0.065*hh = 0.189*hh of "just in
    // case" fixed gaps -- on top of navBottom/restH/signH, which already include every element's
    // own real CSS margins -- left T at ~15% of hh, capping the title at roughly half the
    // reference's cap-height regardless of font. Kept: 0.044*hh (title's own top margin, real
    // CSS, has to be reserved before title's own height is known). Reduced the rest to 0.06*hh,
    // a single "gap before the outline sign" term sized against the reference's own measured
    // ~5.8% gap there (see README.md's 2026-09-22 section for the full pixel measurement and the
    // resulting honest ceiling: for very wide short names like "Chrome Cut" the true limit is now
    // the lane *width* -- laneW / this font's own width:height ratio at max legible compression
    // -- not this vertical budget).
    var T = hh - navBottom - restH - signH - 0.044 * hh - 0.06 * hh;
    T = Math.max(T, 40);

    var FS_MAX = 0.36 * hh, FS_MIN = 56, HARD_FLOOR = 40, TWO_LINE_THRESHOLD = 1.25;
    var text = displayName;
    var candidates = buildTitleLineCandidates(text);
    var best1 = null, best2 = null;
    candidates.forEach(function (cand) {
      var lines = cand.length;
      var ems = cand.map(emWidthDisplay);
      var maxEm = Math.max.apply(null, ems);
      var fs = Math.floor(Math.min(laneW / maxEm, T / (lines * LH), FS_MAX));
      var rec = { lines: cand, fs: fs, ems: ems };
      if (lines === 1) {
        if (!best1 || fs > best1.fs) best1 = rec;
      } else {
        if (!best2 || fs > best2.fs ||
          (fs === best2.fs && Math.abs(ems[0] - ems[1]) < Math.abs(best2.ems[0] - best2.ems[1]))) {
          best2 = rec;
        }
      }
    });
    var chosen = (best2 && best1 && best2.fs >= TWO_LINE_THRESHOLD * best1.fs) ? best2 : (best2 && !best1 ? best2 : best1) || best2;
    var alternate = chosen === best1 ? best2 : best1;

    var fitState = chosen.fs < FS_MIN ? "min" : "ok";

    var poleRect = poleEl.getBoundingClientRect();
    var bodyLeft = poleRect.left + 0.145 * poleRect.width;
    var gutter = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--gutter")) || 40;

    var attempt = attemptTitleFitWide(chosen, chosen.fs, HARD_FLOOR, laneW, bodyLeft, gutter);
    var finalLines = chosen.lines.length;
    if (!attempt.fits && alternate) {
      var altAttempt = attemptTitleFitWide(alternate, alternate.fs, HARD_FLOOR, laneW, bodyLeft, gutter);
      if (altAttempt.fits || altAttempt.overflowPx < attempt.overflowPx) {
        attempt = altAttempt;
        finalLines = alternate.lines.length;
        fitState = alternate.fs < FS_MIN ? "min" : "ok";
      }
    }
    if (!attempt.fits) {
      fitState = "fail";
      console.error("HERO fit fail", CONFIG.name);
    }

    return { fs: attempt.fs, lines: finalLines, state: fitState };
  }

  function fitTitleStacked(capFraction) {
    var hh = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--hh")) || heroEl.getBoundingClientRect().height;
    var laneRect = laneEl.getBoundingClientRect();
    var laneW = laneRect.width;
    var T = capFraction * hh;
    var FS_MAX = 0.17 * hh, FS_MIN = 40, HARD_FLOOR = 28, TWO_LINE_THRESHOLD = 1.25;
    var text = displayName;
    var candidates = buildTitleLineCandidates(text);
    var best1 = null, best2 = null;
    candidates.forEach(function (cand) {
      var lines = cand.length;
      var ems = cand.map(emWidthDisplay);
      var maxEm = Math.max.apply(null, ems);
      var fs = Math.floor(Math.min(laneW / maxEm, T / (lines * LH), FS_MAX));
      var rec = { lines: cand, fs: fs, ems: ems };
      if (lines === 1) { if (!best1 || fs > best1.fs) best1 = rec; }
      else if (!best2 || fs > best2.fs || (fs === best2.fs && Math.abs(ems[0] - ems[1]) < Math.abs(best2.ems[0] - best2.ems[1]))) best2 = rec;
    });
    var chosen = (best2 && best1 && best2.fs >= TWO_LINE_THRESHOLD * best1.fs) ? best2 : (best2 && !best1 ? best2 : best1) || best2;
    var alternate = chosen === best1 ? best2 : best1;

    function attempt(rec, fsStart) {
      var fsv = Math.max(fsStart, HARD_FLOOR);
      renderTitleLines(rec.lines, fsv);
      titleEl.setAttribute("data-ready", "1");
      var maxLineW = titleMaxLineWidth();
      var guardIter = 0;
      while (fsv > HARD_FLOOR && maxLineW > laneW + 0.5 && guardIter < 200) {
        fsv -= 1;
        titleEl.style.setProperty("--title-fs", fsv + "px");
        maxLineW = titleMaxLineWidth();
        guardIter++;
      }
      return { fs: fsv, overflowPx: maxLineW - laneW, fits: maxLineW <= laneW + 0.5 };
    }

    var fitState = chosen.fs < FS_MIN ? "min" : "ok";
    var result = attempt(chosen, chosen.fs);
    var finalLines = chosen.lines.length;
    if (!result.fits && alternate) {
      var altResult = attempt(alternate, alternate.fs);
      if (altResult.fits || altResult.overflowPx < result.overflowPx) {
        result = altResult;
        finalLines = alternate.lines.length;
        fitState = alternate.fs < FS_MIN ? "min" : "ok";
      }
    }
    if (!result.fits) { fitState = "fail"; console.error("HERO fit fail", CONFIG.name); }
    return { fs: result.fs, lines: finalLines, state: fitState };
  }

  var lastFit = { titleFs: 0, titleLines: 0, signFs: 0, state: "ok" };

  // 2026-09-22 viewport-sweep regression fix. Root cause (reproduced headless + documented in
  // qa/viewport-sweep/README.md): layoutStacked() (the other branch measureAndLayout() can call)
  // writes inline poleEl.style.height/left/right and can set ledeEl.hidden=true -- state that
  // used to survive forever once mqWide flipped back to "wide", because layoutWide() never reset
  // it. A resize/drag that passes through even one stacked-mode frame (any width<900px, OR
  // width>=900px at an aspect-ratio<6/5 -- trivially easy while dragging a window narrower/
  // shorter before settling wide again) left the pole collapsed toward whatever the last stacked
  // pass had computed (as small as 0 -- see layoutStacked()'s `poleW = Math.max(0, freeWidth-8)`
  // clamp) and the lede permanently hidden, even though CSS itself (`.pole{left:70.2%;
  // height:100%}`) and lastFit both looked completely normal afterward. `applyResetGuard()` below
  // clears exactly the three inline props layoutStacked() is the only writer of, and force-shows
  // the lede, unconditionally, on every single layoutWide() pass (not just once) -- cheap (3
  // style clears + 1 boolean) and makes wide-mode geometry deterministic: purely a function of
  // the current viewport, never of layout-mode history.
  function resetStackedLeftovers() {
    poleEl.style.height = "";
    poleEl.style.left = "";
    poleEl.style.right = "";
    poleEl.style.top = "";
    if (hasLede) ledeEl.hidden = false; // wide layout must never hide the lede (task, 2026-09-22)
  }

  // 2026-09-22: minimum pole footprint guard, independent of the leftover-state bug above (this
  // fires even on a page that boots straight into "wide" and never once visits "stacked"). The
  // pole's *normal* sizing is still `.pole`'s own CSS alone (aspect-ratio 428/714, height:100%,
  // no inline width/height at all -- resetStackedLeftovers() above guarantees that's really what
  // is in effect before this runs) and stays completely untouched here for the large majority of
  // real desktop viewports. It only stops covering POLE_MIN_WIDTH_FRAC of the viewport's own
  // width at unusually short+wide aspect ratios (viewport width:height beyond roughly 1.6:1 --
  // see qa/viewport-sweep/README.md's derivation from the fixed 428:714 crop) -- the coordinator-
  // reported 1294x814 case sits right at that edge (natural width there is ~37.7% of 1294, just
  // under a 38% target). In that case only, this grows the pole's *height* (never its aspect
  // ratio -- the footage itself is never stretched/squished, only the box it's shown in) past
  // 100% of the hero box; the extra height spills past `.hero`'s own bottom edge and
  // `.hero{overflow:hidden}` (hero.css) crops that excess (losing a sliver of the base mount, the
  // least distinctive part of the shot) rather than the pole simply reading as too small. Capped
  // at POLE_MAX_HEIGHT_FRAC so a still-more-extreme aspect ratio than anything in
  // qa/viewport-sweep/sweep.mjs's grid (1100-1728 x 650-1000, whose worst cell -- 1728x650 --
  // needs ~1.33x, see sweep-before.json) degrades to a smaller-than-target-but-honest width
  // instead of cropping away most of the pole.
  var POLE_MIN_WIDTH_FRAC = 0.30, POLE_MAX_HEIGHT_FRAC = 1.6;
  var POLE_ASPECT = 428 / 714;
  // 2026-09-23: fraction of .pole's box where its horizontal mask (hero.css --pole-mask-x) is
  // at most a faint halo (alpha <= ~0.1 outside 11.5%..88.5%) -- layout fit checks use these
  // visible edges instead of the raw box so the column/lane may overlap the invisible margins.
  var POLE_VIS_L = 0.115, POLE_VIS_R = 0.885;
  var POLE_BLEED = 8; // px, must match hero.css .pole --pole-bleed
  function applyPoleMinWidthGuard(hh, heroWidth) {
    var naturalWidth = (hh + 2 * POLE_BLEED) * POLE_ASPECT; // what .pole's own CSS gives by itself (100% + bleed, 2026-09-23)
    var minWidth = POLE_MIN_WIDTH_FRAC * heroWidth;
    if (naturalWidth < minWidth - 0.5) {
      var neededHeight = Math.max(hh + 2 * POLE_BLEED, Math.min(minWidth / POLE_ASPECT, hh * POLE_MAX_HEIGHT_FRAC));
      poleEl.style.height = neededHeight + "px";
    }
    // No explicit height *floor* enforcement needed: naturalWidth uses hh (100% of hero, already
    // >=70% of the viewport by construction -- .hero{height:100svh}) and the branch above can
    // only ever grow height further, never shrink it below that 100% baseline.
  }

  function layoutWide() {
    heroEl.setAttribute("data-layout", "wide");
    var hh = syncHHVar();
    resetStackedLeftovers();
    applyPoleMinWidthGuard(hh, heroEl.getBoundingClientRect().width);
    var laneW = laneEl.getBoundingClientRect().width;

    // 2026-09-23: layoutSpill() (pole shift/shrink for the facts column) now runs BEFORE the
    // title fit -- fitTitleWide() measures the pole's live rect, and running it first made it
    // see the previous pass's --pole-shift-x and squeeze the title (1440x900: CHROME CUT fell to
    // a small two-line block). The pole's final spot depends only on the lane BOX, not the title.
    layoutSpill();
    var signFit = fitSignWide(hh, laneW);
    var titleFit = fitTitleWide();
    lastFit = { titleFs: titleFit.fs, titleLines: titleFit.lines, signFs: signFit.fs, state: titleFit.state };
    enforceLaneSignGap();
  }

  // 2026-09-22 (craft pass, point A.2): fitSignWide()/fitTitleWide() above each fit their OWN
  // element against a vertical-budget formula independently -- at short hero heights the two
  // can still collide by a few real px even though each individually "fit" its own budget (the
  // outline sign's `bottom: 6.5%` position is pure CSS, never coupled to the lane's actual
  // measured bottom edge). This is a real post-layout measurement + shrink pass, not another
  // formula: read the ACTUAL rendered gap between the lane's own bottom (its last visible row --
  // CTA/status/phone/facts) and the outline sign's own top, and if it's under the minimum, first
  // shrink the sign (bottom-anchored -- a smaller font makes its own box shorter, which moves
  // its TOP further down, directly growing the gap) down to its existing floor, then -- only if
  // that alone still isn't enough -- shrink the title (top-anchored, in-flow -- a smaller font
  // shortens `.lane`'s own auto height, which moves ITS bottom edge up) down to its own existing
  // hard floor. Both floors match the constants fitSignWide()/fitTitleWide() already use, so this
  // never asks for anything smaller than those functions would already accept on their own.
  function enforceLaneSignGap() {
    var MIN_GAP = 24, GUARD_MAX = 240, TITLE_FLOOR = 40;
    function gap() { return outlineSignEl.getBoundingClientRect().top - laneEl.getBoundingClientRect().bottom; }
    var guard = 0;
    while (gap() < MIN_GAP && guard < GUARD_MAX) {
      var signFs = parseFloat(getComputedStyle(outlineSignEl).getPropertyValue("--sign-fs")) || FS_SIGN_MIN_WIDE;
      if (signFs <= FS_SIGN_MIN_WIDE) break;
      outlineSignEl.style.setProperty("--sign-fs", (signFs - 1) + "px");
      guard++;
    }
    guard = 0;
    while (gap() < MIN_GAP && guard < GUARD_MAX) {
      var titleFs = parseFloat(getComputedStyle(titleEl).getPropertyValue("--title-fs")) || TITLE_FLOOR;
      if (titleFs <= TITLE_FLOOR) break;
      titleEl.style.setProperty("--title-fs", (titleFs - 1) + "px");
      guard++;
    }
  }

  function layoutStacked() {
    heroEl.setAttribute("data-layout", "stacked");
    var hh = syncHHVar();

    ledeEl.hidden = !hasLede;
    fitTitleStacked(0.26);
    var laneRectH = laneEl.getBoundingClientRect().height;
    var zoneH = hh - laneRectH;

    if (zoneH < 0.40 * hh && hasLede) {
      ledeEl.hidden = true;
      laneRectH = laneEl.getBoundingClientRect().height;
      zoneH = hh - laneRectH;
    }
    var titleFit;
    if (zoneH < 0.40 * hh) {
      titleFit = fitTitleStacked(0.20);
      laneRectH = laneEl.getBoundingClientRect().height;
      zoneH = hh - laneRectH;
    } else {
      titleFit = { fs: parseFloat(getComputedStyle(titleEl).getPropertyValue("--title-fs")) || 0, lines: titleEl.children.length, state: "ok" };
    }
    zoneH = Math.max(zoneH, 140);
    poleEl.style.height = zoneH + "px";

    var signFit = fitSignStacked(zoneH);
    lastFit = { titleFs: titleFit.fs, titleLines: titleFit.lines, signFs: signFit.fs, state: titleFit.state };

    // center the pole body in the free width right of the vertical sign
    var heroRect = heroEl.getBoundingClientRect();
    var signRect = stackedSignEl.getBoundingClientRect();
    var poleW = zoneH * (428 / 714);
    var freeLeft = (signRect.width ? signRect.right : heroRect.left + 16) + 16;
    var freeWidth = heroRect.right - freeLeft;
    // A short/single-line name (or hours hidden via ?hours=none) leaves a tall title-driven
    // zoneH next to a still-wide vertical sign column: poleW derived purely from zoneH*aspect
    // can then exceed freeWidth, and centering it with only a floor on `right` (below) used to
    // silently slide the pole left, under the sign text (BLOCKER: visible overlap on mobile).
    // Clamp the pole to the space actually left of the sign *before* centering it -- this can
    // only make the pole shorter/narrower than the title-driven zoneH, never push it under the
    // sign. (The vertical sign keeps the zoneH-sized font from fitSignStacked() above; on this
    // rare clamp path it reads a little more generous than the now-shorter pole, which is a
    // safe trade-off since it can no longer overlap it.)
    if (poleW > freeWidth - 8) {
      poleW = Math.max(0, freeWidth - 8);
      zoneH = poleW * (714 / 428);
      poleEl.style.height = zoneH + "px";
    }
    var poleLeft = freeLeft + Math.max(0, (freeWidth - poleW) / 2);
    var rightPx = heroRect.right - (poleLeft + poleW);
    poleEl.style.right = Math.max(8, rightPx) + "px";
    poleEl.style.left = "auto";

    layoutSpill();
  }

  function layoutSpill() {
    // 2026-09-22 (quick fix, point 1 -- found while verifying): a stale --pole-shift-x written
    // by a PREVIOUS call could still be applied when THIS call takes its first measurement below
    // (resetStackedLeftovers() only clears height/left/right/top, never this), silently making
    // the pole look further left/more room-having than it truly is at this pass's own shrunk
    // width -- the wide-branch's own end-of-pass "else" write (shift=0px, "already fits") would
    // then remove the very shift the fit check had implicitly benefited from, leaving the real
    // rendered result too tight. Zero it FIRST, before any measurement, so every pass starts from
    // the same clean (unshifted) baseline.
    poleEl.style.setProperty("--pole-shift-x", "0px");
    var heroRect = heroEl.getBoundingClientRect();
    var poleRect = poleEl.getBoundingClientRect();
    var sx = poleRect.left - heroRect.left, sy = poleRect.top - heroRect.top;
    var sw = poleRect.width, sh = poleRect.height;
    GEOM.pole = { x: sx, y: sy, w: sw, h: sh };

    if (layoutMode() === "wide") {
      // 2026-09-22 (page-build pass): the facts/side-slogans column prefers to sit flush at the
      // SAME inset from the hero's right edge as .nav uses on the left (--pad-x, ~80px @ 1440).
      // It can never sit left of (poleRight + gap) though -- Math.max of the two candidate left
      // edges always keeps whichever is further right, guaranteeing no overlap with the pole
      // regardless of viewport.
      // 2026-09-22 (quick fix, point 1 -- found while verifying): `--pad-x` is an UNREGISTERED
      // custom property whose value is `clamp(24px, 5.6vw, 108px)` -- per spec, unregistered
      // custom properties never get their own "used value" computed; getComputedStyle(...)
      // .getPropertyValue("--pad-x") returns the literal, unresolved token string ("clamp(24px,
      // 5.6vw, 108px)"), and parseFloat() of that returns NaN, silently falling back to 0 -- this
      // has been quietly true since the page-build pass (padXpx was ALWAYS 0, not ~80-108px).
      // `.lane{left:var(--pad-x)}` (hero.css) DOES fully resolve it though, because there the
      // custom property is substituted into a real property (`left`) that the browser computes a
      // genuine used value for -- reading laneEl's own rendered offset gives the true px value.
      var padXpx = Math.max(0, laneEl.getBoundingClientRect().left - heroRect.left);
      var cardW = 132;
      var minGap = 18; // pole<->column breathing room (24 -> 18 on 2026-09-23: measured from the mask's faint 88.5% halo now, not the raw box edge)
      function fitCheck() {
        var naturalLeft = sx + sw * POLE_VIS_R + minGap;
        var insetLeft = heroRect.width - padXpx - cardW;
        var left = Math.max(naturalLeft, insetLeft);
        return { left: left, avail: heroRect.width - padXpx - left };
      }
      // 2026-09-22 (quick fix, point 1): coordinator's explicit rule -- the RIGHT-EDGE COLUMN is
      // the only acceptable rendering at >=1200px width; the inline row under the CTA is only for
      // narrower desktop windows. Below 1200 nothing needs to fit anything (no shrink, no shift),
      // the column just stays hidden and the inline row takes over, same as before.
      var COLUMN_MIN_WIDTH = 1200;
      if (heroRect.width >= COLUMN_MIN_WIDTH) {
        // 2026-09-23 (bottom-crop fix, user report «снизу под столбом обрыв»): the old order here
        // was shrink-first, shift-second. .pole is top-anchored, so every shrink step lifted the
        // footage's bottom crop edge (it cuts through the base mount) off the hero's bottom edge
        // and left it hanging in mid-air -- measured 721/900px at 1440x900, 961/1054px at
        // 1920x1054. New order: (1) the fit is measured against the pole's VISIBLE edges (the
        // mask in hero.css is alpha 0 outside POLE_VIS_L..POLE_VIS_R of the box, so those
        // transparent margins may sit under the column / beside the lane), (2) shift left,
        // (3) shrink ONLY if still short -- and then data-short="1" (set at the end of
        // layoutSpill) makes hero.css fade the base out instead of showing the hard crop edge.
        var minPoleW = POLE_MIN_WIDTH_FRAC * heroRect.width;
        var measurePole = function () {
          poleRect = poleEl.getBoundingClientRect();
          sx = poleRect.left - heroRect.left; sy = poleRect.top - heroRect.top;
          sw = poleRect.width; sh = poleRect.height;
          GEOM.pole = { x: sx, y: sy, w: sw, h: sh };
        };
        var applyColumnShift = function () {
          poleEl.style.setProperty("--pole-shift-x", "0px");
          measurePole();
          var f = fitCheck();
          if (f.avail >= cardW) return f;
          // never let the pole's visible left edge come closer than minGap to the text lane
          var laneRightRel = laneEl.getBoundingClientRect().right - heroRect.left;
          // same rule fitTitleWide() enforces for the title: glass body (0.145 of the box) stays
          // at least --gutter clear of the lane, so shifting never squeezes the title
          var gutterPx = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--gutter")) || 40;
          var maxShift = Math.max(0, sx + sw * 0.145 - (laneRightRel + gutterPx));
          // ceil to the 0.1px the style write keeps -- rounding DOWN here left avail a hair under
          // cardW every time and silently drove the shrink loop below all the way down
          var appliedShift = Math.min(Math.ceil((cardW - f.avail) * 10) / 10, maxShift);
          poleEl.style.setProperty("--pole-shift-x", (-appliedShift).toFixed(1) + "px");
          measurePole();
          return fitCheck();
        };
        var fit = applyColumnShift();
        var shrinkGuard = 0;
        while (fit.avail < cardW - 0.5 && sw > minPoleW + 0.5 && shrinkGuard < 60) {
          var nextH = Math.max(poleRect.height * 0.96, minPoleW / POLE_ASPECT);
          poleEl.style.height = nextH + "px";
          fit = applyColumnShift();
          shrinkGuard++;
        }
        sideSlogansEl.style.left = fit.left + "px";
        sideSlogansEl.setAttribute("data-visible", "1"); // >=1200px: always a column, never collapsed
        if (factsInlineEl.getAttribute("data-has-content") === "1") factsInlineEl.hidden = true;
      } else {
        poleEl.style.setProperty("--pole-shift-x", "0px");
        sideSlogansEl.setAttribute("data-visible", "0");
        if (factsInlineEl.getAttribute("data-has-content") === "1") factsInlineEl.hidden = false;
      }
    } else {
      poleEl.style.setProperty("--pole-shift-x", "0px");
      if (factsInlineEl) factsInlineEl.hidden = true;
    }

    // 2026-09-23 (bottom-crop fix): flag a pole whose footage ends above the hero's bottom edge
    // (only possible after the >=1200px shrink fallback above) so hero.css can fade its base
    // out; .pole normally bleeds var(--pole-bleed) past both hero edges, so a full-height pole
    // never trips this even with the +/-5px pointer parallax applied.
    var poleNow = poleEl.getBoundingClientRect();
    poleEl.setAttribute("data-short", poleNow.bottom < heroRect.bottom - 1 ? "1" : "0");
    var stacked = layoutMode() === "stacked";
    // a-cinema (2026-09-22): peak alphas originally cut roughly in half-to-third vs the
    // pre-variant values (were 0.38/0.30/0.30/0.26) alongside switching the color itself from the
    // pole's own saturated --pole-red/--pole-blue to the desaturated --glow-red/--glow-blue
    // tokens (:root, hero.css) -- "weaker and less flat" per the brief. rw/rh (footprint)
    // unchanged from the pre-variant shape on purpose: only the color/alpha curve changed, not
    // where the light physically sits.
    // 2026-09-22 (cap brightness fix, later same day): restoring these to the exact pre-variant
    // numbers (0.38/0.30/0.30/0.26) plus SPILL_K back to 0.94 (see that constant's own comment)
    // only closed part of the measured gap against previous-versions/before-a-cinema-2026-09-22
    // -- 92.65%/95.11% of the baseline cap/base luma, short of the required >=97%. SPILL_K was
    // already re-tested well past 0.94 (up to 1.15) with almost no further change: at S.light=1
    // it multiplies straight into spillEl's own CSS opacity, which is Math.min(1, ...)-clamped,
    // so once SPILL_K*light*breath gets close to 1 that outer knob is saturated and stops moving
    // the render at all -- these per-ellipse peak alphas (color-stop strength inside each
    // ellipse's own radial-gradient, see buildGlowStops()) are the only headroom left. Calibrated
    // by direct re-measurement (see the dated README section for the full sweep) to ~1.7x the
    // pre-variant numbers -- the smallest multiplier that cleared 97% on both cap AND base with a
    // small safety margin. Still the SAME desaturated --glow-red/--glow-blue color tokens (the
    // other half of the original "weaker and less flat" brief, hero.css) -- brightness only.
    var ellipses = [
      { id: "r1", cx: 0.16, cy: 0.47, rw: 1.05, rh: 0.34, colorVar: "--glow-red", a: 0.64, stackedOnly: false },
      { id: "b1", cx: 0.14, cy: 0.72, rw: 0.85, rh: 0.26, colorVar: "--glow-blue", a: 0.50, stackedOnly: false, hideStacked: true },
      { id: "r2", cx: 0.84, cy: 0.36, rw: 0.70, rh: 0.28, colorVar: "--glow-red", a: 0.50, stackedOnly: false, hideStacked: true },
      { id: "b2", cx: 0.80, cy: 0.17, rw: 0.75, rh: 0.24, colorVar: "--glow-blue", a: 0.44, stackedOnly: false },
    ];
    ellipses.forEach(function (e) {
      var elId = "spillEllipse_" + e.id;
      var div = document.getElementById(elId);
      if (!div) {
        div = document.createElement("div");
        div.id = elId;
        div.className = "spill__ellipse";
        spillEl.appendChild(div);
      }
      // 2026-09-23 (glow-box fix, user report «от света какой-то квадрат»): the gradient used to
      // be `ellipse at center` = farthest-corner sizing, so it only reached its end at the div's
      // CORNERS -- at the edge midpoints it was still ~3% alpha and every ellipse showed its own
      // bounding rectangle as a straight seam. Now `closest-side` (ends exactly at the div edge)
      // with the div grown by sqrt(2), so the falloff over the same distances is identical and the
      // box edge always sits in fully transparent space.
      var cx = sx + e.cx * sw, cy = sy + e.cy * sh;
      var rw = e.rw * sw * Math.SQRT2, rh = e.rh * sh * Math.SQRT2;
      div.style.left = (cx - rw) + "px";
      div.style.top = (cy - rh) + "px";
      div.style.width = (rw * 2) + "px";
      div.style.height = (rh * 2) + "px";
      div.style.background = "radial-gradient(ellipse closest-side at center, " + buildGlowStops(e.colorVar, e.a) + ")";
      div.style.display = (stacked && e.hideStacked) ? "none" : "block";
    });

    layoutAmbient(sx, sy, sw, sh, heroRect, stacked);
  }

  /* ============================================================
   * 6c. a-cinema variant -- physical-ish glow falloff, wall bounce position, drifting haze,
   * base reflection. Everything here is additive to the pre-variant hero: it never touches
   * S.light/S.framePos/poleMediaEl's own filter math (the pole's own stripe colors), only the
   * ambient layers around it.
   * ========================================================== */

  // Samples of an approximate 1/(1+(t/0.14)^2) inverse-square-ish falloff, t=0..1 across the
  // ellipse's own radius, normalized to 1 at t=0. A plain 2-stop radial-gradient (the
  // pre-variant's `0% -> transparent 70%`) interpolates LINEARLY between those two stops, which
  // reads as a flat-edged "blob" (the "мигалки"/pancake complaint) -- this multi-stop table
  // instead drops fast near the center and trails off slowly, which is what a real point-ish
  // light source spilling onto a nearby wall actually looks like. Precomputed (not derived at
  // runtime) since the curve is fixed; only the peak alpha and t=0..1 physical radius vary
  // per-ellipse (buildGlowStops()'s `peak` argument, ellipses[].rw/rh above).
  var GLOW_FALLOFF_SAMPLES = [
    [0.00, 1.000], [0.05, 0.887], [0.10, 0.662], [0.18, 0.377], [0.28, 0.200],
    [0.40, 0.109], [0.55, 0.061], [0.72, 0.036], [0.84, 0.020], [0.93, 0.007],
  ];
  // 2026-09-23: tail now tapers to 0 by 100% (was 0.024 @90%, 0.019 @100%, then a hard drop to
  // transparent) -- with closest-side sizing the gradient's end is ON screen, so a hard drop
  // there would draw a faint elliptical ring instead of the old rectangle.
  function buildGlowStops(colorVar, peak) {
    var stops = GLOW_FALLOFF_SAMPLES.map(function (s) {
      var pct = Math.max(0, Math.min(100, peak * s[1] * 100));
      return "color-mix(in srgb, var(" + colorVar + ") " + pct.toFixed(1) + "%, transparent) " + (s[0] * 100).toFixed(1) + "%";
    });
    stops.push("transparent 100%"); // hard-clip the box edge so the div's own bounding rect never shows a visible seam
    return stops.join(", ");
  }

  var wallBounceEl = document.getElementById("wallBounce");
  var hazeEl = document.getElementById("haze");
  var hazeCtx = hazeEl.getContext("2d", { alpha: true });
  var reflEl = document.getElementById("poleReflection");
  var reflCtx = reflEl.getContext("2d", { alpha: true });

  var AMBIENT = { hazeW: 0, hazeH: 0, dpr: 1, poleRectPx: null, costSamples: [], costLogged: false };
  var hazeBlobsA = null, hazeBlobsB = null; // built once, on first real hero size
  var HAZE_BLOB_COUNT = 5;
  // "дрейф в разные стороны... ≤ 8 px/с": layer A drifts left-to-right, layer B right-to-left,
  // both well under the 8px/s ceiling (measured against hazeEl's OWN backing-store pixels below,
  // which are DPR-scaled -- the px/s figures here are hero.js's internal drift units, converted
  // to real CSS px/s in makeBlobLayer()'s comment math).
  var HAZE_DRIFT_A_PX_S = 5.5, HAZE_DRIFT_B_PX_S = -4.0;
  var HAZE_DRIFT_Y_PX_S = 0.9;

  function seededRandom(seed) {
    // xorshift32 -- deterministic per reload so haze blob placement doesn't visibly "pop" between
    // resizes/reflows (resizeHazeCanvas() only rebuilds blobs on the FIRST successful size, see
    // below), no Math.random() needed.
    var x = seed || 1;
    return function () {
      x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
      x = x >>> 0;
      return (x % 100000) / 100000;
    };
  }

  // 2026-09-22 (seam-fix integration pass, same day): haze visibility raised ~1.75x via
  // baseAlpha (well inside the requested "1.5-2x" range) plus a smaller ~1.15x radius bump so
  // the blobs read clearly in motion behind/around the pole base, not just as a faint tint.
  // Drift speed (HAZE_DRIFT_A/B_PX_S above) is untouched -- only opacity/size changed, per the
  // brief ("Спилл не усиливать" -- layoutSpill()/buildGlowStops() above are also untouched).
  var HAZE_ALPHA_BOOST = 1.75, HAZE_RADIUS_BOOST = 1.15;

  function makeBlobLayer(seed, count, driftPxS) {
    var rnd = seededRandom(seed);
    var blobs = [];
    for (var i = 0; i < count; i++) {
      blobs.push({
        // normalized 0..1 position within the haze canvas's own CSS box; wraps on overflow
        x: rnd(), y: 0.30 + rnd() * 0.55,
        r: (0.10 + rnd() * 0.16) * HAZE_RADIUS_BOOST, // normalized radius (of min(w,h))
        baseAlpha: (0.030 + rnd() * 0.045) * HAZE_ALPHA_BOOST,
        driftPxS: driftPxS * (0.7 + 0.6 * rnd()),
      });
    }
    return blobs;
  }

  function resizeHazeCanvas() {
    var heroRect = heroEl.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5); // haze is heavily CSS-blurred anyway -- 1.5x is plenty, keeps the backing store (and thus per-frame fill cost) small
    var w = Math.max(1, Math.round(heroRect.width * dpr));
    var h = Math.max(1, Math.round(heroRect.height * dpr));
    if (w === AMBIENT.hazeW && h === AMBIENT.hazeH) return;
    AMBIENT.hazeW = w; AMBIENT.hazeH = h; AMBIENT.dpr = dpr;
    hazeEl.width = w; hazeEl.height = h;
    if (!hazeBlobsA) {
      hazeBlobsA = makeBlobLayer(0x9e3779b1, HAZE_BLOB_COUNT, HAZE_DRIFT_A_PX_S);
      hazeBlobsB = makeBlobLayer(0x85ebca77, HAZE_BLOB_COUNT, HAZE_DRIFT_B_PX_S);
    }
  }

  // Tint each haze blob a little toward the nearer of red/blue the closer it sits to the pole's
  // own horizontal position ("слегка подсвечены спиллом столба"), otherwise a plain graphite/ink
  // tone matching the wall (see paintLayer() below). --glow-red/--glow-blue in hero.css are
  // color-mix() results, and a custom property holding a color-mix() function is NOT resolved
  // into a plain rgb()/color() string by getComputedStyle() (custom properties are
  // "guaranteed-invalid at computed-value time" per the CSS spec -- only nested var()
  // substitution happens, the function itself stays as text) -- reading it back per-frame would
  // hand paintLayer() an unparseable string instead of numbers. These two constants are plain
  // numbers computed with the exact same 60/40 srgb mix the CSS uses (see hero.css :root),
  // mirrored by hand the same way DISPLAY_LETTER_SPACING_EM mirrors --display-tracking above --
  // if --pole-red/--pole-blue or the 60/40 mix ratio in hero.css ever change, update these too.
  var GLOW_RED_RGB = [197, 76, 68];   // = round(mix(rgb(255,52,40), rgb(111,111,111), 40%))
  var GLOW_BLUE_RGB = [62, 92, 191];  // = round(mix(rgb(40,90,255), rgb(94,94,94), 40%))

  /* ============================================================
   * 6d. Chrome tint reflection (2026-09-22) -- the guarded brand accent (chromeTintGuard,
   * section 2 above) subtly reflected in the pole's own chrome shell (cap/base rims only --
   * NEVER the drum's own fixed red/white/blue stripe colors, those are a completely separate
   * bitmap drawn earlier in drawFrame()) and lightly mixed into the wall spill (section 6c
   * above). Gated by CONFIG.features.chromeTint (default true) AND the guard itself; unlike the
   * cursor companion (section 9b) this has no hover:fine gate -- it fades in/out together with
   * the pole's own light exactly like spill/haze/reflection opacity in applyLightFilter().
   * ========================================================== */
  function mixRgbChannels(a, b, tPercent) {
    var t = clamp(tPercent, 0, 100) / 100;
    return [
      Math.round(a[0] * (1 - t) + b[0] * t),
      Math.round(a[1] * (1 - t) + b[1] * t),
      Math.round(a[2] * (1 - t) + b[2] * t),
    ];
  }

  // 2026-09-22 (later same day) -- "make it read clearly" pass: an independent review measured
  // only ~5.5/255 average cap chroma difference between two very different brand accents (blue
  // #2f7df4 vs red #e0342c) at the original 0.14 + soft-light + unmasked combination below --
  // effectively invisible. Raised into the requested 0.28-0.34 band (chrome canvas layer) and
  // ~40% (wall-spill mix), switched the blend mode from "soft-light" to "color" (see drawFrame()
  // below), and added a luma window so the tint only lands on the shell's own MIDTONES -- see
  // ensureChromeTintLayer()'s luma masking just below. Full before/after numbers are in the
  // dated README section.
  var CHROME_TINT_CANVAS_OPACITY = 0.30; // requested 0.28-0.34 band (chrome shell only)
  var CHROME_TINT_CANVAS_FLOOR = 0.03;   // "off" floor -- unchanged, gates with S.light, see applyLightFilter()
  var CHROME_TINT_WALL_PCT = 40;         // requested ~40% accent-into-wall-spill mix (was ~20%)
  var CHROME_TINT_WALL_FLOOR_PCT = 3;    // same off-floor, expressed as a mix percentage -- unchanged

  // Luma window (0-255, computed from the shell's OWN baked shading, i.e. its highlight/shadow
  // detail -- never the tint color itself): only pixels inside this band get tinted at all, with
  // a feathered ramp at each edge instead of a hard step (avoids a visible banding edge on the
  // curved metal). Above CHROME_TINT_LUMA_HIGH the factor is a hard, exact 0 -- the shell's own
  // specular highlights ("блики") always stay pure white, never painted -- and below
  // CHROME_TINT_LUMA_LOW the shell's darkest crevices stay untouched too. This -- not the blend
  // mode alone -- is what keeps the result reading as chrome with a colored reflection instead of
  // accent-colored plastic: only the mid-shaded metal (CHROME_TINT_LUMA_LOW..HIGH) ever changes
  // hue, and the "color" blend mode (drawFrame() below) preserves that metal's own luminosity
  // while it does.
  var CHROME_TINT_LUMA_LOW = 40;
  var CHROME_TINT_LUMA_LOW_FEATHER = 55;   // rise 0->1 across [40, 55]
  var CHROME_TINT_LUMA_HIGH_FEATHER = 185; // fall 1->0 across [185, 200]
  var CHROME_TINT_LUMA_HIGH = 200;         // hard zero at/above this luma -- highlights stay white

  function smoothstep01(edge0, edge1, x) {
    var t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }
  function chromeTintLumaFactor(luma) {
    var rise = smoothstep01(CHROME_TINT_LUMA_LOW, CHROME_TINT_LUMA_LOW_FEATHER, luma);
    var fall = 1 - smoothstep01(CHROME_TINT_LUMA_HIGH_FEATHER, CHROME_TINT_LUMA_HIGH, luma);
    return rise * fall;
  }

  var CHROME_TINT = {
    canvasOpacity: CHROME_TINT_CANVAS_FLOOR,
    scratchSourceShell: null, // identity check -- only rebuild when renderer.shellOverlay itself changed
  };
  var chromeTintScratch = document.createElement("canvas");
  var chromeTintScratchCtx = chromeTintScratch.getContext("2d"); // default alpha:true -- unlike
  // renderer.ctx (created {alpha:false} for the main pole canvas, see loadFrameSet() below), this
  // scratch canvas needs a real alpha channel so the per-pixel mask below can genuinely follow the
  // shell overlay's own alpha (feathered cap/base silhouette) rather than treating the whole
  // backing store as opaque.

  function chromeTintActive() { return chromeTintGuard.enabled && FEATURES.chromeTint; }

  // Builds (and caches) a same-size offscreen bitmap: the shell overlay's own alpha shape
  // (cap/base rims, already feathered at the drum seam -- see tools/retime_loop.py), recolored
  // to the guarded tint -- but ONLY where the shell's own baked luma falls inside the
  // CHROME_TINT_LUMA_* window above (source pixel read back via getImageData, see below), so the
  // tint automatically follows the shell's real silhouette/feathering AND its own highlight and
  // shadow shape, and can never bleed onto the drum's own stripe pixels (a different bitmap
  // entirely, drawn by the clipped drawImage() earlier in drawFrame()). Rebuilt only when
  // renderer.shellOverlay's own identity or the backing size changes (quality/DPR switch, see
  // downgradeQuality()/onDprMqlChange()) -- NOT every frame, since the shell + the guarded tint
  // color are both static between those events, so the getImageData/putImageData pixel loop below
  // costs nothing in the per-tick animation budget.
  function ensureChromeTintLayer() {
    if (!renderer.shellOverlay || !renderer.backingW || !renderer.backingH) return null;
    if (CHROME_TINT.scratchSourceShell === renderer.shellOverlay &&
        chromeTintScratch.width === renderer.backingW && chromeTintScratch.height === renderer.backingH) {
      return chromeTintScratch;
    }
    chromeTintScratch.width = renderer.backingW;
    chromeTintScratch.height = renderer.backingH;
    var sctx = chromeTintScratchCtx;
    sctx.clearRect(0, 0, renderer.backingW, renderer.backingH);
    sctx.globalCompositeOperation = "source-over";
    sctx.drawImage(renderer.shellOverlay, 0, 0, renderer.backingW, renderer.backingH);
    var tint = chromeTintGuard.rgb255 || [0, 0, 0];
    // 2026-09-22 (cap brightness fix): an independent luma measurement found the shell cap/base
    // reading ~11.5%/~6.6% darker than the pre-tint baseline -- traced to the OLD approach below
    // (flatten every tinted pixel to one solid `tint` RGB, then let drawFrame()'s
    // globalCompositeOperation="color" re-light it against the backdrop). Canvas2D "color" is an
    // HSL blend (SetLum): it matches the backdrop's HSL *lightness*, not its perceptual luma
    // (0.299R+0.587G+0.114B, the same weights this whole file already calls "luma" everywhere
    // else -- see chromeTintLumaFactor() just above) -- for a saturated blue accent those two
    // disagree enough that "same HSL lightness" pixels read visibly darker once weighted by the
    // eye's real channel sensitivities (green carries most of luma, blue almost none).
    //
    // Fixed by building, once per layer rebuild (never per animation frame), a 256-bucket
    // "target luma -> recolored rgb" LUT: for each candidate OKLab L, find the largest
    // gamut-safe chroma at the guard's own hue (inner loop, same gamut-reduction as
    // guardChromeTint() itself), convert to sRGB, and record that swatch's OWN 0.299/0.587/0.114
    // luma. That L->luma curve is monotonic increasing across the whole range for every hue this
    // guard can output (verified numerically -- an accent's chroma only ever shrinks, never
    // reverses direction, as L moves away from the sRGB gamut's mid-range), including a natural
    // roll-off to ~0 chroma right at L=0/L=1, i.e. genuine black/white swatches with zero tint --
    // so it can be walked once (monotonic binary search) to invert it into rgbForLuma[t]: the
    // recolored swatch whose OWN luma already equals whatever luma bucket t a source pixel will
    // report. Per pixel below this means: read the pixel's own luma (already computed for the
    // feather factor anyway, no extra cost), look up rgbForLuma[round(luma)] directly -- an O(1)
    // array read, no per-pixel trig/gamut work at all -- and write that swatch in place. Its own
    // luma is, by construction, the same 0.299/0.587/0.114 value the pixel already had, so
    // drawFrame() below can go back to a plain "source-over" alpha blend (no HSL relighting) and
    // the shell's real brightness survives essentially untouched (LUT quantization only, 256
    // buckets over 0-255 luma -- sub-1-luma-unit resolution).
    var guardH = chromeTintGuard.h || 0, guardC = chromeTintGuard.C || 0;
    var LUT_STEPS = 256;
    var lutRgb = new Uint8ClampedArray((LUT_STEPS + 1) * 3);
    var lutLuma = new Float32Array(LUT_STEPS + 1);
    for (var li = 0; li <= LUT_STEPS; li++) {
      var lutL = li / LUT_STEPS;
      var lutC = guardC;
      var lutLin = oklchToLinearRaw(lutL, lutC, guardH);
      var lutIter = 0;
      while (!inGamut(lutLin) && lutC > 0 && lutIter < 64) {
        lutC = Math.max(0, lutC - 0.01);
        lutLin = oklchToLinearRaw(lutL, lutC, guardH);
        lutIter++;
      }
      var lutRgb01 = oklchToRgb01(lutL, lutC, guardH);
      var lr = Math.round(clamp01(lutRgb01[0]) * 255);
      var lg = Math.round(clamp01(lutRgb01[1]) * 255);
      var lb = Math.round(clamp01(lutRgb01[2]) * 255);
      lutRgb[li * 3] = lr; lutRgb[li * 3 + 1] = lg; lutRgb[li * 3 + 2] = lb;
      lutLuma[li] = 0.299 * lr + 0.587 * lg + 0.114 * lb;
    }
    // Invert lutLuma (monotonic increasing in `li`, checked above) into rgbForLuma[0..255]: for
    // each target luma bucket, binary-search the closest `li` and copy its swatch. 255 buckets is
    // small enough that a linear two-pointer sweep (lutLuma is already sorted ascending) is both
    // simpler and cheaper than 256 individual binary searches.
    var rgbForLuma = new Uint8ClampedArray(256 * 3);
    var lutCursor = 0;
    for (var t = 0; t <= 255; t++) {
      while (lutCursor < LUT_STEPS && lutLuma[lutCursor + 1] <= t) lutCursor++;
      // lutCursor now indexes the entry whose own luma is <= t and as close as this LUT gets;
      // lutCursor+1 (if any) is the next entry, which is > t -- pick whichever of the two
      // bracketing entries has luma closer to the exact target `t`.
      var idx = lutCursor;
      if (lutCursor + 1 <= LUT_STEPS && Math.abs(lutLuma[lutCursor + 1] - t) < Math.abs(lutLuma[lutCursor] - t)) idx = lutCursor + 1;
      rgbForLuma[t * 3] = lutRgb[idx * 3];
      rgbForLuma[t * 3 + 1] = lutRgb[idx * 3 + 1];
      rgbForLuma[t * 3 + 2] = lutRgb[idx * 3 + 2];
    }
    try {
      var imgData = sctx.getImageData(0, 0, renderer.backingW, renderer.backingH);
      var data = imgData.data;
      for (var p = 0; p < data.length; p += 4) {
        var a = data[p + 3];
        if (a === 0) continue; // already outside the shell's own silhouette -- leave fully transparent
        var r0 = data[p], g0 = data[p + 1], b0 = data[p + 2];
        var luma = 0.299 * r0 + 0.587 * g0 + 0.114 * b0;
        var factor = chromeTintLumaFactor(luma);
        var lumaIdx = luma < 0 ? 0 : luma > 255 ? 255 : Math.round(luma);
        data[p] = rgbForLuma[lumaIdx * 3];
        data[p + 1] = rgbForLuma[lumaIdx * 3 + 1];
        data[p + 2] = rgbForLuma[lumaIdx * 3 + 2];
        data[p + 3] = Math.round(a * factor);
      }
      sctx.putImageData(imgData, 0, 0);
    } catch (readErr) {
      // 2026-09-22 (later same day): getImageData() throws SecurityError when this canvas is
      // "not origin-clean" -- and it always will be under the file:// no-server path (see
      // qa.mjs's own file:// smoke-check comment), because renderer.shellOverlay was decoded
      // from a file:// image; that taint carries through createImageBitmap()/drawImage()
      // regardless of timing, so no amount of retrying or reordering avoids it. Fall back to
      // the simple whole-shell "source-in" fill (shell's own alpha silhouette, no luma window,
      // no per-pixel OKLab-L preservation -- can't read pixels at all here) instead of crashing
      // the render loop -- same graceful "http(s) gets the full effect, file:// still works but
      // simpler" pattern already used elsewhere in this project (see e.g.
      // beauty-cinematic-template's own file:// <video src> fallback). 2026-09-22 (cap brightness
      // fix): drawFrame() below no longer uses "color"/HSL relighting for either path, so this
      // flat fallback swatch is now alpha-blended (source-over) directly against the backdrop --
      // milder than the old HSL relight, though still cruder than the per-pixel LUT path above
      // since it cannot follow the shell's own highlight/shadow shape without pixel access.
      sctx.globalCompositeOperation = "source-in";
      sctx.fillStyle = "rgb(" + tint.join(",") + ")";
      sctx.fillRect(0, 0, renderer.backingW, renderer.backingH);
    }
    sctx.globalCompositeOperation = "source-over";
    CHROME_TINT.scratchSourceShell = renderer.shellOverlay;
    return chromeTintScratch;
  }

  function layoutAmbient(sx, sy, sw, sh, heroRect, stacked) {
    // wall bounce patches (CSS custom properties, resolved as % of hero box -- see .wall__bounce)
    var bx = ((sx + sw * 0.62) / heroRect.width) * 100;
    var by = ((sy + sh * 0.52) / heroRect.height) * 100;
    wallBounceEl.style.setProperty("--bounce-x", bx.toFixed(2) + "%");
    wallBounceEl.style.setProperty("--bounce-y", by.toFixed(2) + "%");

    resizeHazeCanvas();

    // reflection: a static (redrawn only here, on layout/resize -- never per animation frame)
    // blurred+flipped crop of the pole's own base, anchored just past the pole's right edge so
    // it bleeds into the wall rather than sitting hidden under the opaque pole graphic (see the
    // long comment on .pole-reflection in hero.css for why there is no true floor plane here).
    AMBIENT.poleRectPx = { sx: sx, sy: sy, sw: sw, sh: sh };
    var reflW = Math.max(1, Math.round(sw * 0.62));
    var reflH = Math.max(1, Math.round(sh * 0.24));
    var reflLeft = sx + sw * 0.58;
    var reflTop = sy + sh * 0.74;
    reflEl.style.left = reflLeft + "px";
    reflEl.style.top = reflTop + "px";
    reflEl.style.width = reflW + "px";
    reflEl.style.height = reflH + "px";
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    reflEl.width = Math.max(1, Math.round(reflW * dpr));
    reflEl.height = Math.max(1, Math.round(reflH * dpr));
    AMBIENT.lastReflGeom = { w: reflW, h: reflH, dpr: dpr }; // for the poster 'load' retry below
    drawReflection(reflW, reflH, dpr);
  }

  // The <link rel=preload as=image> for media/poster-esrgan.webp makes polePosterEl.complete
  // true well before this typically matters, but on a cold/throttled load layoutAmbient() can
  // still run its first pass before the poster has actually decoded -- drawReflection() no-ops
  // in that case (see its own guard), so retry exactly once, from the real decode event, using
  // whatever geometry the most recent layout pass already computed.
  polePosterEl.addEventListener("load", function () {
    if (AMBIENT.lastReflGeom) drawReflection(AMBIENT.lastReflGeom.w, AMBIENT.lastReflGeom.h, AMBIENT.lastReflGeom.dpr);
  });

  // Draws once per layout/resize from the always-present poster <img> (not the live rotating
  // canvas) -- see hero.css's .pole-reflection comment: this element intentionally does not
  // update per animation frame, so it costs nothing in the per-tick haze budget measured below,
  // and it still renders correctly even when prefers-reduced-motion keeps the pole on its
  // static poster the whole time (renderer.frames/poleCanvasEl are never populated in that path).
  function drawReflection(reflW, reflH, dpr) {
    if (!polePosterEl.complete || !polePosterEl.naturalWidth) return; // not decoded yet; boot()/onload path retries via the caller
    var W = reflEl.width, H = reflEl.height;
    reflCtx.clearRect(0, 0, W, H);
    // source crop: the bottom slice of the poster image (its own base/mount), matching the
    // same normalized y-range the visible reflection element represents.
    var iw = polePosterEl.naturalWidth, ih = polePosterEl.naturalHeight;
    var srcY = ih * 0.70, srcH = ih * 0.30;
    reflCtx.drawImage(polePosterEl, 0, srcY, iw, srcH, 0, 0, W, H);
    // bake the "clipped by a gradient" fade directly into the canvas alpha (destination-in) --
    // strongest near the pole-side edge, fading out horizontally into the wall and vertically
    // top/bottom, so no separate CSS mask-image is needed.
    reflCtx.globalCompositeOperation = "destination-in";
    var g = reflCtx.createRadialGradient(W * 0.18, H * 0.45, 0, W * 0.18, H * 0.45, Math.max(W, H) * 0.78);
    g.addColorStop(0, "rgba(0,0,0,0.85)");
    g.addColorStop(0.55, "rgba(0,0,0,0.4)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    reflCtx.fillStyle = g;
    reflCtx.fillRect(0, 0, W, H);
    // 2026-09-23 (glow-box fix): the radial above still left ~0.7 alpha on the LEFT edge and
    // ~0.4-0.6 on the top/bottom edges, so the canvas showed as a faint rectangle. Two more
    // destination-in passes feather every edge to exactly 0 (alpha multiplies per pass).
    var gx = reflCtx.createLinearGradient(0, 0, W, 0);
    gx.addColorStop(0, "rgba(0,0,0,0)"); gx.addColorStop(0.18, "rgba(0,0,0,1)");
    gx.addColorStop(0.8, "rgba(0,0,0,1)"); gx.addColorStop(1, "rgba(0,0,0,0)");
    reflCtx.fillStyle = gx;
    reflCtx.fillRect(0, 0, W, H);
    var gy = reflCtx.createLinearGradient(0, 0, 0, H);
    gy.addColorStop(0, "rgba(0,0,0,0)"); gy.addColorStop(0.28, "rgba(0,0,0,1)");
    gy.addColorStop(0.72, "rgba(0,0,0,1)"); gy.addColorStop(1, "rgba(0,0,0,0)");
    reflCtx.fillStyle = gy;
    reflCtx.fillRect(0, 0, W, H);
    reflCtx.globalCompositeOperation = "source-over";
  }

  // Normalized 0..1 drift offsets, wrap on overflow. X = horizontal (opposite directions per
  // layer, the actual "дрейф в разные стороны" ask); Y = a much smaller vertical wander so the
  // two layers don't look like they're on perfectly parallel horizontal rails.
  var hazePhaseAx = 0, hazePhaseBx = 0, hazePhaseAy = 0, hazePhaseBy = 0;

  // Called from tick() every animation frame while the loop is running (see section 6/7's
  // rAF loop), and once statically from boot()/the reduced-motion path so a still frame always
  // exists even when the main rAF loop never starts. dtMs is the same real-elapsed-time delta
  // tick() already computes; 0 for the one-shot static call.
  function drawHaze(dtMs) {
    if (!hazeBlobsA) return; // resizeHazeCanvas() hasn't run yet (first paint before layout)
    var W = hazeEl.width, H = hazeEl.height, dpr = AMBIENT.dpr || 1;
    if (!W || !H) return;
    var dtS = Math.min(0.25, dtMs / 1000);
    hazePhaseAx = (hazePhaseAx + (HAZE_DRIFT_A_PX_S * dpr * dtS) / W) % 1;
    hazePhaseBx = (hazePhaseBx + (HAZE_DRIFT_B_PX_S * dpr * dtS) / W) % 1;
    hazePhaseAy = (hazePhaseAy + (HAZE_DRIFT_Y_PX_S * dpr * dtS) / H) % 1;
    hazePhaseBy = (hazePhaseBy + (-HAZE_DRIFT_Y_PX_S * dpr * dtS) / H) % 1;
    if (hazePhaseAx < 0) hazePhaseAx += 1;
    if (hazePhaseBx < 0) hazePhaseBx += 1;

    var poleCxNorm = AMBIENT.poleRectPx ? (AMBIENT.poleRectPx.sx + AMBIENT.poleRectPx.sw * 0.5) / (W / dpr) : 0.7;

    hazeCtx.clearRect(0, 0, W, H);
    hazeCtx.globalCompositeOperation = "lighter"; // additive -- overlapping blobs brighten instead of muddying, matches how real light-scattering haze layers
    function paintLayer(blobs, phaseX, phaseY) {
      for (var i = 0; i < blobs.length; i++) {
        var b = blobs[i];
        var nx = (b.x + phaseX) % 1; if (nx < 0) nx += 1;
        // small +/-3% vertical wander around the blob's own resting y, not a full wrap-around drift
        var ny = b.y + Math.sin((phaseY + i * 0.37) * Math.PI * 2) * 0.03;
        var cx = nx * W, cy = ny * H;
        var r = b.r * Math.min(W, H);
        // proximity-to-pole tint: blend graphite-ink toward whichever glow color is horizontally
        // nearer, stronger the closer this blob sits to the pole's own x position
        var dx = Math.abs(nx - poleCxNorm);
        var tintT = Math.max(0, 1 - dx / 0.30);
        var tint = (nx < poleCxNorm ? GLOW_BLUE_RGB : GLOW_RED_RGB);
        var baseR = 150, baseG = 152, baseB = 158; // neutral graphite-ink, matches .wall__base's tone
        var rr = Math.round(baseR + (tint[0] - baseR) * tintT * 0.5);
        var gg = Math.round(baseG + (tint[1] - baseG) * tintT * 0.5);
        var bb = Math.round(baseB + (tint[2] - baseB) * tintT * 0.5);
        var g2 = hazeCtx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g2.addColorStop(0, "rgba(" + rr + "," + gg + "," + bb + "," + b.baseAlpha + ")");
        g2.addColorStop(1, "rgba(" + rr + "," + gg + "," + bb + ",0)");
        hazeCtx.fillStyle = g2;
        hazeCtx.beginPath();
        hazeCtx.arc(cx, cy, r, 0, Math.PI * 2);
        hazeCtx.fill();
        // wrap-draw so a blob crossing the right/left edge doesn't visibly pop back in
        if (cx - r < 0) { hazeCtx.beginPath(); hazeCtx.arc(cx + W, cy, r, 0, Math.PI * 2); hazeCtx.fill(); }
        if (cx + r > W) { hazeCtx.beginPath(); hazeCtx.arc(cx - W, cy, r, 0, Math.PI * 2); hazeCtx.fill(); }
      }
    }
    paintLayer(hazeBlobsA, hazePhaseAx, hazePhaseAy);
    paintLayer(hazeBlobsB, hazePhaseBx, hazePhaseBy);
    hazeCtx.globalCompositeOperation = "source-over";
  }

  // 2026-09-22 fix: fitTitleWide/fitSignWide/layoutWide/layoutSpill (all called synchronously
  // from layoutWide()/layoutStacked() below) call getBoundingClientRect() on #pole and #lane --
  // both of which can carry a live JS-driven pointer-parallax offset (section 9b, PARALLAX_AMP)
  // once the cursor companion is active. These one-shot fit/layout decisions are documented as
  // viewport-only (BUILD_SPEC), so they must not depend on wherever the pointer happened to sit
  // at the exact moment a layout pass (resize, breakpoint change) ran. applyParallaxOffsets() is
  // defined in section 9b below (function declarations hoist, so it's callable here); CR is a
  // `var` that is only actually assigned once section 9b's top-level code runs, but
  // measureAndLayout() itself is never called until start() at the bottom of this file, by which
  // point the whole script (including CR's initialization) has already executed once.
  function measureAndLayout() {
    var parallaxNeutralized = typeof CR !== "undefined" && (CR.parallaxX !== 0 || CR.parallaxY !== 0);
    if (parallaxNeutralized) applyParallaxOffsets(0, 0);
    if (layoutMode() === "wide") layoutWide(); else layoutStacked();
    if (parallaxNeutralized) applyParallaxOffsets(CR.parallaxX, CR.parallaxY);
    if (typeof onLayoutChanged === "function") onLayoutChanged();
  }

  /* ============================================================
   * 6. Renderer -- preloaded frame sequence on <canvas 2d>
   * ========================================================== */
  var FRAME_COUNT = 44;
  var POLE_BASE = (CONFIG.assets && CONFIG.assets.poleBase) || "media/";
  // 2026-09-22: calm, single-direction, whole-frame rotation only (user decision -- no more
  // pointer/touch-driven direction or speed, see section 8). The footage's own native cadence
  // is 24fps (MEDIA_REPORT.json: "44 frames at native 24fps cadence"), so playback steps one
  // whole frame every 1000/24 ms via a real-time accumulator in tick() below -- never a
  // fractional frame, never a blended crossfade between two frames (that sub-frame blend was
  // the actual source of the reported "juddering, especially the glass" complaint: it mixed two
  // different reflection states on the transparent tube every frame the motor's old continuous
  // speed wasn't an exact multiple of the frame step).
  var FPS_NATIVE = 24;
  var FRAME_INTERVAL_MS = 1000 / FPS_NATIVE; // 41.6667ms -- at 60Hz this naturally lands as a
    // 2-3-2-3 rAF-tick pattern between frame changes, at 120Hz as 5, purely from real elapsed
    // time accumulating past the threshold; no per-refresh-rate branching needed.
  var frameAcc = 0; // ms accumulated toward the next whole-frame step; reset to 0 whenever
    // rotation is not active (off/dying) so power-on never "catches up" a debt built up while off.

  var renderer = {
    ready: false,
    set: null, // "native" | "2x"
    backingW: 0,
    backingH: 0,
    frames: [],
    shellOverlay: null,
    ctx: null,
    quality: "high",
    frameDeltas: [],
  };

  // 2026-09-22: quality watchdog hysteresis. Previously quality only ever downgraded
  // high->low (avg frame time >22ms over the last 60-120 samples) and stuck there for the
  // rest of the session, even after a transient load spike passed -- a deliberate "sticky
  // guard, not decorative" choice per README, but coordinator review found it staying on
  // "low" for the whole session after one bad early spike. Recovery is now a SEPARATE,
  // stricter rule (not just "the downgrade condition stopped being true"): while quality is
  // "low", track a rolling real-time (not frame-count) window of samples; only once that
  // window has covered a full continuous 3000ms AND the 95th-percentile frame time within
  // it is <=18ms does quality go back to "high". Both directions share one transition
  // budget (QUALITY_MAX_TRANSITIONS) so a borderline machine can't flap on screen.
  var QUALITY_RECOVER_WINDOW_MS = 3000;
  var QUALITY_RECOVER_P95_MS = 18;
  var QUALITY_MAX_TRANSITIONS = 3;
  var qualityWatchdog = { transitions: 0, recoverSamples: [] };

  // 2026-09-22: quality downgrade no longer touches playback (there is nothing left to touch --
  // no crossfade factor, no cadence knob: whole-frame stepping at the footage's own 24fps is
  // fixed regardless of quality). Instead, a sustained slow average frame time now swaps the
  // *asset set* down to the smaller "native" (428x714) frames instead of the larger Real-ESRGAN
  // "2x" set (media/loop-u44b-2x-esrgan-webp/) -- same cadence, same direction, just cheaper
  // images to decode/draw. Recovery swaps back to whatever pickBackingSize() would naturally
  // pick (2x on a wide/Retina layout) once the same hysteresis rule the downgrade/recovery
  // budget already enforced is satisfied again.
  var FORCED_NATIVE_SET = false;

  function downgradeQuality(avgMs) {
    if (renderer.quality === "low") return;
    if (qualityWatchdog.transitions >= QUALITY_MAX_TRANSITIONS) return;
    renderer.quality = "low";
    qualityWatchdog.transitions++;
    qualityWatchdog.recoverSamples.length = 0; // start the recovery window fresh
    console.info("HERO renderer quality=low (avg frame " + avgMs.toFixed(1) + "ms)");
    if (renderer.set !== "native" && !FORCED_NATIVE_SET) {
      FORCED_NATIVE_SET = true;
      loadFrameSet(); // reload in place; renderer.frames stays valid (old set) until this resolves
    }
  }

  function maybeRecoverQuality(nowMs, dtMs) {
    if (renderer.quality !== "low") return;
    if (qualityWatchdog.transitions >= QUALITY_MAX_TRANSITIONS) return;
    var samples = qualityWatchdog.recoverSamples;
    samples.push({ t: nowMs, dt: dtMs });
    while (samples.length && nowMs - samples[0].t > QUALITY_RECOVER_WINDOW_MS) samples.shift();
    if (samples.length < 2) return;
    var coveredMs = nowMs - samples[0].t;
    if (coveredMs < QUALITY_RECOVER_WINDOW_MS) return; // not yet a full continuous 3s window
    var sorted = samples.map(function (s) { return s.dt; }).slice().sort(function (a, b) { return a - b; });
    var p95Idx = Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1);
    var p95 = sorted[p95Idx];
    if (p95 <= QUALITY_RECOVER_P95_MS) {
      renderer.quality = "high";
      qualityWatchdog.transitions++;
      samples.length = 0;
      console.info("HERO renderer quality=high (recovered, p95 " + p95.toFixed(1) + "ms over " + Math.round(coveredMs) + "ms)");
      if (FORCED_NATIVE_SET) {
        FORCED_NATIVE_SET = false;
        loadFrameSet();
      }
    }
  }

  function pickBackingSize() {
    var stacked = layoutMode() === "stacked";
    var poleCssH = poleEl.getBoundingClientRect().height || 714;
    var cap = stacked ? 800 : 1200;
    if (navigator.connection && navigator.connection.saveData) cap = 714;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var backingH = Math.min(Math.round(poleCssH * dpr), cap);
    backingH = Math.max(backingH, 300);
    var backingW = Math.round(backingH * 428 / 714);
    var set = backingH > 760 ? "2x" : "native";
    if (FORCED_NATIVE_SET) set = "native"; // quality watchdog override; backingH/cadence untouched
    return { backingH: backingH, backingW: backingW, set: set };
  }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.decoding = "async";
      img.onload = function () {
        if (img.decode) {
          img.decode().then(function () { resolve(img); }).catch(function () { resolve(img); });
        } else resolve(img);
      };
      img.onerror = function () { reject(new Error("load failed: " + src)); };
      img.src = src;
    });
  }

  function toBitmap(img, w, h) {
    if (window.createImageBitmap) {
      return createImageBitmap(img, { resizeWidth: w, resizeHeight: h, resizeQuality: "high" }).catch(function () { return img; });
    }
    return Promise.resolve(img);
  }

  var frameLoadFailed = false;

  function loadFrameSet() {
    var picked = pickBackingSize();
    renderer.backingH = picked.backingH;
    renderer.backingW = picked.backingW;
    renderer.set = picked.set;

    // 2026-09-23 (v4 black-frame fix, second cause): assigning canvas.width/height clears the
    // canvas -- to BLACK, because the context is {alpha:false} -- even when the value does not
    // change. The quality watchdog calls loadFrameSet() to swap 2x <-> native frames at the SAME
    // backing size (downgradeQuality()/maybeRecoverQuality()), and nothing redrew until the next
    // 24 fps frame step (or, with the sign OFF and the drum stopped, until the new set finished
    // loading): the pole went black for 1+ frames. The ignition on a bolt click is exactly the kind
    // of load spike that trips the watchdog, so it showed up "on the click" (measured in real time:
    // quality=low/high/low x3 during a screenshot burst, pole-box luma 48 -> 4 -> 56). Now the canvas
    // is only resized when its size really changes, and then repainted at once from the frames
    // already in hand (drawFrame() scales them to the new backing size until the new set is in).
    var sizeChanged = poleCanvasEl.width !== renderer.backingW || poleCanvasEl.height !== renderer.backingH;
    if (sizeChanged) {
      poleCanvasEl.width = renderer.backingW;
      poleCanvasEl.height = renderer.backingH;
    }
    // 2026-09-23 (v4 video check: "on the bolt click the pole is a black rectangle for 1 frame"):
    // no `desynchronized: true` any more. A desynchronized (low-latency) canvas is presented
    // outside the normal compositor path; when #poleMedia's CSS filter changed (none <->
    // brightness()) Chrome re-created the canvas layer and the first composited frame had no
    // canvas content -> the {alpha:false} canvas showed as black. Reproduced in the recorder
    // pipeline (virtual clock + captureScreenshot per frame): 1 of 3 OFF->ON clicks, pole-box luma
    // 38 -> 3.6 -> 45 (qa/page/v4-fixes-check.mjs --only pole-vt).
    if (!renderer.ctx) renderer.ctx = poleCanvasEl.getContext("2d", { alpha: false });
    renderer.ctx.imageSmoothingQuality = "high"; // a resize resets the context state
    if (sizeChanged && renderer.ready) drawFrame();

    // 2026-09-22: the "2x" (wide/Retina) set now points at the Real-ESRGAN-upscaled frames
    // (media/loop-u44b-2x-esrgan-webp/, tools/upscale_frames.sh) instead of the plain
    // Lanczos+unsharp set (media/loop-u44b-2x-webp/, still on disk, no longer loaded at
    // runtime) -- genuinely sharper stripe edges/chrome reflections at cap:1200, see
    // README.md's 2026-09-22 section for the side-by-side crop and seam-continuity numbers.
    // "native" (stacked/low-power/saveData) is unchanged on purpose: it was never the
    // resolution ceiling BUILD_SPEC flagged as a known limitation, and re-deriving it from a
    // separate ESRGAN pass would risk a visible sharpness mismatch against the *already*
    // ESRGAN'd shell overlay for that set if the two pipelines ever drift -- not worth the
    // risk for a path that mostly serves small/low-power screens.
    //
    // 2026-09-22 (later same day): switched "loop-u44-*" -> "loop-u44b-*". The "u44" sets
    // retimed cadence by shifting the WHOLE frame (stripes + the static glass reflection
    // streak together), which made the streak visibly bob up/down a few px as the shift
    // remainder changed frame to frame. "u44b" (tools/fix_glass_bob.py) freezes only that
    // static streak (temporal-median pixels, never shifted) and keeps retime_loop.py's
    // proven-good result everywhere else, so cadence/seam timing here is unchanged -- only
    // the frame source dir changed. shell-overlay-*.webp/poster.* stayed the same files (not
    // "b"): frame 1 has remainderPx=0, so it's identical either way and the shell/feather
    // used for cap/base compositing never changed. See qa/glass-fix/ for before/after proof.
    var setDir = picked.set === "2x" ? "2x-esrgan" : picked.set;
    var dir = POLE_BASE + "loop-u44b-" + setDir + "-webp/";
    var ext = ".webp";
    var prefix = "frame_";
    var urls = [];
    for (var i = 1; i <= FRAME_COUNT; i++) {
      urls.push(dir + prefix + String(i).padStart(3, "0") + ext);
    }
    var overlayUrl = POLE_BASE + "shell-overlay-" + setDir + ".webp";

    var results = new Array(FRAME_COUNT).fill(null);
    var pool = 6;
    var nextIdx = 0;
    var failedAny = false;

    function loadOne(idx) {
      return loadImage(urls[idx])
        .then(function (img) { return toBitmap(img, renderer.backingW, renderer.backingH); })
        .then(function (bmp) { results[idx] = bmp; })
        .catch(function (err) {
          failedAny = true;
          console.warn("HERO frame load failed", idx + 1, err && err.message);
        });
    }

    function worker() {
      if (nextIdx >= FRAME_COUNT) return Promise.resolve();
      var idx = nextIdx++;
      return loadOne(idx).then(worker);
    }

    var workers = [];
    for (var w = 0; w < pool; w++) workers.push(worker());

    return Promise.all(workers).then(function () {
      return loadImage(overlayUrl)
        .then(function (img) { return toBitmap(img, renderer.backingW, renderer.backingH); })
        .then(function (bmp) { renderer.shellOverlay = bmp; })
        .catch(function (err) { failedAny = true; console.warn("HERO shell overlay load failed", err && err.message); });
    }).then(function () {
      if (failedAny || results.indexOf(null) !== -1) {
        frameLoadFailed = true;
        console.warn("HERO: pole animation frames incomplete -- staying on poster; switch keeps working");
        return;
      }
      renderer.frames = results;
      renderer.ready = true;
      drawFrame();
      polePosterEl.setAttribute("data-hidden", "1");
    });
  }

  var CLIP_Y0 = 135 / 714, CLIP_Y1 = 515 / 714;

  // 2026-09-22: whole frames only, no crossfade. S.framePos is always an integer (the
  // accumulator in tick() only ever adds exactly 1) -- draw that single frame at its own
  // baked-in vertical position (0), never blended with its neighbor. This is the actual fix
  // for the reported "juddering, especially the glass" complaint: the old blend mixed two
  // different reflection states on the transparent tube on almost every frame.
  function drawFrame() {
    if (!renderer.ready || !renderer.ctx) return;
    var i0 = ((S.framePos % FRAME_COUNT) + FRAME_COUNT) % FRAME_COUNT;
    var ctx = renderer.ctx;
    var W = renderer.backingW, H = renderer.backingH;
    ctx.save();
    ctx.beginPath();
    var clipY0 = CLIP_Y0 * H, clipY1 = CLIP_Y1 * H;
    ctx.rect(0, clipY0, W, clipY1 - clipY0);
    ctx.clip();
    ctx.globalAlpha = 1;
    var bmp0 = renderer.frames[i0];
    // explicit W x H (2026-09-23): identical to (0, 0) when the frame set matches the backing size,
    // and keeps a just-resized canvas filled while loadFrameSet() decodes the new set
    if (bmp0) ctx.drawImage(bmp0, 0, 0, W, H);
    ctx.restore();
    if (renderer.shellOverlay) {
      ctx.globalAlpha = 1;
      ctx.drawImage(renderer.shellOverlay, 0, 0, W, H);
    }
    // 2026-09-22 (chrome tint, section 6d): brand-accent reflection on the chrome shell only --
    // painted right after the shell itself, before the flashlight punch (which fully repaints
    // the canvas when active anyway).
    // 2026-09-22 (cap brightness fix, later same day): this used to be an HSL "color" blend
    // (globalCompositeOperation="color") -- measured to cut the cap/base's own mean luma ~11.5%/
    // ~6.6% below the pre-tint baseline (Canvas2D "color" matches the backdrop's HSL *lightness*,
    // not its perceptual luma; those disagree enough for a saturated blue accent that "same HSL
    // lightness" pixels read visibly darker once weighted by the eye's real channel sensitivities
    // -- see the dated README section for the measured numbers). ensureChromeTintLayer() now does
    // the color science instead: every pixel in chromeTintLayer is already recolored at *its own*
    // OKLab L (read back from its own baked shading, never altered), only its hue/chroma nudged
    // toward the guarded accent -- so a plain "source-over" alpha blend here is correct on its
    // own; no HSL relighting needed or wanted. The scratch layer's own alpha is already 0 outside
    // the shell's silhouette AND outside its CHROME_TINT_LUMA_* midtone window (see
    // ensureChromeTintLayer()), and ctx.globalAlpha carries the current S.light-driven fade
    // (applyLightFilter()) on top -- so this is a no-op everywhere except the already-feathered,
    // already-luma-masked chrome midtones, at whatever strength the light state allows. The
    // shell's own highlights (luma close to white) always keep alpha 0 here regardless of
    // light/opacity, so they stay white -- and independently, OKLCH chroma naturally shrinks
    // toward 0 as L approaches 0 or 1 (sRGB gamut edge), so even a highlight that slipped past
    // the luma window could never gain more than a sliver of chroma.
    if (chromeTintActive() && CHROME_TINT.canvasOpacity > 0) {
      var chromeTintLayer = ensureChromeTintLayer();
      if (chromeTintLayer) {
        ctx.save();
        ctx.globalAlpha = CHROME_TINT.canvasOpacity;
        ctx.globalCompositeOperation = "source-over";
        ctx.drawImage(chromeTintLayer, 0, 0);
        ctx.restore();
      }
    }
    // 2026-09-22 (cursor companion, section 9b): the pole itself is drawn here always at full
    // ("ON") brightness -- applyLightFilter() below skips its own CSS brightness/saturate dim
    // whenever the flashlight is the thing doing the dimming instead (see that function). The
    // punched-hole darkening for the flashlight is a per-pixel canvas composite, painted last,
    // strictly additive to the frame this function already drew -- it never changes which frame
    // is shown or touches S.framePos/frameAcc (the pole's own rotation/cadence).
    if (typeof paintFlashlightHole === "function" && flashlightActive()) paintFlashlightHole();
  }

  // a-cinema: how far the ambient glow's intensity "breathes" up/down, synced to the drum's own
  // rotation (S.framePos/FRAME_COUNT = one full breath per loop of footage) rather than to wall-
  // clock time -- "чуть дышит синхронно с вращением барабана", amplitude <= 6% per the brief.
  // Deliberately only touches spillEl/hazeEl's own opacity, never poleMediaEl's filter -- the
  // pole's own stripe colors/brightness are untouched by this.
  var BREATH_AMP = 0.05;
  // 2026-09-22 (cap brightness fix, later same day): restored to the pre-variant 0.94 -- an
  // independent luma measurement against previous-versions/before-a-cinema-2026-09-22 found the
  // cap/base chrome crop reading ~11.5%/~6.6% darker than that baseline with SPILL_K=0.85 (see
  // the dated README section), and isolating the chrome-tint layer (section 6d, drawFrame()) via
  // direct A/B against the same baseline showed it made essentially no difference to that number
  // -- the ambient spill glow trim (this constant + the ellipse peak alphas in layoutSpill(),
  // both part of the same earlier "weaker" a-cinema pass) turned out to be the actual driver,
  // most visible right at the cap/base where the b2/r2 and r1/b1 ellipses sit closest. Pushing
  // this constant further past 0.94 (re-tested up to 1.15) barely moved the measured result any
  // more, though: at S.light=1 it feeds straight into spillEl's own CSS opacity, which is
  // Math.min(1, ...)-clamped, so once SPILL_K*light*breath is already close to 1 (it is, at
  // 0.94) this knob is saturated -- the remaining gap to >=97% was closed via the ellipses' own
  // per-shape peak alphas in layoutSpill() instead (see that array's own dated comment for the
  // final numbers). The desaturated --glow-red/--glow-blue color tokens (the "less flat" half of
  // that same original brief) are untouched by either change.
  var SPILL_K = 0.94;

  function applyLightFilter() {
    var light = S.light;
    // 2026-09-22 (cursor companion, section 9b): while the off-state flashlight is actually
    // showing, the CSS brightness/saturate dim below is skipped -- drawFrame()'s own
    // paintFlashlightHole() does the (locally punched) darkening directly on the canvas
    // instead, so the element itself stays at its natural "ON" rendering and the hole can
    // genuinely reveal it. Nothing else in this function (spill/haze/reflection opacity,
    // still driven by S.light) changes -- the flashlight only ever affects the pole graphic
    // and the title fill (separate CSS rule), never the ambient glow layers.
    var flashlightOverride = typeof flashlightActive === "function" && flashlightActive();
    // 2026-09-23 (v4 black-frame fix): never "none". The identity filter keeps #poleMedia on the
    // same filtered compositing layer the whole time -- switching none <-> brightness() re-created
    // the layer (together with the old desynchronized canvas: one black frame on the bolt click).
    var FILTER_IDENTITY = "brightness(1) saturate(1)";
    var filterStr = flashlightOverride ? FILTER_IDENTITY : (light >= 0.999 ? FILTER_IDENTITY : "brightness(" + (0.34 + 0.66 * light).toFixed(3) + ") saturate(" + (0.22 + 0.78 * Math.min(light, 1)).toFixed(3) + ")");
    poleMediaEl.style.filter = filterStr;
    var breath = 1 + BREATH_AMP * Math.sin((S.framePos / FRAME_COUNT) * Math.PI * 2);
    spillEl.style.opacity = String(Math.max(0, Math.min(1, SPILL_K * light * breath)));
    // haze/reflection: real ambient light never fully vanishes with the sign off (it is not the
    // room's only light source), so both keep a small floor ("почти невидима", not literally 0)
    // instead of hard-gating on S.power the way poleMediaEl's filter above does.
    hazeEl.style.opacity = String(Math.max(0, Math.min(1, (0.05 + 0.55 * light) * breath)));
    reflEl.style.opacity = String(Math.max(0, Math.min(1, (0.02 + 0.09 * light))));

    // 2026-09-22 (chrome tint, section 6d): both the canvas overlay's alpha and the wall spill's
    // accent mix percentage are driven by the exact same S.light value as spill/haze/refl above
    // -- "В OFF отражение гаснет вместе со светом" -- down to a near-zero floor (never fully 0,
    // same reasoning as the haze/reflection floors just above: real light doesn't vanish, this
    // is meant to fade to "barely there", not hard-cut).
    if (chromeTintActive()) {
      CHROME_TINT.canvasOpacity = CHROME_TINT_CANVAS_FLOOR + (CHROME_TINT_CANVAS_OPACITY - CHROME_TINT_CANVAS_FLOOR) * light;
      var wallTintPct = CHROME_TINT_WALL_FLOOR_PCT + (CHROME_TINT_WALL_PCT - CHROME_TINT_WALL_FLOOR_PCT) * light;
      var wallTintRed = mixRgbChannels(GLOW_RED_RGB, chromeTintGuard.rgb255, wallTintPct);
      var wallTintBlue = mixRgbChannels(GLOW_BLUE_RGB, chromeTintGuard.rgb255, wallTintPct);
      heroEl.style.setProperty("--wall-tint-red", "rgb(" + wallTintRed.join(" ") + ")");
      heroEl.style.setProperty("--wall-tint-blue", "rgb(" + wallTintBlue.join(" ") + ")");
    } else {
      CHROME_TINT.canvasOpacity = 0;
    }
  }

  /* ============================================================
   * 7. State machine -- power on/off only (no pointer-driven speed/direction)
   * ========================================================== */
  var S = {
    phase: "boot", // boot | on | off | igniting | dying
    power: "on", // logical switch target
    dir: 1, // constant -- the pole always spins the same way; nothing ever changes this
    framePos: 0, // ALWAYS an integer 0..FRAME_COUNT-1 (see tick()'s frame accumulator, section 6)
    light: 0,
    fillOpacity: 0,
    fillWipe: 0,
    igniteStartT: 0,
    igniteVariant: "cold",
    dyingStartT: 0,
    dyingFromLight: 0,
    dyingFromFill: 0,
    autoFollowHours: true,
    boltHintShown: false,
    rafId: 0,
    lastT: 0,
    running: false,
    heroVisible: true,
    tabVisible: true,
  };

  // 2026-09-22 (user decision): the pointer/touch-driven variable-speed motor is gone --
  // rotation now has exactly one active state (spinning at the footage's fixed native cadence,
  // FRAME_INTERVAL_MS, section 6) whenever the sign is logically powered, and 0 otherwise.
  // "igniting"/"boot" both count as powered, so the drum is already turning through the ignite
  // light/fill choreography below, not visibly starting from a stop partway through it.
  //
  // 2026-09-22 (QA fix): gated on !isReducedMotion() too. kick() is called unconditionally from
  // several places that have nothing to do with the reduced-motion boot()/toggle() branches --
  // the IntersectionObserver visibility callback, the visibilitychange listener, and the end of
  // toggle() -- and tick()'s own `needsRaf` reschedule (section 9) is derived straight from this
  // function's return value. Without the reduced-motion check here, any of those unconditional
  // kick() calls (most commonly the IntersectionObserver firing as soon as the hero scrolls into
  // view) would spin up tick()'s rAF loop and keep it rescheduling itself forever while phase
  // stayed "on"/"igniting"/"boot" -- silently stepping S.framePos every frame (and, whenever
  // frames happened to already be decoded, visibly rotating the drum) regardless of
  // prefers-reduced-motion. This is the single choke point tick() reads rotation state through
  // (section 9's `var rotating = isRotating();`), so gating it here freezes both the frame
  // stepper and the reschedule in one place instead of adding scattered checks at every kick()
  // call site.
  function isRotating() {
    return !isReducedMotion() && (S.phase === "boot" || S.phase === "igniting" || S.phase === "on");
  }

  // Matches the light/fill dying fade timing below; once it elapses the phase flips to "off"
  // and rotation (already stopped -- see isRotating()) stays frozen on the current whole frame.
  // (Previously "dying" coasted for as long as the old speed integrator took to decay below a
  // threshold, up to ~1.2s depending on how fast the pointer had been spinning it; that
  // speed-dependent coast no longer exists, so the visible drum stop is now this fixed, short
  // duration -- an intentional simplification, not a bug.)
  var DYING_DURATION_MS = 260;

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function easeOutQuart(t) { return 1 - Math.pow(1 - t, 4); }
  function easeInOutSine(t) { return -(Math.cos(Math.PI * t) - 1) / 2; }
  function linearEase(t) { return t; }

  function sampleTrack(track, tMs) {
    for (var i = 0; i < track.length; i++) {
      var seg = track[i];
      if (tMs < seg.t0) return seg.v0;
      if (tMs <= seg.t1 || i === track.length - 1) {
        var span = seg.t1 - seg.t0;
        var tt = span > 0 ? clamp((tMs - seg.t0) / span, 0, 1) : 1;
        return seg.v0 + (seg.v1 - seg.v0) * seg.ease(tt);
      }
    }
    return track[track.length - 1].v1;
  }

  var igniteLightTrackCold, igniteFillTrack, igniteWipeTrack, igniteLightTrackWarm;

  function buildIgniteTracksCold(fromLight) {
    igniteLightTrackCold = [
      { t0: 0, t1: 70, v0: fromLight, v1: 0.40, ease: linearEase },
      { t0: 70, t1: 130, v0: 0.40, v1: 0.08, ease: linearEase },
      { t0: 130, t1: 180, v0: 0.08, v1: 0.08, ease: linearEase },
      { t0: 180, t1: 420, v0: 0.08, v1: 1.06, ease: easeOutCubic },
      { t0: 420, t1: 600, v0: 1.06, v1: 1.00, ease: easeInOutSine },
    ];
    igniteFillTrack = [{ t0: 180, t1: 300, v0: 0, v1: 1, ease: linearEase }];
    igniteWipeTrack = [{ t0: 180, t1: 560, v0: 0, v1: 1, ease: easeOutQuart }];
  }
  function buildIgniteTrackWarm(fromLight) {
    igniteLightTrackWarm = [{ t0: 0, t1: 260, v0: fromLight, v1: 1.0, ease: easeOutCubic }];
  }

  // Shared by the manual switch (toggle()) and the hours-driven auto-follow
  // (scheduleHoursTick()): prefers-reduced-motion keeps the switch fully working, but per
  // BUILD_SPEC 6.4/13 it must never play the ~950ms ignite/dying choreography (light ramp,
  // fill wipe, spill) -- light/fill jump straight to their settled value, no pre-flash, no
  // overshoot, no flicker.
  function applyReducedMotionSnap() {
    S.phase = S.power === "on" ? "on" : "off";
    S.light = S.power === "on" ? 1 : 0;
    S.fillOpacity = S.power === "on" ? 1 : 0;
    S.fillWipe = S.power === "on" ? 1 : 0;
    applyLightFilter();
    updateTitleFillCss();
  }

  function toggle() {
    if (S.phase === "boot") { S.phase = S.power === "on" ? "on" : "off"; }
    S.autoFollowHours = false;
    if (S.power === "on") {
      S.power = "off";
      if (isReducedMotion()) applyReducedMotionSnap(); else startDying();
    } else {
      S.power = "on";
      if (isReducedMotion()) applyReducedMotionSnap(); else startIgniting();
    }
    updateSwitchDom();
    dismissBoltTip();
    kick();
  }

  function setPowerFromHours(open) {
    S.power = open ? "on" : "off";
  }

  function startIgniting() {
    var warm = S.light > 0.3;
    S.igniteStartT = performance.now();
    S.igniteVariant = warm ? "warm" : "cold";
    if (warm) buildIgniteTrackWarm(S.light); else buildIgniteTracksCold(S.light);
    S.phase = "igniting";
  }
  function startDying() {
    S.dyingStartT = performance.now();
    S.dyingFromLight = S.light;
    S.dyingFromFill = S.fillOpacity;
    S.phase = "dying";
  }

  function updateSwitchDom() {
    var open = S.power === "on";
    poleBoltEl.setAttribute("aria-pressed", open ? "true" : "false");
    poleBoltEl.setAttribute("aria-label", open ? "Вывеска включена. Нажмите, чтобы выключить" : "Вывеска выключена. Нажмите, чтобы включить");
    if (poleBoltTipEl) poleBoltTipEl.textContent = open ? "Выключить вывеску" : "Включить вывеску";
    poleEl.setAttribute("data-power", open ? "on" : "off");
  }

  function updateStatusDom() {
    if (!hoursState.valid) {
      signStatusEl.hidden = true;
      return;
    }
    signStatusEl.hidden = false;
    signStatusEl.setAttribute("data-open", hoursState.isOpen ? "1" : "0");
    signStatusTextEl.textContent = hoursState.text;
  }

  function stepLightFillPhase(nowMs) {
    if (S.phase === "igniting") {
      var elapsed = nowMs - S.igniteStartT;
      if (S.igniteVariant === "cold") {
        S.light = sampleTrack(igniteLightTrackCold, elapsed);
        S.fillOpacity = sampleTrack(igniteFillTrack, elapsed);
        S.fillWipe = sampleTrack(igniteWipeTrack, elapsed);
        if (elapsed >= 600) {
          S.phase = "on";
          S.light = 1; S.fillOpacity = 1; S.fillWipe = 1;
        }
      } else {
        S.light = sampleTrack(igniteLightTrackWarm, elapsed);
        S.fillOpacity = Math.min(1, elapsed / 200);
        S.fillWipe = easeOutQuart(clamp(elapsed / 220, 0, 1));
        if (elapsed >= 260) {
          S.phase = "on";
          S.light = 1; S.fillOpacity = 1; S.fillWipe = 1;
        }
      }
    } else if (S.phase === "dying") {
      var de = nowMs - S.dyingStartT;
      S.light = S.dyingFromLight + (0 - S.dyingFromLight) * easeOutCubic(clamp(de / 240, 0, 1));
      S.fillOpacity = S.dyingFromFill + (0 - S.dyingFromFill) * easeOutCubic(clamp(de / 200, 0, 1));
      if (de >= 200) S.fillWipe = 0;
      if (de >= DYING_DURATION_MS) { S.phase = "off"; updateSwitchDom(); }
    } else if (S.phase === "boot") {
      S.light = S.power === "on" ? 1 : 0;
      S.fillOpacity = S.power === "on" ? 1 : 0;
      S.fillWipe = S.power === "on" ? 1 : 0;
    }
    // "on" and "off" steady phases: light/fill already settled at 1 or 0, no further change here.
  }

  // 2026-09-22: fixed-cadence whole-frame stepper -- replaces the old continuous speed
  // integrator + fractional-frame crossfade entirely (see section 6/8 for why). While powered
  // (isRotating()), real elapsed time accumulates in frameAcc and steps S.framePos forward by
  // exactly 1 whole frame every time it crosses FRAME_INTERVAL_MS -- never a fraction, never
  // more than 1 step per crossing under normal frame timing (60/120Hz rAF ticks are both well
  // under the 41.6667ms frame interval, so at most one boundary is crossed per tick). While not
  // powered, frameAcc is held at 0 so power-on never has to "catch up" a debt built up while off.
  function tick(nowMs) {
    if (!S.lastT) S.lastT = nowMs;
    var dt = Math.min(50, nowMs - S.lastT);
    S.lastT = nowMs;

    stepLightFillPhase(nowMs);

    var rotating = isRotating();
    if (rotating) {
      frameAcc += dt;
      while (frameAcc >= FRAME_INTERVAL_MS) {
        frameAcc -= FRAME_INTERVAL_MS;
        S.framePos = (S.framePos + 1) % FRAME_COUNT;
      }
    } else {
      frameAcc = 0;
    }

    applyLightFilter();
    updateTitleFillCss();
    drawFrame();

    // a-cinema: measured per-frame cost of the new ambient haze draw (reflection is static, see
    // drawReflection()'s own comment -- it is excluded on purpose, it never runs per-tick).
    // Rolling-averaged and exposed via __HERO_QA__.ambientCostMs; logged once via console.info
    // the first time a full window of samples is in, same pattern as the existing quality
    // watchdog's console.info below.
    var ambientT0 = performance.now();
    drawHaze(dt);
    var ambientCost = performance.now() - ambientT0;
    AMBIENT.costSamples.push(ambientCost);
    if (AMBIENT.costSamples.length > 120) AMBIENT.costSamples.shift();
    if (AMBIENT.costSamples.length >= 60 && !AMBIENT.costLogged) {
      AMBIENT.costLogged = true;
      var avgCost = AMBIENT.costSamples.reduce(function (a, b) { return a + b; }, 0) / AMBIENT.costSamples.length;
      console.info("HERO a-cinema haze draw cost avg=" + avgCost.toFixed(3) + "ms/frame over " + AMBIENT.costSamples.length + " samples");
    }

    var dtMs = nowMs - (S.lastFrameForWatchdog || nowMs);
    S.lastFrameForWatchdog = nowMs;
    renderer.frameDeltas.push(dtMs);
    if (renderer.frameDeltas.length > 120) renderer.frameDeltas.shift();
    if (renderer.frameDeltas.length >= 60) {
      var avg = renderer.frameDeltas.reduce(function (a, b) { return a + b; }, 0) / renderer.frameDeltas.length;
      if (avg > 22 && renderer.quality !== "low") downgradeQuality(avg);
    }
    maybeRecoverQuality(nowMs, dtMs);

    var needsRaf = rotating || S.phase === "dying";
    if (needsRaf && S.heroVisible && S.tabVisible) {
      S.rafId = requestAnimationFrame(tick);
    } else {
      S.running = false;
      S.lastT = 0;
    }
  }

  function kick() {
    if (!S.running) {
      S.running = true;
      S.lastT = 0;
      S.rafId = requestAnimationFrame(tick);
    }
  }

  function updateTitleFillCss() {
    titleEl.style.setProperty("--title-fill-opacity", String(S.fillOpacity));
    // Stroke opacity = 1 - fillOpacity (BUILD_SPEC 4.7): as the fill wipes in, the contour
    // fades out so its 3px width never peeks past the solid glyph on flat corners (e.g. "T").
    var strokeAlpha = accentResult.outlineAlpha * (1 - S.fillOpacity);
    titleEl.style.setProperty("--accent-outline", "rgb(" + accentRgbStr + " / " + strokeAlpha.toFixed(3) + ")");
    if (S.fillWipe >= 0.999) {
      titleEl.style.setProperty("--title-clip", "none");
    } else {
      var x = (1 - S.fillWipe) * 100;
      titleEl.style.setProperty("--title-clip", "inset(0 0 0 " + x + "%)");
    }
  }

  /* ============================================================
   * 8. Bolt button (on/off) + hover tip -- the ONLY interaction left
   * ========================================================== */
  // 2026-09-22 (user decision): all pointer/touch direction-and-speed steering removed. The
  // bolt is now a real <button> (#poleBolt, positioned over the photographed bolt at the
  // MEDIA_REPORT.json hotspot via CSS) -- the browser gives it click, Enter/Space activation
  // and Tab focus for free, so there is no manual hit testing, dragging, or velocity tracking
  // left to wire up here. The hover/focus ring is pure CSS (`.pole__bolt:hover`,
  // `:focus-visible`, assets/css/hero.css). Desktop: click. Mobile: tap. No gestures anywhere.
  function dismissBoltTip() {
    poleBoltEl.setAttribute("data-tip-dismissed", "1");
  }

  poleBoltEl.addEventListener("click", function () { toggle(); });

  /* ============================================================
   * 9. Boot sequence, hours refresh loop, reduced motion, resize
   * ========================================================== */
  function initialPowerFromRules() {
    if (FORCED_STATE) return FORCED_STATE;
    if (!hoursState.valid) return "on";
    return hoursState.isOpen ? "on" : "off";
  }

  function boot() {
    S.power = initialPowerFromRules();
    S.phase = "boot";
    updateSwitchDom();
    updateStatusDom();
    if (S.power === "on") { S.light = 1; S.fillOpacity = 1; S.fillWipe = 1; }
    else { S.light = 0; S.fillOpacity = 0; S.fillWipe = 0; }
    applyLightFilter();
    updateTitleFillCss();
    // a-cinema: paint one static haze frame up front -- resizeHazeCanvas() already ran inside
    // the measureAndLayout() call in start() (before boot()), so hazeBlobsA/B already exist.
    // Needed unconditionally (not just in the reduced-motion branch below): a powered-off pole
    // never enters isRotating(), so tick()'s own per-frame drawHaze(dt) call may not run for a
    // while (or ever, if the visitor never toggles it on) -- without this the haze canvas would
    // stay blank despite applyLightFilter() above already having set its CSS opacity.
    drawHaze(0);

    if (isReducedMotion()) {
      S.phase = S.power === "on" ? "on" : "off";
      drawStaticPoster();
      return;
    }

    loadFrameSet().then(onFramesReady);
  }

  // Shared by boot() and the reduced-motion live-toggle handler below. 2026-09-22: no more
  // spin-up ramp -- once the frames are decoded, a powered-on pole is simply already rotating
  // at its one fixed cadence (isRotating() covers "on" directly, no transitional "boot" motor
  // state needed), so this just flips the phase and kicks the loop instead of the old
  // phase="on"-then-back-to-"boot"-for-500ms dance that existed only to drive the removed
  // continuous speed ramp.
  function onFramesReady() {
    if (S.phase !== "boot") return; // user already toggled during load
    if (FORCED_FRAME != null) { S.framePos = FORCED_FRAME % FRAME_COUNT; drawFrame(); return; }
    if (S.power === "on") {
      S.phase = "on";
      kick();
    } else if (!S.boltHintShown) {
      S.boltHintShown = true;
      setTimeout(showBootHintOnce, 1600);
    }
  }

  function drawStaticPoster() {
    // reduced motion: poster stays visible, canvas untouched, filter still applies via applyLightFilter()
  }

  function showBootHintOnce() {
    if (S.power !== "off" || !S.autoFollowHours) return;
    poleBoltEl.setAttribute("data-boot-hint", "1");
    setTimeout(function () { poleBoltEl.removeAttribute("data-boot-hint"); }, 700);
  }

  /* hours: re-check on the next minute boundary, follow only if user hasn't touched the switch */
  function scheduleHoursTick() {
    if (!parsedHours || FORCED_NOW) return; // ?now= freezes the clock, no live re-check needed for QA
    var now = new Date();
    var msToNextMinute = 60000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 1000;
    setTimeout(function () {
      var wasOpen = hoursState.isOpen;
      refreshHoursState();
      updateStatusDom();
      if (S.autoFollowHours && hoursState.valid && hoursState.isOpen !== wasOpen) {
        var shouldBeOn = hoursState.isOpen;
        if ((shouldBeOn && S.power === "off") || (!shouldBeOn && S.power === "on")) {
          S.power = shouldBeOn ? "on" : "off";
          if (isReducedMotion()) applyReducedMotionSnap();
          else if (S.power === "on") startIgniting(); else startDying();
          updateSwitchDom();
          kick();
        }
      }
      scheduleHoursTick();
    }, Math.max(1000, msToNextMinute));
  }

  /* reduced-motion live toggle */
  mqReduce.addEventListener && mqReduce.addEventListener("change", function () {
    if (FORCE_REDUCE_MOTION) return; // query override always wins
    if (isReducedMotion()) {
      S.phase = S.power === "on" ? "on" : "off";
      drawFrame();
    } else if (!renderer.ready && !frameLoadFailed) {
      S.phase = "boot";
      loadFrameSet().then(onFramesReady);
    }
  });

  /* visibility / offscreen pause */
  document.addEventListener("visibilitychange", function () {
    S.tabVisible = document.visibilityState === "visible";
    if (S.tabVisible) {
      S.lastT = 0; kick();
      // 2026-09-22: also resume the separate cursor-companion loop (section 9b) if the
      // pointer was mid-gesture when the tab was hidden -- interactionTick() itself stops
      // rescheduling while !S.tabVisible, same pattern as the pole's own kick()/tick().
      if (typeof CR !== "undefined" && CR.active && typeof kickInteraction === "function") kickInteraction();
    }
  });
  if (window.IntersectionObserver) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        S.heroVisible = entry.intersectionRatio > 0.01;
        if (S.heroVisible) {
          S.lastT = 0; kick();
          if (typeof CR !== "undefined" && CR.active && typeof kickInteraction === "function") kickInteraction();
        }
      });
    }, { threshold: 0.01 });
    io.observe(heroEl);
  }

  /* resize (mode changes reflow only, no reload of frames unless height changed a lot) */
  var lastCanvasH = 0;
  // pickBackingSize() caps the *effective* dpr at 2 (see section 6), so the reload gate below
  // compares against that same capped value -- a raw dpr change from e.g. 3 to 4 (both capped
  // to 2) must not trigger a needless reload.
  var lastDpr = Math.min(window.devicePixelRatio || 1, 2);
  var resizeRaf = 0;
  function onResize() {
    if (resizeRaf) cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(function () {
      measureAndLayout();
      // a-cinema: measureAndLayout() -> layoutAmbient() -> resizeHazeCanvas() just re-sized (and
      // therefore blanked) the haze canvas's backing store; while the main rAF loop is running
      // (isRotating()/dying) tick() repaints it again on its own very next frame, but while off/
      // reduced-motion (no rAF loop at all) nothing else will repaint it after a resize -- so
      // force one static repaint here too, same as boot()'s own drawHaze(0) call.
      if (!S.running) drawHaze(0);
      if (renderer.ready) {
        var newH = poleEl.getBoundingClientRect().height;
        var newDpr = Math.min(window.devicePixelRatio || 1, 2);
        if (lastCanvasH === 0) lastCanvasH = newH;
        var heightChanged = Math.abs(newH - lastCanvasH) / lastCanvasH > 0.25;
        var dprChanged = newDpr !== lastDpr;
        if (heightChanged || dprChanged) {
          lastCanvasH = newH;
          lastDpr = newDpr;
          loadFrameSet().then(drawFrame);
        } else {
          drawFrame();
        }
      }
    });
  }
  window.addEventListener("resize", onResize);
  mqWide.addEventListener && mqWide.addEventListener("change", onResize);

  // A pure devicePixelRatio change (e.g. dragging the window from a Retina panel to a
  // standard-DPI external monitor) fires neither `resize` nor any `mqWide` change -- there is
  // no native `devicepixelratiochange` event, so re-arm a `(resolution: Ndppx)` media query
  // for the *current* dpr on every boot/change; when the dpr crosses out of that exact value
  // the query flips and onResize() re-evaluates (and reloads the frame set via the dprChanged
  // check above).
  var dprMql = null;
  function onDprMqlChange() {
    watchDprChange();
    onResize();
  }
  function watchDprChange() {
    if (dprMql && dprMql.removeEventListener) dprMql.removeEventListener("change", onDprMqlChange);
    var dpr = window.devicePixelRatio || 1;
    dprMql = window.matchMedia("(resolution: " + dpr + "dppx)");
    if (dprMql.addEventListener) dprMql.addEventListener("change", onDprMqlChange);
  }
  watchDprChange();

  /* ============================================================
   * 9b. Cursor companion -- ring + magnet, off-state flashlight, subtle parallax
   * (2026-09-22, user decision). hover:fine pointer only; touch gets nothing at all. The
   * SYSTEM cursor is never hidden (no `cursor:none` anywhere in hero.css) -- this only adds a
   * companion ring next to it. Everything here is strictly additive and fully independent of
   * the pole's own rAF loop (tick(), section 6/7): nothing below ever writes S.framePos or
   * frameAcc, or changes cadence/direction/speed -- it only reads S.phase (to know when the
   * flashlight should be visible) and, when it is, asks drawFrame() to repaint the CURRENT
   * (already-decided) frame with an updated hole position.
   * ========================================================== */
  var FEATURES = { cursorRing: true, flashlight: true, parallax: true, chromeTint: true };
  if (CONFIG.features && typeof CONFIG.features === "object") {
    for (var featKey in CONFIG.features) {
      if (Object.prototype.hasOwnProperty.call(CONFIG.features, featKey)) FEATURES[featKey] = !!CONFIG.features[featKey];
    }
  }
  var mqFinePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  function isFinePointer() { return mqFinePointer.matches; }
  var cursorCompanionAny = FEATURES.cursorRing || FEATURES.flashlight || FEATURES.parallax;

  var cursorRingEl = document.getElementById("cursorRing");

  var CR = {
    active: false,             // the pointer has actually moved inside the viewport at least once
    mx: 0, my: 0,               // raw last-known pointer position, CSS px, viewport space
    rx: 0, ry: 0,                // ring's own smoothed top-left (magnet morph target)
    rw: 34, rh: 34, rr: 17,      // ring's own smoothed box/radius
    targetEl: null,             // currently-hovered interactive element (CTA/nav/bolt), or null
    parallaxX: 0, parallaxY: 0,  // smoothed parallax offset, normalized -1..1
    running: false,
    rafId: 0,
    lastT: 0,
    idleMs: 0,                   // ms the loop has been "settled" in a row (2026-09-22 idle-stop fix)
    flPaintedMx: NaN, flPaintedMy: NaN, // 2026-09-22 idle-stop fix #2: raw pointer pos the
    // flashlight hole was last actually painted at (NaN so the very first frame always paints).
    // isSteadyOff() (sign off) is a common resting state and used to force `settled=false` on
    // every single frame purely because flashlightActive() was true -- even with the cursor
    // dead still, defeating the idle-stop below exactly like the original finding describes.
    // The hole's on-screen content only actually changes when the raw pointer moves, so that
    // (not "is the flashlight merely eligible to be on") is the real settledness signal.
  };

  var RING_LAG_TAU_MS = 120;      // exponential lag for the ring chasing the raw pointer
  var MAGNET_PULL = 0.30;         // how far the ring's center is pulled toward the hovered element's center
  var PARALLAX_TAU_MS = 150;      // smoothing for the parallax offset
  var FLASHLIGHT_D_WIDE = 220;    // px diameter, viewport width >=1024
  var FLASHLIGHT_D_NARROW = 160;  // px diameter, viewport width <1024
  // 2026-09-22 (page-build pass): amplitudes raised ~20% per coordinator request (wall 2->2.5,
  // haze/steam 5->6, pole 4->5, text 1.5->1.8); smoothing (PARALLAX_TAU_MS) and cadence untouched.
  var PARALLAX_AMP = { wall: 2.5, haze: 6, pole: 5, text: 1.8 }; // max px offset per layer, both axes

  function expLerp(current, target, dtMs, tauMs) {
    var k = 1 - Math.exp(-dtMs / tauMs);
    return current + (target - current) * k;
  }

  var INTERACTIVE_SELECTOR = ".cta, .nav a, #poleBolt";
  var magnetEls = []; // 2026-09-22 (cursor-on-scroll fix): exactly the elements bound below
  function bindMagnetTargets() {
    var els = document.querySelectorAll(INTERACTIVE_SELECTOR);
    for (var i = 0; i < els.length; i++) {
      magnetEls.push(els[i]);
      (function (el) {
        el.addEventListener("pointerenter", function () { CR.targetEl = el; });
        el.addEventListener("pointerleave", function () { if (CR.targetEl === el) CR.targetEl = null; });
      })(els[i]);
    }
  }
  // 2026-09-22 (cursor-on-scroll fix): a wheel/trackpad scroll moves the page under a mouse
  // that itself stays still, so no pointermove/pointerenter/pointerleave is guaranteed to fire.
  // Re-resolve what is under the last known pointer position (the ring is pointer-events:none,
  // so elementFromPoint never returns it) with the same selector + the same bound set as
  // bindMagnetTargets(), then kick the loop so the ring redraws at once.
  function refreshTargetUnderPointer() {
    if (!CR.active) return;
    var hit = document.elementFromPoint(CR.mx, CR.my);
    var el = hit && hit.closest ? hit.closest(INTERACTIVE_SELECTOR) : null;
    CR.targetEl = (el && magnetEls.indexOf(el) !== -1) ? el : null;
    // The pole moved under a still pointer, so the flashlight hole (painted in canvas space)
    // is stale even though CR.mx/my did not change: force interactionTick() to repaint it.
    CR.flPaintedMx = NaN; CR.flPaintedMy = NaN;
    kickInteraction();
  }

  function flashlightDiameter() { return window.innerWidth >= 1024 ? FLASHLIGHT_D_WIDE : FLASHLIGHT_D_NARROW; }
  // S.phase can stay "boot" (not "off") for a page that loads already powered off and is never
  // toggled -- onFramesReady() only ever advances "boot" -> "on" for the powered-on branch, by
  // design (see section 9's comment on isRotating() -- "boot" is a transient-while-loading state
  // for the ON path). A page that boots straight into S.power==="off" is visually already off
  // (boot() already set light/fillOpacity/fillWipe to 0) even while phase formally reads "boot",
  // so treat that combination as steady-off here too -- this file only reads S.phase/S.power, it
  // never assigns them (that stays exactly as the state machine in section 7 already decided).
  function isSteadyOff() { return S.phase === "off" || (S.phase === "boot" && S.power === "off"); }
  function flashlightActive() {
    return FEATURES.flashlight && CR.active && isSteadyOff() && !isReducedMotion();
  }

  // Offscreen scratch canvas for the flashlight's punched-hole dark overlay -- never appended
  // to the DOM. Has its own alpha channel (unlike renderer.ctx, created with {alpha:false} for
  // the main pole canvas) specifically so destination-out can carve a genuinely transparent
  // hole in THIS layer; drawImage()-ing that (frame-bright-here, dark-elsewhere) result onto
  // renderer.ctx with plain source-over then blends correctly even though the destination
  // canvas itself has no alpha channel.
  var flashlightScratch = document.createElement("canvas");
  var flashlightScratchCtx = flashlightScratch.getContext("2d");
  var flashlightCostSamples = [];

  function paintFlashlightHole() {
    if (!renderer.ctx || !renderer.backingW || !renderer.backingH) return;
    var t0 = performance.now();
    var poleRect = poleCanvasEl.getBoundingClientRect();
    if (!poleRect.width || !poleRect.height) return;
    var scaleX = renderer.backingW / poleRect.width;
    var scaleY = renderer.backingH / poleRect.height;
    var cx = (CR.mx - poleRect.left) * scaleX;
    var cy = (CR.my - poleRect.top) * scaleY;
    var rPx = (flashlightDiameter() / 2) * ((scaleX + scaleY) / 2);

    if (flashlightScratch.width !== renderer.backingW || flashlightScratch.height !== renderer.backingH) {
      flashlightScratch.width = renderer.backingW;
      flashlightScratch.height = renderer.backingH;
    }
    var sctx = flashlightScratchCtx;
    sctx.clearRect(0, 0, renderer.backingW, renderer.backingH);
    sctx.globalCompositeOperation = "source-over";
    // ~matches the OFF filter's brightness(0.34) look this replaces (see applyLightFilter()).
    sctx.fillStyle = "rgba(0,0,0,0.64)";
    sctx.fillRect(0, 0, renderer.backingW, renderer.backingH);
    if (cx + rPx >= 0 && cx - rPx <= renderer.backingW && cy + rPx >= 0 && cy - rPx <= renderer.backingH) {
      sctx.globalCompositeOperation = "destination-out";
      var g = sctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, rPx));
      g.addColorStop(0, "rgba(0,0,0,1)");
      g.addColorStop(0.78, "rgba(0,0,0,1)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      sctx.fillStyle = g;
      sctx.beginPath();
      sctx.arc(cx, cy, rPx, 0, Math.PI * 2);
      sctx.fill();
      sctx.globalCompositeOperation = "source-over";
    }
    renderer.ctx.globalAlpha = 1;
    renderer.ctx.drawImage(flashlightScratch, 0, 0);

    var cost = performance.now() - t0;
    flashlightCostSamples.push(cost);
    if (flashlightCostSamples.length > 90) flashlightCostSamples.shift();
  }

  // 2026-09-22 fix (two bugs):
  // 1) The flashlight's title-reveal state (data-flashlight attr + --fx/--fy/--flashlight-r) used
  //    to only ever get written inside the `if (!cursorRingEl || !FEATURES.cursorRing) return;`
  //    early return above -- so `features: { cursorRing: false, flashlight: true }` (a documented,
  //    independently-toggleable combination per hero.config.js) silently left the title dark
  //    forever: the pole's own brightening (paintFlashlightHole/applyLightFilter, both driven
  //    independently by flashlightActive()) worked, but the title mask never got its coordinates.
  //    Now the early return only checks for the ring's own DOM element, and everything below is
  //    split into a ring-only block (gated on FEATURES.cursorRing) and a flashlight-only block
  //    (gated on FEATURES.flashlight) that run independently of each other.
  // 2) All geometry reads (magnet target rect, title-line rects) now happen BEFORE any DOM writes
  //    in this function. Previously the writes at the top (cursorRingEl.style.*, classList.toggle,
  //    heroEl.setAttribute -- the last one on an ANCESTOR of the title lines) ran first, then the
  //    flashlight block read titleLines[i].getBoundingClientRect() right after -- a classic
  //    write-then-read pattern that forces a synchronous layout flush every single frame this
  //    function runs (i.e. on every interactionTick() while the pointer is active).
  function updateCursorRing(dt) {
    if (!cursorRingEl) return;
    var reduced = isReducedMotion();
    var flashlight = flashlightActive();

    // ---- reads first ----
    var targetRect = null, targetCs = null;
    if (FEATURES.cursorRing && CR.targetEl && !flashlight && !reduced) {
      targetRect = CR.targetEl.getBoundingClientRect();
      targetCs = getComputedStyle(CR.targetEl);
    }
    var titleLines = null, titleRects = null, flr = 0;
    if (FEATURES.flashlight) {
      titleLines = titleEl.querySelectorAll(".title__line");
      flr = flashlightDiameter() / 2;
      titleRects = [];
      for (var i = 0; i < titleLines.length; i++) titleRects.push(titleLines[i].getBoundingClientRect());
    }

    // ---- writes after ----
    if (FEATURES.cursorRing) {
      var targetCx, targetCy, targetW, targetH, targetR;
      if (targetRect) {
        var elCx = targetRect.left + targetRect.width / 2, elCy = targetRect.top + targetRect.height / 2;
        targetCx = CR.mx + (elCx - CR.mx) * MAGNET_PULL;
        targetCy = CR.my + (elCy - CR.my) * MAGNET_PULL;
        targetW = targetRect.width + 10; targetH = targetRect.height + 10;
        var br = parseFloat(targetCs.borderRadius) || 0;
        targetR = (br > 0 && br < Math.min(targetW, targetH) / 2) ? (br + 5) : Math.min(targetW, targetH) / 2;
      } else if (flashlight) {
        targetCx = CR.mx; targetCy = CR.my;
        var d = flashlightDiameter();
        targetW = d; targetH = d; targetR = d / 2;
      } else {
        targetCx = CR.mx; targetCy = CR.my;
        targetW = 34; targetH = 34; targetR = 17;
      }

      var curCx = CR.rx + CR.rw / 2, curCy = CR.ry + CR.rh / 2;
      if (reduced) {
        // "prefers-reduced-motion: без лага и магнита" -- jump straight to the raw pointer
        // position (never the magnet-pulled target) with no smoothing on any axis.
        CR.rw = 34; CR.rh = 34; CR.rr = 17;
        curCx = CR.mx; curCy = CR.my;
      } else {
        curCx = expLerp(curCx, targetCx, dt, RING_LAG_TAU_MS);
        curCy = expLerp(curCy, targetCy, dt, RING_LAG_TAU_MS);
        CR.rw = expLerp(CR.rw, targetW, dt, RING_LAG_TAU_MS);
        CR.rh = expLerp(CR.rh, targetH, dt, RING_LAG_TAU_MS);
        CR.rr = expLerp(CR.rr, targetR, dt, RING_LAG_TAU_MS);
      }
      CR.rx = curCx - CR.rw / 2;
      CR.ry = curCy - CR.rh / 2;

      cursorRingEl.style.transform = "translate3d(" + CR.rx.toFixed(2) + "px," + CR.ry.toFixed(2) + "px,0)";
      cursorRingEl.style.width = CR.rw.toFixed(2) + "px";
      cursorRingEl.style.height = CR.rh.toFixed(2) + "px";
      cursorRingEl.style.borderRadius = CR.rr.toFixed(2) + "px";
      cursorRingEl.classList.toggle("is-visible", CR.active);
      cursorRingEl.classList.toggle("cursor-ring--flashlight", flashlight);
    }

    // Independent of FEATURES.cursorRing -- see fix note (1) above.
    heroEl.setAttribute("data-flashlight", flashlight ? "1" : "0");

    // Per-title__line local reveal coordinates for the CSS mask in hero.css (only visually
    // meaningful while [data-flashlight="1"], harmless otherwise -- the mask rule is scoped to
    // that attribute so these custom properties are simply unused when it's absent).
    if (titleLines) {
      for (var j = 0; j < titleLines.length; j++) {
        var lr = titleRects[j];
        titleLines[j].style.setProperty("--fx", (CR.mx - lr.left) + "px");
        titleLines[j].style.setProperty("--fy", (CR.my - lr.top) + "px");
        titleLines[j].style.setProperty("--flashlight-r", flr + "px");
      }
    }
  }

  // 2026-09-22 fix: DOM-writing half of updateParallax(), split out so measureAndLayout() above
  // can push the parallax offset to exactly 0 (then back) around a layout measurement pass
  // without going through the time-based expLerp smoothing in updateParallax() itself.
  function applyParallaxOffsets(px, py) {
    wallEl.style.transform = "translate3d(" + (px * PARALLAX_AMP.wall).toFixed(2) + "px," + (py * PARALLAX_AMP.wall).toFixed(2) + "px,0)";
    hazeEl.style.transform = "translate3d(" + (px * PARALLAX_AMP.haze).toFixed(2) + "px," + (py * PARALLAX_AMP.haze).toFixed(2) + "px,0)";
    poleEl.style.setProperty("--parallax-x", (px * PARALLAX_AMP.pole).toFixed(2) + "px");
    poleEl.style.setProperty("--parallax-y", (py * PARALLAX_AMP.pole).toFixed(2) + "px");
    laneEl.style.transform = "translate3d(" + (px * PARALLAX_AMP.text).toFixed(2) + "px," + (py * PARALLAX_AMP.text).toFixed(2) + "px,0)";
  }

  function updateParallax(dt) {
    var reduced = isReducedMotion();
    if (!CR.active || reduced) {
      // "на touch и reduced-motion -- 0": snap straight to 0, no decay tail.
      CR.parallaxX = 0; CR.parallaxY = 0;
    } else {
      var cx = window.innerWidth / 2, cy = window.innerHeight / 2;
      var targetX = cx > 0 ? clamp((CR.mx - cx) / cx, -1, 1) : 0;
      var targetY = cy > 0 ? clamp((CR.my - cy) / cy, -1, 1) : 0;
      CR.parallaxX = expLerp(CR.parallaxX, targetX, dt, PARALLAX_TAU_MS);
      CR.parallaxY = expLerp(CR.parallaxY, targetY, dt, PARALLAX_TAU_MS);
    }
    applyParallaxOffsets(CR.parallaxX, CR.parallaxY);
  }

  // 2026-09-22 fix: this loop used to reschedule itself unconditionally forever once a single
  // pointermove kicked it off (unlike the pole's own tick(), section 6/7, which already computes
  // `needsRaf` and stops once nothing is animating). Now it stops the same way: once a tick
  // produces no meaningful visual change (ring/parallax already converged to their targets, no
  // flashlight repaint in flight) for CR_IDLE_STOP_MS straight, it parks itself instead of
  // ticking at 60/120Hz for the rest of the page's life. Any later pointermove calls
  // kickInteraction() again (see the listener below) and picks up exactly where CR.rx/ry/
  // parallaxX/Y already were -- no snap, because nothing was reset, only the loop was paused.
  var CR_EPS = 0.05;          // px / normalized-unit: below this, a value counts as "settled"
  var CR_IDLE_STOP_MS = 220;  // how long everything has to stay settled before the loop parks
  function interactionTick(nowMs) {
    if (!CR.lastT) CR.lastT = nowMs;
    var dt = Math.min(50, nowMs - CR.lastT);
    CR.lastT = nowMs;

    var beforeRx = CR.rx, beforeRy = CR.ry, beforeRw = CR.rw, beforeRh = CR.rh;
    var beforePx = CR.parallaxX, beforePy = CR.parallaxY;

    updateCursorRing(dt);
    // 2026-09-22 (cursor-on-scroll fix): parallax and the flashlight repaint only touch the hero,
    // so they pause while it is offscreen; the ring itself (position:fixed, page-wide) keeps going.
    if (FEATURES.parallax && S.heroVisible) updateParallax(dt);
    var flashlightOn = flashlightActive() && S.heroVisible;
    // 2026-09-22 idle-stop fix #2: only actually repaint (and count as "not settled") when the
    // raw pointer moved since the last paint -- isSteadyOff() alone (sign off) used to force a
    // repaint+non-settled every single frame regardless of movement, which is a common resting
    // state and defeated the whole idle-stop below exactly as the original finding described.
    var flashlightMoved = flashlightOn && (CR.mx !== CR.flPaintedMx || CR.my !== CR.flPaintedMy);
    if (flashlightMoved) {
      applyLightFilter(); drawFrame();
      CR.flPaintedMx = CR.mx; CR.flPaintedMy = CR.my;
    }

    var settled = !flashlightMoved &&
      Math.abs(CR.rx - beforeRx) < CR_EPS && Math.abs(CR.ry - beforeRy) < CR_EPS &&
      Math.abs(CR.rw - beforeRw) < CR_EPS && Math.abs(CR.rh - beforeRh) < CR_EPS &&
      Math.abs(CR.parallaxX - beforePx) < CR_EPS && Math.abs(CR.parallaxY - beforePy) < CR_EPS;
    CR.idleMs = settled ? (CR.idleMs || 0) + dt : 0;

    // 2026-09-22 (cursor-on-scroll fix): no longer gated on S.heroVisible -- below the hero that
    // gate stopped the loop after one dt=0 tick, so the ring froze wherever it was (the user's
    // "кругляшок остаётся там же" bug). The idle-stop below still parks it once settled.
    if (S.tabVisible && CR.idleMs < CR_IDLE_STOP_MS) {
      CR.rafId = requestAnimationFrame(interactionTick);
    } else {
      CR.running = false;
      CR.lastT = 0;
      CR.idleMs = 0;
    }
  }
  function kickInteraction() {
    if (!CR.running) {
      CR.running = true;
      CR.lastT = 0;
      CR.idleMs = 0;
      CR.rafId = requestAnimationFrame(interactionTick);
    }
  }

  function hideCursorRing() {
    CR.active = false;
    CR.targetEl = null;
    if (cursorRingEl) cursorRingEl.classList.remove("is-visible");
  }

  if (cursorCompanionAny && isFinePointer()) {
    bindMagnetTargets();
    document.addEventListener("pointermove", function (e) {
      if (e.pointerType && e.pointerType !== "mouse" && e.pointerType !== "pen") return; // touch: nothing
      CR.mx = e.clientX; CR.my = e.clientY;
      CR.active = true;
      kickInteraction();
    });
    window.addEventListener("scroll", refreshTargetUnderPointer, { passive: true });
    window.addEventListener("wheel", refreshTargetUnderPointer, { passive: true });
    // "mouse left the browser window" trick: a genuine window-leaving mouseout has a null
    // relatedTarget/toElement (unlike moving between two elements inside the page).
    document.addEventListener("mouseout", function (e) {
      if (!e.relatedTarget && !e.toElement) hideCursorRing();
    });
    window.addEventListener("blur", hideCursorRing);
  }

  /* ============================================================
   * 10. Startup
   * ========================================================== */
  function start() {
    measureAndLayout();
    boot();
    scheduleHoursTick();
    lastCanvasH = poleEl.getBoundingClientRect().height;
    lastDpr = Math.min(window.devicePixelRatio || 1, 2);
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      measureAndLayout(); // first pass with real metrics
      start();
    }).catch(start);
  } else {
    start();
  }

  /* ============================================================
   * 11. QA hooks (read-only + 1 method: toggle -- the only interaction left)
   * ========================================================== */
  // 2026-09-22: setDir() and the pointer getter are gone with the removed pointer/touch motor
  // (section 7/8) -- there is no direction to set and no pointer state to read anymore.
  // rendererSet is new: exposes which frame set (native/2x) is actually loaded, so the quality
  // watchdog's asset-set downgrade (section 6) is externally observable without re-deriving it
  // from timing noise.
  window.__HERO_QA__ = {
    get layout() { return layoutMode(); },
    get sign() { return S.power; },
    get phase() { return S.phase; },
    get speed() { return isRotating() ? S.dir * FPS_NATIVE : 0; },
    get framePos() { return S.framePos; },
    get dir() { return S.dir; },
    get light() { return S.light; },
    get fillOpacity() { return S.fillOpacity; },
    get fillWipe() { return S.fillWipe; },
    get framesLoaded() { return renderer.ready ? FRAME_COUNT : renderer.frames.filter(Boolean).length; },
    get quality() { return renderer.quality; },
    get qualityTransitions() { return qualityWatchdog.transitions; },
    get rendererSet() { return renderer.set; },
    get fit() { return { titleFs: lastFit.titleFs, titleLines: lastFit.titleLines, signFs: lastFit.signFs, state: lastFit.state }; },
    get accent() { return accentResult; },
    get hours() { return { valid: hoursState.valid, isOpen: hoursState.isOpen, text: hoursState.text }; },
    get rects() {
      return {
        lane: laneEl.getBoundingClientRect().toJSON ? JSON.parse(JSON.stringify(laneEl.getBoundingClientRect())) : laneEl.getBoundingClientRect(),
        title: titleEl.getBoundingClientRect(),
        poleBody: (function () {
          var r = poleEl.getBoundingClientRect();
          return { left: r.left + 0.145 * r.width, right: r.left + 0.815 * r.width, top: r.top, bottom: r.bottom, width: 0.67 * r.width };
        })(),
      };
    },
    toggle: function () { toggle(); },
    guardAccent: guardAccent,
    // a-cinema additions (read-only QA hooks, no new interaction):
    get ambientCostMs() {
      if (!AMBIENT.costSamples.length) return null;
      return AMBIENT.costSamples.reduce(function (a, b) { return a + b; }, 0) / AMBIENT.costSamples.length;
    },
    get hazeOpacity() { return parseFloat(hazeEl.style.opacity || "0"); },
    get spillOpacity() { return parseFloat(spillEl.style.opacity || "0"); },
    get reflOpacity() { return parseFloat(reflEl.style.opacity || "0"); },
    get hazePhase() { return { ax: hazePhaseAx, bx: hazePhaseBx, ay: hazePhaseAy, by: hazePhaseBy }; },
    // 2026-09-22 cursor companion additions (read-only QA hooks; this section has no new
    // interaction of its own beyond pointermove/pointerenter/leave/blur, already native):
    get features() { return { cursorRing: FEATURES.cursorRing, flashlight: FEATURES.flashlight, parallax: FEATURES.parallax, chromeTint: FEATURES.chromeTint }; },
    // 2026-09-22 chrome tint (section 6d) -- read-only: `enabled` is the combined feature-flag +
    // guard result actually used by drawFrame()/applyLightFilter(); `guard` is the raw OKLCH
    // guard outcome (rgb255/enabled) independent of the feature flag, useful for the accent
    // sweep QA to tell "guard disabled it" apart from "feature flag disabled it".
    get chromeTint() {
      return {
        enabled: chromeTintActive(),
        canvasOpacity: CHROME_TINT.canvasOpacity,
        guard: { enabled: chromeTintGuard.enabled, rgb255: chromeTintGuard.rgb255 },
      };
    },
    // 2026-09-22 (later same day): viewport-px crop rects for the pole's cap and base chrome
    // zones only (same central 67% width as rects.poleBody above, split top/bottom at the exact
    // CLIP_Y0/CLIP_Y1 fractions drawFrame() itself clips the striped drum to) -- lets QA scripts
    // crop screenshots to "chrome only, no drum stripes" for the chrome-tint contact sheet /
    // acceptance measurement without duplicating those fractions as separate magic numbers.
    get chromeZones() {
      var r = poleEl.getBoundingClientRect();
      var bodyLeft = r.left + 0.145 * r.width, bodyRight = r.left + 0.815 * r.width;
      var capBottom = r.top + CLIP_Y0 * r.height;
      var baseTop = r.top + CLIP_Y1 * r.height;
      return {
        cap: { left: bodyLeft, top: r.top, right: bodyRight, bottom: capBottom },
        base: { left: bodyLeft, top: baseTop, right: bodyRight, bottom: r.bottom },
      };
    },
    get finePointer() { return isFinePointer(); },
    get cursorRing() {
      if (!cursorRingEl) return null;
      var r = cursorRingEl.getBoundingClientRect();
      return {
        active: CR.active, flashlight: flashlightActive(),
        left: r.left, top: r.top, width: r.width, height: r.height,
        centerX: r.left + r.width / 2, centerY: r.top + r.height / 2,
        isVisible: cursorRingEl.classList.contains("is-visible"),
        systemCursorHidden: getComputedStyle(document.body).cursor === "none",
      };
    },
    get parallax() { return { x: CR.parallaxX, y: CR.parallaxY }; },
    // 2026-09-22 idle-stop fix: read-only visibility into whether interactionTick()'s rAF loop
    // is currently scheduled, so a QA/repro script can prove it actually parks itself.
    get cursorCompanionRunning() { return CR.running; },
    get flashlightCostMs() {
      if (!flashlightCostSamples.length) return null;
      return flashlightCostSamples.reduce(function (a, b) { return a + b; }, 0) / flashlightCostSamples.length;
    },
  };
})();
