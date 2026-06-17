// Generated from Supabase schema — run `supabase gen types typescript` to refresh.
// Manually extended for matchmaker_favourites and matchmaker_notifications tables
// added in migration 20260614000002_matchmaker_web_app.sql.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      fighters: {
        Row: {
          id: string;
          first_name: string;
          last_name: string | null;
          nickname: string | null;
          gender: string | null;
          country: string | null;
          dob: string | null;
          height_cm: number | null;
          weight_kg: number | null;
          reach_cm: number | null;
          stance: string | null;
          current_city: string | null;
          current_city_country: string | null;
          current_city_lat: number | null;
          current_city_lng: number | null;
          team_name: string | null;
          availability_status: string;
          available_from: string | null;
          open_to_short_notice: boolean;
          preparation_weeks: number | null;
          purse_usd: number | null;
          purse_negotiable: boolean;
          promotional_status: string | null;
          promoter_name: string | null;
          instagram: string | null;
          photo_url: string | null;
          identity_verified: boolean;
          subscription_status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      fighter_sports: {
        Row: {
          id: number;
          user_id: string;
          sport: string;
          level: string | null;
          pro_w: number;
          pro_l: number;
          pro_d: number;
          amateur_w: number;
          amateur_l: number;
          amateur_d: number;
          catchweight: boolean;
          catchweight_min_kg: number | null;
          catchweight_max_kg: number | null;
          is_active: boolean;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [
          {
            foreignKeyName: "fighter_sports_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "fighters";
            referencedColumns: ["id"];
          },
        ];
      };
      fighter_sport_weight_classes: {
        Row: {
          id: number;
          fighter_sport_id: number;
          weight_class_id: number;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      fighter_sport_fight_styles: {
        Row: {
          id: number;
          fighter_sport_id: number;
          fight_style_id: number;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      weight_classes: {
        Row: {
          id: number;
          sport_slug: string;
          gender: string;
          name: string;
          limit_kg: number;
          sort_order: number;
          open_ended: boolean;
          active: boolean;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      fight_styles: {
        Row: {
          id: number;
          slug: string;
          label: string;
          description: string;
          sort_order: number;
          active: boolean;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      fight_style_sports: {
        Row: {
          id: number;
          fight_style_slug: string;
          sport_slug: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      sports: {
        Row: {
          slug: string;
          label: string;
          active: boolean;
          sort_order: number;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      opponents: {
        Row: {
          id: number;
          user_id: string;
          fighter_sport_id: number;
          name: string | null;
          opponent_name: string | null;
          result: string | null;
          method: string | null;
          round: number | null;
          event_name: string | null;
          event_date: string | null;
          organization: string | null;
          weight_class: string | null;
          sport: string | null;
          level: string | null;
          title_bout: string | null;
          title_status: string | null;
          bonuses: string[] | null;
          link: string | null;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      videos: {
        Row: {
          id: number;
          user_id: string;
          title: string | null;
          url: string;
          visibility: string;
          created_at: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      fighter_social_snapshots: {
        Row: {
          id: number;
          fighter_id: string;
          follower_count: number;
          recorded_at: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      field_provenance: {
        Row: {
          id: number;
          fighter_id: string;
          field_name: string;
          source: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      passports: {
        Row: {
          id: string;
          fighter_id: string;
          passport_country: string | null;
          passport_number: string | null;
          expiry_date: string | null;
          verification_status: string;
          veriff_session_id: string | null;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      matchmakers: {
        Row: {
          id: string;
          first_name: string | null;
          last_name: string | null;
          organization: string | null;
          email: string | null;
          must_change_password: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          first_name?: string | null;
          last_name?: string | null;
          organization?: string | null;
          email?: string | null;
          must_change_password?: boolean;
        };
        Update: {
          first_name?: string | null;
          last_name?: string | null;
          organization?: string | null;
          email?: string | null;
          must_change_password?: boolean;
        };
        Relationships: [];
      };
      matchmaker_favourites: {
        Row: {
          id: number;
          matchmaker_id: string;
          fighter_id: string;
          note: string | null;
          notify: boolean;
          notified_at: string | null;
          created_at: string;
          tags: string[];
        };
        Insert: {
          matchmaker_id: string;
          fighter_id: string;
          note?: string | null;
          notify?: boolean;
          tags?: string[];
        };
        Update: {
          note?: string | null;
          notify?: boolean;
          tags?: string[];
        };
        Relationships: [];
      };
      matchmaker_favourite_notes: {
        Row: {
          id: number;
          favourite_id: number;
          matchmaker_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          favourite_id: number;
          matchmaker_id: string;
          body: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      matchmaker_notifications: {
        Row: {
          id: number;
          matchmaker_id: string;
          fighter_id: string;
          type: string;
          read: boolean;
          created_at: string;
        };
        Insert: {
          matchmaker_id: string;
          fighter_id: string;
          type?: string;
        };
        Update: {
          read?: boolean;
        };
        Relationships: [];
      };
      matchmaking_logs: {
        Row: {
          id: number;
          matchmaker_id: string;
          fighter_id: string;
          event_type: string;
          created_at: string;
        };
        Insert: {
          matchmaker_id: string;
          fighter_id: string;
          event_type: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      video_access_requests: {
        Row: {
          id: number;
          fighter_id: string;
          matchmaker_id: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          fighter_id: string;
          matchmaker_id: string;
          status?: string;
        };
        Update: {
          status?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      search_fighters_by_name: {
        Args: { query: string; p_limit?: number };
        Returns: {
          id: string;
          first_name: string;
          last_name: string | null;
          nickname: string | null;
          country: string | null;
          height_cm: number | null;
          availability_status: string | null;
          available_from: string | null;
          identity_verified: boolean;
        }[];
      };
      is_matchmaker: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      search_fighters: {
        Args: {
          p_sport: string;
          p_gender: string;
          p_weight_ids?: number[] | null;
          p_catchweight_kg?: number | null;
          p_ready_by_date?: string | null;
          p_short_notice?: boolean | null;
          p_promo_status?: string | null;
          p_max_prep_weeks?: number | null;
          p_purse_max?: number | null;
          p_level?: string | null;
          p_min_wins?: number | null;
          p_max_losses?: number | null;
          p_max_total_fights?: number | null;
          p_city_lat?: number | null;
          p_city_lng?: number | null;
          p_radius_km?: number | null;
          p_countries?: string[] | null;
          p_fight_styles?: string[] | null;
          p_stance?: string | null;
          p_height_min?: number | null;
          p_height_max?: number | null;
          p_reach_min?: number | null;
          p_reach_max?: number | null;
          p_min_followers?: number | null;
          p_nationalities?: string[] | null;
          p_origin_countries?: string[] | null;
          p_near_match?: boolean;
          p_page?: number;
          p_page_size?: number;
        };
        Returns: (Fighter & { total_count: number })[];
      };
    };
    Enums: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type Fighter = Tables<"fighters">;

/** Fighter as returned by search_fighters RPC — includes aggregated pro record. */
export type SearchFighter = Fighter & {
  pro_w: number;
  pro_l: number;
  pro_d: number;
};

export type Matchmaker = Tables<"matchmakers">;
export type MatchmakerFavourite = Tables<"matchmaker_favourites">;
export type MatchmakerFavouriteNote = Tables<"matchmaker_favourite_notes">;
export type MatchmakerNotification = Tables<"matchmaker_notifications">;
export type FighterSport = Tables<"fighter_sports">;
export type WeightClass = Tables<"weight_classes">;
export type FightStyle = Tables<"fight_styles">;
export type Opponent = Tables<"opponents">;
export type Video = Tables<"videos">;
