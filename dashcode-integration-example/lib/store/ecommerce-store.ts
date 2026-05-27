// ============================================================
// E-Commerce Data Store — Jotai Atoms with Seed Data
// ============================================================
import { atom } from "jotai";
import { atomWithStorage, createJSONStorage } from "jotai/utils";
import { formatINR } from "@/lib/utils/currency";
import type {
  Product,
  Order,
  Customer,
  Coupon,
  Banner,
  ReturnRequest,
  AppNotification,
  InventoryItem,
  DateRange,
  AuthUser,
  RolePermissions,
  ActivityLog,
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  ShippingStatus,
  OrderItem,
  OrderTimelineEvent,
  Address,
  ProductDraft,
} from "./types";

// ============================================================
// HELPER — ID Generator
// ============================================================
let _counter = 0;
export function generateId(prefix = "id"): string {
  _counter++;
  return `${prefix}_${Date.now()}_${_counter}_${Math.random().toString(36).slice(2, 7)}`;
}

// ============================================================
// SEED DATA — Products
// ============================================================
const productImages = [
  "/images/all-img/p-1.png",
  "/images/all-img/p-2.png",
  "/images/all-img/p-3.png",
  "/images/all-img/p-4.png",
  "/images/all-img/p-5.png",
  "/images/all-img/p-6.png",
];

const categories = [
  "Electronics",
  "Clothing",
  "Home & Garden",
  "Sports",
  "Books",
  "Accessories",
  "Health & Beauty",
  "Toys",
];

const colors = ["Black", "White", "Red", "Blue", "Green", "Navy", "Gray", "Brown"];
const sizes = ["XS", "S", "M", "L", "XL", "XXL"];

const productNames = [
  "Wireless Bluetooth Headphones",
  "Premium Leather Wallet",
  "Organic Cotton T-Shirt",
  "Smart Fitness Watch",
  "Ceramic Coffee Mug Set",
  "Running Shoes Pro",
  "Stainless Steel Water Bottle",
  "Noise Cancelling Earbuds",
  "Canvas Laptop Backpack",
  "Bamboo Cutting Board",
  "LED Desk Lamp",
  "Yoga Mat Premium",
  "Portable Charger 20000mAh",
  "Sunglasses UV400",
  "Linen Throw Pillow",
  "Digital Kitchen Scale",
  "Insulated Travel Tumbler",
  "Wireless Mouse Ergonomic",
  "Essential Oil Diffuser",
  "Resistance Band Set",
  "Mechanical Keyboard RGB",
  "Silk Sleep Mask",
  "Cast Iron Skillet",
  "Phone Stand Adjustable",
  "USB-C Hub 7-in-1",
  "Cotton Bed Sheet Set",
  "Aromatherapy Candle Set",
  "Action Camera 4K",
  "Garden Tool Set",
  "Bluetooth Speaker Mini",
  "Wool Blend Scarf",
  "Stainless Steel Thermos",
  "Laptop Stand Aluminum",
  "Air Purifier HEPA",
  "Crossbody Bag Leather",
  "Smart LED Bulb Pack",
  "Weighted Jump Rope",
  "Acacia Wood Serving Board",
  "Foldable Phone Gimbal",
  "Memory Foam Pillow",
  "Electric Toothbrush",
  "Vintage Record Player",
  "Travel Neck Pillow",
  "Solar Power Bank",
  "Dumbbell Set Adjustable",
  "Glass Food Container Set",
  "Noise Machine Sleep",
  "Cork Yoga Block",
  "Mini Projector HD",
  "Waterproof Dry Bag",
];

