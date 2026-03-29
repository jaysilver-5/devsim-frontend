// hooks/use-api.ts
"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback } from "react";

export function useApiToken() {
  const { getToken } = useAuth();

  const getApiToken = useCallback(async () => {
    const token = await getToken();
    if (!token) throw new Error("Not authenticated");
    return token;
  }, [getToken]);

  return { getApiToken };
}