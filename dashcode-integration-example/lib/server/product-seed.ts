import type { Product } from "@/lib/store/types";

const categories = [
  "Electronics",
  "Mobile Accessories",
  "Health Supplements",
  "Hygiene & Personal Care",
  "Baby Products",
  "Household Items",
];

const productNames = [
  "Bluetooth Speaker Mini",
  "Fast Charging Power Bank",
  "Kids Feeding Bottle Set",
  "Organic Vitamin C Tablets",
  "Wireless Neckband Earbuds",
  "Premium Toothbrush Kit",
  "Smart LED Desk Lamp",
  "Baby Wipes Value Pack",
  "Electrolyte Drink Mix",
  "USB-C Cable Braided",
  "Air Purifier Filter Pack",
  "Moisturizing Hand Wash",
  "Digital Kitchen Scale",
  "Portable Phone Stand",
  "Protein Shake Starter Pack",
  "Bottle Sterilizer Box",
  "Touchless Soap Dispenser",
  "Noise Cancelling Headphones",
  "Supplement Organizer Box",
  "Kitchen Cleaning Cloth Set",
  "Car Charger Dual Port",
  "Baby Skin Care Bundle",
  "Multivitamin Gummies",
  "Smart Home Plug Duo",
];

const productImages = [
  "/images/all-img/p-1.png",
  "/images/all-img/p-2.png",
  "/images/all-img/p-3.png",
  "/images/all-img/p-4.png",
  "/images/all-img/p-5.png",
  "/images/all-img/p-6.png",
];

export function createSeedProducts(): Product[] {
  return productNames.map((name, index) => {
    const category = categories[index % categories.length];
    const stock = (index * 9) % 72;
    const price = Number((24.99 + index * 3.75).toFixed(2));
    const createdAt = new Date(Date.now() - index * 86400000).toISOString();

    return {
      id: `seed_prod_${(index + 1).toString().padStart(3, "0")}`,
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      sku: `RAD-${(index + 101).toString()}`,
      description: `${name} designed for daily ecommerce demand and admin workflow testing.`,
      price,
      compareAtPrice: index % 2 === 0 ? Number((price * 1.15).toFixed(2)) : undefined,
      images: [
        productImages[index % productImages.length],
        productImages[(index + 1) % productImages.length],
      ],
      category,
      tags: [category.toLowerCase(), index % 2 === 0 ? "featured" : "new"],
      variants: [],
      stock,
      lowStockThreshold: 10,
      status: stock === 0 ? "out_of_stock" : "active",
      featured: index < 4,
      visible: stock > 0 && index % 7 !== 0,
      isVisible: stock > 0 && index % 7 !== 0,
      metaTitle: name,
      metaDescription: `${name} available in the Vardhman Store admin catalog.`,
      createdAt,
      updatedAt: createdAt,
    };
  });
}
