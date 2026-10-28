// Database Types
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          // Shown on shared recipes ("Geteilt von …"). Added in migration 011.
          display_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      recipes: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          ingredients: string;
          preparation_steps: string | null;
          source_url: string | null;
          prep_time: string | null;
          calories: number | null;
          protein: number | null;
          carbs: number | null;
          fats: number | null;
          serving_size: number;
          image_url: string | null;
          is_public: boolean;
          // Secret id of the share link (/r/<share_id>); null when not shared. Migration 011.
          share_id: string | null;
          // Own 1–5 star rating, null when not rated. Migration 012.
          rating: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          ingredients: string;
          preparation_steps?: string | null;
          source_url?: string | null;
          prep_time?: string | null;
          calories?: number | null;
          protein?: number | null;
          carbs?: number | null;
          fats?: number | null;
          serving_size?: number;
          image_url?: string | null;
          is_public?: boolean;
          share_id?: string | null;
          rating?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          ingredients?: string;
          preparation_steps?: string | null;
          source_url?: string | null;
          prep_time?: string | null;
          calories?: number | null;
          protein?: number | null;
          carbs?: number | null;
          fats?: number | null;
          serving_size?: number;
          image_url?: string | null;
          is_public?: boolean;
          share_id?: string | null;
          rating?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      recipe_tags: {
        Row: {
          id: string;
          recipe_id: string;
          tag_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          recipe_id: string;
          tag_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          recipe_id?: string;
          tag_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      tags: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      meal_plans: {
        Row: {
          id: string;
          user_id: string;
          week_start_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          week_start_date: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          week_start_date?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      planned_meals: {
        Row: {
          id: string;
          meal_plan_id: string;
          recipe_id: string;
          day_of_week: number;
          meal_type: "breakfast" | "lunch" | "dinner" | "snack" | "extra";
          serving_size: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          meal_plan_id: string;
          recipe_id: string;
          day_of_week: number;
          meal_type: "breakfast" | "lunch" | "dinner" | "snack" | "extra";
          serving_size?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          meal_plan_id?: string;
          recipe_id?: string;
          day_of_week?: number;
          meal_type?: "breakfast" | "lunch" | "dinner" | "snack" | "extra";
          serving_size?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      user_preferences: {
        Row: {
          id: string;
          user_id: string;
          protein_target: number;
          calories_target: number;
          carbs_target: number;
          fats_target: number;
          protein_target_enabled: boolean;
          calories_target_enabled: boolean;
          carbs_target_enabled: boolean;
          fats_target_enabled: boolean;
          show_nutrition: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          protein_target?: number;
          calories_target?: number;
          carbs_target?: number;
          fats_target?: number;
          protein_target_enabled?: boolean;
          calories_target_enabled?: boolean;
          carbs_target_enabled?: boolean;
          fats_target_enabled?: boolean;
          show_nutrition?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          protein_target?: number;
          calories_target?: number;
          carbs_target?: number;
          fats_target?: number;
          protein_target_enabled?: boolean;
          calories_target_enabled?: boolean;
          carbs_target_enabled?: boolean;
          fats_target_enabled?: boolean;
          show_nutrition?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      food_items: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          is_plant: boolean;
          is_legume: boolean;
          is_fermented: boolean;
          is_whole_grain: boolean;
          has_added_sugar: boolean;
          is_processed: boolean;
          color: FoodColor | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          is_plant?: boolean;
          is_legume?: boolean;
          is_fermented?: boolean;
          is_whole_grain?: boolean;
          has_added_sugar?: boolean;
          is_processed?: boolean;
          color?: FoodColor | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          is_plant?: boolean;
          is_legume?: boolean;
          is_fermented?: boolean;
          is_whole_grain?: boolean;
          has_added_sugar?: boolean;
          is_processed?: boolean;
          color?: FoodColor | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      recipe_ingredients: {
        Row: {
          id: string;
          recipe_id: string;
          food_item_id: string;
          quantity: number;
          unit: string | null;
          display_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          recipe_id: string;
          food_item_id: string;
          quantity?: number;
          unit?: string | null;
          display_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          recipe_id?: string;
          food_item_id?: string;
          quantity?: number;
          unit?: string | null;
          display_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      health_targets: {
        Row: {
          id: string;
          user_id: string;
          plant_diversity_target: number;
          fermented_min: number;
          fermented_max: number;
          legume_min: number;
          legume_max: number;
          whole_grain_target_pct: number;
          added_sugar_max_meals: number;
          unprocessed_target_pct: number;
          color_diversity_target: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plant_diversity_target?: number;
          fermented_min?: number;
          fermented_max?: number;
          legume_min?: number;
          legume_max?: number;
          whole_grain_target_pct?: number;
          added_sugar_max_meals?: number;
          unprocessed_target_pct?: number;
          color_diversity_target?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          plant_diversity_target?: number;
          fermented_min?: number;
          fermented_max?: number;
          legume_min?: number;
          legume_max?: number;
          whole_grain_target_pct?: number;
          added_sugar_max_meals?: number;
          unprocessed_target_pct?: number;
          color_diversity_target?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pantry_staples: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      feedback: {
        Row: {
          id: string;
          user_id: string | null;
          category: FeedbackCategory;
          message: string;
          context: string | null;
          user_agent: string | null;
          status: 'new' | 'seen' | 'done';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          category?: FeedbackCategory;
          message: string;
          context?: string | null;
          user_agent?: string | null;
          status?: 'new' | 'seen' | 'done';
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          category?: FeedbackCategory;
          message?: string;
          context?: string | null;
          user_agent?: string | null;
          status?: 'new' | 'seen' | 'done';
          created_at?: string;
        };
        Relationships: [];
      };
      // "Was ist neu?" entries, read by everyone signed in. Migration 013.
      changelog: {
        Row: {
          id: string;
          released_on: string;
          title: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          released_on?: string;
          title: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          released_on?: string;
          title?: string;
          description?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      // Written only by consume_ai_quota; users can read their own rows. Migration 010.
      ai_usage: {
        Row: {
          user_id: string;
          usage_date: string;
          request_count: number;
        };
        Insert: {
          user_id: string;
          usage_date?: string;
          request_count?: number;
        };
        Update: {
          user_id?: string;
          usage_date?: string;
          request_count?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      consume_ai_quota: {
        Args: { daily_limit: number };
        Returns: boolean;
      };
      get_shared_recipe: {
        Args: { p_share_id: string };
        Returns: Json;
      };
      discover_recipes: {
        Args: { p_search?: string | null; p_limit?: number };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// Application Types
export type Recipe = Database['public']['Tables']['recipes']['Row'];
export type ChangelogEntry = Database['public']['Tables']['changelog']['Row'];
export type MealPlan = Database['public']['Tables']['meal_plans']['Row'];
export type PlannedMeal = Database['public']['Tables']['planned_meals']['Row'];
export type Tag = Database['public']['Tables']['tags']['Row'];
export type UserPreferences = Database['public']['Tables']['user_preferences']['Row'];
export type FoodItem = Database['public']['Tables']['food_items']['Row'];
export type RecipeIngredient = Database['public']['Tables']['recipe_ingredients']['Row'];
export type HealthTargets = Database['public']['Tables']['health_targets']['Row'];
export type PantryStaple = Database['public']['Tables']['pantry_staples']['Row'];
export type Feedback = Database['public']['Tables']['feedback']['Row'];

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'extra';
export type FoodColor = 'red' | 'yellow' | 'green' | 'purple' | 'brown';
export type FeedbackCategory = 'bug' | 'idea' | 'other';

export type NutritionValues = {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
};

export type ShoppingListItem = {
  ingredient: string;
  quantity: number;
  unit: string;
  // Name as written in the first recipe that uses it, e.g. "Rote Linsen".
  label?: string;
  // Names of the planned recipes that need this item.
  sources?: string[];
};
