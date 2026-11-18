// Audio tests use a deterministic spy; no real sound card or browser is required.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const sources = ['parts/engine.js', 'parts/audio.js', 'parts/audio-tests.js'].map(p => fs.readFileSync(path.join(root, p), 'utf8')).join('\n');
const context = { console, performance: { now: () => 0 }, Float32Array, Set, Math, Number, Array };
vm.runInNewContext(sources + '\n;globalThis.__audioResults = runAudioTests();', context, { timeout: 10000 });
for (const result of context.__audioResults) console.log(`${result.pass ? 'PASS' : 'FAIL'} ${result.id}: ${result.pass ? result.detail : result.error}`);
const failed = context.__audioResults.filter(result => !result.pass);
console.log(`Audio: ${context.__audioResults.length - failed.length}/${context.__audioResults.length} passed (mocked audio API; physical listening NOT_RUN).`);
if (failed.length) process.exitCode = 1;
