import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { ADMIN_AUTH_COOKIE_NAME, getSupabaseAdminSession } from "@/lib/supabase/admin-session";
import { Link } from '@/i18n/routing';
import { cookies } from "next/headers";
import { redirect } from "@/components/navigation";

const profileMenuItems = [
  {
    name: "Profile",
    icon: "heroicons:user",
    href: "/ecommerce/backend/profile",
  },
  {
    name: "Store Settings",
    icon: "heroicons:cog-6-tooth",
    href: "/ecommerce/backend/store-settings",
  },
  {
    name: "Team Management",
    icon: "heroicons:user-group",
    href: "/ecommerce/backend/team-management",
  },
  {
    name: "Support",
    icon: "heroicons:lifebuoy",
    href: "/ecommerce/backend/support",
  },
];

const ProfileInfo = async () => {
  const session = await getSupabaseAdminSession();
  const userName = session?.name || "Admin";
  const userEmail = session?.email || "";
  const userImage = session?.image || "/images/avatar/avatar-1.png";

  return (
    <div className="md:block hidden">
      <DropdownMenu>
        <DropdownMenuTrigger asChild className=" cursor-pointer">
          <div className=" flex items-center gap-3  text-default-800 ">
            <img src={userImage} alt={userName.charAt(0)} className="h-9 w-9 rounded-full object-cover" />

            <div className="text-sm font-medium lg:block hidden">
              {userName}
            </div>
            <span className="text-base  me-2.5 lg:inline-block hidden">
              <Icon icon="heroicons-outline:chevron-down"></Icon>
            </span>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64 p-0" align="end">
          <DropdownMenuLabel className="flex gap-2 items-center mb-1 p-3">
            <img src={userImage} alt={userName.charAt(0)} className="h-9 w-9 rounded-full object-cover" />

            <div className="min-w-0">
              <div className="text-sm font-medium text-default-800 truncate">
                {userName}
              </div>
              <Link
                href="/ecommerce/backend/profile"
                className="text-xs text-default-600 hover:text-primary truncate block"
              >
                {userEmail || "Manage admin profile"}
              </Link>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuGroup>
            {profileMenuItems.map((item) => (
              <Link
                href={item.href}
                key={item.href}
                className="cursor-pointer"
              >
                <DropdownMenuItem className="flex items-center gap-2 text-sm font-medium text-default-600 px-3 py-1.5 cursor-pointer">
                  <Icon icon={item.icon} className="w-4 h-4" />
                  {item.name}
                </DropdownMenuItem>
              </Link>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator className="mb-0 dark:bg-background" />
          <DropdownMenuItem className="flex items-center gap-2 text-sm font-medium text-default-600 my-1 px-3 cursor-pointer">
            <form
              action={async () => {
                "use server";
                cookies().delete(ADMIN_AUTH_COOKIE_NAME);
                redirect({ href: "/auth/login", locale: "en" });
              }}
              className="w-full"
            >
              <button type="submit" className=" w-full  flex  items-center gap-2" >
                <Icon icon="heroicons:power" className="w-4 h-4" />
                Log out
              </button>
            </form>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
export default ProfileInfo;

