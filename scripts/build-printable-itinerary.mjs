import fs from "node:fs";

const routeFile = "travel-route-map-rome-relaxed.html";
const guideFile = "attraction-guides-rome-relaxed.html";
const outFile = "printable-itinerary-rome-relaxed.html";

function extractAssignedExpression(source, marker, endMarker) {
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Missing marker: ${marker}`);
  const eq = source.indexOf("=", start);
  const end = endMarker ? source.indexOf(endMarker, eq) : -1;
  if (eq < 0 || end < 0) throw new Error(`Cannot extract expression for: ${marker}`);
  return source.slice(eq + 1, end).trim().replace(/;$/, "");
}

function extractBlock(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error(`Cannot extract block: ${startMarker}`);
  return source.slice(start, end);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function list(items, limit = 4) {
  const useful = (items || []).filter(Boolean).slice(0, limit);
  if (!useful.length) return "";
  return `<ul>${useful.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function stopKey(name) {
  return String(name).replace(/\s+/g, " ").trim();
}

function stopType(stop) {
  return stop[4] ? "交通节点" : "景点";
}

const routeHtml = fs.readFileSync(routeFile, "utf8");
const guideHtml = fs.readFileSync(guideFile, "utf8");

const days = Function(`return (${extractAssignedExpression(routeHtml, "const days", "const mealPlans")});`)();
const guideData = Function(`
  ${extractBlock(guideHtml, "const sources =", "const cities =")}
  return { spots };
`)();
const spots = guideData.spots;
const spotByName = new Map(spots.map((spot) => [stopKey(spot.name), spot]));

const authGateStart = routeHtml.indexOf('<div class="auth-gate"');
const authGateEnd = routeHtml.indexOf("  <main", authGateStart);
const authGate = authGateStart >= 0 && authGateEnd >= 0
  ? routeHtml.slice(authGateStart, authGateEnd).trim()
  : "";

function routeRows(day) {
  return day.stops.map((stop, index) => {
    const leg = day.legs[index] || "";
    return `
      <tr>
        <td class="num">${index + 1}</td>
        <td><span class="pill ${stop[4] ? "node" : "spot"}">${stopType(stop)}</span></td>
        <td><strong>${escapeHtml(stop[0])}</strong></td>
        <td>${escapeHtml(stop[3])}</td>
        <td>${leg ? escapeHtml(leg) : "当天结束"}</td>
      </tr>
    `;
  }).join("");
}

function attractionCards(day) {
  return day.stops
    .map((stop) => spotByName.get(stopKey(stop[0])))
    .filter(Boolean)
    .map((spot) => `
      <article class="spot-card">
        <header>
          <div>
            <h3>${escapeHtml(spot.name)}</h3>
            <p class="meta">${escapeHtml(spot.city)} · 建议 ${escapeHtml(spot.time)} · ${escapeHtml(spot.best)}</p>
          </div>
        </header>
        <div class="spot-grid">
          <section>
            <h4>特点</h4>
            <p>${escapeHtml(spot.intro)}</p>
          </section>
          <section>
            <h4>主要游玩内容</h4>
            ${list(spot.play, 5)}
          </section>
          <section>
            <h4>必看 / 必玩</h4>
            ${list(spot.must, 4)}
          </section>
          <section>
            <h4>拍照与提醒</h4>
            ${list([...(spot.photo || []).slice(0, 3), ...(spot.tips || []).slice(0, 2)], 5)}
          </section>
        </div>
      </article>
    `).join("");
}

function daySection(day) {
  return `
    <section class="day">
      <header class="day-head">
        <div>
          <p class="date">${escapeHtml(day.date)}</p>
          <h2>${escapeHtml(day.title)}</h2>
        </div>
        <div class="summary">
          <span>${escapeHtml(day.meta)}</span>
          <strong>${escapeHtml(day.total)}</strong>
        </div>
      </header>
      <h3 class="section-title">当天顺序与景点间通勤</h3>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>类型</th>
            <th>点位</th>
            <th>停留/说明</th>
            <th>去下一站</th>
          </tr>
        </thead>
        <tbody>${routeRows(day)}</tbody>
      </table>
      <h3 class="section-title">景点攻略</h3>
      <div class="cards">${attractionCards(day)}</div>
    </section>
  `;
}

const body = days.map(daySection).join("");

const output = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>6.18-6.26 欧洲行程打印版 · 罗马休闲版</title>
  <script>document.documentElement.classList.add("auth-pending");</script>
  <script src="config.js"></script>
  <style>
    :root {
      --text: #1f2937;
      --muted: #64748b;
      --line: #d8cfbf;
      --paper: #fffdf8;
      --soft: #f6f1e8;
      --accent: #0f766e;
      --node: #2563eb;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; background: #eee7da; color: var(--text); font: 14px/1.55 "Microsoft YaHei", "PingFang SC", Arial, sans-serif; }
    .auth-pending body { overflow: hidden; }
    .auth-pending .print-root { display: none; }
    .auth-gate {
      position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 24px;
      background: linear-gradient(135deg, #f8f4ec, #e4dac9);
    }
    .auth-card { width: min(420px, 100%); padding: 24px; background: #fffaf0; border: 1px solid var(--line); border-radius: 8px; box-shadow: 0 20px 50px rgba(31,41,55,.15); }
    .auth-card h2 { margin: 0 0 8px; font-size: 22px; }
    .auth-card p { margin: 0 0 16px; color: var(--muted); }
    .auth-row { display: grid; grid-template-columns: 1fr auto; gap: 8px; }
    .auth-row input { min-height: 42px; padding: 0 12px; border: 1px solid #cfc6b6; border-radius: 8px; font: inherit; }
    button, .link-button { min-height: 38px; padding: 0 14px; border: 1px solid var(--accent); border-radius: 8px; background: var(--accent); color: white; font: inherit; font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
    .auth-error { min-height: 20px; margin-top: 10px; color: #b91c1c; font-weight: 700; }
    .print-root { width: min(1180px, calc(100% - 32px)); margin: 24px auto 60px; }
    .toolbar { position: sticky; top: 0; z-index: 10; display: flex; gap: 10px; justify-content: flex-end; padding: 12px 0; background: rgba(238,231,218,.92); backdrop-filter: blur(8px); }
    .cover, .day { background: var(--paper); border: 1px solid var(--line); border-radius: 10px; padding: 24px; margin-bottom: 18px; }
    .cover h1 { margin: 0 0 8px; font-size: 30px; }
    .cover p { margin: 0; color: var(--muted); }
    .cover .note { margin-top: 14px; padding: 12px 14px; background: var(--soft); border-left: 4px solid var(--accent); color: var(--text); }
    .day { page-break-inside: avoid; }
    .day-head { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; border-bottom: 2px solid var(--line); padding-bottom: 12px; margin-bottom: 14px; }
    .date { margin: 0 0 2px; color: var(--accent); font-weight: 800; font-size: 18px; }
    h2 { margin: 0; font-size: 24px; }
    .summary { text-align: right; color: var(--muted); display: grid; gap: 4px; }
    .summary strong { color: var(--text); font-size: 16px; }
    .section-title { margin: 18px 0 8px; font-size: 17px; color: #111827; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 12px; }
    th, td { border: 1px solid var(--line); padding: 8px; vertical-align: top; }
    th { background: var(--soft); text-align: left; font-size: 12px; color: #475569; }
    th:nth-child(1), td.num { width: 34px; text-align: center; }
    th:nth-child(2) { width: 74px; }
    th:nth-child(3) { width: 26%; }
    th:nth-child(4) { width: 26%; }
    .pill { display: inline-block; padding: 2px 7px; border-radius: 999px; font-size: 12px; font-weight: 800; color: #fff; background: var(--accent); white-space: nowrap; }
    .pill.node { background: var(--node); }
    .cards { display: grid; grid-template-columns: 1fr; gap: 10px; }
    .spot-card { border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px; background: #fff; page-break-inside: avoid; }
    .spot-card h3 { margin: 0; font-size: 17px; }
    .meta { margin: 2px 0 10px; color: var(--muted); font-size: 12px; }
    .spot-grid { display: grid; grid-template-columns: 1.05fr 1fr 1fr 1fr; gap: 12px; }
    h4 { margin: 0 0 4px; color: var(--accent); font-size: 13px; }
    .spot-card p { margin: 0; }
    ul { margin: 0; padding-left: 18px; }
    li { margin: 0 0 3px; }
    @media print {
      @page { size: A4; margin: 10mm; }
      html, body { background: #fff; font-size: 10.5px; }
      .toolbar, .auth-gate { display: none !important; }
      .auth-pending .print-root { display: block; }
      .print-root { width: 100%; margin: 0; }
      .cover, .day { border: 0; border-radius: 0; padding: 0; margin: 0 0 8mm; page-break-after: always; }
      .cover h1 { font-size: 22px; }
      h2 { font-size: 18px; }
      .date { font-size: 14px; }
      .section-title { margin: 10px 0 5px; font-size: 13px; }
      th, td { padding: 4px 5px; }
      .spot-card { padding: 7px 8px; margin-bottom: 5px; }
      .spot-card h3 { font-size: 12.5px; }
      .meta, h4 { font-size: 10px; }
      .spot-grid { grid-template-columns: 1fr 1fr; gap: 6px 10px; }
    }
  </style>
</head>
<body>
${authGate}
<main class="print-root">
  <nav class="toolbar" aria-label="打印操作">
    <a class="link-button" href="travel-route-map-rome-relaxed.html">返回路线图</a>
    <button type="button" onclick="window.print()">打印 / 另存为 PDF</button>
  </nav>
  <section class="cover">
    <h1>6.18-6.26 欧洲行程打印版 · 罗马休闲版</h1>
    <p>布鲁塞尔 -> 巴黎 -> 罗马/梵蒂冈 -> 威尼斯 -> 米兰。内容合并自路线图和景点逐页攻略。</p>
    <p class="note">打印逻辑：每一天先看“当天顺序与景点间通勤”，再看每个景点的特点、主要游玩内容、必看必玩、拍照与提醒。交通节点用蓝色标注，景点用绿色标注。</p>
  </section>
  ${body}
</main>
</body>
</html>
`;

fs.writeFileSync(outFile, output, "utf8");
console.log(`Wrote ${outFile}`);
