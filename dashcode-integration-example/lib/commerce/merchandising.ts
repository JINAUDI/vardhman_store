import type {
  Collection,
  CollectionCondition,
  Coupon,
  DiscountTargetScope,
  Product,
} from "@/lib/store/types";

export type ProductLike = Pick<
  Product,
  "id" | "name" | "price" | "category" | "sku" | "stock" | "tags"
>;

export type CartLineLike = {
  productId: string;
  quantity: number;
  price: number;
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function getConditionFieldValue(product: ProductLike, field: CollectionCondition["field"]) {
  switch (field) {
    case "title":
      return product.name || "";
    case "category":
      return product.category || "";
    case "tag":
      return Array.isArray(product.tags) ? product.tags.join(" ") : "";
    case "price":
      return String(product.price ?? 0);
    case "stock":
      return String(product.stock ?? 0);
    case "sku":
      return product.sku || "";
    default:
      return "";
  }
}

export function matchesCollectionCondition(
  product: ProductLike,
  condition: CollectionCondition
) {
  const productValue = getConditionFieldValue(product, condition.field);
  const expectedValue = condition.value ?? "";

  if (condition.field === "price" || condition.field === "stock") {
    const left = Number(productValue || 0);
    const right = Number(expectedValue || 0);

    if (condition.operator === "greater_than") return left > right;
    if (condition.operator === "less_than") return left < right;
    if (condition.operator === "equals") return left === right;
    if (condition.operator === "not_equals") return left !== right;
  }

  const left = normalize(productValue);
  const right = normalize(expectedValue);

  switch (condition.operator) {
    case "equals":
      return left === right;
    case "not_equals":
      return left !== right;
    case "contains":
      return left.includes(right);
    case "not_contains":
      return !left.includes(right);
    case "starts_with":
      return left.startsWith(right);
    case "ends_with":
      return left.endsWith(right);
    default:
      return false;
  }
}

export function collectionMatchesProduct(collection: Collection, product: ProductLike) {
  if (collection.collectionType === "manual") {
    return collection.productIds.includes(product.id);
  }

  if (!collection.conditions.length) {
    return false;
  }

  const results = collection.conditions.map((condition) =>
    matchesCollectionCondition(product, condition)
  );

  return collection.conditionsMatch === "any"
    ? results.some(Boolean)
    : results.every(Boolean);
}

export function getCollectionProductIds(
  collection: Collection,
  products: ProductLike[]
) {
  return products
    .filter((product) => collectionMatchesProduct(collection, product))
    .map((product) => product.id);
}

function getScopeProductIds(
  scope: DiscountTargetScope | undefined,
  productIds: string[] | undefined,
  collectionIds: string[] | undefined,
  categorySlugs: string[] | undefined,
  products: ProductLike[],
  collections: Collection[]
) {
  if (!scope || scope === "all_products") {
    return new Set(products.map((product) => product.id));
  }

  if (scope === "specific_products") {
    return new Set(productIds ?? []);
  }

  if (scope === "specific_categories") {
    const allowed = new Set((categorySlugs ?? []).map(normalize));
    return new Set(
      products
        .filter((product) => allowed.has(normalize(product.category || "")))
        .map((product) => product.id)
    );
  }

  const allowedCollectionIds = new Set(collectionIds ?? []);
  const resolvedProductIds = new Set<string>();

  collections.forEach((collection) => {
    if (!allowedCollectionIds.has(collection.id)) {
      return;
    }

    getCollectionProductIds(collection, products).forEach((productId) =>
      resolvedProductIds.add(productId)
    );
  });

  return resolvedProductIds;
}

export type DiscountComputation = {
  subtotal: number;
  discountAmount: number;
  shippingDiscountAmount: number;
  total: number;
  matchedCouponId?: string;
  matchedCouponCode?: string;
  lineDiscounts: Record<string, number>;
};

export function computeDiscountPreview(
  coupon: Coupon,
  cartLines: CartLineLike[],
  products: ProductLike[],
  collections: Collection[]
): DiscountComputation {
  const subtotal = cartLines.reduce(
    (sum, line) => sum + (Number(line.price) || 0) * (Number(line.quantity) || 0),
    0
  );
  const productMap = new Map(products.map((product) => [product.id, product]));
  const lineDiscounts: Record<string, number> = {};

  const targetIds = getScopeProductIds(
    coupon.targetScope,
    coupon.targetProductIds ?? coupon.selectedProductIds,
    coupon.targetCollectionIds,
    coupon.targetCategorySlugs,
    products,
    collections
  );

  const eligibleLines = cartLines.filter((line) => targetIds.has(line.productId));
  const eligibleSubtotal = eligibleLines.reduce(
    (sum, line) => sum + (Number(line.price) || 0) * (Number(line.quantity) || 0),
    0
  );
  const eligibleQuantity = eligibleLines.reduce(
    (sum, line) => sum + (Number(line.quantity) || 0),
    0
  );

  if (
    coupon.requirementType === "minimum_purchase_amount" &&
    subtotal < (coupon.minOrderAmount || 0)
  ) {
    return {
      subtotal,
      discountAmount: 0,
      shippingDiscountAmount: 0,
      total: subtotal,
      lineDiscounts,
    };
  }

  if (
    coupon.requirementType === "minimum_quantity" &&
    eligibleQuantity < (coupon.minQuantity || 0)
  ) {
    return {
      subtotal,
      discountAmount: 0,
      shippingDiscountAmount: 0,
      total: subtotal,
      lineDiscounts,
    };
  }

  let discountAmount = 0;
  let shippingDiscountAmount = 0;

  if (coupon.discountCategory === "free_shipping") {
    shippingDiscountAmount = coupon.value || 0;
  } else if (coupon.discountCategory === "buy_x_get_y") {
    const buyTargetIds = getScopeProductIds(
      coupon.buyTargetScope || coupon.targetScope,
      coupon.buyProductIds ?? coupon.targetProductIds,
      coupon.buyCollectionIds ?? coupon.targetCollectionIds,
      coupon.buyCategorySlugs ?? coupon.targetCategorySlugs,
      products,
      collections
    );
    const getTargetIds = getScopeProductIds(
      coupon.getTargetScope || coupon.targetScope,
      coupon.getProductIds ?? coupon.targetProductIds,
      coupon.getCollectionIds ?? coupon.targetCollectionIds,
      coupon.getCategorySlugs ?? coupon.targetCategorySlugs,
      products,
      collections
    );

    const buyQty = cartLines
      .filter((line) => buyTargetIds.has(line.productId))
      .reduce((sum, line) => sum + line.quantity, 0);
    const getLines = cartLines
      .filter((line) => getTargetIds.has(line.productId))
      .sort((left, right) => left.price - right.price);
    const getQty = getLines.reduce((sum, line) => sum + line.quantity, 0);
    const buyQuantity = Math.max(1, coupon.buyQuantity || 1);
    const getQuantity = Math.max(1, coupon.getQuantity || 1);
    const buyAndGetOverlap = cartLines.some(
      (line) => buyTargetIds.has(line.productId) && getTargetIds.has(line.productId)
    );
    const eligibleSets = buyAndGetOverlap
      ? Math.floor(getQty / (buyQuantity + getQuantity))
      : Math.min(
          Math.floor(buyQty / buyQuantity),
          Math.floor(getQty / getQuantity)
        );

    if (eligibleSets > 0) {
      let remainingFreeQty = eligibleSets * getQuantity;
      getLines.forEach((line) => {
        if (remainingFreeQty <= 0) {
          return;
        }

        const freeQty = Math.min(line.quantity, remainingFreeQty);
        const lineAmount = freeQty * line.price;
        discountAmount += lineAmount;
        lineDiscounts[line.productId] = (lineDiscounts[line.productId] || 0) + lineAmount;
        remainingFreeQty -= freeQty;
      });
    }
  } else {
    if (coupon.type === "percentage") {
      discountAmount = (eligibleSubtotal * (coupon.value || 0)) / 100;
      if (coupon.maxDiscount) {
        discountAmount = Math.min(discountAmount, coupon.maxDiscount);
      }
    } else {
      discountAmount = Math.min(coupon.value || 0, eligibleSubtotal);
    }

    eligibleLines.forEach((line) => {
      const lineTotal = line.price * line.quantity;
      const share =
        eligibleSubtotal > 0 ? (lineTotal / eligibleSubtotal) * discountAmount : 0;
      lineDiscounts[line.productId] = share;
    });
  }

  return {
    subtotal,
    discountAmount,
    shippingDiscountAmount,
    total: Math.max(0, subtotal - discountAmount - shippingDiscountAmount),
    matchedCouponId: coupon.id,
    matchedCouponCode: coupon.code,
    lineDiscounts,
  };
}
