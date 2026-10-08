# Application targets

Use a reviewed JSON definition with `bash new-app.sh /absolute/destination /absolute/definition.json`. The scaffold remains unconfigured; build a generated application rather than the template itself.

A service owner must choose exact HTTPS navigation, authentication and notification origins and validate real flows. No broad parent-domain examples are endorsed. See `templates/app-definition.example.json`, `MIGRATION.md` and `PROTON-HANDBACK.md`.

Source icons belong in the generated app's `assets/icon-source.png`. Run `bash build.sh` to generate icons, validate, package with publication disabled, and checksum exactly one new AppImage. Configure independent release signing before distributing downloads. `--local-build` is explicitly unsigned development mode only.

The template's current folder and repository name is `template-electron-aaha`; historical names remain in immutable history and released assets.
