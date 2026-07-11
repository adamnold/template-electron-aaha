# AAHA Web-App Wrapper v2

Private template for unofficial Linux Electron wrappers with stable KDE Wayland identity, explicit security policy, honest privacy disclosure, reproducible builds, and safe install/uninstall behavior.

## Privacy notice

Electron is Chromium-based. The template disables unnecessary background services and adds no AAHA telemetry, but a completed wrapper still contacts its configured service, CDNs, authentication providers, and required third parties. It cannot promise a Google-free or network-silent runtime. See PRIVACY.md.

## Deliberately incomplete

The default configuration contains invalid placeholders and configured is false. Production checks and builds fail until a maintainer completes the service review, supplies exact identity and host/permission policy, and adds assets/icon-source.png.

## Create a project

1. Copy templates/app-definition.example.json outside this repository and complete every field.
2. Run ./new-app.sh with an absolute destination and definition path.
3. Add an authorized transparent source icon.
4. Replace template documentation with service-specific facts.
5. Run ./build.sh.

Review the service’s official browser support, branding, authentication, uploads/downloads, permissions, DRM, providers, privacy behavior, and Fedora KDE compatibility before publication.

This project is unofficial and is not affiliated with any wrapped service vendor.
