# Auth & Identity – verbleibende Arbeiten

Diese Liste erfasst ausschließlich Punkte, die nach dem aktuellen Stand der Implementierung noch offen sind oder vor einem produktiven Rollout abgesichert werden müssen.

## Kritisch / jetzt umsetzen

- [ ] Die zentrale Organisations-Policy auf alle organisationsgebundenen API-Routen ausweiten (insbesondere Builds, Environments, Projekte und Game-Server) und dabei standardmäßig verweigern, wenn kein Zugriff eindeutig nachgewiesen ist.
- [ ] Autorisierungstests für Mandantentrennung ergänzen: Mitglieder einer Organisation dürfen weder Ressourcen noch API-Keys, Einladungen oder Sessions anderer Organisationen lesen oder verändern.
- [ ] API-Keys mit tatsächlich durchgesetzten Scopes/Aktionen und optionaler Organisationszuordnung versehen; Rotation, Ablaufzeit, Widerruf und Audit-Events serverseitig prüfen. `X-API-Key` bei browserbasierten API-Aufrufen in der CORS-Allowlist berücksichtigen.
- [ ] Das Rate-Limit-Backing in Produktion auf einen gemeinsamen persistenten Store (z. B. Redis) umstellen. Limits für Login, Passwort-Reset, E-Mail-OTP und Device-Authorization mit realistischen Last- und Sperrtests absichern.
- [ ] Den Organisationseinladungs-Flow Ende-zu-Ende prüfen: E-Mail-Link muss auf die tatsächliche Annahme-Seite zeigen; E-Mail-Bindung, Ablauf, einmalige Verwendung und Fehlerfälle müssen getestet sein.
- [ ] Die Auth-Migrationen (`0018_device_authorization.sql`, `0019_api_keys.sql`) in der Zielumgebung mit Backup-, Rollback- und Upgrade-Test einspielen.

## Als Nächstes

- [ ] Eine vollständige Geräte- und Session-Verwaltung bereitstellen: Session-Metadaten, gezieltes Abmelden einzelner Geräte, Widerruf aller Sitzungen und klare Trennung zwischen Browser- und CLI-Zugängen.
- [ ] Den Device-Authorization-Flow um Token-Erneuerung beziehungsweise klar dokumentierte kurzlebige Zugriffsrechte, Widerruf und Nutzungsprotokolle ergänzen.
- [ ] Sicherheitsereignisse auditierbar machen (Login, fehlgeschlagener Login, Passwort-Reset, 2FA/Passkey/API-Key-Änderungen, Einladungen und Admin-Aktionen).
- [ ] Passkey- und Wiederherstellungs-UX vervollständigen: verständliche Benennung, sichere Recovery-Policy und verpflichtende zweite Methode für privilegierte Konten.
- [ ] Die Passwort- und HIBP-Prüfungen durch Integrations- und Missbrauchstests absichern, einschließlich gleichartiger Antworten bei unbekannten E-Mail-Adressen.

## Später / Enterprise

- [ ] Devion als eigener OAuth-/OIDC-Provider: signierte JWTs, JWKS-Endpunkt, Authorization Code mit PKCE, Scopes, Consent, Access-/Refresh-Token, Token-Introspection und Widerruf.
- [ ] Externe Identity Provider produktionsreif ausbauen: mehrere OIDC-/Generic-OAuth-Provider je Organisation, Attribut- und Rollen-Mapping, Domain-Discovery und erzwungenes SSO.
- [ ] SAML 2.0 und SCIM 2.0 für Enterprise-Provisionierung und Deprovisionierung implementieren.
- [ ] Fein granularen RBAC-/Policy-Layer für Dashboard, API, CLI und Remote Agents mit organisationsweiten Rollen, Ressourcenscopes und Audit-Trail etablieren.
- [ ] Zusätzliche Enterprise-Kontrollen ergänzen: IP-/Netzwerkregeln, Gerätevertrauen, Session-Risikoanalyse, Compliance-Reporting und zentrale Schlüsselverwaltung.