function seedProducts(): Product[] {
  return productNames.map((name, i) => {
    const cat = categories[i % categories.length];
    const price = Math.round((19.99 + Math.random() * 280) * 100) / 100;
    const stock = Math.floor(Math.random() * 200);
    const threshold = 10 + Math.floor(Math.random() * 15);
    const hasVariants = i % 3 === 0;
    const img = productImages[i % productImages.length];

    return {
      id: `prod_${(i + 1).toString().padStart(3, "0")}`,
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      sku: `SKU-${cat.slice(0, 3).toUpperCase()}-${(i + 1).toString().padStart(4, "0")}`,
      description: `High-quality ${name.toLowerCase()} perfect for everyday use. Made with premium materials and designed for comfort and durability.`,
      price,
      compareAtPrice: Math.random() > 0.5 ? Math.round(price * 1.3 * 100) / 100 : undefined,
      images: [img, productImages[(i + 1) % productImages.length], productImages[(i + 2) % productImages.length]],
      category: cat,
      tags: [cat.toLowerCase(), "bestseller", i % 5 === 0 ? "sale" : "new"].filter(Boolean),
      variants: hasVariants
        ? [
            {
              id: `var_${i}_1`,
              size: sizes[i % sizes.length],
              color: colors[i % colors.length],
              stock: Math.floor(stock / 3),
              price,
              sku: `SKU-${cat.slice(0, 3).toUpperCase()}-${(i + 1).toString().padStart(4, "0")}-V1`,
            },
            {
              id: `var_${i}_2`,
              size: sizes[(i + 1) % sizes.length],
              color: colors[(i + 1) % colors.length],
              stock: Math.floor(stock / 3),
              price: Math.round(price * 1.1 * 100) / 100,
              sku: `SKU-${cat.slice(0, 3).toUpperCase()}-${(i + 1).toString().padStart(4, "0")}-V2`,
            },
          ]
        : [],
      stock,
      lowStockThreshold: threshold,
      status: stock === 0 ? "out_of_stock" : "active",
      featured: i < 8,
      visible: stock > 0,
      isVisible: stock > 0,
      metaTitle: name,
      metaDescription: `Buy ${name.toLowerCase()} online at the best price.`,
      createdAt: new Date(Date.now() - Math.random() * 90 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - Math.random() * 30 * 86400000).toISOString(),
    };
  });
}

// ============================================================
// SEED DATA — Customers
// ============================================================
const customerData = [
  { name: "Esther Howard", email: "esther@example.com", avatar: "/images/users/user-1.jpg" },
  { name: "Guy Hawkins", email: "guy@example.com", avatar: "/images/users/user-2.jpg" },
  { name: "Bessie Cooper", email: "bessie@example.com", avatar: "/images/users/user-3.jpg" },
  { name: "Kathryn Murphy", email: "kathryn@example.com", avatar: "/images/users/user-4.jpg" },
  { name: "Darrell Steward", email: "darrell@example.com", avatar: "/images/users/user-5.jpg" },
  { name: "Brooklyn Simmons", email: "brooklyn@example.com", avatar: "/images/users/user-6.jpg" },
  { name: "Wade Warren", email: "wade@example.com", avatar: "/images/users/user-1.jpg" },
  { name: "Savannah Nguyen", email: "savannah@example.com", avatar: "/images/users/user-2.jpg" },
  { name: "Ralph Edwards", email: "ralph@example.com", avatar: "/images/users/user-3.jpg" },
  { name: "Cody Fisher", email: "cody@example.com", avatar: "/images/users/user-4.jpg" },
  { name: "Jenny Wilson", email: "jenny@example.com", avatar: "/images/users/user-5.jpg" },
  { name: "Ronald Richards", email: "ronald@example.com", avatar: "/images/users/user-6.jpg" },
  { name: "Jane Cooper", email: "jane@example.com", avatar: "/images/users/user-1.jpg" },
  { name: "Floyd Miles", email: "floyd@example.com", avatar: "/images/users/user-2.jpg" },
  { name: "Devon Lane", email: "devon@example.com", avatar: "/images/users/user-3.jpg" },
  { name: "Courtney Henry", email: "courtney@example.com", avatar: "/images/users/user-4.jpg" },
  { name: "Albert Flores", email: "albert@example.com", avatar: "/images/users/user-5.jpg" },
  { name: "Arlene McCoy", email: "arlene@example.com", avatar: "/images/users/user-6.jpg" },
  { name: "Cameron Wilkins", email: "cameron@example.com", avatar: "/images/users/user-1.jpg" },
  { name: "Kristin Watson", email: "kristin@example.com", avatar: "/images/users/user-2.jpg" },
  { name: "Dianne Russell", email: "dianne@example.com", avatar: "/images/users/user-3.jpg" },
  { name: "Leslie Alexander", email: "leslie@example.com", avatar: "/images/users/user-4.jpg" },
  { name: "Jacob Jones", email: "jacob@example.com", avatar: "/images/users/user-5.jpg" },
  { name: "Theresa Webb", email: "theresa@example.com", avatar: "/images/users/user-6.jpg" },
  { name: "Robert Fox", email: "robert@example.com", avatar: "/images/users/user-1.jpg" },
  { name: "Annette Black", email: "annette@example.com", avatar: "/images/users/user-2.jpg" },
  { name: "Marvin McKinney", email: "marvin@example.com", avatar: "/images/users/user-3.jpg" },
  { name: "Eleanor Pena", email: "eleanor@example.com", avatar: "/images/users/user-4.jpg" },
  { name: "Darlene Robertson", email: "darlene@example.com", avatar: "/images/users/user-5.jpg" },
  { name: "Jerome Bell", email: "jerome@example.com", avatar: "/images/users/user-6.jpg" },
];

