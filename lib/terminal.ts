export type Entry = {
    path: string;
    type: "file" | "directory";
    content: string;
};

export type Workspace = {
    cwd: string;
    entries: Entry[];
    history: string[];
};

type Token = { value: string; operator: boolean };

export function createWorkspace(): Workspace {
    return {
        cwd: "/",
        entries: [
            { path: "/", type: "directory", content: "" },
            {
                path: "/README.txt",
                type: "file",
                content: "Welcome to Mini Bash Clone!\nThis is your isolated virtual workspace, not a server shell.\nTry: mkdir notes\n     cd notes\n     echo \"Hello, world!\" > hello.txt\n     cat hello.txt\nType help for all supported commands.\n"
            }
        ],
        history: []
    };
}

function tokenize(command: string): Token[] {
    const tokens: Token[] = [];
    let word = "";
    let started = false;
    let quote = "";

    function flushWord() {
        if (started) tokens.push({ value: word, operator: false });
        word = "";
        started = false;
    }

    for (let position = 0; position < command.length; position++) {
        const character = command[position];
        if (character === "\\" && quote !== "'") {
            position++;
            if (position === command.length) throw new Error("Unfinished escape sequence.");
            word += command[position];
            started = true;
        } else if (quote) {
            if (character === quote) quote = "";
            else word += character;
        } else if (character === "'" || character === '"') {
            quote = character;
            started = true;
        } else if (/\s/.test(character)) {
            flushWord();
        } else if (character === ">") {
            flushWord();
            const append = command[position + 1] === ">";
            if (append) position++;
            tokens.push({ value: append ? ">>" : ">", operator: true });
        } else if ("|;&<`".includes(character)) {
            throw new Error("Pipes, command chaining, and command substitution are not supported.");
        } else {
            word += character;
            started = true;
        }
    }
    if (quote) throw new Error("Unclosed quote.");
    flushWord();
    return tokens;
}

function resolvePath(cwd: string, target: string): string {
    let path = target;
    if (path === "~" || path.startsWith("~/")) path = "/" + path.slice(2);
    if (path === "/home/user" || path.startsWith("/home/user/")) path = path.slice(10) || "/";
    const segments = path.startsWith("/") ? [] : cwd.split("/").filter(Boolean);
    for (const segment of path.split("/")) {
        if (!segment || segment === ".") continue;
        if (segment === "..") {
            if (!segments.length) throw new Error("Access outside your workspace is not allowed.");
            segments.pop();
        } else {
            if (segment.length > 255 || /[\x00-\x1f]/.test(segment)) throw new Error("Invalid filename.");
            segments.push(segment);
        }
    }
    const resolved = "/" + segments.join("/");
    if (resolved.length > 1024) throw new Error("Path is too long.");
    return resolved;
}

function parentPath(path: string) {
    return path.slice(0, path.lastIndexOf("/")) || "/";
}

function findEntry(workspace: Workspace, path: string) {
    return workspace.entries.find((entry) => entry.path === path);
}

function requireParent(workspace: Workspace, path: string) {
    const parent = findEntry(workspace, parentPath(path));
    if (!parent || parent.type !== "directory") throw new Error("Parent directory does not exist.");
}

function requireOperands(args: string[], name: string) {
    if (!args.length) throw new Error(`${name}: missing operand`);
}

function writeFile(workspace: Workspace, path: string, content: string, append = false) {
    const entry = findEntry(workspace, path);
    if (entry?.type === "directory") throw new Error(`${path}: Is a directory`);
    requireParent(workspace, path);
    if (entry) entry.content = (append ? entry.content : "") + content;
    else workspace.entries.push({ path, type: "file", content });
}

