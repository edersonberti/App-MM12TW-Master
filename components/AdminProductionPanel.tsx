'use client';

import React, { useMemo, useState } from 'react';
import {
  Factory,
  QrCode,
  Camera,
  RefreshCw,
  Search,
  Package,
  PackageCheck,
  PackageX,
  Users,
  Cpu,
  Filter,
} from 'lucide-react';
import type { ProductionDevice, ProductionDeviceStatus, ProductionModelStats } from '../services/productionDeviceService';

type StatusFilter = 'all' | ProductionDeviceStatus;

type Props = {
  productionStats: ProductionModelStats[];
  productionDevices: ProductionDevice[];
  productionLoading?: boolean;
  productionSearch: string;
  onProductionSearchChange: (value: string) => void;
  isScanningProductionQr: boolean;
  productionQrError: string | null;
  onRefresh: () => void;
  onStartScan: () => void;
  onStopScan: () => void;
  onDisable: (serial: string) => Promise<void> | void;
  onReactivate: (serial: string) => Promise<void> | void;
};

const STATUS_LABEL: Record<ProductionDeviceStatus, string> = {
  claimed: 'Instalado',
  available: 'Disponível',
  disabled: 'Desativado',
};

function statusBadgeClass(status: ProductionDeviceStatus): string {
  if (status === 'claimed') {
    return 'bg-emerald-100 text-emerald-800 border-emerald-300';
  }
  if (status === 'available') {
    return 'bg-amber-100 text-amber-800 border-amber-300';
  }
  return 'bg-slate-200 text-slate-700 border-slate-300';
}

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <div className="bg-white border border-slate-300 rounded-2xl p-4 shadow-sm min-w-0">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">{label}</span>
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${accent}18`, color: accent }}
        >
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-extrabold text-slate-900 tabular-nums mt-2">{value}</p>
      <p className="text-[10px] text-slate-500 mt-1 font-medium">{hint}</p>
    </div>
  );
}

export default function AdminProductionPanel({
  productionStats,
  productionDevices,
  productionLoading,
  productionSearch,
  onProductionSearchChange,
  isScanningProductionQr,
  productionQrError,
  onRefresh,
  onStartScan,
  onStopScan,
  onDisable,
  onReactivate,
}: Props) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [busySerial, setBusySerial] = useState<string | null>(null);

  const totals = useMemo(() => {
    const produced = productionStats.reduce((s, r) => s + (r.produced || 0), 0);
    const available = productionStats.reduce((s, r) => s + (r.available || 0), 0);
    const claimed = productionStats.reduce((s, r) => s + (r.claimed || 0), 0);
    const disabled = productionStats.reduce((s, r) => s + (r.disabled || 0), 0);
    const uniqueUsers = productionStats.reduce((s, r) => s + (r.unique_users || 0), 0);
    const rate = produced > 0 ? (claimed / produced) * 100 : 0;
    return { produced, available, claimed, disabled, uniqueUsers, rate };
  }, [productionStats]);

  const filteredDevices = useMemo(() => {
    const q = productionSearch.trim().toLowerCase();
    return productionDevices.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (!q) return true;
      return (
        row.serial.toLowerCase().includes(q) ||
        row.model.toLowerCase().includes(q) ||
        (row.owner_email || '').toLowerCase().includes(q)
      );
    });
  }, [productionDevices, productionSearch, statusFilter]);

  const filterCounts = useMemo(() => {
    const counts = { all: productionDevices.length, available: 0, claimed: 0, disabled: 0 };
    productionDevices.forEach((d) => {
      counts[d.status] = (counts[d.status] || 0) + 1;
    });
    return counts;
  }, [productionDevices]);

  const handleDisable = async (serial: string) => {
    setBusySerial(serial);
    try {
      await onDisable(serial);
    } finally {
      setBusySerial(null);
    }
  };

  const handleReactivate = async (serial: string) => {
    setBusySerial(serial);
    try {
      await onReactivate(serial);
    } finally {
      setBusySerial(null);
    }
  };

  const filterTabs: { id: StatusFilter; label: string }[] = [
    { id: 'all', label: 'Todos' },
    { id: 'available', label: 'Disponíveis' },
    { id: 'claimed', label: 'Instalados' },
    { id: 'disabled', label: 'Desativados' },
  ];

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <Kpi
          label="Whitelist total"
          value={totals.produced || productionDevices.length}
          hint="Aparelhos cadastrados na fábrica"
          icon={Factory}
          accent="#205ed7"
        />
        <Kpi
          label="Disponíveis"
          value={totals.available}
          hint="Prontos para vínculo"
          icon={Package}
          accent="#d97706"
        />
        <Kpi
          label="Instalados"
          value={totals.claimed}
          hint={`${totals.rate.toFixed(1)}% de conversão`}
          icon={PackageCheck}
          accent="#059669"
        />
        <Kpi
          label="Clientes únicos"
          value={totals.uniqueUsers}
          hint={`${totals.disabled} desativados`}
          icon={Users}
          accent="#00aff0"
        />
      </div>

      {/* QR scan + actions */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="lg:col-span-3 bg-white border border-slate-300 rounded-2xl shadow-sm p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0"
                  style={{ background: 'linear-gradient(234deg,#205ed7,#2687e9 39%,#00aff0)' }}
                >
                  <QrCode className="w-4 h-4" />
                </span>
                Cadastro via QR de fábrica
              </h3>
              <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed max-w-xl">
                Escaneie o QR (serial, provision, model, hw, fw, date). O aparelho só pode ser vinculado depois de entrar na whitelist.
              </p>
            </div>
            <button
              type="button"
              onClick={onRefresh}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-xl text-[11px] font-bold flex items-center gap-1.5 shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${productionLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>

          {!isScanningProductionQr ? (
            <button
              type="button"
              onClick={onStartScan}
              className="w-full sm:w-auto px-5 py-3 text-white text-xs font-extrabold rounded-xl flex items-center justify-center gap-2 active:scale-[0.99] shadow-md shadow-blue-600/20"
              style={{ background: 'linear-gradient(234deg,#205ed7,#2687e9 39%,#00aff0)' }}
            >
              <QrCode className="w-4 h-4" />
              Escanear QR de Produção
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 animate-pulse" />
                  Aponte para o QR de fábrica
                </span>
                <button
                  type="button"
                  onClick={onStopScan}
                  className="px-3 py-1.5 bg-rose-50 border border-rose-300 text-rose-700 text-[11px] font-bold rounded-lg hover:bg-rose-100"
                >
                  Parar
                </button>
              </div>
              <div className="rounded-2xl overflow-hidden border border-slate-300 bg-slate-950 aspect-square max-w-sm mx-auto shadow-inner">
                <div id="qr-reader-production" className="w-full h-full overflow-hidden [&_video]:object-cover" />
              </div>
            </div>
          )}

          {productionQrError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-[11px] text-rose-800 font-medium">
              {productionQrError}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 bg-white border border-slate-300 rounded-2xl shadow-sm p-4 sm:p-5 space-y-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Resumo operacional</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Conversão da whitelist</p>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Instalados', value: totals.claimed, color: '#059669', total: totals.produced || 1 },
              { label: 'Disponíveis', value: totals.available, color: '#d97706', total: totals.produced || 1 },
              { label: 'Desativados', value: totals.disabled, color: '#64748b', total: totals.produced || 1 },
            ].map((row) => {
              const pct = Math.min(100, Math.round((row.value / row.total) * 100));
              return (
                <div key={row.label}>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-semibold text-slate-700">{row.label}</span>
                    <span className="tabular-nums font-bold text-slate-900">
                      {row.value} · {pct}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: row.color }} />
                  </div>
                </div>
              );
            })}
          </div>
          {productionStats.length === 0 && !productionLoading && (
            <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-100">
              Escaneie o primeiro QR para iniciar a whitelist.
            </p>
          )}
        </div>
      </div>

      {/* Model cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-600">Por modelo</h3>
          <span className="text-[10px] font-semibold text-slate-500">{productionStats.length} modelo(s)</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {productionStats.map((stat) => {
            const rate = stat.produced > 0 ? Math.round((stat.claimed / stat.produced) * 100) : 0;
            return (
              <div key={stat.model} className="bg-white border border-slate-300 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-sm font-extrabold text-slate-900 font-mono">{stat.model}</span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-lg">
                    <Cpu className="w-3 h-3" />
                    {rate}% instalado
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2.5 text-[11px]">
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5">
                    <span className="text-slate-500 block text-[10px] font-semibold">Produzidos</span>
                    <span className="text-slate-900 font-extrabold text-lg tabular-nums">{stat.produced}</span>
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5">
                    <span className="text-slate-500 block text-[10px] font-semibold">Clientes</span>
                    <span className="text-blue-700 font-extrabold text-lg tabular-nums">{stat.unique_users}</span>
                  </div>
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-2.5">
                    <span className="text-emerald-700 block text-[10px] font-semibold">Instalados</span>
                    <span className="text-emerald-800 font-extrabold tabular-nums">{stat.claimed}</span>
                  </div>
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-2.5">
                    <span className="text-amber-700 block text-[10px] font-semibold">Disponíveis</span>
                    <span className="text-amber-800 font-extrabold tabular-nums">{stat.available}</span>
                  </div>
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${rate}%`,
                      background: 'linear-gradient(90deg,#205ed7,#00aff0)',
                    }}
                  />
                </div>
              </div>
            );
          })}
          {productionStats.length === 0 && !productionLoading && (
            <div className="sm:col-span-2 xl:col-span-3 p-8 text-center border border-dashed border-slate-300 rounded-2xl bg-white">
              <PackageX className="w-7 h-7 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-800">Nenhum modelo na whitelist</p>
              <p className="text-xs text-slate-500 mt-1">Escaneie o primeiro QR de produção para começar.</p>
            </div>
          )}
        </div>
      </div>

      {/* Device list */}
      <div className="bg-white border border-slate-300 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b border-slate-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Aparelhos na whitelist</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {filteredDevices.length} de {productionDevices.length} exibidos
              </p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={productionSearch}
                onChange={(e) => onProductionSearchChange(e.target.value)}
                placeholder="Buscar serial, modelo ou e-mail..."
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-[12px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            {filterTabs.map((tab) => {
              const active = statusFilter === tab.id;
              const count = filterCounts[tab.id] ?? 0;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap border transition-colors ${
                    active
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                  <span className={`ml-1.5 tabular-nums ${active ? 'text-white/80' : 'text-slate-400'}`}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-600">
                <th className="px-5 py-3 font-bold">Serial</th>
                <th className="px-5 py-3 font-bold">Modelo</th>
                <th className="px-5 py-3 font-bold">Cliente</th>
                <th className="px-5 py-3 font-bold">HW / FW</th>
                <th className="px-5 py-3 font-bold">Status</th>
                <th className="px-5 py-3 font-bold text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredDevices.map((row) => (
                <tr key={row.serial} className="border-b border-slate-100 hover:bg-slate-50/80">
                  <td className="px-5 py-3 font-mono font-bold text-slate-900">{row.serial}</td>
                  <td className="px-5 py-3 font-semibold text-slate-700">{row.model}</td>
                  <td className="px-5 py-3 text-slate-600 truncate max-w-[180px]">{row.owner_email || '—'}</td>
                  <td className="px-5 py-3 text-slate-500 font-mono text-[10px]">
                    {row.hw || '—'} / {row.fw || '—'}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider border ${statusBadgeClass(row.status)}`}>
                      {STATUS_LABEL[row.status]}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {row.status !== 'disabled' ? (
                      <button
                        type="button"
                        disabled={busySerial === row.serial}
                        onClick={() => handleDisable(row.serial)}
                        className="px-2.5 py-1.5 text-[10px] font-bold text-rose-700 border border-rose-300 rounded-lg hover:bg-rose-50 disabled:opacity-50"
                      >
                        Desativar
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busySerial === row.serial}
                        onClick={() => handleReactivate(row.serial)}
                        className="px-2.5 py-1.5 text-[10px] font-bold text-emerald-700 border border-emerald-300 rounded-lg hover:bg-emerald-50 disabled:opacity-50"
                      >
                        Reativar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredDevices.map((row) => (
            <div key={row.serial} className="px-4 py-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono text-xs font-bold text-slate-900 truncate">{row.serial}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {row.model}
                    {row.hw ? ` · hw ${row.hw}` : ''}
                    {row.fw ? ` · fw ${row.fw}` : ''}
                  </p>
                  {row.owner_email && (
                    <p className="text-[10px] text-slate-600 truncate mt-0.5">{row.owner_email}</p>
                  )}
                </div>
                <span className={`shrink-0 px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider border ${statusBadgeClass(row.status)}`}>
                  {STATUS_LABEL[row.status]}
                </span>
              </div>
              <div className="flex justify-end">
                {row.status !== 'disabled' ? (
                  <button
                    type="button"
                    disabled={busySerial === row.serial}
                    onClick={() => handleDisable(row.serial)}
                    className="px-2.5 py-1.5 text-[10px] font-bold text-rose-700 border border-rose-300 rounded-lg hover:bg-rose-50 disabled:opacity-50"
                  >
                    Desativar
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busySerial === row.serial}
                    onClick={() => handleReactivate(row.serial)}
                    className="px-2.5 py-1.5 text-[10px] font-bold text-emerald-700 border border-emerald-300 rounded-lg hover:bg-emerald-50 disabled:opacity-50"
                  >
                    Reativar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {productionLoading && (
          <p className="py-10 text-center text-xs text-slate-500">Carregando produção...</p>
        )}
        {!productionLoading && filteredDevices.length === 0 && (
          <p className="py-10 text-center text-xs text-slate-500">
            {productionDevices.length === 0 ? 'Lista vazia.' : 'Nenhum aparelho corresponde aos filtros.'}
          </p>
        )}
      </div>
    </div>
  );
}