const cities = ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "San Diego", "Dallas", "San Jose"];
const states = ["NY", "CA", "IL", "TX", "AZ", "CA", "TX", "CA"];
const streets = [
  "123 Main St", "456 Oak Ave", "789 Pine Rd", "321 Elm Blvd", "654 Maple Dr",
  "987 Cedar Ln", "147 Birch Way", "258 Walnut Ct",
];

function seedCustomers(): Customer[] {
  return customerData.map((c, i) => ({
    id: `cust_${(i + 1).toString().padStart(3, "0")}`,
    name: c.name,
    email: c.email,
    phone: `+1 (${200 + i}) ${300 + i}-${4000 + i}`,
    avatar: c.avatar,
    addresses: [
      {
        id: `addr_${i}_1`,
        label: "Home",
        street: streets[i % streets.length],
        city: cities[i % cities.length],
        state: states[i % states.length],
        zipCode: `${10000 + i * 111}`,
        country: "United States",
        isDefault: true,
      },
    ],
    totalSpend: Math.round(Math.random() * 5000 * 100) / 100,
    totalOrders: Math.floor(Math.random() * 25) + 1,
    totalReturns: Math.floor(Math.random() * 3),
    status: i % 10 === 9 ? "inactive" : "active",
    joinedAt: new Date(Date.now() - Math.random() * 365 * 86400000).toISOString(),
    lastOrderAt: new Date(Date.now() - Math.random() * 30 * 86400000).toISOString(),
  }));
}

// ============================================================
// SEED DATA — Orders
// ============================================================
const orderStatuses: OrderStatus[] = [
  "pending", "confirmed", "packed", "shipped", "delivered", "cancelled",
];
const paymentStatuses: PaymentStatus[] = ["paid", "unpaid", "failed"];
const paymentMethods: PaymentMethod[] = ["cod", "upi", "card"];

