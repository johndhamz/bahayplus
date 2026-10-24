"use client";

import { ErrorState } from "@bahayplus/ui/components/feedback/error-state";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorState reference={error.digest} onRetry={retry} />;
}
