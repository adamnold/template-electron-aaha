# Copyable handback to Proton application owners

These items are app-specific and remain each owner's responsibility:

- Choose and validate exact navigation, authentication, popup and notification origins. Verify required flows before replacing broad `proton.me` rules.
- Use disposable accounts and profiles for signed-in authentication, uploads/downloads, clipboard, notifications, profile persistence and desktop-identity smoke tests.
- Audit each app's refreshed lockfile and document remaining advisories and dependency paths separately.
- Reconcile package versions, release tags, source commits and published artifacts, including Calendar's reported v1.3.0 gap. Issue new app releases containing the fixes.
- Configure an independent app signing key, test manual upgrades, and announce and roll out updates to installed users.
- Document service-specific traffic and that notifications require the wrapper to remain running. Distinguish wrapper versions from remotely loaded service versions.
- Keep wallet transactions, signing, seeds, private keys and key-management functionality outside this wrapper template.

Template changes do not establish that every app has the same dependency issues or that its real signed-in behavior has passed validation.