function seedOrders(products: Product[], customers: Customer[]): Order[] {
  const orders: Order[] = [];

  for (let i = 0; i < 100; i++) {
    const customer = customers[i % customers.length];
    const numItems = 1 + Math.floor(Math.random() * 4);
    const items: OrderItem[] = [];
    let subtotal = 0;

    for (let j = 0; j < numItems; j++) {
      const product = products[(i * 3 + j) % products.length];
      const qty = 1 + Math.floor(Math.random() * 3);
      const itemTotal = Math.round(product.price * qty * 100) / 100;
      subtotal += itemTotal;
      items.push({
        productId: product.id,
        productName: product.name,
        productImage: product.images[0],
        variantLabel: product.variants.length > 0 ? `${product.variants[0].size} / ${product.variants[0].color}` : undefined,
        quantity: qty,
        price: product.price,
        total: itemTotal,
      });
    }

    const tax = Math.round(subtotal * 0.08 * 100) / 100;
    const shippingCost = subtotal > 100 ? 0 : 9.99;
    const discount = i % 5 === 0 ? Math.round(subtotal * 0.1 * 100) / 100 : 0;
    const total = Math.round((subtotal + tax + shippingCost - discount) * 100) / 100;
    const status = orderStatuses[i % orderStatuses.length];
    const createdAt = new Date(Date.now() - Math.random() * 60 * 86400000).toISOString();

    const timeline: OrderTimelineEvent[] = [
      {
        id: `evt_${i}_1`,
        status: "pending",
        timestamp: createdAt,
        note: "Order placed by customer",
      },
    ];

    const statusIndex = orderStatuses.indexOf(status);
    if (statusIndex >= 1) {
      timeline.push({
        id: `evt_${i}_2`,
        status: "confirmed",
        timestamp: new Date(new Date(createdAt).getTime() + 3600000).toISOString(),
        note: "Order confirmed by admin",
      });
    }
    if (statusIndex >= 2) {
      timeline.push({
        id: `evt_${i}_3`,
        status: "packed",
        timestamp: new Date(new Date(createdAt).getTime() + 86400000).toISOString(),
        note: "Order packed and ready to ship",
      });
    }
    if (statusIndex >= 3) {
      timeline.push({
        id: `evt_${i}_4`,
        status: "shipped",
        timestamp: new Date(new Date(createdAt).getTime() + 172800000).toISOString(),
        note: "Order shipped via courier",
      });
    }
    if (statusIndex >= 4) {
      timeline.push({
        id: `evt_${i}_5`,
        status: "delivered",
        timestamp: new Date(new Date(createdAt).getTime() + 432000000).toISOString(),
        note: "Order delivered successfully",
      });
    }
    if (status === "cancelled") {
      timeline.push({
        id: `evt_${i}_cancel`,
        status: "cancelled",
        timestamp: new Date(new Date(createdAt).getTime() + 7200000).toISOString(),
        note: "Order cancelled by customer",
      });
    }

    const pStatus: PaymentStatus =
      status === "delivered" ? "paid" :
        status === "cancelled" ? "refunded" :
          paymentStatuses[i % paymentStatuses.length];

    const shippingStatus: ShippingStatus =
      status === "delivered" ? "delivered" :
        status === "shipped" ? "in_transit" :
          status === "cancelled" ? "returned" :
            "not_shipped";

    orders.push({
      id: `ord_${(i + 1).toString().padStart(3, "0")}`,
      orderNumber: `#ORD-${(10001 + i).toString()}`,
      customerId: customer.id,
      customerName: customer.name,
      customerEmail: customer.email,
      customerAvatar: customer.avatar,
      items,
      subtotal,
      tax,
      shippingCost,
      discount,
      total,
      status,
      paymentStatus: pStatus,
      paymentMethod: paymentMethods[i % paymentMethods.length],
      shippingStatus,
      trackingId: status === "shipped" || status === "delivered" ? `TRK${100000 + i}` : undefined,
      courier: status === "shipped" || status === "delivered" ? ["FedEx", "UPS", "DHL", "USPS"][i % 4] : undefined,
      estimatedDelivery: status === "shipped"
        ? new Date(Date.now() + (3 + Math.floor(Math.random() * 5)) * 86400000).toISOString()
        : undefined,
      shippingAddress: customer.addresses[0],
      billingAddress: customer.addresses[0],
      timeline,
      notes: i % 7 === 0 ? "Customer requested gift wrapping" : undefined,
      couponCode: i % 5 === 0 ? "SAVE10" : undefined,
      createdAt,
      updatedAt: timeline[timeline.length - 1].timestamp,
    });
  }

  return orders;
}

