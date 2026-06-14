import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

const profileSchema = z.object({
  first_name: z.string().min(1, "Required"),
  last_name: z.string().optional(),
  organization: z.string().optional(),
});

type ProfileValues = z.infer<typeof profileSchema>;

function SettingsPage() {
  const { matchmaker } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: matchmaker?.first_name ?? "",
      last_name: matchmaker?.last_name ?? "",
      organization: matchmaker?.organization ?? "",
    },
  });

  async function onSubmit(values: ProfileValues) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase
      .from("matchmakers")
      .update(values)
      .eq("id", session.user.id);

    if (error) {
      toast.error("Failed to update profile");
      return;
    }
    toast.success("Profile updated");
  }

  async function signOut() {
    await supabase.auth.signOut();
    await navigate({ to: "/login" });
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 sm:px-6">
      <PageHeader
        title="Settings"
        description="Manage your matchmaker profile and account."
      />

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Your public matchmaker information.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="First name" error={errors.first_name?.message}>
                  <Input
                    {...register("first_name")}
                    error={!!errors.first_name}
                    autoComplete="given-name"
                  />
                </Field>
                <Field label="Last name" error={errors.last_name?.message}>
                  <Input
                    {...register("last_name")}
                    error={!!errors.last_name}
                    autoComplete="family-name"
                  />
                </Field>
              </div>
              <Field label="Organization" error={errors.organization?.message}>
                <Input
                  {...register("organization")}
                  error={!!errors.organization}
                  autoComplete="organization"
                />
              </Field>

              <p className="text-sm text-muted-foreground">
                Email:{" "}
                <span className="font-medium text-foreground">{matchmaker?.email ?? "—"}</span>
              </p>

              <Button type="submit" disabled={isSubmitting || !isDirty}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Password</CardTitle>
            <CardDescription>Change your account password.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" asChild>
              <Link to="/change-password">Change password</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle>Sign out</CardTitle>
            <CardDescription>Sign out of your account on this device.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={signOut}>
              Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
