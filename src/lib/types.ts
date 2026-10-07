export type OrderStatus = "pending" | "confirmed" | "preparing" | "ready" | "completed" | "cancelled";
export type FulfillmentType = "delivery" | "pickup";

export type BusinessSettings = {
  business_name: string | null;
  hero_title: string | null;
  hero_text: string | null;
  about_text: string | null;
  logo_path: string | null;
  hero_image_path: string | null;
  instagram_handle: string | null;
  whatsapp_number: string | null;
  contact_email: string | null;
  city: string | null;
  opening_hours: string | null;
  accepting_orders: boolean;
  closed_message: string | null;
  offers_pickup: boolean;
  offers_delivery: boolean;
  pickup_info: string | null;
  delivery_info: string | null;
  delivery_fee_cents: number | null;
  min_lead_days: number | null;
  order_notice: string | null;
};

export type Category = {
  id: string;
  name: string;
  sort_order: number;
};

/** Produto como o público enxerga (somente disponíveis). */
export type CatalogProduct = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number | null;
  unit_label: string | null;
  image_path: string | null;
  category_id: string | null;
};

/** Produto completo, como a dona enxerga no painel. */
export type AdminProduct = CatalogProduct & {
  active: boolean;
  archived: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type TrackedOrder = {
  order_number: string;
  created_at: string;
  status: OrderStatus;
  fulfillment_type: FulfillmentType;
  requested_date: string | null;
  requested_time: string | null;
  delivery_fee_cents: number | null;
  total_cents: number;
  items: {
    product_name: string;
    unit_label: string | null;
    quantity: number;
    unit_price_cents: number | null;
    subtotal_cents: number | null;
  }[];
  history: { status: OrderStatus; at: string }[];
};

export type DeliveryZone = {
  id: string;
  name: string;
  fee_cents: number;
};

export type AdminDeliveryZone = DeliveryZone & { active: boolean; sort_order: number };
