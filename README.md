# DocuBase — MongoDB Document Database Lab

A full-stack educational project that implements **both** MongoDB assignment topics in one small application:

1. **E-Commerce Product Catalog Management** — product CRUD, schema design, embedded variants and reviews, text search, and indexes.
2. **Library Management Document Database** — book CRUD, embedded publisher and shelf metadata, embedded physical copies/borrowers, copy issue/return operations, text search, and indexes.

The interface is responsive, uses a top navigation bar instead of a sidebar, and runs on a small Express API with MongoDB/Mongoose. It does not require Docker.

## Features

- Create, read, update, and delete products and book-title documents.
- Search products by indexed text fields (name, description, brand, tags) and books by title, author, summary, and publisher.
- Filter by category; filter products by listing status and books by copy availability/status.
- Store product variants, dimensions, and reviews as embedded subdocuments.
- Store publisher metadata, shelf location, physical copies, and borrower details as embedded documents.
- Add product reviews and issue/return library copies without creating a separate collection for every nested record.
- Schema validation and helpful API errors for invalid input and duplicate ISBN values.
- Index definitions are declared in the Mongoose models and are created by Mongoose when it connects, subject to MongoDB permissions.
- Dashboard statistics, sample seed data, liveness/readiness endpoints, and deployment configuration for Render.

## Tech stack

- **Frontend:** HTML, CSS, vanilla JavaScript
- **Backend:** Node.js, Express 5
- **Database / ODM:** MongoDB, Mongoose
- **Headers:** Helmet

## Run locally

### 1. Requirements

Install Node.js 20 or later and have access to either a local MongoDB server or a MongoDB Atlas cluster.

### 2. Configure the database

```bash
npm install
cp .env.example .env
```

Open `.env` and set `MONGODB_URI` to your own connection string. For example, a local MongoDB server may use:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/document_db_lab
PORT=3000
NODE_ENV=development
```

For Atlas, use the connection string from your cluster and replace the username, password, and cluster host. Ensure your database user's permissions and the Atlas Network Access rules permit the connection. Keep `.env` private; it is ignored by Git.

### 3. Start the app

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000). The application listens even if the MongoDB URI is missing, but database actions return HTTP 503 until the database is connected.

During development, use:

```bash
npm run dev
```

### 4. Insert demonstration data (optional)

After configuring `.env`, run:

```bash
npm run seed
```

The seed script adds three sample products and three sample book titles **only when the respective collection is empty**. It does not clear or overwrite existing records.

### 5. Syntax check

```bash
npm run check
```

## Deploy to Render (without Docker)

The repository includes `render.yaml` and `.node-version` so Render can configure the service consistently. The app listens on `0.0.0.0` and uses Render's injected `PORT` environment variable.

### Option A — Deploy from the Blueprint (recommended)

1. Push the project folder to a GitHub repository. Ensure the repository root contains `render.yaml`, `package.json`, and `server.js`.
2. In Render, choose **New → Blueprint** and connect the repository.
3. Render reads `render.yaml`, installs dependencies with `npm install`, and starts the app with `npm start`.
4. When prompted, add `MONGODB_URI` as a secret environment variable. Use a MongoDB Atlas connection string for a cloud deployment; do not use `mongodb://localhost:27017/...` because that would point to the Render container, not your Windows computer.
5. In MongoDB Atlas, configure a database user and allow network access from the Render service according to your security requirements. Avoid committing credentials to Git.
6. After deployment, open `/api/health` to see liveness and database status. Render checks `/api/ready`, which returns HTTP 200 only when MongoDB is connected.

### Option B — Create a Web Service manually

1. In Render, create a **Web Service** and connect the GitHub repository.
2. Choose the Node runtime, with **Build Command** `npm install` and **Start Command** `npm start`.
3. Set the health check path to `/api/ready`.
4. Add these environment variables in Render's Environment settings:

   - `NODE_ENV` = `production`
   - `MONGODB_URI` = your MongoDB Atlas connection URI

   Render provides `PORT` automatically. You do not need to set it manually, upload a local `.env` file, or use Docker.

### Notes for local development with WSL

A MongoDB server installed on Windows may only listen on `127.0.0.1`, which is not always reachable through the Windows host IP from WSL's NAT network. For the most predictable setup, use a dedicated Atlas database URI in the WSL `.env`; otherwise configure the Windows MongoDB listener and firewall narrowly for your WSL host. Never expose MongoDB publicly without proper authentication and network controls.

## Document model and schema design

### `products` collection

