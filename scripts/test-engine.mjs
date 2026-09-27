import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const output = { textContent: '' };
const context = vm.createContext({
  console,
  document: { getElementById: () => output, body: { dataset: {} }, title: '' },
});
context.window = context;
for (const file of ['app/catalog.js', 'app/engine.js', 'app/expansion.js', 'tests/engine-tests.js']) {
  vm.runInContext(await readFile(new URL(`../${file}`, import.meta.url), 'utf8'), context, { filename: file });
}
const results = JSON.parse(output.textContent);
console.log(`${results.passed} engine tests passed; ${results.failed} failed.`);
for (const result of results.results.filter(test => !test.pass)) console.error(result);
if (results.failed) process.exitCode = 1;
