import { Link } from '@/i18n/routing';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { getSupabaseAdminSession } from "@/lib/supabase/admin-session";
import ProfileForm from "./profile-form";

const ProfilePage = async () => {
  const session = await getSupabaseAdminSession();
  const userName = session?.name || "Admin";
  const userEmail = session?.email || "Not signed in";
  const userImage = session?.image || "/images/avatar/avatar-1.png";
  const role = session?.role || "admin";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold text-default-900">Profile</h2>
        <p className="text-sm text-default-500 mt-1">Manage the active Dashcode admin account for Radios.</p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <img src={userImage} alt={userName} className="h-[72px] w-[72px] rounded-full object-cover" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-semibold text-default-900">{userName}</h3>
                  <Badge color="primary" rounded="full">{role}</Badge>
                </div>
                <p className="text-sm text-default-500 mt-1">{userEmail}</p>
                {session?.jobTitle ? <p className="text-sm text-default-500 mt-1">{session.jobTitle}</p> : null}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2">
          <ProfileForm
            initialProfile={{
              id: session?.id || "",
              email: userEmail,
              fullName: userName,
              avatarUrl: userImage,
              role,
              phone: session?.phone || "",
              jobTitle: session?.jobTitle || "",
              location: session?.location || "",
              bio: session?.bio || "",
            }}
          />
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Account Details</CardTitle>
              <CardDescription>Signed-in admin identity.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs uppercase text-default-400">Name</p>
                <p className="text-sm font-medium text-default-800 mt-1">{userName}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-default-400">Email</p>
                <p className="text-sm font-medium text-default-800 mt-1 break-all">{userEmail}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-default-400">Auth User ID</p>
                <p className="text-sm font-medium text-default-800 mt-1 break-all">{session?.id || "Unavailable"}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Admin Details</CardTitle>
              <CardDescription>Profile details saved in Supabase Auth metadata.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-md border border-default-200 p-3">
                <span className="text-sm text-default-600">Current role</span>
                <Badge color="success" rounded="full">{role}</Badge>
              </div>
              <div className="rounded-md border border-default-200 p-3">
                <p className="text-xs uppercase text-default-400">Phone</p>
                <p className="text-sm font-medium text-default-800 mt-1">{session?.phone || "Not added"}</p>
              </div>
              <div className="rounded-md border border-default-200 p-3">
                <p className="text-xs uppercase text-default-400">Location</p>
                <p className="text-sm font-medium text-default-800 mt-1">{session?.location || "Not added"}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Links</CardTitle>
              <CardDescription>Useful admin destinations.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/ecommerce/backend/store-settings" className="flex items-center justify-between rounded-md border border-default-200 p-3 text-sm font-medium text-default-700 hover:text-primary">
                Store Settings
                <Icon icon="heroicons:arrow-right" className="h-4 w-4" />
              </Link>
              <Link href="/ecommerce/backend/team-management" className="flex items-center justify-between rounded-md border border-default-200 p-3 text-sm font-medium text-default-700 hover:text-primary">
                Team Management
                <Icon icon="heroicons:arrow-right" className="h-4 w-4" />
              </Link>
              <Link href="/ecommerce/backend/support" className="flex items-center justify-between rounded-md border border-default-200 p-3 text-sm font-medium text-default-700 hover:text-primary">
                Support
                <Icon icon="heroicons:arrow-right" className="h-4 w-4" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
