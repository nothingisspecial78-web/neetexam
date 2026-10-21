import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
      onClick={async () => {
        await qc.cancelQueries();
        qc.clear();
        await supabase.auth.signOut();
        navigate({ to: "/auth", search: { mode: "login" }, replace: true });
      }}
    >
      <LogOut className="h-4 w-4" /> خروج
    </Button>
  );
}
