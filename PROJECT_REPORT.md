# Project Report: MongoDB Document Database Management System

## 1. Aim

To design and implement document-oriented databases in MongoDB for an e-commerce product catalog and a library management catalog, demonstrating schema design, embedded documents, CRUD operations, search, and indexing.

## 2. Objectives

- Design collections that represent real entities as BSON documents.
- Implement create, read, update, and delete operations through a web application and REST API.
- Use embedded documents and arrays for product variants, product reviews, publishers, shelf locations, physical copies, and borrower information.
- Apply text, compound, unique, sparse, and nested-field indexes to support common query patterns.
- Demonstrate filtering and search while keeping parent documents easy to retrieve.

## 3. Software and tools

- MongoDB or MongoDB Atlas
- Node.js and Express
- Mongoose ODM
- HTML, CSS, and JavaScript
- Git/GitHub for source control (recommended)

## 4. System design

The browser UI sends HTTP requests to the Express REST API. The API validates input through Mongoose schemas and reads/writes documents in MongoDB. Mongoose model definitions declare indexes and embedded schemas.

```text
Browser UI (HTML / CSS / JavaScript)
              |
              | HTTP + JSON
              v
       Express REST API
              |
              | Mongoose models and validation
              v
            MongoDB
          /          \
    products        books
```

## 5. Collection design

### 5.1 Products

Each product document stores its name, brand, description, category, base price, listing status, tags, dimensions, variants, and reviews. `variants` is an array of embedded objects containing the SKU and stock attributes. `reviews` is an array of embedded reviewer/rating/comment documents. These nested records are stored in the product document to support common catalog reads without joining another collection.

### 5.2 Books

Each book-title document stores its title, optional ISBN, author array, category, publication year, publisher object, summary, shelf object, and copies array. Each copy embeds its inventory status and a borrower object, which is populated for issued copies. This models the catalog title separately from its individual physical copies while keeping copy state within the parent document.

## 6. CRUD implementation

- **Create:** `POST /api/products` and `POST /api/books` insert documents.
- **Read:** collection endpoints, single-record endpoints, and indexed search/filter parameters retrieve documents.
- **Update:** `PUT` endpoints update documents; `PATCH /api/books/:id/copies/:copyCode` updates one embedded copy.
- **Delete:** `DELETE` endpoints remove the selected document.
- **Embedded-document operations:** `POST /api/products/:id/reviews` appends a review; the copy `PATCH` endpoint issues or returns a physical book copy.

## 7. Indexing strategy

Text indexes support keyword searches on the fields users search most often. Compound indexes align with common category/status filters. A sparse unique index on ISBN enforces uniqueness when an ISBN is provided without requiring every record to have one. Nested-field indexes support SKU, shelf, and copy-code lookup paths. Indexes consume storage and add write overhead, so indexes should be based on expected query patterns rather than added indiscriminately.

## 8. Testing checklist

| Test | Expected result |
|---|---|
| Create valid product | HTTP 201 and document is visible in the product catalog |
| Create product with negative price | Validation error; document is not created |
| Edit product variants | Updated embedded variants are returned and displayed |
| Add product review | Review appears inside the product document |
| Search for product keyword | Matching catalog document is returned |
| Create book with multiple copies | One book document stores all copy subdocuments |
| Issue an available copy | Copy status becomes `issued` and borrower is saved inside the copy |
| Return an issued copy | Copy status becomes `available` and borrower details are cleared |
| Create duplicate ISBN | MongoDB unique index rejects the duplicate |
| Start without a database URI | UI loads; database endpoints clearly return HTTP 503 |

## 9. Conclusion

The project demonstrates how MongoDB document modeling can represent related information with embedded subdocuments and arrays. The CRUD APIs, search and filtering, indexes, product review operation, and library circulation actions provide practical examples of schema design and document updates in an end-to-end application.


## Interface and Deployment Update

The interface uses a responsive top navigation bar for switching between the product and library modules. The dashboard has a clearer connection indicator, updated spacing and card treatments, responsive search/filter controls, and mobile-friendly layouts. Existing CRUD actions and embedded-document workflows remain available.

The server explicitly binds to `0.0.0.0` and reads the port from `process.env.PORT`, making it suitable for Render web services. `render.yaml` defines the Node runtime, install/start commands, production environment, and a readiness check at `/api/ready`. The readiness endpoint returns HTTP 200 only when MongoDB is connected. The `MONGODB_URI` secret must be configured on Render and point to a reachable database such as MongoDB Atlas.
