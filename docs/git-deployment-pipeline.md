# Git deployment pipeline (D35)

Devion owns application, build, artifact, and deployment metadata. The builder
owns only execution runs and redacted logs. A manual Git deployment creates an
immutable build snapshot, queues one idempotent builder run, records the exact
commit and OCI digest, and then creates one versioned deployment through a
transaction. The existing deployment controller, scheduler, and agent handle
the resulting digest reference without Git-specific behavior.

## State and retry model

Build states are `created → queued → running → pushing → succeeded`, with
terminal `failed` and `cancelled` states. A retry always creates a new build
linked by `retryOfBuildId`; history is never rewritten. Builder run submission
uses `devion-build:<build-id>` as its idempotency key. A unique deployment
`build_id` plus the success transaction prevents repeated reconciliation from
creating duplicate deployments.

Failures before an artifact exists create no deployment. Builder and registry
failures leave a retryable failed build. A successful build whose deployment
transaction fails remains active and is reconciled again. Placement and image
pull failures remain normal deployment/workload failures.

## Configuration

- `BUILDER_API_URL` and `BUILDER_API_TOKEN` authenticate the API to the builder.
- `DEVION_BUILDER_IMAGE_PREFIX` is the registry name reachable from BuildKit.
- `DEVION_BUILD_IMAGE_PREFIX` is the same registry as seen by Docker nodes.
- `DEVION_BUILDER_REGISTRY_INSECURE=true` is intended only for the bundled local
  registry. Multi-node installations should use one TLS registry hostname
  reachable by BuildKit and every Docker daemon.
- `GIT_ALLOWED_HOSTS` explicitly permits trusted internal Git hosts.

## Security boundary

The builder stays outside the API process and has no Docker socket. BuildKit is
rootless, workspaces are per-run, checkout paths are constrained, secret files
use mode 0600, and logs retain existing redaction. Git inputs accept only
credential-free HTTPS URLs; file/ext protocols and redirects are disabled.

Private-repository credential references are represented in the application
schema but intentionally not activated until a scoped credential resolver can
deliver one-time Git secrets to the builder. Build resource limits and outbound
network policy remain deployment requirements: operators must enforce CPU,
memory, process, and egress limits around the builder/BuildKit containers.
