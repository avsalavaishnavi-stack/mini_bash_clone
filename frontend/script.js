const input = document.getElementById("command-input");
const output = document.getElementById("terminal-output");
const prompt = document.getElementById("prompt");

let commandHistory = [];
let historyIndex = -1;
let commandPending = false;

function addLine(text, className = "") {
    const line = document.createElement("div");
    line.className = className;
    line.textContent = text;
    output.appendChild(line);
}

function updatePrompt(currentPath) {
    const path = currentPath === "." ? "~" : currentPath;
    prompt.textContent = `user@mini-bash:${path}$`;
}

async function executeCommand(command) {
    if (!command.trim() || commandPending) {
        return;
    }

    commandPending = true;
    input.disabled = true;
    input.placeholder = "Running command…";

    commandHistory.push(command);
    historyIndex = commandHistory.length;

    addLine(`${prompt.textContent} ${command}`, "command");

    try {
        const response = await fetch("/api/execute", {
            method: "POST",
            credentials: "same-origin",
            signal: AbortSignal.timeout(20000),
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                command: command
            })
        });

        if (!response.headers.get("Content-Type")?.includes("application/json")) {
            throw new Error("The command endpoint is unavailable. Please try again shortly.");
        }
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.output || "The command request failed. Please try again.");
        }

        if (data.clear || (command.trim() === "clear" && data.output === "[CLEAR]")) {
            output.innerHTML = "";
        } else if (data.output) {
            addLine(
                data.output,
                data.success ? "output" : "error"
            );
        }

        if (data.cwd !== undefined) {
            updatePrompt(data.cwd);
        }

    } catch (error) {
        addLine(
            error.name === "TimeoutError"
                ? "Request timed out. Check history before retrying; the command may have completed."
                : error.message || "Unable to connect. Check your connection and try again.",
            "error"
        );
    } finally {
        commandPending = false;
        input.disabled = false;
        input.placeholder = "";
        input.focus();
        output.scrollTop = output.scrollHeight;
    }
}

input.addEventListener("keydown", function(event) {

    if (event.key === "Enter") {
        const command = input.value;
        input.value = "";
        executeCommand(command);
    }

    if (event.key === "ArrowUp") {
        event.preventDefault();

        if (historyIndex > 0) {
            historyIndex--;
            input.value = commandHistory[historyIndex];
        }
    }

    if (event.key === "ArrowDown") {
        event.preventDefault();

        if (historyIndex < commandHistory.length - 1) {
            historyIndex++;
            input.value = commandHistory[historyIndex];
        } else {
            historyIndex = commandHistory.length;
            input.value = "";
        }
    }
});

document.addEventListener("click", function() {
    input.focus();
});

window.addEventListener("load", async function() {
    try {
        const response = await fetch("/api/status", {
            credentials: "same-origin",
            signal: AbortSignal.timeout(10000)
        });
        if (!response.ok || !response.headers.get("Content-Type")?.includes("application/json")) {
            throw new Error("Unable to restore your workspace. Try a command to reconnect.");
        }
        const data = await response.json();
        updatePrompt(data.cwd ?? ".");
        commandHistory = Array.isArray(data.history) ? data.history : [];
        historyIndex = commandHistory.length;
    } catch (error) {
        addLine(error.message || "Unable to restore your workspace.", "error");
    } finally {
        input.disabled = false;
        input.focus();
    }
});
