export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          user_id: string;
          full_name: string;
          relationship: 'self' | 'parent' | 'child' | 'spouse' | 'other';
          date_of_birth: string | null;
          sex: 'male' | 'female' | 'other' | 'undisclosed' | null;
          blood_group: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'unknown' | null;
          height_cm: number | null;
          weight_kg: number | null;
          allergies: string | null;
          chronic_conditions: string | null;
          emergency_contact_name: string | null;
          emergency_contact_phone: string | null;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          full_name: string;
          relationship?: 'self' | 'parent' | 'child' | 'spouse' | 'other';
          date_of_birth?: string | null;
          sex?: 'male' | 'female' | 'other' | 'undisclosed' | null;
          blood_group?: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'unknown' | null;
          height_cm?: number | null;
          weight_kg?: number | null;
          allergies?: string | null;
          chronic_conditions?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          full_name?: string;
          relationship?: 'self' | 'parent' | 'child' | 'spouse' | 'other';
          date_of_birth?: string | null;
          sex?: 'male' | 'female' | 'other' | 'undisclosed' | null;
          blood_group?: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'unknown' | null;
          height_cm?: number | null;
          weight_kg?: number | null;
          allergies?: string | null;
          chronic_conditions?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      visits: {
        Row: {
          id: string;
          user_id: string;
          profile_id: string;
          visit_date: string;
          doctor_name: string | null;
          clinic_name: string | null;
          specialty: string | null;
          diagnosis: string | null;
          doctor_advice: string | null;
          follow_up_date: string | null;
          visit_cost: number | null;
          currency: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          profile_id: string;
          visit_date: string;
          doctor_name?: string | null;
          clinic_name?: string | null;
          specialty?: string | null;
          diagnosis?: string | null;
          doctor_advice?: string | null;
          follow_up_date?: string | null;
          visit_cost?: number | null;
          currency?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          profile_id?: string;
          visit_date?: string;
          doctor_name?: string | null;
          clinic_name?: string | null;
          specialty?: string | null;
          diagnosis?: string | null;
          doctor_advice?: string | null;
          follow_up_date?: string | null;
          visit_cost?: number | null;
          currency?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      visit_images: {
        Row: {
          id: string;
          user_id: string;
          visit_id: string;
          storage_path: string;
          page_number: number;
          width_px: number | null;
          height_px: number | null;
          byte_size: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          visit_id: string;
          storage_path: string;
          page_number?: number;
          width_px?: number | null;
          height_px?: number | null;
          byte_size?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          visit_id?: string;
          storage_path?: string;
          page_number?: number;
          width_px?: number | null;
          height_px?: number | null;
          byte_size?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      medicines: {
        Row: {
          id: string;
          user_id: string;
          profile_id: string;
          visit_id: string | null;
          medicine_name: string;
          strength: string | null;
          form: string | null;
          dose_amount: string | null;
          frequency_raw: string | null;
          frequency_code: 'OD' | 'BD' | 'TDS' | 'QID' | 'QHS' | 'PRN' | 'SOS' | 'STAT' | 'WEEKLY' | 'CUSTOM' | null;
          duration_raw: string | null;
          duration_days: number | null;
          start_date: string;
          end_date: string | null;
          instructions: string | null;
          with_food: boolean | null;
          is_ongoing: boolean;
          is_otc: boolean;
          unit_cost: number | null;
          currency: string;
          discontinued_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          profile_id: string;
          visit_id?: string | null;
          medicine_name: string;
          strength?: string | null;
          form?: string | null;
          dose_amount?: string | null;
          frequency_raw?: string | null;
          frequency_code?: 'OD' | 'BD' | 'TDS' | 'QID' | 'QHS' | 'PRN' | 'SOS' | 'STAT' | 'WEEKLY' | 'CUSTOM' | null;
          duration_raw?: string | null;
          duration_days?: number | null;
          start_date: string;
          end_date?: string | null;
          instructions?: string | null;
          with_food?: boolean | null;
          is_ongoing?: boolean;
          is_otc?: boolean;
          unit_cost?: number | null;
          currency?: string;
          discontinued_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          profile_id?: string;
          visit_id?: string | null;
          medicine_name?: string;
          strength?: string | null;
          form?: string | null;
          dose_amount?: string | null;
          frequency_raw?: string | null;
          frequency_code?: 'OD' | 'BD' | 'TDS' | 'QID' | 'QHS' | 'PRN' | 'SOS' | 'STAT' | 'WEEKLY' | 'CUSTOM' | null;
          duration_raw?: string | null;
          duration_days?: number | null;
          start_date?: string;
          end_date?: string | null;
          instructions?: string | null;
          with_food?: boolean | null;
          is_ongoing?: boolean;
          is_otc?: boolean;
          unit_cost?: number | null;
          currency?: string;
          discontinued_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      doses: {
        Row: {
          id: string;
          user_id: string;
          profile_id: string;
          medicine_id: string;
          scheduled_date: string;
          scheduled_minutes: number;
          status: 'pending' | 'taken' | 'skipped' | 'missed';
          taken_at: string | null;
          skipped_reason: string | null;
          snoozed_until: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          profile_id: string;
          medicine_id: string;
          scheduled_date: string;
          scheduled_minutes: number;
          status?: 'pending' | 'taken' | 'skipped' | 'missed';
          taken_at?: string | null;
          skipped_reason?: string | null;
          snoozed_until?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          profile_id?: string;
          medicine_id?: string;
          scheduled_date?: string;
          scheduled_minutes?: number;
          status?: 'pending' | 'taken' | 'skipped' | 'missed';
          taken_at?: string | null;
          skipped_reason?: string | null;
          snoozed_until?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      test_orders: {
        Row: {
          id: string;
          user_id: string;
          profile_id: string;
          visit_id: string | null;
          test_name: string;
          canonical_name: string | null;
          status: 'pending' | 'scheduled' | 'completed' | 'cancelled';
          ordered_date: string;
          scheduled_date: string | null;
          completed_date: string | null;
          report_id: string | null;
          link_method: 'auto' | 'manual' | null;
          estimated_cost: number | null;
          currency: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          profile_id: string;
          visit_id?: string | null;
          test_name: string;
          canonical_name?: string | null;
          status?: 'pending' | 'scheduled' | 'completed' | 'cancelled';
          ordered_date: string;
          scheduled_date?: string | null;
          completed_date?: string | null;
          report_id?: string | null;
          link_method?: 'auto' | 'manual' | null;
          estimated_cost?: number | null;
          currency?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          profile_id?: string;
          visit_id?: string | null;
          test_name?: string;
          canonical_name?: string | null;
          status?: 'pending' | 'scheduled' | 'completed' | 'cancelled';
          ordered_date?: string;
          scheduled_date?: string | null;
          completed_date?: string | null;
          report_id?: string | null;
          link_method?: 'auto' | 'manual' | null;
          estimated_cost?: number | null;
          currency?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      reports: {
        Row: {
          id: string;
          user_id: string;
          profile_id: string;
          title: string;
          report_date: string;
          lab_name: string | null;
          report_cost: number | null;
          currency: string;
          source_type: 'image' | 'pdf' | 'manual';
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          profile_id: string;
          title: string;
          report_date: string;
          lab_name?: string | null;
          report_cost?: number | null;
          currency?: string;
          source_type?: 'image' | 'pdf' | 'manual';
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          profile_id?: string;
          title?: string;
          report_date?: string;
          lab_name?: string | null;
          report_cost?: number | null;
          currency?: string;
          source_type?: 'image' | 'pdf' | 'manual';
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      report_images: {
        Row: {
          id: string;
          user_id: string;
          report_id: string;
          storage_path: string;
          page_number: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          report_id: string;
          storage_path: string;
          page_number?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          report_id?: string;
          storage_path?: string;
          page_number?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      report_results: {
        Row: {
          id: string;
          user_id: string;
          report_id: string;
          test_name: string;
          canonical_name: string | null;
          value_text: string;
          value_numeric: number | null;
          unit: string | null;
          reference_range: string | null;
          ref_low: number | null;
          ref_high: number | null;
          range_status: 'within' | 'below' | 'above' | 'unknown';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          report_id: string;
          test_name: string;
          canonical_name?: string | null;
          value_text: string;
          value_numeric?: number | null;
          unit?: string | null;
          reference_range?: string | null;
          ref_low?: number | null;
          ref_high?: number | null;
          range_status?: 'within' | 'below' | 'above' | 'unknown';
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          report_id?: string;
          test_name?: string;
          canonical_name?: string | null;
          value_text?: string;
          value_numeric?: number | null;
          unit?: string | null;
          reference_range?: string | null;
          ref_low?: number | null;
          ref_high?: number | null;
          range_status?: 'within' | 'below' | 'above' | 'unknown';
          created_at?: string;
        };
        Relationships: [];
      };
      side_effects: {
        Row: {
          id: string;
          user_id: string;
          profile_id: string;
          medicine_id: string | null;
          medicine_name: string;
          note: string;
          severity: 'mild' | 'moderate' | 'severe' | null;
          occurred_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          profile_id: string;
          medicine_id?: string | null;
          medicine_name: string;
          note: string;
          severity?: 'mild' | 'moderate' | 'severe' | null;
          occurred_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          profile_id?: string;
          medicine_id?: string | null;
          medicine_name?: string;
          note?: string;
          severity?: 'mild' | 'moderate' | 'severe' | null;
          occurred_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      extraction_audit: {
        Row: {
          id: string;
          user_id: string;
          entity_type: 'visit' | 'report';
          entity_id: string;
          model: string;
          raw_response: Json;
          confirmed_data: Json;
          edited_fields: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          entity_type: 'visit' | 'report';
          entity_id: string;
          model: string;
          raw_response: Json;
          confirmed_data: Json;
          edited_fields?: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          entity_type?: 'visit' | 'report';
          entity_id?: string;
          model?: string;
          raw_response?: Json;
          confirmed_data?: Json;
          edited_fields?: string[];
          created_at?: string;
        };
        Relationships: [];
      };
      reminder_settings: {
        Row: {
          id: string;
          user_id: string;
          profile_id: string;
          enabled: boolean;
          quiet_hours_start: number | null;
          quiet_hours_end: number | null;
          snooze_minutes: number;
          lead_minutes: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          profile_id: string;
          enabled?: boolean;
          quiet_hours_start?: number | null;
          quiet_hours_end?: number | null;
          snooze_minutes?: number;
          lead_minutes?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          profile_id?: string;
          enabled?: boolean;
          quiet_hours_start?: number | null;
          quiet_hours_end?: number | null;
          snooze_minutes?: number;
          lead_minutes?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      shares: {
        Row: {
          id: string;
          user_id: string;
          profile_id: string;
          token_hash: string;
          snapshot: Json;
          expires_at: string;
          revoked_at: string | null;
          view_count: number;
          last_viewed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          profile_id: string;
          token_hash: string;
          snapshot: Json;
          expires_at: string;
          revoked_at?: string | null;
          view_count?: number;
          last_viewed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          profile_id?: string;
          token_hash?: string;
          snapshot?: Json;
          expires_at?: string;
          revoked_at?: string | null;
          view_count?: number;
          last_viewed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      /**
       * Resolves a raw doctor-share token to the brief it grants access to.
       * Security-definer; returns null for unknown, revoked or expired tokens.
       * Defined in supabase/migrations/0016_share_access_hardening.sql.
       */
      get_shared_brief: {
        Args: { p_token: string };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
  };
};

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type InsertTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type UpdateTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
