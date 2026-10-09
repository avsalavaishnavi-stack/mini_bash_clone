# Mini Bash Clone

A browser terminal hosted entirely on Netlify. The static page is published from `frontend/`, and `/api/execute` and `/api/status` are served by Netlify Functions. No local Flask server or separately hosted backend is required.

## Using the terminal

Type `help` for the supported commands. For example:

```text
mkdir notes
cd notes
echo "Hello, world!" > hello.txt
cat hello.txt
ls
history
```

The website uses a **virtual shell**, not the host operating system or the original C executable. Each browser has an isolated workspace identified by an HTTP-only cookie. Its files, current directory, and last 100 commands are stored in Netlify Database. Workspaces expire after seven days without a command. Cookies must be enabled to keep a workspace; clearing cookies starts a new one.

The supported commands are `pwd`, `ls`, `cd`, `mkdir`, `touch`, `cat`, `echo`, `clear`, `whoami`, `date`, `uname`, `history`, and `help`. Quotes, escaped spaces, `mkdir -p`, `ls -a`/`-l`, and `echo` redirection (`>`/`>>`) are supported. Pipes, command chaining, variable expansion, and execution of programs are not supported. Workspaces are limited to 1,000 entries and 256 KB.

## Deployment and development

Netlify reads `netlify.toml` to publish `frontend/` and deploy the functions in `netlify/functions/`. The site does not need a frontend build command. Netlify provisions the database and applies the generated migrations in `netlify/database/migrations/` when deploying.

Install dependencies with `npm ci`. Run `npm run typecheck` to check server-side TypeScript. Use `netlify dev --port 8889` for local development with Netlify integration. Local database access requires a linked Netlify site and its database integration; a plain static server cannot execute commands.

The original `backend/` Flask app and `shell/` C source are retained for reference and standalone local use, but are not used by the deployed website.
