export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          reason: string | null
          report: boolean
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          reason?: string | null
          report?: boolean
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          reason?: string | null
          report?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      card_opens: {
        Row: {
          code: string | null
          created_at: string
          id: string
          kind: string
          owner_id: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          kind: string
          owner_id: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          kind?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_opens_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dandiyas: {
        Row: {
          created_at: string
          from_id: string
          kind: string
          to_id: string
        }
        Insert: {
          created_at?: string
          from_id: string
          kind: string
          to_id: string
        }
        Update: {
          created_at?: string
          from_id?: string
          kind?: string
          to_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dandiyas_from_id_fkey"
            columns: ["from_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dandiyas_to_id_fkey"
            columns: ["to_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_contacts: {
        Row: {
          code: string | null
          created_at: string
          email: string
          id: string
          name: string
          owner_id: string
          sent_at: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          email: string
          id?: string
          name: string
          owner_id: string
          sent_at?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          owner_id?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invite_contacts_code_fkey"
            columns: ["code"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "invite_contacts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          claimed_at: string | null
          claimed_by: string | null
          code: string
          created_at: string
          creator_id: string
          expires_at: string | null
          revoked: boolean
        }
        Insert: {
          claimed_at?: string | null
          claimed_by?: string | null
          code: string
          created_at?: string
          creator_id: string
          expires_at?: string | null
          revoked?: boolean
        }
        Update: {
          claimed_at?: string | null
          claimed_by?: string | null
          code?: string
          created_at?: string
          creator_id?: string
          expires_at?: string | null
          revoked?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "invites_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      launch_events: {
        Row: {
          created_at: string
          event_name: string
          id: string
          properties: Json
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: string
          properties?: Json
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: string
          properties?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          recipient_id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          recipient_id: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          recipient_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          birth_date: string | null
          visibility_audiences: string[]
          general_area: string | null
          branch: string | null
          college: string | null
          created_at: string
          discoverable: boolean
          first_name: string | null
          gender: string | null
          id: string
          incognito: boolean
          interested_in: string
          invited_by: string | null
          max_age: number
          min_age: number
          nights: Json
          onboarded: boolean
          onboarding_step: number
          photo_path: string | null
          prompt: string | null
          quiz: Json
          card_preferences: Json | null
          public_profile_enabled: boolean
          share_token: string
          show_college: boolean
          updated_at: string
          verification_reason: string | null
          verification_status: string
        }
        Insert: {
          birth_date?: string | null
          branch?: string | null
          card_preferences?: Json | null
          college?: string | null
          created_at?: string
          discoverable?: boolean
          first_name?: string | null
          gender?: string | null
          general_area?: string | null
          id: string
          incognito?: boolean
          interested_in?: string
          invited_by?: string | null
          max_age?: number
          min_age?: number
          nights?: Json
          onboarded?: boolean
          onboarding_step?: number
          photo_path?: string | null
          prompt?: string | null
          public_profile_enabled?: boolean
          quiz?: Json
          share_token?: string
          show_college?: boolean
          updated_at?: string
          verification_reason?: string | null
          verification_status?: string
          visibility_audiences?: string[]
        }
        Update: {
          birth_date?: string | null
          branch?: string | null
          card_preferences?: Json | null
          college?: string | null
          created_at?: string
          discoverable?: boolean
          first_name?: string | null
          gender?: string | null
          general_area?: string | null
          id?: string
          incognito?: boolean
          interested_in?: string
          invited_by?: string | null
          max_age?: number
          min_age?: number
          nights?: Json
          onboarded?: boolean
          onboarding_step?: number
          photo_path?: string | null
          prompt?: string | null
          public_profile_enabled?: boolean
          quiz?: Json
          share_token?: string
          show_college?: boolean
          updated_at?: string
          verification_reason?: string | null
          verification_status?: string
          visibility_audiences?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_links: {
        Row: {
          created_at: string
          handle: string
          id: string
          is_enabled: boolean
          platform: string
          profile_url: string
          updated_at: string
          user_id: string
          visibility: "private" | "share_card" | "matched"
        }
        Insert: {
          created_at?: string
          handle: string
          id?: string
          is_enabled?: boolean
          platform: string
          profile_url: string
          updated_at?: string
          user_id: string
          visibility?: "private" | "share_card" | "matched"
        }
        Update: {
          created_at?: string
          handle?: string
          id?: string
          is_enabled?: boolean
          platform?: string
          profile_url?: string
          updated_at?: string
          user_id?: string
          visibility?: "private" | "share_card" | "matched"
        }
        Relationships: [
          {
            foreignKeyName: "social_links_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      floor_ratio: {
        Args: Record<PropertyKey, never>
        Returns: {
          men: number
          women: number
          total: number
        }
      }
      get_public_profile: {
        Args: { token: string }
        Returns: Json
      }
      get_matched_socials: {
        Args: { target_user_id: string }
        Returns: Json
      }
      regenerate_share_token: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      discover_diagnostics: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      track_launch_event: {
        Args: { event_name: string; properties?: Json }
        Returns: undefined
      }
      get_launch_analytics: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      discover_feed: {
        Args: never
        Returns: {
          age: number
          branch: string
          college: string
          first_name: string
          id: string
          nights: Json
          photo_path: string
          prompt: string
          quiz: Json
        }[]
      }
      is_match: { Args: { a: string; b: string }; Returns: boolean }
      log_card_open: {
        Args: { _code?: string; _kind: string; _ref?: string }
        Returns: undefined
      }
      my_card_stats: {
        Args: never
        Returns: {
          dandiyas: number
          matches: number
          passes: number
          seen: number
          sent: number
        }[]
      }
      my_invites: {
        Args: never
        Returns: {
          claimed_at: string
          code: string
          created_at: string
          expires_at: string
          friend_name: string
          friend_onboarded: boolean
          friend_status: string
          revoked: boolean
        }[]
      }
      my_likers: {
        Args: never
        Returns: {
          age: number
          college: string
          first_name: string
          id: string
          photo_path: string
        }[]
      }
      my_matches: {
        Args: never
        Returns: {
          age: number
          college: string
          first_name: string
          id: string
          last_at: string
          last_message: string
          nights: Json
          photo_path: string
          prompt: string
        }[]
      }
      my_share_stats: {
        Args: never
        Returns: {
          invite_finished: number
          invite_joins: number
          invite_opens: number
          story_joins: number
          story_opens: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
