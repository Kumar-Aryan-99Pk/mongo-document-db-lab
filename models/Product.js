import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const VariantSchema = new Schema({
  sku: { type: String, trim: true, uppercase: true },
  color: { type: String, trim: true },
  size: { type: String, trim: true },
  stock: { type: Number, min: 0, default: 0 }
}, { _id: true });

const ReviewSchema = new Schema({
  reviewer: { type: String, trim: true, required: true, maxlength: 80 },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String, trim: true, maxlength: 500, default: '' },
  createdAt: { type: Date, default: Date.now }
}, { _id: true });

const DimensionsSchema = new Schema({
  weightGrams: { type: Number, min: 0, default: 0 },
  lengthCm: { type: Number, min: 0, default: 0 },
  widthCm: { type: Number, min: 0, default: 0 },
  heightCm: { type: Number, min: 0, default: 0 }
}, { _id: false });

const ProductSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 2000, default: '' },
  brand: { type: String, trim: true, maxlength: 80, default: 'Independent' },
  category: { type: String, required: true, trim: true, maxlength: 60 },
  price: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['active', 'draft'], default: 'active' },
  tags: { type: [String], default: [] },
  variants: { type: [VariantSchema], default: [] },
  dimensions: { type: DimensionsSchema, default: () => ({}) },
  reviews: { type: [ReviewSchema], default: [] }
}, { timestamps: true, versionKey: false });

// Compound and text indexes support the catalog's main filter and search paths.
ProductSchema.index({ category: 1, price: 1 });
ProductSchema.index({ status: 1, createdAt: -1 });
ProductSchema.index({ name: 'text', description: 'text', brand: 'text', tags: 'text' });
ProductSchema.index({ 'variants.sku': 1 });

ProductSchema.virtual('totalStock').get(function totalStock() {
  return this.variants.reduce((sum, variant) => sum + (variant.stock || 0), 0);
});
ProductSchema.set('toJSON', { virtuals: true });
ProductSchema.set('toObject', { virtuals: true });

export default model('Product', ProductSchema);
