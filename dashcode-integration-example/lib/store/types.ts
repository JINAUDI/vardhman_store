// ============================================================
// E-Commerce Store Types
// ============================================================

// ---- Product ----
export type ProductVariant = {
  id: string;
  size?: string;
  color?: string;
  stock: number;
  price: number;
  sku: string;
};

export type Product = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  images: string[];
  category: string;
  tags: string[];
  variants: ProductVariant[];
  stock: number;
  reservedStock?: number;
  availableStock?: number;
  lowStockThreshold: number;
  trackInventory?: boolean;
  allowBackorder?: boolean;
  inventoryStatus?: "in_stock" | "low_stock" | "out_of_stock" | "not_tracked";
  status: "active" | "draft" | "hidden" | "out_of_stock" | "archived";
  featured: boolean;
  visible?: boolean;
  isVisible?: boolean;
  metaTitle?: string;
  metaDescription?: string;
  createdAt: string;
  updatedAt: string;
};

// ---- Order ----
export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "packed"
  | "shipped"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "refunded"
  | "returned";

export type PaymentStatus = "pending" | "paid" | "unpaid" | "failed" | "refunded" | "cod_pending";

export type PaymentMethod = "cod" | "upi" | "card";

export type ShippingStatus =
  | "not_shipped"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "returned";

export type FulfillmentStatus =
  | "unfulfilled"
  | "partially_fulfilled"
  | "fulfilled"
  | "returned";

export type RefundStatus = "none" | "requested" | "processing" | "refunded" | "rejected";

export type OrderTimelineEvent = {
  id: string;
  status: OrderStatus;
  statusType?: "order" | "payment" | "delivery" | "refund" | string;
  timestamp: string;
  note?: string;
  createdBy?: string;
};

export type OrderItem = {
  productId: string;
  productName: string;
  productImage: string;
  variantLabel?: string;
  quantity: number;
  price: number;
  total: number;
};

export type Order = {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  customerAvatar: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  shippingCost: number;
  discount: number;
  total: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  deliveryMethod?: string;
  shippingStatus: ShippingStatus;
  fulfillmentStatus?: FulfillmentStatus;
  refundStatus?: RefundStatus;
  trackingId?: string;
  courier?: string;
  courierName?: string;
  courierTrackingNumber?: string;
  estimatedDelivery?: string;
  shippedAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  refundedAt?: string;
  cancellationReason?: string;
  refundReason?: string;
  adminNotes?: string;
  invoiceNumber?: string;
  invoiceUrl?: string;
  shippingAddress: Address;
  billingAddress: Address;
  timeline: OrderTimelineEvent[];
  notes?: string;
  couponCode?: string;
  createdAt: string;
  updatedAt: string;
};

// ---- Customer ----
export type Address = {
  id: string;
  label: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  isDefault: boolean;
};

export type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  addresses: Address[];
  totalSpend: number;
  totalOrders: number;
  totalReturns: number;
  status: "active" | "inactive" | "blocked";
  joinedAt: string;
  lastOrderAt?: string;
};

// ---- Abandoned Cart ----
export type AbandonedCartStatus = "open" | "converted" | "emptied";

export type AbandonedCartItem = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
};

export type AbandonedCart = {
  id: string;
  sessionId: string;
  authUserId?: string;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  items: AbandonedCartItem[];
  itemCount: number;
  subtotal: number;
  discount: number;
  total: number;
  currency: string;
  status: AbandonedCartStatus;
  sourcePage?: string;
  checkoutStartedAt?: string;
  lastActivityAt: string;
  convertedOrderId?: string;
  convertedAt?: string;
  createdAt: string;
  updatedAt: string;
};

// ---- Inventory ----
export type InventoryItem = {
  productId: string;
  productName: string;
  sku: string;
  currentStock: number;
  lowStockThreshold: number;
  status: "in_stock" | "low_stock" | "out_of_stock";
  lastRestocked?: string;
};

// ---- Coupon ----
export type CouponType = "percentage" | "flat";

export type DiscountCategory =
  | "product_discount"
  | "order_discount"
  | "buy_x_get_y"
  | "free_shipping";

export type DiscountMethod = "code" | "automatic";
export type DiscountValueMode = "percentage" | "fixed_amount" | "free";
export type DiscountTargetScope =
  | "all_products"
  | "specific_products"
  | "specific_collections"
  | "specific_categories";
export type DiscountRequirementType =
  | "none"
  | "minimum_purchase_amount"
  | "minimum_quantity";
export type DiscountEligibility =
  | "all_customers"
  | "specific_customers"
  | "specific_segments";

