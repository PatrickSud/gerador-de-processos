// === RASTREAMENTO DE ACESSO (CONTROLE DE ACESSO) ===
// Este arquivo é clonado dentro do HTML publicado. Ele SÓ age quando a página
// publicada tem no <body>: data-slug="<slug>" e data-access-control="true".
// No editor (index.html) o <body> não tem data-slug, então tudo fica inerte.
//
// A chave "anon public" é pública por natureza (protegida por RLS, não por segredo).
(function () {
  "use strict";

  var CFG = {
    url: "https://xkcwidluzrxodaydyxfz.supabase.co",
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrY3dpZGx1enJ4b2RheWR5eGZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MTYwNjksImV4cCI6MjA5OTE5MjA2OX0.WcFpRYwnD-_qp_uyl3Va28x-QVdWRpLwZOAOCn_t-48",
    table: "acessos"
  };

  // Estado interno
  var trackingActive = false;
  var slug = "";
  var visitorId = "";
  var visitorName = "";
  var secsKey = "";
  var accumulatedSecs = 0;
  var activeStart = null; // timestamp (ms) desde que a aba ficou visível; null quando oculta
  var syncTimer = null;

  // Intercepta a atualização de progresso do script.js para sincronizar o acesso.
  // Executa no carregamento do tracker.js (após o script.js já ter definido a função).
  if (typeof window.updateOverallProgress === "function") {
    var _origUpdate = window.updateOverallProgress;
    window.updateOverallProgress = function () {
      var r = _origUpdate.apply(this, arguments);
      scheduleSync();
      return r;
    };
  }

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  function genId() {
    try {
      if (window.crypto && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
      }
    } catch (e) {}
    return "v-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function computeProgress() {
    var items = document.querySelectorAll(".faq-item");
    var total = items.length;
    var done = 0;
    var ultimo = null;
    for (var i = 0; i < items.length; i++) {
      var cb = items[i].querySelector(".q-checkbox");
      if (cb && cb.classList.contains("checked")) {
        done++;
        var t = items[i].querySelector(".qText");
        if (t) ultimo = t.textContent.trim();
      }
    }
    var pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return {
      total: total,
      done: done,
      pct: pct,
      ultimo: ultimo,
      concluido: total > 0 && done >= total
    };
  }

  function currentSecs() {
    var extra = activeStart != null ? Math.floor((Date.now() - activeStart) / 1000) : 0;
    return accumulatedSecs + extra;
  }

  function persistSecs() {
    try {
      localStorage.setItem(secsKey, String(currentSecs()));
    } catch (e) {}
  }

  function buildPayload() {
    var p = computeProgress();
    return {
      p_slug: slug,
      p_visitante_id: visitorId,
      p_visitante_nome: visitorName,
      p_passos: p.done,
      p_total: p.total,
      p_percentual: p.pct,
      p_ultimo_passo: p.ultimo,
      p_concluido: p.concluido,
      p_tempo: currentSecs()
    };
  }

  function sync(useKeepalive) {
    if (!trackingActive) return;
    persistSecs();
    var endpoint =
      CFG.url.replace(/\/+$/, "") + "/rest/v1/rpc/registrar_acesso";
    try {
      fetch(endpoint, {
        method: "POST",
        keepalive: !!useKeepalive,
        headers: {
          apikey: CFG.anonKey,
          Authorization: "Bearer " + CFG.anonKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(buildPayload())
      })
        .then(function (res) {
          if (!res.ok) {
            res.text().then(function (t) {
              console.error("[tracker] acessos HTTP " + res.status + ": " + t);
            }).catch(function () {});
          }
        })
        .catch(function (e) {
          console.error("[tracker] falha de rede ao enviar acesso:", e);
        });
    } catch (e) {}
  }

  function scheduleSync() {
    if (!trackingActive) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(function () {
      sync(false);
    }, 800);
  }

  function finalize() {
    if (activeStart != null) {
      accumulatedSecs += Math.floor((Date.now() - activeStart) / 1000);
      activeStart = null;
    }
    persistSecs();
    sync(true);
  }

  function startTracking() {
    trackingActive = true;
    try {
      accumulatedSecs = parseInt(localStorage.getItem(secsKey) || "0", 10) || 0;
    } catch (e) {
      accumulatedSecs = 0;
    }
    activeStart = document.visibilityState === "hidden" ? null : Date.now();

    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") {
        if (activeStart != null) {
          accumulatedSecs += Math.floor((Date.now() - activeStart) / 1000);
          activeStart = null;
        }
        sync(true);
      } else {
        activeStart = Date.now();
      }
    });

    window.addEventListener("pagehide", finalize);
    window.addEventListener("beforeunload", finalize);

    setInterval(function () {
      if (document.visibilityState === "visible") {
        persistSecs();
        sync(false);
      }
    }, 20000);

    // Sincronização inicial (registra o acesso já com o progresso salvo no navegador)
    sync(false);
  }

  function showNameGate(onDone) {
    var overlay = document.createElement("div");
    overlay.id = "sgd-name-gate";
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;" +
      "background:rgba(15,23,42,0.85);padding:20px;box-sizing:border-box;" +
      'font-family:system-ui,-apple-system,"Segoe UI",sans-serif;';
    overlay.innerHTML =
      '<div style="background:#fff;color:#0f172a;max-width:420px;width:100%;border-radius:16px;padding:28px;box-shadow:0 20px 60px rgba(0,0,0,0.4);text-align:center;box-sizing:border-box;">' +
      '<div style="font-size:34px;margin-bottom:8px;">👋</div>' +
      '<h2 style="margin:0 0 6px;font-size:20px;">Antes de começar</h2>' +
      '<p style="margin:0 0 18px;color:#475569;font-size:14px;">Informe seu nome para acessar este processo. Só pediremos uma vez neste navegador.</p>' +
      '<input id="sgd-name-input" type="text" placeholder="Seu nome completo" autocomplete="name" style="width:100%;box-sizing:border-box;padding:12px 14px;border:1px solid #cbd5e1;border-radius:10px;font-size:15px;outline:none;margin-bottom:14px;">' +
      '<button id="sgd-name-btn" style="width:100%;padding:12px;border:none;border-radius:10px;background:#6366f1;color:#fff;font-size:15px;font-weight:600;cursor:pointer;">Acessar processo</button>' +
      '<p id="sgd-name-err" style="color:#ef4444;font-size:13px;min-height:16px;margin:10px 0 0;"></p>' +
      "</div>";
    document.body.appendChild(overlay);
    var prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    var input = overlay.querySelector("#sgd-name-input");
    var btn = overlay.querySelector("#sgd-name-btn");
    var err = overlay.querySelector("#sgd-name-err");
    setTimeout(function () {
      try { input.focus(); } catch (e) {}
    }, 80);

    function submit() {
      var v = input.value.trim().replace(/\s+/g, " ");
      if (v.length < 2) {
        err.textContent = "Digite seu nome para continuar.";
        input.focus();
        return;
      }
      overlay.remove();
      document.documentElement.style.overflow = prevOverflow;
      onDone(v);
    }
    btn.addEventListener("click", submit);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") submit();
    });
  }

  ready(function () {
    var body = document.body;
    if (!body) return;
    slug = (body.getAttribute("data-slug") || "").trim();
    var ac = (body.getAttribute("data-access-control") || "") === "true";

    // Só age em página publicada COM controle de acesso ligado.
    if (!slug || !ac) return;

    secsKey = "sgd_track_" + slug + "_secs";

    try {
      visitorId = localStorage.getItem("sgd_visitor_id") || "";
      if (!visitorId) {
        visitorId = genId();
        localStorage.setItem("sgd_visitor_id", visitorId);
      }
      visitorName = (localStorage.getItem("sgd_visitor_nome") || "").trim();
    } catch (e) {
      // localStorage indisponível: gera id volátil e sempre pede o nome
      visitorId = genId();
      visitorName = "";
    }

    if (visitorName) {
      startTracking();
    } else {
      showNameGate(function (name) {
        visitorName = name;
        try {
          localStorage.setItem("sgd_visitor_nome", name);
        } catch (e) {}
        startTracking();
      });
    }
  });
})();
