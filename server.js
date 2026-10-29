import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Product from './models/Product.js';
import Book from './models/Book.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: { directives: {
  defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", 'https://fonts.googleapis.com'], fontSrc: ["'self'", 'https://fonts.gstatic.com'], imgSrc: ["'self'", 'data:'], connectSrc: ["'self'"]
} } }));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const isConnected = () => mongoose.connection.readyState === 1;
const databaseRequired = (req, res, next) => {
  if (!isConnected()) return res.status(503).json({ error: 'Database is not connected. Set MONGODB_URI and restart the server.' });
  next();
};
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const cleanArray = value => Array.isArray(value) ? value : [];
const validObjectId = id => mongoose.isValidObjectId(id);

// Liveness: confirms the web process is responding, even while MongoDB reconnects.
app.get('/api/health', (req, res) => res.json({
  status: 'ok', database: isConnected() ? 'connected' : 'disconnected',
  environment: process.env.NODE_ENV || 'development'
}));

// Readiness: Render uses this to avoid routing traffic to an instance before MongoDB is ready.
app.get('/api/ready', (req, res) => {
  const connected = isConnected();
  res.status(connected ? 200 : 503).json({
    status: connected ? 'ready' : 'not_ready',
    database: connected ? 'connected' : 'disconnected'
  });
});

app.get('/api/stats', databaseRequired, asyncHandler(async (req, res) => {
  const [products, books, activeProducts, availableBooks, productCategories, bookCategories] = await Promise.all([
    Product.countDocuments(), Book.countDocuments(), Product.countDocuments({ status: 'active' }),
    Book.countDocuments({ 'copies.status': 'available' }), Product.distinct('category'), Book.distinct('category')
  ]);
  res.json({ products, books, activeProducts, availableBooks, productCategories: productCategories.length, bookCategories: bookCategories.length });
}));

// ── E-commerce product catalog CRUD ────────────────────────────────────────
app.get('/api/products', databaseRequired, asyncHandler(async (req, res) => {
  const { search = '', category = '', status = '' } = req.query;
  const filter = {};
  if (category) filter.category = category;
  if (status) filter.status = status;
  if (search.trim()) filter.$text = { $search: search.trim() };
  const items = await Product.find(filter).sort({ createdAt: -1 }).limit(200).lean({ virtuals: true });
  res.json(items);
}));

app.get('/api/products/categories', databaseRequired, asyncHandler(async (req, res) => {
  res.json((await Product.distinct('category')).filter(Boolean).sort((a, b) => a.localeCompare(b)));
}));

app.get('/api/products/:id', databaseRequired, asyncHandler(async (req, res) => {
  if (!validObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid product ID.' });
  const item = await Product.findById(req.params.id);
  if (!item) return res.status(404).json({ error: 'Product not found.' });
  res.json(item);
}));

app.post('/api/products', databaseRequired, asyncHandler(async (req, res) => {
  const payload = { ...req.body, tags: cleanArray(req.body.tags), variants: cleanArray(req.body.variants) };
  const item = await Product.create(payload);
  res.status(201).json(item);
}));

app.put('/api/products/:id', databaseRequired, asyncHandler(async (req, res) => {
  if (!validObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid product ID.' });
  const payload = { ...req.body, tags: cleanArray(req.body.tags), variants: cleanArray(req.body.variants) };
  const item = await Product.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true, overwrite: false });
  if (!item) return res.status(404).json({ error: 'Product not found.' });
  res.json(item);
}));

