"use client";

import { useEffect, useMemo, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, ArrowRight, BarChart3, Bell, Bot, Check, ChevronDown, ChevronRight, CircleHelp, CreditCard,
  Eye, EyeOff, FileText, Globe2, Home, ImagePlus, LayoutDashboard, LogOut, Menu, MessageCircle, MoreHorizontal,
  Package, Plus, Search, Send, Settings, ShieldCheck, ShoppingBag, SlidersHorizontal,
  Sparkles, Users, WalletCards, X, Zap,
} from "lucide-react";
import { KORAH_WEBSITE_URL } from "@/lib/social-proof";
import PhoneInput from "@/components/PhoneInput";
import {
  ApiError, CategoryRead, NegotiationRuleRead, OrderRead, ProductRead, ProfileRead, TeamMemberRead,
  changePassword, clearToken, createProduct, getAnalyticsInsights, getAnalyticsSummary, getToken, inviteTeamMember, listCategories,
  listNegotiationRules, listOrders, listProducts, listTeam, me, resolveImageUrl, updateOrderStatus,
  updateProduct, updateProfile, uploadProductImage, upsertNegotiationRule, PASSWORD_HINT, PASSWORD_PATTERN,
} from "@/lib/api";
import { LanguageProvider, useLanguage, useDashboardT, tFormat, localeFor, type Lang, type DashboardT } from "@/lib/i18n";

type View = "dashboard" | "analytics" | "orders" | "catalog" | "followups" | "agent" | "billing" | "settings";
const VIEWS: View[] = ["dashboard", "analytics", "orders", "catalog", "followups", "agent", "billing", "settings"];

const TONES = ["burger", "chicken", "fries", "bissap"];
const toneFor = (i: number) => TONES[i % TONES.length];

function useMenu(t: DashboardT): { id: View; label: string; icon: typeof LayoutDashboard; alert?: boolean }[] {
  return [
    { id: "dashboard", label: t.menu.dashboard, icon: LayoutDashboard },
    { id: "analytics", label: t.menu.analytics, icon: BarChart3 },
    { id: "orders", label: t.menu.orders, icon: ShoppingBag, alert: true },
    { id: "catalog", label: t.menu.catalog, icon: Package },
    { id: "followups", label: t.menu.followups, icon: Send },
    { id: "agent", label: t.menu.agent, icon: Bot },
    { id: "billing", label: t.menu.billing, icon: WalletCards },
    { id: "settings", label: t.menu.settings, icon: Settings },
  ];
}

function useBottomNavItems(t: DashboardT): { id: View; label: string; icon: typeof LayoutDashboard; alert?: boolean }[] {
  return [
    { id: "dashboard", label: t.bottomNav.home, icon: LayoutDashboard },
    { id: "orders", label: t.menu.orders, icon: ShoppingBag, alert: true },
    { id: "catalog", label: t.menu.catalog, icon: Package },
  ];
}

function Logo({ small = false }: { small?: boolean }) {
  return <img className={small ? "brand-logo brand-logo-small" : "brand-logo"} src="/kozapp-logo.png" alt="Kozapp" />;
}

