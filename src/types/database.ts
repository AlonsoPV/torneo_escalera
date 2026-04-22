export type UserRole = 'player' | 'admin'

export type TournamentStatus = 'draft' | 'active' | 'finished'

export type MatchStatus = 'pending' | 'confirmed' | 'corrected'

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
          status: TournamentStatus
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          category?: string | null
          status?: TournamentStatus
          created_by?: string | null
          created_at?: string
        }
        Update: {
          name?: string
          description?: string | null
          category?: string | null
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
          updated_by?: string | null
          updated_at?: string
          locked_at?: string | null
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
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
