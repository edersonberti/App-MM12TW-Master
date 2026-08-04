'use client';

import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import {
  TrendingUp,
  PackageCheck,
  Package,
  Users,
  Factory,
  ChevronRight,
  Activity,
  Cpu,
  X,
} from 'lucide-react';
import type { ProductionDevice, ProductionModelStats } from '../services/productionDeviceService';
import type { AuditEvent } from '../services/auditService';

type AdminDevice = {
  id: string;
  model: string;
  serial?: string;
  user_id: string | null;
  userEmail: string | null;
};

type Props = {
  productionStats: ProductionModelStats[];
  productionDevices: ProductionDevice[];
  adminAllDevices: AdminDevice[];
  simUsers: Array<{ uid?: string; email?: string; role?: string }>;
  auditEvents: AuditEvent[];
  productionLoading?: boolean;
  auditLoading?: boolean;
  onOpenProduction: () => void;
  onOpenAudit: () => void;
  onOpenUsers: () => void;
  formatAuditEventType: (eventType: string) => string;
};

const COLORS = {
  produced: '#205ed7',
  available: '#f59e0b',
  claimed: '#059669',
  mix: ['#205ed7', '#2687e9', '#00aff0', '#059669', '#7c3aed', '#ea580c', '#0d9488', '#db2777'],
};

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function weekLabel(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
  active,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ElementType;
  accent: string;
  active?: boolean;
}) {
  return (
    <div
      className={`bg-white border rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col gap-3 min-w-0 text-left transition-all ${
        active ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-300'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-600 leading-snug">
          {label}
        </span>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${accent}18`, color: accent }}
        >
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div>
        <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight tabular-nums">{value}</p>
        <p className="text-[10px] sm:text-[11px] text-slate-500 mt-1 font-medium leading-snug">{hint}</p>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
  action,
  className = '',
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white border border-slate-300 rounded-2xl shadow-sm p-4 sm:p-5 flex flex-col min-w-0 ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        {action}
      </div>
      <div className="flex-1 min-h-0 w-full">{children}</div>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg text-[11px]">
      {label && <p className="font-bold text-slate-800 mb-1">{label}</p>}
      {payload.map((p) => (
        <p key={String(p.name)} className="text-slate-600 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="font-medium">{p.name}:</span>
          <span className="tabular-nums font-bold text-slate-900">{p.value ?? 0}</span>
        </p>
      ))}
    </div>
  );
}

