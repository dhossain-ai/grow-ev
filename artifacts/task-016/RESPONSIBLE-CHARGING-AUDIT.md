# TASK-016 untracked-file audit

Original inventory: 76 files (24 PNG, 31 XML, 20 log, 1 JSON). All were read, hashed and classified; all 24 images were visually reviewed in a contact sheet. Text scans found no credential-pattern matches; this is not a guarantee against sensitive content. All original files are excluded and retained locally. Runtime logs and device hierarchies can expose session or device details and remain private.

No new source or tests were present in the original inventory. Generated exports, Android build output, dependencies and `.env.local` are ignored and excluded. The JSON map-style reference is a temporary asset. No evidence was deleted. New audit JSON/contact sheet and feature screenshots also remain local; only this audit documentation is staged.

| File | Category | Decision | SHA-256 |
| --- | --- | --- | --- |
| artifacts/task-016/android-build-retry.log | Useful verification evidence (check logs) | Exclude; preserve locally | 2f8896579e9eef149534ad5a58ad0db1337b9e49d59e217d71bbf767b97f03f3 |
| artifacts/task-016/android-build.log | Useful verification evidence (check logs) | Exclude; preserve locally | 55d26488dca235cc1815ff8f6b876291315b2fa7a7035774fbede236a2736fbc |
| artifacts/task-016/android-copy-ui.xml | Emulator screenshots and logs (UI hierarchy) | Exclude; preserve locally | 439f47f6330b1a0f70ec7da8bd12a4ee4fb5009e61bca566f2db75000f8ac7bd |
| artifacts/task-016/android-current.png | Emulator screenshots and logs | Exclude; preserve locally | c78e7a2f9852d9e3e796e3e24956fb6074e83751060b0f87d01e41dbe88e31e8 |
| artifacts/task-016/android-details-scroll-ui.xml | Emulator screenshots and logs (UI hierarchy) | Exclude; preserve locally | fc4e9e65933818d21ee6bd1c11b8ac0262222d20fb95782df662c1a4d06200dc |
| artifacts/task-016/android-details-ui.xml | Emulator screenshots and logs (UI hierarchy) | Exclude; preserve locally | aa4017f09a04ca095c9a43b8503eb60879af933d22ea8491db7f6fe8410f9a72 |
| artifacts/task-016/android-expanded-ui.xml | Emulator screenshots and logs (UI hierarchy) | Exclude; preserve locally | 8347e258eb4a48e0c5963b44251f259df3d614690f825c91ee0ba5736dbbda33 |
| artifacts/task-016/android-export-navigation.log | Useful verification evidence (check logs) | Exclude; preserve locally | 83855ee8443b06e032aa5c5694007050693bbac5c4c9d4b6e095bf7a51309799 |
| artifacts/task-016/android-home.png | Emulator screenshots and logs | Exclude; preserve locally | c78e7a2f9852d9e3e796e3e24956fb6074e83751060b0f87d01e41dbe88e31e8 |
| artifacts/task-016/android-latest-ui.xml | Emulator screenshots and logs (UI hierarchy) | Exclude; preserve locally | 40c7708113e518c6da9090d1a160cd849b9d94daae050888120248861847f94b |
| artifacts/task-016/android-microphone-ui.xml | Emulator screenshots and logs (UI hierarchy) | Exclude; preserve locally | dfc88a443bc4cdfab0219e5c74e69d73848428f1ea3151409f5e307251092acd |
| artifacts/task-016/android-navigation-runtime.log | Potentially sensitive files (runtime logs) | Exclude; preserve locally | 343c221a47fb5cbb97e0c9def51b0ba3a8fc4ae8e62d60fca1034daff98c5da1 |
| artifacts/task-016/android-navigation-ui.xml | Emulator screenshots and logs (UI hierarchy) | Exclude; preserve locally | a730f687f704c7e3295874f042e6968ad70f4583339a71ee4ffd790056bcc952 |
| artifacts/task-016/android-parity-export.log | Useful verification evidence (check logs) | Exclude; preserve locally | 6ddbb10d8a8aef5e73da13fc6e8f0e03ec0815ef34125f1f9dbb9eb9dfbf76b4 |
| artifacts/task-016/android-parity-navigation-ui.xml | Emulator screenshots and logs (UI hierarchy) | Exclude; preserve locally | bdc801bcfa8a6a296f867c01ba587be27e370ddc1c0afc192c47db801bda5d2e |
| artifacts/task-016/android-parity-results-ui.xml | Emulator screenshots and logs (UI hierarchy) | Exclude; preserve locally | 7f8f05b502831d5cfcd854e2d6da6d8d2e154370f8535e3ad2aa6811a1b605ce |
| artifacts/task-016/android-parity-ui.xml | Emulator screenshots and logs (UI hierarchy) | Exclude; preserve locally | deda67fb0a78379a381ffb1da2fe991059770bd3ab1f5b6f1c965bcd879ca892 |
| artifacts/task-016/android-reboot-results-ui.xml | Emulator screenshots and logs (UI hierarchy) | Exclude; preserve locally | e2cd5973e4ec3b8290a0cae11b43e13167b5870ee00272dae49b1b791562e0b6 |
| artifacts/task-016/android-reboot-results.png | Emulator screenshots and logs | Exclude; preserve locally | ae168da8b0a15d37ed53b474ac0f57e37f2bbd0db36822bdd559822b064ef886 |
| artifacts/task-016/android-reboot-ui.xml | Emulator screenshots and logs (UI hierarchy) | Exclude; preserve locally | deda67fb0a78379a381ffb1da2fe991059770bd3ab1f5b6f1c965bcd879ca892 |
| artifacts/task-016/android-reboot.png | Emulator screenshots and logs | Exclude; preserve locally | e68b4a300d56c7c73f574f4b2b790202949fbbf6e28da3c3f67b9f0121284270 |
| artifacts/task-016/android-results-ui.xml | Emulator screenshots and logs (UI hierarchy) | Exclude; preserve locally | e2cd5973e4ec3b8290a0cae11b43e13167b5870ee00272dae49b1b791562e0b6 |
| artifacts/task-016/android-results.png | Emulator screenshots and logs | Exclude; preserve locally | d8b8535313bef9e1de1978104e1188f852000e2d972402da94d064213622dd9a |
| artifacts/task-016/android-resumed-results-ui.xml | Emulator screenshots and logs (UI hierarchy) | Exclude; preserve locally | deda67fb0a78379a381ffb1da2fe991059770bd3ab1f5b6f1c965bcd879ca892 |
| artifacts/task-016/android-resumed-runtime.log | Potentially sensitive files (runtime logs) | Exclude; preserve locally | f5ae3d179836c98a8754c661dc88a6237e7d5d4d0b4793046175d91e984ec01d |
| artifacts/task-016/android-resumed-ui.xml | Emulator screenshots and logs (UI hierarchy) | Exclude; preserve locally | 3fee96c5e6d0430c95c54a79997330c84bce88693a01286d45e49a873cfbb371 |
| artifacts/task-016/android-resumed-voice-ui.xml | Emulator screenshots and logs (UI hierarchy) | Exclude; preserve locally | deda67fb0a78379a381ffb1da2fe991059770bd3ab1f5b6f1c965bcd879ca892 |
| artifacts/task-016/android-resumed.png | Emulator screenshots and logs | Exclude; preserve locally | 14f9e59d923981b73187be32353b3dfe7f9478bc7a92b39fb806ff2845a32233 |
| artifacts/task-016/android-runtime.log | Potentially sensitive files (runtime logs) | Exclude; preserve locally | d7184a2433adf69aadc18528479e4c1a03ad82efed423eb478655e04c1859625 |
| artifacts/task-016/android-ui.xml | Emulator screenshots and logs (UI hierarchy) | Exclude; preserve locally | 3fee96c5e6d0430c95c54a79997330c84bce88693a01286d45e49a873cfbb371 |
| artifacts/task-016/final-typecheck.log | Useful verification evidence (check logs) | Exclude; preserve locally | a8b3981530c7b34f6274031bb72afc0b9ddd4b3a5d4096d9d01b5bc76bf0d886 |
| artifacts/task-016/final-web-export.log | Useful verification evidence (check logs) | Exclude; preserve locally | 0cac7336cbf3986a676b567b2074f3eeebdd473fe8ff04e4c53987e26044b281 |
| artifacts/task-016/integration-android-compare.png | Emulator screenshots and logs | Exclude; preserve locally | f5a809b6f724940f6e36a65b8c95c44c1cdb38a48ecd590478b3833f14076cf3 |
| artifacts/task-016/integration-android-compare.xml | Emulator screenshots and logs (UI hierarchy) | Exclude; preserve locally | f5a76007f8e99eeed77003d16a4c338385ecbf38d43ac17c8b93fdcdb8dfb596 |
| artifacts/task-016/integration-android-initial.xml | Emulator screenshots and logs (UI hierarchy) | Exclude; preserve locally | a00455021809ee17c962b31aba3c63106927cef573cd9c664df723df5b9d037a |
| artifacts/task-016/integration-android-listening.xml | Emulator screenshots and logs (UI hierarchy) | Exclude; preserve locally | 96c1b68da56ff338de65723d64611f76dfbd30d5358ca3a354d823d494e936ae |
| artifacts/task-016/integration-android-results.xml | Emulator screenshots and logs (UI hierarchy) | Exclude; preserve locally | cd2ade8c88f35f6a9050e057ff0ac7434b444ccc0f4bf0f55befe82176e43c43 |
| artifacts/task-016/integration-android-return.xml | Emulator screenshots and logs (UI hierarchy) | Exclude; preserve locally | ec91d09ccb9983f4b7528e6cc86e84f5681107d125c24079b8aaa1a4f77352ef |
| artifacts/task-016/integration-android-routed-results.png | Emulator screenshots and logs | Exclude; preserve locally | 492c3de7ae3b41865844c7a8ed6de02c92e0840764b114f2e1f5548a33628a62 |
| artifacts/task-016/integration-android-routed.xml | Emulator screenshots and logs (UI hierarchy) | Exclude; preserve locally | 450e7f346f97057e18405a087fc910f1dd3062a2ac653fa31135f1a153a24d6a |
| artifacts/task-016/integration-android-routing-controls.xml | Emulator screenshots and logs (UI hierarchy) | Exclude; preserve locally | 450e7f346f97057e18405a087fc910f1dd3062a2ac653fa31135f1a153a24d6a |
| artifacts/task-016/integration-android-routing-start.xml | Emulator screenshots and logs (UI hierarchy) | Exclude; preserve locally | 450e7f346f97057e18405a087fc910f1dd3062a2ac653fa31135f1a153a24d6a |
| artifacts/task-016/integration-android-search.xml | Emulator screenshots and logs (UI hierarchy) | Exclude; preserve locally | 92bae95467643087097bea98744efee6d61ba4d66f26237eeda032e731d2cabc |
| artifacts/task-016/integration-android-voice-home.xml | Emulator screenshots and logs (UI hierarchy) | Exclude; preserve locally | 0ff962eea1c427b934c141cd2fb96f9f5c7591cb6187bbbf0bed5d781564761a |
| artifacts/task-016/integration-android-voice-result.xml | Emulator screenshots and logs (UI hierarchy) | Exclude; preserve locally | 763b2b36ccbe5e01f71f277d8cf7c3fe1e0b036bf993369c0ac07df5900eb730 |
| artifacts/task-016/integration-web-results.png | Useful verification evidence (web screenshot) | Exclude; preserve locally | 003d3f82ec20e129a5af1b2509cbf273bcc0867f9267fbffab8ee5abc1055435 |
| artifacts/task-016/intelligence-android-build.log | Useful verification evidence (check logs) | Exclude; preserve locally | b8f274477c2e5269c73d8ba88f9949b21c039c4162424e8a9a7399e6e23634ea |
| artifacts/task-016/intelligence-android-home.xml | Emulator screenshots and logs (UI hierarchy) | Exclude; preserve locally | 0ff962eea1c427b934c141cd2fb96f9f5c7591cb6187bbbf0bed5d781564761a |
| artifacts/task-016/intelligence-android-initial.xml | Emulator screenshots and logs (UI hierarchy) | Exclude; preserve locally | 763b2b36ccbe5e01f71f277d8cf7c3fe1e0b036bf993369c0ac07df5900eb730 |
| artifacts/task-016/intelligence-android-search.xml | Emulator screenshots and logs (UI hierarchy) | Exclude; preserve locally | 01c6d7b9ccef2fcf892db92518a441181a86b7623cf3d6711a29f905a3c1116c |
| artifacts/task-016/intelligence-typecheck.log | Useful verification evidence (check logs) | Exclude; preserve locally | a8b3981530c7b34f6274031bb72afc0b9ddd4b3a5d4096d9d01b5bc76bf0d886 |
| artifacts/task-016/lint.log | Useful verification evidence (check logs) | Exclude; preserve locally | 1117fe254c689dd8df3e27c52c8f1654bc7e4d71c95fc78a94e620e56e3c76a8 |
| artifacts/task-016/parity-lint.log | Useful verification evidence (check logs) | Exclude; preserve locally | 1117fe254c689dd8df3e27c52c8f1654bc7e4d71c95fc78a94e620e56e3c76a8 |
| artifacts/task-016/parity-tests.log | Useful verification evidence (check logs) | Exclude; preserve locally | 4aa1f438fa6aec3e0029413e65dc01362e313f7d62bf77005c7345c279c3f741 |
| artifacts/task-016/parity-typecheck.log | Useful verification evidence (check logs) | Exclude; preserve locally | a8b3981530c7b34f6274031bb72afc0b9ddd4b3a5d4096d9d01b5bc76bf0d886 |
| artifacts/task-016/positron-original.json | Temporary scripts/assets (map-style reference) | Exclude; preserve locally | a0f5b8487480a47ba5a5eaf25e165a19789dfa422f9ef9442f04da79c7d216db |
| artifacts/task-016/tests-navigation-fix.log | Useful verification evidence (check logs) | Exclude; preserve locally | ddb380db794a4ac981624ac1b9089e143fcd48252ee989c584f8802deb10e89b |
| artifacts/task-016/tests.log | Useful verification evidence (check logs) | Exclude; preserve locally | 921e95fe9dc81c97b80ac0a6c4ea929dd518191ac9b60a839ffe8c0a2a61f8fd |
| artifacts/task-016/typecheck.log | Useful verification evidence (check logs) | Exclude; preserve locally | a8b3981530c7b34f6274031bb72afc0b9ddd4b3a5d4096d9d01b5bc76bf0d886 |
| artifacts/task-016/web-1440-compare.png | Useful verification evidence (web screenshot) | Exclude; preserve locally | c771a6b29bd20ca4f9a8744a925af958ad84375c4fed923987190f266c1b8849 |
| artifacts/task-016/web-1440-expanded.png | Useful verification evidence (web screenshot) | Exclude; preserve locally | 1d5ab43907266c22f98730215498cb2f95bc38b515cc2e7668fb83486f439ffe |
| artifacts/task-016/web-1440-home.png | Useful verification evidence (web screenshot) | Exclude; preserve locally | 00d067835761f58b295a14524dd184afbbcf0dc3051ea1fb75e30351f4da28de |
| artifacts/task-016/web-320-home-final.png | Useful verification evidence (web screenshot) | Exclude; preserve locally | d7b43da33c87eeb189a3e1c13839b49fec0702d0fa72f184a0ed4d8d27c9556c |
| artifacts/task-016/web-320-home.png | Useful verification evidence (web screenshot) | Exclude; preserve locally | ce02a0997a5a8f63b740d489ee310f0e27e8fc6b480f0f511f21b28cb04c4024 |
| artifacts/task-016/web-390-home-final.png | Useful verification evidence (web screenshot) | Exclude; preserve locally | a9b6d00d8158f165db95a5adf102e810ef81a1e99069f9d7ba0a3badb8f60acd |
| artifacts/task-016/web-390-home-initial.png | Useful verification evidence (web screenshot) | Exclude; preserve locally | afaa5588615729cfd657c1b0ac9d50e6d777b995010eb5886cc6e347cf43343d |
| artifacts/task-016/web-390-home-review.png | Useful verification evidence (web screenshot) | Exclude; preserve locally | 76c32d1e0e98b498ba87c21762a5da4eb7f0c77935b9f4b056066f3eff7077de |
| artifacts/task-016/web-390-home.png | Useful verification evidence (web screenshot) | Exclude; preserve locally | a68949c7a23804b4a1920ba83078eeecdd68077c608d67ef86e62ca0a41419f1 |
| artifacts/task-016/web-390-results.png | Useful verification evidence (web screenshot) | Exclude; preserve locally | 31c7eeab563f01577b70a89932b5d57a6fcc11a3d972f995c5261724750c8d7b |
| artifacts/task-016/web-390-voice-permission.png | Useful verification evidence (web screenshot) | Exclude; preserve locally | 42d25f463071899683a0ae612f194c967533074ab57ead50f039b118ca2c04c1 |
| artifacts/task-016/web-export-navigation.log | Useful verification evidence (check logs) | Exclude; preserve locally | 2efc35b4f376d120da0dc5a5293e75ef628b13b6b01bdc172984617f7f495686 |
| artifacts/task-016/web-parity-export.log | Useful verification evidence (check logs) | Exclude; preserve locally | d07d57d63f5af238760514832f296fe384b8bc3ca460cfd55fdaab7b2412cf56 |
| artifacts/task-016/web-parity-home-390.png | Useful verification evidence (web screenshot) | Exclude; preserve locally | 0224c7dbef773bdf78a9b562581551b15d70d25488117a935332d1b3616e8218 |
| artifacts/task-016/web-parity-permission-denied.png | Useful verification evidence (web screenshot) | Exclude; preserve locally | bc23eef3b379e93d45ca25bd192bd98802f27baff6791213f31c04c41834fc63 |
| artifacts/task-016/web-parity-results.png | Useful verification evidence (web screenshot) | Exclude; preserve locally | a19e9044e1ef2b24a566d66d8427da98e1f2fae67746a60238ab20eed04440b7 |
| artifacts/task-016/web-parity-voice-unrecognized.png | Useful verification evidence (web screenshot) | Exclude; preserve locally | b442c6be8b1b12b2f71da3d9e38bd6c0b46a45f4d2fea00ff0a94ea41c387ff5 |
