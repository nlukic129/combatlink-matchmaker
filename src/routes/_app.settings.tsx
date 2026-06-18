import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { matchmaker } = useAuth();
  const navigate = useNavigate();

  const displayName =
    [matchmaker?.first_name, matchmaker?.last_name].filter(Boolean).join(" ") || "—";

  const [emailNotifications, setEmailNotifications] = useState(true);
  const [savingNotifications, setSavingNotifications] = useState(false);

  useEffect(() => {
    if (matchmaker) {
      setEmailNotifications(matchmaker.email_notifications_enabled ?? true);
    }
  }, [matchmaker]);

  async function toggleEmailNotifications(enabled: boolean) {
    const previous = emailNotifications;
    setEmailNotifications(enabled);
    setSavingNotifications(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setEmailNotifications(previous);
      setSavingNotifications(false);
      return;
    }

    const { error } = await supabase
      .from("matchmakers")
      .update({ email_notifications_enabled: enabled })
      .eq("id", session.user.id);

    setSavingNotifications(false);

    if (error) {
      setEmailNotifications(previous);
      toast.error("Failed to update notification preference");
      return;
    }

    toast.success(enabled ? "Email notifications enabled" : "Email notifications disabled");
  }

  async function signOut() {
    await supabase.auth.signOut();
    await navigate({ to: "/login" });
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 sm:px-6">
      <PageHeader
        title="Settings"
        description="Manage your account security and notification preferences."
      />

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>
              Your name and organization are set by CombatLink staff at registration.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ReadOnlyField label="Name" value={displayName} />
            <ReadOnlyField label="Organization" value={matchmaker?.organization || "—"} />
            <ReadOnlyField label="Email" value={matchmaker?.email ?? "—"} />
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

        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>
              In-app alerts always appear in your notification inbox.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium text-foreground">Email notifications</p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Get availability alerts, purse change updates, and video access approvals by email.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 pt-0.5">
                {savingNotifications && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
                <Switch
                  checked={emailNotifications}
                  onCheckedChange={toggleEmailNotifications}
                  disabled={savingNotifications || !matchmaker}
                  aria-label="Email notifications"
                />
              </div>
            </div>
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

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 text-sm text-foreground">
        {value}
      </p>
    </div>
  );
}
