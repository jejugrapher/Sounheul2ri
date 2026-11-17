/* 선흘2리 마을 홈페이지 — 공통 스크립트 */
(function () {
  "use strict";
  var CFG = window.SH2_CONFIG || { api: "" };
  var NAV = [
    ["about.html", "마을 소개"],
    ["nature.html", "자연·관광지"],
    ["events.html", "행사 안내"],
    ["archive.html", "지난 행사"],
    ["visit.html", "오시는 길"]
  ];
  var DOW = ["일", "월", "화", "수", "목", "금", "토"];

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function safeUrl(u) {
    u = String(u || "").trim();
    return /^(https?:\/\/|assets\/|data\/|\/|tel:|[a-z]+\.html(#.*)?$)/i.test(u) ? u : "";
  }
  function el(id) { return document.getElementById(id); }

  /* 날짜 — 한국 시간 기준 오늘 */
  function todayISO() {
    var p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    return p;
  }
  function parse(iso) { var a = String(iso).split("-"); return new Date(+a[0], +a[1] - 1, +a[2]); }
  function fmtDate(iso) {
    if (!iso) return "";
    var d = parse(iso);
    return d.getFullYear() + "년 " + (d.getMonth() + 1) + "월 " + d.getDate() + "일(" + DOW[d.getDay()] + ")";
  }
  function fmtRange(ev) {
    if (!ev.start) return ev.usual || "";
    var e = ev.end && ev.end !== ev.start ? ev.end : "";
    if (!e) return fmtDate(ev.start);
    var a = parse(ev.start), b = parse(e);
    var tail = (a.getFullYear() !== b.getFullYear() ? b.getFullYear() + "년 " : "") +
      (a.getMonth() !== b.getMonth() || a.getFullYear() !== b.getFullYear() ? (b.getMonth() + 1) + "월 " : "") +
      b.getDate() + "일(" + DOW[b.getDay()] + ")";
    return fmtDate(ev.start) + " ~ " + tail;
  }
  function lastDay(ev) { return ev.end || ev.start || ""; }
  function isPast(ev, today) { return !!ev.start && lastDay(ev) < (today || todayISO()); }
  function isOngoing(ev, today) { today = today || todayISO(); return !!ev.start && ev.start <= today && lastDay(ev) >= today; }
  function dday(ev, today) {
    today = today || todayISO();
    if (isOngoing(ev, today)) return "진행 중";
    var n = Math.round((parse(ev.start) - parse(today)) / 86400000);
    return n === 0 ? "오늘" : "D-" + n;
  }

  /* 데이터 */
  function getJSON(url, ms) {
    var ctl = new AbortController();
    var t = setTimeout(function () { ctl.abort(); }, ms || 6000);
    return fetch(url, { cache: "no-store", signal: ctl.signal }).then(function (r) {
      clearTimeout(t);
      if (!r.ok) throw new Error(r.status);
      return r.json();
    });
  }
  /* 행사: 저장소(있으면) → 실패하면 사이트에 함께 올린 목록 */
  function loadEvents() {
    var local = function () { return getJSON("data/events.json").then(function (d) { return d.events || []; }); };
    var p = CFG.api
      ? getJSON(CFG.api + (CFG.api.indexOf("?") < 0 ? "?" : "&") + "mode=events").then(function (d) {
          if (!d || !d.ok) throw new Error("bad");
          window.SH2_NOTICE = d.notice || "";
          window.SH2_NOTICES = d.notices || null;
          var evs = d.events || [];
          /* 저장소의 행사에 포스터·사진·영상 칸이 비어 있으면, 사이트에 함께 올린 목록의 같은 행사 값으로 채운다 */
          return local().then(function (base) {
            var by = {}; base.forEach(function (b) { by[b.id] = b; });
            evs.forEach(function (e) {
              var b = by[e.id]; if (!b) return;
              if (!e.video && b.video) e.video = b.video;
              if (!e.poster && b.poster) e.poster = b.poster;
              if (!(e.photos || []).length && (b.photos || []).length) e.photos = b.photos;
            });
            return evs;
          }, function () { return evs; });
        }).catch(local)
      : local();
    return p.then(function (list) {
      return list.filter(function (e) { return e && !e.hidden; });
    });
  }
  function splitEvents(list) {
    var today = todayISO();
    var up = [], past = [], yearly = [];
    list.forEach(function (e) {
      if (!e.start) yearly.push(e);
      else if (isPast(e, today)) past.push(e);
      else up.push(e);
    });
    up.sort(function (a, b) { return a.start < b.start ? -1 : 1; });
    past.sort(function (a, b) { return a.start > b.start ? -1 : 1; });
    return { upcoming: up, past: past, yearly: yearly, today: today };
  }

  /* 행사 카드·상세 */
  var RIDGE = '<svg viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true"><path d="M0 80 C50 62 80 40 120 38 C160 36 175 62 215 60 C260 58 280 26 320 28 C355 30 380 60 400 56 L400 120 L0 120Z" fill="#3E7449" opacity=".7"/><path d="M0 104 C60 90 110 96 170 100 C240 104 290 84 340 90 C370 94 390 102 400 100 L400 120 L0 120Z" fill="#6B8F5A" opacity=".7"/></svg>';
  function md(iso) { var d = parse(iso); return (d.getMonth() + 1) + "." + String(d.getDate()).padStart(2, "0"); }
  function fmtShort(ev) {
    if (!ev.start) return ev.usual || "";
    var a = parse(ev.start), t = a.getFullYear() + ". " + md(ev.start) + " " + DOW[a.getDay()];
    if (ev.end && ev.end !== ev.start) { var b = parse(ev.end); t += " ~ " + (b.getFullYear() !== a.getFullYear() ? b.getFullYear() + ". " : "") + md(ev.end) + " " + DOW[b.getDay()]; }
    return ev.time ? t + " · " + ev.time : t;
  }
  function catTag(ev) {
    if (!ev.category) return "";
    var k = /벚꽃/.test(ev.title + ev.category) ? " cherry" : /세계유산축전/.test(ev.category) ? " sky" : "";
    return '<span class="tag' + k + '">' + esc(ev.category) + "</span>";
  }
  function statusTag(ev) {
    if (!ev.start) return '<span class="tag yearly">해마다</span>';
    if (isPast(ev)) return '<span class="tag done">지난 행사</span>';
    return '<span class="tag upcoming">' + esc(dday(ev)) + "</span>";
  }
  function eventUrl(ev) { return "event.html?e=" + encodeURIComponent(ev.id || ev); }
  function eventCard(ev) {
    var pic = safeUrl((ev.photos || [])[0]) || safeUrl(ev.poster);
    var thumb = pic
      ? '<div class="thumb"><img src="' + esc(pic) + '" alt="" loading="lazy">' + (CFG.sampleLabels !== false && /\/fl_/.test(pic) ? '<span class="sample">예시 그림(AI 생성)</span>' : "") + "</div>"
      : '<div class="thumb plain">' + RIDGE + "<b>" + (ev.start ? "<small>" + esc(ev.start.slice(0, 4)) + "</small>" + esc(md(ev.start)) + (ev.end && ev.end !== ev.start ? " – " + esc(md(ev.end)) : "") : esc(ev.usual || "해마다")) + "</b></div>";
    return '<article class="card linked">' + thumb +
      '<div class="body">' +
      '<div class="tags">' + statusTag(ev) + catTag(ev) + "</div>" +
      '<span class="when">' + esc(fmtShort(ev)) + "</span>" +
      '<h3><a class="stretch" href="' + esc(eventUrl(ev)) + '">' + esc(ev.title) + "</a></h3>" +
      (ev.place ? '<span class="meta">' + esc(ev.place) + "</span>" : "") +
      '<div class="card-foot"><span class="more" aria-hidden="true">행사 페이지 보기 →</span>' +
      '<button class="share-btn" data-share="' + esc(ev.id) + '">공유</button></div>' +
      "</div></article>";
  }

  /* 사진 크게 보기 — 화면 아무 곳이나 누르거나, 뒤로 가기·Esc 로 닫힌다. 새 창을 열지 않는다 */
  var lb, lbItems = [], lbAt = 0, lbPushed = false, lbFocus;
  function lbDraw() {
    var it = lbItems[lbAt];
    lb.querySelector("img").src = it.src;
    lb.querySelector("img").alt = it.alt || "";
    lb.querySelector(".lb-cap").textContent = (it.alt || "") + (lbItems.length > 1 ? "  " + (lbAt + 1) + " / " + lbItems.length : "");
    lb.classList.toggle("one", lbItems.length < 2);
  }
  function lbStep(n) { lbAt = (lbAt + n + lbItems.length) % lbItems.length; lbDraw(); }
  function closeLightbox(fromBack) {
    if (!lb || !lb.classList.contains("open")) return;
    lb.classList.remove("open");
    document.documentElement.classList.remove("lb-on");
    lb.querySelector("img").removeAttribute("src");
    var pushed = lbPushed; lbPushed = false;
    if (pushed && !fromBack) history.back();
    if (lbFocus && lbFocus.focus) { try { lbFocus.focus({ preventScroll: true }); } catch (e) {} }
  }
  function openLightbox(items, at) {
    if (!items.length) return;
    if (!lb) {
      lb = document.createElement("div");
      lb.className = "lb";
      lb.setAttribute("role", "dialog"); lb.setAttribute("aria-modal", "true"); lb.setAttribute("aria-label", "사진 크게 보기"); lb.tabIndex = -1;
      lb.innerHTML = '<button class="lb-x" data-lb="close" aria-label="닫기">✕</button>' +
        '<button class="lb-nav prev" data-lb="prev" aria-label="이전 사진">‹</button>' +
        '<figure><img alt=""><figcaption class="lb-cap"></figcaption></figure>' +
        '<button class="lb-nav next" data-lb="next" aria-label="다음 사진">›</button>' +
        '<p class="lb-hint">화면을 누르면 닫힙니다</p>';
      document.body.appendChild(lb);
      lb.addEventListener("click", function (e) {
        var b = e.target.closest("[data-lb]"), k = b && b.getAttribute("data-lb");
        if (k === "prev") lbStep(-1); else if (k === "next") lbStep(1); else closeLightbox();
      });
      var x0 = null;
      lb.addEventListener("touchstart", function (e) { x0 = e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
      lb.addEventListener("touchend", function (e) {
        if (x0 == null || lbItems.length < 2) return;
        var dx = e.changedTouches[0].clientX - x0; x0 = null;
        if (Math.abs(dx) > 50) { e.preventDefault(); lbStep(dx < 0 ? 1 : -1); }
      });
      document.addEventListener("keydown", function (e) {
        if (!lb.classList.contains("open")) return;
        if (e.key === "Escape") closeLightbox();
        else if (e.key === "ArrowLeft" && lbItems.length > 1) lbStep(-1);
        else if (e.key === "ArrowRight" && lbItems.length > 1) lbStep(1);
      });
      window.addEventListener("popstate", function () { closeLightbox(true); });
    }
    lbItems = items; lbAt = at || 0; lbFocus = document.activeElement;
    lbDraw();
    lb.classList.add("open");
    document.documentElement.classList.add("lb-on");
    try { history.pushState({ sh2lb: 1 }, ""); lbPushed = true; } catch (e) { lbPushed = false; }
    try { lb.focus({ preventScroll: true }); } catch (e) {}
  }
  /* <a class="zoom" href="큰 사진"><img></a> 를 누르면 크게 보기. 같은 묶음(.photos 등) 안의 사진은 넘겨 볼 수 있다 */
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a.zoom");
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    var box = a.closest("[data-zoom-group]") || a.parentNode;
    var all = [].slice.call(box.querySelectorAll("a.zoom"));
    openLightbox(all.map(function (x) { var im = x.querySelector("img"); return { src: x.getAttribute("href"), alt: (im && im.alt) || "" }; }), Math.max(0, all.indexOf(a)));
  });

  function toast(msg) {
    var t = el("toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }
  function share(title, url) {
    url = url || location.href;
    if (navigator.share) { navigator.share({ title: title, url: url }).catch(function () {}); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { toast("주소를 복사했습니다"); }, function () { prompt("아래 주소를 복사하세요", url); });
    } else { prompt("아래 주소를 복사하세요", url); }
  }
  /* 카드의 공유 단추 연결. 옛 주소(…#행사)로 들어오면 그 행사의 페이지로 보낸다 */
  function shareEvent(ev) {
    share(ev.title + " — 선흘2리", location.origin + location.pathname.replace(/[^/]*$/, "") + eventUrl(ev));
  }
  function bindEvents(root, list) {
    var byId = {};
    list.forEach(function (e) { byId[e.id] = e; });
    root.addEventListener("click", function (e) {
      var b = e.target.closest("[data-share]");
      if (b && byId[b.getAttribute("data-share")]) { e.preventDefault(); shareEvent(byId[b.getAttribute("data-share")]); }
    });
    var h = decodeURIComponent(location.hash.slice(1));
    if (h && byId[h]) location.replace(eventUrl(byId[h]));
  }

  /* 머리말·꼬리말 */
  function layout(site) {
    var here = location.pathname.split("/").pop() || "index.html";
    var name = esc((site && site.name) || "선흘2리");
    var skip = document.createElement("a");
    skip.className = "skip"; skip.href = "#main"; skip.textContent = "본문 바로가기";
    var head = document.createElement("nav");
    head.className = "nav";
    head.setAttribute("aria-label", "주 메뉴");
    head.innerHTML = '<div class="wrap nav-in"><a class="brand" href="index.html">' + name + "<small>" + esc((site && site.tagline) || "") + "</small></a>" +
      '<button class="menu-btn" aria-expanded="false" aria-controls="siteMenu">메뉴</button>' +
      '<div class="menu">' + NAV.map(function (n) {
        return '<a href="' + n[0] + '"' + (n[0] === here ? ' aria-current="page"' : "") + ">" + n[1] + "</a>";
      }).join("") + "</div></div>";
    document.body.insertBefore(head, document.body.firstChild);
    document.body.insertBefore(skip, head);
    var btn = head.querySelector(".menu-btn"), menu = head.querySelector(".menu");
    menu.id = "siteMenu";
    function setMenu(o) { menu.classList.toggle("open", o); btn.setAttribute("aria-expanded", o ? "true" : "false"); btn.textContent = o ? "닫기" : "메뉴"; }
    btn.addEventListener("click", function (e) { e.stopPropagation(); setMenu(!menu.classList.contains("open")); });
    document.addEventListener("click", function (e) { if (menu.classList.contains("open") && !head.contains(e.target)) setMenu(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && menu.classList.contains("open")) { setMenu(false); btn.focus(); } });

    var c = (site && site.contact) || {};
    var org = esc(c.org || "선흘2리 마을회");
    var foot = document.createElement("footer");
    foot.innerHTML = '<div class="wrap"><div class="foot">' +
      "<div><h3>" + org + "</h3><p>" + esc(c.address || "") + (c.place ? " " + esc(c.place) : "") +
      (c.tel ? '<br>전화 <a href="tel:' + esc(c.tel) + '">' + esc(c.tel) + "</a>" : "") + (c.fax ? " · 팩스 " + esc(c.fax) : "") + "</p></div>" +
      "<div><h3>바로가기</h3><p>" + NAV.map(function (n) { return '<a href="' + n[0] + '">' + n[1] + "</a>"; }).join("<br>") + "</p></div>" +
      '<div><h3>관련 사이트</h3><p><a href="https://www.jeju.go.kr/wnhcenter/black/reserve.htm" target="_blank" rel="noopener">거문오름 탐방 예약</a><br>' +
      '<a href="https://www.jeju.go.kr/wnhcenter/center/use.htm" target="_blank" rel="noopener">제주세계자연유산센터</a><br>' +
      '<a href="https://jajumap.com/town/seonheul2/" target="_blank" rel="noopener">선흘2리 마을지도</a></p></div>' +
      '</div><p class="foot-note"><span>© ' + new Date().getFullYear() + " " + org + '</span><span>제작 : <a href="https://jejugrapher.com/" target="_blank" rel="noopener">제주그래퍼</a> · <a href="staff.html">준비 공유</a> · <a href="admin.html">관리자</a></span></p></div>';
    document.body.appendChild(foot);
    var quick = document.createElement("nav");
    quick.className = "quick";
    quick.setAttribute("aria-label", "빠른 메뉴");
    quick.innerHTML = '<a href="events.html">행사</a><a href="https://www.jeju.go.kr/wnhcenter/black/reserve.htm" target="_blank" rel="noopener">탐방 예약</a><a href="visit.html">오시는 길</a>' +
      (c.tel ? '<a href="tel:' + esc(c.tel) + '">전화</a>' : '<a href="about.html">마을 소개</a>');
    document.body.appendChild(quick);
    document.body.classList.add("has-quick");
  }

  function init(cb) {
    getJSON("data/site.json").catch(function () { return {}; }).then(function (site) {
      layout(site);
      if (cb) cb(site);
    });
  }

  window.SH2 = {
    cfg: CFG, esc: esc, safeUrl: safeUrl, el: el, getJSON: getJSON, init: init,
    todayISO: todayISO, parse: parse, fmtDate: fmtDate, fmtRange: fmtRange, fmtShort: fmtShort, md: md, isPast: isPast, isOngoing: isOngoing, dday: dday,
    loadEvents: loadEvents, splitEvents: splitEvents, eventCard: eventCard, eventUrl: eventUrl, statusTag: statusTag, catTag: catTag,
    openLightbox: openLightbox, closeLightbox: closeLightbox, toast: toast, share: share, shareEvent: shareEvent, bindEvents: bindEvents
  };
})();