app.delete('/api/products/:id', databaseRequired, asyncHandler(async (req, res) => {
  if (!validObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid product ID.' });
  const item = await Product.findByIdAndDelete(req.params.id);
  if (!item) return res.status(404).json({ error: 'Product not found.' });
  res.json({ message: 'Product deleted.' });
}));

// Embedded-document CRUD: append a product review directly to its document.
app.post('/api/products/:id/reviews', databaseRequired, asyncHandler(async (req, res) => {
  if (!validObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid product ID.' });
  const item = await Product.findById(req.params.id);
  if (!item) return res.status(404).json({ error: 'Product not found.' });
  item.reviews.push({ reviewer: req.body.reviewer, rating: req.body.rating, comment: req.body.comment || '' });
  await item.save();
  res.status(201).json(item);
}));

// ── Library document catalog CRUD ──────────────────────────────────────────
app.get('/api/books', databaseRequired, asyncHandler(async (req, res) => {
  const { search = '', category = '', availability = '' } = req.query;
  const filter = {};
  if (category) filter.category = category;
  if (search.trim()) filter.$text = { $search: search.trim() };
  if (availability === 'available') filter['copies.status'] = 'available';
  if (availability === 'issued') filter['copies.status'] = 'issued';
  const items = await Book.find(filter).sort({ createdAt: -1 }).limit(200).lean({ virtuals: true });
  res.json(items);
}));

app.get('/api/books/categories', databaseRequired, asyncHandler(async (req, res) => {
  res.json((await Book.distinct('category')).filter(Boolean).sort((a, b) => a.localeCompare(b)));
}));

app.get('/api/books/:id', databaseRequired, asyncHandler(async (req, res) => {
  if (!validObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid book ID.' });
  const item = await Book.findById(req.params.id);
  if (!item) return res.status(404).json({ error: 'Book not found.' });
  res.json(item);
}));

app.post('/api/books', databaseRequired, asyncHandler(async (req, res) => {
  const payload = { ...req.body, authors: cleanArray(req.body.authors), copies: cleanArray(req.body.copies) };
  if (payload.isbn === '') delete payload.isbn;
  const item = await Book.create(payload);
  res.status(201).json(item);
}));

app.put('/api/books/:id', databaseRequired, asyncHandler(async (req, res) => {
  if (!validObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid book ID.' });
  const payload = { ...req.body, authors: cleanArray(req.body.authors), copies: cleanArray(req.body.copies) };
  const clearIsbn = payload.isbn === '';
  if (clearIsbn) delete payload.isbn;
  const update = { $set: payload, ...(clearIsbn ? { $unset: { isbn: 1 } } : {}) };
  const item = await Book.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true, overwrite: false });
  if (!item) return res.status(404).json({ error: 'Book not found.' });
  res.json(item);
}));

app.delete('/api/books/:id', databaseRequired, asyncHandler(async (req, res) => {
  if (!validObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid book ID.' });
  const item = await Book.findByIdAndDelete(req.params.id);
  if (!item) return res.status(404).json({ error: 'Book not found.' });
  res.json({ message: 'Book deleted.' });
}));

// Embedded-document CRUD: issue or return a physical copy by copyCode.
app.patch('/api/books/:id/copies/:copyCode', databaseRequired, asyncHandler(async (req, res) => {
  if (!validObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid book ID.' });
  const item = await Book.findById(req.params.id);
  if (!item) return res.status(404).json({ error: 'Book not found.' });
  const copy = item.copies.find(entry => entry.copyCode === req.params.copyCode.toUpperCase());
  if (!copy) return res.status(404).json({ error: 'Copy not found.' });
  const { status, borrower } = req.body;
  if (status && !['available', 'issued', 'damaged', 'lost'].includes(status)) {
    return res.status(400).json({ error: 'Invalid copy status.' });
  }
  if (status) copy.status = status;
  if (borrower) copy.borrower = borrower;
  if (copy.status !== 'issued') copy.borrower = {};
  await item.save();
  res.json(item);
}));

app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found.' }));
app.get('/{*catchall}', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err?.name === 'ValidationError') {
    return res.status(400).json({ error: 'Validation failed.', details: Object.values(err.errors).map(e => e.message) });
  }
  if (err?.code === 11000) return res.status(409).json({ error: 'A record with this unique value already exists (for example, ISBN).' });
  console.error(err);
  res.status(500).json({ error: 'Unexpected server error.' });
});

app.listen(PORT, '0.0.0.0', () => console.log(`Document DB Lab listening on 0.0.0.0:${PORT}`));

if (!process.env.MONGODB_URI) {
  console.warn('MONGODB_URI is not set. The UI will load, but database APIs will return HTTP 503 until configured.');
} else {
  mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
    .then(() => console.log('Connected to MongoDB.'))
    .catch(err => console.error(`MongoDB connection failed: ${err.message}`));
}

mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected.'));
