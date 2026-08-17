# Devion Infrastructure Module (`@repo/infrastructure`)

Das `@repo/infrastructure`-Modul ist das konsolidierte Hauptmodul für alle On-Premise Infrastruktur-Komponenten von Devion. Es bündelt die bisher separaten Module `storage` und `network` in eine saubere, hochleistungsfähige und mandantenfähige Struktur.

---

## 🏗️ Dateistruktur

```
modules/infrastructure/
├── src/
│   ├── storage/
│   │   ├── database/       # PostgreSQL Pool, Drizzle ORM Connection & Schemas
│   │   ├── blob/           # Multi-Tenant RustFS / S3 Object Storage Client
│   │   └── registry/       # Multi-Tenant Docker Registry v2 / OCI Client
│   ├── network/
│   │   ├── dns.ts          # Customer Domain & CNAME Verification
│   │   └── traefik.ts      # Traefik Dynamic Reverse Proxy Route Generation
│   ├── manager.ts          # Aggregierter Infrastructure Health Check
│   └── index.ts            # Haupt-Exportpunkt für alle Subsysteme
```

---

## 🚀 Hauptkomponenten & Nutzung

### 1. 🏥 Aggregierter Infrastructure Health Check

Prüft mit einem Aufruf die Verfügbarkeit und Latenz aller Infrastruktur-Subsysteme (Datenbank, RustFS Object Storage, Docker Registry).

```typescript
import { checkInfrastructureHealth } from "@repo/infrastructure";

const report = await checkInfrastructureHealth();
console.log(report);
/*
{
  status: "ok",
  timestamp: "2026-07-29T23:40:00.000Z",
  database: { status: "ok", latencyMs: 2 },
  rustfs: { status: "ok" },
  dockerRegistry: { status: "ok" }
}
*/
```

---

### 2. 🗄️ Storage Subsystem

#### PostgreSQL Database & Drizzle ORM
```typescript
import { db, checkDbHealth, closeDbPool } from "@repo/infrastructure";

// Drizzle ORM Queries
const projects = await db.query.projects.findMany();

// Health Check & Pool Shutdown
await checkDbHealth();
await closeDbPool();
```

#### RustFS S3 Object Storage (Zips, Backups, Logs)
```typescript
import { rustfs } from "@repo/infrastructure";

const tenantId = "org-acme-corp";

// Upload eines Deployment-Zips
await rustfs.upload(tenantId, "zips", "v1.0/build.zip", fileBuffer);

// Artefakt-Stream abrufen
const { body } = await rustfs.get(tenantId, "logs", "builds/b-12.log");
```

#### Private Docker Registry Client
```typescript
import { dockerRegistry } from "@repo/infrastructure";

const tenantId = "tenant-vertex";

// Alle Container Repositories eines Tenants auflisten
const repos = await dockerRegistry.listTenantRepositories(tenantId);

// Manifest & Digest holen
const { manifest, digest } = await dockerRegistry.getManifest(tenantId, "web-app", "v1.0.0");
```

---

### 3. 🌐 Network Subsystem

#### Traefik Reverse Proxy Route Generation
```typescript
import { TraefikManager } from "@repo/infrastructure";

const traefik = new TraefikManager("/opt/devion/traefik/dynamic");

// Interne & Kunden-Routes anlegen
await traefik.createInternalRoute({ id: "app-1", targetUrl: "http://10.0.0.5:8080" }, "app1");
await traefik.createCustomerRoute({ id: "app-1", targetUrl: "http://10.0.0.5:8080" }, "kunde.de");
```

#### DNS Domain Verification
```typescript
import { DnsManager } from "@repo/infrastructure";

const dns = new DnsManager("203.0.113.195");
const isValid = await dns.verifyCustomDomain("app.kunde.de");
```
