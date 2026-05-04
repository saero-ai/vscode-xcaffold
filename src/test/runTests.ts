// src/test/runTests.ts
require('./setup');
const MochaRunner = require('mocha');
const path = require('path');
const fs = require('fs');

const mochaInstance = new MochaRunner({
  ui: 'tdd',
  reporter: 'spec',
});

const testDir = path.resolve(__dirname);
fs.readdirSync(testDir)
  .filter((f: string) => f.endsWith('.test.ts'))
  .forEach((f: string) => {
    mochaInstance.addFile(path.join(testDir, f));
  });

mochaInstance.run((failures: number) => {
  process.exitCode = failures ? 1 : 0;
});
