import type { Config } from "@netlify/functions";
import { and, eq, gt } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import { terminalWorkspaces } from "../../db/schema.js";
import { readWorkspaceId } from "../../lib/workspace-session.js";

export default async (request: Request) => {
    const headers = { "Cache-Control": "no-store" };
    if (request.method !== "GET") {
        return Response.json({ status: "error", output: "Method not allowed." }, { status: 405, headers: { ...headers, Allow: "GET" } });
    }
    const id = readWorkspaceId(request);
    try {
        const [workspace] = id ? await getDb().select().from(terminalWorkspaces)
            .where(and(eq(terminalWorkspaces.id, id), gt(terminalWorkspaces.expiresAt, new Date()))) : [];
        return Response.json({
            status: "running",
            shell: "virtual",
            cwd: workspace && workspace.state.cwd !== "/" ? workspace.state.cwd.slice(1) : ".",
            history: workspace?.state.history ?? []
        }, { headers });
    } catch {
        return Response.json({ status: "error", output: "The workspace service is temporarily unavailable. Please try again shortly." }, { status: 503, headers });
    }
};

export const config: Config = { path: "/api/status" };
