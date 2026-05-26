"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useAtom, useAtomValue } from "jotai";
import { rolePermissionsAtom, authUserAtom } from "@/lib/store/ecommerce-store";
import type { UserRole, RolePermissions } from "@/lib/store/types";
import { Shield, Users, Settings as SettingsIcon, Save } from "lucide-react";
import { Icon } from "@/components/ui/icon";

const roleConfig: Record<UserRole, { label: string; description: string; color: string; icon: string }> = {
  admin: {
    label: "Admin",
    description: "Full access to all features and settings",
    color: "bg-primary/10 text-primary",
    icon: "heroicons:shield-check",
  },
  manager: {
    label: "Manager",
    description: "Manage orders, products, customers, and marketing",
    color: "bg-info/10 text-info",
    icon: "heroicons:user-circle",
  },
  support: {
    label: "Support",
    description: "Handle orders, customers, and returns",
    color: "bg-success/10 text-success",
    icon: "heroicons:chat-bubble-left-right",
  },
};

const moduleLabels: Record<string, { label: string; icon: string }> = {
  dashboard: { label: "Dashboard", icon: "heroicons:home" },
  orders: { label: "Orders", icon: "heroicons:clipboard-document-list" },
  products: { label: "Products", icon: "heroicons:cube" },
  customers: { label: "Customers", icon: "heroicons:users" },
  inventory: { label: "Inventory", icon: "heroicons:archive-box" },
  marketing: { label: "Marketing", icon: "heroicons:megaphone" },
  analytics: { label: "Analytics", icon: "heroicons:chart-bar" },
  returns: { label: "Returns", icon: "heroicons:arrow-uturn-left" },
  settings: { label: "Settings", icon: "heroicons:cog-6-tooth" },
};

const SettingsPage = () => {
  const [permissionsValue, setPermissions] = useAtom(rolePermissionsAtom);
  const permissions = Array.isArray(permissionsValue) ? permissionsValue : [];
  const authUser = useAtomValue(authUserAtom);
  const [saved, setSaved] = useState(false);

  const handleTogglePermission = (role: UserRole, module: string) => {
    setPermissions((prev) => {
      const currentPermissions = Array.isArray(prev) ? prev : [];
      return currentPermissions.map((p) => {
        if (p.role !== role) return p;
        return {
          ...p,
          modules: {
            ...p.modules,
            [module]: !p.modules[module as keyof typeof p.modules],
          },
        };
      });
    });
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold text-default-900">Settings</h2>
        <p className="text-sm text-default-500 mt-1">Manage roles, permissions, and system settings</p>
      </div>

      <Tabs defaultValue="roles">
        <TabsList>
          <TabsTrigger value="roles" className="gap-1">
            <Shield className="h-4 w-4" /> Roles & Permissions
          </TabsTrigger>
          <TabsTrigger value="general" className="gap-1">
            <SettingsIcon className="h-4 w-4" /> General
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="mt-5 space-y-5">
          {/* Current User */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Current User: {authUser?.name || "—"}</p>
                  <p className="text-xs text-default-400">Role: <Badge className={cn("text-[10px] capitalize ml-1", roleConfig[authUser?.role || "admin"].color)}>{authUser?.role}</Badge></p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Role Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {permissions.map((perm) => {
              const config = roleConfig[perm.role];
              return (
                <Card key={perm.role}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className={cn("h-10 w-10 rounded-full flex items-center justify-center", config.color)}>
                        <Icon icon={config.icon} className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{config.label}</CardTitle>
                        <p className="text-xs text-default-400 mt-0.5">{config.description}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(perm.modules).map(([module, enabled]) => {
                        const modConfig = moduleLabels[module];
                        return (
                          <div key={module} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Icon icon={modConfig?.icon || "heroicons:square-3-stack-3d"} className="h-4 w-4 text-default-400" />
                              <Label className="text-sm cursor-pointer">{modConfig?.label || module}</Label>
                            </div>
                            <Switch
                              checked={enabled}
                              onCheckedChange={() => handleTogglePermission(perm.role, module)}
                              disabled={perm.role === "admin"}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="flex justify-end">
            <Button className="gap-1" onClick={handleSave}>
              <Save className="h-4 w-4" />
              {saved ? "Saved!" : "Save Permissions"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="general" className="mt-5 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Store Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Enable Guest Checkout</Label>
                  <p className="text-xs text-default-400">Allow customers to buy without an account</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Auto-confirm Orders</Label>
                  <p className="text-xs text-default-400">Automatically confirm orders after payment</p>
                </div>
                <Switch />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Low Stock Email Alerts</Label>
                  <p className="text-xs text-default-400">Send email when product stock falls below threshold</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Order Notification Sound</Label>
                  <p className="text-xs text-default-400">Play a sound when new orders arrive</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Maintenance Mode</Label>
                  <p className="text-xs text-default-400">Disable the storefront for maintenance</p>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;

