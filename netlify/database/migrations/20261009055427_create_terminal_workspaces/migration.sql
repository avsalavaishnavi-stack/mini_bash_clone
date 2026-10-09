CREATE TABLE "terminal_workspaces" (
	"id" uuid PRIMARY KEY,
	"state" jsonb NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "terminal_workspaces_expires_at_idx" ON "terminal_workspaces" ("expires_at");