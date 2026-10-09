const input = document.getElementById("command-input");
const output = document.getElementById("terminal-output");
const prompt = document.getElementById("prompt");

let commandHistory = [];
let historyIndex = -1;

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
    if (!command.trim()) {
        return;
    }

    commandHistory.push(command);
    historyIndex = commandHistory.length;

    addLine(`${prompt.textContent} ${command}`, "command");

    try {
        const response = await fetch("http://127.0.0.1:5000/api/execute", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                command: command
            })
        });

        const data = await response.json();

        if (data.output === "[CLEAR]") {
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

        output.scrollTop = output.scrollHeight;

    } catch (error) {
        addLine(
            "Error: Backend server is not running.",
            "error"
        );
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

window.addEventListener("load", function() {
    input.focus();
});