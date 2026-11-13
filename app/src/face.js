/** face.js — Boekoe's gezichtjes als SVG-tekst (zelfde tekening als op de website). */
/* ---------- Gezichtjes per emotie ---------- */
const eyesNormal=(dx=0,dy=0)=>`<circle cx="62" cy="86" r="14" fill="#fff"/><circle cx="98" cy="86" r="14" fill="#fff"/>
  <g class="eye"><circle cx="${64+dx}" cy="${88+dy}" r="7" fill="#2B2A33"/><circle cx="${66.5+dx}" cy="${85.5+dy}" r="2.4" fill="#fff"/></g>
  <g class="eye"><circle cx="${96+dx}" cy="${88+dy}" r="7" fill="#2B2A33"/><circle cx="${98.5+dx}" cy="${85.5+dy}" r="2.4" fill="#fff"/></g>`;
const eyesHappy=`<path d="M50 90 Q62 76 74 90" stroke="#2B2A33" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M86 90 Q98 76 110 90" stroke="#2B2A33" stroke-width="5" fill="none" stroke-linecap="round"/>`;
const eyesWink=`<circle cx="62" cy="86" r="14" fill="#fff"/><g class="eye"><circle cx="64" cy="88" r="7" fill="#2B2A33"/><circle cx="66.5" cy="85.5" r="2.4" fill="#fff"/></g>
  <path d="M86 90 Q98 80 110 90" stroke="#2B2A33" stroke-width="5" fill="none" stroke-linecap="round"/>`;
const eyesWide=`<circle cx="62" cy="85" r="16" fill="#fff"/><circle cx="98" cy="85" r="16" fill="#fff"/>
  <g class="eye"><circle cx="62" cy="86" r="5.5" fill="#2B2A33"/><circle cx="64" cy="84" r="1.8" fill="#fff"/></g>
  <g class="eye"><circle cx="98" cy="86" r="5.5" fill="#2B2A33"/><circle cx="100" cy="84" r="1.8" fill="#fff"/></g>`;
const M = {
  smile:`<path d="M71 104 Q80 113 89 104" stroke="#2B2A33" stroke-width="3.5" fill="none" stroke-linecap="round"/>`,
  big:`<path d="M66 102 Q80 124 94 102 Z" fill="#7A2E2E"/><path d="M73 112 Q80 118 87 112 Q80 109 73 112Z" fill="#FF7A8A"/>`,
  o:`<ellipse cx="80" cy="109" rx="6.5" ry="8.5" fill="#7A2E2E"/>`,
  smallO:`<ellipse cx="82" cy="108" rx="4" ry="5" fill="#7A2E2E"/>`,
  smirk:`<path d="M69 106 Q82 111 93 100" stroke="#2B2A33" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M84 107 Q88 113 91 106" fill="#FF7A8A"/>`,
  soft:`<path d="M73 105 Q80 110 87 105" stroke="#2B2A33" stroke-width="3.2" fill="none" stroke-linecap="round"/>`,
};
const B = {
  curious:`<path d="M86 66 Q98 57 111 63" stroke="#2B2A33" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  up:`<path d="M49 64 Q62 56 75 63" stroke="#2B2A33" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M85 63 Q98 56 111 64" stroke="#2B2A33" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  soft:`<path d="M51 70 Q61 65 73 68" stroke="#2B2A33" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M87 68 Q99 65 109 70" stroke="#2B2A33" stroke-width="3.5" fill="none" stroke-linecap="round"/>`,
};
const FACES = {
  blij:        {eyes:eyesNormal(),      mouth:M.big},
  nieuwsgierig:{eyes:eyesNormal(3,-3),  mouth:M.smallO, brows:B.curious},
  verrast:     {eyes:eyesWide,          mouth:M.o,      brows:B.up},
  trots:       {eyes:eyesHappy,         mouth:M.big,    cheeks:.75},
  rustig:      {eyes:eyesNormal(0,1),   mouth:M.soft},
  ondeugend:   {eyes:eyesWink,          mouth:M.smirk},
  bemoedigend: {eyes:eyesNormal(),      mouth:M.smile,  brows:B.soft},
};
export function boekoeSVG(em="blij", extraClass=""){
  const f=FACES[em]||FACES.blij;
  return `<svg viewBox="0 0 160 160" width="100%" height="100%">
    <ellipse cx="80" cy="152" rx="44" ry="6" fill="#E4D8C4"/>
    <g class="body-g">
      <path class="ear-l" d="M48 56 Q30 18 14 32 Q20 62 52 70Z" fill="#fff" stroke="#6A4CE0" stroke-width="4" stroke-linejoin="round"/>
      <path class="ear-r" d="M112 56 Q130 18 146 32 Q140 62 108 70Z" fill="#fff" stroke="#6A4CE0" stroke-width="4" stroke-linejoin="round"/>
      <path d="M26 38 L40 56 M22 48 L36 64 M134 38 L120 56 M138 48 L124 64" stroke="#D3C8FF" stroke-width="3" stroke-linecap="round"/>
      <path d="M76 48 L76 26 L84 26 L84 48 L80 44Z" fill="#6A4CE0"/>
      <ellipse cx="80" cy="98" rx="52" ry="50" fill="#FF8A5B"/>
      <ellipse cx="80" cy="114" rx="30" ry="27" fill="#FFD9C7"/>
      ${f.eyes}${f.brows||""}
      <circle cx="48" cy="104" r="6" fill="#FF5C7A" opacity="${f.cheeks||.45}"/><circle cx="112" cy="104" r="6" fill="#FF5C7A" opacity="${f.cheeks||.45}"/>
      <g class="mouth">${f.mouth}</g>
      <ellipse cx="62" cy="146" rx="13" ry="6" fill="#E8683B"/><ellipse cx="98" cy="146" rx="13" ry="6" fill="#E8683B"/>
    </g></svg>`;
}
