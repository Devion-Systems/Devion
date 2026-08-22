-- The Devion installation itself is a shared local execution target. Remote
-- nodes remain organization-bound; the local host is deliberately global.
ALTER TABLE "nodes" ALTER COLUMN "organization_id" DROP NOT NULL;
