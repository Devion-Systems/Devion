# Webentwicklungsumgebung einrichten (Windows / PowerShell)

Anleitung zum Aufsetzen einer modernen Web-Dev-Umgebung mit Node.js, Bun, Git und den wichtigsten Tools. Ausgelegt für Windows mit PowerShell.

---

## 1. Node.js installieren

```browser
https://nodejs.org/en/download/current
```

Prüfen:

```powershell
node --version
npm --version
```
---

## 2. Bun installieren

Bun ist ein schneller JS/TS-Runtime, Bundler und Paketmanager in einem.

Installation via PowerShell:

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

Terminal neu starten, dann prüfen:

```powershell
bun --version
```

### Bun-Grundbefehle

```powershell
bun init              # neues Projekt initialisieren
bun install           # Dependencies installieren
bun add <package>     # Paket hinzufügen
bun add -d <package>  # Dev-Dependency hinzufügen
bun run <script>      # Script aus package.json ausführen
bun run index.ts      # Datei direkt ausführen (kein Kompilieren nötig)
bun test              # Tests ausführen
```

---

## 3. Editor: VS Code

Empfohlene Extensions:

- **ESLint** – Linting
- **Prettier** – Code-Formatierung
- **GitLens** – Git-Historie im Editor
- **Tailwind CSS IntelliSense** (falls genutzt)

---

## 4. Projekt aufsetzen (Beispiel mit Bun)

```powershell
mkdir mein-projekt
cd mein-projekt
bun init -y
```

`package.json` Beispiel-Scripts:

```json
{
  "scripts": {
    "dev": "bun run --watch src/index.ts",
    "build": "bun build ./src/index.ts --outdir ./dist",
    "test": "bun test"
  }
}
```
---

## 5. Umgebungsvariablen (.env) handhaben

`.env`-Datei im Projektroot anlegen, niemals committen:

```powershell
"node_modules`n.env`n.env.local`ndist/" | Out-File -Encoding utf8 .gitignore
```

Bun lädt `.env`-Dateien automatisch, kein zusätzliches Package nötig.

---

## 6. Schnell-Checkliste

| Tool | Prüfbefehl |
|---|---|
| Git | `git --version` |
| Node.js | `node --version` |
| npm | `npm --version` |
| Bun | `bun --version` |

---

## 7. Troubleshooting (Windows-spezifisch)

- **"Läuft nicht als Skript" / Execution Policy Fehler:**
  ```powershell
  Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
  ```
- **PATH nicht aktualisiert nach Installation:** PowerShell-Fenster komplett schließen und neu öffnen (nicht nur neuer Tab).
- **Bun-Befehl nicht gefunden:** Prüfen ob `%USERPROFILE%\.bun\bin` im PATH ist.

---

*Erstellt für lokale Windows/PowerShell-Entwicklungsumgebung mit Fokus auf Node.js und Bun*