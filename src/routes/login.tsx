import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isGuestReady, useRedirectIfAuthenticated } from "@/hooks/use-auth-redirects";
import { RouterPending } from "@/components/router-fallbacks";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

function LoginPage() {
  const auth = useRedirectIfAuthenticated();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  if (!isGuestReady(auth)) {
    return <RouterPending variant="full" />;
  }

  async function onSubmit(values: FormValues) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (error) {
      toast.error("Invalid email or password");
      return;
    }

    const { data: mm } = await supabase
      .from("matchmakers")
      .select("must_change_password")
      .eq("id", data.user.id)
      .single();

    if (!mm) {
      toast.error("Account not authorised. Contact CombatLink.");
      await supabase.auth.signOut();
      return;
    }

    await navigate({ to: mm.must_change_password ? "/change-password" : "/search/setup" });
  }

  return (
    <div className="flex min-h-dvh auth-gradient">
      {/* Left branding panel — desktop only */}
      <div className="hidden lg:flex lg:w-1/2 lg:flex-col lg:justify-between lg:p-12">
        <Logo size="md" className="items-start!" />
        <div className="max-w-md space-y-6">
          <h1 className="font-display text-5xl leading-none tracking-wide text-foreground">
            FIND YOUR NEXT FIGHT
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Search and connect with Identity Verified fighters across MMA, Boxing, and Kickboxing.
          </p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="h-4 w-4 text-available" />
            <span>Verified fighter database</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground/60">
          © {new Date().getFullYear()} CombatLink
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 lg:hidden">
            <Logo size="lg" subtitle="Matchmaker Portal" />
          </div>

          <Card className="border-border/60 shadow-[var(--shadow-elevated)]">
            <CardContent className="p-8 pt-8">
              <div className="mb-6 hidden lg:block">
                <h2 className="text-xl font-semibold text-foreground">Welcome back</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Sign in to your matchmaker account
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <Field label="Email" htmlFor="email" error={errors.email?.message}>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    error={!!errors.email}
                    {...register("email")}
                  />
                </Field>

                <Field label="Password" htmlFor="password" error={errors.password?.message}>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="••••••••"
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

                <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Signing in…
                    </>
                  ) : (
                    "Sign in"
                  )}
                </Button>

                <p className="text-center text-xs text-muted-foreground">
                  Forgot your password?{" "}
                  <a
                    href="mailto:support@combatlink.com"
                    className="font-medium text-primary hover:underline"
                  >
                    Contact support
                  </a>
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
