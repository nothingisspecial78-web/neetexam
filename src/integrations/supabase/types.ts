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
      activity_log: {
        Row: {
          created_at: string
          details: Json
          event_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json
          event_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json
          event_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      answers: {
        Row: {
          chosen_index: number | null
          created_at: string
          id: string
          is_correct: boolean
          mode: string
          owner_id: string
          question_id: string
          test_result_id: string | null
          time_ms: number
        }
        Insert: {
          chosen_index?: number | null
          created_at?: string
          id?: string
          is_correct: boolean
          mode: string
          owner_id?: string
          question_id: string
          test_result_id?: string | null
          time_ms?: number
        }
        Update: {
          chosen_index?: number | null
          created_at?: string
          id?: string
          is_correct?: boolean
          mode?: string
          owner_id?: string
          question_id?: string
          test_result_id?: string | null
          time_ms?: number
        }
        Relationships: [
          {
            foreignKeyName: "answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_test_result_id_fkey"
            columns: ["test_result_id"]
            isOneToOne: false
            referencedRelation: "test_results"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_history: {
        Row: {
          balance: number
          change: number
          created_at: string
          id: string
          match_id: string | null
          owner_id: string
          reason: string | null
        }
        Insert: {
          balance: number
          change?: number
          created_at?: string
          id?: string
          match_id?: string | null
          owner_id: string
          reason?: string | null
        }
        Update: {
          balance?: number
          change?: number
          created_at?: string
          id?: string
          match_id?: string | null
          owner_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_history_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          responded_at: string | null
          status: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id?: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          a_answer_at: string | null
          a_correct: number
          a_last_at: string | null
          a_name: string | null
          a_wrong: number
          b_answer_at: string | null
          b_correct: number
          b_last_at: string | null
          b_name: string | null
          b_wrong: number
          created_at: string
          duration_s: number
          ends_at: string | null
          heartbeat_at: string
          id: string
          kind: string
          player_a: string
          player_b: string | null
          points: number
          question_ids: string[]
          starts_at: string | null
          status: string
          winner_id: string | null
        }
        Insert: {
          a_answer_at?: string | null
          a_correct?: number
          a_last_at?: string | null
          a_name?: string | null
          a_wrong?: number
          b_answer_at?: string | null
          b_correct?: number
          b_last_at?: string | null
          b_name?: string | null
          b_wrong?: number
          created_at?: string
          duration_s?: number
          ends_at?: string | null
          heartbeat_at?: string
          id?: string
          kind: string
          player_a: string
          player_b?: string | null
          points?: number
          question_ids?: string[]
          starts_at?: string | null
          status: string
          winner_id?: string | null
        }
        Update: {
          a_answer_at?: string | null
          a_correct?: number
          a_last_at?: string | null
          a_name?: string | null
          a_wrong?: number
          b_answer_at?: string | null
          b_correct?: number
          b_last_at?: string | null
          b_name?: string | null
          b_wrong?: number
          created_at?: string
          duration_s?: number
          ends_at?: string | null
          heartbeat_at?: string
          id?: string
          kind?: string
          player_a?: string
          player_b?: string | null
          points?: number
          question_ids?: string[]
          starts_at?: string | null
          status?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_player_a_fkey"
            columns: ["player_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_player_b_fkey"
            columns: ["player_b"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          arena_joined_at: string | null
          avatar_url: string | null
          created_at: string
          credits: number | null
          display_name: string | null
          friend_code: string | null
          id: string
          last_seen_at: string | null
          onboarded: boolean
        }
        Insert: {
          arena_joined_at?: string | null
          avatar_url?: string | null
          created_at?: string
          credits?: number | null
          display_name?: string | null
          friend_code?: string | null
          id: string
          last_seen_at?: string | null
          onboarded?: boolean
        }
        Update: {
          arena_joined_at?: string | null
          avatar_url?: string | null
          created_at?: string
          credits?: number | null
          display_name?: string | null
          friend_code?: string | null
          id?: string
          last_seen_at?: string | null
          onboarded?: boolean
        }
        Relationships: []
      }
      questions: {
        Row: {
          ai_flag: string | null
          ai_suggestion: Json | null
          answer_source: string
          content_hash: string
          correct_index: number | null
          created_at: string
          explanation: string | null
          id: string
          options: Json
          owner_id: string
          question_text: string
          status: string
          topic_area: string | null
          unit_id: string | null
          upload_id: string | null
        }
        Insert: {
          ai_flag?: string | null
          ai_suggestion?: Json | null
          answer_source?: string
          content_hash: string
          correct_index?: number | null
          created_at?: string
          explanation?: string | null
          id?: string
          options: Json
          owner_id?: string
          question_text: string
          status?: string
          topic_area?: string | null
          unit_id?: string | null
          upload_id?: string | null
        }
        Update: {
          ai_flag?: string | null
          ai_suggestion?: Json | null
          answer_source?: string
          content_hash?: string
          correct_index?: number | null
          created_at?: string
          explanation?: string | null
          id?: string
          options?: Json
          owner_id?: string
          question_text?: string
          status?: string
          topic_area?: string | null
          unit_id?: string | null
          upload_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      test_results: {
        Row: {
          answer_review: Json | null
          correct: number
          created_at: string
          duration_s: number
          id: string
          mode: string
          owner_id: string
          total: number
          unit_ids: string[]
        }
        Insert: {
          answer_review?: Json | null
          correct: number
          created_at?: string
          duration_s: number
          id?: string
          mode?: string
          owner_id?: string
          total: number
          unit_ids: string[]
        }
        Update: {
          answer_review?: Json | null
          correct?: number
          created_at?: string
          duration_s?: number
          id?: string
          mode?: string
          owner_id?: string
          total?: number
          unit_ids?: string[]
        }
        Relationships: []
      }
      units: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          topic_area: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id?: string
          topic_area: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          topic_area?: string
        }
        Relationships: []
      }
      uploads: {
        Row: {
          created_at: string
          file_name: string
          file_type: string
          id: string
          question_count: number
          status: string
          topic_hint: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_type: string
          id?: string
          question_count?: number
          status?: string
          topic_hint?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_type?: string
          id?: string
          question_count?: number
          status?: string
          topic_hint?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _arena_check_pool: { Args: never; Returns: undefined }
      _arena_cleanup: { Args: never; Returns: undefined }
      _arena_pool: { Args: never; Returns: string[] }
      _arena_start: { Args: { _id: string }; Returns: undefined }
      _match_q: { Args: { _ids: string[]; _idx: number }; Returns: Json }
      answer_match: {
        Args: { _choice: number; _id: string; _index: number }
        Returns: Json
      }
      arena_current: { Args: never; Returns: Json }
      arena_me: { Args: never; Returns: Json }
      cancel_match: { Args: { _id: string }; Returns: undefined }
      challenge_friend: {
        Args: { _duration: number; _friend: string }
        Returns: string
      }
      dashboard_data: { Args: never; Returns: Json }
      dashboard_rank: { Args: never; Returns: Json }
      delete_my_data: { Args: never; Returns: undefined }
      ensure_my_profile: { Args: never; Returns: undefined }
      find_opponent: { Args: never; Returns: string }
      is_friend: { Args: { _a: string; _b: string }; Returns: boolean }
      match_question: { Args: { _id: string }; Returns: Json }
      prune_activity_log: { Args: never; Returns: undefined }
      related_profiles: {
        Args: never
        Returns: {
          avatar_url: string
          display_name: string
          id: string
          last_seen_at: string
          question_count: number
        }[]
      }
      respond_invite: {
        Args: { _accept: boolean; _id: string }
        Returns: undefined
      }
      save_test_run: {
        Args: { _answers: Json; _duration: number }
        Returns: string
      }
      search_students: {
        Args: { _q: string }
        Returns: {
          avatar_url: string
          display_name: string
          id: string
          question_count: number
        }[]
      }
      settle_match: {
        Args: { _id: string; _points: number; _winner: string }
        Returns: boolean
      }
      touch_presence: { Args: never; Returns: undefined }
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
