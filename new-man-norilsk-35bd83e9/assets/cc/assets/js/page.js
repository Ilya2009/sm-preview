/* barber-pole-hero-v3 -- page.js.
 * Everything below the hero (services / works / masters / reviews / contacts). Classic <script>,
 * no modules, no fetch/network -- same discipline as hero.js. Never touches hero.js's own state or
 * canvas loop; only reads window.HERO_CONFIG and a couple of read-only DOM surfaces hero.js
 * already exposes (#signStatus / #signStatusText for the live open/closed line).
 *
 * 2026-09-22 (craft2 pass, user feedback): editorial services list + sticky aside, reviews rhythm
 * inside the pinned 100vh scene (stepped one-gesture-one-review mechanic below is byte-for-byte the
 * accepted one, NOT touched), contacts as a fitted last screen (fitContactsName/fitContactsCity),
 * one page-wide reveal mechanic (700ms cubic-bezier(.2,.7,.2,1), 80ms stagger, IntersectionObserver,
 * class is-inview; reduced-motion / no-JS -> everything visible). The old sticky "lead transition"
 * stays removed (README "A.3 revert").
 */
(function () {
  "use strict";

  // `?demo=min` swaps in an all-empty variant of the list fields for QA (every section below must
  // hide cleanly with nothing invented in its place) without needing a second config file on disk.
  var params = new URLSearchParams(window.location.search);
  var RAW = window.HERO_CONFIG || {};
  var CONFIG = RAW;
  if (params.get("demo") === "min") {
    CONFIG = {};
    for (var k in RAW) if (Object.prototype.hasOwnProperty.call(RAW, k)) CONFIG[k] = RAW[k];
    CONFIG.services = [];
    CONFIG.works = [];
    CONFIG.masters = [];
    CONFIG.reviews = [];
  }

  var heroEl = document.getElementById("hero");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  // --------------------------------------------------------------------------------------
  // 0. Carry the hero's guarded accent color past #hero's own scope so .page (a plain sibling
  // of #hero) can use the SAME validated color via var(--accent) too -- hero.js sets --accent
  // as an inline style on #hero itself, which does not cascade upward to a sibling subtree.
  // --------------------------------------------------------------------------------------
  function syncAccent() {
    var v = heroEl ? getComputedStyle(heroEl).getPropertyValue("--accent") : "";
    if (v && v.trim()) document.documentElement.style.setProperty("--accent", v.trim());
  }
  syncAccent();

  // --------------------------------------------------------------------------------------
  // Shared helpers
  // --------------------------------------------------------------------------------------
  function makeButton(label, href, variant) {
    if (!href) return null;
    var a = document.createElement("a");
    a.className = "contacts__btn contacts__btn--" + variant;
    a.href = href;
    a.textContent = label;
    if (/^https?:/i.test(href)) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
    return a;
  }
  // Mirror the hero's own already-computed "Открыто до .../Закрыто..." line (hero.js keeps it live
  // via its own minute-tick and sets data-open on #signStatus) -- text + open/closed state are
  // copied, never re-derived, so hours/timezone logic exists exactly once (hero.js section 3).
  function mirrorHoursStatus(targetEl, textEl) {
    if (!targetEl || !textEl) return;
    var src = document.getElementById("signStatus");
    var srcText = document.getElementById("signStatusText");
    if (!src || !srcText) { targetEl.hidden = true; return; }
    function sync() {
      var t = srcText.textContent || "";
      textEl.textContent = t;
      targetEl.hidden = !!src.hidden || !t;
      var open = src.getAttribute("data-open");
      if (open != null) targetEl.setAttribute("data-open", open); else targetEl.removeAttribute("data-open");
    }
    sync();
    if (window.MutationObserver) {
      new MutationObserver(sync).observe(src, {
        attributes: true, attributeFilter: ["data-open", "hidden"],
        childList: true, characterData: true, subtree: true
      });
    }
  }
  function pad2(n) { return String(n).length < 2 ? "0" + n : String(n); }

  // --------------------------------------------------------------------------------------
  // 1. Nav: "О барбершопе" has no #about section in this build -- retarget it to #works
  // (falls back to #services if there are no works either); never leave a dead anchor.
  // --------------------------------------------------------------------------------------
  (function fixAboutNav() {
    var navEl = document.getElementById("nav");
    if (!navEl) return;
    var aboutLink = null;
    var links = navEl.querySelectorAll("a");
    for (var i = 0; i < links.length; i++) if (links[i].getAttribute("href") === "#about") aboutLink = links[i];
    if (!aboutLink) return;
    var hasWorks = Array.isArray(CONFIG.works) && CONFIG.works.length > 0;
    var hasServices = Array.isArray(CONFIG.services) && CONFIG.services.length > 0;
    if (hasWorks) aboutLink.setAttribute("href", "#works");
    else if (hasServices) aboutLink.setAttribute("href", "#services");
    else aboutLink.remove();
  })();

  // 2026-09-23 (v4 video check: "the hover line in the services disappears for 1 frame between two
  // rows"): the accent line is no longer one ::before per row (the old row's line collapsing while
  // the new one starts from 0 -- two separate transitions that the recorder's frame-by-frame clock
  // could catch both near 0). It is ONE marker, the list's own ::before, placed by CSS variables:
  // it draws in top-down on the first row, then SLIDES from row to row (translate + height in one
  // transform transition), and only collapses (towards the row's bottom) once the pointer has left
  // the whole list for 120 ms. The lit row (.is-hot: background, index, price colour) switches only
  // when the pointer enters another row, never on the way out, so there is no frame with no row lit.
  // Mouse/pen only (a tap on a phone does not leave a sticky highlight); keyboard focus-within of a
  // row lights it the same way.
  function setupServicesMarker(ul) {
    if (!ul) return;
    var rows = [].slice.call(ul.querySelectorAll(".services__row"));
    if (!rows.length) return;
    var hot = null, on = false, leaveTimer = 0;
    function setVars(y, h) {
      ul.style.setProperty("--mk-y", y.toFixed(2) + "px");
      ul.style.setProperty("--mk-h", h.toFixed(2));
    }
    function light(row) {
      clearTimeout(leaveTimer);
      if (row === hot && on) return;
      if (hot && hot !== row) hot.classList.remove("is-hot");
      hot = row;
      row.classList.add("is-hot");
      if (!on) {
        // first row: jump (no transition) to its top edge with zero height, then draw in top-down
        ul.classList.add("is-mk-instant");
        setVars(row.offsetTop, 0);
        void ul.offsetHeight; // commit the start state before re-enabling the transition
        ul.classList.remove("is-mk-instant");
        on = true;
      }
      setVars(row.offsetTop, row.offsetHeight);
    }
    function unlight() {
      if (!hot) return;
      // collapse towards the row's bottom edge (the old per-row line did the same on hover-out)
      setVars(hot.offsetTop + hot.offsetHeight, 0);
      hot.classList.remove("is-hot");
      hot = null; on = false;
    }
    function isMouse(e) { return !e.pointerType || e.pointerType === "mouse" || e.pointerType === "pen"; }
    ul.addEventListener("pointerover", function (e) {
      if (!isMouse(e)) return;
      var row = e.target && e.target.closest ? e.target.closest(".services__row") : null;
      if (row && row.parentNode === ul) light(row);
      else clearTimeout(leaveTimer);
    });
    ul.addEventListener("pointerleave", function (e) {
      if (!isMouse(e)) return;
      clearTimeout(leaveTimer);
      leaveTimer = window.setTimeout(unlight, 120);
    });
    ul.addEventListener("focusin", function (e) {
      var row = e.target && e.target.closest ? e.target.closest(".services__row") : null;
      if (row && row.parentNode === ul) light(row);
    });
    ul.addEventListener("focusout", function () {
      clearTimeout(leaveTimer);
      leaveTimer = window.setTimeout(function () { if (!ul.matches(":hover") && !ul.contains(document.activeElement)) unlight(); }, 120);
    });
    // rows re-wrap on resize / font swap: keep the lit marker on its row without animating
    window.addEventListener("resize", function () {
      if (!hot || !on) return;
      ul.classList.add("is-mk-instant");
      setVars(hot.offsetTop, hot.offsetHeight);
      void ul.offsetHeight;
      ul.classList.remove("is-mk-instant");
    });
    window.__PAGE_SERVICES_QA__ = { get hot() { return hot ? rows.indexOf(hot) : -1; }, get on() { return on; } };
  }

  // --------------------------------------------------------------------------------------
  // 2. Services -- editorial rows: index / name (+note) / price (+duration, only if configured)
  // --------------------------------------------------------------------------------------
  (function renderServices() {
    var list = Array.isArray(CONFIG.services) ? CONFIG.services.filter(function (s) {
      return s && typeof s.name === "string" && s.name.trim();
    }) : [];
    var section = document.getElementById("services");
    if (!section) return;
    if (!list.length) { section.hidden = true; return; }
    section.hidden = false;
    var ul = document.getElementById("servicesList");
    list.forEach(function (svc, i) {
      var li = document.createElement("li");
      li.className = "services__row reveal";
      var idx = document.createElement("span");
      idx.className = "services__idx";
      idx.setAttribute("aria-hidden", "true");
      idx.textContent = pad2(i + 1);
      li.appendChild(idx);
      var name = document.createElement("span");
      name.className = "services__name";
      name.textContent = svc.name;
      li.appendChild(name);
      if (svc.price) {
        var price = document.createElement("span");
        price.className = "services__price";
        price.textContent = svc.price;
        li.appendChild(price);
      }
      if (svc.note) {
        var note = document.createElement("p");
        note.className = "services__note";
        note.textContent = svc.note;
        li.appendChild(note);
      }
      if (svc.duration) {
        var dur = document.createElement("span");
        dur.className = "services__duration";
        dur.textContent = svc.duration;
        li.appendChild(dur);
      }
      ul.appendChild(li);
    });
    setupServicesMarker(ul);

    // sticky aside (>=1200px, CSS-gated): count, live open/closed line, CTA/phone -- config only
    var countEl = document.getElementById("servicesCount");
    if (countEl) countEl.textContent = pad2(list.length);
    mirrorHoursStatus(document.getElementById("servicesStatus"), document.getElementById("servicesStatusText"));
    var actions = document.getElementById("servicesActions");
    if (actions) {
      var cta = makeButton(CONFIG.ctaLabel || "Записаться", CONFIG.bookingHref, "primary");
      if (cta) actions.appendChild(cta);
      if (CONFIG.phone && CONFIG.phone.href) {
        var ph = makeButton(CONFIG.phone.display || "Позвонить", CONFIG.phone.href, "line");
        if (ph) actions.appendChild(ph);
      }
    }
  })();

  // --------------------------------------------------------------------------------------
  // 3. Works gallery (reveal is the shared page mechanic, see 7)
  // --------------------------------------------------------------------------------------
  (function renderWorks() {
    // 2026-09-22 (craft3, user feedback): photos are shown WHOLE -- one row of equal height, each
    // card as wide as its own photo (img height: var(--works-h); width: auto), caption under the
    // photo.
    // 2026-09-23 (works-hscroll, user feedback "в работах вниз лагает, не даёт пролистнуть"): the
    // row is no longer a horizontal scroll container driven by a hijacked wheel (scroll-snap pulled
    // every `scrollLeft += deltaY` back to 0 while preventDefault() held the page -> the page froze
    // under the pointer). Now ONLY the native page scroll exists: the works screen (.works__pin) is
    // position:sticky, the section is exactly pin + horizontal overflow + a short hold tall, and
    // updateWorks() moves the row with a transform from the section's own position -- 1 px down ==
    // 1 px sideways. So wheel, trackpad, keys (PgDn/space/arrows/End), scrollbar drag, anchors and
    // touch all drive it the same way, and nothing here ever calls preventDefault().
    // 2026-09-23 (mobile-works-anchor): on a phone (< 768px) the works are NOT pinned -- they
    // run straight down as one column, every photo whole and as wide as the content column (the
    // grid mode reduced motion already used, plus .is-column). Desktop/tablet pin: unchanged.
    var list = Array.isArray(CONFIG.works) ? CONFIG.works.filter(function (w) {
      return w && typeof w.src === "string" && w.src.trim();
    }).slice(0, 8) : [];
    var section = document.getElementById("works");
    if (!section) return;
    if (!list.length) { section.hidden = true; return; }
    section.hidden = false;
    var wrap = document.getElementById("worksGallery");
    // older markup (gallery directly inside the section) -> build the pin/viewport wrappers here
    var viewport = document.getElementById("worksViewport");
    if (!viewport) {
      viewport = document.createElement("div");
      viewport.className = "works__viewport";
      viewport.id = "worksViewport";
      wrap.parentNode.insertBefore(viewport, wrap);
      viewport.appendChild(wrap);
    }
    var pin = document.getElementById("worksPin");
    if (!pin) {
      pin = document.createElement("div");
      pin.className = "works__pin";
      pin.id = "worksPin";
      while (section.firstChild) pin.appendChild(section.firstChild);
      section.appendChild(pin);
    }
    var heading = section.querySelector(".section-heading");
    var imgs = [];
    list.forEach(function (w) {
      var fig = document.createElement("figure");
      fig.className = "works__item reveal";
      var img = document.createElement("img");
      img.src = w.src;
      // eager: the row height is computed from the photos' natural ratios (max 8 small JPGs), and a
      // lazy image would have no natural size until it scrolled into view -> visible relayout.
      img.loading = "eager";
      img.decoding = "async";
      img.alt = (w.caption || "").slice(0, 24) || "Фото работы";
      fig.appendChild(img);
      if (w.caption) {
        var cap = document.createElement("figcaption");
        cap.className = "works__caption";
        cap.textContent = String(w.caption).slice(0, 24);
        fig.appendChild(cap);
      }
      wrap.appendChild(fig);
      imgs.push(img);
    });

    var FIT_MAX = 5;              // static row only for up to this many photos ...
    var MIN_H = 280;              // ... and only when the fitted row is at least this tall ...
    var STATIC_MIN_SHARE = 0.75;  // ... and at least 75% of the height the pinned screen would give
    var MAX_H_PX = 680;           // a photo is never taller than this
    var STATIC_MAX_VH = 0.72;     // static row: never taller than 72% of the viewport (as before)
    var MIN_TRAVEL = 24;          // less horizontal overflow than this -> no pin, just the row
    var phoneMq = window.matchMedia("(max-width: 767px)"); // phone -> one column, no pin
    var mode = "";                // "" static row | "pin" | "grid" (reduced motion / phone column)
    var travel = 0;               // px the row moves sideways over the pinned stretch
    var progress = 0;
    var raf = 0;

    function ratiosOf() {
      return imgs.map(function (img) {
        return img.naturalWidth > 0 && img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : 0.75;
      });
    }
    function px(v) { return parseFloat(v) || 0; }
    function setMode(next) {
      mode = next;
      section.classList.toggle("is-pinned", next === "pin");
      section.classList.toggle("is-grid", next === "grid");
      section.classList.toggle("is-column", next === "grid" && phoneMq.matches);
    }
    function layoutWorks() {
      var ratios = ratiosOf();
      var sum = ratios.reduce(function (a, b) { return a + b; }, 0);
      var maxRatio = Math.max.apply(null, ratios);
      wrap.style.transform = "";
      section.style.height = "";
      // measure everything in the pinned geometry first (pin = one svh-tall screen)
      setMode("pin");
      var wcs = getComputedStyle(wrap);
      var gap = px(wcs.columnGap);
      var padL = px(wcs.paddingLeft), padR = px(wcs.paddingRight);
      var vw = viewport.clientWidth;
      var avail = Math.max(1, vw - padL - padR); // the 1360px content column
      var pcs = getComputedStyle(pin);
      var capEl = wrap.querySelector(".works__caption");
      var capReserve = capEl ? capEl.offsetHeight + px(getComputedStyle(capEl.parentElement).rowGap) : 0;
      var headReserve = heading ? heading.offsetHeight + px(getComputedStyle(heading).marginBottom) : 0;
      var pinInner = pin.clientHeight - px(pcs.paddingTop) - px(pcs.paddingBottom);
      // pinned height: the photo + its caption fit the screen under the heading, and the widest
      // photo fits the content width (so every photo can be seen whole at some point)
      var hPin = Math.floor(Math.min(MAX_H_PX, pinInner - headReserve - capReserve, avail / maxRatio));
      hPin = Math.max(120, hPin);
      var fitH = Math.floor((avail - gap * (ratios.length - 1)) / Math.max(0.1, sum)) - 1;

      if (reduceMotion.matches || phoneMq.matches) {
        setMode("grid"); // phone: .is-column (page.css) -- one photo per row, full content width
        var hGrid = Math.floor(Math.min(MAX_H_PX, window.innerHeight * STATIC_MAX_VH, avail / maxRatio));
        wrap.style.setProperty("--works-h", Math.max(120, hGrid) + "px");
        travel = 0;
      } else if (ratios.length <= FIT_MAX && fitH >= MIN_H && fitH >= STATIC_MIN_SHARE * hPin) {
        setMode("");
        wrap.style.setProperty("--works-h", Math.min(fitH, MAX_H_PX, Math.round(window.innerHeight * STATIC_MAX_VH)) + "px");
        travel = 0;
      } else {
        wrap.style.setProperty("--works-h", hPin + "px");
        travel = Math.max(0, Math.ceil(wrap.offsetWidth - vw));
        if (travel < MIN_TRAVEL) {
          setMode("");
          wrap.style.setProperty("--works-h", Math.min(hPin, fitH > 0 ? fitH : hPin) + "px");
          travel = 0;
        } else {
          // hold = a short still stretch after the last photo arrives, before the pin releases
          var hold = Math.round(Math.min(160, pin.clientHeight * 0.15));
          section.style.height = (pin.offsetHeight + travel + hold) + "px";
          // photos that start beyond the right edge arrive by sliding in -- that IS their entrance,
          // so they skip the fade-up (it would still be running, staggered, when they come into view)
          if (!reduceMotion.matches) {
            for (var i = 0; i < wrap.children.length; i++) {
              if (wrap.children[i].offsetLeft >= vw) wrap.children[i].classList.add("is-inview");
            }
          }
        }
      }
      updateWorks();
    }
    function updateWorks() {
      raf = 0;
      if (mode !== "pin" || travel <= 0) {
        progress = 0;
        if (wrap.style.transform) wrap.style.transform = "";
        return;
      }
      var top = section.getBoundingClientRect().top;
      progress = Math.min(1, Math.max(0, -top / travel));
      wrap.style.transform = "translate3d(" + (-Math.round(progress * travel * 10) / 10) + "px,0,0)";
    }
    function requestUpdate() { if (!raf) raf = requestAnimationFrame(updateWorks); }
    var layoutRaf = 0;
    function requestLayout() { cancelAnimationFrame(layoutRaf); layoutRaf = requestAnimationFrame(layoutWorks); }

    imgs.forEach(function (img) {
      if (img.complete && img.naturalWidth > 0) return;
      img.addEventListener("load", requestLayout, { once: true });
      img.addEventListener("error", requestLayout, { once: true });
    });
    layoutWorks();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(requestLayout);
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestLayout);
    if (reduceMotion.addEventListener) reduceMotion.addEventListener("change", requestLayout);
    if (phoneMq.addEventListener) phoneMq.addEventListener("change", requestLayout);
    window.__PAGE_WORKS_QA__ = {
      layout: layoutWorks,
      get count() { return imgs.length; },
      get mode() { return mode || "static"; },
      get column() { return section.classList.contains("is-column"); },
      get travel() { return travel; },
      get progress() { return progress; }
    };
  })();

  // --------------------------------------------------------------------------------------
  // 4. Masters (optional)
  // --------------------------------------------------------------------------------------
  (function renderMasters() {
    var list = Array.isArray(CONFIG.masters) ? CONFIG.masters.filter(function (m) {
      return m && typeof m.name === "string" && m.name.trim();
    }) : [];
    var section = document.getElementById("masters");
    if (!section) return;
    if (!list.length) { section.hidden = true; return; }
    section.hidden = false;
    var wrap = document.getElementById("mastersList");
    list.forEach(function (m) {
      var item = document.createElement("article");
      item.className = "masters__item reveal";
      if (m.photo) {
        var img = document.createElement("img");
        img.className = "masters__photo";
        img.src = m.photo;
        img.loading = "lazy";
        img.alt = m.name;
        item.appendChild(img);
      }
      var name = document.createElement("p");
      name.className = "masters__name";
      name.textContent = m.name;
      item.appendChild(name);
      if (m.role) {
        var role = document.createElement("p");
        role.className = "masters__role";
        role.textContent = m.role;
        item.appendChild(role);
      }
      wrap.appendChild(item);
    });
  })();

  // --------------------------------------------------------------------------------------
  // 5. Reviews -- stepped "one gesture == one review" mechanic, ported from the accepted
  // work/barber-cinematic-template (app.js setupReviews()); re-skinned only, mechanics 1:1
  // (same WHEEL_THRESHOLD/TOUCH_THRESHOLD/TRANSITION_DURATION, same pinned-section gate, same
  // transitioning+cooldown swallow, same settle() fractional-position correction). No Lenis in
  // this project -- goTo() uses window.scrollTo(), same fallback path the original already had.
  // --------------------------------------------------------------------------------------
  function reviewSourceLabel(src) {
    if (!src || typeof src !== "string") return null;
    return src;
  }
  // A long quote steps its font-size down (1px at a time, floor 24px) until the whole card fits
  // in what the 100svh scene leaves after heading + 64px gap + the 32px progress-line reserve;
  // text is never clipped or truncated.
  function fitReviewCard(article) {
    var quote = article.querySelector("blockquote");
    var sticky = article.closest(".reviews-sticky");
    var stage = article.closest(".reviews-stage");
    var heading = sticky ? sticky.querySelector(".reviews-heading") : null;
    if (!quote || !sticky || !stage || !heading) return;
    quote.style.fontSize = "";
    var cs = getComputedStyle(sticky);
    var avail = sticky.clientHeight
      - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0)
      - heading.offsetHeight - (parseFloat(getComputedStyle(heading).marginBottom) || 0)
      - (parseFloat(getComputedStyle(stage).paddingBottom) || 0);
    if (!(avail > 0)) return;
    var minPx = 24;
    var size = parseFloat(getComputedStyle(quote).fontSize);
    var guard = 0;
    while (article.scrollHeight > avail && size > minPx && guard < 60) {
      size -= 1;
      quote.style.fontSize = size + "px";
      guard += 1;
    }
  }
  (function setupReviews() {
    var reviews = Array.isArray(CONFIG.reviews) ? CONFIG.reviews.filter(function (r) {
      return r && typeof r.author === "string" && r.author.trim() && typeof r.text === "string" && r.text.trim();
    }) : [];
    var section = document.getElementById("reviews");
    if (!section) return;
    if (!reviews.length) { section.hidden = true; return; }
    section.hidden = false;
    var track = section.querySelector("[data-review-track]");
    var current = section.querySelector("[data-review-current]");
    var total = section.querySelector("[data-review-total]");
    section.style.setProperty("--review-count", reviews.length);
    section.classList.toggle("is-single", reviews.length === 1);

    reviews.forEach(function (review, index) {
      var article = document.createElement("article");
      article.className = "review-card";
      article.setAttribute("aria-label", "Отзыв " + (index + 1) + " из " + reviews.length);
      var quote = document.createElement("blockquote");
      var quoteText = document.createElement("span"); // sits above the decorative ::before mark
      quoteText.textContent = review.text;
      quote.appendChild(quoteText);
      var footer = document.createElement("footer");
      var author = document.createElement("cite");
      author.textContent = review.author;
      footer.appendChild(author);
      var details = [];
      if (typeof review.rating === "number" && isFinite(review.rating)) details.push(review.rating + " из 5");
      if (typeof review.date === "string" && review.date.trim()) details.push(review.date.trim());
      var source = reviewSourceLabel(review.source);
      if (source) details.push(source);
      if (details.length) {
        var meta = document.createElement("span");
        meta.textContent = details.join(" · ");
        footer.appendChild(meta);
      }
      article.appendChild(quote);
      article.appendChild(footer);
      track.appendChild(article);
    });

    var cards = [].slice.call(track.children);
    total.textContent = pad2(cards.length);
    var stageEl = section.querySelector(".reviews-stage");
    function fitAll() {
      if (section.classList.contains("is-single")) return;
      cards.forEach(fitReviewCard);
    }
    fitAll();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitAll);

    var index = 0;
    var step = 0;
    var settledIndex = 0;
    var transitioning = false;
    var cooldownTimer = 0;
    var TRANSITION_DURATION = 0.65;
    var WHEEL_THRESHOLD = 14;
    var TOUCH_THRESHOLD = 16;

    function isPinned() {
      var rect = section.getBoundingClientRect();
      return rect.top <= 0.5 && rect.bottom >= window.innerHeight - 0.5;
    }
    function goTo(nextIndex, duration) {
      if (duration === undefined) duration = TRANSITION_DURATION;
      var clamped = Math.round(Math.min(cards.length - 1, Math.max(0, nextIndex)));
      if (clamped === settledIndex && Math.abs(step - clamped) < 0.01) return;
      settledIndex = clamped;
      transitioning = true;
      var top = section.offsetTop + clamped * window.innerHeight;
      window.scrollTo({ top: top, behavior: reduceMotion.matches ? "auto" : "smooth" });
      clearTimeout(cooldownTimer);
      cooldownTimer = window.setTimeout(function () { transitioning = false; }, duration * 1000 + 150);
    }
    function handleGesture(deltaY, event) {
      if (reduceMotion.matches || cards.length <= 1 || !isPinned()) return;
      var goingDown = deltaY > 0;
      if (goingDown && index >= cards.length - 1) return;
      if (!goingDown && index <= 0) return;
      // 2026-09-23 (v4 check): a touchmove that arrives while the browser is already scrolling is
      // non-cancelable; calling preventDefault() on it only logs an intervention warning.
      if (event.cancelable) event.preventDefault();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      if (transitioning || Math.abs(deltaY) < WHEEL_THRESHOLD) return;
      goTo(index + (goingDown ? 1 : -1));
    }
    window.addEventListener("wheel", function (event) { handleGesture(event.deltaY, event); }, { passive: false });
    var touchStartY = 0;
    window.addEventListener("touchstart", function (event) {
      touchStartY = event.touches[0] ? event.touches[0].clientY : 0;
    }, { passive: true });
    window.addEventListener("touchmove", function (event) {
      var y = event.touches[0] ? event.touches[0].clientY : null;
      if (y == null || !isPinned()) return;
      var deltaY = touchStartY - y;
      if (Math.abs(deltaY) < TOUCH_THRESHOLD) return;
      handleGesture(deltaY, event);
      touchStartY = y;
    }, { passive: false });
    track.addEventListener("keydown", function (event) {
      var directions = { ArrowUp: -1, ArrowDown: 1, PageUp: -1, PageDown: 1 };
      if (event.key in directions) {
        event.preventDefault();
        goTo(index + directions[event.key]);
      } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        goTo(event.key === "Home" ? 0 : cards.length - 1);
      }
    });
    // 2026-09-23 (mobile-works-anchor): an in-page anchor jump (menu «Контакты», any a[href^="#"])
    // must reach its target. The smooth anchor scroll crosses this pinned scene with a fractional
    // step, and settle() used to scrollTo() the nearest review -- the jump stopped inside the
    // reviews (demo 1440x900: «Контакты» parked at 2982-3882 of 5802). A click on an in-page anchor now
    // suspends settle() until the scroll has come to rest: `scrollend`, or 250 ms without a scroll
    // event (browsers without scrollend), 400 ms if no scroll starts at all, hard cap 5 s. A wheel or
    // touch by the user ends it at once (the user takes over, the stepped mechanic is back).
    // Same idea as the adaptation builder's runtime patch J1 -- the builder skips J1 when it finds
    // this guard (`var anchorJump`) already in page.js.
    var anchorJump = false;
    var anchorIdleTimer = 0;
    var anchorCapTimer = 0;
    function endAnchorJump() { anchorJump = false; clearTimeout(anchorIdleTimer); clearTimeout(anchorCapTimer); }
    document.addEventListener("click", function (event) {
      var link = event.target && event.target.closest ? event.target.closest('a[href^="#"]') : null;
      var href = link ? link.getAttribute("href") : "";
      if (!href || href.length < 2) return;
      anchorJump = true;
      clearTimeout(anchorIdleTimer);
      anchorIdleTimer = window.setTimeout(endAnchorJump, 400);
      clearTimeout(anchorCapTimer);
      anchorCapTimer = window.setTimeout(endAnchorJump, 5000);
    }, true);
    window.addEventListener("scroll", function () {
      if (!anchorJump) return;
      clearTimeout(anchorIdleTimer);
      anchorIdleTimer = window.setTimeout(endAnchorJump, 250);
    }, { passive: true });
    if ("onscrollend" in window) window.addEventListener("scrollend", function () { if (anchorJump) window.setTimeout(endAnchorJump, 60); });
    window.addEventListener("wheel", endAnchorJump, { passive: true, capture: true });
    window.addEventListener("touchstart", endAnchorJump, { passive: true, capture: true });
    function settle() {
      if (reduceMotion.matches || cards.length <= 1 || transitioning || anchorJump) return;
      var target = Math.round(step);
      if (Math.abs(step - target) <= 0.005) return;
      goTo(target, 0.35);
    }
    function render() {
      if (reduceMotion.matches || cards.length === 1) {
        index = 0; step = 0;
        current.textContent = "01";
        if (stageEl) stageEl.style.setProperty("--rprog", cards.length ? (100 / cards.length) + "%" : "0%");
        cards.forEach(function (card, i) { card.classList.toggle("is-active", i === 0); });
        return;
      }
      // 2026-09-22 fix: the per-review scroll unit is exactly ONE viewport (goTo() scrolls to
      // offsetTop + i*innerHeight), so step must be travelled/innerHeight -- the same formula the
      // accepted canon uses (work/barber-cinematic-template app.js setupReviews). The earlier
      // travelled/(height-innerHeight)*(n-1) mapping disagreed with goTo() as soon as the section
      // was taller than n*100svh (+120px tail), leaving every landing at step 0.9375 / 1.875 with
      // the previous card ghosting through at opacity .06-.12 (reviewer finding).
      var rect = section.getBoundingClientRect();
      var travelled = Math.max(0, -rect.top);
      step = Math.min(cards.length - 1, travelled / Math.max(1, window.innerHeight));
      index = Math.round(step);
      current.textContent = pad2(index + 1);
      if (stageEl) stageEl.style.setProperty("--rprog", (((index + 1) / cards.length) * 100) + "%");
      // 2026-09-22 (craft3, user feedback "прошлые отзывы виднеются в прозрачности"): no more
      // scroll-driven crossfade (opacity = 1 - |i - step| had BOTH cards at ~0.5 mid-scroll). The
      // visible card is a single class, `is-active`; CSS fades the leaving card out in 100ms and
      // brings the arriving one in only after that (140ms delay), so no two cards are ever visible
      // together. While a goTo() is in flight the target card is shown at once (settledIndex) instead
      // of waiting for the scroll to cross the half-way point -- the gesture reads as immediate.
      // goTo()/handleGesture()/settle() and the step/index maths above are untouched.
      var active = transitioning ? settledIndex : index;
      cards.forEach(function (card, i) { card.classList.toggle("is-active", i === active); });
      settle();
    }
    render();
    window.addEventListener("scroll", render, { passive: true });
    window.addEventListener("resize", function () { fitAll(); render(); });
    window.__PAGE_REVIEWS_QA__ = { get index() { return index; }, get count() { return cards.length; }, goTo: goTo };
  })();

  // --------------------------------------------------------------------------------------
  // 6. Contacts -- last screen
  // --------------------------------------------------------------------------------------
  (function renderContacts() {
    var nameEl = document.getElementById("contacts-title");
    var cityEl = document.getElementById("contactsCity");
    var markEl = document.getElementById("contactsMark");
    var addrEl = document.getElementById("contactsAddress");
    var actionsEl = document.getElementById("contactsActions");
    var linksEl = document.getElementById("contactsLinks");
    var footEl = document.getElementById("contactsFoot");
    var contentEl = document.getElementById("contactsContent");
    if (!nameEl || !contentEl) return;

    var displayName = CONFIG.name || "";
    nameEl.textContent = displayName;
    if (markEl) markEl.textContent = displayName ? displayName.trim().charAt(0).toLocaleUpperCase("ru") : "";
    var cityPhrase = CONFIG.cityIn ? String(CONFIG.cityIn).trim() : "";
    if (cityEl) cityEl.textContent = cityPhrase; // outlined, uppercase via CSS -- same phrase the hero uses

    // The city is already the huge outlined line right above (same `cityIn` phrase the hero uses),
    // so the address line carries only the street -- no duplicate and no guessed nominative case.
    if (addrEl) {
      addrEl.textContent = CONFIG.address ? String(CONFIG.address) : "";
      addrEl.hidden = !CONFIG.address;
    }

    mirrorHoursStatus(document.getElementById("contactsStatus"), document.getElementById("contactsStatusText"));

    if (actionsEl) {
      var cta = makeButton(CONFIG.ctaLabel || "Записаться", CONFIG.bookingHref, "primary");
      if (cta) actionsEl.appendChild(cta);
      if (CONFIG.phone && CONFIG.phone.href) {
        var ph = makeButton(CONFIG.phone.display || "Позвонить", CONFIG.phone.href, "line");
        if (ph) actionsEl.appendChild(ph);
      }
    }

    // map/social text links (right column) -- only for hrefs the config actually has; demo has none
    function addLink(label, href) {
      if (!href || !linksEl) return;
      var a = document.createElement("a");
      a.className = "contacts__link";
      a.href = href;
      a.textContent = label;
      if (/^https?:/i.test(href)) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
      linksEl.appendChild(a);
    }
    addLink("2ГИС", CONFIG.dgisHref);
    addLink("Яндекс Карты", CONFIG.yandexHref);
    addLink("Telegram", CONFIG.telegramHref);
    addLink("WhatsApp", CONFIG.whatsappHref);
    addLink("VK", CONFIG.vkHref);

    // thin closing line -- (c) current year + name. Nothing invented.
    if (footEl) footEl.textContent = displayName ? ("© " + new Date().getFullYear() + " " + displayName) : "";

    // Fit the huge display name to the content width, the same idea as the hero's fitTitleWide():
    // start at the design max, step down to the design min while it overflows; only if it STILL
    // overflows at the min allow a word-wrap, then keep stepping down to a hard floor so a single
    // long word can never overflow the column. Widths via scrollWidth (not clamped by max-width).
    function fitTextToWidth(el, maxPx, minPrefPx, floorPx, allowWrap) {
      if (!el || !el.textContent) return 0;
      var box = el.parentElement;
      var maxW = box ? box.clientWidth : 0;
      if (!maxW) return 0;
      el.style.whiteSpace = "nowrap";
      var fs = maxPx;
      el.style.fontSize = fs + "px";
      var guard = 0;
      while (el.scrollWidth > maxW && fs > minPrefPx && guard < 80) { fs -= 2; el.style.fontSize = fs + "px"; guard++; }
      if (el.scrollWidth > maxW) {
        if (allowWrap) el.style.whiteSpace = "normal";
        guard = 0;
        while (el.scrollWidth > maxW && fs > floorPx && guard < 120) { fs -= 2; el.style.fontSize = fs + "px"; guard++; }
      }
      return fs;
    }
    function fitContactsName() {
      var w = window.innerWidth;
      var maxPx = 220, minPref = 160, floor = 56;
      if (w <= 600) { maxPx = 76; minPref = 48; floor = 30; }
      else if (w < 1024) { maxPx = 150; minPref = 104; floor = 44; }
      return fitTextToWidth(nameEl, maxPx, minPref, floor, true);
    }
    function fitContactsCity() {
      if (!cityEl || !cityEl.textContent) return 0;
      cityEl.style.fontSize = "";
      cityEl.style.whiteSpace = "";
      var start = parseFloat(getComputedStyle(cityEl).fontSize) || 64;
      return fitTextToWidth(cityEl, Math.round(start), Math.round(start * 0.66), 24, true);
    }
    function fitContacts() { fitContactsName(); fitContactsCity(); }
    fitContacts();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitContacts);
    var raf = 0;
    window.addEventListener("resize", function () {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(fitContacts);
    });
    window.__PAGE_CONTACTS_QA__ = { fit: fitContacts };
  })();

  // --------------------------------------------------------------------------------------
  // 7. Page-wide reveal (one mechanic): elements tagged .reveal (markup + the render steps above)
  // plus section headings. Stagger 80ms per sibling group (capped), 700ms cubic-bezier(.2,.7,.2,1)
  // in CSS, class is-inview. Reduced motion or no IntersectionObserver -> everything in view at
  // once (and with JS off nothing ever gets .reveal, so nothing is hidden). Reviews' pinned cards
  // are driven by render() opacity and are deliberately not part of this.
  // --------------------------------------------------------------------------------------
  (function setupReveal() {
    // Static markup never carries .reveal itself (with JS off it would sit at opacity 0 forever);
    // it carries data-reveal, and only this script promotes it to the animated class. Same for the
    // section headings and the contacts accent rule (armed below only when the observer will run).
    document.querySelectorAll("[data-reveal]").forEach(function (el) { el.classList.add("reveal"); });
    document.querySelectorAll(".section-heading, .reviews-heading").forEach(function (el) { el.classList.add("reveal"); });
    var targets = [].slice.call(document.querySelectorAll(".page .reveal"));
    var contentEl = document.getElementById("contactsContent"); // gets is-inview for the accent rule
    var ruleEl = document.querySelector(".contacts__rule");
    var byGroup = new Map();
    targets.forEach(function (el) {
      var group = el.parentElement || document.body;
      var n = byGroup.get(group) || 0;
      el.style.setProperty("--reveal-delay", Math.min(n * 80, 560) + "ms");
      byGroup.set(group, n + 1);
    });
    if (reduceMotion.matches || !window.IntersectionObserver) {
      targets.forEach(function (el) { el.classList.add("is-inview"); });
      if (contentEl) contentEl.classList.add("is-inview");
      return;
    }
    if (ruleEl) ruleEl.classList.add("is-armed"); // scaleX(0) start state exists only from here on
    // 2026-09-23 (reveal fix): the stagger is re-counted per observer batch. The delay set above
    // follows the sibling index, so on a slow scroll the 6th..8th row of a long price list, which
    // comes into view on its own, still waited 400..560 ms as empty space before its fade even
    // began. Now elements that arrive together keep the same 80 ms cascade (entries come in
    // observe() = document order), and one that arrives alone starts at once.
    var io = new IntersectionObserver(function (entries) {
      var batch = new Map();
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        if (el.classList.contains("reveal")) {
          var group = el.parentElement || document.body;
          var n = batch.get(group) || 0;
          el.style.setProperty("--reveal-delay", Math.min(n * 80, 560) + "ms");
          batch.set(group, n + 1);
        }
        el.classList.add("is-inview");
        io.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    targets.forEach(function (el) { io.observe(el); });
    if (contentEl) io.observe(contentEl);
  })();

  // --------------------------------------------------------------------------------------
  // 8. Menu: a nav item whose section is missing or hidden (e.g. «Мастера» with no masters in the
  // config) led nowhere -- it is dropped. Runs synchronously after every section above decided
  // hidden/visible, i.e. before hero.js measures the nav (its layout waits for document.fonts).
  // --------------------------------------------------------------------------------------
  (function pruneDeadNav() {
    var navEl = document.getElementById("nav");
    if (!navEl) return;
    [].slice.call(navEl.querySelectorAll('a[href^="#"]')).forEach(function (a) {
      var id = a.getAttribute("href").slice(1);
      if (!id) return;
      var target = document.getElementById(id);
      if (!target || target.hidden) a.remove();
    });
  })();
})();
