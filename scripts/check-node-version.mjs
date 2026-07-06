#!/usr/bin/env node
// Runs as a `pre*` npm lifecycle hook before test/check scripts. jsdom's html-encoding-sniffer
// (via @exodus/bytes, ESM-only) needs Node's stable require(esm) support — absent on Node 21 and
// earlier, present on 22.12+/23.x/24+. Without this guard, the wrong active Node produces a
// cryptic ERR_REQUIRE_ESM crash the moment vitest boots the jsdom environment, indistinguishable
// at a glance from a real test failure. `engines` + `engine-strict` in .npmrc only catch this at
// `npm install` time — this hook catches it every time scripts actually run, regardless of when
// node_modules was installed or which version manager (n/nvm/asdf) is shadowing PATH.
const [major, minor] = process.versions.node.split('.').map(Number)
const ok = (major === 22 && minor >= 12) || major >= 23

if (!ok) {
  console.error(
    `\n❌ Node ${process.versions.node} no es compatible con este proyecto (requiere ^22.12.0 || >=23.0.0).\n` +
      `   jsdom/@exodus/bytes necesitan require(esm) estable, ausente en Node <22.12.\n` +
      `   Si tienes Homebrew Node instalado, corre: PATH="/opt/homebrew/bin:$PATH" npm run check\n` +
      `   O revisa qué "node" está shadowing en tu PATH (ej. \`n\`/nvm) — \`which -a node\`.\n`,
  )
  process.exit(1)
}
