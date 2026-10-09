import { supabase } from "@/integrations/supabase/client";

export type SocialPlatform = "instagram" | "snapchat" | "youtube" | "x" | "linkedin" | "custom";

export type SocialLinkRow = {
  id: string;
  user_id: string;
  platform: SocialPlatform;
  handle: string;
  profile_url: string;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export const SOCIAL_PLATFORMS: {
  key: SocialPlatform;
  name: string;
  placeholder: string;
  baseUrl: string;
  color: string;
  description: string;
}[] = [
  {
    key: "instagram",
    name: "Instagram",
    placeholder: "@username or profile link",
    baseUrl: "https://instagram.com/",
    color: "#E1306C",
    description: "Your public Instagram handle for clashes and story tags",
  },
  {
    key: "snapchat",
    name: "Snapchat",
    placeholder: "username",
    baseUrl: "https://snapchat.com/add/",
    color: "#FFFC00",
    description: "Add on Snap for festival night moments",
  },
  {
    key: "x",
    name: "X (Twitter)",
    placeholder: "@handle",
    baseUrl: "https://x.com/",
    color: "#1DA1F2",
    description: "Your X / Twitter profile handle",
  },
  {
    key: "linkedin",
    name: "LinkedIn",
    placeholder: "linkedin.com/in/username",
    baseUrl: "https://linkedin.com/in/",
    color: "#0A66C2",
    description: "Professional profile for campus & alumni networking",
  },
  {
    key: "youtube",
    name: "YouTube",
    placeholder: "@channel or youtube.com/@...",
    baseUrl: "https://youtube.com/@",
    color: "#FF0000",
    description: "Your YouTube channel or Garba choreography portfolio",
  },
  {
    key: "custom",
    name: "Custom Link",
    placeholder: "https://yourwebsite.com",
    baseUrl: "",
    color: "#E8963C",
    description: "Portfolio, blog, Linktree or personal project",
  },
];

export function validateAndNormalizeSocial(
  platform: SocialPlatform,
  rawInput: string
): { valid: boolean; error?: string; handle: string; url: string } {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { valid: false, error: "Please enter a username or link", handle: "", url: "" };
  }

  // Reject unsafe schemes
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) {
    return { valid: false, error: "Only safe HTTP or HTTPS links are permitted", handle: "", url: "" };
  }

  if (platform === "custom") {
    let urlStr = trimmed;
    if (!/^https?:\/\//i.test(urlStr)) {
      urlStr = "https://" + urlStr;
    }
    try {
      const parsed = new URL(urlStr);
      if (!parsed.hostname || !parsed.hostname.includes(".")) {
        return { valid: false, error: "Enter a valid website address (e.g. yoursite.com)", handle: "", url: "" };
      }
      return {
        valid: true,
        handle: parsed.hostname.replace(/^www\./, "") + (parsed.pathname.length > 1 ? parsed.pathname : ""),
        url: parsed.href,
      };
    } catch {
      return { valid: false, error: "Enter a valid website address", handle: "", url: "" };
    }
  }

  // Handle username or full URL for social networks
  let clean = trimmed;

  // Remove trailing slashes or URL query fragments
  clean = clean.split("?")[0]!.split("#")[0]!;
  clean = clean.replace(/\/+$/, "");

  // Strip protocol and domain if user pasted full URL
  const domainPatterns: Record<Exclude<SocialPlatform, "custom">, RegExp> = {
    instagram: /^(?:https?:\/\/)?(?:www\.)?instagram\.com\//i,
    snapchat: /^(?:https?:\/\/)?(?:www\.)?snapchat\.com\/(?:add\/)?/i,
    x: /^(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\//i,
    linkedin: /^(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:in\/)?/i,
    youtube: /^(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:@|c\/|user\/)?/i,
  };

  clean = clean.replace(domainPatterns[platform], "");

  // Strip leading @ or /
  clean = clean.replace(/^[@/]+/, "").trim();

  // For LinkedIn, also strip leading 'in/' if entered as 'in/username'
  if (platform === "linkedin") {
    clean = clean.replace(/^in\//i, "");
  }

  if (!clean) {
    return { valid: false, error: "Please enter a valid username", handle: "", url: "" };
  }

  // Validation per platform
  if (platform === "instagram" && !/^[a-zA-Z0-9._]{1,30}$/.test(clean)) {
    return { valid: false, error: "Instagram usernames can only contain letters, numbers, periods, and underscores (max 30 chars)", handle: "", url: "" };
  }
  if (platform === "snapchat" && !/^[a-zA-Z0-9._-]{3,30}$/.test(clean)) {
    return { valid: false, error: "Snapchat usernames can only contain letters, numbers, hyphens, and periods (3-30 chars)", handle: "", url: "" };
  }
  if (platform === "x" && !/^[a-zA-Z0-9_]{1,15}$/.test(clean)) {
    return { valid: false, error: "X handles can only contain letters, numbers, and underscores (max 15 chars)", handle: "", url: "" };
  }

  const meta = SOCIAL_PLATFORMS.find((p) => p.key === platform)!;
  const canonicalUrl = meta.baseUrl + clean;

  return {
    valid: true,
    handle: clean,
    url: canonicalUrl,
  };
}

/** Fetch user's own social links */
export async function getMySocialLinks(userId?: string): Promise<SocialLinkRow[]> {
  let targetId = userId;
  if (!targetId) {
    const { data: u } = await supabase.auth.getUser();
    targetId = u?.user?.id;
  }
  if (!targetId) return [];

  const { data, error } = await supabase
    .from("social_links")
    .select("*")
    .eq("user_id", targetId)
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("Could not load social links:", error);
    return [];
  }
  return (data ?? []) as SocialLinkRow[];
}

/** Save or update a social link */
export async function upsertSocialLink(
  userId: string,
  platform: SocialPlatform,
  handle: string,
  profileUrl: string,
  isEnabled = true
): Promise<{ ok: boolean; error?: string; row?: SocialLinkRow }> {
  const { data, error } = await supabase
    .from("social_links")
    .upsert(
      {
        user_id: userId,
        platform,
        handle,
        profile_url: profileUrl,
        is_enabled: isEnabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id, platform" }
    )
    .select()
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, row: data as SocialLinkRow };
}

/** Toggle social link visibility */
export async function toggleSocialLinkEnabled(
  id: string,
  userId: string,
  isEnabled: boolean
): Promise<boolean> {
  const { error } = await supabase
    .from("social_links")
    .update({ is_enabled: isEnabled, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);

  return !error;
}

/** Delete social link */
export async function deleteSocialLink(id: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from("social_links")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  return !error;
}
