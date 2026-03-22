"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { getMe, login as loginFn, logout as logoutFn, type User } from "@/lib/auth";

export function useAuth() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["auth", "me"],
    queryFn: getMe,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const login = useCallback(
    async (email: string, password: string) => {
      const user = await loginFn(email, password);
      queryClient.setQueryData(["auth", "me"], user);
      if (user.must_change_password) {
        router.push("/change-password");
      } else {
        router.push("/dashboard");
      }
      return user;
    },
    [queryClient, router],
  );

  const logout = useCallback(() => {
    queryClient.clear();
    logoutFn();
  }, [queryClient]);

  return { user, isLoading, login, logout };
}
