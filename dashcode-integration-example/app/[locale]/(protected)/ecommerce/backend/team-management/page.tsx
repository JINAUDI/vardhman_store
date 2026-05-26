import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type TeamMember = {
  id: string;
  auth_user_id: string | null;
  email: string | null;
  role: string | null;
  is_active: boolean | null;
  created_at: string | null;
};

type TeamState = {
  members: TeamMember[];
  error: string | null;
};

async function getTeamMembers(): Promise<TeamState> {
  if (!isSupabaseConfigured()) {
    return { members: [], error: "Supabase is not configured for this Dashcode project." };
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("admin_users")
    .select("id,auth_user_id,email,role,is_active,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return { members: [], error: error.message };
  }

  return { members: (data || []) as TeamMember[], error: null };
}

function formatDate(value: string | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}

const TeamManagementPage = async () => {
  const { members, error } = await getTeamMembers();
  const activeMembers = members.filter((member) => member.is_active !== false).length;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold text-default-900">Team Management</h2>
        <p className="text-sm text-default-500 mt-1">View the admins and managers allowed to access Dashcode.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Icon icon="heroicons:users" className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-default-500">Team members</p>
                <p className="text-2xl font-semibold text-default-900">{members.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center text-success">
                <Icon icon="heroicons:check-circle" className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-default-500">Active users</p>
                <p className="text-2xl font-semibold text-default-900">{activeMembers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-info/10 flex items-center justify-center text-info">
                <Icon icon="heroicons:shield-check" className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-default-500">Access source</p>
                <p className="text-base font-semibold text-default-900">Supabase admin_users</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Admin Users</CardTitle>
          <CardDescription>Team access is controlled by rows in the admin_users table.</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="rounded-md border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
              {error}
            </div>
          ) : members.length === 0 ? (
            <div className="rounded-md border border-default-200 p-6 text-center">
              <Icon icon="heroicons:user-group" className="mx-auto h-8 w-8 text-default-400" />
              <p className="mt-3 text-sm font-medium text-default-700">No team members found</p>
              <p className="mt-1 text-xs text-default-500">Add admin rows in Supabase to grant Dashcode access.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-default-200 text-left text-xs uppercase text-default-400">
                    <th className="py-3 pr-4 font-medium">Email</th>
                    <th className="py-3 pr-4 font-medium">Role</th>
                    <th className="py-3 pr-4 font-medium">Status</th>
                    <th className="py-3 pr-4 font-medium">Added</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.id} className="border-b border-default-100 last:border-0">
                      <td className="py-3 pr-4 text-default-800">{member.email || "No email"}</td>
                      <td className="py-3 pr-4">
                        <Badge color="primary" rounded="full">{member.role || "admin"}</Badge>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge color={member.is_active === false ? "warning" : "success"} rounded="full">
                          {member.is_active === false ? "Inactive" : "Active"}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 text-default-500">{formatDate(member.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TeamManagementPage;
