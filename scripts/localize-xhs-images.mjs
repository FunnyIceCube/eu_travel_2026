import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const htmlPath = path.join(root, "attraction-guides.html");
const currentPath = path.join(root, "xhs-current-images.json");
const assetDir = path.join(root, "assets", "xhs");

fs.mkdirSync(assetDir, { recursive: true });

const html = fs.readFileSync(htmlPath, "utf8");
const current = JSON.parse(fs.readFileSync(currentPath, "utf8"));
const match = html.match(/const xhsNoteData = (\{[\s\S]*?\n\});\n\n    const mealPlans/);
if (!match) throw new Error("Cannot find xhsNoteData block");

const xhsNoteData = Function(`"use strict"; return (${match[1]});`)();
const spotNames = Object.keys(xhsNoteData);
const downloaded = [];
const failed = [];

async function download(url, filePath) {
  const response = await fetch(url, {
    headers: {
      "Referer": "https://www.xiaohongshu.com/",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
      "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
    }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 1024) throw new Error(`image too small: ${buffer.length}`);
  fs.writeFileSync(filePath, buffer);
  return buffer.length;
}

for (let spotIndex = 0; spotIndex < spotNames.length; spotIndex++) {
  const spotName = spotNames[spotIndex];
  const notes = xhsNoteData[spotName] || [];
  const cards = current[spotIndex]?.cards || [];

  for (let noteIndex = 0; noteIndex < notes.length; noteIndex++) {
    const card = cards[noteIndex];
    if (!card?.image) {
      failed.push({ spotIndex, noteIndex, reason: "missing current card" });
      continue;
    }

    const fileName = `spot-${String(spotIndex + 1).padStart(2, "0")}-note-${String(noteIndex + 1).padStart(2, "0")}.webp`;
    const filePath = path.join(assetDir, fileName);
    try {
      const size = await download(card.image, filePath);
      notes[noteIndex].href = card.href || notes[noteIndex].href;
      notes[noteIndex].image = `assets/xhs/${fileName}`;
      downloaded.push({ spotIndex, noteIndex, fileName, size });
    } catch (error) {
      failed.push({ spotIndex, noteIndex, url: card.image, reason: error.message });
    }
  }
}

const replacement = `const xhsNoteData = ${JSON.stringify(xhsNoteData, null, 6)};\n\n    const mealPlans`;
fs.writeFileSync(htmlPath, html.replace(match[0], replacement), "utf8");

console.log(JSON.stringify({
  spots: spotNames.length,
  downloaded: downloaded.length,
  failed: failed.length,
  failedItems: failed
}, null, 2));
