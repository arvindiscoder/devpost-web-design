"use client";

import { Toaster } from "sonner";

/**
 * Global toast host. Mounted once in the root layout.
 * Client components import `toast` directly from "sonner".
 */
export function ToasterProvider() {
  return (
    <Toaster
      position="bottom-right"
      richColors
      closeButton
      toastOptions={{ duration: 4500 }}
    />
  );
}
