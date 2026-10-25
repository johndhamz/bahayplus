export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      asset_service_records: {
        Row: {
          asset_id: string;
          booking_id: string | null;
          cost_centavos: number | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          description: string;
          household_id: string;
          id: string;
          kind: string;
          provider_name: string;
          serviced_on: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          asset_id: string;
          booking_id?: string | null;
          cost_centavos?: number | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          description?: string;
          household_id: string;
          id?: string;
          kind: string;
          provider_name?: string;
          serviced_on: string;
          updated_at?: string;
        };
        Update: {
          asset_id?: string;
          booking_id?: string | null;
          cost_centavos?: number | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          description?: string;
          household_id?: string;
          id?: string;
          kind?: string;
          provider_name?: string;
          serviced_on?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "asset_service_records_asset_id_household_id_fkey";
            columns: ["asset_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id", "household_id"];
          },
        ];
      };
      assets: {
        Row: {
          archived_at: string | null;
          brand: string;
          category: string;
          created_at: string;
          created_by: string | null;
          currency: string;
          household_id: string;
          id: string;
          last_maintained_on: string | null;
          maintenance_interval_months: number | null;
          model: string;
          name: string;
          notes: string;
          property_id: string | null;
          purchase_date: string | null;
          purchase_price_centavos: number | null;
          serial_number: string;
          updated_at: string;
          warranty_expires_on: string | null;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          brand?: string;
          category: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          household_id: string;
          id?: string;
          last_maintained_on?: string | null;
          maintenance_interval_months?: number | null;
          model?: string;
          name: string;
          notes?: string;
          property_id?: string | null;
          purchase_date?: string | null;
          purchase_price_centavos?: number | null;
          serial_number?: string;
          updated_at?: string;
          warranty_expires_on?: string | null;
        };
        Update: {
          archived_at?: string | null;
          brand?: string;
          category?: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          household_id?: string;
          id?: string;
          last_maintained_on?: string | null;
          maintenance_interval_months?: number | null;
          model?: string;
          name?: string;
          notes?: string;
          property_id?: string | null;
          purchase_date?: string | null;
          purchase_price_centavos?: number | null;
          serial_number?: string;
          updated_at?: string;
          warranty_expires_on?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "assets_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assets_property_id_household_id_fkey";
            columns: ["property_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id", "household_id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          actor_type: string;
          created_at: string;
          household_id: string | null;
          id: string;
          metadata: NonNullable<Json>;
          occurred_at: string;
          organization_id: string | null;
          target_id: string | null;
          target_type: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          actor_type: string;
          created_at?: string;
          household_id?: string | null;
          id?: string;
          metadata?: NonNullable<Json>;
          occurred_at?: string;
          organization_id?: string | null;
          target_id?: string | null;
          target_type: string;
          updated_at?: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          actor_type?: string;
          created_at?: string;
          household_id?: string | null;
          id?: string;
          metadata?: NonNullable<Json>;
          occurred_at?: string;
          organization_id?: string | null;
          target_id?: string | null;
          target_type?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      bill_accounts: {
        Row: {
          account_number_last4: string;
          amount_type: string;
          archived_at: string | null;
          bill_type: string;
          category_id: string;
          created_at: string;
          created_by: string | null;
          currency: string;
          due_day: number | null;
          ends_on: string | null;
          fixed_amount_centavos: number | null;
          household_id: string;
          id: string;
          is_recurring: boolean;
          nickname: string;
          property_id: string | null;
          provider_name: string;
          reminder_offsets: number[];
          starts_on: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          account_number_last4?: string;
          amount_type: string;
          archived_at?: string | null;
          bill_type: string;
          category_id: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          due_day?: number | null;
          ends_on?: string | null;
          fixed_amount_centavos?: number | null;
          household_id: string;
          id?: string;
          is_recurring?: boolean;
          nickname?: string;
          property_id?: string | null;
          provider_name: string;
          reminder_offsets?: number[];
          starts_on?: string;
          updated_at?: string;
        };
        Update: {
          account_number_last4?: string;
          amount_type?: string;
          archived_at?: string | null;
          bill_type?: string;
          category_id?: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          due_day?: number | null;
          ends_on?: string | null;
          fixed_amount_centavos?: number | null;
          household_id?: string;
          id?: string;
          is_recurring?: boolean;
          nickname?: string;
          property_id?: string | null;
          provider_name?: string;
          reminder_offsets?: number[];
          starts_on?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bill_accounts_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "expense_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bill_accounts_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bill_accounts_property_id_household_id_fkey";
            columns: ["property_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id", "household_id"];
          },
        ];
      };
      bill_payments: {
        Row: {
          amount_centavos: number;
          bill_id: string;
          created_at: string;
          currency: string;
          household_id: string;
          id: string;
          idempotency_key: string;
          method: string;
          paid_on: string;
          recorded_by: string | null;
          reference: string;
          request_hash: string;
          updated_at: string;
          void_reason: string | null;
          voided_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          amount_centavos: number;
          bill_id: string;
          created_at?: string;
          currency?: string;
          household_id: string;
          id?: string;
          idempotency_key: string;
          method: string;
          paid_on: string;
          recorded_by?: string | null;
          reference?: string;
          request_hash: string;
          updated_at?: string;
          void_reason?: string | null;
          voided_at?: string | null;
        };
        Update: {
          amount_centavos?: number;
          bill_id?: string;
          created_at?: string;
          currency?: string;
          household_id?: string;
          id?: string;
          idempotency_key?: string;
          method?: string;
          paid_on?: string;
          recorded_by?: string | null;
          reference?: string;
          request_hash?: string;
          updated_at?: string;
          void_reason?: string | null;
          voided_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "bill_payments_bill_id_household_id_fkey";
            columns: ["bill_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "bills";
            referencedColumns: ["id", "household_id"];
          },
        ];
      };
      bill_reminders: {
        Row: {
          bill_id: string;
          cancel_reason: string | null;
          created_at: string;
          household_id: string;
          id: string;
          offset_days: number;
          processed_at: string | null;
          remind_on: string;
          status: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          bill_id: string;
          cancel_reason?: string | null;
          created_at?: string;
          household_id: string;
          id?: string;
          offset_days: number;
          processed_at?: string | null;
          remind_on: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          bill_id?: string;
          cancel_reason?: string | null;
          created_at?: string;
          household_id?: string;
          id?: string;
          offset_days?: number;
          processed_at?: string | null;
          remind_on?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bill_reminders_bill_id_household_id_fkey";
            columns: ["bill_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "bills";
            referencedColumns: ["id", "household_id"];
          },
        ];
      };
      bills: {
        Row: {
          amount_due_centavos: number | null;
          amount_paid_centavos: number;
          bill_account_id: string;
          created_at: string;
          currency: string;
          due_on: string;
          household_id: string;
          id: string;
          notes: string;
          paid_at: string | null;
          period_end: string;
          period_key: string;
          period_start: string;
          status: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount_due_centavos?: number | null;
          amount_paid_centavos?: number;
          bill_account_id: string;
          created_at?: string;
          currency?: string;
          due_on: string;
          household_id: string;
          id?: string;
          notes?: string;
          paid_at?: string | null;
          period_end: string;
          period_key: string;
          period_start: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          amount_due_centavos?: number | null;
          amount_paid_centavos?: number;
          bill_account_id?: string;
          created_at?: string;
          currency?: string;
          due_on?: string;
          household_id?: string;
          id?: string;
          notes?: string;
          paid_at?: string | null;
          period_end?: string;
          period_key?: string;
          period_start?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bills_bill_account_id_household_id_fkey";
            columns: ["bill_account_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "bill_accounts";
            referencedColumns: ["id", "household_id"];
          },
        ];
      };
      budget_lines: {
        Row: {
          budget_id: string;
          category_id: string;
          created_at: string;
          currency: string;
          household_id: string;
          id: string;
          limit_centavos: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          budget_id: string;
          category_id: string;
          created_at?: string;
          currency?: string;
          household_id: string;
          id?: string;
          limit_centavos: number;
          updated_at?: string;
        };
        Update: {
          budget_id?: string;
          category_id?: string;
          created_at?: string;
          currency?: string;
          household_id?: string;
          id?: string;
          limit_centavos?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "budget_lines_budget_id_household_id_fkey";
            columns: ["budget_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "budgets";
            referencedColumns: ["id", "household_id"];
          },
          {
            foreignKeyName: "budget_lines_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "expense_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      budgets: {
        Row: {
          created_at: string;
          household_id: string;
          id: string;
          month: string;
          notes: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          household_id: string;
          id?: string;
          month: string;
          notes?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          household_id?: string;
          id?: string;
          month?: string;
          notes?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "budgets_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      expense_categories: {
        Row: {
          archived_at: string | null;
          created_at: string;
          household_id: string | null;
          id: string;
          key: string | null;
          name: string;
          sort_order: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          household_id?: string | null;
          id?: string;
          key?: string | null;
          name: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          household_id?: string | null;
          id?: string;
          key?: string | null;
          name?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expense_categories_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      expenses: {
        Row: {
          amount_centavos: number;
          category_id: string;
          created_at: string;
          created_by: string | null;
          currency: string;
          description: string;
          household_id: string;
          id: string;
          payment_method: string;
          property_id: string | null;
          source_id: string | null;
          source_type: string;
          spent_on: string;
          updated_at: string;
          voided_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          amount_centavos: number;
          category_id: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          description?: string;
          household_id: string;
          id?: string;
          payment_method?: string;
          property_id?: string | null;
          source_id?: string | null;
          source_type?: string;
          spent_on: string;
          updated_at?: string;
          voided_at?: string | null;
        };
        Update: {
          amount_centavos?: number;
          category_id?: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          description?: string;
          household_id?: string;
          id?: string;
          payment_method?: string;
          property_id?: string | null;
          source_id?: string | null;
          source_type?: string;
          spent_on?: string;
          updated_at?: string;
          voided_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "expense_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_property_id_household_id_fkey";
            columns: ["property_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id", "household_id"];
          },
        ];
      };
      files: {
        Row: {
          bucket: string;
          content_type: string;
          created_at: string;
          entity_id: string;
          entity_type: string;
          file_name: string;
          household_id: string;
          id: string;
          object_path: string;
          purpose: string;
          size_bytes: number;
          updated_at: string;
          uploaded_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          bucket?: string;
          content_type: string;
          created_at?: string;
          entity_id: string;
          entity_type: string;
          file_name: string;
          household_id: string;
          id?: string;
          object_path: string;
          purpose: string;
          size_bytes: number;
          updated_at?: string;
          uploaded_by?: string | null;
        };
        Update: {
          bucket?: string;
          content_type?: string;
          created_at?: string;
          entity_id?: string;
          entity_type?: string;
          file_name?: string;
          household_id?: string;
          id?: string;
          object_path?: string;
          purpose?: string;
          size_bytes?: number;
          updated_at?: string;
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "files_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      household_activity: {
        Row: {
          actor_id: string | null;
          created_at: string;
          household_id: string;
          id: string;
          kind: string;
          metadata: NonNullable<Json>;
          occurred_at: string;
          property_id: string | null;
          required_permission: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          household_id: string;
          id?: string;
          kind: string;
          metadata?: NonNullable<Json>;
          occurred_at?: string;
          property_id?: string | null;
          required_permission: string;
          updated_at?: string;
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          household_id?: string;
          id?: string;
          kind?: string;
          metadata?: NonNullable<Json>;
          occurred_at?: string;
          property_id?: string | null;
          required_permission?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "household_activity_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "household_activity_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "household_activity_required_permission_fkey";
            columns: ["required_permission"];
            isOneToOne: false;
            referencedRelation: "permissions";
            referencedColumns: ["key"];
          },
        ];
      };
      household_invitations: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          household_id: string;
          id: string;
          invited_by: string | null;
          revoked_at: string | null;
          role_id: string;
          role_scope: string;
          status: string;
          token_hash: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          email: string;
          expires_at: string;
          household_id: string;
          id?: string;
          invited_by?: string | null;
          revoked_at?: string | null;
          role_id: string;
          role_scope?: string;
          status?: string;
          token_hash: string;
          updated_at?: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          email?: string;
          expires_at?: string;
          household_id?: string;
          id?: string;
          invited_by?: string | null;
          revoked_at?: string | null;
          role_id?: string;
          role_scope?: string;
          status?: string;
          token_hash?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "household_invitations_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "household_invitations_role_id_role_scope_fkey";
            columns: ["role_id", "role_scope"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id", "scope"];
          },
        ];
      };
      household_members: {
        Row: {
          created_at: string;
          household_id: string;
          id: string;
          invited_by: string | null;
          joined_at: string;
          role_id: string;
          role_scope: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          household_id: string;
          id?: string;
          invited_by?: string | null;
          joined_at?: string;
          role_id: string;
          role_scope?: string;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          household_id?: string;
          id?: string;
          invited_by?: string | null;
          joined_at?: string;
          role_id?: string;
          role_scope?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "household_members_role_id_role_scope_fkey";
            columns: ["role_id", "role_scope"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id", "scope"];
          },
        ];
      };
      households: {
        Row: {
          archived_at: string | null;
          created_at: string;
          created_by: string | null;
          default_property_id: string | null;
          id: string;
          name: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          default_property_id?: string | null;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          default_property_id?: string | null;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "households_default_property_fk";
            columns: ["default_property_id", "id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id", "household_id"];
          },
        ];
      };
      notifications: {
        Row: {
          body: string;
          created_at: string;
          dedupe_key: string;
          household_id: string | null;
          id: string;
          kind: string;
          link: string | null;
          read_at: string | null;
          recipient_id: string;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          body?: string;
          created_at?: string;
          dedupe_key: string;
          household_id?: string | null;
          id?: string;
          kind: string;
          link?: string | null;
          read_at?: string | null;
          recipient_id: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          dedupe_key?: string;
          household_id?: string | null;
          id?: string;
          kind?: string;
          link?: string | null;
          read_at?: string | null;
          recipient_id?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_invitations: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string | null;
          organization_id: string;
          revoked_at: string | null;
          role_id: string;
          role_scope: string;
          status: string;
          token_hash: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          email: string;
          expires_at: string;
          id?: string;
          invited_by?: string | null;
          organization_id: string;
          revoked_at?: string | null;
          role_id: string;
          role_scope?: string;
          status?: string;
          token_hash: string;
          updated_at?: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          organization_id?: string;
          revoked_at?: string | null;
          role_id?: string;
          role_scope?: string;
          status?: string;
          token_hash?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_invitations_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_invitations_role_id_role_scope_fkey";
            columns: ["role_id", "role_scope"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id", "scope"];
          },
        ];
      };
      organization_members: {
        Row: {
          created_at: string;
          id: string;
          invited_by: string | null;
          joined_at: string;
          organization_id: string;
          role_id: string;
          role_scope: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          invited_by?: string | null;
          joined_at?: string;
          organization_id: string;
          role_id: string;
          role_scope?: string;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          invited_by?: string | null;
          joined_at?: string;
          organization_id?: string;
          role_id?: string;
          role_scope?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_members_role_id_role_scope_fkey";
            columns: ["role_id", "role_scope"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id", "scope"];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          kind: string;
          name: string;
          slug: string;
          status: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind: string;
          name: string;
          slug: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind?: string;
          name?: string;
          slug?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      permissions: {
        Row: {
          created_at: string;
          description: string;
          id: string;
          key: string;
          scope: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          description?: string;
          id?: string;
          key: string;
          scope: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          id?: string;
          key?: string;
          scope?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pet_health_records: {
        Row: {
          booking_id: string | null;
          clinic_or_provider: string;
          cost_centavos: number | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          household_id: string;
          id: string;
          kind: string;
          next_due_on: string | null;
          notes: string;
          occurred_on: string;
          pet_id: string;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          booking_id?: string | null;
          clinic_or_provider?: string;
          cost_centavos?: number | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          household_id: string;
          id?: string;
          kind: string;
          next_due_on?: string | null;
          notes?: string;
          occurred_on: string;
          pet_id: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          booking_id?: string | null;
          clinic_or_provider?: string;
          cost_centavos?: number | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          household_id?: string;
          id?: string;
          kind?: string;
          next_due_on?: string | null;
          notes?: string;
          occurred_on?: string;
          pet_id?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pet_health_records_pet_id_household_id_fkey";
            columns: ["pet_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "pets";
            referencedColumns: ["id", "household_id"];
          },
        ];
      };
      pets: {
        Row: {
          archived_at: string | null;
          birth_date: string | null;
          breed: string;
          care_preferences: string;
          color_markings: string;
          created_at: string;
          created_by: string | null;
          household_id: string;
          id: string;
          microchip_number: string;
          name: string;
          notes: string;
          photo_file_id: string | null;
          sex: string;
          species: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          birth_date?: string | null;
          breed?: string;
          care_preferences?: string;
          color_markings?: string;
          created_at?: string;
          created_by?: string | null;
          household_id: string;
          id?: string;
          microchip_number?: string;
          name: string;
          notes?: string;
          photo_file_id?: string | null;
          sex?: string;
          species: string;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          birth_date?: string | null;
          breed?: string;
          care_preferences?: string;
          color_markings?: string;
          created_at?: string;
          created_by?: string | null;
          household_id?: string;
          id?: string;
          microchip_number?: string;
          name?: string;
          notes?: string;
          photo_file_id?: string | null;
          sex?: string;
          species?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pets_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pets_photo_fk";
            columns: ["photo_file_id"];
            isOneToOne: false;
            referencedRelation: "files";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_admins: {
        Row: {
          created_at: string;
          granted_by: string | null;
          role_id: string;
          role_scope: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          granted_by?: string | null;
          role_id: string;
          role_scope?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          granted_by?: string | null;
          role_id?: string;
          role_scope?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "platform_admins_role_id_role_scope_fkey";
            columns: ["role_id", "role_scope"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id", "scope"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string;
          id: string;
          locale: string;
          phone: string | null;
          timezone: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          full_name?: string;
          id: string;
          locale?: string;
          phone?: string | null;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          full_name?: string;
          id?: string;
          locale?: string;
          phone?: string | null;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      properties: {
        Row: {
          address_line: string;
          archived_at: string | null;
          barangay: string;
          city_municipality: string;
          created_at: string;
          created_by: string | null;
          household_id: string;
          id: string;
          is_active: boolean;
          latitude: number | null;
          longitude: number | null;
          name: string;
          notes: string;
          postal_code: string | null;
          property_type: string;
          province: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          address_line?: string;
          archived_at?: string | null;
          barangay?: string;
          city_municipality?: string;
          created_at?: string;
          created_by?: string | null;
          household_id: string;
          id?: string;
          is_active?: boolean;
          latitude?: number | null;
          longitude?: number | null;
          name: string;
          notes?: string;
          postal_code?: string | null;
          property_type: string;
          province?: string;
          updated_at?: string;
        };
        Update: {
          address_line?: string;
          archived_at?: string | null;
          barangay?: string;
          city_municipality?: string;
          created_at?: string;
          created_by?: string | null;
          household_id?: string;
          id?: string;
          is_active?: boolean;
          latitude?: number | null;
          longitude?: number | null;
          name?: string;
          notes?: string;
          postal_code?: string | null;
          property_type?: string;
          province?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "properties_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      role_permissions: {
        Row: {
          created_at: string;
          permission_id: string;
          role_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          permission_id: string;
          role_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          permission_id?: string;
          role_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey";
            columns: ["permission_id"];
            isOneToOne: false;
            referencedRelation: "permissions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
        ];
      };
      roles: {
        Row: {
          created_at: string;
          description: string;
          id: string;
          key: string;
          name: string;
          rank: number;
          scope: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          description?: string;
          id?: string;
          key: string;
          name: string;
          rank: number;
          scope: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          id?: string;
          key?: string;
          name?: string;
          rank?: number;
          scope?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      vehicle_service_records: {
        Row: {
          booking_id: string | null;
          cost_centavos: number | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          description: string;
          household_id: string;
          id: string;
          kind: string;
          odometer_km: number | null;
          provider_name: string;
          serviced_on: string;
          updated_at: string;
          vehicle_id: string;
        };
        ComputedFields: never;
        Insert: {
          booking_id?: string | null;
          cost_centavos?: number | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          description?: string;
          household_id: string;
          id?: string;
          kind: string;
          odometer_km?: number | null;
          provider_name?: string;
          serviced_on: string;
          updated_at?: string;
          vehicle_id: string;
        };
        Update: {
          booking_id?: string | null;
          cost_centavos?: number | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          description?: string;
          household_id?: string;
          id?: string;
          kind?: string;
          odometer_km?: number | null;
          provider_name?: string;
          serviced_on?: string;
          updated_at?: string;
          vehicle_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vehicle_service_records_vehicle_id_household_id_fkey";
            columns: ["vehicle_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id", "household_id"];
          },
        ];
      };
      vehicles: {
        Row: {
          archived_at: string | null;
          color: string;
          created_at: string;
          created_by: string | null;
          household_id: string;
          id: string;
          insurance_expires_on: string | null;
          insurance_provider: string;
          last_maintained_km: number | null;
          last_maintained_on: string | null;
          maintenance_interval_km: number | null;
          maintenance_interval_months: number | null;
          make: string;
          mileage_km: number | null;
          model: string;
          notes: string;
          plate_number: string;
          registration_expires_on: string | null;
          updated_at: string;
          vehicle_type: string;
          year: number | null;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          color?: string;
          created_at?: string;
          created_by?: string | null;
          household_id: string;
          id?: string;
          insurance_expires_on?: string | null;
          insurance_provider?: string;
          last_maintained_km?: number | null;
          last_maintained_on?: string | null;
          maintenance_interval_km?: number | null;
          maintenance_interval_months?: number | null;
          make: string;
          mileage_km?: number | null;
          model: string;
          notes?: string;
          plate_number?: string;
          registration_expires_on?: string | null;
          updated_at?: string;
          vehicle_type: string;
          year?: number | null;
        };
        Update: {
          archived_at?: string | null;
          color?: string;
          created_at?: string;
          created_by?: string | null;
          household_id?: string;
          id?: string;
          insurance_expires_on?: string | null;
          insurance_provider?: string;
          last_maintained_km?: number | null;
          last_maintained_on?: string | null;
          maintenance_interval_km?: number | null;
          maintenance_interval_months?: number | null;
          make?: string;
          mileage_km?: number | null;
          model?: string;
          notes?: string;
          plate_number?: string;
          registration_expires_on?: string | null;
          updated_at?: string;
          vehicle_type?: string;
          year?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "vehicles_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      registry_due_items: {
        Row: {
          due_kind: string | null;
          due_on: string | null;
          household_id: string | null;
          subject_id: string | null;
          subject_name: string | null;
          subject_type: string | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
    };
    Functions: {
      accept_household_invitation: { Args: { p_token: string }; Returns: string };
      accept_organization_invitation: { Args: { p_token: string }; Returns: string };
      budget_vs_actual: {
        Args: { p_household: string; p_month: string; p_property?: string };
        Returns: {
          category_id: string;
          category_name: string;
          limit_centavos: number;
          sort_order: number;
          spent_centavos: number;
        }[];
      };
      change_household_member_role: { Args: { p_member: string; p_role: string }; Returns: undefined };
      change_organization_member_role: { Args: { p_member: string; p_role: string }; Returns: undefined };
      create_bill: {
        Args: { p_account: string; p_amount_centavos: number; p_due_on: string; p_notes: string };
        Returns: string;
      };
      create_bill_account: { Args: { p_payload: Json }; Returns: string };
      create_household: { Args: { p_name: string }; Returns: string };
      create_organization: { Args: { p_kind: string; p_name: string; p_slug: string }; Returns: string };
      get_household_invitation: {
        Args: { p_token: string };
        Returns: {
          expires_at: string;
          household_name: string;
          invited_email: string;
          role_key: string;
          status: string;
        }[];
      };
      get_organization_invitation: {
        Args: { p_token: string };
        Returns: {
          expires_at: string;
          invited_email: string;
          organization_kind: string;
          organization_name: string;
          role_key: string;
          status: string;
        }[];
      };
      invite_household_member: {
        Args: { p_email: string; p_household: string; p_role: string };
        Returns: {
          expires_at: string;
          invitation_id: string;
          token: string;
        }[];
      };
      invite_organization_member: {
        Args: { p_email: string; p_org: string; p_role: string };
        Returns: {
          expires_at: string;
          invitation_id: string;
          token: string;
        }[];
      };
      monthly_spending: {
        Args: { p_household: string; p_months?: number; p_property?: string };
        Returns: {
          month: string;
          spent_centavos: number;
        }[];
      };
      my_contexts: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
          kind: string;
          name: string;
          org_kind: string;
          role_key: string;
        }[];
      };
      record_bill_payment: {
        Args: {
          p_amount_centavos: number;
          p_bill: string;
          p_idempotency_key: string;
          p_method: string;
          p_paid_on: string;
          p_reference: string;
        };
        Returns: string;
      };
      remove_household_member: { Args: { p_member: string }; Returns: undefined };
      remove_organization_member: { Args: { p_member: string }; Returns: undefined };
      revoke_household_invitation: { Args: { p_invitation: string }; Returns: undefined };
      revoke_organization_invitation: { Args: { p_invitation: string }; Returns: undefined };
      run_daily_bill_jobs: { Args: { p_today?: string }; Returns: Json };
      set_household_member_status: { Args: { p_member: string; p_status: string }; Returns: undefined };
      set_organization_member_status: { Args: { p_member: string; p_status: string }; Returns: undefined };
      void_bill_payment: { Args: { p_payment: string; p_reason: string }; Returns: undefined };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
