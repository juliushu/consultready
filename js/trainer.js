/* ConsultReady Web-Trainer – rendert Aufgaben aus engine.js (window.CR). Kein Framework, keine Abhängigkeiten. */
(function () {
  'use strict';
  var APP_CTA = '<p class="tr-cta">Mehr Aufgaben, alle 18 Aufgabentypen, Fehlertraining und komplette Simulationen gibt es in der App. <a href="../#app">ConsultReady ansehen</a></p>';

  function h(tag, attrs, html) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    if (html != null) el.innerHTML = html;
    return el;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmtNum(v) { return typeof v === 'number' ? v.toLocaleString('de-DE') : esc(v); }

  /* ---------- Figuren & Stimuli ---------- */
  function figureSvg(f, size) {
    var s = size / 4, out = '', fill = f.filled ? 'currentColor' : 'none';
    var pos = f.count === 1 ? [[2, 2]] : f.count === 2 ? [[1.15, 2], [2.85, 2]] : [[2, 1.15], [1.15, 2.85], [2.85, 2.85]];
    pos.forEach(function (p) {
      var cx = p[0] * s, cy = p[1] * s, r = s * 0.6, el;
      var common = 'fill="' + fill + '" stroke="currentColor" stroke-width="1.75"';
      if (f.shape === 'circle') el = '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" ' + common + '/>';
      else if (f.shape === 'square') el = '<rect x="' + (cx - r) + '" y="' + (cy - r) + '" width="' + 2 * r + '" height="' + 2 * r + '" ' + common + '/>';
      else if (f.shape === 'triangle') el = '<polygon points="' + cx + ',' + (cy - r) + ' ' + (cx + r) + ',' + (cy + r * 0.8) + ' ' + (cx - r) + ',' + (cy + r * 0.8) + '" ' + common + '/>';
      else el = '<polygon points="' + cx + ',' + (cy - r) + ' ' + (cx + r) + ',' + cy + ' ' + cx + ',' + (cy + r) + ' ' + (cx - r) + ',' + cy + '" ' + common + '/>';
      out += '<g transform="rotate(' + f.rotation + ' ' + cx + ' ' + cy + ')">' + el + '</g>';
    });
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' + out + '</svg>';
  }

  function stimulusHtml(st) {
    if (!st) return '';
    if (st.kind === 'text') return '<div class="tr-stim">' + (st.title ? '<div class="label">' + esc(st.title) + '</div>' : '') + '<p class="tr-pre">' + esc(st.body) + '</p></div>';
    if (st.kind === 'table') {
      var t = st.table, rows = '<tr>' + t.columns.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr>';
      t.rows.forEach(function (r) { rows += '<tr>' + r.map(function (c) { return '<td>' + fmtNum(c) + '</td>'; }).join('') + '</tr>'; });
      return '<div class="tr-stim"><div class="label">' + esc(t.title) + '</div><table class="tr-table">' + rows + '</table></div>';
    }
    if (st.kind === 'net') {
      var size = 46, w = 0, hgt = 0, cells = '';
      st.cells.forEach(function (c) { w = Math.max(w, c.x + 1); hgt = Math.max(hgt, c.y + 1); });
      st.cells.forEach(function (c) {
        cells += '<rect x="' + (c.x * size + 1) + '" y="' + (c.y * size + 1) + '" width="' + size + '" height="' + size + '" fill="var(--surface)" stroke="currentColor" stroke-width="1.5"/>' +
          '<text x="' + (c.x * size + 1 + size / 2) + '" y="' + (c.y * size + size / 2 + 8) + '" text-anchor="middle" font-size="20" font-weight="700" fill="currentColor">' + c.label + '</text>';
      });
      return '<div class="tr-stim tr-center"><svg width="' + (w * size + 2) + '" height="' + (hgt * size + 2) + '">' + cells + '</svg></div>';
    }
    if (st.kind === 'matrix') {
      var g = '<div class="tr-matrix">';
      st.cells.forEach(function (c) { g += '<div>' + (c ? figureSvg(c, 60) : '<span class="tr-q">?</span>') + '</div>'; });
      return '<div class="tr-stim tr-center">' + g + '</div></div>';
    }
    return '';
  }

  /* ---------- Trainer ---------- */
  function Trainer(root) {
    var cats = (root.getAttribute('data-cats') || '').split(',').filter(Boolean);
    var count = parseInt(root.getAttribute('data-count') || '10', 10);
    var mode = root.getAttribute('data-mode') || 'practice';
    var minutes = parseFloat(root.getAttribute('data-minutes') || '0');
    var qs, idx, answers, startedAt, timer, done;

    function start() {
      qs = window.CR.session(cats, count);
      idx = 0; answers = qs.map(function () { return null; }); done = false;
      startedAt = Date.now();
      if (timer) clearInterval(timer);
      if (mode === 'exam' && minutes) timer = setInterval(tick, 500);
      render();
    }
    function left() { return Math.max(0, Math.round(minutes * 60 - (Date.now() - startedAt) / 1000)); }
    function tick() {
      var el = root.querySelector('.tr-timer');
      var l = left();
      if (el) el.textContent = Math.floor(l / 60) + ':' + String(l % 60).padStart(2, '0');
      var pace = root.querySelector('.tr-pace');
      if (pace) {
        var elapsed = 1 - l / (minutes * 60), prog = answers.filter(Boolean).length / qs.length;
        pace.textContent = elapsed - prog > 0.08 ? 'Tempo: zu langsam' : 'Tempo: im Plan';
        pace.className = 'tr-pace ' + (elapsed - prog > 0.08 ? 'warn' : 'ok');
      }
      if (l === 0 && !done) finish();
    }

    function render() {
      var q = qs[idx], a = q.answer, ans = answers[idx];
      var answered = answers.filter(Boolean).length;
      var head = '<div class="tr-head"><span>Frage ' + (idx + 1) + ' / ' + qs.length + (mode === 'exam' ? ' · ' + answered + ' beantwortet' : '') + '</span>' +
        (mode === 'exam' ? '<span class="tr-pace ok">Tempo: im Plan</span><span class="tr-timer"></span>' : '<span class="tr-cat">' + esc(catTitle(q.category)) + '</span>') + '</div>' +
        '<div class="tr-bar"><i style="width:' + Math.round(((mode === 'exam' ? answered : idx) / qs.length) * 100) + '%"></i></div>';
      var opts = '<div class="tr-opts' + (a.figures ? ' tr-figs' : '') + '">';
      a.options.forEach(function (o, i) {
        var cls = 'tr-opt';
        if (mode === 'practice' && ans) cls += i === a.correct ? ' ok' : ans.choice === i ? ' bad' : '';
        else if (ans && ans.choice === i) cls += ' sel';
        opts += '<button class="' + cls + '" data-i="' + i + '"' + (mode === 'practice' && ans ? ' disabled' : '') + '><b>' + String.fromCharCode(65 + i) + '</b>' + (a.figures ? figureSvg(a.figures[i], 56) : '<span>' + esc(o) + '</span>') + '</button>';
      });
      opts += '</div>';
      var fb = '';
      if (mode === 'practice' && ans) {
        fb = '<div class="tr-fb ' + (ans.ok ? 'ok' : 'bad') + '"><strong>' + (ans.ok ? 'Richtig.' : 'Nicht ganz.') + '</strong><div class="label">Lösungsweg</div><p class="tr-pre">' + esc(q.explanation) + '</p>' +
          (q.tip ? '<p class="tr-tip">' + esc(q.tip) + '</p>' : '') + '<button class="tr-btn" data-act="next">' + (idx + 1 < qs.length ? 'Nächste Aufgabe' : 'Auswertung') + ' →</button></div>';
      }
      var nav = mode === 'exam' ? '<div class="tr-nav"><button data-act="prev">← Zurück</button><button data-act="grid">Übersicht</button><button data-act="skip">Überspringen →</button><button data-act="submit" class="tr-strong">Abgeben</button></div><div class="tr-grid" hidden></div>' : '';
      root.innerHTML = head + stimulusHtml(q.stimulus) + '<p class="tr-prompt">' + esc(q.prompt) + '</p>' + opts + fb + nav;
      if (mode === 'exam') tick();
    }

    function catTitle(id) { var c = window.CR.categories.filter(function (x) { return x.id === id; })[0]; return c ? c.title : id; }

    function choose(i) {
      var q = qs[idx];
      answers[idx] = { choice: i, ok: i === q.answer.correct };
      if (mode === 'exam') {
        var next = -1;
        for (var k = idx + 1; k < qs.length; k++) if (!answers[k]) { next = k; break; }
        if (next < 0) for (k = 0; k < qs.length; k++) if (!answers[k]) { next = k; break; }
        if (next >= 0) idx = next;
      }
      render();
    }

    function finish() {
      done = true;
      if (timer) clearInterval(timer);
      var ok = answers.filter(function (a) { return a && a.ok; }).length;
      var answered = answers.filter(Boolean).length, open = qs.length - answered;
      var byCat = {};
      qs.forEach(function (q, i) { var c = byCat[q.category] || (byCat[q.category] = [0, 0]); c[1]++; if (answers[i] && answers[i].ok) c[0]++; });
      var rows = Object.keys(byCat).map(function (c) { return '<tr><td>' + esc(catTitle(c)) + '</td><td>' + byCat[c][0] + ' / ' + byCat[c][1] + '</td></tr>'; }).join('');
      var sweep = qs.reduce(function (s, q, i) { return s + (answers[i] ? 0 : 1 / q.answer.options.length); }, 0);
      var secs = Math.round((Date.now() - startedAt) / 1000);
      root.innerHTML = '<div class="tr-result"><div class="label">Ergebnis</div><div class="tr-score">' + ok + '<small> / ' + qs.length + '</small></div>' +
        '<p>' + (mode === 'exam' ? answered + ' beantwortet · ' + open + ' leer · ' : '') + Math.floor(secs / 60) + ' Min. ' + (secs % 60) + ' Sek.</p>' +
        (open ? '<p class="tr-tip">Ein Blind-Sweep über die ' + open + ' leeren Fragen hätte im Schnitt ' + sweep.toFixed(1).replace('.', ',') + ' Punkte gebracht. Ohne Minuspunkte gilt: nie eine Frage leer lassen.</p>' : '') +
        '<table class="tr-table">' + rows + '</table><button class="tr-btn" data-act="restart">Neue Runde</button>' + APP_CTA + '</div>';
    }

    root.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || done && b.getAttribute('data-act') !== 'restart') { if (!b) return; }
      var act = b.getAttribute('data-act');
      if (b.hasAttribute('data-i')) return choose(parseInt(b.getAttribute('data-i'), 10));
      if (act === 'next') { if (idx + 1 < qs.length) { idx++; render(); } else finish(); }
      else if (act === 'prev') { idx = Math.max(0, idx - 1); render(); }
      else if (act === 'skip') { idx = Math.min(qs.length - 1, idx + 1); render(); }
      else if (act === 'submit') finish();
      else if (act === 'restart') start();
      else if (act === 'grid') {
        var g = root.querySelector('.tr-grid');
        g.innerHTML = qs.map(function (_, i) { return '<button data-go="' + i + '" class="' + (answers[i] ? 'done' : '') + (i === idx ? ' cur' : '') + '">' + (i + 1) + '</button>'; }).join('');
        g.hidden = !g.hidden;
      } else if (b.hasAttribute('data-go')) { idx = parseInt(b.getAttribute('data-go'), 10); render(); }
    });
    root.innerHTML = '<div class="tr-start"><p>' + (mode === 'exam' ? qs_label() : count + ' Aufgaben mit Lösungsweg') + '</p><button class="tr-btn" data-act="restart">Starten</button></div>';
    function qs_label() { return count + ' Fragen · ' + String(minutes).replace('.', ',') + ' Minuten · freies Springen · keine Minuspunkte'; }
  }

  /* ---------- Werkzeuge ---------- */
  function triagePlanner(root) {
    root.innerHTML = '<div class="tool-row"><label>Fragen <input type="number" min="5" max="200" value="80" data-f="n"></label><label>Minuten <input type="number" min="1" max="180" value="30" data-f="m"></label></div><div class="tool-out"></div>';
    function upd() {
      var n = +root.querySelector('[data-f=n]').value || 80, m = +root.querySelector('[data-f=m]').value || 30;
      var per = (m * 60) / n;
      var rows = [[0, 0.33, 'Erster Durchgang: nur Fragen unter ~' + Math.round(per * 0.7) + ' Sek. lösen'], [0.33, 0.67, 'Ersten Durchgang beenden – alle Fragen einmal gesehen'], [0.67, 0.9, 'Zweiter Durchgang: übersprungene, mittelschwere Fragen'], [0.9, 1, 'Blind-Sweep: jede offene Frage beantworten']];
      root.querySelector('.tool-out').innerHTML = '<p><strong>' + per.toFixed(1).replace('.', ',') + ' Sekunden</strong> pro Frage. Checkpoint: Bei Frage ' + Math.round(n * 0.3) + ' sollten ' + Math.round(m * 0.3) + ' Minuten vergangen sein.</p><table class="tr-table">' +
        rows.map(function (r) { return '<tr><td>' + Math.round(r[0] * m) + '–' + Math.round(r[1] * m) + ' Min.</td><td>' + r[2] + '</td></tr>'; }).join('') + '</table>';
    }
    root.addEventListener('input', upd); upd();
  }
  function alphabet(root) {
    var abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    root.innerHTML = '<div class="abc">' + abc.map(function (c, i) { return '<div><b>' + c + '</b><span>' + (i + 1) + '</span><em>' + (26 - i) + '</em></div>'; }).join('') + '</div><p class="tool-hint">Obere Zahl: Position vorwärts · untere Zahl: rückwärts (Z = 1). Genau so vor dem Test auf den Notizzettel schreiben.</p>';
  }
  function hours(root) {
    root.innerHTML = '<div class="tool-row"><label>Strecke (km) <input type="number" step="0.01" value="31.5" data-f="s"></label><label>Tempo (km/h) <input type="number" step="0.01" value="4.5" data-f="v"></label></div><div class="tool-out"></div>';
    function upd() {
      var s = +root.querySelector('[data-f=s]').value, v = +root.querySelector('[data-f=v]').value;
      if (!s || !v) return;
      var t = s / v, mins = Math.round(t * 60);
      root.querySelector('.tool-out').innerHTML = '<p>' + t.toFixed(2).replace('.', ',') + ' h = <strong>' + Math.floor(mins / 60) + ' h ' + (mins % 60) + ' min</strong></p><p class="tool-hint">Nachkommastellen × 60 = Minuten. 0,' + String(Math.round((t % 1) * 100)).padStart(2, '0') + ' h sind ' + Math.round((t % 1) * 60) + ' Minuten – nicht ' + Math.round((t % 1) * 100) + '.</p>';
    }
    root.addEventListener('input', upd); upd();
  }

  /* Individueller Vorbereitungsplan: gleiche Phasenlogik wie in der App */
  var PLAN_TESTS = {
    kognitiv: { name: 'Kognitivtest (80 Fragen)', sim: '<a href="kognitivtest-schnelltest.html">Kognitivtest-Schnelltest</a> (App: volle Simulation)', types: [['Zahlenreihen', 'zahlenreihen.html'], ['Buchstabenlogik', 'buchstabenlogik.html'], ['Textaufgaben & Altersrätsel', 'textaufgaben.html'], ['Wortschatz & Analogien', 'wortschatz.html'], ['Kritisches Lesen', 'kritisches-lesen.html'], ['Syllogismen', 'syllogismen.html'], ['Würfelnetze', 'wuerfelnetze.html'], ['Regelketten', 'regelketten.html'], ['Matrizen', 'matrizen.html']] },
    solve: { name: 'Solve-Format', sim: 'Solve-Simulation in der App', types: [['Datenanalyse & Hypothesen (App)', ''], ['Optimierung unter Nebenbedingungen (App)', ''], ['Ökosystem (App)', ''], ['Kopfrechnen', 'kopfrechnen.html']] },
    sova: { name: 'SOVA / TestGorilla', sim: 'SOVA-Simulation in der App', types: [['Textaufgaben & Prozent', 'textaufgaben.html'], ['Zahlenreihen', 'zahlenreihen.html'], ['Matrizen', 'matrizen.html'], ['Kritisches Lesen', 'kritisches-lesen.html'], ['Situational Judgement (App)', '']] },
    analytisch: { name: 'Analytischer Test', sim: 'Analytische Simulation in der App', types: [['Kopfrechnen', 'kopfrechnen.html'], ['Textaufgaben & Prozent', 'textaufgaben.html'], ['Zahlenreihen', 'zahlenreihen.html']] },
    shl: { name: 'SHL-Format', sim: 'SHL-Simulation in der App', types: [['Textaufgaben & Prozent', 'textaufgaben.html'], ['Kritisches Lesen', 'kritisches-lesen.html'], ['Matrizen', 'matrizen.html'], ['Syllogismen', 'syllogismen.html']] },
  };
  function planTool(root) {
    var opts = Object.keys(PLAN_TESTS).map(function (k) { return '<option value="' + k + '">' + PLAN_TESTS[k].name + '</option>'; }).join('');
    root.innerHTML = '<div class="tool-row"><label>Tage bis zum Test <input type="number" min="1" max="60" value="14" data-f="d"></label><label>Minuten pro Tag <input type="number" min="10" max="120" step="5" value="30" data-f="m"></label><label>Zieltest <select data-f="t">' + opts + '</select></label></div><div class="tool-out"></div>';
    function link(t) { return t[1] ? '<a href="' + t[1] + '">' + t[0] + '</a>' : t[0]; }
    function upd() {
      var d = Math.max(1, Math.min(60, +root.querySelector('[data-f=d]').value || 14));
      var m = Math.max(10, Math.min(120, +root.querySelector('[data-f=m]').value || 30));
      var test = PLAN_TESTS[root.querySelector('[data-f=t]').value];
      var perDay = m >= 45 ? 2 : 1, types = test.types, ti = 0, rows = '';
      var basicsEnd = d <= 4 ? 0 : Math.round(d * 0.4), speedEnd = d <= 4 ? Math.ceil(d / 2) : Math.round(d * 0.8);
      for (var day = 1; day <= d; day++) {
        var date = new Date(Date.now() + (day - 1) * 86400000).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' });
        var phase, focus;
        if (day === d && d > 1) { phase = 'Letzter Tag'; focus = 'Lockere Runde, Fehler kurz wiederholen, früh schlafen.'; }
        else if (day === 1 && d > 2) { phase = 'Start'; focus = 'Standort bestimmen: ' + test.sim + '.'; }
        else if (day <= basicsEnd) { phase = 'Grundlagen'; var f = []; for (var k = 0; k < perDay; k++) f.push(link(types[ti++ % types.length])); focus = f.join(' + ') + ' – ohne Zeitdruck, Lösungswege lesen.'; }
        else if (day <= speedEnd) { phase = 'Tempo'; var g = []; for (var j = 0; j < perDay; j++) g.push(link(types[ti++ % types.length])); focus = g.join(' + ') + ' – mit Zeitlimit.'; }
        else { phase = 'Simulation'; focus = test.sim + ', danach Fehler wiederholen.'; }
        rows += '<tr><td>' + day + ' · ' + date + '</td><td><strong>' + phase + '</strong><br>' + focus + '</td></tr>';
      }
      root.querySelector('.tool-out').innerHTML = '<p>' + d + ' Tage × ' + m + ' Min. = <strong>' + Math.round((d * m) / 60) + ' Stunden</strong> Training. ' + (d < 5 ? 'Kurze Vorbereitung: direkt Tempo und Simulation.' : 'Phasen: Grundlagen → Tempo → Simulation.') + '</p><table class="tr-table">' + rows + '</table>';
    }
    root.addEventListener('input', upd); root.addEventListener('change', upd); upd();
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-tool=plan]').forEach(planTool);
    document.querySelectorAll('.cr-trainer').forEach(Trainer);
    document.querySelectorAll('[data-tool=triage]').forEach(triagePlanner);
    document.querySelectorAll('[data-tool=abc]').forEach(alphabet);
    document.querySelectorAll('[data-tool=hours]').forEach(hours);
  });
})();
