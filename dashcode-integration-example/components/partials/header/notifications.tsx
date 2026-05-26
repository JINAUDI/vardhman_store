"use client";

import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link, useRouter } from '@/i18n/routing';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { useAtom } from "jotai";
import { notificationsAtom } from "@/lib/store/ecommerce-store";
import type { AppNotification, NotificationType } from "@/lib/store/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useEffect } from "react";
import { toast } from "sonner";

type NotificationRow = {
    id: string;
    type?: string;
    title: string;
    message?: string | null;
    order_id?: string | null;
    tracking_id?: string | null;
    customer_name?: string | null;
    customer_phone?: string | null;
    customer_email?: string | null;
    total?: number | string | null;
    is_read?: boolean | null;
    created_at?: string | null;
};

type DashboardNotification = AppNotification & {
    orderId?: string;
    trackingId?: string;
    customerName?: string;
    total?: number;
};

const NOTIFICATIONS_CHANNEL = "dashboard-notifications";
const NOTIFICATION_COLUMNS =
    "id,type,title,message,order_id,tracking_id,customer_name,customer_phone,customer_email,total,is_read,created_at";

const typeIcons: Record<NotificationType, { icon: string; color: string }> = {
    order: { icon: "heroicons:shopping-cart", color: "text-info" },
    stock: { icon: "heroicons:archive-box", color: "text-warning" },
    return: { icon: "heroicons:arrow-uturn-left", color: "text-destructive" },
    system: { icon: "heroicons:cog-6-tooth", color: "text-primary" },
    message: { icon: "heroicons:chat-bubble-left", color: "text-success" },
};

function formatAmount(value?: number) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(Number(value) || 0);
}

function mapNotificationRow(row: NotificationRow): DashboardNotification {
    const total = Number(row.total) || 0;
    const trackingId = row.tracking_id || "";
    const customerName = row.customer_name || "Customer";
    const description =
        row.message ||
        [customerName, trackingId, total ? formatAmount(total) : ""].filter(Boolean).join(" - ");

    return {
        id: row.id,
        type: (row.type || "order") as NotificationType,
        title: row.title || "New Order Received",
        description,
        link: row.order_id ? `/ecommerce/backend/order-details?id=${row.order_id}` : undefined,
        read: Boolean(row.is_read),
        createdAt: row.created_at || new Date().toISOString(),
        orderId: row.order_id || undefined,
        trackingId,
        customerName,
        total,
    };
}

