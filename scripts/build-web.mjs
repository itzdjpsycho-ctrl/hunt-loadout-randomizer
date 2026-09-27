import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFile(resolve(root, path), 'utf8');
const json = async path => JSON.parse((await read(path)).replace(/^\uFEFF/, ''));
const [catalog, rules, traits, ammo] = await Promise.all([
  json('data/equipment.json'), json('data/loadout-rules.json'),
  json('data/traits.json'), json('data/custom-ammo.json'),
]);
const traitIds = new Set(traits.map(t => t.id));
const items = await Promise.all(catalog.items.map(async item => {
  const html = await read(item.sourceSnapshot.replaceAll('\\', '/'));
  const section = html.match(/id="Recommended_Traits".*?<\/h2>(.*?)(?=<h2)/s)?.[1] || '';
  let synergies = [...section.matchAll(/href="\/wiki\/Traits\/([^"#]+)"/g)]
    .map(match => decodeURIComponent(match[1]).replaceAll('_', ' ').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  const melee = ['Melee', 'Throwable Melee'].includes(item.group) ||
    (item.kind === 'weapon' && (item.ammoType === null || /Bayonet|Riposte|Talon|Trauma|Mace|Claw|Striker|Brawler|Hatchet|Bomb Lance/i.test(item.name)));
  const limitedTool = item.kind === 'tool' && item.group !== 'Melee' && item.id !== 'spyglass';
  if (limitedTool) synergies.push('frontiersman');
  if (item.kind === 'weapon' && ['Conversion', 'Nagant M1895', 'Pax', 'Scottfield', 'Uppercut', 'Haymaker'].includes(item.family)) synergies.push('fanning');
  if (item.family === 'LeMat' && !/Carbine/i.test(item.name)) synergies.push('fanning');
  if (item.id === '1890-cavalry') synergies.push('fast-fingers');
  if (item.id === 'first-aid-kit') synergies.push('doctor', 'physician');
  if (['throwing-knives', 'throwing-axes'].includes(item.id)) synergies.push('assailant');
  if (item.group === 'Traps') synergies.push('poacher');
  if (item.group === 'Distraction' && item.kind === 'tool') synergies.push('decoy-supply');
  if (item.id === 'dark-dynamite-satchel') synergies = synergies.filter(id => id !== 'poacher');
  if (item.id === 'throwing-spear') synergies = synergies.filter(id => id !== 'assailant');
  return {
    id: item.id, name: item.name, kind: item.kind, family: item.family,
    capacity: item.capacity, ammo: item.ammoType, price: item.priceHuntDollars,
    availability: item.availability, category: item.consumableLimitCategory,
    group: item.group, melee, limitedTool,
    synergies: [...new Set(synergies.filter(id => traitIds.has(id) && id !== 'quartermaster'))].sort(),
    requirements: item.requirements, source: item.sourceUrl,
    image: 'data:image/png;base64,' + (await readFile(join(root, 'assets/equipment', item.id + '.png'))).toString('base64'),
  };
}));
const data = {
  version: `${catalog.targetPatch}-${catalog.researchedOn}`, items, rules,
  traits: traits.map(({ id, name, effect, kind }) => ({ id, name, effect, kind, source: `https://huntshowdown.wiki.gg/wiki/Traits/${name.replaceAll(' ', '_')}` })),
  ammo,
};
const code = {
  DATA: `window.HUNT_DATA = ${JSON.stringify(data)};`,
  ENGINE: await read('app/engine.js'), EXPANSION: await read('app/expansion.js'),
  APP: await read('app/app.js'), STYLES: await read('app/styles.css'),
};
const template = await read('app/index.template.html');
// Keep a self-contained HTML file for the Windows host and offline browser use.
const standalone = template.replace(/__(DATA|ENGINE|EXPANSION|APP|STYLES)__/g, (_, key) => code[key]);
await writeFile(join(root, 'app/catalog.js'), code.DATA);
await writeFile(join(root, 'Chaos-Loadout.html'), standalone);

// The hosted page loads normal browser assets; all paths work under a project subpath.
const site = join(root, 'site');
await mkdir(join(site, 'assets'), { recursive: true });
let page = template.replace('<style>__STYLES__</style>', '<link rel="stylesheet" href="./assets/styles.css">');
for (const [key, file] of Object.entries({ DATA: 'catalog.js', ENGINE: 'engine.js', EXPANSION: 'expansion.js', APP: 'app.js' })) {
  page = page.replace(`<script>__${key}__</script>`, `<script src="./assets/${file}"></script>`);
  await writeFile(join(site, 'assets', file), code[key]);
}
if (/__(DATA|ENGINE|EXPANSION|APP|STYLES)__/.test(page)) throw new Error('Unresolved frontend template placeholder');
await writeFile(join(site, 'assets/styles.css'), code.STYLES);
await writeFile(join(site, 'index.html'), page);
await writeFile(join(site, '.nojekyll'), '');
console.log(`Built website and standalone HTML: ${items.length} items, ${traits.length} traits.`);
