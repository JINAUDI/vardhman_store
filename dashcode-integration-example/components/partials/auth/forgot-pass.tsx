"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useForm, SubmitHandler } from "react-hook-form";

type Inputs = {
  email: string;
};

const ForgotPass = () => {
  const [isPending, startTransition] = React.useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Inputs>({
    defaultValues: {
      email: "",
    },
  });

  const onSubmit: SubmitHandler<Inputs> = (data) => {
    startTransition(async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const locale = window.location.pathname.split("/").filter(Boolean)[0] || "en";
        const { error } = await supabase.auth.resetPasswordForEmail(
          data.email.trim().toLowerCase(),
          { redirectTo: `${window.location.origin}/${locale}/auth/login` }
        );

        if (error) throw error;
        toast.success("Password recovery email sent.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to send recovery email.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 ">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          {...register("email", { required: "Email is required" })}
          className="h-[48px] text-sm text-default-900 "
          disabled={isPending}
        />
        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
      </div>

      <Button type="submit" fullWidth disabled={isPending}>
        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isPending ? "Sending..." : "Send recovery email"}
      </Button>
    </form>
  );
};

export default ForgotPass;