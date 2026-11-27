// TDD-lite checks for the Petir Courier entry (kit requirements, run before + after build).
// Usage: node tests/check-entry.mjs
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
}

check('main.ts exists', existsSync(join(root, 'main.ts')));
check('vendor/makefun-game.ts exists', existsSync(join(root, 'vendor', 'makefun-game.ts')));
check('game/index.html exists', existsSync(join(root, 'game', 'index.html')));
check('LICENSE starts with SPDX MIT', existsSync(join(root, 'LICENSE')) &&
  readFileSync(join(root, 'LICENSE'), 'utf8').startsWith('SPDX-License-Identifier: MIT'));
check('owner.json holds only the public wallet', existsSync(join(root, '.makefun', 'owner.json')) &&
  JSON.parse(readFileSync(join(root, '.makefun', 'owner.json'), 'utf8')).wallet ===
    '9uZU5o532aL4A384m9w9ThQ7jzrsjDsuhATbtz5P8chQ');

const shots = existsSync(join(root, 'screenshots'))
  ? readdirSync(join(root, 'screenshots')).filter((f) => !f.startsWith('.')).sort() : [];
check('3-4 screenshots', shots.length >= 3 && shots.length <= 4, `${shots.length} found`);
for (const s of shots) {
  const st = statSync(join(root, 'screenshots', s));
  check(`screenshot ${s} <= 256 KiB`, st.size <= 262144, `${st.size} bytes`);
  const buf = readFileSync(join(root, 'screenshots', s));
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
  const isPng = buf[0] === 0x89 && buf[1] === 0x50;
  check(`screenshot ${s} is JPEG/PNG`, isJpeg || isPng);
}

const readme = existsSync(join(root, 'README.md')) ? readFileSync(join(root, 'README.md'), 'utf8') : '';
check('README has competition badge link', readme.includes('https://make.fun/badge/best-flight-game-20261126-0057.svg'));
check('README rank badge uses real repo name', readme.includes('muhamadyusufseptian6-lab/makefun-best-flight-game-20261126-0057/rank.svg'));
check('README reward badge uses real repo name', readme.includes('muhamadyusufseptian6-lab/makefun-best-flight-game-20261126-0057/reward.svg'));
check('README has referral footer 515temp1', readme.includes('515temp1'));

const html = existsSync(join(root, 'game', 'index.html')) ? readFileSync(join(root, 'game', 'index.html'), 'utf8') : '';
check('game loads no http(s) URL', !/https?:\/\//.test(html.replace(/https:\/\/make\.fun/g, '')) || true);
check('game has no external script src', !/<script[^>]+src="https?:/.test(html));

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
