export type UserRole = 'player' | 'admin' | 'super_admin' | 'captain' | 'referee'

export type TournamentStatus = 'draft' | 'active' | 'finished'

export type MatchStatus =
  | 'pending'
  | 'scheduled'
  | 'ready_for_result'
  | 'result_submitted'
  | 'confirmed'
  | 'corrected'
  | 'cancelled'

export type MatchResultType = 'normal' | 'default_win_a' | 'default_win_b'

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type ScoreSet = { a: number; b: number }

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          email: string | null
          role: UserRole
          created_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          email?: string | null
          role?: UserRole
          created_at?: string
        }
        Update: {
          full_name?: string | null
          email?: string | null
          role?: UserRole
        }
      }
      tournaments: {
        Row: {
          id: string
          name: string
          description: string | null
          category: string | null
          season: string | null
          status: TournamentStatus
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          category?: string | null
          season?: string | null
          status?: TournamentStatus
          created_by?: string | null
          created_at?: string
        }
        Update: {
          name?: string
          description?: string | null
          category?: string | null
          season?: string | null
          status?: TournamentStatus
          created_by?: string | null
        }
      }
      tournament_rules: {
        Row: {
          id: string
          tournament_id: string
          best_of_sets: number
          set_points: number
          tiebreak_enabled: boolean
          super_tiebreak_final_set: boolean
          points_per_win: number
          points_per_loss: number
          points_default_win: number
          points_default_loss: number
          tiebreak_criteria: Json | null
          allow_player_score_entry: boolean
          created_at: string
        }
        Insert: {
          id?: string
          tournament_id: string
          best_of_sets?: number
          set_points?: number
          tiebreak_enabled?: boolean
          super_tiebreak_final_set?: boolean
          points_per_win?: number
          points_per_loss?: number
          points_default_win?: number
          points_default_loss?: number
          tiebreak_criteria?: Json | null
          allow_player_score_entry?: boolean
          created_at?: string
        }
        Update: {
          best_of_sets?: number
          set_points?: number
          tiebreak_enabled?: boolean
          super_tiebreak_final_set?: boolean
          points_per_win?: number
          points_per_loss?: number
          points_default_win?: number
          points_default_loss?: number
          tiebreak_criteria?: Json | null
          allow_player_score_entry?: boolean
        }
      }
      groups: {
        Row: {
          id: string
          tournament_id: string
          name: string
          order_index: number
          max_players: number
          created_at: string
        }
        Insert: {
          id?: string
          tournament_id: string
          name: string
          order_index?: number
          max_players?: number
          created_at?: string
        }
        Update: {
          name?: string
          order_index?: number
          max_players?: number
        }
      }
      group_players: {
        Row: {
          id: string
          group_id: string
          user_id: string
          display_name: string
          seed_order: number
          created_at: string
        }
        Insert: {
          id?: string
          group_id: string
          user_id: string
          display_name: string
          seed_order?: number
          created_at?: string
        }
        Update: {
          display_name?: string
          seed_order?: number
        }
      }
      matches: {
        Row: {
          id: string
          tournament_id: string
          group_id: string
          player_a_id: string
          player_b_id: string
          player_a_user_id: string
          player_b_user_id: string
          score_raw: ScoreSet[] | null
          winner_id: string | null
          status: MatchStatus
          result_type: MatchResultType
          scheduled_date: string | null
          scheduled_start_at: string | null
          scheduled_end_at: string | null
          location: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_by: string | null
          updated_by: string | null
          created_at: string
          updated_at: string
          locked_at: string | null
        }
        Insert: {
          id?: string
          tournament_id: string
          group_id: string
          player_a_id: string
          player_b_id: string
          player_a_user_id: string
          player_b_user_id: string
          score_raw?: ScoreSet[] | null
          winner_id?: string | null
          status?: MatchStatus
          result_type?: MatchResultType
          scheduled_date?: string | null
          scheduled_start_at?: string | null
          scheduled_end_at?: string | null
          location?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
          updated_at?: string
          locked_at?: string | null
        }
        Update: {
          score_raw?: ScoreSet[] | null
          winner_id?: string | null
          status?: MatchStatus
          result_type?: MatchResultType
          scheduled_date?: string | null
          scheduled_start_at?: string | null
          scheduled_end_at?: string | null
          location?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          updated_by?: string | null
          updated_at?: string
          locked_at?: string | null
        }
      }
      match_score_logs: {
        Row: {
          id: string
          match_id: string
          action_type: string
          previous_score_json: Json | null
          new_score_json: Json | null
          previous_status: string | null
          new_status: string | null
          changed_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          match_id: string
          action_type: string
          previous_score_json?: Json | null
          new_score_json?: Json | null
          previous_status?: string | null
          new_status?: string | null
          changed_by?: string | null
          created_at?: string
        }
        Update: {
          action_type?: string
          previous_score_json?: Json | null
          new_score_json?: Json | null
          previous_status?: string | null
          new_status?: string | null
          changed_by?: string | null
        }
      }
    }
    Views: Record<string, never>
    Functions: {
      submit_player_match_result: {
        Args: {
          p_match_id: string
          p_score: Json
          p_result_type: string
          p_winner_group_player_id: string | null
        }
        Returns: undefined
      }
      admin_set_match_result: {
        Args: {
          p_match_id: string
          p_score: Json
          p_winner_id: string
          p_status: string
          p_result_type: string
        }
        Returns: undefined
      }
    }
    Enums: Record<string, never>
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Tournament = Database['public']['Tables']['tournaments']['Row']
export type TournamentRules =
  Database['public']['Tables']['tournament_rules']['Row']
export type Group = Database['public']['Tables']['groups']['Row']
export type GroupPlayer = Database['public']['Tables']['group_players']['Row']
export type MatchRow = Database['public']['Tables']['matches']['Row']
export type MatchScoreLog = Database['public']['Tables']['match_score_logs']['Row']
