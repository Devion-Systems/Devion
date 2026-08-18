
Das `@repo/infrastructure`-Modul bildet das Rückgrat der Devion On-Premise Hosting-Plattform. Es konsolidiert alle **Storage-** (Datenbank, Blob Object Storage, Container Registry) und **Netzwerk-Subsysteme** (DNS, Traefik Reverse Proxy) in einer gemeinsamen, Enterprise-fähigen Architektur.

---

## 📐 Architektur & Verzeichnisstruktur

```
modules/infrastructure/
├── docs/                      # Ausführliche Modul-Dokumentation & Leitfäden
│   └── README.md
├── src/
│   ├── storage/               # Datenspeicher- & Registry-Subsysteme
│   │   ├── database/          # PostgreSQL Connection Pool & Drizzle ORM Schemas
│   │   │   ├── schema/        # Table Schemas (Projects, Build Queue, Apps, Feature Flags)
│   │   │   └── db.ts          # Singleton Pool, KeepAlive, Health Check & Graceful Shutdown
│   │   ├── blob/              # Blob / S3 Object Storage Client
│   │   │   ├── connection.ts  # S3 Credentials & SDK Setup
│   │   │   ├── blob-client.ts # Multi-Tenant Bucket Manager (Zips, Backups, Logs)
│   │   │   └── client.ts      # Main Exports & Helper Utilities
│   │   └── registry/          # Private Docker Registry v2 / OCI Client
│   │       ├── config.ts      # Registry Env Schema & Validation
│   │       └── client.ts      # OCI Manifest, Tag & Layer Management
│   ├── network/               # Routing & Traffic-Subsysteme
│   │   ├── dns.ts             # Custom Domain & CNAME Validation
│   │   └── traefik.ts         # Dynamische Routing-Generierung für Traefik Proxy
│   ├── manager.ts             # Aggregierter Infrastructure Health Check & Diagnostics
│   └── index.ts               # Haupt-Exportpunkt des Moduls
├── package.json
└── tsconfig.json
```

---

## 🛠️ Schnellstart & Integration

### Import-Möglichkeiten

Alle Komponenten können sowohl direkt als Singleton-Instanzen als auch gruppiert über Namespaces importiert werden:

```typescript
import { 
  // Direct Singleton & Class Exports
  db, 
  blobStorage, 
  dockerRegistry, 
  TraefikManager, 
  DnsManager,
  checkInfrastructureHealth,
  
  // Grouped Namespace Exports
  StorageDB,
  StorageBlob,
  StorageRegistry,
  Network
} from "@repo/infrastructure";
```

---

## 🗄️ 1. Storage Subsysteme

### A. PostgreSQL Database (`StorageDB` / `db`)

Stellt verlässliches Singleton Connection Pooling über `pg` und `drizzle-orm` bereit.

* **Singleton Pool & KeepAlive**: Automatische Erkennung und Trennung inaktiver Sockets, konfigurierbar über Env-Variablen (`DB_POOL_MAX`, `DB_POOL_MIN`, `DB_IDLE_TIMEOUT`).
* **Health Check & Latency**: `checkDbHealth()` führt einen schnellen System-Ping (`SELECT 1`) durch und ermittelt die Antwortlatenz.
* **Graceful Shutdown**: `closeDbPool()` beendet alle offenen Sockets geordnet bei Server-Shutdowns.

#### Beispiel:
```typescript
import { db, checkDbHealth, closeDbPool } from "@repo/infrastructure";

// Health-Check ausführen
const health = await checkDbHealth();
console.log(`DB Status: ${health.status}, Latency: ${health.latencyMs}ms`);

// Drizzle ORM Query
const activeProjects = await db.query.projects.findMany();

// Clean Shutdown
process.on("SIGTERM", async () => {
  await closeDbPool();
});
```

---

### B. Blob Object Storage (`StorageBlob` / `blobStorage`)

Speichert Artefakte für Devion (z. B. Quellcode `.zip` Dateien, System-Backups und Build/Container-Logs).

* **Multi-Tenant Naming**: Buckets werden automatisch pro Mandant und Artefakt-Kategorie isoliert (`devion-{tenantId}-{artifactType}`).
* **Artefakt-Kategorien**: `zips`, `backups`, `logs`, `builds`, `assets`.
* **Auto-Provisioning**: Nicht existierende Buckets werden beim ersten Schreibvorgang automatisch angelegt.

#### Beispiel:
```typescript
import { blobStorage } from "@repo/infrastructure";

const tenantId = "org-acme";

// 1. Quellcode-Zip hochladen
await blobStorage.upload(tenantId, "zips", "v1.0.0/source.zip", zipBuffer);

// 2. Log-Datei als Stream abrufen
const { body, contentType } = await blobStorage.get(tenantId, "logs", "builds/b-100.log");

// 3. Artefakte auflisten
const backups = await blobStorage.list(tenantId, "backups");
```

---

