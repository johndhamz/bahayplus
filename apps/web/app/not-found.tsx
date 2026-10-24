import Link from "next/link";
import { SearchX } from "lucide-react";
import { EmptyState } from "@bahayplus/ui/components/feedback/empty-state";
import { Button } from "@bahayplus/ui/components/ui/button";

export default function NotFound() {
  return (
    <main id="main-content" className="mx-auto flex min-h-dvh max-w-md items-center px-4">
      <EmptyState
        icon={SearchX}
        titleAs="h1"
        title="Page not found"
        description="The page you're looking for doesn't exist, or you don't have access to it."
        action={
          <Button asChild>
            <Link href="/">Go home</Link>
          </Button>
        }
        className="w-full"
      />
    </main>
  );
}
