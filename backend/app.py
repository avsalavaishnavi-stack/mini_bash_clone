from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import subprocess
import os
import shlex

app = Flask(__name__)
CORS(app)

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SHELL_PATH = os.path.join(PROJECT_ROOT, "shell", "mini_bash")

current_directory = PROJECT_ROOT

ALLOWED_COMMANDS = {
    "pwd",
    "ls",
    "echo",
    "cat",
    "mkdir",
    "touch",
    "clear",
    "whoami",
    "date",
    "uname",
    "cd",
    "help",
    "history"
}

def execute_c_shell(command, cwd):
    try:
        process = subprocess.run(
            [SHELL_PATH],
            input=command + "\n",
            text=True,
            capture_output=True,
            cwd=cwd,
            timeout=5
        )

        output = process.stdout

        if process.stderr:
            output += process.stderr

        return output.strip(), process.returncode

    except subprocess.TimeoutExpired:
        return "Command timed out.", 1

    except Exception as error:
        return str(error), 1

@app.route("/")
def home():
    return send_from_directory(
        os.path.join(PROJECT_ROOT, "frontend"),
        "index.html"
    )

@app.route("/<path:filename>")
def frontend_files(filename):
    return send_from_directory(
        os.path.join(PROJECT_ROOT, "frontend"),
        filename
    )

@app.route("/api/execute", methods=["POST"])
def execute():
    global current_directory

    data = request.get_json()

    if not data or "command" not in data:
        return jsonify({
            "success": False,
            "output": "No command received.",
            "cwd": os.path.relpath(current_directory, PROJECT_ROOT)
        })

    command = data["command"].strip()

    if not command:
        return jsonify({
            "success": True,
            "output": "",
            "cwd": os.path.relpath(current_directory, PROJECT_ROOT)
        })

    try:
        parts = shlex.split(command)
    except ValueError as error:
        return jsonify({
            "success": False,
            "output": str(error),
            "cwd": os.path.relpath(current_directory, PROJECT_ROOT)
        })

    command_name = parts[0]

    if command_name not in ALLOWED_COMMANDS:
        return jsonify({
            "success": False,
            "output": f"Command not supported: {command_name}",
            "cwd": os.path.relpath(current_directory, PROJECT_ROOT)
        })

    if command_name == "help":
        output = """Available commands:

pwd       Show current directory
ls        List files and directories
cd        Change directory
mkdir     Create a directory
touch     Create a file
cat       Display file contents
echo      Display text
clear     Clear terminal
whoami    Show current user
date      Show date and time
uname     Show system information
history   Show command history
help      Show available commands
"""

        return jsonify({
            "success": True,
            "output": output,
            "cwd": os.path.relpath(current_directory, PROJECT_ROOT)
        })

    if command_name == "clear":
        return jsonify({
            "success": True,
            "output": "[CLEAR]",
            "cwd": os.path.relpath(current_directory, PROJECT_ROOT)
        })

    if command_name == "cd":
        if len(parts) == 1:
            target = PROJECT_ROOT
        else:
            target = parts[1]

        if target == "..":
            new_directory = os.path.dirname(current_directory)
        elif os.path.isabs(target):
            new_directory = os.path.abspath(target)
        else:
            new_directory = os.path.abspath(
                os.path.join(current_directory, target)
            )

        project_root = os.path.realpath(PROJECT_ROOT)
        new_directory = os.path.realpath(new_directory)

        if not (
            new_directory == project_root
            or new_directory.startswith(project_root + os.sep)
        ):
            return jsonify({
                "success": False,
                "output": "Access outside project directory is not allowed.",
                "cwd": os.path.relpath(current_directory, PROJECT_ROOT)
            })

        if not os.path.isdir(new_directory):
            return jsonify({
                "success": False,
                "output": f"cd: {target}: No such directory",
                "cwd": os.path.relpath(current_directory, PROJECT_ROOT)
            })

        current_directory = new_directory

        return jsonify({
            "success": True,
            "output": "",
            "cwd": os.path.relpath(current_directory, PROJECT_ROOT)
        })

    output, return_code = execute_c_shell(
        command,
        current_directory
    )

    return jsonify({
        "success": return_code == 0,
        "output": output,
        "cwd": os.path.relpath(current_directory, PROJECT_ROOT)
    })

@app.route("/api/status")
def status():
    return jsonify({
        "status": "running",
        "cwd": os.path.relpath(current_directory, PROJECT_ROOT),
        "shell": os.path.exists(SHELL_PATH)
    })

if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )