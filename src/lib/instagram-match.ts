import { supabase } from "@/integrations/supabase/client";
import {
  validateAndNormalizeSocial,
  upsertSocialLink,
  deleteSocialLink,
  getMySocialLinks,
  type SocialLinkRow,
} from "@/lib/social-links";
import { toast } from "sonner";

export type InstagramExchangeState = {
  isMatch: boolean;
  myConsent: boolean;
  partnerConsent: boolean;
  bothConsented: boolean;
  partnerHandle: string | null;
  partnerUrl: string | null;
  myHandle: string | null;
  myUrl: string | null;
};

/** Get the current mutual Instagram exchange and consent state for a match */
export async function getMatchInstagramStatus(
  partnerId: string
): Promise<InstagramExchangeState> {
  const { data, error } = await supabase.rpc("get_match_social_exchange", {
    _target_user_id: partnerId,
    _platform: "instagram",
  });

  if (error || !data) {
    return {
      isMatch: false,
      myConsent: false,
      partnerConsent: false,
      bothConsented: false,
      partnerHandle: null,
      partnerUrl: null,
      myHandle: null,
      myUrl: null,
    };
  }

  const res = data as any;
  return {
    isMatch: Boolean(res.is_match),
    myConsent: Boolean(res.my_consent),
    partnerConsent: Boolean(res.partner_consent),
    bothConsented: Boolean(res.both_consented),
    partnerHandle: res.partner_handle || null,
    partnerUrl: res.partner_url || null,
    myHandle: res.my_handle || null,
    myUrl: res.my_url || null,
  };
}

/** Record or revoke explicit consent to share Instagram handle with a specific match */
export async function setMatchInstagramConsent(
  partnerId: string,
  consent: boolean
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc("set_match_social_consent", {
    _target_user_id: partnerId,
    _platform: "instagram",
    _consent: consent,
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Safely copy Instagram handle to clipboard with user feedback */
export async function copyInstagramHandle(rawHandle: string): Promise<boolean> {
  const clean = rawHandle.replace(/^@+/, "").trim();
  if (!clean) return false;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(`@${clean}`);
    } else {
      // Fallback for non-secure contexts / webview edge cases
      const textArea = document.createElement("textarea");
      textArea.value = `@${clean}`;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    }
    toast.success(`Copied @${clean} to clipboard!`);
    return true;
  } catch (err) {
    console.warn("[Instagram] Copy failed:", err);
    toast.error("Could not copy handle to clipboard");
    return false;
  }
}

/** Formulate valid canonical Instagram profile URL */
export function getInstagramProfileUrl(rawHandle?: string | null): string | null {
  if (!rawHandle) return null;
  const clean = rawHandle.replace(/^@+/, "").trim();
  if (!clean || !/^[a-zA-Z0-9._]{1,30}$/.test(clean)) return null;
  return `https://instagram.com/${clean}`;
}

/** Open Instagram profile in browser or native app safely */
export function openInstagramProfile(rawHandle: string): boolean {
  const url = getInstagramProfileUrl(rawHandle);
  if (!url) {
    toast.error("No valid Instagram handle found");
    return false;
  }
  // Standard https://instagram.com link opens native Instagram via Universal Links
  // on iOS/Android if installed, or smoothly opens in web browser if not installed.
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}

/** Save or update user's own Instagram handle */
export async function saveUserInstagramHandle(
  userId: string,
  handleInput: string
): Promise<{ ok: boolean; error?: string; handle?: string }> {
  const { valid, error, handle, url } = validateAndNormalizeSocial("instagram", handleInput);
  if (!valid) {
    return { ok: false, error: error || "Invalid Instagram handle" };
  }

  const res = await upsertSocialLink(
    userId,
    "instagram",
    handle,
    url,
    true,
    "matched" // Make visible to mutual match consent system
  );

  if (!res.ok) {
    return { ok: false, error: res.error || "Failed to save Instagram handle" };
  }
  return { ok: true, handle };
}

/** Remove user's Instagram handle */
export async function removeUserInstagramHandle(
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const existing = await getMySocialLinks(userId);
  const insta = existing.find((l) => l.platform === "instagram");
  if (!insta) return { ok: true };

  const ok = await deleteSocialLink(insta.id, userId);
  return ok ? { ok: true } : { ok: false, error: "Failed to remove Instagram handle" };
}
