import { Brain } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GoogleSignInButton } from "@/components/google-sign-in-button";

const ERROR_MESSAGES: Record<string, string> = {
  unauthorized:
    "That Google account isn't on the team allowlist. Try a different account, or ask a teammate to add you to ALLOWED_EMAILS.",
  auth: "Something went wrong signing you in. Please try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage = error ? (ERROR_MESSAGES[error] ?? ERROR_MESSAGES.auth) : null;

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Brain className="size-6" />
          </div>
          <CardTitle className="text-xl">Sandbox Brain</CardTitle>
          <CardDescription>
            The team&apos;s central hub — time, prompts, notes, and knowledge.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {errorMessage && (
            <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {errorMessage}
            </p>
          )}
          <GoogleSignInButton />
          <p className="text-center text-xs text-muted-foreground">
            Access is limited to team members.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
