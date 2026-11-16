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
  function eventCard(ev) {
    var pic = safeUrl((ev.photos || [])[0]) || safeUrl(ev.poster);
    var thumb = pic
      ? '<div class="thumb"><img src="' + esc(pic) + '" alt="" loading="lazy">' + (CFG.sampleLabels !== false && /\/fl_/.test(pic) ? '<span class="sample">예시 그림(AI 생성)</span>' : "") + "</div>"
      : '<div class="thumb plain">' + RIDGE + "<b>" + (ev.start ? "<small>" + esc(ev.start.slice(0, 4)) + "</small>" + esc(md(ev.start)) + (ev.end && ev.end !== ev.start ? " – " + esc(md(ev.end)) : "") : esc(ev.usual || "해마다")) + "</b></div>";
    return '<article class="card" data-open="' + esc(ev.id) + '" role="button" tabindex="0">' + thumb +
      '<div class="body">' +
      '<div class="tags">' + statusTag(ev) + catTag(ev) + "</div>" +
      '<span class="when">' + esc(fmtShort(ev)) + "</span>" +
      "<h3>" + esc(ev.title) + "</h3>" +
      (ev.place ? '<span class="meta">' + esc(ev.place) + "</span>" : "") +
      '<div class="card-foot"><span class="more">자세히 보기 →</span>' +
      '<button class="share-btn" data-share="' + esc(ev.id) + '">공유</button></div>' +
      "</div></article>";
  }
  function eventDetail(ev) {
    var h = '<button class="x" data-close aria-label="닫기">✕</button>';
    h += '<div class="tags">' + statusTag(ev) + catTag(ev) + "</div>";
    h += "<h2>" + esc(ev.title) + "</h2>";
    h += '<p class="when" style="font-size:1rem">' + esc(fmtRange(ev)) + (ev.time ? " · " + esc(ev.time) : "") + "</p>";
    if (safeUrl(ev.poster)) h += '<img class="poster" src="' + esc(safeUrl(ev.poster)) + '" alt="' + esc(ev.title) + ' 포스터">';
    h += '<table class="facts" style="margin:14px 0">';
    [["장소", ev.place], ["주소", ev.address], ["주최", ev.host], ["참가비", ev.fee], ["문의", ev.contact]].forEach(function (r) {
      if (r[1]) h += "<tr><th>" + r[0] + "</th><td>" + (r[0] === "문의" && /^[0-9\-]+$/.test(r[1]) ? '<a href="tel:' + esc(r[1]) + '">' + esc(r[1]) + "</a>" : esc(r[1])) + "</td></tr>";
    });
    h += "</table>";
    if (ev.summary) h += "<p>" + esc(ev.summary) + "</p>";
    if ((ev.program || []).length) h += '<h3 style="margin-top:14px">프로그램</h3><ul class="prog">' + ev.program.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ul>";
    if (ev.video) h += '<div class="video" style="margin-top:14px"><iframe src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(ev.video) + '?cc_load_policy=0&enablejsapi=1" title="' + esc(ev.title) + '" allowfullscreen loading="lazy"></iframe></div>';
    var ph = (ev.photos || []).map(safeUrl).filter(Boolean);
    if (ph.some(function (u) { return /\/fl_/.test(u); })) h += '<p class="note" style="margin-top:12px">아래 사진 가운데 일부는 AI 로 그린 예시 그림입니다.</p>';
    if (ph.length) h += '<div class="photos" style="margin-top:14px">' + ph.map(function (u) { return '<a href="' + esc(u) + '" target="_blank" rel="noopener"><img src="' + esc(u) + '" alt="' + esc(ev.title) + ' 사진" loading="lazy"></a>'; }).join("") + "</div>";
    var links = (ev.links || []).filter(function (l) { return safeUrl(l.url); });
    if (links.length) h += '<p class="src" style="margin-top:14px">관련 글: ' + links.map(function (l) { return '<a href="' + esc(safeUrl(l.url)) + '" target="_blank" rel="noopener">' + esc(l.label || "바로가기") + "</a>"; }).join(" · ") + "</p>";
    h += '<div class="row-actions" style="margin-top:16px">' + (ev.survey_open ? '<a class="btn" href="survey.html?e=' + encodeURIComponent(ev.id) + '">만족도 조사 참여하기</a>' : "") + '<button class="btn line" data-share="' + esc(ev.id) + '">이 행사 공유하기</button></div>';
    return h;
  }
  var modal, lastFocus;
  function openModal(html) {
    if (!modal) {
      modal = document.createElement("div");
      modal.className = "modal";
      modal.innerHTML = '<div class="sheet" role="dialog" aria-modal="true" aria-label="행사 안내" tabindex="-1"></div>';
      document.body.appendChild(modal);
      modal.addEventListener("click", function (e) {
        if (e.target === modal || e.target.hasAttribute("data-close")) closeModal();
      });
      document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeModal(); });
    }
    if (!modal.classList.contains("open")) lastFocus = document.activeElement;
    modal.firstChild.innerHTML = html;
    modal.classList.add("open");
    modal.firstChild.scrollTop = 0;
    try { modal.firstChild.focus({ preventScroll: true }); } catch (e) {}
  }
  function closeModal() {
    if (!modal || !modal.classList.contains("open")) return;
    modal.classList.remove("open");
    modal.firstChild.innerHTML = "";  /* 영상이 계속 재생되지 않게 비운다 */
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
  }

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
  /* 카드의 자세히·공유 단추 연결 */
  function bindEvents(root, list) {
    var byId = {};
    list.forEach(function (e) { byId[e.id] = e; });
    root.addEventListener("click", function (e) {
      var b = e.target.closest("[data-open],[data-share]");
      if (!b) return;
      var id = b.getAttribute("data-open") || b.getAttribute("data-share");
      var ev = byId[id];
      if (!ev) return;
      if (b.hasAttribute("data-open")) { openModal(eventDetail(ev)); history.replaceState(null, "", "#" + id); }
      else share(ev.title + " — 선흘2리", location.origin + location.pathname.replace(/[^/]*$/, "") + (isPast(ev) ? "archive.html" : "events.html") + "#" + id);
    });
    document.addEventListener("click", function (e) {
      var b = e.target.closest(".modal [data-share]");
      if (b && byId[b.getAttribute("data-share")]) {
        var ev = byId[b.getAttribute("data-share")];
        share(ev.title + " — 선흘2리", location.origin + location.pathname + "#" + ev.id);
      }
    });
    root.addEventListener("keydown", function (e) {
      if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches('[data-open][role="button"]')) { e.preventDefault(); e.target.click(); }
    });
    var h = decodeURIComponent(location.hash.slice(1));
    if (h && byId[h]) openModal(eventDetail(byId[h]));
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
    loadEvents: loadEvents, splitEvents: splitEvents, eventCard: eventCard, eventDetail: eventDetail,
    openModal: openModal, closeModal: closeModal, toast: toast, share: share, bindEvents: bindEvents
  };
})();
