import mongoose, { Schema, type InferSchemaType } from "mongoose";
import { z } from "zod";
import type { Product } from "@/lib/store/types";

const productVariantSchema = new Schema(
  {
    id: { type: String, required: true },
    size: { type: String },
    color: { type: String },
    stock: { type: Number, required: true, min: 0, default: 0 },
    price: { type: Number, required: true, min: 0, default: 0 },
    sku: { type: String, required: true },
  },
  { _id: false }
);

const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, index: true, unique: true },
    sku: { type: String, required: true, trim: true, index: true, unique: true },
    description: { type: String, required: true, trim: true, default: "" },
    price: { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number, min: 0 },
    image: { type: String, required: true, trim: true },
    images: [{ type: String, required: true }],
    category: { type: String, required: true, trim: true },
    tags: [{ type: String, default: [] }],
    variants: { type: [productVariantSchema], default: [] },
    stock: { type: Number, required: true, min: 0, default: 0 },
    lowStockThreshold: { type: Number, required: true, min: 0, default: 10 },
    status: {
      type: String,
      enum: ["active", "draft", "hidden", "out_of_stock", "archived"],
      default: "active",
    },
    featured: { type: Boolean, default: false },
    isVisible: { type: Boolean, default: true },
    metaTitle: { type: String, trim: true },
    metaDescription: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    versionKey: false,
    minimize: false,
  }
);

productSchema.pre("validate", function (this: {
  image?: string;
  images?: string[];
  isVisible?: boolean;
}) {
  if (!this.image && Array.isArray(this.images) && this.images.length > 0) {
    this.image = this.images[0];
  }
  if ((!this.images || this.images.length === 0) && this.image) {
    this.images = [this.image];
  }
  if (typeof this.isVisible !== "boolean") {
    this.isVisible = true;
  }
});

export type ProductRecord = InferSchemaType<typeof productSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const productCreateSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  price: z.number().min(0),
  stock: z.number().int().min(0),
  category: z.string().min(1),
  image: z.string().min(1).optional(),
  images: z.array(z.string()).optional(),
  description: z.string().optional(),
  compareAtPrice: z.number().min(0).optional(),
  tags: z.array(z.string()).optional(),
  featured: z.boolean().optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  status: z.enum(["active", "draft", "hidden", "out_of_stock", "archived"]).optional(),
  isVisible: z.boolean().optional(),
  visible: z.boolean().optional(),
});

export const productUpdateSchema = productCreateSchema.partial().extend({
  slug: z.string().min(1).optional(),
  updatedAt: z.string().optional(),
});

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;

export type ProductApiRecord = Product & {
  image: string;
  isVisible: boolean;
  visible: boolean;
};

export function serializeProduct(product: ProductRecord | Record<string, unknown>): ProductApiRecord {
  const raw = product as Record<string, unknown> & {
    _id?: mongoose.Types.ObjectId | string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
  };
  const image = typeof raw.image === "string" && raw.image ? raw.image : Array.isArray(raw.images) && raw.images.length > 0 ? String(raw.images[0]) : "/images/all-img/p-1.png";
  const isVisible =
    typeof raw.isVisible === "boolean"
      ? raw.isVisible
      : typeof raw.visible === "boolean"
        ? raw.visible
        : true;

  return {
    id: raw._id ? String(raw._id) : String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    slug: String(raw.slug ?? ""),
    sku: String(raw.sku ?? ""),
    description: String(raw.description ?? ""),
    price: Number(raw.price ?? 0),
    compareAtPrice:
      raw.compareAtPrice === undefined || raw.compareAtPrice === null
        ? undefined
        : Number(raw.compareAtPrice),
    images: Array.isArray(raw.images) ? raw.images.map(String) : [image],
    image,
    category: String(raw.category ?? ""),
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    variants: Array.isArray(raw.variants)
      ? raw.variants.map((variant) => ({
          id: String((variant as Record<string, unknown>).id ?? ""),
          size: (variant as Record<string, unknown>).size as string | undefined,
          color: (variant as Record<string, unknown>).color as string | undefined,
          stock: Number((variant as Record<string, unknown>).stock ?? 0),
          price: Number((variant as Record<string, unknown>).price ?? 0),
          sku: String((variant as Record<string, unknown>).sku ?? ""),
        }))
      : [],
    stock: Number(raw.stock ?? 0),
    lowStockThreshold: Number(raw.lowStockThreshold ?? 10),
    status:
      raw.status === "draft" ||
      raw.status === "hidden" ||
      raw.status === "out_of_stock" ||
      raw.status === "archived" ||
      raw.status === "active"
        ? (raw.status as Product["status"])
        : "active",
    featured: Boolean(raw.featured),
    visible: isVisible,
    isVisible,
    metaTitle: raw.metaTitle ? String(raw.metaTitle) : undefined,
    metaDescription: raw.metaDescription ? String(raw.metaDescription) : undefined,
    createdAt: new Date(raw.createdAt ?? Date.now()).toISOString(),
    updatedAt: new Date(raw.updatedAt ?? raw.createdAt ?? Date.now()).toISOString(),
  };
}

export function toProductDocumentInput(input: ProductApiRecord) {
  return {
    name: input.name,
    slug: input.slug,
    sku: input.sku,
    description: input.description,
    price: input.price,
    compareAtPrice: input.compareAtPrice,
    image: input.image || input.images?.[0] || "/images/all-img/p-1.png",
    images: input.images.length > 0 ? input.images : [input.image],
    category: input.category,
    tags: input.tags,
    variants: input.variants,
    stock: input.stock,
    lowStockThreshold: input.lowStockThreshold,
    status: input.status,
    featured: input.featured,
    isVisible: input.visible,
    metaTitle: input.metaTitle,
    metaDescription: input.metaDescription,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

export const ProductModel =
  (mongoose.models.Product as mongoose.Model<ProductRecord>) ||
  mongoose.model<ProductRecord>("Product", productSchema);
