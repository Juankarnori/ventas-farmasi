// Tipos escritos a mano siguiendo supabase/migrations/*.sql. Si en algún
// momento corrés `supabase gen types typescript`, este archivo se puede
// reemplazar por el generado (misma forma: Database.public.Tables.*).
//
// `Relationships: []` en cada tabla y `Views: {}` son requeridos por el
// tipo GenericSchema de @supabase/postgrest-js aunque no los usemos (no
// modelamos joins embebidos tipados).

// Lista corta de colores de identidad predefinidos (ver
// src/lib/utils/identity-colors.ts para la correspondencia visual con la
// paleta de la app). Cualquier cantidad de perfiles puede compartir
// color — no hay un límite de "2 colores para 2 personas".
export type ProfileColor = "teal" | "coral" | "gold" | "sage";
export type StockMovementType =
  | "entrada_pedido"
  | "salida_venta"
  | "ajuste_manual"
  | "prestamo"
  | "prestamo_salida"
  | "prestamo_entrada"
  | "devolucion_salida"
  | "devolucion_entrada"
  | "apartado_cancelado"
  | "ajuste_venta"
  | "uso_personal";
export type OrderStatus = "pendiente" | "recibido" | "cancelado";
export type LoanStatus = "pendiente" | "devuelto" | "vendido";
export type LoanValuationType = "costo" | "pvp" | "promocion";
export type LoanSettlementMethod = "efectivo" | "transferencia" | "producto";
export type ExpenseCategory = "envio" | "empaque" | "publicidad" | "otro";
export type PaymentStatus = "pagado" | "con_abonos" | "completado" | "cancelado";
export type AuthorizedEmailStatus = "pendiente" | "activo" | "revocado";
export type FollowUpTriggerType = "despues_de_venta" | "cumpleanos" | "despues_de_contacto";
export type FollowUpTaskStatus = "pendiente" | "hecho" | "omitido";
export type PaymentMethod = "efectivo" | "transferencia";
export type ProspectType = "ingreso" | "venta";
export type ProspectStatus = "pendiente" | "contactado" | "convertido" | "descartado";
export type ProspectAppointmentStatus = "pendiente" | "completada" | "cancelada";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          color: ProfileColor;
          user_id: string | null;
          claimed_at: string | null;
          is_admin: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      authorized_emails: {
        Row: {
          id: string;
          email: string;
          invited_by: string | null;
          invited_at: string;
          status: AuthorizedEmailStatus;
        };
        Insert: Partial<Database["public"]["Tables"]["authorized_emails"]["Row"]> & {
          email: string;
        };
        Update: Partial<Database["public"]["Tables"]["authorized_emails"]["Row"]>;
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          name: string;
          color: string;
          sort_order: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["categories"]["Row"]> & {
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["categories"]["Row"]>;
        Relationships: [];
      };
      product_lines: {
        Row: {
          id: string;
          category_id: string;
          name: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["product_lines"]["Row"]> & {
          category_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["product_lines"]["Row"]>;
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          name: string;
          image_url: string | null;
          category_id: string | null;
          line_id: string | null;
          sale_price: number;
          cost_price: number;
          description: string | null;
          stock: number;
          low_stock_threshold: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["products"]["Row"]> & {
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Row"]>;
        Relationships: [];
      };
      product_variants: {
        Row: {
          id: string;
          product_id: string;
          color_name: string;
          color_hex: string | null;
          sku: string | null;
          stock: number;
          min_stock: number | null;
          price_override: number | null;
          cost_override: number | null;
          image_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["product_variants"]["Row"]> & {
          product_id: string;
          color_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["product_variants"]["Row"]>;
        Relationships: [];
      };
      variant_stock: {
        Row: {
          variant_id: string;
          profile_id: string;
          stock: number;
          min_stock: number | null;
        };
        Insert: Partial<Database["public"]["Tables"]["variant_stock"]["Row"]> & {
          variant_id: string;
          profile_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["variant_stock"]["Row"]>;
        Relationships: [];
      };
      stock_movements: {
        Row: {
          id: string;
          product_id: string;
          variant_id: string;
          profile_id: string;
          type: StockMovementType;
          quantity: number;
          reference_table: "orders" | "sales" | "loans" | null;
          reference_id: string | null;
          note: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["stock_movements"]["Row"]> & {
          product_id: string;
          variant_id: string;
          profile_id: string;
          type: StockMovementType;
          quantity: number;
        };
        Update: Partial<Database["public"]["Tables"]["stock_movements"]["Row"]>;
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          status: OrderStatus;
          order_date: string;
          received_at: string | null;
          cancelled_at: string | null;
          total_cost: number;
          // N° de referencia que da Farmasi a esta compra (opcional) y
          // cuánto de tarjeta de regalo/bono se aplicó — "total a pagar"
          // (total_cost - gift_card_amount) se calcula en la UI, no se
          // guarda aparte.
          farmasi_order_number: string | null;
          gift_card_amount: number;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["orders"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["orders"]["Row"]>;
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string;
          variant_id: string;
          quantity: number;
          unit_cost: number;
        };
        Insert: Partial<Database["public"]["Tables"]["order_items"]["Row"]> & {
          order_id: string;
          product_id: string;
          variant_id: string;
          quantity: number;
          unit_cost: number;
        };
        Update: Partial<Database["public"]["Tables"]["order_items"]["Row"]>;
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          name: string;
          phone: string | null;
          notes: string | null;
          birth_date: string | null;
          archived_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["customers"]["Row"]> & {
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["customers"]["Row"]>;
        Relationships: [];
      };
      follow_up_rules: {
        Row: {
          id: string;
          name: string;
          trigger_type: FollowUpTriggerType;
          days_after: number | null;
          message_template: string;
          active: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["follow_up_rules"]["Row"]> & {
          name: string;
          trigger_type: FollowUpTriggerType;
          message_template: string;
        };
        Update: Partial<Database["public"]["Tables"]["follow_up_rules"]["Row"]>;
        Relationships: [];
      };
      follow_up_tasks: {
        Row: {
          id: string;
          // Exactamente uno de los dos está seteado (constraint
          // follow_up_tasks_customer_xor_prospect_check) — una tarea es
          // de una clienta o de un prospecto, nunca ninguno ni los dos.
          customer_id: string | null;
          prospect_id: string | null;
          rule_id: string;
          due_date: string;
          status: FollowUpTaskStatus;
          sale_id: string | null;
          message_preview: string;
          created_at: string;
          completed_at: string | null;
          completed_by: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["follow_up_tasks"]["Row"]> & {
          rule_id: string;
          due_date: string;
          message_preview: string;
        };
        Update: Partial<Database["public"]["Tables"]["follow_up_tasks"]["Row"]>;
        Relationships: [];
      };
      prospects: {
        Row: {
          id: string;
          name: string;
          phone: string | null;
          type: ProspectType;
          note: string | null;
          status: ProspectStatus;
          first_contact_date: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["prospects"]["Row"]> & {
          name: string;
          type: ProspectType;
        };
        Update: Partial<Database["public"]["Tables"]["prospects"]["Row"]>;
        Relationships: [];
      };
      prospect_appointments: {
        Row: {
          id: string;
          prospect_id: string;
          scheduled_at: string;
          note: string | null;
          status: ProspectAppointmentStatus;
          reminder_sent: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["prospect_appointments"]["Row"]> & {
          prospect_id: string;
          scheduled_at: string;
        };
        Update: Partial<Database["public"]["Tables"]["prospect_appointments"]["Row"]>;
        Relationships: [];
      };
      sales: {
        Row: {
          id: string;
          sale_date: string;
          customer_name: string | null;
          customer_phone: string | null;
          customer_id: string | null;
          seller_profile_id: string;
          payment_status: PaymentStatus;
          total_price: number;
          payment_method: PaymentMethod;
          bank_note: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["sales"]["Row"]> & {
          seller_profile_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["sales"]["Row"]>;
        Relationships: [];
      };
      sale_items: {
        Row: {
          id: string;
          sale_id: string;
          product_id: string;
          variant_id: string;
          quantity: number;
          sale_price: number;
          cost_price: number;
          profit: number;
          delivered: boolean;
          // Cuánto de `quantity` no se pudo descontar del stock al
          // momento de vender, porque no había suficiente (ni propio ni
          // de nadie del equipo) — ver create_sale/create_apartado y
          // list_purchase_needed().
          pending_purchase_quantity: number;
        };
        Insert: Partial<Database["public"]["Tables"]["sale_items"]["Row"]> & {
          sale_id: string;
          product_id: string;
          variant_id: string;
          quantity: number;
          sale_price: number;
          cost_price: number;
        };
        Update: Partial<Database["public"]["Tables"]["sale_items"]["Row"]>;
        Relationships: [];
      };
      sale_payments: {
        Row: {
          id: string;
          sale_id: string;
          amount: number;
          payment_date: string;
          method: string | null;
          profile_id: string;
          note: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["sale_payments"]["Row"]> & {
          sale_id: string;
          amount: number;
          profile_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["sale_payments"]["Row"]>;
        Relationships: [];
      };
      loans: {
        Row: {
          id: string;
          product_id: string;
          variant_id: string;
          quantity: number;
          from_profile_id: string;
          to_profile_id: string;
          loan_date: string;
          note: string | null;
          status: LoanStatus;
          returned_at: string | null;
          unit_cost: number;
          unit_price: number;
          valuation_type: LoanValuationType;
          custom_price: number | null;
          settlement_method: LoanSettlementMethod | null;
          settlement_amount: number | null;
          settlement_bank_note: string | null;
          debt_settled_at: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["loans"]["Row"]> & {
          product_id: string;
          variant_id: string;
          quantity: number;
          from_profile_id: string;
          to_profile_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["loans"]["Row"]>;
        Relationships: [];
      };
      expenses: {
        Row: {
          id: string;
          expense_date: string;
          category: ExpenseCategory;
          description: string | null;
          amount: number;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["expenses"]["Row"]> & {
          category: ExpenseCategory;
          amount: number;
        };
        Update: Partial<Database["public"]["Tables"]["expenses"]["Row"]>;
        Relationships: [];
      };
      personal_use: {
        Row: {
          id: string;
          variant_id: string;
          product_id: string;
          profile_id: string;
          quantity: number;
          unit_cost: number | null;
          note: string | null;
          used_at: string;
          reimbursed_amount: number;
          reimbursed_note: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["personal_use"]["Row"]> & {
          variant_id: string;
          product_id: string;
          profile_id: string;
          quantity: number;
        };
        Update: Partial<Database["public"]["Tables"]["personal_use"]["Row"]>;
        Relationships: [];
      };
    };
    Views: {
      sale_balances: {
        Row: {
          sale_id: string;
          total_price: number;
          amount_paid: number;
          balance: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      current_profile_id: {
        Args: Record<string, never>;
        Returns: string;
      };
      check_email_authorization: {
        Args: { p_email: string };
        Returns: string | null;
      };
      mark_email_active: {
        Args: { p_email: string };
        Returns: void;
      };
      add_authorized_email: {
        Args: { p_email: string };
        Returns: void;
      };
      revoke_authorized_email: {
        Args: { p_email: string };
        Returns: void;
      };
      create_own_profile: {
        Args: { p_display_name: string; p_color: string };
        Returns: string;
      };
      list_authorized_emails: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          email: string;
          status: AuthorizedEmailStatus;
          invited_at: string;
          invited_by_name: string | null;
          profile_display_name: string | null;
          profile_color: string | null;
        }[];
      };
      mark_order_received: {
        Args: { p_order_id: string };
        Returns: void;
      };
      cancel_order: {
        Args: { p_order_id: string };
        Returns: void;
      };
      create_order: {
        Args: {
          p_order_date: string;
          p_items: { variant_id: string; quantity: number; unit_cost: number }[];
          p_farmasi_order_number?: string | null;
          p_gift_card_amount?: number;
        };
        Returns: string;
      };
      create_sale: {
        Args: {
          p_customer_name: string | null;
          p_sale_date: string;
          p_items: { variant_id: string; quantity: number; sale_price: number }[];
          p_customer_id?: string | null;
          p_payment_method?: PaymentMethod;
          p_bank_note?: string | null;
        };
        Returns: string;
      };
      adjust_stock: {
        Args: { p_variant_id: string; p_delta: number; p_note: string | null };
        Returns: void;
      };
      create_loan: {
        Args: {
          p_variant_id: string;
          p_quantity: number;
          p_from_profile_id: string;
          p_to_profile_id: string;
          p_note: string | null;
          p_valuation_type?: LoanValuationType;
          p_custom_price?: number | null;
        };
        Returns: string;
      };
      update_loan: {
        Args: {
          p_loan_id: string;
          p_variant_id: string;
          p_quantity: number;
          p_valuation_type: LoanValuationType;
          p_note: string | null;
          p_custom_price?: number | null;
        };
        Returns: void;
      };
      update_loan_settlement: {
        Args: {
          p_loan_id: string;
          p_settlement_method: LoanSettlementMethod;
          p_settlement_amount: number;
          p_settlement_bank_note?: string | null;
        };
        Returns: void;
      };
      mark_loan_returned: {
        Args: { p_loan_id: string };
        Returns: void;
      };
      mark_loan_sold: {
        Args: { p_loan_id: string };
        Returns: void;
      };
      delete_loan: {
        Args: { p_loan_id: string };
        Returns: void;
      };
      settle_loan_debts: {
        Args: Record<string, never>;
        Returns: void;
      };
      create_apartado: {
        Args: {
          p_customer_name: string;
          p_customer_phone: string | null;
          p_sale_date: string;
          p_items: { variant_id: string; quantity: number; sale_price: number }[];
          p_customer_id?: string | null;
          p_payment_method?: PaymentMethod;
          p_bank_note?: string | null;
        };
        Returns: string;
      };
      register_payment: {
        Args: {
          p_sale_id: string;
          p_amount: number;
          p_payment_date: string;
          p_method: string | null;
          p_note: string | null;
        };
        Returns: void;
      };
      mark_item_delivered: {
        Args: { p_sale_item_id: string };
        Returns: void;
      };
      cancel_apartado: {
        Args: { p_sale_id: string };
        Returns: void;
      };
      get_customer_purchase_history: {
        Args: { p_customer_id: string };
        Returns: {
          sale_item_id: string;
          sale_id: string;
          sale_date: string;
          payment_status: PaymentStatus;
          seller_profile_id: string;
          variant_id: string;
          product_id: string;
          quantity: number;
          sale_price: number;
          cost_price: number;
          profit: number;
        }[];
      };
      list_customer_totals: {
        Args: Record<string, never>;
        Returns: {
          customer_id: string;
          total_spent: number;
          purchase_count: number;
        }[];
      };
      complete_follow_up_task: {
        Args: { p_task_id: string; p_status: "hecho" | "omitido" };
        Returns: void;
      };
      run_birthday_check: {
        Args: Record<string, never>;
        Returns: void;
      };
      create_follow_up_tasks_for_prospect: {
        Args: { p_prospect_id: string; p_first_contact_date: string | null };
        Returns: void;
      };
      update_sale_items: {
        Args: {
          p_sale_id: string;
          p_items: { variant_id: string; quantity: number; sale_price: number }[];
          p_payment_method?: PaymentMethod;
          p_bank_note?: string | null;
        };
        Returns: void;
      };
      update_sale_payment_method: {
        Args: { p_sale_id: string; p_payment_method: PaymentMethod; p_bank_note?: string | null };
        Returns: void;
      };
      delete_sale: {
        Args: { p_sale_id: string };
        Returns: void;
      };
      list_purchase_needed: {
        Args: Record<string, never>;
        Returns: {
          variant_id: string;
          product_id: string;
          product_name: string;
          color_name: string;
          sku: string | null;
          quantity_needed: number;
          oldest_pending_since: string;
        }[];
      };
      update_apartado_items: {
        Args: {
          p_sale_id: string;
          p_items: { variant_id: string; quantity: number; sale_price: number }[];
        };
        Returns: void;
      };
      register_personal_use: {
        Args: {
          p_variant_id: string;
          p_quantity: number;
          p_note: string | null;
          p_used_at: string;
          p_reimbursed_amount?: number | null;
          p_reimbursed_note?: string | null;
        };
        Returns: void;
      };
      update_personal_use: {
        Args: {
          p_entry_id: string;
          p_variant_id: string;
          p_quantity: number;
          p_used_at: string;
          p_note: string | null;
          p_reimbursed_amount?: number | null;
          p_reimbursed_note?: string | null;
        };
        Returns: void;
      };
      list_customer_pending_balances: {
        Args: Record<string, never>;
        Returns: { customer_id: string; pending_balance: number }[];
      };
      list_customer_last_purchase: {
        Args: Record<string, never>;
        Returns: { customer_id: string; last_purchase_date: string }[];
      };
      get_undelivered_sale_ids: {
        Args: Record<string, never>;
        Returns: { sale_id: string }[];
      };
      count_backfill_follow_up_tasks: {
        Args: { p_rule_id: string };
        Returns: number;
      };
      backfill_follow_up_tasks_for_rule: {
        Args: { p_rule_id: string };
        Returns: number;
      };
      delete_follow_up_rule: {
        Args: { p_rule_id: string };
        Returns: void;
      };
      get_customer_apartados: {
        Args: { p_customer_id: string };
        Returns: {
          sale_id: string;
          sale_date: string;
          total_price: number;
          payment_status: PaymentStatus;
          amount_paid: number;
          balance: number;
        }[];
      };
      delete_customer: {
        Args: { p_customer_id: string };
        Returns: string;
      };
      get_customer_apartado_items: {
        Args: { p_customer_id: string };
        Returns: {
          sale_id: string;
          product_id: string;
          variant_id: string;
          quantity: number;
          sale_price: number;
          delivered: boolean;
        }[];
      };
    };
  };
}