### C. Docker Registry Client (`StorageRegistry` / `dockerRegistry`)

Echtzeit-Kommunikation mit der privaten Docker Container Registry über die Docker Registry HTTP API V2 / OCI Specification.

* **Mandantentrennung**: Container Repositories werden isoliert als `{tenantId}/{imageName}` angelegt.
* **Feature-Umfang**: Image Tag Listing, OCI Manifest Inspection, Content Digest Resolution und Löschen veralteter Tags/Blobs.

#### Beispiel:
```typescript
import { dockerRegistry } from "@repo/infrastructure";

const tenantId = "tenant-vertex";

// 1. Connectivity Check
const isAlive = await dockerRegistry.ping();

// 2. Alle Container-Images des Tenants abfragen
const repos = await dockerRegistry.listTenantRepositories(tenantId);
// -> ["tenant-vertex/frontend", "tenant-vertex/backend"]

// 3. Image Tags abfragen
const tags = await dockerRegistry.listTags(tenantId, "frontend");

// 4. Manifest & Manifest-Digest abrufen
const { manifest, digest } = await dockerRegistry.getManifest(tenantId, "frontend", "v1.2.0");

// 5. Image-Tag löschen
await dockerRegistry.deleteTag(tenantId, "frontend", "v1.0.0-old");
```

---

## 🌐 2. Network Subsysteme

### A. Traefik Dynamic Reverse Proxy (`TraefikManager`)

Verwaltet die dynamischen Routing-Konfigurationen für Traefik als YAML-Dateien im Dateisystem.

* **Interne Routen**: Generiert `.devion.local` Routen mit selbstsigniertem TLS für interne micro-VMs / Container.
* **Kunden-Routen**: Generiert Routen für Kunden-Domains mit Let's Encrypt SSL CertResolver.

#### Beispiel:
```typescript
import { TraefikManager } from "@repo/infrastructure";

const traefik = new TraefikManager("/opt/devion/traefik/dynamic");

// Interne Dev-Route anlegen
await traefik.createInternalRoute(
  { id: "deployment-892", targetUrl: "http://10.0.0.12:8080" },
  "my-app"
);

// Kunden-Domain mit Let's Encrypt SSL freischalten
await traefik.createCustomerRoute(
  { id: "deployment-892", targetUrl: "http://10.0.0.12:8080" },
  "meine-kunden-domain.de"
);

// Routen bei Stopp/Löschung entfernen
await traefik.removeRoutes("deployment-892");
```

---

### B. DNS Domain Verification (`DnsManager`)

Prüft, ob externe Kunden-Domains oder CNAME-Einträge korrekt auf die Server-IP bzw. das Devion-Cluster verweisen.

#### Beispiel:
```typescript
import { DnsManager } from "@repo/infrastructure";

const dns = new DnsManager("203.0.113.195");

// Prüfen ob A-Record auf die Server-IP zeigt
const isDomainValid = await dns.verifyCustomDomain("app.kunde.de");

// Prüfen ob CNAME auf den Cluster-Hostname zeigt
const isCnameValid = await dns.verifyCname("app.kunde.de", "cname.devion.local");
```

---

## 🏥 3. Infrastructure Diagnostics (`checkInfrastructureHealth`)

Der aggregierte Health Check prüft alle Subsysteme in einem Aufruf und liefert einen strukturierten Bericht für Monitoring-Endpoints.

#### Beispiel:
```typescript
import { checkInfrastructureHealth } from "@repo/infrastructure";

const report = await checkInfrastructureHealth();
console.log(report);
/*
{
  status: "ok",
  timestamp: "2026-07-29T23:45:00.000Z",
  database: { status: "ok", latencyMs: 3 },
  blobStorage: { status: "ok" },
  dockerRegistry: { status: "ok" }
}
*/
```

---

## ⚙️ Umweltkonfiguration (Environment Variables)

Das Modul validiert alle Umgebungsvariablen automatisch über `@repo/core`.

| Variable | Beschreibung | Standardwert |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL Verbindungs-String | *Erforderlich für DB* |
| `DB_POOL_MAX` | Maximale Verbindungen im Pool | `20` |
| `DB_POOL_MIN` | Minimale offene Verbindungen | `5` |
| `DB_IDLE_TIMEOUT` | Idle Timeout in ms | `30000` |
| `S3_ENDPOINT` | Blob S3 Endpoint URL | `http://localhost:9000` |
| `S3_ACCESS_KEY` | Blob S3 Access Key | `onprem_access_key` |
| `S3_SECRET_KEY` | Blob S3 Secret Key | `onprem_secret_key...` |
| `S3_REGION` | S3 Region | `auto` |
| `DOCKER_REGISTRY_URL` | Private Docker Registry URL | `http://localhost:5000` |
| `DOCKER_REGISTRY_USERNAME` | Registry HTTP Basic Auth User | *optional* |
| `DOCKER_REGISTRY_PASSWORD` | Registry HTTP Basic Auth Password | *optional* |
