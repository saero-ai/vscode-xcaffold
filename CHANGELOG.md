# Changelog

All notable changes to the xcaffold VS Code extension will be documented in this file.

## [0.4.1](https://github.com/saero-ai/vscode-xcaffold/compare/vscode-xcaffold-v0.4.0...vscode-xcaffold-v0.4.1) (2026-05-15)


### Bug Fixes

* **ci:** use RELEASE_PAT for release-please to trigger publish ([c0ef8c5](https://github.com/saero-ai/vscode-xcaffold/commit/c0ef8c58a06121ad65f1b296747db7d0ad30f9f9))

## [0.4.0](https://github.com/saero-ai/vscode-xcaffold/compare/vscode-xcaffold-v0.3.0...vscode-xcaffold-v0.4.0) (2026-05-15)


### Features

* **build:** bundle D3.js locally and add CSP to graph webview ([fe79a36](https://github.com/saero-ai/vscode-xcaffold/commit/fe79a3612cb64514befd00032431e24c8461a2ae))
* **cli:** add CLI concurrency queue with read/write serialization ([7c34f4f](https://github.com/saero-ai/vscode-xcaffold/commit/7c34f4f8cf18f8b903bd08a5632ff754c2fde15a))
* **cli:** convert PATH resolution to async with caching ([f7a3b05](https://github.com/saero-ai/vscode-xcaffold/commit/f7a3b0546a3fd0ff377fb89f91d38a9c4ead851b))
* **codelens:** add apply and validate CodeLens above kind: lines ([713ebfa](https://github.com/saero-ai/vscode-xcaffold/commit/713ebfaf2d402b6f1233b81fb3b1fba60aa6f995))
* **commands:** add file-level validate for active xcf editor ([770d9b9](https://github.com/saero-ai/vscode-xcaffold/commit/770d9b98e13e98f30842fa547e498d543e9aaaad))
* **commands:** add target provider picker to apply command ([c8e299e](https://github.com/saero-ai/vscode-xcaffold/commit/c8e299ed936945223faaecdeaf40007c3ed742c8))
* **definition:** add go-to-definition for xcf resource references ([908bcd5](https://github.com/saero-ai/vscode-xcaffold/commit/908bcd51a59a1da8e3697f3aa9aa4a031a65a7a2))
* **diff:** add diff preview provider with dry-run support ([dfef725](https://github.com/saero-ai/vscode-xcaffold/commit/dfef7254b47fe03de9855fc5f845097c6a9df430))
* enhance command palette with additional commands and improve validation diagnostics ([e9fb709](https://github.com/saero-ai/vscode-xcaffold/commit/e9fb709e42d441abe2691d73b35b4479c6928c9b))
* **ext:** add command provider for palette integration ([a47ee9a](https://github.com/saero-ai/vscode-xcaffold/commit/a47ee9a1395e6f9465bb1c201296dc0cd382dd01))
* **ext:** add diagnostic provider with validate-on-save ([0e409ff](https://github.com/saero-ai/vscode-xcaffold/commit/0e409ff105a7d2a6ec7c9e30f9b1c000fa0ff220))
* **ext:** add output channel singleton and CLI adapter with unit tests ([8bbeec1](https://github.com/saero-ai/vscode-xcaffold/commit/8bbeec1c5bbea23c6183ce391b8028f2661b9179))
* **ext:** add tree view provider with kind grouping ([e9e52ab](https://github.com/saero-ai/vscode-xcaffold/commit/e9e52abfcc66d8e1a6e443897608f8bec7faaafa))
* **extension:** add artifact directory browsing to object explorer ([6a73a05](https://github.com/saero-ai/vscode-xcaffold/commit/6a73a0561317dd90ab6509af3d63db41fea23e96))
* **extension:** add CLI fallback for projects without xcaf directory ([52340d3](https://github.com/saero-ai/vscode-xcaffold/commit/52340d3746009cefafba3c78f081c88deaefe048))
* **extension:** add code action provider with quick fixes for validation errors ([6ca7591](https://github.com/saero-ai/vscode-xcaffold/commit/6ca7591962d3fc5a1a68b077211766ad76a75182))
* **extension:** add custom .xcaf file icons and register xcaf language ID ([89ed225](https://github.com/saero-ai/vscode-xcaffold/commit/89ed22599bd6f3b6c8b642bc6e0fd1d48c3bad07))
* **extension:** add expandable metadata children to resource tree items ([fb8825f](https://github.com/saero-ai/vscode-xcaffold/commit/fb8825f6dd2aa1fbfdde7d6ddda827e1c0e0281d))
* **extension:** add file decoration provider for validation status badges ([152f70f](https://github.com/saero-ai/vscode-xcaffold/commit/152f70f935d404c12d585c363e20a52af53da950))
* **extension:** add interactive graph, status dashboard, live progress, mini-graph, sidebar cleanup ([9c7c7c5](https://github.com/saero-ai/vscode-xcaffold/commit/9c7c7c5f7b675e5ac40c9dfe5bd903fedba9e044))
* **extension:** add language intelligence providers and schema cache ([a80acf0](https://github.com/saero-ai/vscode-xcaffold/commit/a80acf048bb98170824a671f8d01a9b996f8311a))
* **extension:** add language intelligence providers and schema cache ([da47fc3](https://github.com/saero-ai/vscode-xcaffold/commit/da47fc3c84383017b5b17895fca88d4c28b56d1e))
* **extension:** add lazy property parsing to object explorer ([cc3cbe6](https://github.com/saero-ai/vscode-xcaffold/commit/cc3cbe6e0b92d932c51f49199ae87323dccbd459))
* **extension:** add live progress to apply command ([81c51cb](https://github.com/saero-ai/vscode-xcaffold/commit/81c51cb7542098f3730322fabbee5fa49fcd4bb7))
* **extension:** add resource templates for all xcaf kinds ([84cd88a](https://github.com/saero-ai/vscode-xcaffold/commit/84cd88a1d4814c4df6bf35adad1fd30a016ebe4e))
* **extension:** add semantic token provider for kind-aware syntax coloring ([72137b0](https://github.com/saero-ai/vscode-xcaffold/commit/72137b0629e6113abe7a7800e00a0034bf729620))
* **extension:** add tree context menu commands for resource management ([2393712](https://github.com/saero-ai/vscode-xcaffold/commit/2393712f3fcba2010b039c62fa9c784b05002b86))
* **extension:** add tree metadata, context menu, templates, wizard, code actions, semantic tokens, file decorations ([79534a5](https://github.com/saero-ai/vscode-xcaffold/commit/79534a56e3ae35c39d4145223ffd3738f1e80374))
* **extension:** add xcaf development harness with agents, rules, and skills ([269dcf6](https://github.com/saero-ai/vscode-xcaffold/commit/269dcf6a54d50378ee7f0bca2272ba2c52629853))
* **extension:** add XcafProjectModel data types and filesystem scanner ([9abc04f](https://github.com/saero-ai/vscode-xcaffold/commit/9abc04fde425f1f7a84da86bbfa36b3d0c2fd4d6))
* **extension:** add XcafProjectModel query methods and compatibility shim ([0327509](https://github.com/saero-ai/vscode-xcaffold/commit/0327509eb6c1688e77abbf279e12877b7efe4885))
* **extension:** full capability expansion — CLI parity and IDE-native UX ([b78c159](https://github.com/saero-ai/vscode-xcaffold/commit/b78c1593865f39896e8cb541c75891c74cb10bff))
* **extension:** handle scoped resources and flatten tree hierarchy ([6f693ef](https://github.com/saero-ai/vscode-xcaffold/commit/6f693ef3729ec4ebf385c0027693c257b3350c9b))
* **extension:** implement new resource wizard command ([6b994e5](https://github.com/saero-ai/vscode-xcaffold/commit/6b994e5f61e0072f40c35a944d38e8a9cbd394de))
* **extension:** object explorer with filesystem-scanning model ([e95faa6](https://github.com/saero-ai/vscode-xcaffold/commit/e95faa6e80633c8ad005b05be52c0f70922b465e))
* **extension:** register CodeLens and definition providers for xcf files ([d2202ac](https://github.com/saero-ai/vscode-xcaffold/commit/d2202ac7da53a314c7c5bcba3bd1f755331c52be))
* **extension:** rewrite tree provider with object explorer model ([6dfefad](https://github.com/saero-ai/vscode-xcaffold/commit/6dfefadd6444b956207cc21b39bcaf2817aa9dee))
* **extension:** update context menu actions for object explorer node types ([df1c2d7](https://github.com/saero-ai/vscode-xcaffold/commit/df1c2d7202c425266477dd92621fe8dbde767696))
* **extension:** update package.json with full metadata and configuration ([c4b90ea](https://github.com/saero-ai/vscode-xcaffold/commit/c4b90ea18c4b763a5036b90145632a7bb89c9f7d))
* **extension:** wire init wizard, import picker, and validate file commands ([a51bcd6](https://github.com/saero-ai/vscode-xcaffold/commit/a51bcd6644838a135cfb3ef6693eb3971b04a124))
* **extension:** wire init wizard, import picker, and validate file commands ([ca3758c](https://github.com/saero-ai/vscode-xcaffold/commit/ca3758c0fe0a3956c7e972a3844e8340659651d7))
* **extension:** wire webview commands for diff, fidelity, status, and schema ([7537b63](https://github.com/saero-ai/vscode-xcaffold/commit/7537b63e4b484e7a5d773b37ed4e004083384a34))
* **extension:** wire xcf index, status bar, and file watchers ([57d3519](https://github.com/saero-ai/vscode-xcaffold/commit/57d351914a9af3c1e92283b87994e5ee3f0a9ce8))
* **ext:** finalize extension with graph webview, branding, and CI workflow ([93c4051](https://github.com/saero-ai/vscode-xcaffold/commit/93c4051b9ecd425807b9607ca868c795342e8aaf))
* **ext:** implement extension entry point and finalize package.json ([8a46918](https://github.com/saero-ai/vscode-xcaffold/commit/8a46918228f6d11053305141bd8a2de261e7b94b))
* **fidelity:** add fidelity report webview with color-coded scores ([ff967b5](https://github.com/saero-ai/vscode-xcaffold/commit/ff967b555a84d7948236a9b0e36f1036997face8))
* **import:** add import picker with provider detection and multi-select ([c174254](https://github.com/saero-ai/vscode-xcaffold/commit/c17425457031e319773ac06635809cd215ac3d63))
* **index:** add shared xcf name-to-file index ([722c4c3](https://github.com/saero-ai/vscode-xcaffold/commit/722c4c3d6c99cb9ac6ad9a15c578575ccd390f1e))
* **init:** add init wizard with provider detection and import offer ([b34f938](https://github.com/saero-ai/vscode-xcaffold/commit/b34f9383962bca9ea1d7f92efbef0ecc665c3f20))
* **schema:** add CLI binary for JSON Schema generation ([3955438](https://github.com/saero-ai/vscode-xcaffold/commit/39554383aa18e55d0af6af56487d332f3b654719))
* **schema:** add core JSON Schema emitter with TDD ([f9ed898](https://github.com/saero-ai/vscode-xcaffold/commit/f9ed898646c9c5faf32a36e4a2641d78d2ae7830))
* **schema:** add golden manifest integration test and improve emitter type mapping ([d380e13](https://github.com/saero-ai/vscode-xcaffold/commit/d380e13289da42c38af3d31688678a0d411af91a))
* **schema:** add schema viewer webview with kind selection and grouped fields ([c929398](https://github.com/saero-ai/vscode-xcaffold/commit/c929398b6132e87588ae1dd21f540a026c6c4f0b))
* **schema:** generate xcaffold-schema.json and map to *.xcf in package.json ([fe737fd](https://github.com/saero-ai/vscode-xcaffold/commit/fe737fdaa7b8324dbccbe059786407ec81d9d631))
* **snippets:** add resource scaffolding snippets for xcf kinds ([f7f54bc](https://github.com/saero-ai/vscode-xcaffold/commit/f7f54bc1af3624a5fd86176f402334215507624a))
* **status:** add status dashboard webview with per-provider cards ([834ac86](https://github.com/saero-ai/vscode-xcaffold/commit/834ac86253c203715b40b1ce33b83886191bb7b7))
* **statusbar:** add status bar provider with drift indicator ([102d951](https://github.com/saero-ai/vscode-xcaffold/commit/102d9518f2646b5b7efc627912b1853fca4de4d7))
* **tree:** add click-to-open and contextValue differentiation ([14486e8](https://github.com/saero-ai/vscode-xcaffold/commit/14486e8e4a14eb0533697b77d10e361d83679788))
* **tree:** add context menus for apply and validate on resources ([f5918ee](https://github.com/saero-ai/vscode-xcaffold/commit/f5918eea8eae5b293d0953c3b15d13b18dbd8232))
* **tree:** add context menus for apply and validate on resources ([7489c7a](https://github.com/saero-ai/vscode-xcaffold/commit/7489c7ad994eaea4e2fa5a93360061ed65f170ba))
* **vscode:** add minimum CLI version check on activation ([f38444a](https://github.com/saero-ai/vscode-xcaffold/commit/f38444a337bee4419b708080d462919531ba38d4))
* **webview:** add base webview class with CSP and data source interface ([8894220](https://github.com/saero-ai/vscode-xcaffold/commit/88942203b1943651d70a44435d08dba66b6916cb))
* **webview:** add sidebar mini-graph for file dependencies ([f716ace](https://github.com/saero-ai/vscode-xcaffold/commit/f716ace2b356ed42f26acb8798fd3fd172a0f17f))
* **webview:** add status dashboard sidebar view ([59a2526](https://github.com/saero-ai/vscode-xcaffold/commit/59a25266e797342c72a5175d7a0d163fa6c26742))
* **webview:** rebuild D3 graph with interactive features ([a7e28af](https://github.com/saero-ai/vscode-xcaffold/commit/a7e28afa981d38e5652e9922a8d0ad6ccbd272b2))


### Bug Fixes

* **ci:** decouple marketplace publish from release-please workflow ([2d52513](https://github.com/saero-ai/vscode-xcaffold/commit/2d5251376d07cea86ea3f8f128ce3ff37fb5ea36))
* **ci:** target develop branch for dependabot PRs ([f685783](https://github.com/saero-ai/vscode-xcaffold/commit/f685783b6d25f25dd8b43e4c10de3cd755b30631))
* **cli:** use queue depth counter instead of boolean for write serialization ([c37b095](https://github.com/saero-ai/vscode-xcaffold/commit/c37b095e99d2bbec69bed14ff82398422a23fdde))
* **definition:** use lowercase kind keys matching xcfIndex storage format ([4a287da](https://github.com/saero-ai/vscode-xcaffold/commit/4a287da97f56f9b598317546c6a0b63762da0e97))
* **deps:** resolve serialize-javascript vulnerabilities ([70e46fe](https://github.com/saero-ai/vscode-xcaffold/commit/70e46fe0cb9c29fa880349215b8e94a5ce1da83f))
* **extension:** address plan review findings for language providers ([7f6ef07](https://github.com/saero-ai/vscode-xcaffold/commit/7f6ef07ef683de85253b0cdc3e781b01efe160fd))
* **extension:** fix graph CSP, validate scope, and add actions panel ([763723f](https://github.com/saero-ai/vscode-xcaffold/commit/763723f195e182bdd328ba61e0a8c761a270ebee))
* **extension:** fix graph inline script nonce and actions panel type ([6e9367e](https://github.com/saero-ai/vscode-xcaffold/commit/6e9367e06ce15e4c4c1455bbb63ae0ece3280b23))
* **extension:** fix tree view parser, update README/CHANGELOG for v0.2.0 ([a6f7064](https://github.com/saero-ai/vscode-xcaffold/commit/a6f706416a3df4b5c64afc140f94d5e02bdec304))
* **extension:** lower minimum CLI version to 0.3.0 ([39d6019](https://github.com/saero-ai/vscode-xcaffold/commit/39d6019eda264e6a9ee4e77d4e0071f2d6c34a54))
* **extension:** resolve resource explorer and visualization bugs ([dae6bb7](https://github.com/saero-ai/vscode-xcaffold/commit/dae6bb726211205b8764fd0db2486fc8f37d4aa6))
* **extension:** restore activity bar icon in packaged extension ([593803e](https://github.com/saero-ai/vscode-xcaffold/commit/593803eaac81cdfd7481e26ec12bfa970331c68f))
* **index:** normalize kind to lowercase in makeKey for case-insensitive resolve ([6d1a5b8](https://github.com/saero-ai/vscode-xcaffold/commit/6d1a5b88f77d3dc21a5c26c01fe7b5baf27651f2))
* **index:** use lowercase kind consistently to fix click-to-open ([fb6a072](https://github.com/saero-ai/vscode-xcaffold/commit/fb6a0720365cf846c25791779bebf78ea0a1cfb8))
* **security:** escape HTML in graph webview error messages ([cde8067](https://github.com/saero-ai/vscode-xcaffold/commit/cde8067866015fc05cd7b2150f6545de18b7aea8))
* **security:** use crypto.randomBytes for CSP nonce generation ([7b1a967](https://github.com/saero-ai/vscode-xcaffold/commit/7b1a967dbb0b37911f2ebb2fe34cd8232279a331))
* standardize file extension references and test fixture path ([69c3a90](https://github.com/saero-ai/vscode-xcaffold/commit/69c3a900ecf271de5574414d7361c8fc582671b2))
* **test:** remove duplicate Uri mock from merge ([499b052](https://github.com/saero-ai/vscode-xcaffold/commit/499b052fd90ee7e2cdaa715a6222c9ba0a5b7193))
* **tree:** handle ResourceInfo type in leaf resource mapping ([8e22048](https://github.com/saero-ai/vscode-xcaffold/commit/8e220489ecd324e263761b2dc2a4a58059882a28))
* **tree:** pass resource description to tree items and add mcp snippet delimiters ([b14da84](https://github.com/saero-ai/vscode-xcaffold/commit/b14da84a0d2f505abade01f5387e9c9034462150))
* **webview:** escape tooltip HTML and fix graph singleton disposal ([b1ce06c](https://github.com/saero-ai/vscode-xcaffold/commit/b1ce06c5b9dcfac81dc45acdf8cb45523567efca))
* **webview:** map graph edges from/to to D3 source/target and add scan diagnostics ([96e1408](https://github.com/saero-ai/vscode-xcaffold/commit/96e14087465da0ec45c317ab82d353a4dbf9187b))
* **webview:** status dashboard fixes and command cleanup ([9a486c6](https://github.com/saero-ai/vscode-xcaffold/commit/9a486c62d95cdb06442a7f1ebd38ea2778782821))
* **webview:** status dashboard reliability and UX improvements ([bf209fa](https://github.com/saero-ai/vscode-xcaffold/commit/bf209fa5adae087068968440cb922cb373a1ba4d))
* **webview:** use single nonce for CSP header and inline scripts ([4a287da](https://github.com/saero-ai/vscode-xcaffold/commit/4a287da97f56f9b598317546c6a0b63762da0e97))

## [0.3.0](https://github.com/saero-ai/vscode-xcaffold/compare/vscode-xcaffold-v0.2.1...vscode-xcaffold-v0.3.0) (2026-05-15)


### Features

* **build:** bundle D3.js locally and add CSP to graph webview ([fe79a36](https://github.com/saero-ai/vscode-xcaffold/commit/fe79a3612cb64514befd00032431e24c8461a2ae))
* **cli:** add CLI concurrency queue with read/write serialization ([7c34f4f](https://github.com/saero-ai/vscode-xcaffold/commit/7c34f4f8cf18f8b903bd08a5632ff754c2fde15a))
* **cli:** convert PATH resolution to async with caching ([f7a3b05](https://github.com/saero-ai/vscode-xcaffold/commit/f7a3b0546a3fd0ff377fb89f91d38a9c4ead851b))
* **codelens:** add apply and validate CodeLens above kind: lines ([713ebfa](https://github.com/saero-ai/vscode-xcaffold/commit/713ebfaf2d402b6f1233b81fb3b1fba60aa6f995))
* **commands:** add file-level validate for active xcf editor ([770d9b9](https://github.com/saero-ai/vscode-xcaffold/commit/770d9b98e13e98f30842fa547e498d543e9aaaad))
* **commands:** add target provider picker to apply command ([c8e299e](https://github.com/saero-ai/vscode-xcaffold/commit/c8e299ed936945223faaecdeaf40007c3ed742c8))
* **definition:** add go-to-definition for xcf resource references ([908bcd5](https://github.com/saero-ai/vscode-xcaffold/commit/908bcd51a59a1da8e3697f3aa9aa4a031a65a7a2))
* **diff:** add diff preview provider with dry-run support ([dfef725](https://github.com/saero-ai/vscode-xcaffold/commit/dfef7254b47fe03de9855fc5f845097c6a9df430))
* enhance command palette with additional commands and improve validation diagnostics ([e9fb709](https://github.com/saero-ai/vscode-xcaffold/commit/e9fb709e42d441abe2691d73b35b4479c6928c9b))
* **ext:** add command provider for palette integration ([a47ee9a](https://github.com/saero-ai/vscode-xcaffold/commit/a47ee9a1395e6f9465bb1c201296dc0cd382dd01))
* **ext:** add diagnostic provider with validate-on-save ([0e409ff](https://github.com/saero-ai/vscode-xcaffold/commit/0e409ff105a7d2a6ec7c9e30f9b1c000fa0ff220))
* **ext:** add output channel singleton and CLI adapter with unit tests ([8bbeec1](https://github.com/saero-ai/vscode-xcaffold/commit/8bbeec1c5bbea23c6183ce391b8028f2661b9179))
* **ext:** add tree view provider with kind grouping ([e9e52ab](https://github.com/saero-ai/vscode-xcaffold/commit/e9e52abfcc66d8e1a6e443897608f8bec7faaafa))
* **extension:** add artifact directory browsing to object explorer ([6a73a05](https://github.com/saero-ai/vscode-xcaffold/commit/6a73a0561317dd90ab6509af3d63db41fea23e96))
* **extension:** add CLI fallback for projects without xcaf directory ([52340d3](https://github.com/saero-ai/vscode-xcaffold/commit/52340d3746009cefafba3c78f081c88deaefe048))
* **extension:** add code action provider with quick fixes for validation errors ([6ca7591](https://github.com/saero-ai/vscode-xcaffold/commit/6ca7591962d3fc5a1a68b077211766ad76a75182))
* **extension:** add custom .xcaf file icons and register xcaf language ID ([89ed225](https://github.com/saero-ai/vscode-xcaffold/commit/89ed22599bd6f3b6c8b642bc6e0fd1d48c3bad07))
* **extension:** add expandable metadata children to resource tree items ([fb8825f](https://github.com/saero-ai/vscode-xcaffold/commit/fb8825f6dd2aa1fbfdde7d6ddda827e1c0e0281d))
* **extension:** add file decoration provider for validation status badges ([152f70f](https://github.com/saero-ai/vscode-xcaffold/commit/152f70f935d404c12d585c363e20a52af53da950))
* **extension:** add interactive graph, status dashboard, live progress, mini-graph, sidebar cleanup ([9c7c7c5](https://github.com/saero-ai/vscode-xcaffold/commit/9c7c7c5f7b675e5ac40c9dfe5bd903fedba9e044))
* **extension:** add language intelligence providers and schema cache ([a80acf0](https://github.com/saero-ai/vscode-xcaffold/commit/a80acf048bb98170824a671f8d01a9b996f8311a))
* **extension:** add language intelligence providers and schema cache ([da47fc3](https://github.com/saero-ai/vscode-xcaffold/commit/da47fc3c84383017b5b17895fca88d4c28b56d1e))
* **extension:** add lazy property parsing to object explorer ([cc3cbe6](https://github.com/saero-ai/vscode-xcaffold/commit/cc3cbe6e0b92d932c51f49199ae87323dccbd459))
* **extension:** add live progress to apply command ([81c51cb](https://github.com/saero-ai/vscode-xcaffold/commit/81c51cb7542098f3730322fabbee5fa49fcd4bb7))
* **extension:** add resource templates for all xcaf kinds ([84cd88a](https://github.com/saero-ai/vscode-xcaffold/commit/84cd88a1d4814c4df6bf35adad1fd30a016ebe4e))
* **extension:** add semantic token provider for kind-aware syntax coloring ([72137b0](https://github.com/saero-ai/vscode-xcaffold/commit/72137b0629e6113abe7a7800e00a0034bf729620))
* **extension:** add tree context menu commands for resource management ([2393712](https://github.com/saero-ai/vscode-xcaffold/commit/2393712f3fcba2010b039c62fa9c784b05002b86))
* **extension:** add tree metadata, context menu, templates, wizard, code actions, semantic tokens, file decorations ([79534a5](https://github.com/saero-ai/vscode-xcaffold/commit/79534a56e3ae35c39d4145223ffd3738f1e80374))
* **extension:** add xcaf development harness with agents, rules, and skills ([269dcf6](https://github.com/saero-ai/vscode-xcaffold/commit/269dcf6a54d50378ee7f0bca2272ba2c52629853))
* **extension:** add XcafProjectModel data types and filesystem scanner ([9abc04f](https://github.com/saero-ai/vscode-xcaffold/commit/9abc04fde425f1f7a84da86bbfa36b3d0c2fd4d6))
* **extension:** add XcafProjectModel query methods and compatibility shim ([0327509](https://github.com/saero-ai/vscode-xcaffold/commit/0327509eb6c1688e77abbf279e12877b7efe4885))
* **extension:** full capability expansion — CLI parity and IDE-native UX ([b78c159](https://github.com/saero-ai/vscode-xcaffold/commit/b78c1593865f39896e8cb541c75891c74cb10bff))
* **extension:** handle scoped resources and flatten tree hierarchy ([6f693ef](https://github.com/saero-ai/vscode-xcaffold/commit/6f693ef3729ec4ebf385c0027693c257b3350c9b))
* **extension:** implement new resource wizard command ([6b994e5](https://github.com/saero-ai/vscode-xcaffold/commit/6b994e5f61e0072f40c35a944d38e8a9cbd394de))
* **extension:** object explorer with filesystem-scanning model ([e95faa6](https://github.com/saero-ai/vscode-xcaffold/commit/e95faa6e80633c8ad005b05be52c0f70922b465e))
* **extension:** register CodeLens and definition providers for xcf files ([d2202ac](https://github.com/saero-ai/vscode-xcaffold/commit/d2202ac7da53a314c7c5bcba3bd1f755331c52be))
* **extension:** rewrite tree provider with object explorer model ([6dfefad](https://github.com/saero-ai/vscode-xcaffold/commit/6dfefadd6444b956207cc21b39bcaf2817aa9dee))
* **extension:** update context menu actions for object explorer node types ([df1c2d7](https://github.com/saero-ai/vscode-xcaffold/commit/df1c2d7202c425266477dd92621fe8dbde767696))
* **extension:** update package.json with full metadata and configuration ([c4b90ea](https://github.com/saero-ai/vscode-xcaffold/commit/c4b90ea18c4b763a5036b90145632a7bb89c9f7d))
* **extension:** wire init wizard, import picker, and validate file commands ([a51bcd6](https://github.com/saero-ai/vscode-xcaffold/commit/a51bcd6644838a135cfb3ef6693eb3971b04a124))
* **extension:** wire init wizard, import picker, and validate file commands ([ca3758c](https://github.com/saero-ai/vscode-xcaffold/commit/ca3758c0fe0a3956c7e972a3844e8340659651d7))
* **extension:** wire webview commands for diff, fidelity, status, and schema ([7537b63](https://github.com/saero-ai/vscode-xcaffold/commit/7537b63e4b484e7a5d773b37ed4e004083384a34))
* **extension:** wire xcf index, status bar, and file watchers ([57d3519](https://github.com/saero-ai/vscode-xcaffold/commit/57d351914a9af3c1e92283b87994e5ee3f0a9ce8))
* **ext:** finalize extension with graph webview, branding, and CI workflow ([93c4051](https://github.com/saero-ai/vscode-xcaffold/commit/93c4051b9ecd425807b9607ca868c795342e8aaf))
* **ext:** implement extension entry point and finalize package.json ([8a46918](https://github.com/saero-ai/vscode-xcaffold/commit/8a46918228f6d11053305141bd8a2de261e7b94b))
* **fidelity:** add fidelity report webview with color-coded scores ([ff967b5](https://github.com/saero-ai/vscode-xcaffold/commit/ff967b555a84d7948236a9b0e36f1036997face8))
* **import:** add import picker with provider detection and multi-select ([c174254](https://github.com/saero-ai/vscode-xcaffold/commit/c17425457031e319773ac06635809cd215ac3d63))
* **index:** add shared xcf name-to-file index ([722c4c3](https://github.com/saero-ai/vscode-xcaffold/commit/722c4c3d6c99cb9ac6ad9a15c578575ccd390f1e))
* **init:** add init wizard with provider detection and import offer ([b34f938](https://github.com/saero-ai/vscode-xcaffold/commit/b34f9383962bca9ea1d7f92efbef0ecc665c3f20))
* **schema:** add CLI binary for JSON Schema generation ([3955438](https://github.com/saero-ai/vscode-xcaffold/commit/39554383aa18e55d0af6af56487d332f3b654719))
* **schema:** add core JSON Schema emitter with TDD ([f9ed898](https://github.com/saero-ai/vscode-xcaffold/commit/f9ed898646c9c5faf32a36e4a2641d78d2ae7830))
* **schema:** add golden manifest integration test and improve emitter type mapping ([d380e13](https://github.com/saero-ai/vscode-xcaffold/commit/d380e13289da42c38af3d31688678a0d411af91a))
* **schema:** add schema viewer webview with kind selection and grouped fields ([c929398](https://github.com/saero-ai/vscode-xcaffold/commit/c929398b6132e87588ae1dd21f540a026c6c4f0b))
* **schema:** generate xcaffold-schema.json and map to *.xcf in package.json ([fe737fd](https://github.com/saero-ai/vscode-xcaffold/commit/fe737fdaa7b8324dbccbe059786407ec81d9d631))
* **snippets:** add resource scaffolding snippets for xcf kinds ([f7f54bc](https://github.com/saero-ai/vscode-xcaffold/commit/f7f54bc1af3624a5fd86176f402334215507624a))
* **status:** add status dashboard webview with per-provider cards ([834ac86](https://github.com/saero-ai/vscode-xcaffold/commit/834ac86253c203715b40b1ce33b83886191bb7b7))
* **statusbar:** add status bar provider with drift indicator ([102d951](https://github.com/saero-ai/vscode-xcaffold/commit/102d9518f2646b5b7efc627912b1853fca4de4d7))
* **tree:** add click-to-open and contextValue differentiation ([14486e8](https://github.com/saero-ai/vscode-xcaffold/commit/14486e8e4a14eb0533697b77d10e361d83679788))
* **tree:** add context menus for apply and validate on resources ([f5918ee](https://github.com/saero-ai/vscode-xcaffold/commit/f5918eea8eae5b293d0953c3b15d13b18dbd8232))
* **tree:** add context menus for apply and validate on resources ([7489c7a](https://github.com/saero-ai/vscode-xcaffold/commit/7489c7ad994eaea4e2fa5a93360061ed65f170ba))
* **vscode:** add minimum CLI version check on activation ([f38444a](https://github.com/saero-ai/vscode-xcaffold/commit/f38444a337bee4419b708080d462919531ba38d4))
* **webview:** add base webview class with CSP and data source interface ([8894220](https://github.com/saero-ai/vscode-xcaffold/commit/88942203b1943651d70a44435d08dba66b6916cb))
* **webview:** add sidebar mini-graph for file dependencies ([f716ace](https://github.com/saero-ai/vscode-xcaffold/commit/f716ace2b356ed42f26acb8798fd3fd172a0f17f))
* **webview:** add status dashboard sidebar view ([59a2526](https://github.com/saero-ai/vscode-xcaffold/commit/59a25266e797342c72a5175d7a0d163fa6c26742))
* **webview:** rebuild D3 graph with interactive features ([a7e28af](https://github.com/saero-ai/vscode-xcaffold/commit/a7e28afa981d38e5652e9922a8d0ad6ccbd272b2))


### Bug Fixes

* **cli:** use queue depth counter instead of boolean for write serialization ([c37b095](https://github.com/saero-ai/vscode-xcaffold/commit/c37b095e99d2bbec69bed14ff82398422a23fdde))
* **definition:** use lowercase kind keys matching xcfIndex storage format ([4a287da](https://github.com/saero-ai/vscode-xcaffold/commit/4a287da97f56f9b598317546c6a0b63762da0e97))
* **deps:** resolve serialize-javascript vulnerabilities ([70e46fe](https://github.com/saero-ai/vscode-xcaffold/commit/70e46fe0cb9c29fa880349215b8e94a5ce1da83f))
* **extension:** address plan review findings for language providers ([7f6ef07](https://github.com/saero-ai/vscode-xcaffold/commit/7f6ef07ef683de85253b0cdc3e781b01efe160fd))
* **extension:** fix graph CSP, validate scope, and add actions panel ([763723f](https://github.com/saero-ai/vscode-xcaffold/commit/763723f195e182bdd328ba61e0a8c761a270ebee))
* **extension:** fix graph inline script nonce and actions panel type ([6e9367e](https://github.com/saero-ai/vscode-xcaffold/commit/6e9367e06ce15e4c4c1455bbb63ae0ece3280b23))
* **extension:** fix tree view parser, update README/CHANGELOG for v0.2.0 ([a6f7064](https://github.com/saero-ai/vscode-xcaffold/commit/a6f706416a3df4b5c64afc140f94d5e02bdec304))
* **extension:** lower minimum CLI version to 0.3.0 ([39d6019](https://github.com/saero-ai/vscode-xcaffold/commit/39d6019eda264e6a9ee4e77d4e0071f2d6c34a54))
* **extension:** resolve resource explorer and visualization bugs ([dae6bb7](https://github.com/saero-ai/vscode-xcaffold/commit/dae6bb726211205b8764fd0db2486fc8f37d4aa6))
* **extension:** restore activity bar icon in packaged extension ([593803e](https://github.com/saero-ai/vscode-xcaffold/commit/593803eaac81cdfd7481e26ec12bfa970331c68f))
* **index:** normalize kind to lowercase in makeKey for case-insensitive resolve ([6d1a5b8](https://github.com/saero-ai/vscode-xcaffold/commit/6d1a5b88f77d3dc21a5c26c01fe7b5baf27651f2))
* **index:** use lowercase kind consistently to fix click-to-open ([fb6a072](https://github.com/saero-ai/vscode-xcaffold/commit/fb6a0720365cf846c25791779bebf78ea0a1cfb8))
* **security:** escape HTML in graph webview error messages ([cde8067](https://github.com/saero-ai/vscode-xcaffold/commit/cde8067866015fc05cd7b2150f6545de18b7aea8))
* **security:** use crypto.randomBytes for CSP nonce generation ([7b1a967](https://github.com/saero-ai/vscode-xcaffold/commit/7b1a967dbb0b37911f2ebb2fe34cd8232279a331))
* standardize file extension references and test fixture path ([69c3a90](https://github.com/saero-ai/vscode-xcaffold/commit/69c3a900ecf271de5574414d7361c8fc582671b2))
* **test:** remove duplicate Uri mock from merge ([499b052](https://github.com/saero-ai/vscode-xcaffold/commit/499b052fd90ee7e2cdaa715a6222c9ba0a5b7193))
* **tree:** handle ResourceInfo type in leaf resource mapping ([8e22048](https://github.com/saero-ai/vscode-xcaffold/commit/8e220489ecd324e263761b2dc2a4a58059882a28))
* **tree:** pass resource description to tree items and add mcp snippet delimiters ([b14da84](https://github.com/saero-ai/vscode-xcaffold/commit/b14da84a0d2f505abade01f5387e9c9034462150))
* **webview:** escape tooltip HTML and fix graph singleton disposal ([b1ce06c](https://github.com/saero-ai/vscode-xcaffold/commit/b1ce06c5b9dcfac81dc45acdf8cb45523567efca))
* **webview:** map graph edges from/to to D3 source/target and add scan diagnostics ([96e1408](https://github.com/saero-ai/vscode-xcaffold/commit/96e14087465da0ec45c317ab82d353a4dbf9187b))
* **webview:** status dashboard fixes and command cleanup ([9a486c6](https://github.com/saero-ai/vscode-xcaffold/commit/9a486c62d95cdb06442a7f1ebd38ea2778782821))
* **webview:** status dashboard reliability and UX improvements ([bf209fa](https://github.com/saero-ai/vscode-xcaffold/commit/bf209fa5adae087068968440cb922cb373a1ba4d))
* **webview:** use single nonce for CSP header and inline scripts ([4a287da](https://github.com/saero-ai/vscode-xcaffold/commit/4a287da97f56f9b598317546c6a0b63762da0e97))

## [0.2.1] - 2026-05-15

### Packaging
- Add .vscodeignore to exclude development artifacts from published extension
- VSIX size reduced from 1.5MB to ~500KB
- Add automated publish workflow for GitHub releases

### Infrastructure
- Switch license from MIT to Apache-2.0 for consistency with xcaffold CLI
- Bump GitHub Actions to latest versions (checkout v6, setup-node v6, upload-artifact v7)
- Update dependencies to resolve security advisories
- Make xcaf manifests provider-agnostic for open-source contributors

## [0.2.0] - 2026-05-04

### Build Infrastructure
- Replaced tsc with esbuild for production bundling
- Bundled D3.js locally — removed CDN dependency, added Content Security Policy
- Converted PATH resolution from synchronous to async (no more extension host blocking)
- Added CLI concurrency control — write operations serialized, reads concurrent
- Added minimum CLI version check on activation

### Tree View Enhancements
- Click any resource in the tree to open its `.xcaf` file
- Right-click context menus: Apply and Validate per resource
- Shared name-to-file index for resource resolution

### Interactive Commands
- Target-filtered apply — quick pick to select providers before compiling
- File-level validate — validate only the active `.xcaf` file
- Init wizard — detect existing provider configs, offer import, create project
- Import picker — multi-select providers to import from

### Webview Panels
- Diff preview — run `apply --dry-run` and preview changes before writing
- Status dashboard — per-provider sync status, validation details, read-only
- Schema viewer — pick a kind, view its field reference grouped by category

### Editor Integration
- CodeLens: Apply and Validate actions above `kind:` declarations
- Go-to-definition: Ctrl+click on `skills:`, `rules:`, `agents:` references
- Snippets: scaffolding templates for agent, skill, rule, workflow, mcp kinds

### Status Bar
- Displays xcaffold version, last apply timestamp, and drift status

## [0.1.0] - 2026-05-04

- Initial release
- JSON Schema integration for `.xcaf` manifest validation and autocomplete
- Validate-on-save diagnostics via `xcaffold validate`
- Interactive D3.js resource graph webview
- Resource Explorer sidebar grouped by kind
- Command Palette integration for core CLI commands
