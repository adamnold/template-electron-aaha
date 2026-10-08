# Signed releases and manual updates

The template's `release.pub` authenticates template releases only. Obtain a publisher's public key through an independent trusted channel; a key bundled beside a downloaded artifact cannot establish trust by itself. Each generated app starts with an empty key file unless its definition supplies `releasePublicKey`.

Create an app-specific key with Minisign, keeping its private file outside Git in an owner-only directory (0700, private file 0600). Commit only the public key. Store the private key as the `MINISIGN_SECRET_KEY` secret in the protected GitHub `release` environment; restrict deployments and require a trusted reviewer. Do not store keys in app definitions, source archives or release artifacts.

Manual workflow dispatch takes an existing immutable `v<package-version>` tag and an empty draft release. It resolves the tag to a full commit SHA, checks tag/package/checkout agreement, validates and builds with publication disabled, signs `SHA256SUMS`, verifies the signature, and refuses replacement of published releases or existing draft assets. It rechecks the tag before publishing. Repository administrators must preserve release tags; workflow checks cannot prevent an administrator from changing history later.

App release manifests cover exactly one AppImage and `BUILDINFO.json`; template manifests cover the source archive and metadata. Metadata records repository, full source commit, tag, wrapper and template versions, Electron/Chromium/bundled Node, architecture, build tool versions, runner details and lockfile digest. Runner images, packaging tools and timestamps can vary; these are repeatable builds, not a claim of bit-for-bit reproduction.

For a downloaded app release, place its AppImage, `BUILDINFO.json`, `SHA256SUMS` and `SHA256SUMS.minisig` in a clean `dist/` beside the matching app source/configuration. Install Minisign and the documented build-time Node. Run:

```sh
minisign -Vm dist/SHA256SUMS -p /independently/trusted/app-release.pub
(cd dist && sha256sum -c SHA256SUMS)
bash install.sh --public-key /independently/trusted/app-release.pub
```

The installer authenticates before extraction, stages and reverifies the copied payload, then installs from that verified image. Missing signatures, a wrong key, altered metadata, changed artifacts or ambiguous artifact selection fail. `--local-build` permits unsigned developer builds explicitly and still verifies checksums.

To update, repeat verification and installation for the new signed version, then restart. Ordinary uninstall preserves the profile. App owners must announce and deliver updates to existing users; no background updater is included.