// ============================================================
// SEED DATA — Coupons
// ============================================================
function seedCoupons(): Coupon[] {
  return [
    {
      id: "coup_001",
      code: "SAVE10",
      type: "percentage",
      discountCategory: "product_discount",
      value: 10,
      minOrderAmount: 50,
      maxDiscount: 25,
      usageLimit: 100,
      usedCount: 34,
      expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
      status: "active",
      appliesTo: "all",
      createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    },
    {
      id: "coup_002",
      code: "FLAT20",
      type: "flat",
      discountCategory: "order_discount",
      value: 20,
      minOrderAmount: 100,
      usageLimit: 50,
      usedCount: 12,
      expiresAt: new Date(Date.now() + 15 * 86400000).toISOString(),
      status: "active",
      appliesTo: "all",
      createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    },
    {
      id: "coup_003",
      code: "WELCOME15",
      type: "percentage",
      discountCategory: "product_discount",
      value: 15,
      minOrderAmount: 0,
      maxDiscount: 30,
      usageLimit: 500,
      usedCount: 210,
      expiresAt: new Date(Date.now() + 60 * 86400000).toISOString(),
      status: "active",
      appliesTo: "all",
      createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    },
    {
      id: "coup_004",
      code: "SUMMER25",
      type: "percentage",
      discountCategory: "order_discount",
      value: 25,
      minOrderAmount: 200,
      maxDiscount: 100,
      usageLimit: 200,
      usedCount: 200,
      expiresAt: new Date(Date.now() - 5 * 86400000).toISOString(),
      status: "expired",
      appliesTo: "all",
      createdAt: new Date(Date.now() - 45 * 86400000).toISOString(),
    },
    {
      id: "coup_005",
      code: "FREESHIP",
      type: "flat",
      discountCategory: "free_shipping",
      value: 9.99,
      minOrderAmount: 75,
      usageLimit: 1000,
      usedCount: 567,
      expiresAt: new Date(Date.now() + 90 * 86400000).toISOString(),
      status: "active",
      appliesTo: "all",
      createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
    },
    {
      id: "coup_006",
      code: "BUY2GET1",
      type: "percentage",
      discountCategory: "buy_x_get_y",
      value: 100,
      minOrderAmount: 0,
      usageLimit: 300,
      usedCount: 89,
      expiresAt: new Date(Date.now() + 45 * 86400000).toISOString(),
      status: "active",
      appliesTo: "specific_products",
      buyQuantity: 2,
      getQuantity: 1,
      createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
    },
  ];
}

