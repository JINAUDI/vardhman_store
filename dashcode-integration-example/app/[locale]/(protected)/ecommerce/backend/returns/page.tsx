"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { CheckCircle, XCircle, RotateCcw, DollarSign, LoaderCircle } from "lucide-react";
import { formatINR } from "@/lib/utils/currency";
import { toast } from "sonner";

type ReturnStatus = "requested" | "approved" | "rejected" | "received" | "refunded";

type ReturnRequestRow = {
  id: string;
  orderId: string;
  authUserId?: string;
  customerName: string;
  customerEmail?: string;
  orderNumber: string;
  reason: string;
  status: ReturnStatus;
  adminNote?: string;
  refundAmount: number;
  createdAt?: string;
  updatedAt?: string;
};

const statusColors: Record<string, string> = {
  requested: "bg-warning/10 text-warning",
  approved: "bg-info/10 text-info",
  rejected: "bg-destructive/10 text-destructive",
  received: "bg-primary/10 text-primary",
  refunded: "bg-success/10 text-success",
};

function getApiMessage(payload: unknown, fallback: string) {
  return typeof payload === "object" && payload && "message" in payload
    ? String((payload as { message?: unknown }).message || fallback)
    : fallback;
}

const ReturnsPage = () => {
  const [returns, setReturns] = useState<ReturnRequestRow[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState("");
  const [loadError, setLoadError] = useState("");

  async function loadReturns() {
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch("/api/returns", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !Array.isArray(payload.data)) {
        throw new Error(getApiMessage(payload, "Unable to fetch return requests."));
      }
      setReturns(payload.data as ReturnRequestRow[]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load return requests.";
      setLoadError(message);
      toast.error("Unable to load returns");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReturns();
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return returns;
    return returns.filter((row) => row.status === filter);
  }, [returns, filter]);

  const counts = useMemo(() => ({
    all: returns.length,
    requested: returns.filter((row) => row.status === "requested").length,
    approved: returns.filter((row) => row.status === "approved").length,
    received: returns.filter((row) => row.status === "received").length,
    refunded: returns.filter((row) => row.status === "refunded").length,
    rejected: returns.filter((row) => row.status === "rejected").length,
  }), [returns]);

  async function handleStatusChange(returnId: string, nextStatus: ReturnStatus) {
    const note = nextStatus === "rejected"
      ? window.prompt("Reason for rejecting this return", "Return request rejected") || "Return request rejected"
      : nextStatus === "refunded"
        ? "Refund processed by dashboard"
        : `Return request ${nextStatus}`;

    setUpdatingId(returnId);
    try {
      const response = await fetch(`/api/returns/${returnId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, adminNote: note }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(getApiMessage(payload, "Unable to update return request."));
      }
      toast.success("Return request updated");
      await loadReturns();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update return request");
    } finally {
      setUpdatingId("");
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold text-default-900">Returns & Refunds</h2>
        <p className="text-sm text-default-500 mt-1">Manage Supabase customer return requests and notify customers</p>
        {loadError ? <p className="text-xs text-destructive mt-1">{loadError}</p> : null}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { key: "requested", label: "Pending", count: counts.requested, icon: <RotateCcw className="h-4 w-4 text-warning" />, bg: "bg-warning/10" },
          { key: "approved", label: "Approved", count: counts.approved, icon: <CheckCircle className="h-4 w-4 text-info" />, bg: "bg-info/10" },
          { key: "refunded", label: "Refunded", count: counts.refunded, icon: <DollarSign className="h-4 w-4 text-success" />, bg: "bg-success/10" },
          { key: "rejected", label: "Rejected", count: counts.rejected, icon: <XCircle className="h-4 w-4 text-destructive" />, bg: "bg-destructive/10" },
        ].map((item) => (
          <Card key={item.key} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter(item.key)}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className={cn("h-9 w-9 rounded-full flex items-center justify-center", item.bg)}>{item.icon}</div>
              <div>
                <p className="text-xs text-default-400">{item.label}</p>
                <p className="text-lg font-semibold">{item.count}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-1 flex-wrap">
        {["all", "requested", "approved", "received", "refunded", "rejected"].map((item) => (
          <Button key={item} size="sm" variant={filter === item ? "default" : "outline"} onClick={() => setFilter(item)} className="capitalize text-xs">
            {item} ({counts[item as keyof typeof counts] || 0})
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="px-0 pt-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-default-200">
                <TableHead>Return ID</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Refund Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-default-400">
                    <LoaderCircle className="h-6 w-6 mx-auto mb-2 animate-spin" />
                    Loading return requests...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-default-400">
                    <Icon icon="heroicons:arrow-uturn-left" className="h-10 w-10 mx-auto mb-2" />
                    <p>No return requests</p>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((ret) => (
                  <TableRow key={ret.id} className="h-[60px]">
                    <TableCell className="text-sm font-medium text-default-700">{ret.id.slice(0, 8).toUpperCase()}</TableCell>
                    <TableCell className="text-sm text-primary">{ret.orderNumber || ret.orderId}</TableCell>
                    <TableCell>
                      <p className="text-sm text-default-700">{ret.customerName}</p>
                      <p className="text-xs text-default-400">{ret.customerEmail || "No email"}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-default-600 max-w-[220px] truncate">{ret.reason}</p>
                      {ret.adminNote ? <p className="text-xs text-default-400 max-w-[220px] truncate">{ret.adminNote}</p> : null}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">{formatINR(ret.refundAmount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell>
                      <Badge className={cn("text-[11px] capitalize rounded-full px-2.5", statusColors[ret.status])}>
                        {ret.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {ret.status === "requested" && (
                          <>
                            <Button size="icon" variant="ghost" disabled={updatingId === ret.id} className="h-7 w-7 text-success hover:bg-success/10" onClick={() => handleStatusChange(ret.id, "approved")} title="Approve">
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" disabled={updatingId === ret.id} className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => handleStatusChange(ret.id, "rejected")} title="Reject">
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {ret.status === "approved" && (
                          <Button size="sm" variant="outline" disabled={updatingId === ret.id} className="h-7 text-xs" onClick={() => handleStatusChange(ret.id, "received")}>Mark Received</Button>
                        )}
                        {ret.status === "received" && (
                          <Button size="sm" disabled={updatingId === ret.id} className="h-7 text-xs gap-1 bg-success hover:bg-success/90 text-white" onClick={() => handleStatusChange(ret.id, "refunded")}>
                            <DollarSign className="h-3 w-3" /> Process Refund
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReturnsPage;