"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Old manual entry page — redirects to unified /transactions/new.
 */
export default function ManualRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/transactions/new");
  }, [router]);
  return null;
}
