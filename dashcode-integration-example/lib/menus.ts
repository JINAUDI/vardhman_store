


export type SubChildren = {
  href: string;
  label: string;
  active: boolean;
  children?: SubChildren[];
};
export type Submenu = {
  href: string;
  label: string;
  active: boolean;
  icon: any;
  submenus?: Submenu[];
  children?: SubChildren[];
};

export type Menu = {
  href: string;
  label: string;
  active: boolean;
  icon: any;
  submenus: Submenu[];
  id: string;
  badge?: number;
};

export type Group = {
  groupLabel: string;
  menus: Menu[];
  id: string;
};

export function getMenuList(pathname: string, t: any): Group[] {

  return [
    // ──────────────────────────────────────
    // DASHBOARD
    // ──────────────────────────────────────
    {
      groupLabel: "Dashboard",
      id: "dashboard",
      menus: [
        {
          id: "dashboard",
          href: "/dashboard/dash-ecom",
          label: "Dashboard",
          active: pathname.includes("/dashboard"),
          icon: "heroicons-outline:home",
          submenus: [
            {
              href: "/dashboard/dash-ecom",
              label: "Ecommerce",
              active: pathname === "/dashboard/dash-ecom",
              icon: "heroicons:shopping-cart",
              children: [],
            },
          ],
        },
      ],
    },

    // ──────────────────────────────────────
    // ORDERS
    // ──────────────────────────────────────
    {
      groupLabel: "Management",
      id: "orders-group",
      menus: [
        {
          id: "orders",
          href: "/ecommerce/backend/order-list",
          label: "Orders",
          active: pathname.includes("/ecommerce/backend/order"),
          icon: "heroicons-outline:clipboard-list",
          submenus: [
            {
              href: "/ecommerce/backend/order-list",
              label: "All Orders",
              active: pathname === "/ecommerce/backend/order-list",
              icon: "heroicons:queue-list",
              children: [],
            },
            {
              href: "/ecommerce/backend/order-details",
              label: "Order Details",
              active: pathname === "/ecommerce/backend/order-details",
              icon: "heroicons:document-text",
              children: [],
            },
          ],
        },

        // ──────────────────────────────────────
        // PRODUCTS
        // ──────────────────────────────────────
        {
          id: "products",
          href: "/ecommerce/backend/products",
          label: "Products",
          active:
            pathname.includes("/ecommerce/backend/products") ||
            pathname.includes("/ecommerce/backend/categories") ||
            pathname.includes("/ecommerce/backend/add-product") ||
            pathname.includes("/ecommerce/backend/edit-product") ||
            pathname.includes("/ecommerce/backend/collections"),
          icon: "heroicons-outline:cube",
          submenus: [
            {
              href: "/ecommerce/backend/products",
              label: "All Products",
              active: pathname === "/ecommerce/backend/products",
              icon: "heroicons:squares-2x2",
              children: [],
            },
            {
              href: "/ecommerce/backend/add-product",
              label: "Add Product",
              active: pathname === "/ecommerce/backend/add-product",
              icon: "heroicons:plus-circle",
              children: [],
            },
            {
              href: "/ecommerce/backend/categories",
              label: "Categories",
              active: pathname === "/ecommerce/backend/categories",
              icon: "heroicons:tag",
              children: [],
            },
            {
              href: "/ecommerce/backend/collections",
              label: "Collections",
              active: pathname === "/ecommerce/backend/collections",
              icon: "heroicons:square-3-stack-3d",
              children: [],
            },
            {
              href: "/ecommerce/backend/edit-product",
              label: "Edit Product",
              active: pathname === "/ecommerce/backend/edit-product",
              icon: "heroicons:pencil-square",
              children: [],
            },
          ],
        },

        // ──────────────────────────────────────
        // CUSTOMERS
        // ──────────────────────────────────────
        {
          id: "customers",
          href: "/ecommerce/backend/customer-list",
          label: "Customers",
          active:
            pathname.includes("/ecommerce/backend/customer") ||
            pathname.includes("/ecommerce/backend/abandoned-carts"),
          icon: "heroicons-outline:users",
          submenus: [
            {
              href: "/ecommerce/backend/customer-list",
              label: "Customer List",
              active: pathname === "/ecommerce/backend/customer-list",
              icon: "heroicons:user-group",
              children: [],
            },
            {
              href: "/ecommerce/backend/abandoned-carts",
              label: "Abandoned Carts",
              active: pathname === "/ecommerce/backend/abandoned-carts",
              icon: "heroicons:shopping-cart",
              children: [],
            },
          ],
        },

        // ──────────────────────────────────────
        // INVENTORY
        // ──────────────────────────────────────
        {
          id: "inventory",
          href: "/ecommerce/backend/inventory",
          label: "Inventory",
          active: pathname.includes("/ecommerce/backend/inventory"),
          icon: "heroicons-outline:archive-box",
          submenus: [],
        },
      ],
    },

    // ──────────────────────────────────────
    // MARKETING
    // ──────────────────────────────────────
    {
      groupLabel: "Marketing",
      id: "marketing-group",
      menus: [
        {
          id: "marketing",
          href: "/ecommerce/backend/marketing/discounts",
          label: "Marketing",
          active:
            pathname.includes("/ecommerce/backend/marketing") ||
            pathname.includes("/ecommerce/backend/homepage-banners"),
          icon: "heroicons-outline:megaphone",
          submenus: [
            {
              href: "/ecommerce/backend/marketing/discounts",
              label: "Discounts",
              active:
                pathname === "/ecommerce/backend/marketing/discounts" ||
                pathname === "/ecommerce/backend/marketing/coupons",
              icon: "heroicons:ticket",
              children: [],
            },
            {
              href: "/ecommerce/backend/homepage-banners",
              label: "Homepage Banners",
              active:
                pathname === "/ecommerce/backend/homepage-banners" ||
                pathname === "/ecommerce/backend/marketing/banners",
              icon: "heroicons:photo",
              children: [],
            },
            {
              href: "/ecommerce/backend/marketing/featured",
              label: "Featured Products",
              active: pathname === "/ecommerce/backend/marketing/featured",
              icon: "heroicons:star",
              children: [],
            },
          ],
        },
      ],
    },

    // ──────────────────────────────────────
    // ANALYTICS & REPORTS
    // ──────────────────────────────────────
    {
      groupLabel: "Insights",
      id: "analytics-group",
      menus: [
        {
          id: "analytics",
          href: "/ecommerce/backend/analytics",
          label: "Analytics",
          active: pathname.includes("/ecommerce/backend/analytics"),
          icon: "heroicons-outline:chart-bar",
          submenus: [],
        },
        {
          id: "invoice",
          href: "/ecommerce/backend/invoice",
          label: "Invoices",
          active: pathname === "/ecommerce/backend/invoice",
          icon: "heroicons-outline:document-text",
          submenus: [],
        },
      ],
    },

    // ──────────────────────────────────────
    // RETURNS & REFUNDS
    // ──────────────────────────────────────
    {
      groupLabel: "",
      id: "returns-group",
      menus: [
        {
          id: "returns",
          href: "/ecommerce/backend/returns",
          label: "Returns & Refunds",
          active: pathname.includes("/ecommerce/backend/returns"),
          icon: "heroicons-outline:arrow-uturn-left",
          submenus: [],
        },
      ],
    },

    // ──────────────────────────────────────
    // SETTINGS
    // ──────────────────────────────────────
    {
      groupLabel: "",
      id: "settings-group",
      menus: [
        {
          id: "settings",
          href: "/ecommerce/backend/settings",
          label: "Settings",
          active: pathname.includes("/ecommerce/backend/settings"),
          icon: "heroicons-outline:cog-6-tooth",
          submenus: [],
        },
      ],
    },
  ];
}

// Horizontal menu uses the same structure as sidebar
export function getHorizontalMenuList(pathname: string, t: any): Group[] {
  return getMenuList(pathname, t);
}
