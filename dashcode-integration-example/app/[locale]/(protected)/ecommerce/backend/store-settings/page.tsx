import { Link } from '@/i18n/routing';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { getSupabaseConfigSummary } from "@/lib/supabase/config";

const StoreSettingsPage = () => {
  const supabase = getSupabaseConfigSummary();

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-default-900">Store Settings</h2>
          <p className="text-sm text-default-500 mt-1">Operational settings for the Vardhman Store storefront and Dashcode admin.</p>
        </div>
        <Link href="/ecommerce/backend/settings">
          <Button variant="outline" color="primary" className="gap-2">
            <Icon icon="heroicons:shield-check" className="h-4 w-4" />
            Roles & Permissions
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Store Identity</CardTitle>
            <CardDescription>Customer-facing storefront basics.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-md border border-default-200 p-3">
              <span className="text-sm text-default-600">Store name</span>
              <span className="text-sm font-medium text-default-900">Vardhman Store</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-default-200 p-3">
              <span className="text-sm text-default-600">Currency</span>
              <Badge color="primary" rounded="full">INR</Badge>
            </div>
            <div className="flex items-center justify-between rounded-md border border-default-200 p-3">
              <span className="text-sm text-default-600">Market</span>
              <span className="text-sm font-medium text-default-900">India</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Supabase Connection</CardTitle>
            <CardDescription>Configuration used by the live admin and storefront sync.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-md border border-default-200 p-3">
              <span className="text-sm text-default-600">Project URL</span>
              <Badge color={supabase.hasUrl ? "success" : "warning"} rounded="full">{supabase.hasUrl ? "Configured" : "Missing"}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-md border border-default-200 p-3">
              <span className="text-sm text-default-600">Anon key</span>
              <Badge color={supabase.hasAnonKey ? "success" : "warning"} rounded="full">{supabase.hasAnonKey ? "Configured" : "Missing"}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-md border border-default-200 p-3">
              <span className="text-sm text-default-600">Service role key</span>
              <Badge color={supabase.hasServiceRoleKey ? "success" : "warning"} rounded="full">{supabase.hasServiceRoleKey ? "Configured" : "Missing"}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Store Operations</CardTitle>
            <CardDescription>Where core store settings are managed.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/ecommerce/backend/homepage-banners" className="flex items-center justify-between rounded-md border border-default-200 p-3 text-sm font-medium text-default-700 hover:text-primary">
              Homepage banners
              <Icon icon="heroicons:arrow-right" className="h-4 w-4" />
            </Link>
            <Link href="/ecommerce/backend/categories" className="flex items-center justify-between rounded-md border border-default-200 p-3 text-sm font-medium text-default-700 hover:text-primary">
              Categories
              <Icon icon="heroicons:arrow-right" className="h-4 w-4" />
            </Link>
            <Link href="/ecommerce/backend/promotions" className="flex items-center justify-between rounded-md border border-default-200 p-3 text-sm font-medium text-default-700 hover:text-primary">
              Promotions
              <Icon icon="heroicons:arrow-right" className="h-4 w-4" />
            </Link>
            <Link href="/ecommerce/backend/settings" className="flex items-center justify-between rounded-md border border-default-200 p-3 text-sm font-medium text-default-700 hover:text-primary">
              Role permissions
              <Icon icon="heroicons:arrow-right" className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StoreSettingsPage;