```javascript
{
  _id: ObjectId,
  name: String,
  description: String,
  brand: String,
  category: String,
  price: Number,
  status: "active" | "draft",
  tags: [String],
  variants: [
    { _id: ObjectId, sku: String, color: String, size: String, stock: Number }
  ],
  dimensions: {
    weightGrams: Number, lengthCm: Number, widthCm: Number, heightCm: Number
  },
  reviews: [
    { _id: ObjectId, reviewer: String, rating: Number, comment: String, createdAt: Date }
  ],
  createdAt: Date,
  updatedAt: Date
}
```

### `books` collection

```javascript
{
  _id: ObjectId,
  title: String,
  isbn: String,
  authors: [String],
  category: String,
  publicationYear: Number,
  publisher: { name: String, location: String },
  summary: String,
  shelf: { section: String, rack: String, position: String },
  copies: [
    {
      _id: ObjectId,
      copyCode: String,
      status: "available" | "issued" | "damaged" | "lost",
      borrower: { memberId: String, name: String, issuedAt: Date, dueAt: Date }
    }
  ],
  createdAt: Date,
  updatedAt: Date
}
```

**Why embed?** Variants and reviews usually belong to a product; shelf data and physical circulation copies belong to a book title. Embedding makes common reads self-contained and lets the sample issue/return and review actions update one parent document. In a larger production system, high-volume reviews or borrowing history may justify separate collections and references.

## Indexes

| Collection | Index | Purpose |
|---|---|---|
| `products` | `{ category: 1, price: 1 }` | Category filtering and price-oriented catalog queries |
| `products` | `{ status: 1, createdAt: -1 }` | Listing-status filters sorted by newest record |
| `products` | Text index on `name`, `description`, `brand`, `tags` | Full-text catalog search |
| `products` | `{ 'variants.sku': 1 }` | Variant/SKU lookup |
| `books` | Unique sparse `{ isbn: 1 }` | Fast ISBN lookup while allowing books without an ISBN |
| `books` | `{ category: 1, publicationYear: -1 }` | Filter by subject and sort by publication year |
| `books` | `{ 'shelf.section': 1, 'shelf.rack': 1 }` | Shelf-location lookup |
| `books` | Text index on `title`, `authors`, `summary`, `publisher.name` | Full-text book search |
| `books` | `{ 'copies.copyCode': 1 }` | Physical copy lookup |

## API reference

All request and response bodies use JSON. MongoDB must be connected for data endpoints.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Server and database connection status |
| `GET` | `/api/stats` | Dashboard counts |
| `GET` | `/api/products` | List/search/filter products (`search`, `category`, `status`) |
| `GET` | `/api/products/categories` | Distinct product categories |
| `GET` | `/api/products/:id` | Get one product |
| `POST` | `/api/products` | Create product |
| `PUT` | `/api/products/:id` | Update product |
| `DELETE` | `/api/products/:id` | Delete product |
| `POST` | `/api/products/:id/reviews` | Append an embedded review |
| `GET` | `/api/books` | List/search/filter books (`search`, `category`, `availability`) |
| `GET` | `/api/books/categories` | Distinct book categories |
| `GET` | `/api/books/:id` | Get one book title |
| `POST` | `/api/books` | Create book title |
| `PUT` | `/api/books/:id` | Update book title and embedded copies |
| `DELETE` | `/api/books/:id` | Delete book title |
| `PATCH` | `/api/books/:id/copies/:copyCode` | Change a copy's circulation status / borrower |

## Example API calls

Create a product:

```bash
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Desk Lamp","category":"Home","price":1299,"variants":[{"sku":"LAMP-WHT","color":"White","size":"Standard","stock":5}],"tags":["lighting"]}'
```

Search books:

```bash
curl "http://localhost:3000/api/books?search=data&category=Computer%20Science"
```

Issue a copy (replace the ID and copy code with values returned by the API):

```bash
curl -X PATCH http://localhost:3000/api/books/BOOK_ID/copies/LIB-DDIA-001 \
  -H "Content-Type: application/json" \
  -d '{"status":"issued","borrower":{"memberId":"STU-101","name":"Example Student","issuedAt":"2026-10-28T12:00:00Z","dueAt":"2026-11-11T12:00:00Z"}}'
```

## Suggested demonstration workflow

1. Show the two modules and the dashboard counts.
2. Create a product with multiple embedded variants and a dimensions object.
3. Search for the product and filter by category; edit the stock and then delete the record.
4. Add a review to show an embedded subdocument write.
5. Create a book title with publisher/shelf objects and several copy records.
6. Issue an available copy, then return it and show the available-copy count change.
7. Explain the declared indexes in `models/Product.js` and `models/Book.js`.

## Important scope note

This is an academic demonstration application. It does not implement login, role-based authorization, payment processing, or production-grade audit logs. Do not expose its write endpoints publicly with real operational data without adding authentication and authorization.
