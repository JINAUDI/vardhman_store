import { Link } from '@/i18n/routing';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";

const SupportPage = () => {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold text-default-900">Support</h2>
        <p className="text-sm text-default-500 mt-1">Vardhman Store admin support links for orders, customers, and storefront operations.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card>
          <CardHeader>
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3">
              <Icon icon="heroicons:envelope" className="h-5 w-5" />
            </div>
            <CardTitle className="text-base">Email Support</CardTitle>
            <CardDescription>For product, checkout, and account questions.</CardDescription>
          </CardHeader>
          <CardContent>
            <a href="mailto:vardhmanstore.support@gmail.com" className="text-sm font-medium text-primary hover:underline">
              vardhmanstore.support@gmail.com
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center text-success mb-3">
              <Icon icon="heroicons:shopping-bag" className="h-5 w-5" />
            </div>
            <CardTitle className="text-base">Order Help</CardTitle>
            <CardDescription>Jump to the order tools used most often by support staff.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/ecommerce/backend/order-list" className="flex items-center justify-between rounded-md border border-default-200 p-3 text-sm font-medium text-default-700 hover:text-primary">
              Order list
              <Icon icon="heroicons:arrow-right" className="h-4 w-4" />
            </Link>
            <Link href="/ecommerce/backend/returns" className="flex items-center justify-between rounded-md border border-default-200 p-3 text-sm font-medium text-default-700 hover:text-primary">
              Returns
              <Icon icon="heroicons:arrow-right" className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="h-10 w-10 rounded-full bg-info/10 flex items-center justify-center text-info mb-3">
              <Icon icon="heroicons:book-open" className="h-5 w-5" />
            </div>
            <CardTitle className="text-base">Storefront References</CardTitle>
            <CardDescription>Use these sections when checking customer-facing issues.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/ecommerce/backend/products" className="flex items-center justify-between rounded-md border border-default-200 p-3 text-sm font-medium text-default-700 hover:text-primary">
              Products
              <Icon icon="heroicons:arrow-right" className="h-4 w-4" />
            </Link>
            <Link href="/ecommerce/backend/customer-list" className="flex items-center justify-between rounded-md border border-default-200 p-3 text-sm font-medium text-default-700 hover:text-primary">
              Customers
              <Icon icon="heroicons:arrow-right" className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Support Workflow</CardTitle>
          <CardDescription>Recommended admin flow for customer requests.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-md border border-default-200 p-4">
            <p className="text-sm font-semibold text-default-900">1. Find the order</p>
            <p className="text-sm text-default-500 mt-1">Use order list search by order number, tracking ID, email, or phone.</p>
          </div>
          <div className="rounded-md border border-default-200 p-4">
            <p className="text-sm font-semibold text-default-900">2. Confirm status</p>
            <p className="text-sm text-default-500 mt-1">Check payment, fulfillment, tracking, refund, and return state.</p>
          </div>
          <div className="rounded-md border border-default-200 p-4">
            <p className="text-sm font-semibold text-default-900">3. Update the customer</p>
            <p className="text-sm text-default-500 mt-1">Use the storefront support email for any manual follow-up.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SupportPage;
