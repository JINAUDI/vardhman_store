"use client";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { useEffect } from "react";

export default function Error({ error, reset }: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error("[protected-route-error]", error);

        try {
            const recoveryKey = "dashcode_protected_error_recovered";
            if (window.sessionStorage.getItem(recoveryKey) !== "true") {
                window.sessionStorage.setItem(recoveryKey, "true");
                [
                    "config",
                    "ecom_products",
                    "ecom_orders",
                    "ecom_customers",
                    "ecom_coupons",
                    "ecom_banners",
                    "ecom_returns",
                    "ecom_notifications",
                    "ecom_activity_logs",
                    "ecom_product_draft",
                    "ecom_product_draft_step",
                    "ecom_date_range",
                    "ecom_role_permissions",
                    "ecom_pinned_menus",
                    "ecom_recent_searches",
                ].forEach((key) => window.localStorage.removeItem(key));
                window.location.reload();
            }
        } catch (recoveryError) {
            console.warn("[protected-route-error] Recovery cleanup failed.", recoveryError);
        }
    }, [error]);

    const isDevelopment = process.env.NODE_ENV !== "production";
    const message = error?.message || "Unknown dashboard error";

    return (
        <div className="space-y-4">
            <Alert color="destructive" variant="soft">
                <Info className="h-5 w-5" />
                <AlertDescription>
                    {isDevelopment ? message : "Something went wrong!"}
                </AlertDescription>
            </Alert>
            {isDevelopment && (
                <div className="mx-4 max-w-[calc(100vw-2rem)] rounded-md border border-destructive/30 bg-black p-4 text-xs text-white">
                    <div className="font-semibold text-destructive">Dashboard runtime error</div>
                    {error?.digest && (
                        <div className="mt-2 text-default-300">Digest: {error.digest}</div>
                    )}
                    {error?.stack && (
                        <pre className="mt-3 max-h-[320px] overflow-auto whitespace-pre-wrap break-words">
                            {error.stack}
                        </pre>
                    )}
                </div>
            )}
            <Button onClick={() => reset()} color="destructive" size="sm">
                Try again
            </Button>
        </div>
    );
}

