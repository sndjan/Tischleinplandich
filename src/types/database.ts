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
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
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
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
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
};