export type Coupon = {
  id: string;
  title?: string;
  code: string;
  method?: DiscountMethod;
  type: CouponType;
  valueType?: DiscountValueMode;
  discountCategory: DiscountCategory;
  value: number;
  targetScope?: DiscountTargetScope;
  targetProductIds?: string[];
  targetCollectionIds?: string[];
  targetCategorySlugs?: string[];
  minOrderAmount: number;
  minQuantity?: number;
  requirementType?: DiscountRequirementType;
  maxDiscount?: number;
  usageLimit: number;
  usedCount: number;
  oncePerCustomer?: boolean;
  expiresAt: string;
  startsAt?: string;
  endsAt?: string;
  status: "active" | "expired" | "disabled";
  eligibility?: DiscountEligibility;
  eligibleCustomerIds?: string[];
  eligibleCustomerSegments?: string[];
  appliesTo: "all" | "specific_products" | "specific_collections";
  selectedProductIds?: string[];
  buyQuantity?: number;
  getQuantity?: number;
  buyTargetScope?: DiscountTargetScope;
  buyProductIds?: string[];
  buyCollectionIds?: string[];
  buyCategorySlugs?: string[];
  getTargetScope?: DiscountTargetScope;
  getProductIds?: string[];
  getCollectionIds?: string[];
  getCategorySlugs?: string[];
  maximumUsesPerOrder?: number;
  combinesWithProductDiscounts?: boolean;
  combinesWithOrderDiscounts?: boolean;
  combinesWithShippingDiscounts?: boolean;
  salesChannels?: string[];
  tags?: string[];
  regions?: string[];
  autoGenerated?: boolean;
  createdAt: string;
  updatedAt?: string;
};

// ---- Product Draft (Wizard State) ----
export type ProductDraftStep =
  | "media"
  | "category"
  | "details"
  | "variations"
  | "pricing"
  | "shipping"
  | "review";

export type ProductVariantDraft = {
  id: string;
  size?: string;
  color?: string;
  stock: number;
  price: number;
  sku: string;
};

export type ProductDraft = {
  // Step 1: Media
  images: string[];
  videoUrl?: string;

  // Step 2: Category
  category: string;
  subcategory?: string;

  // Step 3: Details
  name: string;
  description: string;
  tags: string[];
  attributes: Record<string, string>;

  // Step 4: Variations
  variants: ProductVariantDraft[];
  hasPersonalization: boolean;
  personalizationInstructions?: string;

  // Step 5: Pricing
  price: number;
  compareAtPrice?: number;
  costPerItem?: number;
  sku: string;
  barcode?: string;
  quantity: number;
  lowStockThreshold: number;
  regionalPricing?: {
    india?: number;
  };

  // Step 6: Shipping
  processingTime: string;
  freeShipping: boolean;
  flatRateShipping?: number;
  standardShipping?: number;
  expressShipping?: number;
  returnPolicy: "30_days" | "14_days" | "no_returns" | "custom";
  customReturnPolicy?: string;

  // Meta
  status: "draft" | "published";
  featured: boolean;
  metaTitle?: string;
  metaDescription?: string;
  createdAt: string;
  updatedAt: string;
};

// ---- Banner ----
export type Banner = {
  id: string;
  title: string;
  image: string;
  link: string;
  order: number;
  active: boolean;
  createdAt: string;
};

// ---- Category ----
export type Category = {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
};

// ---- Homepage Banner ----
export type HomepageBanner = {
  id: string;
  title: string;
  subtitle?: string;
  buttonText: string;
  buttonLink?: string;
  imageUrl: string;
  categoryId?: string;
  sectionKey: string;
  bannerType: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
};

// ---- Collection ----
export type CollectionRuleField =
  | "title"
  | "category"
  | "tag"
  | "price"
  | "stock"
  | "sku";

export type CollectionRuleOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "greater_than"
  | "less_than";

export type CollectionCondition = {
  id: string;
  field: CollectionRuleField;
  operator: CollectionRuleOperator;
  value: string;
};

export type CollectionSort =
  | "manual"
  | "best_selling"
  | "alpha_asc"
  | "alpha_desc"
  | "price_asc"
  | "price_desc"
  | "created_desc";

export type Collection = {
  id: string;
  title: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  collectionType: "manual" | "smart";
  isActive: boolean;
  salesChannels: string[];
  themeTemplate: string;
  sortOrder: number;
  sortType: CollectionSort;
  conditionsMatch: "all" | "any";
  conditions: CollectionCondition[];
  productIds: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

// ---- Return ----
export type ReturnStatus =
  | "requested"
  | "approved"
  | "rejected"
  | "received"
  | "refunded";

export type ReturnRequest = {
  id: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  reason: string;
  items: OrderItem[];
  refundAmount: number;
  status: ReturnStatus;
  createdAt: string;
  updatedAt: string;
};

// ---- Notification ----
export type NotificationType = "order" | "stock" | "return" | "system" | "message";

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  avatar?: string;
  link?: string;
  read: boolean;
  createdAt: string;
};

// ---- Analytics ----
export type TimeFilter = "daily" | "weekly" | "monthly";

export type DateRangePreset =
  | "today"
  | "last_7_days"
  | "last_30_days"
  | "this_month"
  | "custom";

export type DateRange = {
  from: Date | null;
  to: Date | null;
  preset: DateRangePreset;
};

// ---- Roles ----
export type UserRole = "admin" | "manager" | "support";

export type RolePermissions = {
  role: UserRole;
  modules: {
    dashboard: boolean;
    orders: boolean;
    products: boolean;
    customers: boolean;
    inventory: boolean;
    marketing: boolean;
    analytics: boolean;
    returns: boolean;
    settings: boolean;
  };
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: UserRole;
};

// ---- Activity Log ----
export type ActivityLog = {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entity: string;
  entityId: string;
  timestamp: string;
  details?: string;
};
