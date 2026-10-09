import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export const INVITE_ALLOWANCE = 5;

export interface InviteItem {
  code: string;
  revoked: boolean;
  expires_at: string | null;
  created_at: string;
  claimed_at: string | null;
  friend_name: string | null;
  friend_onboarded: boolean;
  friend_status: string | null;
}

export interface AuthoritativeInvitesData {
  primaryCode: string | null;
  availableCount: number;
  claimedCount: number;
  totalAllocation: number;
  invites: InviteItem[];
}

export interface AuthoritativeInvitesState extends AuthoritativeInvitesData {
  status: "idle" | "loading" | "success" | "error";
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Single source of truth for user invites.
 * Uses the Postgres transactional RPC `ensure_my_invites()` so invitation
 * generation, counts, and primary code are consistent across all screens.
 */
export function useAuthoritativeInvites(autoFetch = true): AuthoritativeInvitesState {
  const [data, setData] = useState<AuthoritativeInvitesData>({
    primaryCode: null,
    availableCount: 0,
    claimedCount: 0,
    totalAllocation: 5,
    invites: [],
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(autoFetch ? "loading" : "idle");
  const [error, setError] = useState<string | null>(null);

  const fetchInvites = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc("ensure_my_invites");

      if (rpcErr) {
        // Fallback to my_invites if ensure_my_invites is not accessible
        const { data: list, error: listErr } = await supabase.rpc("my_invites");
        if (listErr) throw listErr;

        const rawList = (list ?? []) as any[];
        const available = rawList.filter(
          (i) => !i.claimed_at && !i.revoked && (!i.expires_at || new Date(i.expires_at) > new Date())
        );
        const claimed = rawList.filter((i) => i.claimed_at);
        const primary = available[0]?.code ?? null;

        setData({
          primaryCode: primary,
          availableCount: available.length,
          claimedCount: claimed.length,
          totalAllocation: 5,
          invites: rawList.map((i) => ({
            code: i.code,
            revoked: i.revoked,
            expires_at: i.expires_at,
            created_at: i.created_at,
            claimed_at: i.claimed_at,
            friend_name: i.friend_name,
            friend_onboarded: !!i.friend_onboarded,
            friend_status: i.friend_status,
          })),
        });
        setStatus("success");
        return;
      }

      const res = rpcRes as any;
      if (!res?.ok) {
        throw new Error(res?.reason || "Failed to fetch invitation details");
      }

      setData({
        primaryCode: res.primary_code ?? null,
        availableCount: typeof res.available_count === "number" ? res.available_count : 0,
        claimedCount: typeof res.claimed_count === "number" ? res.claimed_count : 0,
        totalAllocation: typeof res.total_allocation === "number" ? res.total_allocation : 5,
        invites: Array.isArray(res.invites) ? res.invites : [],
      });
      setStatus("success");
    } catch (err: any) {
      console.error("[Invites] fetch error:", err);
      setError(err?.message || "Could not load invite link");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (autoFetch) {
      fetchInvites();
    }
  }, [autoFetch, fetchInvites]);

  return {
    ...data,
    status,
    error,
    refresh: fetchInvites,
  };
}
