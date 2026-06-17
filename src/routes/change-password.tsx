import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isAuthenticatedUserReady, useRequireAuthenticatedUser } from "@/hooks/use-auth-redirects";
import { RouterPending } from "@/components/router-fallbacks";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/change-password")({
  validateSearch: z.object({ first: z.string().optional() }),
  component: ChangePasswordPage,
});

const schema = z
  .object({
    password: z
      .string()
      .min(8, "Minimum 8 characters")
      .regex(/[A-Z]/, "Must contain an uppercase letter")
      .regex(/[0-9]/, "Must contain a number"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

type FormValues = z.infer<typeof schema>;

function ChangePasswordPage() {
  const auth = useRequireAuthenticatedUser();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const { first } = Route.useSearch();
  const isFirstLogin = first === "true";
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  if (!isAuthenticatedUserReady(auth)) {
    return <RouterPending variant="full" />;
  }

  async function onSubmit(values: FormValues) {
    const { error: updateError } = await supabase.auth.updateUser({
      password: values.password,
    });

    if (updateError) {
      toast.error("Failed to update password. Try again.");
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await supabase
        .from("matchmakers")
        .update({ must_change_password: false })
        .eq("id", session.user.id);
    }

    toast.success("Password updated successfully");
    await navigate({ to: "/search/setup" });
  }

  return (
    <div className="flex min-h-dvh items-center justify-center auth-gradient px-4 py-12">
      <div className="w-full max-w-[400px]">
        <div className="mb-8">
          <Logo
            size="lg"
            subtitle={isFirstLogin ? "Set your password to continue" : "Change your password"}
          />
        </div>

        {isFirstLogin && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-sm text-foreground">
              You must set a new password before accessing the matchmaker portal.
            </p>
          </div>
        )}

        <Card className="border-border/60 shadow-[var(--shadow-elevated)]">
          <CardContent className="p-8 pt-8">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <Field
                label="New password"
                htmlFor="password"
                error={errors.password?.message}
                hint={!errors.password ? "8+ characters, one uppercase, one number" : undefined}
              >
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    error={!!errors.password}
                    className="pr-10"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>

              <Field
                label="Confirm password"
                htmlFor="confirm"
                error={errors.confirm?.message}
              >
                <Input
                  id="confirm"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  error={!!errors.confirm}
                  {...register("confirm")}
                />
              </Field>

              <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Set password"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