function Badge({ children, tone = "grey" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function ProductArt({ tone }: { tone: string }) {
  return (
    <div className={`product-art ${tone}`}>
      <span>{tone === "bissap" ? "✦" : tone === "fries" ? "≋" : "●"}</span>
    </div>
  );
}

function Metric({ icon: Icon, value, label, detail, accent = "purple" }: { icon: typeof ShoppingBag; value: string; label: string; detail: string; accent?: string }) {
  return (
    <article className="metric-card">
      <span className={`metric-icon ${accent}`}><Icon size={19} /></span>
      <div><p>{label}</p><strong>{value}</strong><small className={detail.startsWith("+") ? "positive" : ""}>{detail}</small></div>
    </article>
  );
}

function EmptyState({ icon: Icon, title, text, actionLabel, onAction }: { icon: typeof Search; title: string; text: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="empty-state">
      <span><Icon size={22} /></span>
      <h3>{title}</h3>
      <p>{text}</p>
      {actionLabel && onAction && <button className="secondary-button" onClick={onAction}>{actionLabel}</button>}
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return <div className="loading-state"><span className="loading-spinner" /> {label}</div>;
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const t = useDashboardT();
  return (
    <div className="error-state">
      <AlertTriangle size={22} />
      <p>{message}</p>
      <button className="secondary-button" onClick={onRetry}>{t.common.retry}</button>
    </div>
  );
}

function fmtFcfa(n: number, lang: Lang = "fr") {
  return new Intl.NumberFormat(localeFor(lang)).format(Math.round(n));
}

/** Menu deroulant generique (langue, notifications, profil, filtre de periode…). */
function Dropdown({
  trigger,
  triggerClassName,
  panelAlign = "right",
  children,
}: {
  trigger: React.ReactNode;
  triggerClassName: string;
  panelAlign?: "left" | "right";
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="dropdown" ref={ref}>
      <button type="button" className={triggerClassName} onClick={() => setOpen(o => !o)} aria-expanded={open}>
        {trigger}
      </button>
      {open && (
        <div className={`dropdown-panel ${panelAlign === "left" ? "align-left" : ""}`} onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}

/* ─── Dashboard ─── */
function Dashboard({ setView, profile }: { setView: (view: View) => void; profile: ProfileRead }) {
  const { lang } = useLanguage();
  const t = useDashboardT();
  const periodOptions = [
    { key: "today", label: t.dashboard.periodToday, days: 1 as number | undefined },
    { key: "last7", label: t.dashboard.periodLast7, days: 7 },
    { key: "month", label: t.dashboard.periodThisMonth, days: 30 },
    { key: "all", label: t.dashboard.periodAllTime, days: undefined },
  ];
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getAnalyticsSummary>> | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [periodKey, setPeriodKey] = useState("month");
  const period = periodOptions.find(p => p.key === periodKey) ?? periodOptions[2];

  const load = () => {
    setStatus("loading");
    getAnalyticsSummary(period.days)
      .then(data => { setSummary(data); setStatus("ready"); })
      .catch(() => setStatus("error"));
  };
  useEffect(load, [period.days]);

  const topProducts = summary?.top_products ?? [];

  return (
    <>
      <div className="page-heading">
        <div><p className="eyebrow">{t.dashboard.today}</p><h1>{t.dashboard.greeting}, {profile.shop_name} <span>✦</span></h1><p className="muted">{t.dashboard.subtitle}</p></div>
        <Dropdown triggerClassName="filter-button" trigger={<><SlidersHorizontal size={17} /> {period.label} <ChevronDown size={16} /></>}>
          {periodOptions.map(opt => (
            <button
              key={opt.key}
              type="button"
              className={`dropdown-item ${opt.key === period.key ? "active" : ""}`}
              onClick={() => setPeriodKey(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </Dropdown>
      </div>

      {status === "loading" && <LoadingState label={t.dashboard.loadingStats} />}
      {status === "error" && <ErrorState message={t.dashboard.errorStats} onRetry={load} />}

      {status === "ready" && summary && (
        <>
          <section className="metrics-grid">
            <Metric icon={ShoppingBag} value={String(summary.total_orders)} label={t.dashboard.ordersLabel} detail={summary.total_orders === 0 ? t.dashboard.ordersEmpty : t.dashboard.total} />
            <Metric icon={Users} value={String(summary.total_customers)} label={t.dashboard.customersLabel} detail={summary.total_customers === 0 ? t.dashboard.customersEmpty : t.dashboard.total} accent="pink" />
            <Metric icon={WalletCards} value={fmtFcfa(summary.total_revenue, lang)} label={t.dashboard.revenueLabel} detail={tFormat(t.dashboard.avgBasket, { amount: fmtFcfa(summary.average_order_value, lang) })} accent="green" />
            <article className="metric-card quota-card">
              <span className="metric-icon orange"><MessageCircle size={19} /></span>
              <div className="quota-top">
                <p>{t.dashboard.conversations}</p>
                <strong>{summary.quota.conversations_used} <small>/ {summary.quota.conversations_limit}</small></strong>
                <div className="progress"><span style={{ width: `${summary.quota.conversations_limit > 0 ? Math.min((summary.quota.conversations_used / summary.quota.conversations_limit) * 100, 100) : 0}%` }} /></div>
                <small>{summary.quota.period_start} — {summary.quota.period_end}</small>
              </div>
            </article>
          </section>

          {summary.total_orders === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title={t.dashboard.emptyTitle}
              text={t.dashboard.emptyText}
              actionLabel={t.dashboard.emptyAction}
              onAction={() => setView("catalog")}
            />
          ) : (
            <section className="dashboard-grid">
              <article className="panel action-panel">
                <div className="panel-heading"><div><h2>{t.dashboard.attentionTitle}</h2><p>{t.dashboard.attentionSubtitle}</p></div></div>
                <button className="attention-item" onClick={() => setView("orders")}>
                  <span className="attention-icon purple"><ShoppingBag size={18} /></span>
                  <span><strong>{t.dashboard.pendingOrders}</strong><small>{t.dashboard.pendingOrdersDesc}</small></span>
                  <ChevronRight size={18} />
                </button>
                <button className="attention-item" onClick={() => setView("billing")}>
                  <span className="attention-icon orange"><Zap size={18} /></span>
                  <span><strong>{t.dashboard.subscription}</strong><small>{t.dashboard.subscriptionDesc}</small></span>
                  <ChevronRight size={18} />
                </button>
              </article>
              <article className="panel best-panel">
                <div className="panel-heading"><div><h2>{t.dashboard.bestProducts}</h2><p>{t.dashboard.bestProductsSub}</p></div><button className="text-button" onClick={() => setView("catalog")}>{t.dashboard.catalogLink} <ArrowRight size={16} /></button></div>
                {topProducts.length === 0 ? (
                  <p className="muted">{t.dashboard.noSales}</p>
                ) : (
                  topProducts.slice(0, 5).map((product, index) => (
                    <div className="rank-row" key={product.product_id}>
                      <b>0{index + 1}</b><ProductArt tone={toneFor(index)} />
                      <div><strong>{product.product_name}</strong><small>{product.total_quantity} {t.dashboard.sold}</small></div>
                      <em>{fmtFcfa(product.total_revenue, lang)} <small>FCFA</small></em>
                    </div>
                  ))
                )}
              </article>
            </section>
          )}
        </>
      )}
    </>
  );
}

/* ─── Analytics ─── */
function RevenueTrend({ data, title, subtitle }: { data: { date: string; order_count: number; total_revenue: number }[]; title: string; subtitle: string }) {
  const { lang } = useLanguage();
  const t = useDashboardT();
  const gradId = useId();
  const [tip, setTip] = useState<{ xPct: number; yPct: number; d: typeof data[number] } | null>(null);

  if (data.length === 0) {
    return (
      <article className="panel" style={{ gridColumn: "span 2" }}>
        <div className="panel-heading"><div><h2>{title}</h2><p>{subtitle}</p></div></div>
        <p className="muted">{t.analytics.noData}</p>
      </article>
    );
  }

  const W = 900, H = 210, PAD_L = 55, PAD_R = 16, PAD_T = 8, PAD_B = 28;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;
  const maxRev = Math.max(...data.map(d => d.total_revenue), 1);
  const svgPts = data.map((d, i) => ({
    x: data.length > 1 ? PAD_L + (i / (data.length - 1)) * chartW : PAD_L + chartW / 2,
    y: PAD_T + chartH - (d.total_revenue / maxRev) * chartH,
  }));
  const pts = svgPts.map((sp, i) => ({
    xPct: sp.x / W * 100,
    yPct: sp.y / H * 100,
    d: data[i],
  }));
  const linePath = svgPts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L${svgPts[svgPts.length - 1].x},${PAD_T + chartH} L${PAD_L},${PAD_T + chartH} Z`;
  const yTicks = [0, 0.5, 1].map(f => ({
    y: PAD_T + chartH - f * chartH,
    label: fmtFcfa(maxRev * f, lang),
  }));
  const yTicksReversed = [...yTicks].reverse();
  const lastPt = pts[pts.length - 1];
  const lastSvgPt = svgPts[svgPts.length - 1];

  return (
    <article className="panel" style={{ gridColumn: "span 2" }}>
      <div className="panel-heading"><div><h2>{title}</h2><p>{subtitle}</p></div></div>
      <div className="revenue-trend">
        <div className="chart-y" style={{ height: H }}>
          {yTicksReversed.map((t, i) => <span key={i}>{t.label}</span>)}
        </div>
        <div className="chart-area" style={{ height: H }}>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={title}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--purple)" stopOpacity="0.12" />
                <stop offset="100%" stopColor="var(--purple)" stopOpacity="0.01" />
              </linearGradient>
            </defs>
            {yTicks.map((t, i) => <line key={i} x1={PAD_L} y1={t.y} x2={W - PAD_R} y2={t.y} stroke="#ece8ef" strokeWidth="1" />)}
            <path d={areaPath} fill={`url(#${gradId})`} />
            <path d={linePath} className="trend-line" />
            {lastSvgPt && <circle cx={lastSvgPt.x} cy={lastSvgPt.y} r="5" fill="var(--purple)" stroke="white" strokeWidth="2" />}
          </svg>
          {pts.map((p, i) => (
            <div key={i} tabIndex={0} role="button"
              aria-label={`${p.d.date}: ${fmtFcfa(p.d.total_revenue, lang)} FCFA, ${p.d.order_count} ${t.orders.summaryCount}`}
              style={{ position: "absolute", left: `calc(${p.xPct}% - 14px)`, top: `calc(${p.yPct}% - 14px)`, width: 28, height: 28, cursor: "pointer", outline: "none" }}
              onMouseEnter={() => setTip(p)}
              onMouseLeave={() => setTip(null)}
              onFocus={() => setTip(p)}
              onBlur={() => setTip(null)} />
          ))}
          {tip && (
            <div style={{ position: "absolute", left: `calc(${tip.xPct}% - 48px)`, top: `calc(${tip.yPct}% - 52px)`, background: "#4d3c5d", color: "#fff", padding: "5px 9px", borderRadius: 6, fontSize: 9, textAlign: "center", pointerEvents: "none", whiteSpace: "nowrap", zIndex: 2 }}>
              {tip.d.date}<br />{fmtFcfa(tip.d.total_revenue, lang)} FCFA<br />{tip.d.order_count} {t.orders.summaryCount}
            </div>
          )}
          {lastPt && (
            <div style={{ position: "absolute", left: `calc(${lastPt.xPct}% - 42px)`, top: `calc(${lastPt.yPct}% - 38px)`, color: "var(--purple)", fontWeight: 700, fontSize: 10, pointerEvents: "none", textAlign: "center", whiteSpace: "nowrap" }}>
              {fmtFcfa(lastPt.d.total_revenue, lang)}
            </div>
          )}
          <div style={{ position: "absolute", inset: "auto 0 -20px", display: "flex", justifyContent: "space-between", color: "#9b95a3", fontSize: 9, paddingLeft: `${PAD_L / W * 100}%`, paddingRight: `${PAD_R / W * 100}%` }}>
            {data.length <= 7
              ? data.map(d => <span key={d.date}>{d.date.slice(5)}</span>)
              : data.filter((_, i) => i % Math.ceil(data.length / 7) === 0 || i === data.length - 1).map(d => <span key={d.date}>{d.date.slice(5)}</span>)
            }
          </div>
        </div>
      </div>
    </article>
  );
}

function Analytics() {
  const { lang } = useLanguage();
  const t = useDashboardT();
  const periodOptions = [
    { key: "today", label: t.dashboard.periodToday, days: 1 as number | undefined },
    { key: "last7", label: t.dashboard.periodLast7, days: 7 },
    { key: "month", label: t.dashboard.periodThisMonth, days: 30 },
    { key: "all", label: t.dashboard.periodAllTime, days: undefined },
  ];
  const [insights, setInsights] = useState<Awaited<ReturnType<typeof getAnalyticsInsights>> | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [periodKey, setPeriodKey] = useState("month");
  const period = periodOptions.find(p => p.key === periodKey) ?? periodOptions[2];

  const load = () => {
    setStatus("loading");
    getAnalyticsInsights(period.days)
      .then(i => { setInsights(i); setStatus("ready"); })
      .catch(() => setStatus("error"));
  };
  useEffect(load, [period.days]);

  const fmtH = (h: number) => {
    const wat = (h + 1) % 24;
    return `${String(wat).padStart(2, "0")}h`;
  };

  return (
    <>
      <div className="page-heading">
        <div><p className="eyebrow">{t.analytics.eyebrow}</p><h1>{t.analytics.title} <BarChart3 size={24} /></h1><p className="muted">{t.analytics.subtitle}</p></div>
        <Dropdown triggerClassName="filter-button" trigger={<><SlidersHorizontal size={17} /> {period.label} <ChevronDown size={16} /></>}>
          {periodOptions.map(opt => (
            <button key={opt.key} type="button" className={`dropdown-item ${opt.key === period.key ? "active" : ""}`} onClick={() => setPeriodKey(opt.key)}>{opt.label}</button>
          ))}
        </Dropdown>
      </div>

      {status === "loading" && <LoadingState label={t.analytics.loading} />}
      {status === "error" && <ErrorState message={t.analytics.error} onRetry={load} />}

      {status === "ready" && insights && (
        <div className="analytics-grid">
          {/* 0. Revenue trend */}
          <RevenueTrend data={insights.daily_sales} title={t.analytics.revenueTrendTitle} subtitle={t.analytics.revenueTrendSubtitle} />

          {/* 1. Geo breakdown */}
          <article className="panel">
            <div className="panel-heading"><div><h2>{t.analytics.geoTitle}</h2><p>{t.analytics.geoSubtitle}</p></div></div>
            {insights.geo_breakdown.length === 0 ? (
              <p className="muted">{t.analytics.noData}</p>
            ) : (
              (() => {
                const maxCount = Math.max(...insights.geo_breakdown.map(g => g.order_count), 1);
                return (
                  <div className="geo-bars">
                    {insights.geo_breakdown.map(g => (
                      <div className="geo-bar-row" key={g.neighborhood}>
                        <span className="geo-label">{g.neighborhood}</span>
                        <div className="geo-bar-track">
                          <div className="geo-bar-fill" style={{ width: `${(g.order_count / maxCount) * 100}%` }} title={`${g.neighborhood}: ${g.order_count} ${t.orders.summaryCount} · ${fmtFcfa(g.total_revenue, lang)} FCFA`} />
                        </div>
                        <span className="geo-count">{g.order_count}</span>
                      </div>
                    ))}
                  </div>
                );
              })()
            )}
          </article>

          {/* 2. Conversion */}
          <article className="panel">
            <div className="panel-heading"><div><h2>{t.analytics.conversionTitle}</h2><p>{t.analytics.conversionSubtitle}</p></div></div>
            <div className="metric-card" style={{ minHeight: 90, marginBottom: 16 }}>
              <span className="metric-icon green"><Check size={19} /></span>
              <div><p>{t.dashboard.conversations}</p><strong>{insights.conversion.conversion_rate}%</strong><small>{insights.conversion.total_conversations} {t.dashboard.conversations.toLowerCase()}</small></div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Badge tone="purple">{t.analytics.converted}: {insights.conversion.converted}</Badge>
              <Badge tone="orange">{t.analytics.inProgress}: {insights.conversion.in_progress}</Badge>
              <Badge tone="red">{t.analytics.lost}: {insights.conversion.lost}</Badge>
              <Badge tone="pink">{t.analytics.escalated}: {insights.conversion.escalated}</Badge>
            </div>
          </article>

          {/* 3. Peak hours */}
          <article className="panel" style={{ gridColumn: "span 2" }}>
            <div className="panel-heading"><div><h2>{t.analytics.peakHoursTitle}</h2><p>{t.analytics.peakHoursSubtitle}</p></div></div>
            {insights.peak_hours.every(h => h.order_count === 0) ? (
              <p className="muted">{t.analytics.noData}</p>
            ) : (
              <div className="hour-bars">
                {insights.peak_hours.map(h => {
                  const maxP = Math.max(...insights.peak_hours.map(x => x.order_count), 1);
                  const pct = (h.order_count / maxP) * 100;
                  return (
                    <div className="hour-bar-col" key={h.hour}>
                      <div className="hour-bar" style={{ height: `${Math.max(pct, 2)}%` }} title={`${fmtH(h.hour)}: ${h.order_count}`} />
                      {h.hour % 4 === 0 && <span className="hour-label">{fmtH(h.hour)}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </article>

          {/* 4. Followups */}
          <article className="panel">
            <div className="panel-heading"><div><h2>{t.analytics.followupsTitle}</h2><p>{t.analytics.followupsSubtitle}</p></div></div>
            {insights.followups.sent === 0 ? (
              <p className="muted">{t.analytics.noData}</p>
            ) : (
              <>
                <div className="usage-grid">
                  <article className="usage-card"><p>{t.analytics.sent}</p><strong>{insights.followups.sent}</strong></article>
                  <article className="usage-card"><p>{t.analytics.responded}</p><strong>{insights.followups.response_rate}%</strong></article>
                  <article className="usage-card"><p>{t.analytics.converted}</p><strong>{insights.followups.conversion_rate}%</strong></article>
                </div>
                {insights.followups.recovered_amount > 0 && (
                  <div className="metric-card" style={{ minHeight: 80 }}>
                    <span className="metric-icon green"><WalletCards size={19} /></span>
                    <div><p>{t.analytics.recoveredAmount}</p><strong>{fmtFcfa(insights.followups.recovered_amount, lang)} <small>FCFA</small></strong></div>
                  </div>
                )}
              </>
            )}
          </article>

          {/* 5. Negotiation */}
          <article className="panel">
            <div className="panel-heading"><div><h2>{t.analytics.negotiationTitle}</h2><p>{t.analytics.negotiationSubtitle}</p></div></div>
            {insights.negotiation.total_orders === 0 ? (
              <p className="muted">{t.analytics.noData}</p>
            ) : (
              <div className="impact-card">
                <span className="soft-icon pink"><WalletCards size={19} /></span>
                <div>
                  <strong>{insights.negotiation.negotiated_share}%</strong>
                  <p>{t.analytics.negotiatedShare} ({insights.negotiation.negotiated_orders}/{insights.negotiation.total_orders})</p>
                  <small>{t.analytics.avgDiscount}: {insights.negotiation.average_discount_pct}% · {t.analytics.totalDiscount}: {fmtFcfa(insights.negotiation.total_discount_amount, lang)} FCFA</small>
                </div>
              </div>
            )}
          </article>

          {/* 6. Leaking sales */}
          <article className="panel">
            <div className="panel-heading"><div><h2>{t.analytics.leakingTitle}</h2><p>{t.analytics.leakingSubtitle}</p></div></div>
            <div className="metric-card" style={{ minHeight: 90, marginBottom: 12 }}>
              <span className="metric-icon orange"><AlertTriangle size={19} /></span>
              <div><p>{insights.leaking_sales.count}</p><strong>{fmtFcfa(insights.leaking_sales.estimated_amount, lang)} <small>FCFA</small></strong></div>
            </div>
            {insights.leaking_sales.items.length === 0 ? (
              <p className="muted">{t.analytics.noData}</p>
            ) : (
              insights.leaking_sales.items.map((item, i) => {
                const hoursAgo = item.last_message_at
                  ? Math.round((Date.now() - new Date(item.last_message_at).getTime()) / 3600000)
                  : null;
                return (
                  <button className="attention-item" key={i}>
                    <span className="attention-icon purple"><Users size={18} /></span>
                    <span>
                      <strong>{item.customer_name}</strong>
                      <small>{t.analytics.leakingSince} {hoursAgo !== null ? `${hoursAgo}h` : "—"}</small>
                    </span>
                    {item.estimated_amount != null && <em>{fmtFcfa(item.estimated_amount, lang)} <small>FCFA</small></em>}
                  </button>
                );
              })
            )}
          </article>

          {/* 7. Segments */}
          <article className="panel">
            <div className="panel-heading"><div><h2>{t.analytics.segmentsTitle}</h2><p>{t.analytics.segmentsSubtitle}</p></div></div>
            <div className="usage-grid">
              <article className="usage-card"><p>{t.analytics.newCustomers}</p><strong>{insights.segments.new_customers}</strong></article>
              <article className="usage-card"><p>{t.analytics.returningClients}</p><strong>{insights.segments.returning_customers}</strong></article>
              <article className="usage-card"><p>{t.analytics.repeatRate}</p><strong>{insights.segments.repeat_rate}%</strong></article>
            </div>
          </article>

          {/* 8. Quota */}
          <article className="panel">
            <div className="panel-heading"><div><h2>{t.analytics.quotaTitle}</h2><p>{t.analytics.quotaSubtitle}</p></div></div>
            <div className="quota-large">
              <div>
                <span className="soft-icon orange"><MessageCircle size={19} /></span>
                <div>
                  <p>{t.analytics.conversationsUsed}</p>
                  <strong>{insights.quota.conversations_used} <small>/ {insights.quota.conversations_limit}</small></strong>
                </div>
              </div>
              <div className="progress"><span style={{ width: `${insights.quota.conversations_limit > 0 ? Math.min((insights.quota.conversations_used / insights.quota.conversations_limit) * 100, 100) : 0}%` }} /></div>
              <small>{insights.quota.period_start} — {insights.quota.period_end}</small>
            </div>
            <div className="quota-large" style={{ marginTop: 14 }}>
              <div>
                <span className="soft-icon pink"><Send size={19} /></span>
                <div>
                  <p>{t.analytics.followupsUsed}</p>
                  <strong>{insights.quota.followups_used} <small>/ {insights.quota.followups_limit}</small></strong>
                </div>
              </div>
              <div className="progress"><span style={{ width: `${insights.quota.followups_limit > 0 ? Math.min((insights.quota.followups_used / insights.quota.followups_limit) * 100, 100) : 0}%` }} /></div>
            </div>
          </article>
        </div>
      )}
    </>
  );
}

/* ─── Orders ─── */
function Orders({ onOpenDetail, refreshKey }: { onOpenDetail: (order: OrderRead) => void; refreshKey: number }) {
  const { lang } = useLanguage();
  const t = useDashboardT();
  const [orders, setOrders] = useState<OrderRead[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [search, setSearch] = useState("");

  const load = () => {
    setStatus("loading");
    listOrders({ page_size: 50 })
      .then(res => { setOrders(res.items); setStatus("ready"); })
      .catch(() => setStatus("error"));
  };
  useEffect(load, [refreshKey]);

  const query = search.trim().toLowerCase();
  const filtered = query
    ? orders.filter(o => o.order_number.toLowerCase().includes(query) || (o.customer.name ?? "").toLowerCase().includes(query))
    : orders;

  const statusTone: Record<string, string> = { pending: "pink", confirmed: "grey", delivering: "orange", delivered: "green", cancelled: "red" };
  const statusLabel: Record<string, string> = {
    pending: t.orders.statusNew, confirmed: t.orders.statusConfirmed, delivering: t.orders.statusDelivering,
    delivered: t.orders.statusDelivered, cancelled: t.orders.statusCancelled,
  };

  const delivered = orders.filter(o => o.status === "delivered").length;
  const deliveredPct = orders.length ? Math.round((delivered / orders.length) * 100) : 0;
  const pending = orders.filter(o => o.status === "pending").length;

  return (
    <>
      <div className="page-heading compact">
        <div><p className="eyebrow">{t.orders.eyebrow}</p><h1>{t.orders.title}</h1><p className="muted">{t.orders.subtitle}</p></div>
      </div>
      <section className="orders-summary">
        <div><span className="soft-icon purple"><ShoppingBag size={18} /></span><p><b>{orders.length}</b> {t.orders.summaryCount}</p></div>
        <div><span className="soft-icon orange"><Zap size={18} /></span><p><b>{pending}</b> {t.orders.summaryPending}</p></div>
        <div><span className="soft-icon green"><Check size={18} /></span><p><b>{deliveredPct} %</b> {t.orders.summaryDelivered}</p></div>
      </section>
      <section className="panel table-panel">
        <div className="table-tools">
          <div className="search"><Search size={17} /><input placeholder={t.orders.searchPlaceholder} value={search} onChange={e => setSearch(e.target.value)} /></div>
        </div>
        {status === "loading" && <LoadingState label={t.orders.loading} />}
        {status === "error" && <ErrorState message={t.orders.error} onRetry={load} />}
        {status === "ready" && filtered.length === 0 && (
          <EmptyState
            icon={Search}
            title={orders.length === 0 ? t.orders.emptyTitleNone : t.orders.emptyTitleFiltered}
            text={orders.length === 0 ? t.orders.emptyTextNone : tFormat(t.common.noResultsFor, { query: search })}
            actionLabel={orders.length > 0 ? t.common.resetSearch : undefined}
            onAction={() => setSearch("")}
          />
        )}
        {status === "ready" && filtered.length > 0 && (
          <div className="orders-table">
            <div className="table-row table-head"><span>{t.orders.colOrder}</span><span>{t.orders.colCustomer}</span><span>{t.orders.colProducts}</span><span>{t.orders.colAmount}</span><span>{t.orders.colDelivery}</span><span>{t.orders.colStatus}</span><span /></div>
            {filtered.map(order => (
              <div className="table-row" key={order.id} role="button" tabIndex={0} onClick={() => onOpenDetail(order)}>
                <span><b>{order.order_number}</b><small>{new Date(order.created_at).toLocaleString(localeFor(lang), { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</small></span>
                <span className="customer"><i>{(order.customer.name || order.customer.whatsapp_phone).charAt(0)}</i>{order.customer.name || order.customer.whatsapp_phone}</span>
                <span>{order.items.map(it => `${it.quantity} × ${it.product_name}`).join(" + ")}</span>
                <span><b>{fmtFcfa(order.total_amount, lang)}</b> FCFA</span>
                <span>{order.delivery_neighborhood || order.delivery_city || t.orders.noDelivery}</span>
                <span><Badge tone={statusTone[order.status] ?? "grey"}>{statusLabel[order.status] ?? order.status}</Badge></span>
                <button className="more-button" onClick={e => { e.stopPropagation(); onOpenDetail(order); }} aria-label={tFormat(t.orders.viewOrder, { num: order.order_number })}><MoreHorizontal size={20} /></button>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function OrderDetailModal({ order, close, onUpdated }: { order: OrderRead; close: () => void; onUpdated: () => void }) {
  const { lang } = useLanguage();
  const t = useDashboardT();
  const [newStatus, setNewStatus] = useState(order.status);
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusLabel: Record<string, string> = {
    pending: t.orders.statusNew, confirmed: t.orders.statusConfirmed, delivering: t.orders.statusDelivering,
    delivered: t.orders.statusDelivered, cancelled: t.orders.statusCancelled,
  };
  const statusTone: Record<string, string> = { pending: "pink", confirmed: "grey", delivering: "orange", delivered: "green", cancelled: "red" };

  async function handleUpdate() {
    setSaving(true);
    setError(null);
    try {
      await updateOrderStatus(order.id, { status: newStatus, notify_customer: notify });
      onUpdated();
      close();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.orderDetail.updateFailed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal modal-lg">
        <button className="modal-close" onClick={close} aria-label={t.changePasswordModal.close}><X size={20} /></button>
        <div className="order-detail-header">
          <div><h2>{order.order_number}</h2><p className="order-detail-meta">{order.customer.name || order.customer.whatsapp_phone} · {new Date(order.created_at).toLocaleString(localeFor(lang))}</p></div>
          <Badge tone={statusTone[order.status] ?? "grey"}>{statusLabel[order.status] ?? order.status}</Badge>
        </div>

        <div className="order-detail-section">
          <h4>{t.orderDetail.products}</h4>
          <div className="order-detail-items">
            {order.items.map(item => (
              <div className="order-detail-item" key={item.id}><span>{item.quantity} × {item.product_name}</span><span>{fmtFcfa(item.subtotal, lang)} FCFA</span></div>
            ))}
          </div>
          <div className="order-detail-total"><span>{t.orderDetail.total}</span><span>{fmtFcfa(order.total_amount, lang)} FCFA</span></div>
        </div>

        <div className="order-detail-section">
          <h4>{t.orderDetail.delivery}</h4>
          <p>{[order.delivery_neighborhood, order.delivery_city].filter(Boolean).join(", ") || t.orderDetail.notProvided}{order.delivery_address ? ` — ${order.delivery_address}` : ""}</p>
        </div>

        <div className="order-detail-section">
          <h4>{t.orderDetail.changeStatus}</h4>
          <div className="order-status-select">
            <select value={newStatus} onChange={e => setNewStatus(e.target.value)}>
              <option value="pending">{t.orders.statusNew}</option>
              <option value="confirmed">{t.orders.statusConfirmed}</option>
              <option value="delivering">{t.orders.statusDelivering}</option>
              <option value="delivered">{t.orders.statusDelivered}</option>
              <option value="cancelled">{t.orders.statusCancelled}</option>
            </select>
            <button className="primary-button" onClick={handleUpdate} disabled={saving || newStatus === order.status}>
              {saving ? t.orderDetail.updating : t.orderDetail.update}
            </button>
          </div>
          <label className="order-notify-check">
            <input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} /> {t.orderDetail.notifyCustomer}
          </label>
          {error && <p className="auth2-error" style={{ marginTop: 10 }}>{error}</p>}
        </div>
      </div>
    </div>
  );
}

/* ─── Catalog ─── */
function Catalog({ openModal, refreshKey }: { openModal: () => void; refreshKey: number }) {
  const { lang } = useLanguage();
  const t = useDashboardT();
  const [catalog, setCatalog] = useState<ProductRead[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [search, setSearch] = useState("");

  const load = () => {
    setStatus("loading");
    listProducts()
      .then(data => { setCatalog(data); setStatus("ready"); })
      .catch(() => setStatus("error"));
  };
  useEffect(load, [refreshKey]);

  const query = search.trim().toLowerCase();
  const filtered = query ? catalog.filter(p => p.name.toLowerCase().includes(query)) : catalog;

  async function toggleAvailable(product: ProductRead) {
    const next = !product.is_available;
    setCatalog(items => items.map(p => (p.id === product.id ? { ...p, is_available: next } : p)));
    try {
      await updateProduct(product.id, { is_available: next });
    } catch {
      setCatalog(items => items.map(p => (p.id === product.id ? { ...p, is_available: !next } : p)));
    }
  }

  return (
    <>
      <div className="page-heading compact">
        <div><p className="eyebrow">{t.catalog.eyebrow}</p><h1>{t.catalog.title}</h1><p className="muted">{t.catalog.subtitle}</p></div>
        <button className="primary-button" onClick={openModal}><Plus size={18} /> {t.catalog.addProduct}</button>
      </div>
      <div className="catalog-tools">
        <div className="search"><Search size={17} /><input placeholder={t.catalog.searchPlaceholder} value={search} onChange={e => setSearch(e.target.value)} /></div>
      </div>

      {status === "loading" && <LoadingState label={t.catalog.loading} />}
      {status === "error" && <ErrorState message={t.catalog.error} onRetry={load} />}
      {status === "ready" && filtered.length === 0 && (
        <EmptyState
          icon={Package}
          title={catalog.length === 0 ? t.catalog.emptyTitleNone : t.catalog.emptyTitleFiltered}
          text={catalog.length === 0 ? t.catalog.emptyTextNone : tFormat(t.common.noResultsFor, { query: search })}
          actionLabel={catalog.length === 0 ? t.catalog.addProduct : t.common.resetSearch}
          onAction={catalog.length === 0 ? openModal : () => setSearch("")}
        />
      )}
      {status === "ready" && filtered.length > 0 && (
        <section className="product-grid">
          {filtered.map((product, index) => (
            <article className="product-card" key={product.id}>
              <div className="product-image">
                {product.image_url ? (
                  <img src={resolveImageUrl(product.image_url) ?? undefined} alt={product.name} className="product-photo" />
                ) : (
                  <ProductArt tone={toneFor(index)} />
                )}
                {!product.is_available && <Badge tone="red">{t.catalog.outOfStock}</Badge>}
              </div>
              <div className="product-body">
                <p>{product.category?.name ?? t.catalog.noCategory}</p>
                <h3>{product.name}</h3>
                <strong>{fmtFcfa(product.price, lang)} <small>FCFA</small></strong>
                <div className="product-footer">
                  <span>{tFormat(t.catalog.soldTimes, { count: product.sold_count })}</span>
                  <button className={`switch ${product.is_available ? "on" : ""}`} onClick={() => toggleAvailable(product)} aria-label={tFormat(t.catalog.toggleAvailability, { name: product.name })}><i /></button>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
      <section className="catalog-help">
        <span className="soft-icon purple"><Sparkles size={18} /></span>
        <p><b>{t.catalog.helpTitle}</b> {t.catalog.helpText}</p>
      </section>
    </>
  );
}

function AddProductModal({ close, onCreated }: { close: () => void; onCreated: () => void }) {
  const t = useDashboardT();
  const [categories, setCategories] = useState<CategoryRead[]>([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (!imageFile) { setImagePreview(null); return; }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError(t.addProductModal.formatError);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError(t.addProductModal.sizeError);
      return;
    }
    setError(null);
    setImageFile(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const product = await createProduct({
        name,
        price: Number(price),
        category_id: categoryId || undefined,
        description: description || undefined,
      });
      if (imageFile) {
        await uploadProductImage(product.id, imageFile);
      }
      onCreated();
      close();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.addProductModal.createError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <button className="modal-close" onClick={close} aria-label={t.changePasswordModal.close}><X size={20} /></button>
        <span className="soft-icon purple"><Package size={20} /></span>
        <h2>{t.addProductModal.title}</h2>
        <p>{t.addProductModal.subtitle}</p>
        <form onSubmit={handleSubmit}>
          <div className="modal-fields">
            <label className="modal-photo-field">
              {t.addProductModal.photoLabel}
              <label className="modal-photo-picker">
                {imagePreview ? (
                  <img src={imagePreview} alt={t.addProductModal.photoPreviewAlt} />
                ) : (
                  <span><ImagePlus size={22} /> {t.addProductModal.addPhoto}</span>
                )}
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} hidden />
              </label>
            </label>
            <label>{t.addProductModal.nameLabel}<input value={name} onChange={e => setName(e.target.value)} placeholder={t.addProductModal.namePlaceholder} required /></label>
            <label>{t.addProductModal.priceLabel}<input value={price} onChange={e => setPrice(e.target.value)} placeholder={t.addProductModal.pricePlaceholder} inputMode="numeric" required /></label>
            <label>
              {t.addProductModal.categoryLabel}
              <select value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                <option value="">{t.addProductModal.noCategory}</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label>{t.addProductModal.descLabel}<textarea value={description} onChange={e => setDescription(e.target.value)} placeholder={t.addProductModal.descPlaceholder} /></label>
          </div>
          {error && <p className="auth2-error">{error}</p>}
          <button type="submit" className="primary-button full" disabled={saving}>
            <Check size={17} /> {saving ? t.addProductModal.adding : t.addProductModal.add}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ─── Followups (mock : moteur de regles pas encore construit) ─── */
function Followups() {
  const t = useDashboardT();
  const [active, setActive] = useState(true);
  return (
    <>
      <div className="page-heading compact">
        <div><p className="eyebrow">{t.followups.eyebrow}</p><h1>{t.followups.title}</h1><p className="muted">{t.followups.subtitle}</p></div>
      </div>
      <section className="panel rules-panel">
        <div className="panel-heading"><div><h2>{t.followups.activeRules}</h2><p>{t.followups.activeRulesDesc}</p></div></div>
        <article className="rule">
          <span className="rule-icon pink"><MessageCircle size={18} /></span>
          <div><h3>{t.followups.ruleTitle}</h3><p>{t.followups.ruleDesc}</p><span className="rule-delay">{t.followups.ruleDelay}</span></div>
          <button className={`switch ${active ? "on" : ""}`} onClick={() => setActive(!active)} aria-label={t.followups.activateRule}><i /></button>
        </article>
      </section>
      <section className="catalog-help">
        <span className="soft-icon purple"><Sparkles size={18} /></span>
        <p>{t.followups.comingSoon}</p>
      </section>
    </>
  );
}

/* ─── Negotiation ─── */
function NegotiationPanel() {
  const { lang } = useLanguage();
  const t = useDashboardT();
  const [products, setProducts] = useState<ProductRead[]>([]);
  const [rules, setRules] = useState<Record<string, NegotiationRuleRead>>({});
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = () => {
    setStatus("loading");
    Promise.all([listProducts(), listNegotiationRules()])
      .then(([prods, existingRules]) => {
        setProducts(prods);
        setRules(Object.fromEntries(existingRules.map(r => [r.product_id, r])));
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  };
  useEffect(load, []);

  function ruleFor(product: ProductRead): NegotiationRuleRead {
    return rules[product.id] ?? { id: "", product_id: product.id, is_negotiable: false, floor_price: product.price, max_discount_pct: 0 };
  }

  async function save(product: ProductRead, patch: Partial<NegotiationRuleRead>) {
    const current = ruleFor(product);
    const updated = { ...current, ...patch };
    setRules(r => ({ ...r, [product.id]: updated }));
    setSaving(product.id);
    try {
      const saved = await upsertNegotiationRule(product.id, {
        is_negotiable: updated.is_negotiable,
        floor_price: updated.floor_price,
        max_discount_pct: updated.max_discount_pct,
      });
      setRules(r => ({ ...r, [product.id]: saved }));
    } catch {
      setRules(r => ({ ...r, [product.id]: current }));
    } finally {
      setSaving(null);
    }
  }

  if (status === "loading") return <article className="panel negotiation-panel"><LoadingState label={t.negotiation.loading} /></article>;
  if (status === "error") return <article className="panel negotiation-panel"><ErrorState message={t.negotiation.error} onRetry={load} /></article>;

  const negotiableProducts = products.filter(p => ruleFor(p).is_negotiable);
  const previewProduct = negotiableProducts[0];
  const previewRule = previewProduct ? ruleFor(previewProduct) : null;
  const minPrice = previewRule
    ? Math.max(previewRule.floor_price, Math.round(Number(previewProduct!.price) * (1 - previewRule.max_discount_pct / 100)))
    : 0;

  return (
    <article className="panel negotiation-panel">
      <div className="negotiation-global">
        <div><span className="soft-icon pink"><WalletCards size={19} /></span><div><h2>{t.negotiation.allow}</h2><p>{t.negotiation.allowDesc}</p></div></div>
        <button className={`switch ${globalEnabled ? "on" : ""}`} onClick={() => setGlobalEnabled(g => !g)} aria-label={t.negotiation.allow}><i /></button>
      </div>
      {products.length === 0 ? (
        <p className="muted">{t.negotiation.emptyProducts}</p>
      ) : (
        <div className="negotiation-rows">
          {products.map(product => {
            const rule = ruleFor(product);
            return (
              <div className="negotiation-row" key={product.id}>
                <div>
                  <span className="field-name">{product.name}</span>
                  <label>{t.negotiation.catalogPrice}</label>
                  <span>{fmtFcfa(product.price, lang)} FCFA</span>
                </div>
                <div>
                  <label>{t.negotiation.floorPrice}</label>
                  <input
                    type="number"
                    value={rule.floor_price}
                    min={0}
                    max={product.price}
                    disabled={!globalEnabled || !rule.is_negotiable || saving === product.id}
                    onChange={e => save(product, { floor_price: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label>{t.negotiation.maxDiscount}</label>
                  <input
                    type="number"
                    value={rule.max_discount_pct}
                    min={0}
                    max={100}
                    disabled={!globalEnabled || !rule.is_negotiable || saving === product.id}
                    onChange={e => save(product, { max_discount_pct: Number(e.target.value) })}
                  />
                </div>
                <button
                  className={`switch ${rule.is_negotiable ? "on" : ""}`}
                  onClick={() => save(product, { is_negotiable: !rule.is_negotiable })}
                  disabled={!globalEnabled}
                  aria-label={tFormat(t.negotiation.negotiable, { name: product.name })}
                >
                  <i />
                </button>
              </div>
            );
          })}
        </div>
      )}
      {globalEnabled && previewRule && previewProduct && (
        <div className="negotiation-preview">
          <Sparkles size={16} />
          <p>
            {t.negotiation.previewBefore}<b>{previewProduct.name}</b>{t.negotiation.previewMiddle}
            <b>{fmtFcfa(minPrice, lang)} FCFA</b>{tFormat(t.negotiation.previewAfter, { floor: fmtFcfa(previewRule.floor_price, lang) })}
          </p>
        </div>
      )}
    </article>
  );
}

/* ─── Agent ─── */
function Agent({ profile, onProfileUpdated }: { profile: ProfileRead; onProfileUpdated: (p: ProfileRead) => void }) {
  const t = useDashboardT();
  const [tone, setTone] = useState(profile.agent_tone ?? "Chaleureux");
  const [welcome, setWelcome] = useState(profile.agent_welcome ?? "");
  const [info, setInfo] = useState(profile.agent_info ?? "");
  const [enabled, setEnabled] = useState(true);
  const [showNegotiation, setShowNegotiation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const updated = await updateProfile({ agent_tone: tone, agent_welcome: welcome, agent_info: info });
      onProfileUpdated(updated);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  const toneOptions: { value: string; label: string }[] = [
    { value: "Amical", label: t.agent.toneFriendly },
    { value: "Professionnel", label: t.agent.toneProfessional },
    { value: "Chaleureux", label: t.agent.toneWarm },
  ];

  return (
    <>
      <div className="page-heading compact">
        <div><p className="eyebrow">{t.agent.eyebrow}</p><h1>{t.agent.title}</h1><p className="muted">{t.agent.subtitle}</p></div>
        <div className="agent-state"><span className="online-dot" /> {t.agent.active} <button className={`switch ${enabled ? "on" : ""}`} onClick={() => setEnabled(!enabled)}><i /></button></div>
      </div>
      <div className="agent-layout">
        <section className="panel agent-form">
          <div className="panel-heading"><div><h2>{t.agent.formTitle}</h2><p>{t.agent.formDesc}</p></div></div>
          <label>{t.agent.toneLabel}</label>
          <div className="tone-options">
            {toneOptions.map(item => (
              <button type="button" className={tone === item.value ? "selected" : ""} onClick={() => setTone(item.value)} key={item.value}>{tone === item.value && <Check size={15} />} {item.label}</button>
            ))}
          </div>
          <label>{t.agent.welcomeLabel}</label>
          <textarea value={welcome} onChange={e => setWelcome(e.target.value)} />
          <label>{t.agent.infoLabel}</label>
          <textarea className="details-text" value={info} onChange={e => setInfo(e.target.value)} />
          <button className="primary-button full" onClick={handleSave} disabled={saving}>
            <Check size={18} /> {saving ? t.agent.saving : saved ? t.agent.saved : t.agent.save}
          </button>
        </section>
        <aside className="agent-preview">
          <div className="preview-heading"><span><MessageCircle size={17} /> {t.agent.tryTitle}</span><small>{t.agent.previewSub}</small></div>
          <div className="preview-chat">
            <p className="preview-day">{t.agent.simulation}</p>
            <div className="bubble incoming">{t.agent.sampleQuestion}</div>
            <div className="bubble outgoing">{welcome || t.agent.defaultWelcome}</div>
          </div>
          <p className="preview-foot"><Sparkles size={14} /> {t.agent.previewFoot}</p>
        </aside>
      </div>
      <section className="negotiation-card">
        <div><span className="soft-icon pink"><WalletCards size={19} /></span><div><h2>{t.agent.negotiationTitle}</h2><p>{t.agent.negotiationDesc}</p></div></div>
        <button className="secondary-button" onClick={() => setShowNegotiation(s => !s)}>
          {showNegotiation ? t.agent.reduce : t.agent.configure} <ChevronRight size={17} />
        </button>
      </section>
      {showNegotiation && <NegotiationPanel />}
    </>
  );
}

/* ─── Facturation : le paiement reel n'est pas encore ouvert, mais le
   forfait choisi par le commercant est reel et persiste sur son profil. */
function Billing({ profile }: { profile: ProfileRead }) {
  const router = useRouter();
  const t = useDashboardT();
  const planKey = (["decouverte", "starter", "business", "scale"] as const).includes(profile.plan as never)
    ? (profile.plan as "decouverte" | "starter" | "business" | "scale")
    : "decouverte";
  const plan = t.billing.plans[planKey];
  return (
    <>
      <div className="page-heading compact">
        <div><p className="eyebrow">{t.billing.eyebrow}</p><h1>{t.billing.title}</h1><p className="muted">{t.billing.subtitle}</p></div>
      </div>
      <section className="plan-hero">
        <div><span className="plan-label">{t.billing.currentOffer}</span><h2>{plan.name} <Badge tone="green">{t.billing.active}</Badge></h2><p>{plan.desc}</p></div>
        <div className="plan-price">
          <strong>{plan.price}</strong>
          <button type="button" className="text-button" onClick={() => router.push("/pricing")}>{t.billing.changePlan} <ChevronRight size={15} /></button>
        </div>
      </section>
      <section className="payment-strip"><span><CreditCard size={21} /></span><p><b>{t.billing.paymentTitle}</b> — {t.billing.paymentDesc}</p><ShieldCheck size={19} /></section>
    </>
  );
}

/* ─── Settings tabs ─── */
function BoutiqueTab({ profile, onProfileUpdated }: { profile: ProfileRead; onProfileUpdated: (p: ProfileRead) => void }) {
  const t = useDashboardT();
  const [form, setForm] = useState({
    shop_name: profile.shop_name,
    activity_type: profile.activity_type ?? "restauration",
    delivery_zones: profile.delivery_zones ?? "",
    address: profile.address ?? "",
    hours: profile.hours ?? "",
    whatsapp_number: profile.whatsapp_number ?? "",
  });
  const [whatsappValid, setWhatsappValid] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    if (form.whatsapp_number && !whatsappValid) return;
    setSaving(true);
    setSaved(false);
    try {
      const updated = await updateProfile(form);
      onProfileUpdated(updated);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="panel-heading"><div><h2>{t.boutiqueTab.title}</h2><p>{t.boutiqueTab.desc}</p></div></div>
      <div className="form-grid">
        <label>{t.boutiqueTab.shopName}<input value={form.shop_name} onChange={e => setForm(f => ({ ...f, shop_name: e.target.value }))} /></label>
        <label>{t.boutiqueTab.sector}
          <select value={form.activity_type} onChange={e => setForm(f => ({ ...f, activity_type: e.target.value }))}>
            <option value="restauration">{t.boutiqueTab.sectorRestauration}</option>
            <option value="mode">{t.boutiqueTab.sectorMode}</option>
            <option value="services">{t.boutiqueTab.sectorServices}</option>
            <option value="autre">{t.boutiqueTab.sectorOther}</option>
          </select>
        </label>
        <label>{t.boutiqueTab.deliveryZone}<input value={form.delivery_zones} onChange={e => setForm(f => ({ ...f, delivery_zones: e.target.value }))} /></label>
        <label>
          {t.boutiqueTab.whatsappNumber}
          <PhoneInput
            value={form.whatsapp_number}
            onChange={(full, valid) => { setForm(f => ({ ...f, whatsapp_number: full })); setWhatsappValid(valid); }}
          />
        </label>
        <label className="span-2">{t.boutiqueTab.address}<textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></label>
        <label className="span-2">{t.boutiqueTab.hours}<textarea value={form.hours} onChange={e => setForm(f => ({ ...f, hours: e.target.value }))} /></label>
      </div>
      <button className="primary-button" onClick={handleSave} disabled={saving || (!!form.whatsapp_number && !whatsappValid)}>
        <Check size={17} /> {saving ? t.boutiqueTab.saving : saved ? t.boutiqueTab.saved : t.boutiqueTab.save}
      </button>
    </>
  );
}

function EquipeTab() {
  const t = useDashboardT();
  const [team, setTeam] = useState<TeamMemberRead[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  const load = () => {
    setStatus("loading");
    listTeam().then(data => { setTeam(data); setStatus("ready"); }).catch(() => setStatus("error"));
  };
  useEffect(load, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setInviting(true);
    try {
      const member = await inviteTeamMember({ email: email.trim() });
      setTeam(t => [...t, member]);
      setEmail("");
    } catch {
      // ignore, formulaire reste rempli pour reessayer
    } finally {
      setInviting(false);
    }
  }

  return (
    <>
      <div className="panel-heading">
        <div><h2>{t.equipeTab.title}</h2><p>{t.equipeTab.desc}</p></div>
      </div>
      <form onSubmit={handleInvite} className="modal-fields" style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 18 }}>
        <label style={{ flex: 1 }}>{t.equipeTab.inviteLabel}<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t.equipeTab.invitePlaceholder} /></label>
        <button type="submit" className="primary-button small" disabled={inviting}><Plus size={16} /> {t.equipeTab.invite}</button>
      </form>
      {status === "loading" && <LoadingState label={t.equipeTab.loading} />}
      {status === "error" && <ErrorState message={t.equipeTab.error} onRetry={load} />}
      {status === "ready" && team.length === 0 && <p className="muted">{t.equipeTab.empty}</p>}
      {status === "ready" && team.length > 0 && (
        <div className="team-list">
          {team.map(m => (
            <div className="team-row" key={m.id}>
              <span className="avatar avatar-purple">{(m.name || m.email).charAt(0).toUpperCase()}</span>
              <div><b>{m.name || m.email}</b><small>{m.role === "owner" ? t.equipeTab.owner : t.equipeTab.member} · {m.email}</small></div>
              <Badge tone={m.accepted_at ? "green" : "grey"}>{m.accepted_at ? t.equipeTab.active : t.equipeTab.invitationSent}</Badge>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function LangueTab() {
  const { lang, setLang } = useLanguage();
  const t = useDashboardT();
  const [selected, setSelected] = useState(lang);

  useEffect(() => {
    setSelected(lang);
  }, [lang]);

  return (
    <>
      <div className="panel-heading"><div><h2>{t.settings.languageTitle}</h2><p>{t.settings.languageDesc}</p></div></div>
      <div className="form-grid">
        <label>{t.settings.languageLabel}<select value={selected} onChange={(e) => setSelected(e.target.value as Lang)}><option value="fr">Français</option><option value="en">English</option></select></label>
      </div>
      <button className="primary-button" onClick={() => setLang(selected)}><Check size={17} /> {t.settings.save}</button>
    </>
  );
}

function CompteTab({ onRequestClose }: { onRequestClose: () => void }) {
  const t = useDashboardT();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  return (
    <>
      <div className="panel-heading"><div><h2>{t.compteTab.title}</h2><p>{t.compteTab.desc}</p></div></div>
      <div className="account-row"><div><b>{t.compteTab.password}</b><small>{t.compteTab.passwordDesc}</small></div><button className="secondary-button" onClick={() => setShowPasswordModal(true)}>{t.compteTab.change}</button></div>
      <div className="account-row"><div><b>{t.compteTab.emailNotif}</b><small>{t.compteTab.emailNotifDesc}</small></div><button className="switch on" aria-label={t.compteTab.emailNotif}><i /></button></div>
      <section className="danger-zone">
        <div><h3>{t.compteTab.closeAccount}</h3><p>{t.compteTab.closeAccountDesc}</p></div>
        <button className="danger-button" onClick={onRequestClose}>{t.compteTab.closeAccount}</button>
      </section>
      {showPasswordModal && <ChangePasswordModal close={() => setShowPasswordModal(false)} />}
    </>
  );
}

function ChangePasswordModal({ close }: { close: () => void }) {
  const t = useDashboardT();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const newPasswordValid = PASSWORD_PATTERN.test(newPassword);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!newPasswordValid) {
      setError(PASSWORD_HINT);
      return;
    }
    if (newPassword !== confirm) {
      setError(t.changePasswordModal.mismatch);
      return;
    }
    setSaving(true);
    try {
      await changePassword({ current_password: currentPassword, new_password: newPassword });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.changePasswordModal.genericError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <button className="modal-close" onClick={close} aria-label={t.changePasswordModal.close}><X size={20} /></button>
        {done ? (
          <>
            <span className="soft-icon green"><Check size={20} /></span>
            <h2>{t.changePasswordModal.successTitle}</h2>
            <p>{t.changePasswordModal.successText}</p>
            <div className="modal-confirm-actions"><button className="primary-button" onClick={close}>{t.changePasswordModal.close}</button></div>
          </>
        ) : (
          <>
            <h2>{t.changePasswordModal.title}</h2>
            <p>{t.changePasswordModal.desc}</p>
            <form className="modal-fields" onSubmit={handleSubmit}>
              <label>{t.changePasswordModal.current}
                <div className="input-with-icon">
                  <input
                    type={showPasswords ? "text" : "password"}
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    required
                  />
                  <button type="button" onClick={() => setShowPasswords(s => !s)} aria-label={showPasswords ? t.changePasswordModal.hide : t.changePasswordModal.show}>
                    {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>
              <label>{t.changePasswordModal.newPassword}
                <div className="input-with-icon">
                  <input
                    type={showPasswords ? "text" : "password"}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                  />
                </div>
                <small className={`auth2-field-hint ${newPassword && !newPasswordValid ? "invalid" : ""}`}>{PASSWORD_HINT}</small>
              </label>
              <label>{t.changePasswordModal.confirmNew}
                <div className="input-with-icon">
                  <input
                    type={showPasswords ? "text" : "password"}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                  />
                </div>
              </label>
              {error && <p className="auth2-error" style={{ marginTop: 10 }}>{error}</p>}
              <button type="submit" className="primary-button full" disabled={saving}>
                {saving ? t.changePasswordModal.saving : t.changePasswordModal.submit}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function SettingsPanel({ profile, onProfileUpdated }: { profile: ProfileRead; onProfileUpdated: (p: ProfileRead) => void }) {
  const [tab, setTab] = useState(0);
  const [confirmClose, setConfirmClose] = useState(false);
  const t = useDashboardT();
  const settingsMenu: { label: string; icon: typeof Home }[] = [
    { label: t.settings.boutique, icon: Home },
    { label: t.settings.team, icon: Users },
    { label: t.settings.language, icon: Globe2 },
    { label: t.settings.account, icon: Settings },
  ];
  return (
    <>
      <div className="page-heading compact"><div><p className="eyebrow">{t.settings.heading}</p><h1>{t.settings.title}</h1><p className="muted">{t.settings.subtitle}</p></div></div>
      <div className="settings-layout">
        <aside className="settings-menu panel">
          {settingsMenu.map(({ label, icon: Icon }, index) => (
            <button className={index === tab ? "active" : ""} key={label} onClick={() => setTab(index)}>
              <Icon size={18} />{label}<ChevronRight size={16} />
            </button>
          ))}
        </aside>
        <section className="panel setting-content">
          {tab === 0 && <BoutiqueTab profile={profile} onProfileUpdated={onProfileUpdated} />}
          {tab === 1 && <EquipeTab />}
          {tab === 2 && <LangueTab />}
          {tab === 3 && <CompteTab onRequestClose={() => setConfirmClose(true)} />}
        </section>
      </div>
      {confirmClose && <ConfirmCloseAccount close={() => setConfirmClose(false)} />}
    </>
  );
}

function ConfirmCloseAccount({ close }: { close: () => void }) {
  const t = useDashboardT();
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <button className="modal-close" onClick={close} aria-label={t.confirmClose.cancel}><X size={20} /></button>
        <span className="soft-icon red"><AlertTriangle size={20} /></span>
        <h2>{t.confirmClose.title}</h2>
        <p>{t.confirmClose.text}</p>
        <div className="modal-confirm-actions">
          <button className="secondary-button" onClick={close}>{t.confirmClose.cancel}</button>
          <button className="danger-button" onClick={close}>{t.confirmClose.confirm}</button>
        </div>
      </div>
    </div>
  );
}

/* ─── App shell ─── */
function AppContent() {
  const { lang, setLang } = useLanguage();
  const t = useDashboardT();
  const menu = useMenu(t);
  const bottomNavItems = useBottomNavItems(t);
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileRead | null>(null);
  const [authStatus, setAuthStatus] = useState<"checking" | "ready" | "denied">("checking");
  const [view, setView] = useState<View>("dashboard");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [productModal, setProductModal] = useState(false);
  const [orderDetail, setOrderDetail] = useState<OrderRead | null>(null);
  const [ordersRefreshKey, setOrdersRefreshKey] = useState(0);
  const [catalogRefreshKey, setCatalogRefreshKey] = useState(0);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/auth");
      return;
    }
    const requestedView = new URLSearchParams(window.location.search).get("view");
    if (requestedView && VIEWS.includes(requestedView as View)) {
      setView(requestedView as View);
    }
    me()
      .then(p => { setProfile(p); setAuthStatus("ready"); })
      .catch(() => { clearToken(); setAuthStatus("denied"); router.replace("/auth"); });
  }, [router]);

  const content = useMemo(() => {
    if (!profile) return null;
    switch (view) {
      case "dashboard":
        return <Dashboard setView={setView} profile={profile} />;
      case "analytics":
        return <Analytics />;
      case "orders":
        return <Orders onOpenDetail={setOrderDetail} refreshKey={ordersRefreshKey} />;
      case "catalog":
        return <Catalog openModal={() => setProductModal(true)} refreshKey={catalogRefreshKey} />;
      case "followups":
        return <Followups />;
      case "agent":
        return <Agent profile={profile} onProfileUpdated={setProfile} />;
      case "billing":
        return <Billing profile={profile} />;
      case "settings":
        return <SettingsPanel profile={profile} onProfileUpdated={setProfile} />;
    }
  }, [view, profile, ordersRefreshKey, catalogRefreshKey]);

  if (authStatus !== "ready" || !profile) {
    return (
      <main className="app-shell">
        <div className="loading-state" style={{ width: "100%", minHeight: "100vh" }}>
          <span className="loading-spinner" /> {t.loadingApp}
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "show" : ""}`}>
        <div className="sidebar-brand"><Logo /><button className="mobile-close" onClick={() => setMobileMenu(false)}><X size={20} /></button></div>
        <button className="shop-card" onClick={() => setView("settings")}>
          <span className="shop-mark">{profile.shop_name.slice(0, 2).toUpperCase()}</span>
          <div><b>{profile.shop_name}</b><small><i /> WhatsApp {profile.whatsapp_phone_number_id ? t.sidebar.connected : t.sidebar.notConnected}</small></div>
          <ChevronDown size={16} />
        </button>
        <nav>
          {menu.map(({ id, label, icon: Icon, alert }) => (
            <button key={id} className={view === id ? "active" : ""} onClick={() => { setView(id); setMobileMenu(false); }}>
              <Icon size={19} /><span>{label}</span>{alert && <i className="nav-alert" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <a href="#"><CircleHelp size={18} /> {t.sidebar.helpCenter}</a>
          <a href={KORAH_WEBSITE_URL} className="korah-signature" aria-label="Korah — site vitrine">
            <img src="/korah-logo.png" alt="Korah" />
            <span>{t.sidebar.korahSolution}<br /><b>Korah</b></span>
          </a>
          <button
            className="logout"
            onClick={() => { clearToken(); router.replace("/auth"); }}
          >
            <LogOut size={17} /> {t.sidebar.logout}
          </button>
        </div>
      </aside>
      <div className="mobile-overlay" onClick={() => setMobileMenu(false)} />
      <section className="app-main">
        <header className="topbar">
          <div className="connection-status">
            <span className="online-dot" /> {profile.whatsapp_phone_number_id ? t.topbar.whatsappConnected : t.topbar.whatsappNotConnected}
          </div>
          <div className="top-actions">
            <Dropdown triggerClassName="language" trigger={<>{lang === "fr" ? "FR" : "EN"} <ChevronDown size={14} /></>}>
              <button type="button" className={`dropdown-item ${lang === "fr" ? "active" : ""}`} onClick={() => setLang("fr")}>{t.topbar.languageFr}</button>
              <button type="button" className={`dropdown-item ${lang === "en" ? "active" : ""}`} onClick={() => setLang("en")}>{t.topbar.languageEn}</button>
            </Dropdown>
            <Dropdown triggerClassName="notification" trigger={<Bell size={19} />}>
              <div className="dropdown-header">{t.topbar.notifications}</div>
              <p className="dropdown-empty">{t.topbar.noNotifications}</p>
            </Dropdown>
            <Dropdown triggerClassName="profile" trigger={profile.email.charAt(0).toUpperCase()}>
              <div className="dropdown-header">{profile.email}</div>
              <button type="button" className="dropdown-item" onClick={() => setView("settings")}>
                <Settings size={15} /> {t.topbar.parameters}
              </button>
              <button type="button" className="dropdown-item danger" onClick={() => { clearToken(); router.replace("/auth"); }}>
                <LogOut size={15} /> {t.topbar.logout}
              </button>
            </Dropdown>
          </div>
        </header>
        <div className="content">{content}</div>
      </section>
      <nav className="bottom-nav">
        {bottomNavItems.map(({ id, label, icon: Icon, alert }) => (
          <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}>
            <Icon size={20} />
            <span>{label}</span>
            {alert && <i className="bottom-nav-alert" />}
          </button>
        ))}
        <button className={mobileMenu || !["dashboard", "orders", "catalog"].includes(view) ? "active" : ""} onClick={() => setMobileMenu(true)}>
          <Menu size={20} />
          <span>{t.bottomNav.more}</span>
        </button>
      </nav>
      {productModal && (
        <AddProductModal
          close={() => setProductModal(false)}
          onCreated={() => setCatalogRefreshKey(k => k + 1)}
        />
      )}
      {orderDetail && (
        <OrderDetailModal
          order={orderDetail}
          close={() => setOrderDetail(null)}
          onUpdated={() => setOrdersRefreshKey(k => k + 1)}
        />
      )}
    </main>
  );
}

export default function KozappApp() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}