function runCommand(workspace: Workspace, tokens: Token[]): string {
    const [name, ...args] = tokens.map((token) => token.value);
    const redirectIndex = tokens.findIndex((token) => token.operator);
    if (redirectIndex !== -1) {
        if (name !== "echo" || redirectIndex !== tokens.length - 2 || tokens.at(-1)?.operator) {
            throw new Error("Use echo TEXT > FILE or echo TEXT >> FILE to write a file.");
        }
        const words = tokens.slice(1, redirectIndex).map((token) => token.value);
        const noNewline = words[0] === "-n";
        const content = (noNewline ? words.slice(1) : words).join(" ") + (noNewline ? "" : "\n");
        writeFile(workspace, resolvePath(workspace.cwd, tokens.at(-1)!.value), content, tokens[redirectIndex].value === ">>");
        return "";
    }

    switch (name) {
        case "help":
            return [
                "Available commands:", "",
                "pwd       Show current directory",
                "ls        List files (supports -a, -l)",
                "cd        Change directory (cd returns home)",
                "mkdir     Create directories (supports -p)",
                "touch     Create empty files",
                "cat       Display file contents",
                "echo      Display text; use > or >> to write files",
                "clear     Clear terminal",
                "whoami    Show current user",
                "date      Show date and time (UTC)",
                "uname     Show environment information",
                "history   Show the last 100 commands",
                "help      Show available commands", "",
                "This is an isolated virtual shell hosted on Netlify, not a system shell.",
                "Files and directory state are saved for this browser for 7 days of inactivity.",
                "Quotes and escaped spaces are supported. Pipes, programs, and variable expansion are not."
            ].join("\n");
        case "pwd":
            return "/home/user" + (workspace.cwd === "/" ? "" : workspace.cwd);
        case "whoami":
            return "user";
        case "date":
            return new Date().toUTCString();
        case "uname":
            return args.includes("-a") ? "Mini Bash Clone — Netlify virtual shell" : "Mini Bash Clone";
        case "clear":
            return "[CLEAR]";
        case "history":
            return workspace.history.map((command, index) => `${index + 1}  ${command}`).join("\n");
        case "echo":
            return (args[0] === "-n" ? args.slice(1) : args).join(" ");
        case "cd": {
            if (args.length > 1) throw new Error("cd: too many arguments");
            const path = resolvePath(workspace.cwd, args[0] ?? "~");
            if (findEntry(workspace, path)?.type !== "directory") throw new Error(`cd: ${args[0]}: No such directory`);
            workspace.cwd = path;
            return "";
        }
        case "ls": {
            const options = args.filter((arg) => arg.startsWith("-"));
            if (options.some((option) => !/^-[al]+$/.test(option))) throw new Error("ls: supported options are -a and -l");
            const paths = args.filter((arg) => !arg.startsWith("-"));
            if (paths.length > 1) throw new Error("ls: specify one directory at a time");
            const path = resolvePath(workspace.cwd, paths[0] ?? ".");
            const entry = findEntry(workspace, path);
            if (!entry) throw new Error(`ls: ${paths[0]}: No such file or directory`);
            const showAll = options.some((option) => option.includes("a"));
            const long = options.some((option) => option.includes("l"));
            const entries = entry.type === "file" ? [entry] : workspace.entries.filter((candidate) =>
                candidate.path !== path && parentPath(candidate.path) === path &&
                (showAll || !candidate.path.split("/").at(-1)!.startsWith("."))
            );
            return entries.sort((first, second) => first.path.localeCompare(second.path)).map((candidate) => {
                const filename = candidate.path.split("/").at(-1) + (candidate.type === "directory" ? "/" : "");
                return long ? `${candidate.type === "directory" ? "drwxr-xr-x" : "-rw-r--r--"} user user ${candidate.content.length} ${filename}` : filename;
            }).join("\n");
        }
        case "mkdir": {
            const recursive = args[0] === "-p";
            const paths = recursive ? args.slice(1) : args;
            requireOperands(paths, "mkdir");
            for (const target of paths) {
                if (target.startsWith("-")) throw new Error("mkdir: only -p is supported");
                const path = resolvePath(workspace.cwd, target);
                const existing = findEntry(workspace, path);
                if (existing && (!recursive || existing.type !== "directory")) throw new Error(`mkdir: ${target}: File exists`);
                const directories = recursive ? path.split("/").slice(1).map((_, index, segments) => "/" + segments.slice(0, index + 1).join("/")) : [path];
                for (const directory of directories) {
                    const entry = findEntry(workspace, directory);
                    if (entry?.type === "file") throw new Error(`mkdir: ${target}: Not a directory`);
                    if (!entry) {
                        requireParent(workspace, directory);
                        workspace.entries.push({ path: directory, type: "directory", content: "" });
                    }
                }
            }
            return "";
        }
        case "touch":
            requireOperands(args, "touch");
            for (const target of args) {
                const path = resolvePath(workspace.cwd, target);
                if (findEntry(workspace, path)?.type === "directory") continue;
                writeFile(workspace, path, "", true);
            }
            return "";
        case "cat":
            requireOperands(args, "cat");
            return args.map((target) => {
                const entry = findEntry(workspace, resolvePath(workspace.cwd, target));
                if (!entry) throw new Error(`cat: ${target}: No such file`);
                if (entry.type !== "file") throw new Error(`cat: ${target}: Is a directory`);
                return entry.content;
            }).join("");
        default:
            throw new Error(`Command not supported: ${name}. Type help for available commands.`);
    }
}

export function executeCommand(state: Workspace, command: string) {
    const workspace = structuredClone(state);
    const trimmed = command.trim();
    if (trimmed) workspace.history = [...workspace.history, trimmed].slice(-100);
    while (workspace.history.join("\n").length > 65536) workspace.history.shift();
    try {
        const tokens = tokenize(trimmed);
        const output = trimmed ? runCommand(workspace, tokens) : "";
        if (workspace.entries.length > 1000 || Buffer.byteLength(JSON.stringify(workspace)) > 262144 || Buffer.byteLength(output) > 262144) {
            throw new Error("Workspace limit reached (1,000 entries or 256 KB). Use echo to overwrite large files.");
        }
        return { workspace, result: { success: true, output, clear: tokens[0]?.value === "clear", cwd: workspace.cwd === "/" ? "." : workspace.cwd.slice(1) } };
    } catch (error) {
        const unchanged = { ...state, history: workspace.history };
        return {
            workspace: unchanged,
            result: {
                success: false,
                output: error instanceof Error ? error.message : "Command failed.",
                cwd: state.cwd === "/" ? "." : state.cwd.slice(1)
            }
        };
    }
}
