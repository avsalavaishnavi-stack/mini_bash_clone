import { randomUUID } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import type { Config } from "@netlify/functions";
import { getDb } from "../../db/index.js";
import { terminalWorkspaces } from "../../db/schema.js";
import { createWorkspace, executeCommand } from "../../lib/terminal.js";
import { readWorkspaceId } from "../../lib/workspace-session.js";

export default async (request: Request) => {
    const url = new URL(request.url);
    const headers = new Headers({ "Cache-Control": "no-store" });
    const respond = (output: string, status: number) => Response.json({ success: false, output }, { status, headers });

    if (request.method !== "POST") {
        headers.set("Allow", "POST");
        return respond("Method not allowed.", 405);
    }
    const origin = request.headers.get("Origin");
    if (origin && origin !== url.origin) return respond("Cross-origin requests are not allowed.", 403);
    if (request.headers.get("Sec-Fetch-Site") === "cross-site") return respond("Cross-site requests are not allowed.", 403);
    if (!request.headers.get("Content-Type")?.startsWith("application/json")) return respond("Expected a JSON request.", 415);

    let command: string;
    try {
        if (Number(request.headers.get("Content-Length")) > 8192) return respond("Command is too long.", 413);
        const body = await request.text();
        if (body.length > 8192) return respond("Command is too long.", 413);
        const data = JSON.parse(body);
        if (!data || typeof data.command !== "string") return respond("No command received.", 400);
        if (data.command.length > 4096) return respond("Command is too long (maximum 4,096 characters).", 413);
        command = data.command;
    } catch {
        return respond("Invalid JSON request.", 400);
    }

    try {
        const db = getDb();
        const now = new Date();
        const suppliedId = readWorkspaceId(request);
        const [existing] = suppliedId ? await db.select().from(terminalWorkspaces).where(and(eq(terminalWorkspaces.id, suppliedId), gt(terminalWorkspaces.expiresAt, now))) : [];
        await db.delete(terminalWorkspaces).where(lt(terminalWorkspaces.expiresAt, now));
        const id = existing?.id ?? randomUUID();
        const { workspace, result } = executeCommand(existing?.state ?? createWorkspace(), command);
        const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        if (existing) {
            const updated = await db.update(terminalWorkspaces).set({
                state: workspace,
                expiresAt,
                version: existing.version + 1
            }).where(and(eq(terminalWorkspaces.id, id), eq(terminalWorkspaces.version, existing.version))).returning({ id: terminalWorkspaces.id });
            if (!updated.length) return respond("Another tab updated this workspace. Please retry the command.", 409);
        } else {
            await db.insert(terminalWorkspaces).values({ id, state: workspace, expiresAt });
        }
        headers.set("Set-Cookie", `mini_bash_workspace=${id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800${url.protocol === "https:" ? "; Secure" : ""}`);
        return Response.json(result, { headers });
    } catch {
        return respond("The workspace service is temporarily unavailable. Please try again shortly.", 503);
    }
};

export const config: Config = { path: "/api/execute" };
