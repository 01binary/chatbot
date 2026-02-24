# Superway Sandwich Shop — LLM Chatbot Demo

Minimal demo: React frontend + Express backend. The chatbot proxies chat to a local LLM; orders are stored in memory on the server.

## Run

1. Start your OpenAI-compatible LLM at **http://127.0.0.1:1234** (e.g. `ollama serve` with a model, or any server exposing `POST /v1/chat/completions`).
2. From this folder: **`npm start`** — runs the Express server (port 3001) and the Vite dev client (port 5173).
3. Open http://localhost:5173 and chat; orders from GET `/orders` appear in the sidebar and refetch when a new order is created or an order is cancelled.

## API (Express, port 3001)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/chat` | Body `{ messages: [{ role, content }] }`. Proxies to LLM, returns `{ role, content }`. Tool calls (get_ingredients, new_order, cancel_order, report_complaint) are executed by the client. |
| POST | `/complaint` | Body `{ details?: string }`. File a complaint (demo: logs and returns `201` with `{ received: true }`). |
| GET | `/ingredients` | Query `?category=` one of: `bread`, `cheese`, `proteins`, `vegetables`, `condiments`. Returns array of strings. |
| POST | `/orders` | Create order. Body: `{ bread, cheese?, proteins[], vegetables[], condiments[], toast }`. Returns `201` and the created order. Invalid payload returns `400` with `{ errors: [{ field, message }] }`. |
| GET | `/orders/:id` | Get one order. `404` if not found. |
| POST | `/orders/:id/cancel` | Cancel order. Sets `status: 'cancelled'`. Returns the order or `404`. |
| GET | `/orders/:id/status` | Returns `{ status }` or `404`. |
| GET | `/orders` | Returns all orders (array). |

Chat history lives only in the React app (no GET for messages); reload clears it.