function mergeNotifications(
    incoming: DashboardNotification[],
    existing: AppNotification[] = []
): DashboardNotification[] {
    const seen = new Set<string>();

    return [...incoming, ...(existing as DashboardNotification[])]
        .filter((item) => {
            if (seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 25);
}

const Notifications = () => {
    const [notifications, setNotifications] = useAtom(notificationsAtom);
    const dashboardNotifications = notifications as DashboardNotification[];
    const router = useRouter();
    const unreadCount = dashboardNotifications.filter((item) => !item.read).length;

    useEffect(() => {
        let isMounted = true;
        let supabase: ReturnType<typeof getSupabaseBrowserClient>;

        try {
            supabase = getSupabaseBrowserClient();
        } catch (error) {
            console.warn("[notifications] Unable to initialize Supabase browser client.", error);
            return () => {
                isMounted = false;
            };
        }

        async function fetchNotifications() {
            try {
                const { data, error } = await supabase
                    .from("notifications")
                    .select(NOTIFICATION_COLUMNS)
                    .order("created_at", { ascending: false })
                    .limit(25);

                if (error) throw error;
                if (!isMounted) return;

                const fetchedNotifications = (data ?? []).map((row) => mapNotificationRow(row as NotificationRow));
                setNotifications((prev) => mergeNotifications(fetchedNotifications, prev));
            } catch (error) {
                console.warn("[notifications] Unable to load Supabase notifications.", error);
            }
        }

        void fetchNotifications();

        const channel = supabase
            .channel(NOTIFICATIONS_CHANNEL)
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "notifications" },
                (payload) => {
                    console.log("New realtime notification payload:", payload);
                    if (!isMounted || !payload.new) return;

                    const nextNotification = mapNotificationRow(payload.new as NotificationRow);
                    setNotifications((prev) => mergeNotifications([nextNotification], prev));
                    toast.success("New order received", {
                        description: nextNotification.description,
                    });
                }
            )
            .subscribe((status, error) => {
                console.log("Realtime status:", status);
                if (error) {
                    console.warn("[notifications] Supabase realtime subscription error:", error);
                }
                if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
                    console.warn("[notifications] Supabase realtime subscription issue:", status);
                }
            });

        return () => {
            isMounted = false;
            void supabase.removeChannel(channel).then((status) => {
                console.log("Realtime cleanup status:", status);
            });
        };
    }, [setNotifications]);

    const markReadInSupabase = async (ids: string[]) => {
        if (ids.length === 0) return;

        try {
            const supabase = getSupabaseBrowserClient();
            const { error } = await supabase
                .from("notifications")
                .update({ is_read: true })
                .in("id", ids);

            if (error) throw error;
        } catch (error) {
            console.warn("[notifications] Unable to mark notifications as read.", error);
        }
    };

    const handleNotificationClick = (item: DashboardNotification) => {
        setNotifications((prev) =>
            prev.map((notification) =>
                notification.id === item.id ? { ...notification, read: true } : notification
            )
        );
        void markReadInSupabase([item.id]);
        if (item.link) {
            router.push(item.link);
        }
    };

    const handleMarkAllRead = () => {
        const ids = dashboardNotifications.filter((item) => !item.read).map((item) => item.id);
        setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
        void markReadInSupabase(ids);
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHrs = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return "Just now";
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHrs < 24) return `${diffHrs}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button type="button" className="relative hidden focus:ring-none focus:outline-hidden md:h-8 md:w-8 md:bg-secondary text-secondary-foreground rounded-full md:flex flex-col items-center justify-center cursor-pointer">
                    <Icon icon="heroicons-outline:bell" className="animate-tada h-5 w-5" />
                    {unreadCount > 0 && (
                        <Badge className="w-4 h-4 p-0 text-[8px] rounded-full font-semibold items-center justify-center absolute left-[calc(100%-12px)] bottom-[calc(100%-10px)]" color="destructive">
                            {unreadCount > 9 ? "9+" : unreadCount}
                        </Badge>
                    )}
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                className="z-999 mx-4 lg:w-[360px] p-0">
                <DropdownMenuLabel>
                    <div className="flex justify-between items-center px-4 py-3 border-b border-default-100">
                        <div className="text-sm text-default-800 font-medium">
                            Notifications
                            {unreadCount > 0 && (
                                <span className="ml-1.5 text-xs font-normal text-default-400">
                                    ({unreadCount} unread)
                                </span>
                            )}
                        </div>
                        <div className="flex gap-2">
                            {unreadCount > 0 && (
                                <button
                                    onClick={handleMarkAllRead}
                                    className="text-xs text-primary hover:underline cursor-pointer"
                                >
                                    Mark all read
                                </button>
                            )}
                            <Link href="/notifications" className="text-xs text-default-500 hover:underline">
                                View all
                            </Link>
                        </div>
                    </div>
                </DropdownMenuLabel>
                <div className="h-[300px] xl:h-[380px]">
                    <ScrollArea className="h-full">
                        {dashboardNotifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-[200px] text-default-400">
                                <Icon icon="heroicons:bell-slash" className="h-10 w-10 mb-2" />
                                <p className="text-sm">No notifications</p>
                            </div>
                        ) : (
                            dashboardNotifications.slice(0, 15).map((item, index) => {
                                const typeConfig = typeIcons[item.type] || typeIcons.system;
                                return (
                                    <DropdownMenuItem
                                        key={`notif-${item.id}`}
                                        className={cn(
                                            "flex gap-3 py-3 px-4 cursor-pointer group border-b border-default-50",
                                            !item.read && "bg-primary/[0.03]"
                                        )}
                                        onClick={() => handleNotificationClick(item)}
                                    >
                                        <div className="flex items-start gap-3 flex-1">
                                            <div className="flex-none">
                                                {item.avatar ? (
                                                    <Avatar className="h-9 w-9">
                                                        <AvatarImage src={item.avatar} />
                                                        <AvatarFallback>{item.title.charAt(0)}</AvatarFallback>
                                                    </Avatar>
                                                ) : (
                                                    <div className={cn(
                                                        "h-9 w-9 rounded-full flex items-center justify-center",
                                                        item.type === "order" && "bg-info/10",
                                                        item.type === "stock" && "bg-warning/10",
                                                        item.type === "return" && "bg-destructive/10",
                                                        item.type === "system" && "bg-primary/10",
                                                        item.type === "message" && "bg-success/10",
                                                    )}>
                                                        <Icon icon={typeConfig.icon} className={cn("h-4 w-4", typeConfig.color)} />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                                                <div className="text-sm text-default-700 dark:group-hover:text-default-800 font-medium truncate">
                                                    {item.title}
                                                </div>
                                                {item.customerName && (
                                                    <div className="text-xs text-default-600 dark:group-hover:text-default-700 font-medium truncate">
                                                        {item.customerName}
                                                    </div>
                                                )}
                                                <div className="text-xs text-default-500 dark:group-hover:text-default-600 font-light line-clamp-2">
                                                    {item.description}
                                                </div>
                                                {(item.trackingId || item.total) && (
                                                    <div className="text-default-400 dark:group-hover:text-default-500 text-[11px]">
                                                        {[item.trackingId, item.total ? formatAmount(item.total) : ""].filter(Boolean).join(" - ")}
                                                    </div>
                                                )}
                                                <div className="text-default-400 dark:group-hover:text-default-500 text-[11px] mt-0.5">
                                                    {formatDate(item.createdAt)}
                                                </div>
                                            </div>
                                        </div>
                                        {!item.read && (
                                            <div className="flex-0 pt-1">
                                                <span className="h-2 w-2 bg-primary rounded-full inline-block" />
                                            </div>
                                        )}
                                    </DropdownMenuItem>
                                );
                            })
                        )}
                    </ScrollArea>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

export default Notifications;

