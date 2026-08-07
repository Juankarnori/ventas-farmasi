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
  | "devolucion_entrada";
export type OrderStatus = "pendiente" | "recibido";
export type LoanStatus = "pendiente" | "devuelto" | "vendido";
export type ExpenseCategory = "envio" | "empaque" | "publicidad" | "otro";
export type PaymentStatus = "pagado" | "con_abonos" | "completado" | "cancelado";
export type AuthorizedEmailStatus = "pendiente" | "activo" | "revocado";
export type FollowUpTriggerType = "despues_de_venta" | "cumpleanos";
export type FollowUpTaskStatus = "pendiente" | "hecho" | "omitido";
export type PaymentMethod = "efectivo" | "transferencia";

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
          total_cost: number;
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
          customer_id: string;
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
          customer_id: string;
          rule_id: string;
          due_date: string;
          message_preview: string;
        };
        Update: Partial<Database["public"]["Tables"]["follow_up_tasks"]["Row"]>;
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
      create_order: {
        Args: {
          p_order_date: string;
          p_items: { variant_id: string; quantity: number; unit_cost: number }[];
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
        };
        Returns: string;
      };
      mark_loan_returned: {
        Args: { p_loan_id: string };
        Returns: void;
      };
      mark_loan_sold: {
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
    };
  };
}
