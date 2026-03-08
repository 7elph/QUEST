import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Resvg } from "@resvg/resvg-js";

function ensureDir(filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
}

function renderToPng({ svg, outPath, width }) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    background: "rgba(0,0,0,0)",
  });
  const pngData = resvg.render().asPng();
  ensureDir(outPath);
  writeFileSync(outPath, pngData);
  console.log(`asset generated: ${outPath}`);
}

const missionFrameOut = resolve("public/assets/mission-frame.png");
const missionFrameCompactOut = resolve("public/assets/mission-frame-compact.png");
const enterpriseHeroOut = resolve("public/assets/enterprise-hero.png");
const enterpriseCardOut = resolve("public/assets/enterprise-card.png");
const ornateFrameOut = resolve("public/assets/ornate-gold-frame.png");

const missionFrameSvg = `
<svg width="1400" height="860" viewBox="0 0 1400 860" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f4dc9a"/>
      <stop offset="35%" stop-color="#cc9f48"/>
      <stop offset="70%" stop-color="#8a5d1f"/>
      <stop offset="100%" stop-color="#f2cf80"/>
    </linearGradient>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2a2019"/>
      <stop offset="45%" stop-color="#151015"/>
      <stop offset="100%" stop-color="#2b1c13"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.08" cy="0.12" r="0.85">
      <stop offset="0%" stop-color="rgba(252,207,123,0.26)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
    </radialGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="14" flood-color="#000" flood-opacity="0.45"/>
    </filter>
  </defs>
  <rect x="0" y="0" width="1400" height="860" rx="34" fill="url(#bg)"/>
  <rect x="0" y="0" width="1400" height="860" rx="34" fill="url(#glow)"/>
  <rect x="10" y="10" width="1380" height="840" rx="28" fill="none" stroke="url(#gold)" stroke-width="4" filter="url(#shadow)"/>
  <rect x="26" y="26" width="1348" height="808" rx="22" fill="none" stroke="#70512a" stroke-width="2" opacity="0.9"/>
  <path d="M70 82 L140 82 L140 56" stroke="url(#gold)" stroke-width="6" fill="none" stroke-linecap="round"/>
  <path d="M1330 82 L1260 82 L1260 56" stroke="url(#gold)" stroke-width="6" fill="none" stroke-linecap="round"/>
  <path d="M70 778 L140 778 L140 804" stroke="url(#gold)" stroke-width="6" fill="none" stroke-linecap="round"/>
  <path d="M1330 778 L1260 778 L1260 804" stroke="url(#gold)" stroke-width="6" fill="none" stroke-linecap="round"/>
  <circle cx="86" cy="96" r="6" fill="#e4ba71"/>
  <circle cx="1314" cy="96" r="6" fill="#e4ba71"/>
  <circle cx="86" cy="764" r="6" fill="#e4ba71"/>
  <circle cx="1314" cy="764" r="6" fill="#e4ba71"/>
  <path d="M240 68 H1160" stroke="#6f4d24" stroke-width="1.6" opacity="0.75"/>
  <path d="M240 792 H1160" stroke="#6f4d24" stroke-width="1.6" opacity="0.75"/>
</svg>
`;

const missionFrameCompactSvg = `
<svg width="900" height="520" viewBox="0 0 900 520" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f4dc9a"/>
      <stop offset="35%" stop-color="#cc9f48"/>
      <stop offset="70%" stop-color="#8a5d1f"/>
      <stop offset="100%" stop-color="#f2cf80"/>
    </linearGradient>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2c2018"/>
      <stop offset="55%" stop-color="#151116"/>
      <stop offset="100%" stop-color="#25190f"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="900" height="520" rx="22" fill="url(#bg)"/>
  <rect x="8" y="8" width="884" height="504" rx="18" fill="none" stroke="url(#gold)" stroke-width="3"/>
  <rect x="20" y="20" width="860" height="480" rx="14" fill="none" stroke="#6a4b24" stroke-width="1.5"/>
  <path d="M36 40 H130 M36 40 V102" stroke="#e2b86c" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path d="M864 40 H770 M864 40 V102" stroke="#e2b86c" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path d="M36 480 H130 M36 480 V420" stroke="#e2b86c" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path d="M864 480 H770 M864 480 V420" stroke="#e2b86c" stroke-width="4" fill="none" stroke-linecap="round"/>
</svg>
`;

const enterpriseHeroSvg = `
<svg width="1600" height="900" viewBox="0 0 1600 900" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a1930"/>
      <stop offset="42%" stop-color="#10263f"/>
      <stop offset="100%" stop-color="#06101f"/>
    </linearGradient>
    <linearGradient id="line" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#2bc2ff"/>
      <stop offset="100%" stop-color="#6fd6ff"/>
    </linearGradient>
    <radialGradient id="spot" cx="0.15" cy="0.2" r="0.75">
      <stop offset="0%" stop-color="rgba(98,210,255,0.25)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
    </radialGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#bg)"/>
  <rect width="1600" height="900" fill="url(#spot)"/>
  <path d="M0 720 C 180 650, 410 770, 620 690 C 920 560, 1180 770, 1600 620 L1600 900 L0 900 Z" fill="rgba(2,10,20,0.75)"/>
  <g opacity="0.42">
    <rect x="180" y="340" width="38" height="320" fill="#254b6a"/>
    <rect x="240" y="300" width="44" height="360" fill="#1d3f5c"/>
    <rect x="314" y="260" width="48" height="400" fill="#234766"/>
    <rect x="398" y="280" width="40" height="380" fill="#1b3a55"/>
    <rect x="1070" y="290" width="42" height="370" fill="#1c3f5d"/>
    <rect x="1144" y="250" width="52" height="410" fill="#245073"/>
    <rect x="1236" y="300" width="38" height="360" fill="#1a3a56"/>
  </g>
  <g opacity="0.9">
    <path d="M220 256 L450 198 L760 302 L1040 192 L1360 272" fill="none" stroke="url(#line)" stroke-width="2.4"/>
    <circle cx="220" cy="256" r="6" fill="#9be7ff"/>
    <circle cx="450" cy="198" r="6" fill="#9be7ff"/>
    <circle cx="760" cy="302" r="6" fill="#9be7ff"/>
    <circle cx="1040" cy="192" r="6" fill="#9be7ff"/>
    <circle cx="1360" cy="272" r="6" fill="#9be7ff"/>
  </g>
  <rect x="112" y="98" width="560" height="4" fill="url(#line)" opacity="0.65"/>
  <rect x="112" y="110" width="380" height="3" fill="#8adfff" opacity="0.42"/>
</svg>
`;

