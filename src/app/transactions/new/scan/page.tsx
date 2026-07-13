"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Old scan page — redirects to unified /transactions/new.
 */
export default function ScanRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/transactions/new");
  }, [router]);
  return null;
}
