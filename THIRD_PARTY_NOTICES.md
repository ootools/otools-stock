# Third-party notices

The generated frontend bundles Vue 3.5.27 (MIT, copyright Yuxi/Evan You) and portions of the official OTools plugin SDK snapshot (MIT, copyright Jason Young).
Full license text is included in `licenses/vue-MIT.txt` and `licenses/otools-plugin-sdk-MIT.txt` and copied into the distributed .oplg.

The SDK was copied from the local official OTools workspace on 2026-11-13. Source, compiled runtime and source maps are deliberately tracked so this plugin builds independently; see `vendor/otools-plugin-sdk/PROVENANCE.txt`.

Tencent Finance's publicly reachable HTTP endpoints are external services, not redistributed software. Their availability, delays, usage permissions and redistribution terms are not guaranteed by this plugin. Do not use the data for trading, commercial redistribution or as an exchange-certified feed without arranging appropriate access/permissions.

Build and test dependencies (Vite, Vitest, TypeScript, jsdom, @vue/test-utils and Node tooling) are development-time only; their licenses remain in node_modules and are not shipped inside the .oplg.
