import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

suite('Extension wiring', () => {
  let pkg: any;

  suiteSetup(() => {
    const pkgPath = path.resolve(__dirname, '../../package.json');
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  });

  test('package.json registers xcaffold.validateFile command', () => {
    const commands = pkg.contributes.commands;
    const cmd = commands.find((c: any) => c.command === 'xcaffold.validateFile');
    assert.ok(cmd, 'xcaffold.validateFile must be registered');
    assert.ok(cmd.title.includes('Validate'), 'title must include Validate');
  });

  test('package.json registers xcaffold.initWizard command', () => {
    const commands = pkg.contributes.commands;
    const cmd = commands.find((c: any) => c.command === 'xcaffold.initWizard');
    assert.ok(cmd, 'xcaffold.initWizard must be registered');
  });

  test('package.json registers xcaffold.importPicker command', () => {
    const commands = pkg.contributes.commands;
    const cmd = commands.find((c: any) => c.command === 'xcaffold.importPicker');
    assert.ok(cmd, 'xcaffold.importPicker must be registered');
  });

  test('package.json registers xcaffold.diff command as preview', () => {
    const commands = pkg.contributes.commands;
    const cmd = commands.find((c: any) => c.command === 'xcaffold.diff');
    assert.ok(cmd, 'xcaffold.diff must be registered (preview)');
  });

  test('validateFile is available in editor/title for .xcaf files', () => {
    const menus = pkg.contributes.menus;
    const editorTitle = menus['editor/title'];
    assert.ok(editorTitle, 'editor/title menus must exist');

    const validateEntry = editorTitle.find(
      (m: any) => m.command === 'xcaffold.validateFile',
    );
    assert.ok(validateEntry, 'validateFile must be in editor/title');
    assert.ok(
      validateEntry.when.includes('xcaf'),
      'validateFile when clause must reference xcaf',
    );
  });

  test('extension.ts exports activate and deactivate', () => {
    const ext = require('../extension');
    assert.ok(typeof ext.activate === 'function');
    assert.ok(typeof ext.deactivate === 'function');
  });
});