// ============================================================
// SEED DATA — Notifications
// ============================================================
function seedNotifications(orders: Order[], products: Product[]): AppNotification[] {
  const notifications: AppNotification[] = [];
  const pendingOrders = orders.filter((o) => o.status === "pending");
  const lowStockProducts = products.filter((p) => p.stock <= p.lowStockThreshold && p.stock > 0);

  pendingOrders.slice(0, 5).forEach((o, i) => {
    notifications.push({
      id: `notif_order_${i}`,
      type: "order",
      title: `New Order ${o.orderNumber}`,
      description: `${o.customerName} placed an order for ${formatINR(o.total, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      avatar: o.customerAvatar,
      link: `/ecommerce/backend/order-details?id=${o.id}`,
      read: i > 2,
      createdAt: o.createdAt,
    });
  });

  lowStockProducts.slice(0, 3).forEach((p, i) => {
    notifications.push({
      id: `notif_stock_${i}`,
      type: "stock",
      title: `Low Stock Alert: ${p.name}`,
      description: `Only ${p.stock} units remaining (threshold: ${p.lowStockThreshold})`,
      link: `/ecommerce/backend/inventory`,
      read: false,
      createdAt: new Date(Date.now() - i * 3600000).toISOString(),
    });
  });

  notifications.push({
    id: "notif_return_1",
    type: "return",
    title: "New Return Request",
    description: "Esther Howard requested a return for Order #ORD-10001",
    avatar: "/images/users/user-1.jpg",
    link: "/ecommerce/backend/returns",
    read: false,
    createdAt: new Date(Date.now() - 7200000).toISOString(),
  });

  notifications.push({
    id: "notif_system_1",
    type: "system",
    title: "System Update",
    description: "Admin panel has been upgraded with new features",
    read: true,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  });

  return notifications.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

// ============================================================
// SEED DATA — Returns
// ============================================================
function seedReturns(orders: Order[]): ReturnRequest[] {
  const deliveredOrders = orders.filter((o) => o.status === "delivered");
  const returnStatuses: ReturnRequest["status"][] = [
    "requested", "approved", "rejected", "received", "refunded",
  ];
  const reasons = [
    "Product damaged during shipping",
    "Wrong item received",
    "Item not as described",
    "Changed my mind",
    "Size doesn't fit",
    "Quality not satisfactory",
  ];

  return deliveredOrders.slice(0, 8).map((o, i) => ({
    id: `ret_${(i + 1).toString().padStart(3, "0")}`,
    orderId: o.id,
    orderNumber: o.orderNumber,
    customerId: o.customerId,
    customerName: o.customerName,
    reason: reasons[i % reasons.length],
    items: o.items.slice(0, 1),
    refundAmount: o.items[0].total,
    status: returnStatuses[i % returnStatuses.length],
    createdAt: new Date(Date.now() - Math.random() * 20 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - Math.random() * 10 * 86400000).toISOString(),
  }));
}

// ============================================================
// SEED DATA — Banners
// ============================================================
function seedBanners(): Banner[] {
  return [
    {
      id: "banner_001",
      title: "Summer Sale - Up to 50% Off",
      image: "/images/all-img/widget-bg-2.png",
      link: "/ecommerce/frontend",
      order: 1,
      active: true,
      createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    },
    {
      id: "banner_002",
      title: "New Arrivals Collection",
      image: "/images/all-img/widget-bg-2.png",
      link: "/ecommerce/frontend",
      order: 2,
      active: true,
      createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    },
    {
      id: "banner_003",
      title: `Free Shipping on Orders ${formatINR(100)}+`,
      image: "/images/all-img/widget-bg-2.png",
      link: "/ecommerce/frontend",
      order: 3,
      active: false,
      createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
    },
  ];
}

// ============================================================
// INITIALIZE ALL SEED DATA
// ============================================================
const seedProductsData = seedProducts();
const seedCustomersData = seedCustomers();
const seedOrdersData = seedOrders(seedProductsData, seedCustomersData);
const seedNotificationsData = seedNotifications(seedOrdersData, seedProductsData);
const seedReturnsData = seedReturns(seedOrdersData);
const seedCouponsData = seedCoupons();
const seedBannersData = seedBanners();

export const mockSeedDataForDev = {
  products: seedProductsData,
  customers: seedCustomersData,
  orders: seedOrdersData,
  notifications: seedNotificationsData,
  returns: seedReturnsData,
  coupons: seedCouponsData,
  banners: seedBannersData,
};

// ============================================================
// JOTAI ATOMS
// ============================================================
function createSafeLocalStorage<Value>() {
  return createJSONStorage<Value>(() => ({
    getItem: (key) => {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem: (key, value) => {
      try {
        window.localStorage.setItem(key, value);
      } catch (error) {
        console.warn(`[dashcode-store] Unable to persist ${key}.`, error);
        try {
          window.localStorage.removeItem(key);
        } catch {
          // Ignore cleanup failures. The in-memory atom state still remains valid.
        }
      }
    },
    removeItem: (key) => {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Ignore storage cleanup failures.
      }
    },
  }));
}

// API-backed collections stay in memory only. Persisting live Supabase data can
// exceed browser storage when products include uploaded/base64 images.
export const productsAtom = atom<Product[]>([]);
export const ordersAtom = atom<Order[]>([]);
export const customersAtom = atom<Customer[]>([]);
export const couponsAtom = atom<Coupon[]>([]);
export const bannersAtom = atom<Banner[]>([]);
export const returnsAtom = atom<ReturnRequest[]>([]);
export const notificationsAtom = atom<AppNotification[]>([]);
export const activityLogsAtom = atom<ActivityLog[]>([]);

// ============================================================
// PRODUCT DRAFT ATOMS — For multi-step wizard
// ============================================================
const emptyDraft: ProductDraft = {
  images: [],
  category: "",
  name: "",
  description: "",
  tags: [],
  attributes: {},
  variants: [],
  hasPersonalization: false,
  price: 0,
  sku: "",
  quantity: 0,
  lowStockThreshold: 10,
  processingTime: "1-3 business days",
  freeShipping: false,
  returnPolicy: "30_days",
  status: "draft",
  featured: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const productDraftAtom = atomWithStorage<ProductDraft>(
  "ecom_product_draft",
  emptyDraft,
  createSafeLocalStorage<ProductDraft>()
);

export const productDraftStepAtom = atomWithStorage<number>(
  "ecom_product_draft_step",
  0,
  createSafeLocalStorage<number>()
);

export { emptyDraft };

// ============================================================
// DERIVED ATOMS — Computed Values
// ============================================================
export const pendingOrdersCountAtom = atom((get) => {
  const orders = get(ordersAtom);
  return orders.filter((o) => o.status === "pending").length;
});

export const lowStockCountAtom = atom((get) => {
  const products = get(productsAtom);
  return products.filter((p) => p.trackInventory !== false && p.stock <= p.lowStockThreshold).length;
});

export const outOfStockCountAtom = atom((get) => {
  const products = get(productsAtom);
  return products.filter((p) => p.stock === 0).length;
});

export const unreadNotificationsCountAtom = atom((get) => {
  const notifications = get(notificationsAtom);
  return notifications.filter((n) => !n.read).length;
});

export const pendingReturnsCountAtom = atom((get) => {
  const returns = get(returnsAtom);
  return returns.filter((r) => r.status === "requested").length;
});

export const totalRevenueAtom = atom((get) => {
  const orders = get(ordersAtom);
  return orders
    .filter((o) => o.paymentStatus === "paid")
    .reduce((sum, o) => sum + o.total, 0);
});

export const totalCustomersAtom = atom((get) => {
  const customers = get(customersAtom);
  return customers.length;
});

export const inventoryItemsAtom = atom((get): InventoryItem[] => {
  const products = get(productsAtom);
  return products.map((p) => ({
    productId: p.id,
    productName: p.name,
    sku: p.sku,
    currentStock: p.stock,
    lowStockThreshold: p.lowStockThreshold,
    status:
      p.stock === 0
        ? "out_of_stock"
        : p.stock <= p.lowStockThreshold
          ? "low_stock"
          : "in_stock",
    lastRestocked: p.updatedAt,
  }));
});

// ============================================================
// DATE RANGE ATOM — For global date filtering
// ============================================================
export const dateRangeAtom = atomWithStorage<DateRange>("ecom_date_range", {
  from: new Date(Date.now() - 30 * 86400000),
  to: new Date(),
  preset: "last_30_days",
}, createSafeLocalStorage<DateRange>());

// ============================================================
// AUTH ATOM — Mock Authentication
// ============================================================
export const authUserAtom = atomWithStorage<AuthUser | null>("ecom_auth_user", {
  id: "user_001",
  name: "Nitin Jain",
  email: "admin@radios.local",
  avatar: "/images/users/user-1.jpg",
  role: "admin",
}, createSafeLocalStorage<AuthUser | null>());

// ============================================================
// ROLE PERMISSIONS
// ============================================================
export const rolePermissionsAtom = atomWithStorage<RolePermissions[]>(
  "ecom_role_permissions",
  [
    {
      role: "admin",
      modules: {
        dashboard: true,
        orders: true,
        products: true,
        customers: true,
        inventory: true,
        marketing: true,
        analytics: true,
        returns: true,
        settings: true,
      },
    },
    {
      role: "manager",
      modules: {
        dashboard: true,
        orders: true,
        products: true,
        customers: true,
        inventory: true,
        marketing: true,
        analytics: true,
        returns: true,
        settings: false,
      },
    },
    {
      role: "support",
      modules: {
        dashboard: true,
        orders: true,
        products: false,
        customers: true,
        inventory: false,
        marketing: false,
        analytics: false,
        returns: true,
        settings: false,
      },
    },
  ],
  createSafeLocalStorage<RolePermissions[]>()
);

// ============================================================
// PINNED MENU ITEMS ATOM
// ============================================================
export const pinnedMenuItemsAtom = atomWithStorage<string[]>(
  "ecom_pinned_menus",
  [],
  createSafeLocalStorage<string[]>()
);

// ============================================================
// RECENT SEARCHES ATOM
// ============================================================
export const recentSearchesAtom = atomWithStorage<string[]>(
  "ecom_recent_searches",
  ["Baby oil", "Electronics", "Pending orders"],
  createSafeLocalStorage<string[]>()
);
