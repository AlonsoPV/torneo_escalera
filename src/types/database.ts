export type UserRole = 'player' | 'admin' | 'super_admin' | 'captain' | 'referee'

export type TournamentStatus = 'draft' | 'active' | 'finished' | 'archived'

export type TournamentMovementType =
  | 'promote'
  | 'stay'
  | 'demote'
  | 'capped_top'
  | 'capped_bottom'

export type TournamentMovementReason =
  | 'top_2_promote'
  | 'third_stays'
  | 'bottom_2_demote'
  | 'top_group_limit'
  | 'bottom_group_limit'

export type MatchStatus =
  | 'pending_score'
  | 'score_submitted'
  | 'score_disputed'
  | 'player_confirmed'
  | 'closed'
  | 'cancelled'

export type MatchResultType = 'normal' | 'default_win_a' | 'default_win_b'
export type MatchGameType = 'best_of_3' | 'sudden_death' | 'long_set'

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type ScoreSet = { a: number; b: number }
export type ScoreWinnerSide = 'a' | 'b'
export type ScorePayload =
  | {
      game_type: 'best_of_3'
      score_json: ScoreSet[]
      winner: ScoreWinnerSide
    }
  | {
      game_type: 'sudden_death'
      score_json: null
      winner: ScoreWinnerSide
    }
  | {
      game_type: 'long_set'
      score_json: [ScoreSet]
      winner: ScoreWinnerSide
    }

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          email: string | null
          phone: string | null
          email_verified: boolean
          must_complete_email: boolean
          role: UserRole
          created_at: string
          external_id: string | null
          category_id: string | null
          status: 'active' | 'inactive'
          auto_enroll_eligible: boolean
          updated_at: string
          import_carry_pj: number | null
          import_carry_pts: number | null
        }
        Insert: {
          id: string
          full_name?: string | null
          email?: string | null
          phone?: string | null
          email_verified?: boolean
          must_complete_email?: boolean
          role?: UserRole
          created_at?: string
          external_id?: string | null
          category_id?: string | null
          status?: 'active' | 'inactive'
          auto_enroll_eligible?: boolean
          updated_at?: string
          import_carry_pj?: number | null
          import_carry_pts?: number | null
        }
        Update: {
          full_name?: string | null
          email?: string | null
          phone?: string | null
          email_verified?: boolean
          must_complete_email?: boolean
          role?: UserRole
          external_id?: string | null
          category_id?: string | null
          status?: 'active' | 'inactive'
          auto_enroll_eligible?: boolean
          updated_at?: string
          import_carry_pj?: number | null
          import_carry_pts?: number | null
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
          previous_tournament_id: string | null
          period_label: string | null
          finished_at: string | null
          closed_by: string | null
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
          previous_tournament_id?: string | null
          period_label?: string | null
          finished_at?: string | null
          closed_by?: string | null
        }
        Update: {
          name?: string
          description?: string | null
          category?: string | null
          season?: string | null
          status?: TournamentStatus
          created_by?: string | null
          previous_tournament_id?: string | null
          period_label?: string | null
          finished_at?: string | null
          closed_by?: string | null
        }
      }
      tournament_final_standings: {
        Row: {
          id: string
          tournament_id: string
          group_id: string
          group_order_index: number
          player_id: string
          position: number
          points: number
          games_for: number
          games_against: number
          games_difference: number
          wins: number
          losses: number
          created_at: string
        }
        Insert: {
          id?: string
          tournament_id: string
          group_id: string
          group_order_index: number
          player_id: string
          position: number
          points?: number
          games_for?: number
          games_against?: number
          games_difference?: number
          wins?: number
          losses?: number
          created_at?: string
        }
        Update: {
          group_order_index?: number
          position?: number
          points?: number
          games_for?: number
          games_against?: number
          games_difference?: number
          wins?: number
          losses?: number
        }
      }
      tournament_movements: {
        Row: {
          id: string
          from_tournament_id: string
          to_tournament_id: string
          player_id: string
          from_category_id: string | null
          to_category_id: string | null
          from_group_id: string | null
          from_position: number
          points: number
          games_for: number
          games_difference: number
          movement_type: TournamentMovementType
          movement_reason: TournamentMovementReason | null
          raw_movement: string | null
          to_group_id: string | null
          from_group_order_index: number | null
          to_group_order_index: number | null
          created_at: string
        }
        Insert: {
          id?: string
          from_tournament_id: string
          to_tournament_id: string
          player_id: string
          from_category_id?: string | null
          to_category_id?: string | null
          from_group_id?: string | null
          to_group_id?: string | null
          from_group_order_index?: number | null
          to_group_order_index?: number | null
          from_position: number
          points?: number
          games_for?: number
          games_difference?: number
          movement_type: TournamentMovementType
          movement_reason?: TournamentMovementReason | null
          raw_movement?: string | null
          created_at?: string
        }
        Update: {
          from_category_id?: string | null
          to_category_id?: string | null
          from_group_id?: string | null
          to_group_id?: string | null
          from_group_order_index?: number | null
          to_group_order_index?: number | null
          from_position?: number
          points?: number
          games_for?: number
          games_difference?: number
          movement_type?: TournamentMovementType
          movement_reason?: TournamentMovementReason | null
          raw_movement?: string | null
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
          updated_at: string
          updated_by: string | null
          defaults_enabled: boolean
          default_requires_admin_review: boolean
          player_can_report_default: boolean
          admin_can_set_default_manual: boolean
          result_submission_window_hours: number
          auto_penalty_no_show: boolean
          allow_7_6: boolean
          allow_7_5: boolean
          ranking_criteria: Json
          match_format: string
          set_type: string
          games_per_set: number
          min_game_difference: number
          tiebreak_at: number | null
          final_set_format: string
          sudden_death_points: number
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
          updated_at?: string
          updated_by?: string | null
          defaults_enabled?: boolean
          default_requires_admin_review?: boolean
          player_can_report_default?: boolean
          admin_can_set_default_manual?: boolean
          result_submission_window_hours?: number
          auto_penalty_no_show?: boolean
          allow_7_6?: boolean
          allow_7_5?: boolean
          ranking_criteria?: Json
          match_format?: string
          set_type?: string
          games_per_set?: number
          min_game_difference?: number
          tiebreak_at?: number | null
          final_set_format?: string
          sudden_death_points?: number
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
          updated_at?: string
          updated_by?: string | null
          defaults_enabled?: boolean
          default_requires_admin_review?: boolean
          player_can_report_default?: boolean
          admin_can_set_default_manual?: boolean
          result_submission_window_hours?: number
          auto_penalty_no_show?: boolean
          allow_7_6?: boolean
          allow_7_5?: boolean
          ranking_criteria?: Json
          match_format?: string
          set_type?: string
          games_per_set?: number
          min_game_difference?: number
          tiebreak_at?: number | null
          final_set_format?: string
          sudden_death_points?: number
        }
      }
      group_categories: {
        Row: {
          id: string
          tournament_id: string
          name: string
          order_index: number
          created_at: string
        }
        Insert: {
          id?: string
          tournament_id: string
          name: string
          order_index?: number
          created_at?: string
        }
        Update: {
          name?: string
          order_index?: number
        }
      }
      groups: {
        Row: {
          id: string
          tournament_id: string
          name: string
          order_index: number
          max_players: number
          group_category_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tournament_id: string
          name: string
          order_index?: number
          max_players?: number
          group_category_id?: string | null
          created_at?: string
        }
        Update: {
          name?: string
          order_index?: number
          max_players?: number
          group_category_id?: string | null
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
          game_type: MatchGameType
          winner_id: string | null
          status: MatchStatus
          result_type: MatchResultType
          scheduled_date: string | null
          scheduled_start_at: string | null
          scheduled_end_at: string | null
          location: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          score_submitted_by: string | null
          score_submitted_at: string | null
          opponent_confirmed_by: string | null
          opponent_confirmed_at: string | null
          admin_validated_by: string | null
          admin_validated_at: string | null
          closed_at: string | null
          dispute_reason: string | null
          admin_notes: string | null
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
          game_type?: MatchGameType
          winner_id?: string | null
          status?: MatchStatus
          result_type?: MatchResultType
          scheduled_date?: string | null
          scheduled_start_at?: string | null
          scheduled_end_at?: string | null
          location?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          score_submitted_by?: string | null
          score_submitted_at?: string | null
          opponent_confirmed_by?: string | null
          opponent_confirmed_at?: string | null
          admin_validated_by?: string | null
          admin_validated_at?: string | null
          closed_at?: string | null
          dispute_reason?: string | null
          admin_notes?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
          updated_at?: string
          locked_at?: string | null
        }
        Update: {
          score_raw?: ScoreSet[] | null
          game_type?: MatchGameType
          winner_id?: string | null
          status?: MatchStatus
          result_type?: MatchResultType
          scheduled_date?: string | null
          scheduled_start_at?: string | null
          scheduled_end_at?: string | null
          location?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          score_submitted_by?: string | null
          score_submitted_at?: string | null
          opponent_confirmed_by?: string | null
          opponent_confirmed_at?: string | null
          admin_validated_by?: string | null
          admin_validated_at?: string | null
          closed_at?: string | null
          dispute_reason?: string | null
          admin_notes?: string | null
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
      player_categories: {
        Row: {
          id: string
          name: string
          description: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          description?: string | null
          created_by?: string | null
          updated_at?: string
        }
      }
      bulk_import_batches: {
        Row: {
          id: string
          file_name: string | null
          tournament_id: string | null
          uploaded_by: string
          total_rows: number
          success_rows: number
          error_rows: number
          status: 'processing' | 'completed' | 'failed'
          created_at: string
        }
        Insert: {
          id?: string
          file_name?: string | null
          tournament_id?: string | null
          uploaded_by: string
          total_rows?: number
          success_rows?: number
          error_rows?: number
          status?: 'processing' | 'completed' | 'failed'
          created_at?: string
        }
        Update: {
          file_name?: string | null
          total_rows?: number
          success_rows?: number
          error_rows?: number
          status?: 'processing' | 'completed' | 'failed'
        }
      }
      bulk_import_rows: {
        Row: {
          id: string
          batch_id: string
          row_number: number
          external_id: string | null
          full_name: string | null
          role: string | null
          group_name: string | null
          category_name: string | null
          status: 'success' | 'error'
          error_message: string | null
          created_profile_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          batch_id: string
          row_number: number
          external_id?: string | null
          full_name?: string | null
          role?: string | null
          group_name?: string | null
          category_name?: string | null
          status: 'success' | 'error'
          error_message?: string | null
          created_profile_id?: string | null
          created_at?: string
        }
        Update: {
          status?: 'success' | 'error'
          error_message?: string | null
          created_profile_id?: string | null
        }
      }
      match_results_import_batches: {
        Row: {
          id: string
          file_name: string | null
          uploaded_by: string
          total_rows: number
          success_rows: number
          error_rows: number
          status: 'processing' | 'completed' | 'failed'
          created_at: string
        }
        Insert: {
          id?: string
          file_name?: string | null
          uploaded_by: string
          total_rows?: number
          success_rows?: number
          error_rows?: number
          status?: 'processing' | 'completed' | 'failed'
          created_at?: string
        }
        Update: {
          file_name?: string | null
          total_rows?: number
          success_rows?: number
          error_rows?: number
          status?: 'processing' | 'completed' | 'failed'
        }
      }
      match_results_import_rows: {
        Row: {
          id: string
          batch_id: string
          row_number: number
          status: 'success' | 'error'
          error_message: string | null
          match_id: string | null
          payload: Json
          created_at: string
        }
        Insert: {
          id?: string
          batch_id: string
          row_number: number
          status: 'success' | 'error'
          error_message?: string | null
          match_id?: string | null
          payload?: Json
          created_at?: string
        }
        Update: {
          status?: 'success' | 'error'
          error_message?: string | null
          match_id?: string | null
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
          p_game_type?: MatchGameType
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
          p_game_type?: MatchGameType
        }
        Returns: undefined
      }
      opponent_respond_match_score: {
        Args: {
          p_match_id: string
          p_accept: boolean
          p_dispute_reason: string | null
        }
        Returns: undefined
      }
      admin_reopen_match_result: {
        Args: {
          p_match_id: string
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
export type GroupCategory = Database['public']['Tables']['group_categories']['Row']
export type GroupPlayer = Database['public']['Tables']['group_players']['Row']
export type TournamentMovement = Database['public']['Tables']['tournament_movements']['Row']
export type MatchRow = Database['public']['Tables']['matches']['Row']
export type MatchScoreLog = Database['public']['Tables']['match_score_logs']['Row']
export type PlayerCategory = Database['public']['Tables']['player_categories']['Row']
