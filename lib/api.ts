const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const TOKEN_KEY = "kozapp_token";

/** Le backend renvoie des chemins relatifs ("/uploads/...") pour les images
 * telechargees ; ce helper les resout vers l'origine de l'API. */
export function resolveImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_URL}${path}`;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function apiFetch<T>(path: string, options: RequestInit = {}, auth = true): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (auth) {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, extractErrorMessage(data, res.status));
  }
  return data as T;
}

/**
 * FastAPI renvoie soit `{ detail: "texte" }` (nos erreurs metier), soit
 * `{ detail: [{ msg, loc, type }, ...] }` pour les erreurs de validation
 * Pydantic. On ne doit jamais laisser ce deuxieme cas remonter tel quel
 * (JSON.stringify) jusqu'a l'utilisateur.
 */
/** Pydantic v2 prefixe les ValueError levées dans un field_validator avec
 * "Value error, " — c'est un artefact interne, jamais destiné à l'utilisateur. */
function stripTechnicalArtifacts(msg: string): string {
  return msg.replace(/^Value error,\s*/i, "").trim();
}

/** Une poignée de messages Pydantic natifs (champ manquant, mauvais type…)
 * ne sont ni traduits ni destinés à un utilisateur final. On les remplace
 * par un message générique plutôt que de laisser passer du jargon anglais. */
function looksTechnical(msg: string): boolean {
  return /^(field required|input should|string should|value is not|ensure this|invalid literal|\w+Error:)/i.test(msg);
}

function extractErrorMessage(data: unknown, status: number): string {
  const fallback = status >= 500
    ? "Une erreur est survenue de notre côté. Réessayez dans un instant."
    : "Une erreur est survenue. Vérifiez les informations saisies et réessayez.";

  if (data && typeof data === "object") {
    const detail = (data as { detail?: unknown }).detail;
    if (typeof detail === "string") {
      const cleaned = stripTechnicalArtifacts(detail);
      return looksTechnical(cleaned) ? fallback : cleaned;
    }
    if (Array.isArray(detail)) {
      const messages = detail
        .map(item => (item && typeof item === "object" ? (item as { msg?: unknown }).msg : null))
        .filter((m): m is string => typeof m === "string")
        .map(stripTechnicalArtifacts)
        .filter(m => !looksTechnical(m));
      if (messages.length) return messages.join(" ");
    }
    const message = (data as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return fallback;
}

/* ─── Auth ─── */
export type TokenResponse = { access_token: string; token_type: string };

export function register(body: { email: string; password: string; shop_name: string; activity_type?: string }) {
  return apiFetch<TokenResponse>("/api/auth/register", { method: "POST", body: JSON.stringify(body) }, false);
}

export function login(body: { email: string; password: string }) {
  return apiFetch<TokenResponse>("/api/auth/login", { method: "POST", body: JSON.stringify(body) }, false);
}

export type MessageResponse = { message: string };

export function forgotPassword(body: { email: string }) {
  return apiFetch<MessageResponse>("/api/auth/forgot-password", { method: "POST", body: JSON.stringify(body) }, false);
}

export function resetPassword(body: { token: string; new_password: string }) {
  return apiFetch<MessageResponse>("/api/auth/reset-password", { method: "POST", body: JSON.stringify(body) }, false);
}

/** Doit rester synchronise avec PASSWORD_PATTERN cote backend (schemas/auth.py). */
export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;
export const PASSWORD_HINT = "Au moins 6 caractères, avec au moins une lettre et un chiffre.";

export type ProfileRead = {
  id: string;
  email: string;
  shop_name: string;
  shop_description: string | null;
  activity_type: string | null;
  city: string | null;
  delivery_zones: string | null;
  address: string | null;
  hours: string | null;
  whatsapp_number: string | null;
  whatsapp_phone_number_id: string | null;
  agent_tone: string | null;
  agent_language: string | null;
  agent_welcome: string | null;
  agent_info: string | null;
  plan: string;
  created_at: string;
};

export function me() {
  return apiFetch<ProfileRead>("/api/auth/me");
}

export function updateProfile(body: Partial<{
  shop_name: string; shop_description: string; activity_type: string; city: string;
  delivery_zones: string; address: string; hours: string; whatsapp_number: string;
  agent_tone: string; agent_language: string; agent_welcome: string; agent_info: string;
  plan: string;
}>) {
  return apiFetch<ProfileRead>("/api/auth/me", { method: "PATCH", body: JSON.stringify(body) });
}

export function changePassword(body: { current_password: string; new_password: string }) {
  return apiFetch<MessageResponse>("/api/auth/change-password", { method: "POST", body: JSON.stringify(body) });
}

/* ─── Products ─── */
export type ProductRead = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  is_featured: boolean;
  sold_count: number;
  sort_order: number;
  created_at: string;
  category_id: string | null;
  category: { id: string; name: string } | null;
};

export function listProducts() {
  return apiFetch<ProductRead[]>("/api/products/");
}

export function createProduct(body: {
  name: string;
  description?: string;
  price: number;
  category_id?: string | null;
  is_available?: boolean;
}) {
  return apiFetch<ProductRead>("/api/products/", { method: "POST", body: JSON.stringify(body) });
}

export async function uploadProductImage(productId: string, file: File): Promise<ProductRead> {
  const formData = new FormData();
  formData.append("file", file);
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API_URL}/api/products/${productId}/image`, {
    method: "POST",
    headers, // pas de Content-Type : le navigateur pose lui-meme la boundary multipart
    body: formData,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, extractErrorMessage(data, res.status));
  return data as ProductRead;
}

