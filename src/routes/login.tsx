import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isGuestReady, useRedirectIfAuthenticated } from "@/hooks/use-auth-redirects";
import { RouterPending } from "@/components/router-fallbacks";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { ParticleNetwork } from "@/components/auth/particle-network";

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
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background">
      {/* Particle canvas */}
      <ParticleNetwork />

      {/* Radial vignette behind the form */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            "radial-gradient(ellipse 55% 65% at 50% 50%, transparent 0%, oklch(0.09 0.012 270 / 85%) 60%, oklch(0.09 0.012 270) 100%)",
        }}
      />

      {/* Content */}
      <div className="relative z-20 flex w-full max-w-[420px] flex-col items-center gap-8 px-4 py-12">
        {/* Logo */}
        <Logo size="lg" variant="brand" />

        {/* Tagline */}
        <div className="text-center space-y-2">
          <h1 className="font-display text-4xl leading-none tracking-wide text-foreground">
            FIND YOUR NEXT FIGHT
          </h1>
          <p className="text-sm text-muted-foreground">
            Search and connect with verified fighters worldwide
          </p>
        </div>

        {/* Glassmorphism form */}
        <div
          className="w-full rounded-2xl border p-8"
          style={{
            background: "oklch(1 0 0 / 4%)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            borderColor: "oklch(1 0 0 / 10%)",
            boxShadow:
              "0 8px 32px oklch(0 0 0 / 50%), 0 0 0 1px oklch(1 0 0 / 6%), inset 0 1px 0 oklch(1 0 0 / 8%)",
          }}
        >
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-foreground">Welcome back</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Sign in to your matchmaker account</p>
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
        </div>

        <p className="text-xs text-muted-foreground/50">
          © {new Date().getFullYear()} CombatLink
        </p>
      </div>
    </div>
  );
}
