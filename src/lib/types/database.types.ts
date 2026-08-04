// Tipos escritos a mano siguiendo supabase/migrations/*.sql. Si en algún
// momento corrés `supabase gen types typescript`, este archivo se puede
// reemplazar por el generado (misma forma: Database.public.Tables.*).
//
// `Relationships: []` en cada tabla y `Views: {}` son requeridos por el
// tipo GenericSchema de @supabase/postgrest-js aunque no los usemos (no
// modelamos joins embebidos tipados).

export type ProfileSlot = "mama" | "yo";
export type ProfileColor = "turquoise" | "coral";
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

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          slot: ProfileSlot;
          display_name: string;
          color: ProfileColor;
          user_id: string | null;
          claimed_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
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
      products: {
        Row: {
          id: string;
          name: string;
          image_url: string | null;
          category_id: string | null;
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
      sales: {
        Row: {
          id: string;
          sale_date: string;
          customer_name: string | null;
          seller_profile_id: string;
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
    Views: Record<string, never>;
    Functions: {
      current_profile_id: {
        Args: Record<string, never>;
        Returns: string;
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
    };
  };
}