export function updateProduct(id: string, body: Partial<{ name: string; price: number; is_available: boolean; description: string }>) {
  return apiFetch<ProductRead>(`/api/products/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

/* ─── Categories ─── */
export type CategoryRead = { id: string; name: string; slug: string; display_order: number; is_active: boolean };

export function listCategories() {
  return apiFetch<CategoryRead[]>("/api/categories/");
}

/* ─── Orders ─── */
export type OrderItemRead = { id: string; product_id: string; product_name: string; quantity: number; unit_price: number; subtotal: number };
export type OrderRead = {
  id: string;
  order_number: string;
  status: string;
  subtotal: number;
  total_amount: number;
  currency: string;
  delivery_address: string | null;
  delivery_city: string | null;
  delivery_neighborhood: string | null;
  notes: string | null;
  paid: boolean;
  paid_at: string | null;
  delivered_at: string | null;
  created_at: string;
  customer: { id: string; name: string | null; whatsapp_phone: string };
  items: OrderItemRead[];
};
export type OrderListResponse = { items: OrderRead[]; total: number; page: number; page_size: number };

export function listOrders(params: { page?: number; page_size?: number; order_status?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.page_size) qs.set("page_size", String(params.page_size));
  if (params.order_status) qs.set("order_status", params.order_status);
  const suffix = qs.toString() ? `?${qs}` : "";
  return apiFetch<OrderListResponse>(`/api/orders/${suffix}`);
}

export function updateOrderStatus(id: string, body: { status: string; note?: string; notify_customer?: boolean }) {
  return apiFetch<OrderRead>(`/api/orders/${id}/status`, { method: "PATCH", body: JSON.stringify(body) });
}

/* ─── Analytics ─── */
export type QuotaUsage = {
  plan: string;
  conversations_used: number;
  conversations_limit: number;
  followups_used: number;
  followups_limit: number;
  period_start: string;
  period_end: string;
};

export type AnalyticsSummary = {
  total_orders: number;
  total_revenue: number;
  total_customers: number;
  average_order_value: number;
  daily_sales: { date: string; order_count: number; total_revenue: number }[];
  top_products: { product_id: string; product_name: string; total_quantity: number; total_revenue: number }[];
  quota: QuotaUsage;
};

export type AnalyticsInsights = {
  geo_breakdown: { neighborhood: string; order_count: number; total_revenue: number }[];
  conversion: {
    total_conversations: number;
    converted: number;
    lost: number;
    in_progress: number;
    escalated: number;
    conversion_rate: number;
  };
  peak_hours: { hour: number; order_count: number }[];
  followups: {
    sent: number;
    responded: number;
    converted: number;
    recovered_amount: number;
    response_rate: number;
    conversion_rate: number;
  };
  negotiation: {
    negotiated_orders: number;
    total_orders: number;
    negotiated_share: number;
    average_discount_pct: number;
    total_discount_amount: number;
  };
  leaking_sales: {
    count: number;
    estimated_amount: number;
    items: {
      customer_name: string;
      whatsapp_phone: string;
      outcome: string;
      last_message_at: string | null;
      estimated_amount: number | null;
    }[];
  };
  segments: {
    new_customers: number;
    returning_customers: number;
    repeat_rate: number;
  };
  quota: QuotaUsage;
};

export function getAnalyticsSummary(days?: number) {
  const suffix = days ? `?days=${days}` : "";
  return apiFetch<AnalyticsSummary>(`/api/analytics/summary${suffix}`);
}

export function getAnalyticsInsights(days?: number) {
  const suffix = days ? `?days=${days}` : "";
  return apiFetch<AnalyticsInsights>(`/api/analytics/insights${suffix}`);
}

/* ─── Negotiation rules ─── */
export type NegotiationRuleRead = {
  id: string;
  product_id: string;
  is_negotiable: boolean;
  floor_price: number;
  max_discount_pct: number;
};

export function listNegotiationRules() {
  return apiFetch<NegotiationRuleRead[]>("/api/negotiation-rules/");
}

export function upsertNegotiationRule(productId: string, body: { is_negotiable: boolean; floor_price: number; max_discount_pct: number }) {
  return apiFetch<NegotiationRuleRead>(`/api/negotiation-rules/${productId}`, { method: "PUT", body: JSON.stringify(body) });
}

/* ─── Team ─── */
export type TeamMemberRead = { id: string; email: string; name: string | null; role: string; invited_at: string; accepted_at: string | null };

export function listTeam() {
  return apiFetch<TeamMemberRead[]>("/api/team/");
}

export function inviteTeamMember(body: { email: string; name?: string; role?: string }) {
  return apiFetch<TeamMemberRead>("/api/team/", { method: "POST", body: JSON.stringify(body) });
}
