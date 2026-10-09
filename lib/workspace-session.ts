export function readWorkspaceId(request: Request): string | undefined {
    const cookie = request.headers.get("Cookie") ?? "";
    const id = cookie.split(";").map((part) => part.trim())
        .find((part) => part.startsWith("mini_bash_workspace="))?.slice("mini_bash_workspace=".length);
    return id && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ? id : undefined;
}
