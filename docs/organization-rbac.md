# Organizations and roles

Better Auth remains the source of truth for organizations, memberships, invitations and teams. Devion adds a permission layer without creating a second membership system.

System roles are immutable. `member` is retained as a backwards-compatible alias for `developer` while existing memberships are migrated gradually.

| Permission group | Owner | Admin | Developer | Viewer |
| --- | --- | --- | --- | --- |
| Organization read/update | yes / yes | yes / yes | yes / no | yes / no |
| Organization delete | yes | no | no | no |
| Members and invitations | all | all except ownership | read | read |
| Roles | all | all except ownership | read | read |
| Teams | all | all | read | read |
| Projects | all | all | read, create, update | read |
| Builds | all | all | read, create, cancel | read |
| Nodes | all | all | no | read |
| Audit | yes | yes | no | read |

Custom roles live in `organization_role` and `organization_role_permission`. Memberships reference them through `member.role = custom:<role-id>`, retaining Better Auth's existing membership table and lifecycle. A custom role cannot be deleted while assigned.

The API resolves effective permissions server-side from the membership role. Dashboard checks only mirror this state and never grant access. Owners are the only role that can grant ownership; Better Auth hooks prevent removal or demotion of the final owner.
