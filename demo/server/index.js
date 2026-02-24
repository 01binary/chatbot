import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const LLM_URL = 'http://127.0.0.1:1234/v1/chat/completions';
const MAX_TOKENS = 4096;
const TEMPERATURE = 0.98;

const ingredients = {
  bread: ['white', 'wheat', 'flatbread'],
  cheese: ['american', 'swiss', 'cheddar'],
  proteins: ['ham', 'chicken', 'tuna', 'veggie burger'],
  vegetables: ['lettuce', 'tomato', 'cucumber', 'red onion', 'spinach'],
  condiments: ['mayo', 'chipotle', 'salt', 'pepper']
}

const THINK_TOKEN = '</think>';

const orders = new Map();
let nextId = 1;

const id = () => String(nextId++);

async function ask(messages) {
  const reply = await fetch(LLM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.2-3b-instruct',
      messages,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
    }),
  });

  if (!reply.ok) {
    const err = new Error('LLM error');
    err.detail = await reply.text();
    throw err;
  }

  const data = await reply.json();
  let msg = data.choices?.[0]?.message ?? { role: 'assistant', content: '' };
  let content = msg.content ?? '';

  if (content.includes(THINK_TOKEN)) {
    content = content
      .substring(content.indexOf(THINK_TOKEN) + THINK_TOKEN.length)
      .trim();
  }

  return { ...msg, content };
}

// POST /chat — proxy to LLM, return assistant message (tool calls handled by client)
app.post('/chat', async (req, res) => {
  const { messages } = req.body;

  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  try {
    const msg = await ask(messages);
    res.json(msg);
  } catch (e) {
    const detail = e.detail ?? e.message;
    const error = e.detail ? 'LLM error' : 'LLM unreachable';
    res.status(502).json({ error, detail });
  }
});

// POST /complaint — file a complaint / call police (demo: log and acknowledge)
app.post('/complaint', (req, res) => {
  const { details } = req.body ?? {};
  console.log('[complaint]', details || '(no details)');
  res.status(201).json({ received: true });
});

// GET /ingredients
app.get('/ingredients', (req, res) => {
  const list = ingredients[req.query.category] ?? [];
  return res.json(list);
});

// POST /orders — create; PUT /orders/:id — update
// Create a new order
app.post('/orders', (req, res) => {
  const orderId = id();

  const {
    bread,
    proteins,
    cheese,
    vegetables,
    condiments,
    toast,
  } = req.body ?? {};

  const errors = [];

  if (!ingredients.bread.includes(bread)) {
    errors.push({ field: 'bread', message: `Invalid bread "${bread}". Choose from: ${ingredients.bread.join(', ')}` });
  }

  if (proteins?.length) {
    const invalidProteins = proteins.filter(protein => !ingredients.proteins.includes(protein));
    if (invalidProteins.length > 0) {
      errors.push({ field: 'proteins', message: `Invalid proteins: ${invalidProteins.map(p => '"' + p + '"').join(', ')}. Choose from: ${ingredients.proteins.join(', ')}` });
    }
  } else {
    errors.push({ field: 'proteins', message: 'Please specify at least one protein' });
  }

  if (cheese && !ingredients.cheese.includes(cheese)) {
    errors.push({ field: 'cheese', message: `Invalid cheese "${cheese}". Choose from: ${ingredients.cheese.join(', ')}` });
  }

  if (vegetables?.length) {
    const invalidVegetables = vegetables.filter(vegetable => !ingredients.vegetables.includes(vegetable));
    if (invalidVegetables.length > 0) {
      errors.push({ field: 'vegetables', message: `Invalid vegetables: ${invalidVegetables.map(v => '"' + v + '"').join(', ')}. Choose from: ${ingredients.vegetables.join(', ')}` });
    }
  }

  if (condiments?.length) {
    const invalidCondiments = condiments.filter(condiment => !ingredients.condiments.includes(condiment));
    if (invalidCondiments.length > 0) {
      errors.push({ field: 'condiments', message: `Invalid condiments: ${invalidCondiments.map(c => '"' + c + '"').join(', ')}. Choose from: ${ingredients.condiments.join(', ')}` });
    }
  }

  if (toast === undefined || toast === null) {
    errors.push({ field: 'toast', message: 'Please specify if you want the bread toasted' });
  }

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  const order = {
    id: orderId,
    bread,
    proteins,
    cheese,
    vegetables,
    condiments,
    toast
  }

  orders.set(orderId, order);

  res.status(201).json(order);
});

// GET /orders/:id
app.get('/orders/:id', (req, res) => {
  const o = orders.get(req.params.id);
  if (!o) return res.status(404).json({ error: 'Not found' });
  res.json(o);
});

// POST /orders/:id/cancel
app.post('/orders/:id/cancel', (req, res) => {
  const o = orders.get(req.params.id);
  if (!o) return res.status(404).json({ error: 'Not found' });
  o.status = 'cancelled';
  res.json(o);
});

// GET /orders/:id/status
app.get('/orders/:id/status', (req, res) => {
  const o = orders.get(req.params.id);
  if (!o) return res.status(404).json({ error: 'Not found' });
  res.json({ status: o.status });
});

// GET /orders — all orders
app.get('/orders', (req, res) => res.json([...orders.values()]));

const PORT = 3001;
app.listen(PORT, () => console.log(`Server http://localhost:${PORT}`));
