import LayoutProvider from "@/providers/layout.provider";
import LayoutContentProvider from "@/providers/content.provider";
import DashCodeSidebar from "@/components/partials/sidebar";
import DashCodeFooter from "@/components/partials/footer";
import ThemeCustomize from "@/components/partials/customizer";
import DashCodeHeader from "@/components/partials/header";
import { getSupabaseAdminSession } from "@/lib/supabase/admin-session";
import { redirect } from "@/components/navigation";

const layout = async ({ children }: { children: React.ReactNode }) => {
  const session = await getSupabaseAdminSession();

  if (!session) {
    redirect({ href: "/auth/login", locale: "en" });
  }

  return (
    <LayoutProvider>
      <ThemeCustomize />
      <DashCodeHeader />
      <DashCodeSidebar />
      <LayoutContentProvider>{children}</LayoutContentProvider>
      <DashCodeFooter />
    </LayoutProvider>
  );
};

export default layout;
