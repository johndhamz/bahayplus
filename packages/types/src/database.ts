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
          {
            foreignKeyName: "asset_service_records_booking_fk";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
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
      booking_events: {
        Row: {
          actor_id: string | null;
          actor_side: string;
          booking_id: string;
          created_at: string;
          from_status: string | null;
          household_id: string;
          id: string;
          kind: string;
          organization_id: string;
          payload: NonNullable<Json>;
          to_status: string | null;
        };
        ComputedFields: never;
        Insert: {
          actor_id?: string | null;
          actor_side: string;
          booking_id: string;
          created_at?: string;
          from_status?: string | null;
          household_id: string;
          id?: string;
          kind: string;
          organization_id: string;
          payload?: NonNullable<Json>;
          to_status?: string | null;
        };
        Update: {
          actor_id?: string | null;
          actor_side?: string;
          booking_id?: string;
          created_at?: string;
          from_status?: string | null;
          household_id?: string;
          id?: string;
          kind?: string;
          organization_id?: string;
          payload?: NonNullable<Json>;
          to_status?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "booking_events_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
        ];
      };
      bookings: {
        Row: {
          agreed_amount_centavos: number | null;
          asset_id: string | null;
          cancellation_reason: string | null;
          cancelled_by: string | null;
          completed_at: string | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          customer_confirmation: string | null;
          customer_confirmed_at: string | null;
          customer_notes: string;
          household_id: string;
          id: string;
          idempotency_key: string | null;
          organization_id: string;
          pet_id: string | null;
          pricing_note: string;
          property_id: string | null;
          provider_service_id: string | null;
          quotation_id: string | null;
          scheduled_end: string | null;
          scheduled_start: string | null;
          service_request_id: string | null;
          status: string;
          title: string;
          updated_at: string;
          vehicle_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          agreed_amount_centavos?: number | null;
          asset_id?: string | null;
          cancellation_reason?: string | null;
          cancelled_by?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          customer_confirmation?: string | null;
          customer_confirmed_at?: string | null;
          customer_notes?: string;
          household_id: string;
          id?: string;
          idempotency_key?: string | null;
          organization_id: string;
          pet_id?: string | null;
          pricing_note?: string;
          property_id?: string | null;
          provider_service_id?: string | null;
          quotation_id?: string | null;
          scheduled_end?: string | null;
          scheduled_start?: string | null;
          service_request_id?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
          vehicle_id?: string | null;
        };
        Update: {
          agreed_amount_centavos?: number | null;
          asset_id?: string | null;
          cancellation_reason?: string | null;
          cancelled_by?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          customer_confirmation?: string | null;
          customer_confirmed_at?: string | null;
          customer_notes?: string;
          household_id?: string;
          id?: string;
          idempotency_key?: string | null;
          organization_id?: string;
          pet_id?: string | null;
          pricing_note?: string;
          property_id?: string | null;
          provider_service_id?: string | null;
          quotation_id?: string | null;
          scheduled_end?: string | null;
          scheduled_start?: string | null;
          service_request_id?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
          vehicle_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "bookings_asset_fk";
            columns: ["asset_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id", "household_id"];
          },
          {
            foreignKeyName: "bookings_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_pet_fk";
            columns: ["pet_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "pets";
            referencedColumns: ["id", "household_id"];
          },
          {
            foreignKeyName: "bookings_property_fk";
            columns: ["property_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id", "household_id"];
          },
          {
            foreignKeyName: "bookings_provider_service_id_fkey";
            columns: ["provider_service_id"];
            isOneToOne: false;
            referencedRelation: "provider_services";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_quotation_id_fkey";
            columns: ["quotation_id"];
            isOneToOne: false;
            referencedRelation: "quotations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_service_request_id_fkey";
            columns: ["service_request_id"];
            isOneToOne: false;
            referencedRelation: "service_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_vehicle_fk";
            columns: ["vehicle_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
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
      calendar_assignments: {
        Row: {
          assigned_by: string | null;
          created_at: string;
          household_id: string;
          item_key: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          assigned_by?: string | null;
          created_at?: string;
          household_id: string;
          item_key: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          assigned_by?: string | null;
          created_at?: string;
          household_id?: string;
          item_key?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "calendar_assignments_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      change_orders: {
        Row: {
          amount_delta_centavos: number;
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          decision_note: string | null;
          description: string;
          id: string;
          number: number;
          project_id: string;
          proposed_by: string | null;
          schedule_delta_days: number;
          status: string;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount_delta_centavos: number;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_note?: string | null;
          description?: string;
          id?: string;
          number: number;
          project_id: string;
          proposed_by?: string | null;
          schedule_delta_days?: number;
          status?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          amount_delta_centavos?: number;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_note?: string | null;
          description?: string;
          id?: string;
          number?: number;
          project_id?: string;
          proposed_by?: string | null;
          schedule_delta_days?: number;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "change_orders_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      commission_rates: {
        Row: {
          created_at: string;
          created_by: string | null;
          effective_from: string;
          id: string;
          note: string;
          organization_id: string | null;
          rate_bps: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          effective_from?: string;
          id?: string;
          note?: string;
          organization_id?: string | null;
          rate_bps: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          effective_from?: string;
          id?: string;
          note?: string;
          organization_id?: string | null;
          rate_bps?: number;
        };
        Relationships: [
          {
            foreignKeyName: "commission_rates_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      deliveries: {
        Row: {
          attempts: number;
          buyer_org_id: string;
          courier: string;
          created_at: string;
          delivered_at: string | null;
          failure_reason: string | null;
          id: string;
          purchase_order_id: string;
          received_by: string | null;
          scheduled_for: string | null;
          status: string;
          supplier_org_id: string;
          tracking_ref: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          attempts?: number;
          buyer_org_id: string;
          courier?: string;
          created_at?: string;
          delivered_at?: string | null;
          failure_reason?: string | null;
          id?: string;
          purchase_order_id: string;
          received_by?: string | null;
          scheduled_for?: string | null;
          status?: string;
          supplier_org_id: string;
          tracking_ref?: string;
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          buyer_org_id?: string;
          courier?: string;
          created_at?: string;
          delivered_at?: string | null;
          failure_reason?: string | null;
          id?: string;
          purchase_order_id?: string;
          received_by?: string | null;
          scheduled_for?: string | null;
          status?: string;
          supplier_org_id?: string;
          tracking_ref?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deliveries_purchase_order_id_fkey";
            columns: ["purchase_order_id"];
            isOneToOne: true;
            referencedRelation: "purchase_orders";
            referencedColumns: ["id"];
          },
        ];
      };
      disputes: {
        Row: {
          assigned_to: string | null;
          booking_id: string;
          created_at: string;
          household_id: string;
          id: string;
          organization_id: string;
          raised_by: string | null;
          reason: string;
          resolution: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          status: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          assigned_to?: string | null;
          booking_id: string;
          created_at?: string;
          household_id: string;
          id?: string;
          organization_id: string;
          raised_by?: string | null;
          reason?: string;
          resolution?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          assigned_to?: string | null;
          booking_id?: string;
          created_at?: string;
          household_id?: string;
          id?: string;
          organization_id?: string;
          raised_by?: string | null;
          reason?: string;
          resolution?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "disputes_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "disputes_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "disputes_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
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
      notification_deliveries: {
        Row: {
          attempts: number;
          channel: string;
          created_at: string;
          id: string;
          last_error: string | null;
          max_attempts: number;
          next_attempt_at: string | null;
          notification_id: string;
          provider: string | null;
          provider_message_id: string | null;
          recipient_id: string;
          sent_at: string | null;
          skip_reason: string | null;
          status: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          attempts?: number;
          channel: string;
          created_at?: string;
          id?: string;
          last_error?: string | null;
          max_attempts?: number;
          next_attempt_at?: string | null;
          notification_id: string;
          provider?: string | null;
          provider_message_id?: string | null;
          recipient_id: string;
          sent_at?: string | null;
          skip_reason?: string | null;
          status: string;
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          channel?: string;
          created_at?: string;
          id?: string;
          last_error?: string | null;
          max_attempts?: number;
          next_attempt_at?: string | null;
          notification_id?: string;
          provider?: string | null;
          provider_message_id?: string | null;
          recipient_id?: string;
          sent_at?: string | null;
          skip_reason?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_notification_id_fkey";
            columns: ["notification_id"];
            isOneToOne: false;
            referencedRelation: "notifications";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_preferences: {
        Row: {
          category: string;
          channel: string;
          enabled: boolean;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          category: string;
          channel: string;
          enabled: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          category?: string;
          channel?: string;
          enabled?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          body: string;
          category: string;
          created_at: string;
          dedupe_key: string;
          household_id: string | null;
          id: string;
          kind: string;
          link: string | null;
          organization_id: string | null;
          read_at: string | null;
          recipient_id: string;
          reminder_id: string | null;
          required_permission: string | null;
          show_in_inbox: boolean;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          body?: string;
          category?: string;
          created_at?: string;
          dedupe_key: string;
          household_id?: string | null;
          id?: string;
          kind: string;
          link?: string | null;
          organization_id?: string | null;
          read_at?: string | null;
          recipient_id: string;
          reminder_id?: string | null;
          required_permission?: string | null;
          show_in_inbox?: boolean;
          title: string;
          updated_at?: string;
        };
        Update: {
          body?: string;
          category?: string;
          created_at?: string;
          dedupe_key?: string;
          household_id?: string | null;
          id?: string;
          kind?: string;
          link?: string | null;
          organization_id?: string | null;
          read_at?: string | null;
          recipient_id?: string;
          reminder_id?: string | null;
          required_permission?: string | null;
          show_in_inbox?: boolean;
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
          {
            foreignKeyName: "notifications_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_reminder_fk";
            columns: ["reminder_id"];
            isOneToOne: false;
            referencedRelation: "reminders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_required_permission_fkey";
            columns: ["required_permission"];
            isOneToOne: false;
            referencedRelation: "permissions";
            referencedColumns: ["key"];
          },
        ];
      };
      organization_files: {
        Row: {
          bucket: string;
          content_type: string;
          created_at: string;
          entity_id: string;
          entity_type: string;
          file_name: string;
          id: string;
          object_path: string;
          organization_id: string;
          size_bytes: number;
          updated_at: string;
          uploaded_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          bucket: string;
          content_type: string;
          created_at?: string;
          entity_id: string;
          entity_type: string;
          file_name: string;
          id?: string;
          object_path: string;
          organization_id: string;
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
          id?: string;
          object_path?: string;
          organization_id?: string;
          size_bytes?: number;
          updated_at?: string;
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "organization_files_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
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
      payment_events: {
        Row: {
          actor_id: string | null;
          amount_centavos: number | null;
          created_at: string;
          detail: NonNullable<Json>;
          event_type: string;
          from_status: string | null;
          id: number;
          payment_intent_id: string;
          provider_event_id: string | null;
          refund_id: string | null;
          source: string;
          to_status: string | null;
        };
        ComputedFields: never;
        Insert: {
          actor_id?: string | null;
          amount_centavos?: number | null;
          created_at?: string;
          detail?: NonNullable<Json>;
          event_type: string;
          from_status?: string | null;
          id?: never;
          payment_intent_id: string;
          provider_event_id?: string | null;
          refund_id?: string | null;
          source: string;
          to_status?: string | null;
        };
        Update: {
          actor_id?: string | null;
          amount_centavos?: number | null;
          created_at?: string;
          detail?: NonNullable<Json>;
          event_type?: string;
          from_status?: string | null;
          id?: never;
          payment_intent_id?: string;
          provider_event_id?: string | null;
          refund_id?: string | null;
          source?: string;
          to_status?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payment_events_payment_intent_id_fkey";
            columns: ["payment_intent_id"];
            isOneToOne: false;
            referencedRelation: "payment_intents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_events_refund_id_fkey";
            columns: ["refund_id"];
            isOneToOne: false;
            referencedRelation: "refunds";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_intents: {
        Row: {
          amount_centavos: number;
          amount_refunded_centavos: number;
          booking_id: string | null;
          checkout_url: string | null;
          commission_bps: number | null;
          commission_centavos: number | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          description: string;
          external_reference: string | null;
          failure_code: string | null;
          failure_message: string | null;
          household_id: string;
          id: string;
          idempotency_key: string;
          organization_id: string;
          provider: string;
          status: string;
          succeeded_at: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount_centavos: number;
          amount_refunded_centavos?: number;
          booking_id?: string | null;
          checkout_url?: string | null;
          commission_bps?: number | null;
          commission_centavos?: number | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          description: string;
          external_reference?: string | null;
          failure_code?: string | null;
          failure_message?: string | null;
          household_id: string;
          id?: string;
          idempotency_key: string;
          organization_id: string;
          provider: string;
          status?: string;
          succeeded_at?: string | null;
          updated_at?: string;
        };
        Update: {
          amount_centavos?: number;
          amount_refunded_centavos?: number;
          booking_id?: string | null;
          checkout_url?: string | null;
          commission_bps?: number | null;
          commission_centavos?: number | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          description?: string;
          external_reference?: string | null;
          failure_code?: string | null;
          failure_message?: string | null;
          household_id?: string;
          id?: string;
          idempotency_key?: string;
          organization_id?: string;
          provider?: string;
          status?: string;
          succeeded_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_intents_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_intents_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_intents_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
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
            foreignKeyName: "pet_health_records_booking_fk";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
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
      platform_settings: {
        Row: {
          description: string;
          key: string;
          updated_at: string;
          updated_by: string | null;
          value: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          description?: string;
          key: string;
          updated_at?: string;
          updated_by?: string | null;
          value: NonNullable<Json>;
        };
        Update: {
          description?: string;
          key?: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: NonNullable<Json>;
        };
        Relationships: [];
      };
      portfolio_items: {
        Row: {
          category_id: string | null;
          completed_on: string | null;
          created_at: string;
          description: string;
          id: string;
          organization_id: string;
          sort_order: number;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          category_id?: string | null;
          completed_on?: string | null;
          created_at?: string;
          description?: string;
          id?: string;
          organization_id: string;
          sort_order?: number;
          title: string;
          updated_at?: string;
        };
        Update: {
          category_id?: string | null;
          completed_on?: string | null;
          created_at?: string;
          description?: string;
          id?: string;
          organization_id?: string;
          sort_order?: number;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "portfolio_items_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "service_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "portfolio_items_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          category: string;
          created_at: string;
          currency: string;
          description: string;
          id: string;
          is_active: boolean;
          name: string;
          organization_id: string;
          reorder_level: number;
          sku: string;
          unit: string;
          unit_price_centavos: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          category?: string;
          created_at?: string;
          currency?: string;
          description?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          organization_id: string;
          reorder_level?: number;
          sku: string;
          unit?: string;
          unit_price_centavos: number;
          updated_at?: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          currency?: string;
          description?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          organization_id?: string;
          reorder_level?: number;
          sku?: string;
          unit?: string;
          unit_price_centavos?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
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
      project_milestones: {
        Row: {
          amount_centavos: number | null;
          completed_at: string | null;
          created_at: string;
          due_on: string | null;
          id: string;
          position: number;
          project_id: string;
          status: string;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount_centavos?: number | null;
          completed_at?: string | null;
          created_at?: string;
          due_on?: string | null;
          id?: string;
          position?: number;
          project_id: string;
          status?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          amount_centavos?: number | null;
          completed_at?: string | null;
          created_at?: string;
          due_on?: string | null;
          id?: string;
          position?: number;
          project_id?: string;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_milestones_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      project_updates: {
        Row: {
          author_id: string | null;
          author_side: string;
          body: string;
          created_at: string;
          id: string;
          percent_complete: number | null;
          project_id: string;
        };
        ComputedFields: never;
        Insert: {
          author_id?: string | null;
          author_side: string;
          body: string;
          created_at?: string;
          id?: string;
          percent_complete?: number | null;
          project_id: string;
        };
        Update: {
          author_id?: string | null;
          author_side?: string;
          body?: string;
          created_at?: string;
          id?: string;
          percent_complete?: number | null;
          project_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_updates_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      projects: {
        Row: {
          approved_changes_centavos: number;
          completed_at: string | null;
          contract_amount_centavos: number | null;
          contract_quotation_id: string | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          description: string;
          household_id: string;
          id: string;
          kind: string;
          organization_id: string;
          property_id: string;
          service_request_id: string | null;
          site_visit_at: string | null;
          start_date: string | null;
          status: string;
          target_end_date: string | null;
          title: string;
          updated_at: string;
          warranty_terms: string;
          warranty_until: string | null;
        };
        ComputedFields: never;
        Insert: {
          approved_changes_centavos?: number;
          completed_at?: string | null;
          contract_amount_centavos?: number | null;
          contract_quotation_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          description?: string;
          household_id: string;
          id?: string;
          kind: string;
          organization_id: string;
          property_id: string;
          service_request_id?: string | null;
          site_visit_at?: string | null;
          start_date?: string | null;
          status?: string;
          target_end_date?: string | null;
          title: string;
          updated_at?: string;
          warranty_terms?: string;
          warranty_until?: string | null;
        };
        Update: {
          approved_changes_centavos?: number;
          completed_at?: string | null;
          contract_amount_centavos?: number | null;
          contract_quotation_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          description?: string;
          household_id?: string;
          id?: string;
          kind?: string;
          organization_id?: string;
          property_id?: string;
          service_request_id?: string | null;
          site_visit_at?: string | null;
          start_date?: string | null;
          status?: string;
          target_end_date?: string | null;
          title?: string;
          updated_at?: string;
          warranty_terms?: string;
          warranty_until?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "projects_contract_quotation_id_fkey";
            columns: ["contract_quotation_id"];
            isOneToOne: false;
            referencedRelation: "quotations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_property_id_household_id_fkey";
            columns: ["property_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id", "household_id"];
          },
          {
            foreignKeyName: "projects_service_request_id_fkey";
            columns: ["service_request_id"];
            isOneToOne: false;
            referencedRelation: "service_requests";
            referencedColumns: ["id"];
          },
        ];
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
      provider_profiles: {
        Row: {
          accepts_book_now: boolean;
          accepts_contact: boolean;
          accepts_quote_requests: boolean;
          accepts_urgent: boolean;
          availability_status: string;
          availability_updated_at: string | null;
          business_hours: NonNullable<Json>;
          concurrent_capacity: number;
          created_at: string;
          description: string;
          email: string;
          is_published: boolean;
          messenger_url: string;
          organization_id: string;
          phone: string;
          rating_count: number;
          rating_sum: number;
          tagline: string;
          team_size: number | null;
          updated_at: string;
          website: string;
          year_established: number | null;
        };
        ComputedFields: never;
        Insert: {
          accepts_book_now?: boolean;
          accepts_contact?: boolean;
          accepts_quote_requests?: boolean;
          accepts_urgent?: boolean;
          availability_status?: string;
          availability_updated_at?: string | null;
          business_hours?: NonNullable<Json>;
          concurrent_capacity?: number;
          created_at?: string;
          description?: string;
          email?: string;
          is_published?: boolean;
          messenger_url?: string;
          organization_id: string;
          phone?: string;
          rating_count?: number;
          rating_sum?: number;
          tagline?: string;
          team_size?: number | null;
          updated_at?: string;
          website?: string;
          year_established?: number | null;
        };
        Update: {
          accepts_book_now?: boolean;
          accepts_contact?: boolean;
          accepts_quote_requests?: boolean;
          accepts_urgent?: boolean;
          availability_status?: string;
          availability_updated_at?: string | null;
          business_hours?: NonNullable<Json>;
          concurrent_capacity?: number;
          created_at?: string;
          description?: string;
          email?: string;
          is_published?: boolean;
          messenger_url?: string;
          organization_id?: string;
          phone?: string;
          rating_count?: number;
          rating_sum?: number;
          tagline?: string;
          team_size?: number | null;
          updated_at?: string;
          website?: string;
          year_established?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "provider_profiles_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      provider_services: {
        Row: {
          allows_book_now: boolean;
          allows_quote: boolean;
          category_id: string;
          created_at: string;
          currency: string;
          description: string;
          duration_minutes: number | null;
          id: string;
          is_active: boolean;
          organization_id: string;
          price_centavos: number | null;
          pricing_model: string;
          title: string;
          unit_label: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          allows_book_now?: boolean;
          allows_quote?: boolean;
          category_id: string;
          created_at?: string;
          currency?: string;
          description?: string;
          duration_minutes?: number | null;
          id?: string;
          is_active?: boolean;
          organization_id: string;
          price_centavos?: number | null;
          pricing_model: string;
          title: string;
          unit_label?: string;
          updated_at?: string;
        };
        Update: {
          allows_book_now?: boolean;
          allows_quote?: boolean;
          category_id?: string;
          created_at?: string;
          currency?: string;
          description?: string;
          duration_minutes?: number | null;
          id?: string;
          is_active?: boolean;
          organization_id?: string;
          price_centavos?: number | null;
          pricing_model?: string;
          title?: string;
          unit_label?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "provider_services_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "service_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "provider_services_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_order_lines: {
        Row: {
          id: string;
          line_total_centavos: number | null;
          product_id: string;
          product_name: string;
          purchase_order_id: string;
          quantity: number;
          sku: string;
          supplier_org_id: string;
          unit: string;
          unit_price_centavos: number;
        };
        ComputedFields: never;
        Insert: {
          id?: string;
          line_total_centavos?: never;
          product_id: string;
          product_name: string;
          purchase_order_id: string;
          quantity: number;
          sku: string;
          supplier_org_id: string;
          unit: string;
          unit_price_centavos: number;
        };
        Update: {
          id?: string;
          line_total_centavos?: never;
          product_id?: string;
          product_name?: string;
          purchase_order_id?: string;
          quantity?: number;
          sku?: string;
          supplier_org_id?: string;
          unit?: string;
          unit_price_centavos?: number;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_order_lines_product_id_supplier_org_id_fkey";
            columns: ["product_id", "supplier_org_id"];
            isOneToOne: false;
            referencedRelation: "product_inventory";
            referencedColumns: ["product_id", "organization_id"];
          },
          {
            foreignKeyName: "purchase_order_lines_product_id_supplier_org_id_fkey";
            columns: ["product_id", "supplier_org_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "purchase_order_lines_purchase_order_id_fkey";
            columns: ["purchase_order_id"];
            isOneToOne: false;
            referencedRelation: "purchase_orders";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_orders: {
        Row: {
          accepted_at: string | null;
          buyer_name: string;
          buyer_notes: string;
          buyer_org_id: string;
          cancelled_by: string | null;
          closed_at: string | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          decision_reason: string | null;
          delivered_at: string | null;
          delivery_address: string;
          delivery_contact: string;
          id: string;
          idempotency_key: string;
          number: number;
          requested_delivery_on: string | null;
          shipped_at: string | null;
          status: string;
          submitted_at: string;
          supplier_name: string;
          supplier_notes: string;
          supplier_org_id: string;
          total_centavos: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          accepted_at?: string | null;
          buyer_name: string;
          buyer_notes?: string;
          buyer_org_id: string;
          cancelled_by?: string | null;
          closed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          decision_reason?: string | null;
          delivered_at?: string | null;
          delivery_address: string;
          delivery_contact?: string;
          id?: string;
          idempotency_key: string;
          number?: never;
          requested_delivery_on?: string | null;
          shipped_at?: string | null;
          status?: string;
          submitted_at?: string;
          supplier_name: string;
          supplier_notes?: string;
          supplier_org_id: string;
          total_centavos?: number;
          updated_at?: string;
        };
        Update: {
          accepted_at?: string | null;
          buyer_name?: string;
          buyer_notes?: string;
          buyer_org_id?: string;
          cancelled_by?: string | null;
          closed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          decision_reason?: string | null;
          delivered_at?: string | null;
          delivery_address?: string;
          delivery_contact?: string;
          id?: string;
          idempotency_key?: string;
          number?: never;
          requested_delivery_on?: string | null;
          shipped_at?: string | null;
          status?: string;
          submitted_at?: string;
          supplier_name?: string;
          supplier_notes?: string;
          supplier_org_id?: string;
          total_centavos?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_orders_buyer_org_id_fkey";
            columns: ["buyer_org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_orders_supplier_org_id_fkey";
            columns: ["supplier_org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      quotation_lines: {
        Row: {
          created_at: string;
          description: string;
          id: string;
          line_total_centavos: number | null;
          position: number;
          quantity: number;
          quotation_id: string;
          unit_label: string;
          unit_price_centavos: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          description: string;
          id?: string;
          line_total_centavos?: never;
          position?: number;
          quantity: number;
          quotation_id: string;
          unit_label?: string;
          unit_price_centavos: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          id?: string;
          line_total_centavos?: never;
          position?: number;
          quantity?: number;
          quotation_id?: string;
          unit_label?: string;
          unit_price_centavos?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quotation_lines_quotation_id_fkey";
            columns: ["quotation_id"];
            isOneToOne: false;
            referencedRelation: "quotations";
            referencedColumns: ["id"];
          },
        ];
      };
      quotations: {
        Row: {
          created_at: string;
          created_by: string | null;
          currency: string;
          decided_at: string | null;
          decided_by: string | null;
          household_id: string;
          id: string;
          notes: string;
          organization_id: string;
          sent_at: string | null;
          service_request_id: string;
          status: string;
          total_centavos: number;
          updated_at: string;
          valid_until: string | null;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          household_id: string;
          id?: string;
          notes?: string;
          organization_id: string;
          sent_at?: string | null;
          service_request_id: string;
          status?: string;
          total_centavos?: number;
          updated_at?: string;
          valid_until?: string | null;
          version: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          household_id?: string;
          id?: string;
          notes?: string;
          organization_id?: string;
          sent_at?: string | null;
          service_request_id?: string;
          status?: string;
          total_centavos?: number;
          updated_at?: string;
          valid_until?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "quotations_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quotations_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quotations_service_request_id_fkey";
            columns: ["service_request_id"];
            isOneToOne: false;
            referencedRelation: "service_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      reconciliation_items: {
        Row: {
          external_reference: string;
          id: string;
          ledger_amount_centavos: number | null;
          ledger_status: string | null;
          payment_intent_id: string | null;
          provider_amount_centavos: number | null;
          provider_status: string | null;
          result: string;
          run_id: string;
        };
        ComputedFields: never;
        Insert: {
          external_reference: string;
          id?: string;
          ledger_amount_centavos?: number | null;
          ledger_status?: string | null;
          payment_intent_id?: string | null;
          provider_amount_centavos?: number | null;
          provider_status?: string | null;
          result: string;
          run_id: string;
        };
        Update: {
          external_reference?: string;
          id?: string;
          ledger_amount_centavos?: number | null;
          ledger_status?: string | null;
          payment_intent_id?: string | null;
          provider_amount_centavos?: number | null;
          provider_status?: string | null;
          result?: string;
          run_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reconciliation_items_payment_intent_id_fkey";
            columns: ["payment_intent_id"];
            isOneToOne: false;
            referencedRelation: "payment_intents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reconciliation_items_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "reconciliation_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      reconciliation_runs: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          matched: number;
          mismatched: number;
          period_from: string;
          period_to: string;
          provider: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          matched?: number;
          mismatched?: number;
          period_from: string;
          period_to: string;
          provider: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          matched?: number;
          mismatched?: number;
          period_from?: string;
          period_to?: string;
          provider?: string;
        };
        Relationships: [];
      };
      refunds: {
        Row: {
          amount_centavos: number;
          created_at: string;
          external_reference: string | null;
          failure_message: string | null;
          household_id: string;
          id: string;
          idempotency_key: string;
          organization_id: string;
          payment_intent_id: string;
          provider: string;
          reason: string;
          requested_by: string | null;
          status: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount_centavos: number;
          created_at?: string;
          external_reference?: string | null;
          failure_message?: string | null;
          household_id: string;
          id?: string;
          idempotency_key: string;
          organization_id: string;
          payment_intent_id: string;
          provider: string;
          reason: string;
          requested_by?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          amount_centavos?: number;
          created_at?: string;
          external_reference?: string | null;
          failure_message?: string | null;
          household_id?: string;
          id?: string;
          idempotency_key?: string;
          organization_id?: string;
          payment_intent_id?: string;
          provider?: string;
          reason?: string;
          requested_by?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "refunds_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "refunds_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "refunds_payment_intent_id_fkey";
            columns: ["payment_intent_id"];
            isOneToOne: false;
            referencedRelation: "payment_intents";
            referencedColumns: ["id"];
          },
        ];
      };
      reminders: {
        Row: {
          attempts: number;
          audience_permission: string;
          body: string;
          cancel_reason: string | null;
          category: string;
          created_at: string;
          dedupe_key: string;
          due_at: string | null;
          due_on: string | null;
          household_id: string;
          id: string;
          kind: string;
          last_error: string | null;
          link: string | null;
          processed_at: string | null;
          recipients: number | null;
          remind_at: string;
          source_id: string;
          source_type: string;
          status: string;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          attempts?: number;
          audience_permission: string;
          body?: string;
          cancel_reason?: string | null;
          category: string;
          created_at?: string;
          dedupe_key: string;
          due_at?: string | null;
          due_on?: string | null;
          household_id: string;
          id?: string;
          kind: string;
          last_error?: string | null;
          link?: string | null;
          processed_at?: string | null;
          recipients?: number | null;
          remind_at: string;
          source_id: string;
          source_type: string;
          status?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          audience_permission?: string;
          body?: string;
          cancel_reason?: string | null;
          category?: string;
          created_at?: string;
          dedupe_key?: string;
          due_at?: string | null;
          due_on?: string | null;
          household_id?: string;
          id?: string;
          kind?: string;
          last_error?: string | null;
          link?: string | null;
          processed_at?: string | null;
          recipients?: number | null;
          remind_at?: string;
          source_id?: string;
          source_type?: string;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reminders_audience_permission_fkey";
            columns: ["audience_permission"];
            isOneToOne: false;
            referencedRelation: "permissions";
            referencedColumns: ["key"];
          },
          {
            foreignKeyName: "reminders_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      reviews: {
        Row: {
          booking_id: string;
          comment: string;
          created_at: string;
          household_id: string;
          id: string;
          organization_id: string;
          provider_replied_at: string | null;
          provider_reply: string | null;
          rating: number;
          reviewer_id: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          booking_id: string;
          comment?: string;
          created_at?: string;
          household_id: string;
          id?: string;
          organization_id: string;
          provider_replied_at?: string | null;
          provider_reply?: string | null;
          rating: number;
          reviewer_id?: string | null;
          updated_at?: string;
        };
        Update: {
          booking_id?: string;
          comment?: string;
          created_at?: string;
          household_id?: string;
          id?: string;
          organization_id?: string;
          provider_replied_at?: string | null;
          provider_reply?: string | null;
          rating?: number;
          reviewer_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: true;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
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
      service_areas: {
        Row: {
          barangay: string | null;
          barangay_norm: string | null;
          city_municipality: string | null;
          city_norm: string | null;
          created_at: string;
          id: string;
          organization_id: string;
          province: string;
          province_norm: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          barangay?: string | null;
          barangay_norm?: never;
          city_municipality?: string | null;
          city_norm?: never;
          created_at?: string;
          id?: string;
          organization_id: string;
          province: string;
          province_norm?: never;
          updated_at?: string;
        };
        Update: {
          barangay?: string | null;
          barangay_norm?: never;
          city_municipality?: string | null;
          city_norm?: never;
          created_at?: string;
          id?: string;
          organization_id?: string;
          province?: string;
          province_norm?: never;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "service_areas_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      service_categories: {
        Row: {
          created_at: string;
          description: string;
          division: string;
          id: string;
          is_active: boolean;
          name: string;
          slug: string;
          sort_order: number;
          updated_at: string;
          urgent_eligible: boolean;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          description?: string;
          division: string;
          id?: string;
          is_active?: boolean;
          name: string;
          slug: string;
          sort_order?: number;
          updated_at?: string;
          urgent_eligible?: boolean;
        };
        Update: {
          created_at?: string;
          description?: string;
          division?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
          urgent_eligible?: boolean;
        };
        Relationships: [];
      };
      service_requests: {
        Row: {
          asset_id: string | null;
          category_id: string | null;
          created_at: string;
          created_by: string | null;
          description: string;
          household_id: string;
          id: string;
          idempotency_key: string;
          organization_id: string;
          pet_id: string | null;
          preferred_date: string | null;
          property_id: string;
          provider_service_id: string | null;
          status: string;
          title: string;
          updated_at: string;
          vehicle_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          asset_id?: string | null;
          category_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string;
          household_id: string;
          id?: string;
          idempotency_key: string;
          organization_id: string;
          pet_id?: string | null;
          preferred_date?: string | null;
          property_id: string;
          provider_service_id?: string | null;
          status?: string;
          title: string;
          updated_at?: string;
          vehicle_id?: string | null;
        };
        Update: {
          asset_id?: string | null;
          category_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string;
          household_id?: string;
          id?: string;
          idempotency_key?: string;
          organization_id?: string;
          pet_id?: string | null;
          preferred_date?: string | null;
          property_id?: string;
          provider_service_id?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
          vehicle_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "service_requests_asset_id_household_id_fkey";
            columns: ["asset_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id", "household_id"];
          },
          {
            foreignKeyName: "service_requests_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "service_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_requests_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_requests_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_requests_pet_id_household_id_fkey";
            columns: ["pet_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "pets";
            referencedColumns: ["id", "household_id"];
          },
          {
            foreignKeyName: "service_requests_property_id_household_id_fkey";
            columns: ["property_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id", "household_id"];
          },
          {
            foreignKeyName: "service_requests_provider_service_id_fkey";
            columns: ["provider_service_id"];
            isOneToOne: false;
            referencedRelation: "provider_services";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_requests_vehicle_id_household_id_fkey";
            columns: ["vehicle_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id", "household_id"];
          },
        ];
      };
      settlement_items: {
        Row: {
          commission_centavos: number;
          gross_centavos: number;
          id: string;
          kind: string;
          net_centavos: number;
          payment_intent_id: string;
          refund_id: string | null;
          refunds_centavos: number;
          settlement_id: string;
        };
        ComputedFields: never;
        Insert: {
          commission_centavos: number;
          gross_centavos: number;
          id?: string;
          kind: string;
          net_centavos: number;
          payment_intent_id: string;
          refund_id?: string | null;
          refunds_centavos: number;
          settlement_id: string;
        };
        Update: {
          commission_centavos?: number;
          gross_centavos?: number;
          id?: string;
          kind?: string;
          net_centavos?: number;
          payment_intent_id?: string;
          refund_id?: string | null;
          refunds_centavos?: number;
          settlement_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "settlement_items_payment_intent_id_fkey";
            columns: ["payment_intent_id"];
            isOneToOne: false;
            referencedRelation: "payment_intents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "settlement_items_refund_id_fkey";
            columns: ["refund_id"];
            isOneToOne: false;
            referencedRelation: "refunds";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "settlement_items_settlement_id_fkey";
            columns: ["settlement_id"];
            isOneToOne: false;
            referencedRelation: "settlements";
            referencedColumns: ["id"];
          },
        ];
      };
      settlements: {
        Row: {
          approved_by: string | null;
          commission_centavos: number;
          created_at: string;
          created_by: string | null;
          gross_centavos: number;
          id: string;
          item_count: number;
          net_centavos: number;
          organization_id: string;
          payout_reference: string | null;
          period_end: string;
          refunds_centavos: number;
          status: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          approved_by?: string | null;
          commission_centavos: number;
          created_at?: string;
          created_by?: string | null;
          gross_centavos: number;
          id?: string;
          item_count: number;
          net_centavos: number;
          organization_id: string;
          payout_reference?: string | null;
          period_end: string;
          refunds_centavos: number;
          status?: string;
          updated_at?: string;
        };
        Update: {
          approved_by?: string | null;
          commission_centavos?: number;
          created_at?: string;
          created_by?: string | null;
          gross_centavos?: number;
          id?: string;
          item_count?: number;
          net_centavos?: number;
          organization_id?: string;
          payout_reference?: string | null;
          period_end?: string;
          refunds_centavos?: number;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "settlements_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_movements: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          idempotency_key: string;
          note: string;
          organization_id: string;
          product_id: string;
          purchase_order_id: string | null;
          quantity: number;
          reason: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          idempotency_key: string;
          note?: string;
          organization_id: string;
          product_id: string;
          purchase_order_id?: string | null;
          quantity: number;
          reason: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          idempotency_key?: string;
          note?: string;
          organization_id?: string;
          product_id?: string;
          purchase_order_id?: string | null;
          quantity?: number;
          reason?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_movements_po_fk";
            columns: ["purchase_order_id"];
            isOneToOne: false;
            referencedRelation: "purchase_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_product_id_organization_id_fkey";
            columns: ["product_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "product_inventory";
            referencedColumns: ["product_id", "organization_id"];
          },
          {
            foreignKeyName: "stock_movements_product_id_organization_id_fkey";
            columns: ["product_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      supplier_profiles: {
        Row: {
          address: string;
          created_at: string;
          delivery_areas: string;
          description: string;
          email: string;
          is_published: boolean;
          min_order_centavos: number;
          organization_id: string;
          phone: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          address?: string;
          created_at?: string;
          delivery_areas?: string;
          description?: string;
          email?: string;
          is_published?: boolean;
          min_order_centavos?: number;
          organization_id: string;
          phone?: string;
          updated_at?: string;
        };
        Update: {
          address?: string;
          created_at?: string;
          delivery_areas?: string;
          description?: string;
          email?: string;
          is_published?: boolean;
          min_order_centavos?: number;
          organization_id?: string;
          phone?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "supplier_profiles_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
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
            foreignKeyName: "vehicle_service_records_booking_fk";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
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
      verification_items: {
        Row: {
          created_at: string;
          id: string;
          item_type: string;
          organization_id: string;
          reference_number: string;
          request_id: string;
          reviewer_note: string;
          status: string;
          updated_at: string;
          valid_until: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          item_type: string;
          organization_id: string;
          reference_number?: string;
          request_id: string;
          reviewer_note?: string;
          status?: string;
          updated_at?: string;
          valid_until?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          item_type?: string;
          organization_id?: string;
          reference_number?: string;
          request_id?: string;
          reviewer_note?: string;
          status?: string;
          updated_at?: string;
          valid_until?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "verification_items_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "verification_items_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "verification_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      verification_requests: {
        Row: {
          created_at: string;
          decided_at: string | null;
          decision_notes: string;
          expires_on: string | null;
          id: string;
          internal_notes: string;
          organization_id: string;
          review_started_at: string | null;
          reviewer_id: string | null;
          revoked_reason: string | null;
          status: string;
          submitted_at: string;
          submitted_by: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          decided_at?: string | null;
          decision_notes?: string;
          expires_on?: string | null;
          id?: string;
          internal_notes?: string;
          organization_id: string;
          review_started_at?: string | null;
          reviewer_id?: string | null;
          revoked_reason?: string | null;
          status?: string;
          submitted_at?: string;
          submitted_by?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          decided_at?: string | null;
          decision_notes?: string;
          expires_on?: string | null;
          id?: string;
          internal_notes?: string;
          organization_id?: string;
          review_started_at?: string | null;
          reviewer_id?: string | null;
          revoked_reason?: string | null;
          status?: string;
          submitted_at?: string;
          submitted_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "verification_requests_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      work_order_assignments: {
        Row: {
          active: boolean;
          assigned_by: string | null;
          created_at: string;
          id: string;
          organization_id: string;
          time_window: unknown;
          unassigned_at: string | null;
          updated_at: string;
          work_order_id: string;
          worker_id: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          assigned_by?: string | null;
          created_at?: string;
          id?: string;
          organization_id: string;
          time_window: unknown;
          unassigned_at?: string | null;
          updated_at?: string;
          work_order_id: string;
          worker_id: string;
        };
        Update: {
          active?: boolean;
          assigned_by?: string | null;
          created_at?: string;
          id?: string;
          organization_id?: string;
          time_window?: unknown;
          unassigned_at?: string | null;
          updated_at?: string;
          work_order_id?: string;
          worker_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "work_order_assignments_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "work_order_assignments_work_order_id_fkey";
            columns: ["work_order_id"];
            isOneToOne: false;
            referencedRelation: "work_orders";
            referencedColumns: ["id"];
          },
        ];
      };
      work_order_checklist_items: {
        Row: {
          created_at: string;
          done_at: string | null;
          done_by: string | null;
          id: string;
          is_done: boolean;
          label: string;
          position: number;
          updated_at: string;
          work_order_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          done_at?: string | null;
          done_by?: string | null;
          id?: string;
          is_done?: boolean;
          label: string;
          position?: number;
          updated_at?: string;
          work_order_id: string;
        };
        Update: {
          created_at?: string;
          done_at?: string | null;
          done_by?: string | null;
          id?: string;
          is_done?: boolean;
          label?: string;
          position?: number;
          updated_at?: string;
          work_order_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "work_order_checklist_items_work_order_id_fkey";
            columns: ["work_order_id"];
            isOneToOne: false;
            referencedRelation: "work_orders";
            referencedColumns: ["id"];
          },
        ];
      };
      work_orders: {
        Row: {
          booking_id: string | null;
          completed_at: string | null;
          completion_notes: string;
          created_at: string;
          created_by: string | null;
          household_id: string;
          id: string;
          instructions: string;
          organization_id: string;
          project_id: string | null;
          scheduled_end: string;
          scheduled_start: string;
          status: string;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          booking_id?: string | null;
          completed_at?: string | null;
          completion_notes?: string;
          created_at?: string;
          created_by?: string | null;
          household_id: string;
          id?: string;
          instructions?: string;
          organization_id: string;
          project_id?: string | null;
          scheduled_end: string;
          scheduled_start: string;
          status?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          booking_id?: string | null;
          completed_at?: string | null;
          completion_notes?: string;
          created_at?: string;
          created_by?: string | null;
          household_id?: string;
          id?: string;
          instructions?: string;
          organization_id?: string;
          project_id?: string | null;
          scheduled_end?: string;
          scheduled_start?: string;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "work_orders_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "work_orders_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "work_orders_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "work_orders_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      product_inventory: {
        Row: {
          is_active: boolean;
          name: string;
          on_hand: number | null;
          organization_id: string;
          product_id: string;
          reorder_level: number;
          reserved: number | null;
          sku: string;
          unit: string;
        };
        ComputedFields: never;
        Insert: {
          is_active?: boolean | null;
          name?: string | null;
          on_hand?: never;
          organization_id?: string | null;
          product_id?: string | null;
          reorder_level?: number | null;
          reserved?: never;
          sku?: string | null;
          unit?: string | null;
        };
        Update: {
          is_active?: boolean | null;
          name?: string | null;
          on_hand?: never;
          organization_id?: string | null;
          product_id?: string | null;
          reorder_level?: number | null;
          reserved?: never;
          sku?: string | null;
          unit?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "products_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
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
      accept_project_quotation: { Args: { p_project: string; p_quotation: string }; Returns: undefined };
      admin_audit_log: {
        Args: { p_action?: string; p_from?: string; p_limit?: number; p_offset?: number; p_to?: string };
        Returns: {
          action: string;
          actor_id: string;
          actor_name: string;
          actor_type: string;
          household_id: string;
          id: string;
          metadata: Json;
          occurred_at: string;
          organization_id: string;
          target_id: string;
          target_type: string;
        }[];
      };
      admin_list_organizations: {
        Args: { p_kind?: string; p_limit?: number; p_offset?: number; p_search?: string; p_status?: string };
        Returns: {
          created_at: string;
          id: string;
          kind: string;
          listed: boolean;
          member_count: number;
          name: string;
          slug: string;
          status: string;
          verification_status: string;
          verified_until: string;
        }[];
      };
      admin_list_users: {
        Args: { p_limit?: number; p_offset?: number; p_search?: string };
        Returns: {
          created_at: string;
          email: string;
          full_name: string;
          household_count: number;
          id: string;
          last_sign_in_at: string;
          organization_count: number;
          platform_role: string;
          suspended: boolean;
        }[];
      };
      admin_overview: { Args: Record<PropertyKey, never>; Returns: Json };
      admin_save_service_category: { Args: { p_payload: Json }; Returns: string };
      admin_set_organization_status: {
        Args: { p_org: string; p_reason: string; p_status: string };
        Returns: undefined;
      };
      admin_set_user_suspension: { Args: { p_reason: string; p_suspend: boolean; p_user: string }; Returns: undefined };
      admin_update_dispute: {
        Args: { p_action: string; p_dispute: string; p_resolution?: string };
        Returns: undefined;
      };
      admin_update_setting: { Args: { p_key: string; p_value: Json }; Returns: undefined };
      apply_payment_event: {
        Args: {
          p_amount_centavos: number;
          p_currency: string;
          p_event_id: string;
          p_event_type: string;
          p_external_reference: string;
          p_payload: Json;
          p_provider: string;
          p_signed_at: string;
        };
        Returns: string;
      };
      assign_calendar_item: { Args: { p_household: string; p_item_key: string; p_user: string }; Returns: undefined };
      assign_work_order: { Args: { p_work_order: string; p_worker: string }; Returns: undefined };
      attach_payment_reference: {
        Args: { p_checkout_url: string; p_external_reference: string; p_intent: string };
        Returns: undefined;
      };
      attach_refund_reference: { Args: { p_external_reference: string; p_refund: string }; Returns: undefined };
      booking_location: {
        Args: { p_booking: string };
        Returns: {
          address_line: string;
          barangay: string;
          city_municipality: string;
          latitude: number;
          longitude: number;
          notes: string;
          postal_code: string;
          property_name: string;
          province: string;
        }[];
      };
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
      cancel_payment_intent: { Args: { p_intent: string }; Returns: undefined };
      cancel_purchase_order: { Args: { p_po: string; p_reason: string }; Returns: undefined };
      change_household_member_role: { Args: { p_member: string; p_role: string }; Returns: undefined };
      change_organization_member_role: { Args: { p_member: string; p_role: string }; Returns: undefined };
      claim_notification_deliveries: {
        Args: { p_batch?: number; p_channel: string; p_visibility_seconds?: number };
        Returns: {
          attempt: number;
          body: string;
          delivery_id: string;
          email: string;
          kind: string;
          link: string;
          msg_id: number;
          title: string;
        }[];
      };
      complete_notification_delivery: {
        Args: { p_delivery: string; p_msg_id: number; p_provider: string; p_provider_message_id?: string };
        Returns: undefined;
      };
      confirm_booking_completion: {
        Args: { p_booking: string; p_note?: string; p_outcome: string };
        Returns: undefined;
      };
      consume_rate_limit: {
        Args: { p_bucket: string; p_key: string; p_limit: number; p_window_seconds: number };
        Returns: boolean;
      };
      create_bill: {
        Args: { p_account: string; p_amount_centavos: number; p_due_on: string; p_notes: string };
        Returns: string;
      };
      create_bill_account: { Args: { p_payload: Json }; Returns: string };
      create_household: { Args: { p_name: string }; Returns: string };
      create_organization: { Args: { p_kind: string; p_name: string; p_slug: string }; Returns: string };
      create_payment_intent: {
        Args: { p_booking: string; p_idempotency_key: string; p_provider: string };
        Returns: string;
      };
      create_project_request: { Args: { p_payload: Json }; Returns: string };
      create_purchase_order: { Args: { p_payload: Json }; Returns: string };
      create_quotation_draft: { Args: { p_request: string }; Returns: string };
      create_service_request: { Args: { p_payload: Json }; Returns: string };
      create_settlement: { Args: { p_org: string; p_period_end: string }; Returns: string };
      create_work_order: { Args: { p_payload: Json }; Returns: string };
      decide_change_order: {
        Args: { p_change_order: string; p_decision: string; p_note?: string };
        Returns: undefined;
      };
      decide_purchase_order: { Args: { p_decision: string; p_note?: string; p_po: string }; Returns: undefined };
      decide_quotation: { Args: { p_decision: string; p_quotation: string; p_start?: string }; Returns: string };
      decide_verification: {
        Args: {
          p_decision: string;
          p_decision_notes: string;
          p_expires_on: string;
          p_internal_notes: string;
          p_item_decisions: Json;
          p_request: string;
        };
        Returns: undefined;
      };
      edit_review: { Args: { p_comment: string; p_rating: number; p_review: string }; Returns: undefined };
      fail_notification_delivery: {
        Args: { p_delivery: string; p_error: string; p_msg_id: number; p_retryable?: boolean };
        Returns: string;
      };
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
      household_calendar: {
        Args: { p_from: string; p_households: string[]; p_to: string };
        Returns: {
          all_day_on: string;
          assignee_id: string;
          category: string;
          ends_at: string;
          household_id: string;
          item_key: string;
          kind: string;
          link: string;
          property_id: string;
          starts_at: string;
          status: string;
          title: string;
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
      normalize_locality: { Args: { p_value: string }; Returns: string };
      post_project_update: { Args: { p_body: string; p_percent?: number; p_project: string }; Returns: string };
      propose_change_order: {
        Args: {
          p_amount_delta: number;
          p_description: string;
          p_project: string;
          p_schedule_delta: number;
          p_title: string;
        };
        Returns: string;
      };
      provider_financial_summary: {
        Args: { p_months?: number; p_org: string };
        Returns: {
          completed_jobs: number;
          job_value_centavos: number;
          month: string;
          project_value_centavos: number;
          projects_completed: number;
          purchases_centavos: number;
        }[];
      };
      provider_serves: {
        Args: { p_barangay: string; p_city: string; p_org: string; p_province: string };
        Returns: boolean;
      };
      provider_verified_items: {
        Args: { p_org: string };
        Returns: {
          item_type: string;
          valid_until: string;
          verified_until: string;
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
      record_stock_movement: {
        Args: { p_idempotency_key: string; p_note: string; p_product: string; p_quantity: number; p_reason: string };
        Returns: string;
      };
      remove_household_member: { Args: { p_member: string }; Returns: undefined };
      remove_organization_member: { Args: { p_member: string }; Returns: undefined };
      reply_to_review: { Args: { p_reply: string; p_review: string }; Returns: undefined };
      request_booking: {
        Args: {
          p_asset?: string;
          p_household: string;
          p_idempotency_key: string;
          p_notes: string;
          p_pet?: string;
          p_property: string;
          p_service: string;
          p_start: string;
          p_vehicle?: string;
        };
        Returns: string;
      };
      request_refund: {
        Args: { p_amount: number; p_idempotency_key: string; p_intent: string; p_reason: string };
        Returns: string;
      };
      reschedule_booking: { Args: { p_booking: string; p_reason: string; p_start: string }; Returns: undefined };
      revoke_household_invitation: { Args: { p_invitation: string }; Returns: undefined };
      revoke_organization_invitation: { Args: { p_invitation: string }; Returns: undefined };
      revoke_verification: { Args: { p_reason: string; p_request: string }; Returns: undefined };
      run_daily_bill_jobs: { Args: { p_today?: string }; Returns: Json };
      run_reconciliation: {
        Args: { p_from: string; p_provider: string; p_report: Json; p_to: string };
        Returns: string;
      };
      run_reminder_worker: { Args: Record<PropertyKey, never>; Returns: Json };
      search_providers: {
        Args: {
          p_barangay?: string;
          p_category?: string;
          p_city?: string;
          p_division?: string;
          p_limit?: number;
          p_offset?: number;
          p_province?: string;
          p_query?: string;
        };
        Returns: {
          accepts_book_now: boolean;
          accepts_quote_requests: boolean;
          availability_status: string;
          availability_updated_at: string;
          categories: string[];
          min_price_centavos: number;
          name: string;
          organization_id: string;
          rating_count: number;
          rating_sum: number;
          slug: string;
          tagline: string;
          verified_items: string[];
        }[];
      };
      search_urgent_providers: {
        Args: { p_barangay?: string; p_category: string; p_city?: string; p_province: string; p_stale_hours?: number };
        Returns: {
          area_label: string;
          availability_status: string;
          availability_updated_at: string;
          is_stale: boolean;
          messenger_url: string;
          name: string;
          organization_id: string;
          phone: string;
          service_titles: string[];
          slug: string;
          tagline: string;
          verified_items: string[];
        }[];
      };
      send_quotation: { Args: { p_quotation: string; p_valid_until: string }; Returns: undefined };
      set_commission_rate: {
        Args: { p_effective_from: string; p_note: string; p_org: string; p_rate_bps: number };
        Returns: undefined;
      };
      set_household_member_status: { Args: { p_member: string; p_status: string }; Returns: undefined };
      set_organization_member_status: { Args: { p_member: string; p_status: string }; Returns: undefined };
      ship_purchase_order: {
        Args: { p_courier: string; p_po: string; p_scheduled_for: string; p_tracking: string };
        Returns: undefined;
      };
      skip_notification_delivery: {
        Args: { p_delivery: string; p_msg_id: number; p_reason: string };
        Returns: undefined;
      };
      start_project_quotation: { Args: { p_project: string }; Returns: string };
      start_verification_review: { Args: { p_request: string }; Returns: undefined };
      submit_review: { Args: { p_booking: string; p_comment: string; p_rating: number }; Returns: string };
      submit_verification_request: { Args: { p_items: Json; p_org: string }; Returns: string };
      supplier_report: {
        Args: { p_months?: number; p_org: string };
        Returns: {
          month: string;
          orders_cancelled: number;
          orders_delivered: number;
          orders_received: number;
          revenue_centavos: number;
        }[];
      };
      supplier_top_products: {
        Args: { p_limit?: number; p_org: string };
        Returns: {
          product_id: string;
          product_name: string;
          quantity: number;
          revenue_centavos: number;
        }[];
      };
      toggle_checklist_item: { Args: { p_done: boolean; p_item: string }; Returns: undefined };
      transition_booking: { Args: { p_action: string; p_booking: string; p_reason?: string }; Returns: undefined };
      update_delivery: { Args: { p_detail?: string; p_po: string; p_status: string }; Returns: undefined };
      update_project: { Args: { p_payload: Json; p_project: string }; Returns: undefined };
      update_settlement_status: {
        Args: { p_payout_reference?: string; p_settlement: string; p_status: string };
        Returns: undefined;
      };
      update_work_order_status: {
        Args: { p_notes?: string; p_status: string; p_work_order: string };
        Returns: undefined;
      };
      void_bill_payment: { Args: { p_payment: string; p_reason: string }; Returns: undefined };
      withdraw_quotation: { Args: { p_quotation: string }; Returns: undefined };
      work_order_location: {
        Args: { p_work_order: string };
        Returns: {
          address_line: string;
          barangay: string;
          city_municipality: string;
          notes: string;
          postal_code: string;
          property_name: string;
          province: string;
        }[];
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
