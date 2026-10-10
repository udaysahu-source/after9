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
          status?: string
          moderator_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          reason?: string | null
          report?: boolean
          status?: string
          moderator_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          reason?: string | null
          report?: boolean
          status?: string
          moderator_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
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
      admin_users: {
        Row: {
          id: string
          user_id: string | null
          email: string
          role: string
          is_active: boolean
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          email: string
          role?: string
          is_active?: boolean
          created_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          email?: string
          role?: string
          is_active?: boolean
          created_at?: string
          created_by?: string | null
        }
        Relationships: []
      }
      admin_audit_logs: {
        Row: {
          id: string
          actor_id: string | null
          actor_email: string
          action: string
          target_id: string | null
          details: Json | null
          ip_address: string | null
          created_at: string
        }
        Insert: {
          id?: string
          actor_id?: string | null
          actor_email: string
          action: string
          target_id?: string | null
          details?: Json | null
          ip_address?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          actor_id?: string | null
          actor_email?: string
          action?: string
          target_id?: string | null
          details?: Json | null
          ip_address?: string | null
          created_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          id: string
          title: string
          slug: string | null
          description: string | null
          venue: string
          area: string | null
          address: string | null
          city: string
          state: string
          start_date: string | null
          end_date: string | null
          start_time: string | null
          end_time: string | null
          poster_url: string | null
          themes_count: number | null
          highlights: Json
          additional_programs: Json
          contact_unverified: Json
          contact_verified: string | null
          entry_rules: Json
          pass_categories: Json
          min_price_inr: number | null
          max_price_inr: number | null
          source_notes: string | null
          source_url: string | null
          dates: Json
          organizer: string | null
          booking_url: string | null
          ticket_price_range: string | null
          price_source: string | null
          verification_status: string
          publication_status: string
          is_active: boolean
          verified_at: string | null
          verified_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          slug?: string | null
          description?: string | null
          venue: string
          area?: string | null
          address?: string | null
          city?: string
          state?: string
          start_date?: string | null
          end_date?: string | null
          start_time?: string | null
          end_time?: string | null
          poster_url?: string | null
          themes_count?: number | null
          highlights?: Json
          additional_programs?: Json
          contact_unverified?: Json
          contact_verified?: string | null
          entry_rules?: Json
          pass_categories?: Json
          min_price_inr?: number | null
          max_price_inr?: number | null
          source_notes?: string | null
          source_url?: string | null
          dates?: Json
          organizer?: string | null
          booking_url?: string | null
          ticket_price_range?: string | null
          price_source?: string | null
          verification_status?: string
          publication_status?: string
          is_active?: boolean
          verified_at?: string | null
          verified_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          slug?: string | null
          description?: string | null
          venue?: string
          area?: string | null
          address?: string | null
          city?: string
          state?: string
          start_date?: string | null
          end_date?: string | null
          start_time?: string | null
          end_time?: string | null
          poster_url?: string | null
          themes_count?: number | null
          highlights?: Json
          additional_programs?: Json
          contact_unverified?: Json
          contact_verified?: string | null
          entry_rules?: Json
          pass_categories?: Json
          min_price_inr?: number | null
          max_price_inr?: number | null
          source_notes?: string | null
          source_url?: string | null
          dates?: Json
          organizer?: string | null
          booking_url?: string | null
          ticket_price_range?: string | null
          price_source?: string | null
          verification_status?: string
          publication_status?: string
          is_active?: boolean
          verified_at?: string | null
          verified_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      saved_events: {
        Row: {
          id: string
          user_id: string
          event_id: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          event_id: string
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          event_id?: string
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      group_plans: {
        Row: {
          id: string
          creator_id: string
          event_id: string
          plan_date: string
          proposed_time: string | null
          meeting_point: string | null
          notes: string | null
          status: string
          safety_acknowledged: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          creator_id: string
          event_id: string
          plan_date: string
          proposed_time?: string | null
          meeting_point?: string | null
          notes?: string | null
          status?: string
          safety_acknowledged?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          creator_id?: string
          event_id?: string
          plan_date?: string
          proposed_time?: string | null
          meeting_point?: string | null
          notes?: string | null
          status?: string
          safety_acknowledged?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      group_plan_participants: {
        Row: {
          id: string
          plan_id: string
          user_id: string
          status: string
          responded_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          plan_id: string
          user_id: string
          status?: string
          responded_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          plan_id?: string
          user_id?: string
          status?: string
          responded_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      event_suggestions: {
        Row: {
          id: string
          user_id: string
          name: string
          city: string
          dates: string
          venue: string
          organizer: string | null
          source_link: string | null
          poster_url: string | null
          notes: string | null
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          city?: string
          dates: string
          venue: string
          organizer?: string | null
          source_link?: string | null
          poster_url?: string | null
          notes?: string | null
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          city?: string
          dates?: string
          venue?: string
          organizer?: string | null
          source_link?: string | null
          poster_url?: string | null
          notes?: string | null
          status?: string
          created_at?: string
        }
        Relationships: []
      }
      event_attendance_interests: {
        Row: {
          id: string
          user_id: string
          event_id: string
          visibility: string
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          event_id: string
          visibility?: string
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          event_id?: string
          visibility?: string
          status?: string
          created_at?: string
        }
        Relationships: []
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
      launch_control: {
        Row: {
          created_at: string
          discover_enabled: boolean
          id: string
          last_changed_at: string
          last_changed_by: string | null
          last_changed_by_email: string | null
          readiness_target: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          discover_enabled?: boolean
          id?: string
          last_changed_at?: string
          last_changed_by?: string | null
          last_changed_by_email?: string | null
          readiness_target?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          discover_enabled?: boolean
          id?: string
          last_changed_at?: string
          last_changed_by?: string | null
          last_changed_by_email?: string | null
          readiness_target?: number
          updated_at?: string
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
          push_notifications_enabled: boolean
          share_token: string
          show_college: boolean
          updated_at: string
          verification_reason: string | null
          verification_status: string
          is_suspended?: boolean
          suspension_reason?: string | null
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
          push_notifications_enabled?: boolean
          quiz?: Json
          share_token?: string
          show_college?: boolean
          updated_at?: string
          verification_reason?: string | null
          verification_status?: string
          visibility_audiences?: string[]
          is_suspended?: boolean
          suspension_reason?: string | null
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
          push_notifications_enabled?: boolean
          quiz?: Json
          share_token?: string
          show_college?: boolean
          updated_at?: string
          verification_reason?: string | null
          verification_status?: string
          visibility_audiences?: string[]
          is_suspended?: boolean
          suspension_reason?: string | null
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
      notifications: {
        Row: {
          action_url: string
          body: string
          created_at: string
          data: Json
          id: string
          read: boolean
          source_id: string | null
          title: string
          type: "like" | "match" | "message" | "system"
          user_id: string
        }
        Insert: {
          action_url?: string
          body: string
          created_at?: string
          data?: Json
          id?: string
          read?: boolean
          source_id?: string | null
          title: string
          type: "like" | "match" | "message" | "system"
          user_id: string
        }
        Update: {
          action_url?: string
          body?: string
          created_at?: string
          data?: Json
          id?: string
          read?: boolean
          source_id?: string | null
          title?: string
          type?: "like" | "match" | "message" | "system"
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      security_rate_limits: {
        Row: {
          key: string
          count: number
          reset_at: string
          created_at: string
        }
        Insert: {
          key: string
          count?: number
          reset_at: string
          created_at?: string
        }
        Update: {
          key?: string
          count?: number
          reset_at?: string
          created_at?: string
        }
        Relationships: []
      }
      security_events: {
        Row: {
          id: string
          event_type: string
          severity: "info" | "warn" | "critical"
          actor_id: string | null
          ip_hash: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          event_type: string
          severity?: "info" | "warn" | "critical"
          actor_id?: string | null
          ip_hash?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          event_type?: string
          severity?: "info" | "warn" | "critical"
          actor_id?: string | null
          ip_hash?: string | null
          metadata?: Json
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      set_profile_verification_verdict: {
        Args: {
          p_user_id: string
          p_status: string
          p_reason?: string | null
        }
        Returns: undefined
      }
      ensure_my_invites: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      is_admin: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      mark_all_notifications_read: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      get_unread_notification_count: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
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
      check_rate_limit: {
        Args: {
          p_key: string
          p_max_attempts: number
          p_window_seconds: number
        }
        Returns: {
          allowed: boolean
          remaining: number
          reset_in_seconds: number
        }
      }
      log_security_event: {
        Args: {
          p_event_type: string
          p_severity?: string
          p_ip_hash?: string
          p_metadata?: Json
        }
        Returns: undefined
      }
      get_launch_analytics: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_launch_control: {
        Args: never
        Returns: {
          discover_enabled: boolean
          readiness_target: number
          last_changed_by_email: string | null
          last_changed_at: string
          total_registered_users: number
          completed_profiles_count: number
          eligible_users_count: number
          city_counts: Record<string, number>
          night_counts: Record<string, number>
        }
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
