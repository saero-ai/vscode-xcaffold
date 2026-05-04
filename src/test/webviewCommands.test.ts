import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

suite('Webview command registration', () => {
  let pkg: any;

  suiteSetup(() => {
    const pkgPath = path.resolve(__dirname, '../../package.json');
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  });

  test('package.json has xcaffold.diff command', () => {
    const cmds = pkg.contributes.commands;
    const found = cmds.find((c: any) => c.command === 'xcaffold.diff');
    assert.ok(found, 'xcaffold.diff command must exist');
    assert.ok(found.title.includes('Diff'), 'title must mention Diff');
  });

  test('package.json has xcaffold.fidelity command', () => {
    const cmds = pkg.contributes.commands;
    const found = cmds.find((c: any) => c.command === 'xcaffold.fidelity');
    assert.ok(found, 'xcaffold.fidelity command must exist');
  });

  test('package.json has xcaffold.statusDash command', () => {
    const cmds = pkg.contributes.commands;
    const found = cmds.find((c: any) => c.command === 'xcaffold.statusDash');
    assert.ok(found, 'xcaffold.statusDash command must exist');
  });

  test('package.json has xcaffold.schemaViewer command', () => {
    const cmds = pkg.contributes.commands;
    const found = cmds.find((c: any) => c.command === 'xcaffold.schemaViewer');
    assert.ok(found, 'xcaffold.schemaViewer command must exist');
  });

  test('extension exports activate and deactivate', () => {
    const ext = require('../extension');
    assert.ok(typeof ext.activate === 'function');
    assert.ok(typeof ext.deactivate === 'function');
  });
});
