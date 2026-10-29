import 'dotenv/config';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Book from '../models/Book.js';

if (!process.env.MONGODB_URI) {
  console.error('Missing MONGODB_URI. Copy .env.example to .env and configure the connection string first.');
  process.exit(1);
}

const products = [
  {
    name: 'Studio Wireless Headphones', brand: 'Northline', category: 'Electronics', price: 3499,
    status: 'active', description: 'Lightweight wireless headphones with a foldable design and clear everyday sound.',
    tags: ['wireless', 'audio', 'portable'],
    variants: [
      { sku: 'NL-HP-BLK', color: 'Graphite', size: 'Standard', stock: 18 },
      { sku: 'NL-HP-SND', color: 'Sand', size: 'Standard', stock: 7 }
    ],
    dimensions: { weightGrams: 285, lengthCm: 18, widthCm: 8, heightCm: 6 },
    reviews: [{ reviewer: 'Demo Reviewer', rating: 5, comment: 'Comfortable fit and good value.' }]
  },
  {
    name: 'Everyday Ceramic Mug', brand: 'Moss & Clay', category: 'Home', price: 499,
    status: 'active', description: 'A sturdy glazed ceramic mug for coffee, tea, and desk-side breaks.',
    tags: ['ceramic', 'kitchen', 'gift'],
    variants: [{ sku: 'MC-MUG-OAT', color: 'Oat', size: '330 ml', stock: 32 }],
    dimensions: { weightGrams: 330, lengthCm: 12, widthCm: 9, heightCm: 10 }, reviews: []
  },
  {
    name: 'Canvas Daily Backpack', brand: 'Field Notes Co.', category: 'Accessories', price: 1899,
    status: 'draft', description: 'A simple daypack with an internal sleeve and adjustable shoulder straps.',
    tags: ['bag', 'canvas', 'travel'],
    variants: [{ sku: 'FN-BAG-OLV', color: 'Olive', size: '18 L', stock: 12 }],
    dimensions: { weightGrams: 560, lengthCm: 29, widthCm: 13, heightCm: 42 }, reviews: []
  }
];

const books = [
  {
    title: 'Designing Data-Intensive Applications', isbn: '9781449373320', authors: ['Martin Kleppmann'], category: 'Computer Science', publicationYear: 2017,
    publisher: { name: "O'Reilly Media", location: 'Sebastopol, California' },
    summary: 'An introduction to the principles and trade-offs behind reliable, scalable, and maintainable data systems.',
    shelf: { section: 'Technology', rack: 'A2', position: '04' },
    copies: [
      { copyCode: 'LIB-DDIA-001', status: 'available' },
      { copyCode: 'LIB-DDIA-002', status: 'issued', borrower: { memberId: 'STU-102', name: 'Demo Student', issuedAt: new Date('2026-10-20'), dueAt: new Date('2026-11-03') } },
      { copyCode: 'LIB-DDIA-003', status: 'available' }
    ]
  },
  {
    title: 'Clean Code', isbn: '9780132350884', authors: ['Robert C. Martin'], category: 'Software Engineering', publicationYear: 2008,
    publisher: { name: 'Prentice Hall', location: 'Boston, Massachusetts' },
    summary: 'A practical guide to writing readable, maintainable software and improving code through disciplined refactoring.',
    shelf: { section: 'Technology', rack: 'A1', position: '12' },
    copies: [{ copyCode: 'LIB-CC-001', status: 'available' }, { copyCode: 'LIB-CC-002', status: 'available' }]
  },
  {
    title: 'The Pragmatic Programmer', isbn: '9780135957059', authors: ['David Thomas', 'Andrew Hunt'], category: 'Software Engineering', publicationYear: 2019,
    publisher: { name: 'Addison-Wesley Professional', location: 'Boston, Massachusetts' },
    summary: 'A collection of techniques and principles for becoming a more effective software developer.',
    shelf: { section: 'Technology', rack: 'A3', position: '02' },
    copies: [{ copyCode: 'LIB-PP-001', status: 'damaged' }]
  }
];

try {
  await mongoose.connect(process.env.MONGODB_URI);
  let productsAdded = 0;
  let booksAdded = 0;
  if (await Product.countDocuments() === 0) {
    await Product.insertMany(products);
    productsAdded = products.length;
  } else console.log('Products collection is not empty; leaving its records unchanged.');
  if (await Book.countDocuments() === 0) {
    await Book.insertMany(books);
    booksAdded = books.length;
  } else console.log('Books collection is not empty; leaving its records unchanged.');
  console.log(`Seed complete. Added ${productsAdded} products and ${booksAdded} books.`);
} catch (error) {
  console.error(`Seed failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