export default function AdminCommercialDashboard({
  productionStats,
  productionDevices,
  adminAllDevices,
  simUsers,
  auditEvents,
  productionLoading,
  auditLoading,
  onOpenProduction,
  onOpenAudit,
  onOpenUsers,
  formatAuditEventType,
}: Props) {
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  const toggleModel = (model: string) => {
    const m = (model || '').toUpperCase();
    setSelectedModel((prev) => (prev === m ? null : m));
  };

  const selectedStat = useMemo(() => {
    if (!selectedModel) return null;
    return productionStats.find((r) => (r.model || '').toUpperCase() === selectedModel) || null;
  }, [productionStats, selectedModel]);

  const totals = useMemo(() => {
    const operators = simUsers.filter((u) => u.role === 'operator').length;

    if (selectedStat) {
      const produced = selectedStat.produced || 0;
      const available = selectedStat.available || 0;
      const claimed = selectedStat.claimed || 0;
      const uniqueUsers = selectedStat.unique_users || 0;
      const rate = produced > 0 ? (claimed / produced) * 100 : 0;
      const registered = adminAllDevices.filter(
        (d) => (d.model || '').toUpperCase() === selectedModel
      ).length;
      return { produced, available, claimed, uniqueUsers, rate, operators, registered };
    }

    // Without model filter: count distinct owners across claimed devices (true "clientes")
    // and keep uniqueUsers sum as fallback from production_stats
    const produced = productionStats.reduce((s, r) => s + (r.produced || 0), 0);
    const available = productionStats.reduce((s, r) => s + (r.available || 0), 0);
    const claimed = productionStats.reduce((s, r) => s + (r.claimed || 0), 0);
    const uniqueUsersSum = productionStats.reduce((s, r) => s + (r.unique_users || 0), 0);
    const distinctOwners = new Set(
      productionDevices
        .filter((d) => d.status === 'claimed' && (d.claimed_by || d.owner_email))
        .map((d) => d.claimed_by || d.owner_email || '')
    );
    const uniqueUsers = distinctOwners.size > 0 ? distinctOwners.size : uniqueUsersSum;
    const rate = produced > 0 ? (claimed / produced) * 100 : 0;
    return {
      produced,
      available,
      claimed,
      uniqueUsers,
      rate,
      operators,
      registered: adminAllDevices.length,
    };
  }, [productionStats, simUsers, selectedStat, selectedModel, adminAllDevices, productionDevices]);

  const modelChips = useMemo(() => {
    const fromStats = productionStats.map((r) => (r.model || '').toUpperCase()).filter(Boolean);
    if (fromStats.length > 0) return [...new Set(fromStats)].sort();
    return [...new Set(adminAllDevices.map((d) => (d.model || '').toUpperCase()).filter(Boolean))].sort();
  }, [productionStats, adminAllDevices]);

  const funnelByModel = useMemo(
    () =>
      [...productionStats]
        .sort((a, b) => (b.produced || 0) - (a.produced || 0))
        .slice(0, 8)
        .map((r) => ({
          model: r.model,
          Produzidos: r.produced || 0,
          Disponíveis: r.available || 0,
          Instalados: r.claimed || 0,
        })),
    [productionStats]
  );

  const mixData = useMemo(() => {
    const rows = productionStats
      .filter((r) => (r.claimed || 0) > 0)
      .map((r) => ({ name: r.model, value: r.claimed || 0 }))
      .sort((a, b) => b.value - a.value);
    if (rows.length === 0) {
      const map = new Map<string, number>();
      adminAllDevices.forEach((d) => {
        const m = (d.model || '—').toUpperCase();
        map.set(m, (map.get(m) || 0) + 1);
      });
      return [...map.entries()]
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
    }
    return rows;
  }, [productionStats, adminAllDevices]);

  const weeklyInstalls = useMemo(() => {
    const weeks = 12;
    const now = startOfWeek(new Date());
    const buckets: { key: number; label: string; Instalacoes: number }[] = [];
    for (let i = weeks - 1; i >= 0; i--) {
      const start = new Date(now);
      start.setDate(now.getDate() - i * 7);
      buckets.push({ key: start.getTime(), label: weekLabel(start), Instalacoes: 0 });
    }

    productionDevices.forEach((d) => {
      if (d.status !== 'claimed') return;
      if (selectedModel && (d.model || '').toUpperCase() !== selectedModel) return;
      const raw = d.claimed_at || d.created_at;
      if (!raw) return;
      const dt = startOfWeek(new Date(raw));
      const bucket = buckets.find((b) => b.key === dt.getTime());
      if (bucket) bucket.Instalacoes += 1;
    });

    return buckets.map(({ label, Instalacoes }) => ({ label, Instalacoes }));
  }, [productionDevices, selectedModel]);

  const stockBars = useMemo(
    () =>
      [...productionStats]
        .filter((r) => (r.available || 0) > 0)
        .filter((r) => !selectedModel || (r.model || '').toUpperCase() === selectedModel)
        .sort((a, b) => (b.available || 0) - (a.available || 0))
        .slice(0, 8)
        .map((r) => ({ model: r.model, Disponíveis: r.available || 0 })),
    [productionStats, selectedModel]
  );

  const topAccounts = useMemo(() => {
    const map = new Map<string, number>();
    adminAllDevices.forEach((d) => {
      if (selectedModel && (d.model || '').toUpperCase() !== selectedModel) return;
      const key = d.userEmail || d.user_id || 'Sem dono';
      map.set(key, (map.get(key) || 0) + 1);
    });
    return [...map.entries()]
      .map(([email, count]) => ({ email, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [adminAllDevices, selectedModel]);

  const recentClaims = useMemo(() => {
    return [...productionDevices]
      .filter((d) => d.status === 'claimed')
      .filter((d) => !selectedModel || (d.model || '').toUpperCase() === selectedModel)
      .sort((a, b) => {
        const ta = new Date(a.claimed_at || a.created_at || 0).getTime();
        const tb = new Date(b.claimed_at || b.created_at || 0).getTime();
        return tb - ta;
      })
      .slice(0, 6);
  }, [productionDevices, selectedModel]);

  const emptyCharts =
    !productionLoading &&
    productionStats.length === 0 &&
    productionDevices.length === 0 &&
    adminAllDevices.length === 0;

  return (
    <div className="space-y-4 sm:space-y-5">
      {modelChips.length > 0 && (
        <div className="bg-white border border-slate-300 rounded-2xl shadow-sm px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 shrink-0">
            Filtrar modelo
          </span>
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <button
              type="button"
              onClick={() => setSelectedModel(null)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                !selectedModel
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Todos
            </button>
            {modelChips.map((model) => {
              const active = selectedModel === model;
              return (
                <button
                  key={model}
                  type="button"
                  onClick={() => toggleModel(model)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border font-mono transition-colors ${
                    active
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {model}
                </button>
              );
            })}
            {selectedModel && (
              <button
                type="button"
                onClick={() => setSelectedModel(null)}
                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold text-slate-500 hover:text-slate-800"
                title="Limpar filtro"
              >
                <X className="w-3.5 h-3.5" />
                Limpar
              </button>
            )}
          </div>
          {selectedModel && (
            <p className="text-[10px] text-blue-700 font-semibold sm:ml-auto">
              Exibindo dados de <span className="font-mono">{selectedModel}</span>
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        <KpiCard
          label="Usuarios operadores"
          value={String(totals.operators)}
          hint="Contas operator ativas no sistema"
          icon={Users}
          accent="#b45309"
        />
        <KpiCard
          label="Equipamentos totais"
          value={String(totals.registered)}
          hint={selectedModel ? `Cadastrados do modelo ${selectedModel}` : 'Somente cadastrados / vinculados'}
          icon={Cpu}
          accent="#1d4ed8"
        />
        <KpiCard
          label="Taxa de instalacao"
          value={`${totals.rate.toFixed(1)}%`}
          hint={`${totals.claimed} de ${totals.produced} na whitelist`}
          icon={TrendingUp}
          accent="#205ed7"
        />
        <KpiCard
          label="Aparelhos instalados"
          value={String(totals.claimed)}
          hint={selectedModel ? `Claimed · ${selectedModel}` : 'Status claimed na whitelist'}
          icon={PackageCheck}
          accent="#059669"
        />
        <KpiCard
          label="Estoque disponivel"
          value={String(totals.available)}
          hint={selectedModel ? `Disponiveis · ${selectedModel}` : 'Prontos para vinculo comercial'}
          icon={Package}
          accent="#d97706"
        />
        <KpiCard
          label="Clientes por modelo"
          value={String(totals.uniqueUsers)}
          hint={
            selectedModel
              ? `Usuarios distintos com ${selectedModel}`
              : 'Clique em um modelo para filtrar'
          }
          icon={Users}
          accent="#00aff0"
          active={!!selectedModel}
        />
      </div>

      {productionLoading && (
        <div className="bg-white border border-slate-300 rounded-2xl p-8 text-center text-sm text-slate-500 shadow-sm">
          Carregando indicadores comerciais...
        </div>
      )}

      {emptyCharts && (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-8 text-center shadow-sm">
          <Factory className="w-8 h-8 text-slate-400 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-800">Sem dados de producao ainda</p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Cadastre aparelhos via QR na aba Producao para popular funil, mix e tendencia de instalacoes.
          </p>
          <button
            type="button"
            onClick={onOpenProduction}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700"
          >
            Ir para Producao
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {!emptyCharts && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 sm:gap-4">
            <ChartCard
              className="lg:col-span-3"
              title="Funil por modelo"
              subtitle="Selecione o modelo nos botões abaixo ou clique nas barras"
              action={
                <button
                  type="button"
                  onClick={onOpenProduction}
                  className="text-[10px] font-bold text-blue-700 hover:underline shrink-0"
                >
                  Ver producao
                </button>
              }
            >
              {funnelByModel.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mb-3">
                  <button
                    type="button"
                    onClick={() => setSelectedModel(null)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                      !selectedModel
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Todos
                  </button>
                  {funnelByModel.map((row) => {
                    const model = (row.model || '').toUpperCase();
                    const active = selectedModel === model;
                    return (
                      <button
                        key={model}
                        type="button"
                        onClick={() => toggleModel(model)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border font-mono transition-colors ${
                          active
                            ? 'bg-blue-600 text-white border-blue-600 ring-2 ring-blue-500/30'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-blue-50 hover:border-blue-300'
                        }`}
                      >
                        {model}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="h-[240px] sm:h-[280px] w-full">
                {funnelByModel.length === 0 ? (
                  <p className="h-full flex items-center justify-center text-xs text-slate-500">Sem estatisticas por modelo.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={funnelByModel}
                      margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
                      barCategoryGap="18%"
                      onClick={(state: any) => {
                        const model = state?.activeLabel || state?.activePayload?.[0]?.payload?.model;
                        if (model) toggleModel(String(model));
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis
                        dataKey="model"
                        tick={(props: any) => {
                          const { x, y, payload } = props;
                          const model = String(payload?.value || '').toUpperCase();
                          const active = selectedModel === model;
                          return (
                            <text
                              x={x}
                              y={y + 12}
                              textAnchor="middle"
                              fontSize={10}
                              fontWeight={active ? 700 : 500}
                              fill={active ? '#1d4ed8' : '#64748b'}
                              style={{ cursor: 'pointer' }}
                              onClick={() => toggleModel(model)}
                            >
                              {payload?.value}
                            </text>
                          );
                        }}
                        axisLine={false}
                        tickLine={false}
                        interval={0}
                      />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(32,94,215,0.06)' }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar
                        dataKey="Produzidos"
                        fill={COLORS.produced}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={28}
                        shape={(props: any) => {
                          const { x, y, width, height, payload } = props;
                          const model = String(payload?.model || '').toUpperCase();
                          const dimmed = selectedModel && selectedModel !== model;
                          return (
                            <rect
                              x={x}
                              y={y}
                              width={width}
                              height={height}
                              rx={4}
                              ry={4}
                              fill={COLORS.produced}
                              opacity={dimmed ? 0.25 : 1}
                              style={{ cursor: 'pointer' }}
                              onClick={() => toggleModel(model)}
                            />
                          );
                        }}
                      />
                      <Bar
                        dataKey="Disponíveis"
                        fill={COLORS.available}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={28}
                        shape={(props: any) => {
                          const { x, y, width, height, payload } = props;
                          const model = String(payload?.model || '').toUpperCase();
                          const dimmed = selectedModel && selectedModel !== model;
                          return (
                            <rect
                              x={x}
                              y={y}
                              width={width}
                              height={height}
                              rx={4}
                              ry={4}
                              fill={COLORS.available}
                              opacity={dimmed ? 0.25 : 1}
                              style={{ cursor: 'pointer' }}
                              onClick={() => toggleModel(model)}
                            />
                          );
                        }}
                      />
                      <Bar
                        dataKey="Instalados"
                        fill={COLORS.claimed}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={28}
                        shape={(props: any) => {
                          const { x, y, width, height, payload } = props;
                          const model = String(payload?.model || '').toUpperCase();
                          const dimmed = selectedModel && selectedModel !== model;
                          return (
                            <rect
                              x={x}
                              y={y}
                              width={width}
                              height={height}
                              rx={4}
                              ry={4}
                              fill={COLORS.claimed}
                              opacity={dimmed ? 0.25 : 1}
                              style={{ cursor: 'pointer' }}
                              onClick={() => toggleModel(model)}
                            />
                          );
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </ChartCard>

            <ChartCard
              className="lg:col-span-2"
              title="Mix de modelos"
              subtitle="Clique numa fatia para filtrar clientes"
            >
              <div className="h-[240px] sm:h-[280px] w-full">
                {mixData.length === 0 ? (
                  <p className="h-full flex items-center justify-center text-xs text-slate-500">Sem instalacoes para mix.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={mixData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="46%"
                        innerRadius="52%"
                        outerRadius="78%"
                        paddingAngle={2}
                        stroke="#fff"
                        strokeWidth={2}
                        style={{ cursor: 'pointer' }}
                        onClick={(_: unknown, index: number) => {
                          const name = mixData[index]?.name;
                          if (name) toggleModel(String(name));
                        }}
                      >
                        {mixData.map((entry, i) => {
                          const isSelected = selectedModel === (entry.name || '').toUpperCase();
                          return (
                            <Cell
                              key={entry.name}
                              fill={COLORS.mix[i % COLORS.mix.length]}
                              opacity={!selectedModel || isSelected ? 1 : 0.35}
                              stroke={isSelected ? '#0f172a' : '#fff'}
                              strokeWidth={isSelected ? 3 : 2}
                            />
                          );
                        })}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                      <Legend
                        verticalAlign="bottom"
                        height={48}
                        wrapperStyle={{ fontSize: 10, cursor: 'pointer' }}
                        onClick={(e: any) => {
                          if (e?.value) toggleModel(String(e.value));
                        }}
                        formatter={(value) => <span className="text-slate-600">{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </ChartCard>
          </div>

          <ChartCard
            title="Instalacoes ao longo do tempo"
            subtitle={
              selectedModel
                ? `Claimed por semana · filtro ${selectedModel}`
                : 'Aparelhos claimed por semana · ultimas 12 semanas'
            }
          >
            <div className="h-[220px] sm:h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyInstalls} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="installFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2687e9" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#00aff0" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="Instalacoes"
                    name="Instalações"
                    stroke="#205ed7"
                    strokeWidth={2.5}
                    fill="url(#installFill)"
                    dot={{ r: 3, fill: '#205ed7', strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            <ChartCard
              title="Estoque disponivel"
              subtitle={selectedModel ? `Disponiveis · ${selectedModel}` : 'Aparelhos prontos para vinculo por modelo'}
            >
              <div className="h-[220px] sm:h-[240px] w-full">
                {stockBars.length === 0 ? (
                  <p className="h-full flex items-center justify-center text-xs text-slate-500">Nenhum aparelho disponivel.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={stockBars}
                      margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
                      onClick={(state: any) => {
                        const model = state?.activeLabel || state?.activePayload?.[0]?.payload?.model;
                        if (model) toggleModel(String(model));
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="model"
                        width={72}
                        tick={{ fontSize: 10, fill: '#475569' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(245,158,11,0.08)' }} />
                      <Bar dataKey="Disponíveis" fill={COLORS.available} radius={[0, 6, 6, 0]} maxBarSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </ChartCard>

            <div className="bg-white border border-slate-300 rounded-2xl shadow-sm p-4 sm:p-5 flex flex-col min-w-0">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Top contas</h3>
                  <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5">
                    {selectedModel ? `Equipamentos · ${selectedModel}` : 'Equipamentos ativos por cliente'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onOpenUsers}
                  className="text-[10px] font-bold text-blue-700 hover:underline shrink-0"
                >
                  Ver usuarios
                </button>
              </div>
              <div className="flex-1 divide-y divide-slate-100">
                {topAccounts.length === 0 && (
                  <p className="py-8 text-center text-xs text-slate-500">Nenhuma conta com equipamento.</p>
                )}
                {topAccounts.map((row, idx) => {
                  const max = topAccounts[0]?.count || 1;
                  const pct = Math.max(8, Math.round((row.count / max) * 100));
                  return (
                    <div key={row.email} className="py-2.5 first:pt-0">
                      <div className="flex items-center justify-between gap-2 text-xs mb-1.5">
                        <span className="font-semibold text-slate-800 truncate min-w-0">
                          <span className="text-slate-400 font-bold mr-1.5 tabular-nums">{idx + 1}.</span>
                          {row.email}
                        </span>
                        <span className="tabular-nums font-extrabold text-slate-900 shrink-0">{row.count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${pct}%`,
                            background: 'linear-gradient(90deg,#205ed7,#00aff0)',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-300 rounded-2xl shadow-sm p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Ultimas ativacoes</h3>
              <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5">
                {selectedModel ? `Claimed · ${selectedModel}` : 'Aparelhos claimed recentemente'}
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenProduction}
              className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 hover:underline"
            >
              Producao <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {recentClaims.map((row) => (
              <div key={row.serial} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <p className="font-mono font-bold text-slate-900 truncate">{row.serial}</p>
                  <p className="text-[10px] text-slate-500 truncate mt-0.5">
                    {row.model}
                    {row.owner_email ? ` · ${row.owner_email}` : ''}
                  </p>
                </div>
                <span className="text-[10px] text-slate-500 font-mono whitespace-nowrap shrink-0">
                  {row.claimed_at || row.created_at
                    ? new Date(row.claimed_at || row.created_at || '').toLocaleDateString('pt-BR')
                    : '—'}
                </span>
              </div>
            ))}
            {recentClaims.length === 0 && (
              <p className="py-6 text-center text-xs text-slate-500">
                {productionLoading ? 'Carregando...' : 'Nenhuma ativacao recente.'}
              </p>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-300 rounded-2xl shadow-sm p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-blue-600" />
                Atividade recente
              </h3>
              <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5">Ultimos eventos de auditoria</p>
            </div>
            <button
              type="button"
              onClick={onOpenAudit}
              className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 hover:underline"
            >
              Ver todos <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {auditEvents.slice(0, 5).map((event) => (
              <div key={event.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-3 text-xs">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{formatAuditEventType(event.event_type)}</p>
                  <p className="text-[10px] text-slate-500 truncate">{event.actor_email || '—'}</p>
                </div>
                <span className="text-[10px] text-slate-500 font-mono whitespace-nowrap shrink-0">
                  {new Date(event.created_at).toLocaleString('pt-BR')}
                </span>
              </div>
            ))}
            {auditEvents.length === 0 && (
              <p className="py-6 text-center text-xs text-slate-500">
                {auditLoading ? 'Carregando eventos...' : 'Nenhum evento ainda.'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
