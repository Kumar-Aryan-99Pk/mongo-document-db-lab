import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const PublisherSchema = new Schema({
  name: { type: String, trim: true, default: '' },
  location: { type: String, trim: true, default: '' }
}, { _id: false });

const ShelfSchema = new Schema({
  section: { type: String, trim: true, default: 'General' },
  rack: { type: String, trim: true, default: 'A1' },
  position: { type: String, trim: true, default: '01' }
}, { _id: false });

const BorrowerSchema = new Schema({
  memberId: { type: String, trim: true, default: '' },
  name: { type: String, trim: true, default: '' },
  issuedAt: { type: Date, default: null },
  dueAt: { type: Date, default: null }
}, { _id: false });

const CopySchema = new Schema({
  copyCode: { type: String, required: true, trim: true, uppercase: true },
  status: { type: String, enum: ['available', 'issued', 'damaged', 'lost'], default: 'available' },
  borrower: { type: BorrowerSchema, default: () => ({}) }
}, { _id: true });

const BookSchema = new Schema({
  title: { type: String, required: true, trim: true, maxlength: 180 },
  isbn: { type: String, trim: true, set: value => (typeof value === 'string' && !value.trim() ? undefined : value) },
  authors: { type: [String], required: true, validate: v => v.length > 0 },
  category: { type: String, required: true, trim: true, maxlength: 60 },
  publicationYear: { type: Number, min: 1400, max: 2200, default: null },
  publisher: { type: PublisherSchema, default: () => ({}) },
  summary: { type: String, trim: true, maxlength: 3000, default: '' },
  shelf: { type: ShelfSchema, default: () => ({}) },
  copies: { type: [CopySchema], default: [] }
}, { timestamps: true, versionKey: false });

// Sparse unique ISBN index allows multiple records when ISBN is not supplied.
BookSchema.index({ isbn: 1 }, { unique: true, sparse: true });
BookSchema.index({ category: 1, publicationYear: -1 });
BookSchema.index({ 'shelf.section': 1, 'shelf.rack': 1 });
BookSchema.index({ title: 'text', authors: 'text', summary: 'text', 'publisher.name': 'text' });
BookSchema.index({ 'copies.copyCode': 1 });

BookSchema.virtual('availableCopies').get(function availableCopies() {
  return this.copies.filter(copy => copy.status === 'available').length;
});
BookSchema.virtual('totalCopies').get(function totalCopies() {
  return this.copies.length;
});
BookSchema.set('toJSON', { virtuals: true });
BookSchema.set('toObject', { virtuals: true });

export default model('Book', BookSchema);