const enterpriseCardSvg = `
<svg width="1000" height="620" viewBox="0 0 1000 620" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#112745"/>
      <stop offset="100%" stop-color="#0a1628"/>
    </linearGradient>
    <linearGradient id="g2" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#2bc2ff"/>
      <stop offset="100%" stop-color="#7de2ff"/>
    </linearGradient>
  </defs>
  <rect width="1000" height="620" rx="26" fill="url(#g1)"/>
  <rect x="14" y="14" width="972" height="592" rx="20" fill="none" stroke="#2f5475" stroke-width="2"/>
  <path d="M0 452 C 210 380, 440 488, 690 412 C 810 374, 920 392, 1000 350 L1000 620 L0 620 Z" fill="rgba(5,13,24,0.74)"/>
  <path d="M84 162 L230 142 L366 212 L528 184 L732 220 L904 170" stroke="url(#g2)" stroke-width="3" fill="none"/>
  <circle cx="84" cy="162" r="5" fill="#9fe9ff"/>
  <circle cx="230" cy="142" r="5" fill="#9fe9ff"/>
  <circle cx="366" cy="212" r="5" fill="#9fe9ff"/>
  <circle cx="528" cy="184" r="5" fill="#9fe9ff"/>
  <circle cx="732" cy="220" r="5" fill="#9fe9ff"/>
  <circle cx="904" cy="170" r="5" fill="#9fe9ff"/>
</svg>
`;

const ornateGoldFrameSvg = `
<svg width="1300" height="1300" viewBox="0 0 1300 1300" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="goldLine" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffd872"/>
      <stop offset="45%" stop-color="#e7a813"/>
      <stop offset="100%" stop-color="#ffcf57"/>
    </linearGradient>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="0" stdDeviation="2.2" flood-color="#f7b824" flood-opacity="0.75"/>
    </filter>
    <g id="floral">
      <path d="M44 284 C58 220 92 162 150 120 C126 100 108 75 98 44 C136 62 177 69 219 66 C204 92 201 118 207 143 C243 134 280 116 314 90 C302 132 279 166 245 191 C277 214 304 243 316 281 C282 261 248 252 212 253 C217 288 214 325 196 359 C168 326 154 290 152 252 C123 266 95 291 73 318 C75 286 81 258 94 234 C73 226 55 215 40 200 C57 194 72 182 85 165 C64 141 50 114 46 84 C66 104 83 118 102 128 C112 108 130 92 152 81" fill="none" stroke="url(#goldLine)" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M112 152 C128 142 148 136 168 136 C160 152 157 168 160 186 C140 184 123 173 112 152 Z" fill="none" stroke="url(#goldLine)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M178 96 C202 100 226 114 243 135 C219 136 197 144 178 159 C171 135 171 114 178 96 Z" fill="none" stroke="url(#goldLine)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M246 178 C267 194 282 217 288 244 C267 236 246 235 225 241 C226 220 233 199 246 178 Z" fill="none" stroke="url(#goldLine)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
  </defs>

  <rect x="74" y="92" width="1152" height="1118" rx="24" fill="none" stroke="url(#goldLine)" stroke-width="8" filter="url(#glow)"/>
  <rect x="90" y="106" width="1120" height="1090" rx="18" fill="none" stroke="url(#goldLine)" stroke-width="3.8" opacity="0.95"/>

  <line x1="252" y1="90" x2="1048" y2="90" stroke="url(#goldLine)" stroke-width="9" stroke-linecap="round"/>
  <line x1="252" y1="1210" x2="1048" y2="1210" stroke="url(#goldLine)" stroke-width="9" stroke-linecap="round"/>
  <line x1="72" y1="272" x2="72" y2="1028" stroke="url(#goldLine)" stroke-width="9" stroke-linecap="round"/>
  <line x1="1228" y1="272" x2="1228" y2="1028" stroke="url(#goldLine)" stroke-width="9" stroke-linecap="round"/>

  <g filter="url(#glow)">
    <use href="#floral" x="0" y="0"/>
    <use href="#floral" transform="translate(1300 0) scale(-1 1)"/>
    <use href="#floral" transform="translate(0 1300) scale(1 -1)"/>
    <use href="#floral" transform="translate(1300 1300) scale(-1 -1)"/>
  </g>
</svg>
`;

renderToPng({ svg: missionFrameSvg, outPath: missionFrameOut, width: 1400 });
renderToPng({ svg: missionFrameCompactSvg, outPath: missionFrameCompactOut, width: 900 });
renderToPng({ svg: enterpriseHeroSvg, outPath: enterpriseHeroOut, width: 1600 });
renderToPng({ svg: enterpriseCardSvg, outPath: enterpriseCardOut, width: 1000 });
renderToPng({ svg: ornateGoldFrameSvg, outPath: ornateFrameOut, width: 1300 });
