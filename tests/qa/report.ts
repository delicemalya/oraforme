/**
 * tests/qa/report.ts — Générateur de rapport HTML QA-001
 *
 * Produit un rapport complet avec :
 *   - En-tête de certification + verdict
 *   - Par scénario : Evidence (before/after, console, réseau, SQL, perf)
 *   - Tableau Performance global
 *   - Règles QA-001 affichées
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import type { CertificationReport, ScenarioEvidence, NetworkRequest, ConsoleLine } from './types.js'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function ms(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(2)}s` : `${Math.round(n)}ms`
}

function screenshotImg(relPath: string, outDir: string, label: string): string {
  const absPath = path.join(outDir, relPath)
  if (!fs.existsSync(absPath)) {
    return `<div class="ss-missing">📷 ${esc(label)} — capture non disponible</div>`
  }
  const data  = fs.readFileSync(absPath)
  const b64   = data.toString('base64')
  return `<figure class="ss-wrap">
    <img src="data:image/png;base64,${b64}" alt="${esc(label)}" loading="lazy"/>
    <figcaption>${esc(label)}</figcaption>
  </figure>`
}

function networkTable(reqs: NetworkRequest[]): string {
  if (!reqs.length) return '<p class="empty">Aucune requête.</p>'
  const rows = reqs.slice(0, 40).map(r => {
    const statusClass = r.status === null ? 'err'
      : r.status >= 500 ? 'err'
      : r.status >= 400 ? 'warn'
      : 'ok'
    const badge = r.isSupabase ? '<span class="nb-supabase">SB</span>'
      : r.isRealtime ? '<span class="nb-rt">RT</span>' : ''
    return `<tr>
      <td class="mono truncate" title="${esc(r.url)}">${badge}${esc(r.url.replace(/^https?:\/\/[^/]+/, ''))}</td>
      <td>${esc(r.method)}</td>
      <td class="${statusClass}">${r.status ?? 'ERR'}</td>
      <td>${ms(r.duration)}</td>
      <td>${r.error ? `<span class="err-text">${esc(r.error)}</span>` : `${(r.size / 1024).toFixed(1)}kb`}</td>
    </tr>`
  }).join('')
  return `<table class="net-table">
    <thead><tr><th>URL</th><th>Méthode</th><th>Status</th><th>Durée</th><th>Taille / Erreur</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>${reqs.length > 40 ? `<p class="empty">… et ${reqs.length - 40} requêtes supplémentaires</p>` : ''}`
}

function consoleTable(logs: ConsoleLine[]): string {
  if (!logs.length) return '<p class="empty">Aucun log console.</p>'
  const rows = logs.slice(0, 60).map(l => {
    const cls = l.type === 'error' ? 'err' : l.type === 'warn' ? 'warn' : 'ok'
    return `<tr class="${cls}">
      <td class="mono">[+${ms(l.ts)}]</td>
      <td><span class="log-type log-${l.type}">${l.type.toUpperCase()}</span>${l.isReact ? ' <span class="react-badge">REACT</span>' : ''}</td>
      <td class="mono log-text">${esc(l.text.slice(0, 300))}</td>
    </tr>`
  }).join('')
  return `<table class="log-table">
    <thead><tr><th>T+</th><th>Type</th><th>Message</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`
}

function sqlProofBlock(proofs: ScenarioEvidence['sqlProofs']): string {
  if (!proofs.length) return ''
  return proofs.map(p => `
  <div class="sql-proof">
    <div class="sql-proof-head">
      <span class="sql-label">${esc(p.label)}</span>
      <span class="sql-meta">${p.rows >= 0 ? `${p.rows} ligne(s)` : 'non exécuté'} · ${ms(p.durationMs)}</span>
    </div>
    <pre class="sql-query">${esc(p.query)}</pre>
    <pre class="sql-result">${esc(JSON.stringify(p.result, null, 2).slice(0, 2000))}</pre>
  </div>`).join('')
}

function perfRow(label: string, value: string, cls = ''): string {
  return `<tr><td>${esc(label)}</td><td class="perf-val ${cls}">${esc(value)}</td></tr>`
}

function scenarioBlock(ev: ScenarioEvidence, outDir: string): string {
  const statusClass = ev.status === 'PASS' ? 'pass' : ev.status === 'FAIL' ? 'fail' : 'skip'
  const perfTable = `<table class="perf-table">
    <tbody>
      ${perfRow('Durée scénario',     ms(ev.durationMs),             ev.durationMs > 5000 ? 'warn' : 'ok')}
      ${perfRow('Chargement page',    ms(ev.perf.loadTimeMs),        ev.perf.loadTimeMs > 3000 ? 'warn' : 'ok')}
      ${perfRow('Requêtes réseau',    String(ev.perf.requestCount))}
      ${perfRow('Temps API moyen',    ms(ev.perf.apiTimeMs))}
      ${perfRow('Temps SQL moyen',    ms(ev.perf.sqlTimeMs))}
      ${perfRow('Mémoire JS heap',    `${ev.perf.memoryUsedMb} MB`,  ev.perf.memoryUsedMb > 200 ? 'warn' : 'ok')}
      ${perfRow('Mutations DOM',      String(ev.perf.domMutations))}
      ${perfRow('Erreurs console',    String(ev.perf.consoleErrors),  ev.perf.consoleErrors > 0 ? 'warn' : 'ok')}
      ${perfRow('Warnings console',   String(ev.perf.consoleWarnings))}
      ${perfRow('Warnings React',     String(ev.perf.reactWarnings),  ev.perf.reactWarnings > 0 ? 'warn' : 'ok')}
      ${perfRow('Subs Realtime (WS)', String(ev.perf.realtimeSubs))}
    </tbody>
  </table>`

  return `
<section class="scenario-block ${statusClass}" id="${esc(ev.id)}">
  <div class="scenario-head">
    <span class="sid">${esc(ev.id)}</span>
    <h3>${esc(ev.name)}</h3>
    <span class="s-badge s-${statusClass}">${ev.status}</span>
    <span class="s-dur">${ms(ev.durationMs)}</span>
  </div>
  ${ev.failReason ? `<div class="fail-reason">Raison : ${esc(ev.failReason)}</div>` : ''}

  <div class="evidence-section">

    <div class="ev-sub-head">Captures d'écran</div>
    <div class="screenshots">
      ${screenshotImg(ev.screenshotBefore, outDir, `${ev.id} · Avant`)}
      ${screenshotImg(ev.screenshotAfter,  outDir, `${ev.id} · Après`)}
    </div>

    <div class="ev-sub-head">Performance</div>
    ${perfTable}

    <div class="ev-two-col">
      <div>
        <div class="ev-sub-head">Console (${ev.consoleLogs.length} lignes · ${ev.perf.consoleErrors} erreurs)</div>
        ${consoleTable(ev.consoleLogs)}
      </div>
      <div>
        <div class="ev-sub-head">Réseau — erreurs &amp; Supabase (${ev.networkErrors.length} erreurs · ${ev.supabaseRequests.length} SB)</div>
        ${networkTable([...ev.networkErrors, ...ev.supabaseRequests.filter(r => r.status !== null && r.status < 400)])}
      </div>
    </div>

    ${ev.sqlProofs.length ? `<div class="ev-sub-head">Preuves SQL (${ev.sqlProofs.length})</div>${sqlProofBlock(ev.sqlProofs)}` : ''}

  </div>
</section>`
}

export function generateReport(report: CertificationReport, outDir: string): string {
  const verdictClass = report.verdict === 'CERTIFIED' ? 'pass'
    : report.verdict === 'REJECTED' ? 'fail' : 'warn'

  const scenarioBlocks = report.scenarios.map(s => scenarioBlock(s, outDir)).join('\n')

  // Global perf aggregates
  const avgLoad  = Math.round(report.scenarios.reduce((a, s) => a + s.perf.loadTimeMs, 0) / (report.scenarios.length || 1))
  const totalReq = report.scenarios.reduce((a, s) => a + s.perf.requestCount, 0)
  const totalErr = report.scenarios.reduce((a, s) => a + s.perf.consoleErrors, 0)
  const totalRW  = report.scenarios.reduce((a, s) => a + s.perf.reactWarnings, 0)
  const maxMem   = Math.max(...report.scenarios.map(s => s.perf.memoryUsedMb))

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(report.id)} — QA-001 Certification · Oraforme</title>
<style>
:root {
  --bg:#F0F4F8;--surface:#fff;--surface2:#F7FAFC;--border:#D1DCE7;
  --navy:#0F1923;--navy2:#1A2D3D;--text:#111827;--text2:#4B5A6A;--text3:#7A8FA3;
  --pass:#059669;--pass-bg:#ECFDF5;--pass-bd:#A7F3D0;
  --warn:#B45309;--warn-bg:#FFFBEB;--warn-bd:#FDE68A;
  --fail:#DC2626;--fail-bg:#FEF2F2;--fail-bd:#FECACA;
  --accent:#10B981;--mono:'SF Mono','Cascadia Code','Consolas',monospace;
}
@media(prefers-color-scheme:dark){:root{
  --bg:#080E14;--surface:#0F1923;--surface2:#142030;--border:#1E3044;
  --text:#E8F1F8;--text2:#8BA3BA;--text3:#4D6678;
  --pass-bg:#022C22;--pass-bd:#064E3B;--warn-bg:#1C1200;--warn-bd:#451A03;
  --fail-bg:#1A0000;--fail-bd:#7F1D1D;
}}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:13px;line-height:1.6}
/* Header */
.cert-header{background:var(--navy);color:#E8F1F8;padding:36px 48px;display:flex;justify-content:space-between;align-items:flex-start;gap:32px;flex-wrap:wrap}
.cert-eyebrow{font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);margin-bottom:10px}
.cert-title{font-size:24px;font-weight:700;letter-spacing:-.02em;color:#F0F8FF;margin-bottom:6px}
.cert-sub{font-size:13px;color:#8BA3BA}
.cert-meta{display:flex;flex-direction:column;gap:5px;margin-top:20px}
.cert-meta-row{display:flex;gap:10px;font-size:11px}
.cert-meta-label{color:#4D6678;width:80px;flex-shrink:0;text-transform:uppercase;letter-spacing:.06em;font-weight:500}
.cert-meta-val{color:#C9DCE8;font-family:var(--mono);font-size:11px}
.cert-verdict{display:flex;flex-direction:column;align-items:flex-end;gap:14px}
.verdict-badge{display:flex;align-items:center;gap:10px;padding:14px 20px;border-radius:4px;border:1px solid}
.verdict-badge.pass{background:rgba(16,185,129,.15);border-color:rgba(16,185,129,.4)}
.verdict-badge.fail{background:rgba(220,38,38,.15);border-color:rgba(220,38,38,.4)}
.verdict-badge.warn{background:rgba(180,83,9,.15);border-color:rgba(180,83,9,.4)}
.verdict-icon{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.pass .verdict-icon{background:var(--accent)}
.fail .verdict-icon{background:var(--fail)}
.warn .verdict-icon{background:var(--warn)}
.verdict-text strong{display:block;font-size:16px;letter-spacing:.03em}
.pass .verdict-text strong{color:#A7F3D0}
.fail .verdict-text strong{color:#FCA5A5}
.verdict-text span{font-size:11px;color:#4D9C80}
.cert-score{font-size:11px;color:#4D6678;text-align:right}
.cert-score strong{display:block;font-size:22px;color:var(--accent);line-height:1}
/* Body */
.cert-body{max-width:1200px;margin:0 auto;padding:40px 32px 80px;display:flex;flex-direction:column;gap:40px}
/* TOC */
.toc{background:var(--surface);border:1px solid var(--border);border-radius:4px;padding:20px 24px}
.toc h2{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--text3);margin-bottom:12px}
.toc-grid{display:flex;flex-wrap:wrap;gap:8px}
.toc-item{display:flex;align-items:center;gap:6px;font-size:12px;text-decoration:none;color:var(--text2);padding:4px 10px;border:1px solid var(--border);border-radius:3px;background:var(--surface2)}
.toc-item:hover{border-color:var(--accent);color:var(--accent)}
.toc-item .dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.toc-item .dot.pass{background:var(--pass)}
.toc-item .dot.fail{background:var(--fail)}
.toc-item .dot.skip{background:var(--text3)}
/* Global perf strip */
.gperf{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.gp-card{background:var(--surface);border:1px solid var(--border);border-radius:4px;padding:16px 18px}
.gp-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--text3);margin-bottom:6px}
.gp-val{font-size:26px;font-weight:700;letter-spacing:-.02em;color:var(--text);font-variant-numeric:tabular-nums}
.gp-val.warn{color:var(--warn)} .gp-val.ok{color:var(--pass)}
/* Section */
.section-head{display:flex;align-items:center;gap:10px;margin-bottom:16px}
.section-label{font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--text3)}
.section-rule{flex:1;height:1px;background:var(--border)}
/* Scenario */
.scenario-block{background:var(--surface);border:1px solid var(--border);border-radius:4px;overflow:hidden}
.scenario-block.pass{border-left:4px solid var(--pass)}
.scenario-block.fail{border-left:4px solid var(--fail)}
.scenario-block.skip{border-left:4px solid var(--text3)}
.scenario-head{display:flex;align-items:center;gap:12px;padding:14px 20px;border-bottom:1px solid var(--border);background:var(--surface2)}
.sid{font-family:var(--mono);font-size:11px;font-weight:700;color:var(--text3);background:var(--bg);border:1px solid var(--border);padding:2px 7px;border-radius:2px}
.scenario-head h3{flex:1;font-size:14px;font-weight:600;color:var(--text);letter-spacing:-.01em}
.s-badge{font-size:10px;font-weight:700;letter-spacing:.06em;padding:2px 8px;border-radius:2px;border:1px solid}
.s-pass{background:var(--pass-bg);color:var(--pass);border-color:var(--pass-bd)}
.s-fail{background:var(--fail-bg);color:var(--fail);border-color:var(--fail-bd)}
.s-skip{background:var(--surface2);color:var(--text3);border-color:var(--border)}
.s-dur{font-family:var(--mono);font-size:11px;color:var(--text3)}
.fail-reason{background:var(--fail-bg);color:var(--fail);padding:10px 20px;font-size:12px;border-bottom:1px solid var(--fail-bd)}
/* Evidence */
.evidence-section{padding:20px}
.ev-sub-head{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--text3);margin:16px 0 8px;padding-bottom:4px;border-bottom:1px solid var(--border)}
.ev-sub-head:first-child{margin-top:0}
.screenshots{display:flex;gap:12px;flex-wrap:wrap}
.ss-wrap{flex:1;min-width:240px;border:1px solid var(--border);border-radius:3px;overflow:hidden}
.ss-wrap img{width:100%;display:block;max-height:280px;object-fit:cover;object-position:top}
.ss-wrap figcaption{padding:6px 10px;font-size:11px;color:var(--text3);background:var(--surface2);border-top:1px solid var(--border)}
.ss-missing{background:var(--surface2);border:1px dashed var(--border);border-radius:3px;padding:20px;text-align:center;font-size:12px;color:var(--text3);flex:1}
.ev-two-col{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:4px}
@media(max-width:700px){.ev-two-col{grid-template-columns:1fr}}
/* Tables */
.net-table,.log-table,.perf-table{width:100%;border-collapse:collapse;font-size:11.5px;font-variant-numeric:tabular-nums}
.net-table th,.log-table th,.perf-table th{text-align:left;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);padding:7px 10px;border-bottom:1px solid var(--border);background:var(--surface2)}
.net-table td,.log-table td,.perf-table td{padding:7px 10px;border-bottom:1px solid var(--border);vertical-align:top}
.net-table tr:last-child td,.log-table tr:last-child td,.perf-table tr:last-child td{border-bottom:none}
.ok{color:var(--pass)} .warn{color:var(--warn)} .err{color:var(--fail)}
.perf-val.ok{color:var(--pass);font-weight:600} .perf-val.warn{color:var(--warn);font-weight:600}
.mono{font-family:var(--mono);font-size:10.5px}
.truncate{max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nb-supabase{background:#1E3A5F;color:#60A5FA;border-radius:2px;padding:1px 4px;font-size:9px;font-weight:700;margin-right:4px}
.nb-rt{background:#3B1F5E;color:#C4B5FD;border-radius:2px;padding:1px 4px;font-size:9px;font-weight:700;margin-right:4px}
.log-type{border-radius:2px;padding:1px 5px;font-size:9px;font-weight:700;margin-right:4px}
.log-error{background:#FEE2E2;color:#DC2626} .log-warn{background:#FEF3C7;color:#D97706}
.log-info,.log-log{background:#EFF6FF;color:#2563EB} .log-debug{background:var(--surface2);color:var(--text3)}
.react-badge{background:#61DAFB22;color:#0EA5E9;border-radius:2px;padding:1px 5px;font-size:9px;font-weight:700}
.log-text{max-width:420px;word-break:break-all;white-space:pre-wrap}
.err-text{color:var(--fail)}
.empty{font-size:11px;color:var(--text3);padding:8px 0}
/* SQL proof */
.sql-proof{background:var(--surface2);border:1px solid var(--border);border-radius:3px;overflow:hidden;margin-bottom:12px}
.sql-proof-head{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--navy);font-size:11px}
.sql-label{color:#A7F3D0;font-weight:600}
.sql-meta{color:#4D6678;font-family:var(--mono);font-size:10px}
.sql-query{padding:10px 12px;font-family:var(--mono);font-size:11px;color:var(--text2);background:var(--surface2);border-bottom:1px solid var(--border);white-space:pre-wrap;word-break:break-all}
.sql-result{padding:10px 12px;font-family:var(--mono);font-size:11px;color:var(--text2);white-space:pre-wrap;word-break:break-all;max-height:200px;overflow:auto}
/* Footer */
.cert-footer{background:var(--navy);padding:20px 48px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;font-size:11px;color:#4D6678}
.footer-sig{font-family:var(--mono);font-size:10px}
/* QA-001 Rules */
.qa-rules{background:var(--surface2);border:1px solid var(--border);border-radius:4px;padding:16px 20px}
.qa-rules h3{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--text3);margin-bottom:10px}
.qa-rules ul{display:flex;flex-wrap:wrap;gap:6px;list-style:none}
.qa-rules li{font-size:11px;color:var(--text2);background:var(--bg);border:1px solid var(--border);border-radius:2px;padding:3px 9px}
</style>
</head>
<body>

<header class="cert-header">
  <div>
    <div class="cert-eyebrow">QA-001 · Evidence-Based Certification · Oraforme</div>
    <h1 class="cert-title">${esc(report.id)} — ${esc(report.title)}</h1>
    <p class="cert-sub">Protocole QA-001 obligatoire · aucun PASS sans preuve</p>
    <div class="cert-meta">
      <div class="cert-meta-row"><span class="cert-meta-label">Date</span><span class="cert-meta-val">${esc(report.date)}</span></div>
      <div class="cert-meta-row"><span class="cert-meta-label">Projet</span><span class="cert-meta-val">${esc(report.project ?? '—')}</span></div>
      <div class="cert-meta-row"><span class="cert-meta-label">Commit</span><span class="cert-meta-val">${esc(report.commit ?? '—')}</span></div>
      <div class="cert-meta-row"><span class="cert-meta-label">Env.</span><span class="cert-meta-val">${esc(report.env)}</span></div>
    </div>
  </div>
  <div class="cert-verdict">
    <div class="verdict-badge ${verdictClass}">
      <div class="verdict-icon">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          ${report.verdict === 'CERTIFIED'
            ? '<path d="M2 7l3.5 3.5L12 3" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
            : '<path d="M3 3l8 8M11 3l-8 8" stroke="#fff" stroke-width="2" stroke-linecap="round"/>'}
        </svg>
      </div>
      <div class="verdict-text">
        <strong>${esc(report.verdict)}</strong>
        <span>${report.passCount} / ${report.passCount + report.failCount + report.skipCount} scénarios</span>
      </div>
    </div>
    <div class="cert-score">
      <strong>${report.passCount}/${report.passCount + report.failCount + report.skipCount}</strong>
      ${report.failCount} FAIL · ${report.skipCount} SKIP
    </div>
  </div>
</header>

<div class="cert-body">

  <!-- QA-001 Rules reminder -->
  <div class="qa-rules">
    <h3>Règles QA-001 (obligatoires C-001 → C-016)</h3>
    <ul>
      <li>📷 Screenshot avant</li><li>📷 Screenshot après</li>
      <li>🖥 Logs console</li><li>🌐 Erreurs réseau</li>
      <li>🔵 Requêtes Supabase</li><li>⏱ Temps d'exécution</li>
      <li># Nb requêtes</li><li>🔌 Subscriptions Realtime</li>
      <li>🗄 Preuve SQL (si DB modifiée)</li>
    </ul>
  </div>

  <!-- TOC -->
  <div class="toc">
    <h2>Table des scénarios</h2>
    <div class="toc-grid">
      ${report.scenarios.map(s => `<a href="#${esc(s.id)}" class="toc-item">
        <span class="dot ${s.status.toLowerCase()}"></span>
        <span>${esc(s.id)}</span><span>${esc(s.name)}</span>
      </a>`).join('\n')}
    </div>
  </div>

  <!-- Global perf -->
  <section>
    <div class="section-head">
      <span class="section-label">Performance globale</span>
      <div class="section-rule"></div>
    </div>
    <div class="gperf">
      <div class="gp-card"><div class="gp-label">Chargement moyen</div><div class="gp-val ${avgLoad > 3000 ? 'warn' : 'ok'}">${ms(avgLoad)}</div></div>
      <div class="gp-card"><div class="gp-label">Requêtes totales</div><div class="gp-val">${totalReq}</div></div>
      <div class="gp-card"><div class="gp-label">Erreurs console</div><div class="gp-val ${totalErr > 0 ? 'warn' : 'ok'}">${totalErr}</div></div>
      <div class="gp-card"><div class="gp-label">Mémoire max</div><div class="gp-val ${maxMem > 200 ? 'warn' : 'ok'}">${maxMem} MB</div></div>
    </div>
    <div class="gperf" style="margin-top:12px">
      <div class="gp-card"><div class="gp-label">Warnings React</div><div class="gp-val ${totalRW > 0 ? 'warn' : 'ok'}">${totalRW}</div></div>
      <div class="gp-card"><div class="gp-label">Scénarios PASS</div><div class="gp-val ok">${report.passCount}</div></div>
      <div class="gp-card"><div class="gp-label">Scénarios FAIL</div><div class="gp-val ${report.failCount > 0 ? 'err' : 'ok'}">${report.failCount}</div></div>
      <div class="gp-card"><div class="gp-label">Scénarios SKIP</div><div class="gp-val">${report.skipCount}</div></div>
    </div>
  </section>

  <!-- Scenarios -->
  <section>
    <div class="section-head">
      <span class="section-label">Scénarios — Evidence complète</span>
      <div class="section-rule"></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:24px">
      ${scenarioBlocks}
    </div>
  </section>

</div>

<footer class="cert-footer">
  <span>Oraforme ERP · ${esc(report.id)} · Protocole QA-001</span>
  <span class="footer-sig">generated ${esc(report.date)} · claude-sonnet-4-6 · playwright + supabase-mcp</span>
</footer>

</body>
</html>`

  const reportPath = path.join(outDir, `${report.id.replace(/\./g, '-')}-qa001-report.html`)
  fs.writeFileSync(reportPath, html, 'utf8')
  return reportPath
}
