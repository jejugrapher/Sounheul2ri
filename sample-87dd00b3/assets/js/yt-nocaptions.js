/* 유튜브 임베드의 자막(CC)이 기본으로 켜지지 않게 한다.
   - 주소의 cc_load_policy=0 만으로는 보는 사람 계정 설정에 따라 자막이 켜질 수 있어, 플레이어 API 로 자막 모듈을 내린다.
   - 임베드가 있는 쪽에서만 플레이어 API 를 불러온다. 나중에 생기는 임베드(행사 상세 창)도 처리한다.
   - 영상 화면에 구워 넣은 자막은 끌 수 없다. */
(function () {
  "use strict";
  var API = "https://www.youtube.com/iframe_api", asked = false;
  function isYT(s) { return /\/\/(www\.)?youtube(-nocookie)?\.com\/embed\//.test(s || ""); }
  function kill(p) { try { p.unloadModule("captions"); } catch (e) {} try { p.unloadModule("cc"); } catch (e) {} }
  function normalize(f) {
    var s = f.getAttribute("src") || "", o = s;
    s = s.replace(/([?&])cc_load_policy=1(&|$)/, "$1cc_load_policy=0$2");
    if (!/[?&]enablejsapi=1(&|$)/.test(s)) s += (s.indexOf("?") < 0 ? "?" : "&") + "enablejsapi=1";
    if (s !== o) f.setAttribute("src", s);
  }
  function attach(f) {
    if (!f || f.__nocap || !isYT(f.getAttribute("src"))) return;
    if (!window.YT || !YT.Player) { load(); return; }
    normalize(f); f.__nocap = true;
    try {
      new YT.Player(f, { events: {
        onReady: function (e) { kill(e.target); },
        onApiChange: function (e) { kill(e.target); },
        onStateChange: function (e) { if (e.data === YT.PlayerState.PLAYING || e.data === YT.PlayerState.BUFFERING) kill(e.target); }
      } });
    } catch (e) { f.__nocap = false; }
  }
  function scan() { var a = document.getElementsByTagName("iframe"); for (var i = 0; i < a.length; i++) attach(a[i]); }
  function load() {
    if (asked || window.YT) return; asked = true;
    var prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = function () { if (typeof prev === "function") { try { prev(); } catch (e) {} } scan(); };
    var t = document.createElement("script"); t.src = API; (document.head || document.documentElement).appendChild(t);
  }
  scan();
  if (window.MutationObserver) new MutationObserver(function () { scan(); }).observe(document.documentElement, { childList: true, subtree: true });
})();
