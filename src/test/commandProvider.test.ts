import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { XCAFFOLD_COMMANDS } from '../commandProvider';

suite('CommandProvider', () => {
  test('XCAFFOLD_COMMANDS defines all required command IDs', () => {
    const ids = XCAFFOLD_COMMANDS.map(c => c.id);
    assert.ok(ids.includes('xcaffold.apply'));
    assert.ok(ids.includes('xcaffold.validate'));
    assert.ok(ids.includes('xcaffold.status'));
    assert.ok(ids.includes('xcaffold.list'));
    assert.ok(ids.includes('xcaffold.import'));
  });
});

suite('package.json context menus', () => {
  let pkg: any;

  suiteSetup(() => {
    const pkgPath = path.resolve(__dirname, '../../package.json');
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  });

  test('view/item/context has Apply for resource-item', () => {
    const menus = pkg.contributes.menus;
    assert.ok(menus, 'contributes.menus must exist');
    const itemContext = menus['view/item/context'];
    assert.ok(itemContext, 'view/item/context must exist');

    const applyEntry = itemContext.find(
      (m: any) => m.command === 'xcaffold.apply' && m.when?.includes('resource-item'),
    );
    assert.ok(applyEntry, 'Apply must be available for resource-item');
  });

  test('view/item/context has Validate for resource-item', () => {
    const menus = pkg.contributes.menus;
    const itemContext = menus['view/item/context'];

    const validateEntry = itemContext.find(
      (m: any) => m.command === 'xcaffold.validate' && m.when?.includes('resource-item'),
    );
    assert.ok(validateEntry, 'Validate must be available for resource-item');
  });

  test('view/title has Refresh for xcaffoldExplorer', () => {
    const menus = pkg.contributes.menus;
    const viewTitle = menus['view/title'];
    assert.ok(viewTitle, 'view/title must exist');

    const refreshEntry = viewTitle.find(
      (m: any) => m.command === 'xcaffold.refreshExplorer' && m.when?.includes('xcaffoldExplorer'),
    );
    assert.ok(refreshEntry, 'Refresh must be in view/title for xcaffoldExplorer');
  });
});
