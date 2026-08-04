'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Script from 'next/script';
import { motion, AnimatePresence } from 'motion/react';
import {
  Power,
  Settings,
  Tv,
  Droplet,
  Flame,
  Clock,
  LogOut,
  Sliders,
  Home,
  Check,
  AlertTriangle,
  AlertCircle,
  Wifi,
  WifiOff,
  User,
  Lock,
  ChevronRight,
  Info,
  SlidersHorizontal,
  FolderSync,
  Send,
  Terminal,
  Save,
  Edit2,
  QrCode,
  Camera,
  X,
  Users,
  Database,
  Activity,
  Shield,
  Plus,
  Minus,
  Trash2,
  Search,
  Menu,
  CheckCircle2,
  PowerOff,
  Cpu,
  Sun,
  Moon,
  Palette,
  Thermometer,
  Zap,
  Upload,
  RefreshCw,
  Share2,
  Copy,
  UserMinus,
  ChevronLeft,
  Download,
  Filter,
  ChevronDown,
  ChevronUp,
  Headset,
  ImagePlus,
  MessageCircle,
  Factory
} from 'lucide-react';

import { isSupabaseConfigured, supabase, configureSupabase, getSupabaseConfigError, saveLocalConfig, clearLocalConfig } from '../lib/supabase';
import { signInWithPassword, signUp, signOut, getSession, onAuthStateChange } from '../services/authService';
import { fetchProfile, updateProfile, fetchAllProfiles, updateProfileRole, deleteProfile, updateProfileTheme, type AppTheme } from '../services/profileService';
import { fetchUserDevices, fetchAllActiveDevices, registerDevice, deleteDevice, updateDeviceOwner } from '../services/deviceService';
import {
  fetchProductionDevices,
  fetchProductionStatsByModel,
  getUnrecognizedDeviceMessage,
  parseProductionQrPayload,
  registerProductionDeviceFromQr,
  setProductionDeviceStatus,
  type ProductionDevice,
  type ProductionModelStats,
} from '../services/productionDeviceService';
import { fetchAuditEvents, deriveAuditFilterOptions, auditEventMatchesSerial, resolveDeviceSerialAliases, type AuditEvent } from '../services/auditService';
import { ensureDeviceSettings, fetchDeviceSettings, saveDeviceSettings } from '../services/settingsService';
import {
  acceptDeviceInvite,
  buildInviteUrl,
  buildWhatsAppShareUrl,
  createDeviceInvite,
  INVITE_STORAGE_KEY,
  leaveSharedDevice,
  listDeviceMembers,
  peekDeviceInvite,
  revokeDeviceMember,
  type CreatedInvite,
  type DeviceInvitePreview,
  type DeviceMember,
  type SharePermission,
} from '../services/shareService';
import {
  createDeviceCatalogItem,
  updateDeviceCatalogItem,
  deleteDeviceCatalogItem,
  fetchDeviceCatalog,
  type DeviceCatalogItem,
} from '../services/deviceCatalogService';
import {
  createOtaUpdateUrl,
  fetchActiveFirmware,
  fetchAllFirmware,
  uploadFirmware,
  updateFirmware,
  type FirmwareItem,
} from '../services/firmwareService';

const DEFAULT_PRESET_MODELS: Record<string, { motor_count: number; has_filter_timer: boolean; has_led_timer: boolean; has_hidro_timer: boolean; has_solar_heating: boolean }> = {
  'MM12TW': { motor_count: 2, has_filter_timer: true, has_led_timer: true, has_hidro_timer: true, has_solar_heating: true },
  'MM08TW': { motor_count: 1, has_filter_timer: true, has_led_timer: true, has_hidro_timer: false, has_solar_heating: false },
  'MM14TW': { motor_count: 4, has_filter_timer: true, has_led_timer: true, has_hidro_timer: true, has_solar_heating: true },
};

const AUDIT_EVENT_LABELS: Record<string, string> = {
  account_created: 'Conta criada',
  device_registered: 'Equip. cadastrado',
  device_filter_timer_updated: 'Timer filtração',
  device_led_timer_updated: 'Timer LED',
  device_hidro_timer_updated: 'Timer hidro',
  device_motor_names_updated: 'Nomes dos motores',
  device_soft_deleted: 'Equip. desativado',
  device_hard_deleted: 'Equip. excluído',
  device_reactivated: 'Equip. reativado',
  operator_soft_deleted: 'Operador desativado',
  operator_hard_deleted: 'Operador excluído',
  account_deletion_requested: 'Pedido exclusão conta',
};

function formatAuditEventType(eventType: string): string {
  return AUDIT_EVENT_LABELS[eventType] || eventType;
}

// Renders a compact, human-readable summary of an audit event's metadata JSON for the logs table.
function formatAuditMetadata(
  metadata: Record<string, unknown> | null | undefined,
  eventType?: string
): string {
  if (!metadata || typeof metadata !== 'object') return '—';
  const m = metadata;

  if (eventType === 'device_filter_timer_updated') {
    const t1 = m.filter_init1 === 'D' || !m.filter_init1
      ? 'T1 off'
      : `T1 ${m.filter_init1}h(${m.filter_hours1 ?? '?'}h)`;
    const t2 = m.filter_init2 === 'D' || !m.filter_init2
      ? 'T2 off'
      : `T2 ${m.filter_init2}h(${m.filter_hours2 ?? '?'}h)`;
    const days = Array.isArray(m.filter_days)
      ? (m.filter_days as boolean[]).filter(Boolean).length
      : null;
    return days != null ? `${t1} · ${t2} · ${days} dia(s)` : `${t1} · ${t2}`;
  }

  if (eventType === 'device_led_timer_updated') {
    const start = `${String(m.led_start_hour ?? '??').padStart(2, '0')}:${String(m.led_start_minute ?? '00').padStart(2, '0')}`;
    return `Início ${start} · ${m.led_duration ?? '?'}h · Prog ${m.led_program ?? '0'}`;
  }

  if (eventType === 'device_hidro_timer_updated') {
    const enabled = m.hidro_timer_enabled === true;
    return enabled ? `Ativo (${m.hidro_timer_hours ?? '?'}h)` : 'Desligado';
  }

  if (eventType === 'device_motor_names_updated') {
    const names = [m.motor1_name, m.motor2_name, m.motor3_name, m.motor4_name]
      .filter((n) => typeof n === 'string' && n.trim())
      .slice(0, 3);
    return names.length ? names.join(', ') : '—';
  }

  if (eventType === 'account_created') {
    const email = typeof m.email === 'string' ? m.email : '—';
    const role = m.role ? ` · ${String(m.role)}` : '';
    return `${email}${role}`;
  }

  if (eventType === 'device_registered') {
    const model = m.model ? String(m.model) : '—';
    const serialPart = m.serial ? ` · ${String(m.serial)}` : '';
    const owner = m.owner_email ? ` · ${String(m.owner_email)}` : '';
    return `${model}${serialPart}${owner}`;
  }

  if (eventType === 'operator_soft_deleted' || eventType === 'account_deletion_requested') {
    const email = typeof m.email === 'string' ? m.email : '—';
    const when = m.deleted_at ? ` · ${new Date(String(m.deleted_at)).toLocaleString('pt-BR')}` : '';
    const devices =
      typeof m.devices_soft_deleted === 'number' ? ` · ${m.devices_soft_deleted} equip.` : '';
    return `${email}${when}${devices}`;
  }

  if (eventType === 'device_soft_deleted') {
    const serial = m.serial ? String(m.serial) : '—';
    const reason = m.reason ? ` · ${String(m.reason)}` : '';
    return `${serial}${reason}`;
  }

  const entries = Object.entries(metadata);
  if (entries.length === 0) return '—';
  return entries
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`)
    .join(' · ');
}

function auditEventBadgeClass(eventType: string): string {
  const t = (eventType || '').toLowerCase();
  if (t.includes('delete') || t.includes('revok') || t.includes('hard')) {
    return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
  }
  if (t.includes('create') || t.includes('insert') || t.includes('accept') || t.includes('register') || t.includes('account_created')) {
    return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  }
  if (t.includes('timer') || t.includes('motor_names')) {
    return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
  }
  if (t.includes('update') || t.includes('soft') || t.includes('change')) {
    return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  }
  return 'bg-[#4398fa]/15 text-[#4398fa] border-[#4398fa]/30';
}

function exportAuditEventsCsv(events: AuditEvent[]) {
  const headers = ['created_at', 'actor_email', 'entity_type', 'entity_id', 'event_type', 'metadata'];
  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [
    headers.join(','),
    ...events.map((e) =>
      [
        e.created_at,
        e.actor_email,
        e.entity_type,
        e.entity_id,
        e.event_type,
        JSON.stringify(e.metadata || {}),
      ]
        .map(escape)
        .join(',')
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit_events_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// TypeScript declarations for browser-loaded scripts
declare global {
  interface Window {
    Paho: any;
    iro: any;
    firebase: any;
  }
}

// Initial state and localStorage helpers
const DEFAULT_MQTT_BROKER = 'test.mosquitto.org';
const DEFAULT_MQTT_PORT = '8081'; // 8081 is secure WebSockets over SSL (wss://) matching test.mosquitto.org port 1883
const DEFAULT_DEVICE_ID = 'MLZ-MM12TW-EEA39F-000003'; // Matches new dynamic hardware architecture prefix
type MotorNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

const FALLBACK_BROKERS = [
  { broker: 'test.mosquitto.org', port: '8081' },
  { broker: 'broker.emqx.io', port: '8084' },
  { broker: 'broker.hivemq.com', port: '8884' }
];

// Strips off MLZ-, MASTERLAZER-, and any hex/efuse MAC suffix if present (e.g., "MLZ-MM12TW-EEA39F-000003-7c9ebd1a" -> "MM12TW-EEA39F-000003")
function cleanDeviceId(id: string): string {
  if (!id) return '';
  let trimmed = id.trim();

  // Strip MLZ/ or MLZ- prefix
  if (trimmed.toLowerCase().startsWith('mlz/')) {
    trimmed = trimmed.substring(4);
  } else if (trimmed.toLowerCase().startsWith('mlz-')) {
    trimmed = trimmed.substring(4);
  } else if (trimmed.toLowerCase().startsWith('masterlazer/')) {
    trimmed = trimmed.substring(12);
  } else if (trimmed.toLowerCase().startsWith('masterlazer-')) {
    trimmed = trimmed.substring(12);
  }

  const parts = trimmed.split('-');
  // Standard format (e.g., MM12TW-EEA39F-000003) has 3 parts.
  // If it has 4 parts or more (e.g., with MAC suffix), strip the last part
  if (parts.length >= 4) {
    return parts.slice(0, 3).join('-');
  }
  return trimmed;
}

function areDeviceIdsMatching(id1: string, id2: string): boolean {
  if (!id1 || !id2) return false;
  const raw1 = id1.trim().toLowerCase();
  const raw2 = id2.trim().toLowerCase();
  if (raw1 === raw2) return true;

  const clean1 = cleanDeviceId(id1).toLowerCase();
  const clean2 = cleanDeviceId(id2).toLowerCase();
  if (clean1 && clean2 && clean1 === clean2) return true;

  const noMlz1 = raw1.startsWith('mlz-') ? raw1.substring(4) : raw1;
  const noMlz2 = raw2.startsWith('mlz-') ? raw2.substring(4) : raw2;
  if (noMlz1 === noMlz2) return true;

  const cleanNoMlz1 = cleanDeviceId(noMlz1).toLowerCase();
  const cleanNoMlz2 = cleanDeviceId(noMlz2).toLowerCase();
  if (cleanNoMlz1 && cleanNoMlz2 && cleanNoMlz1 === cleanNoMlz2) return true;

  return false;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const APP_LOGO_PATH = '/logo-512.png';
const APP_LOGO_LIGHT_PATH = '/logoazul.jpg';

// Official Master Lazer logo — light theme uses blue mark for contrast on light shell.
// Plain <img> (not next/image) so the PWA service worker can serve the static file reliably.
const MasterLazerLogo = ({
  className = 'w-[192px] h-[192px]',
  theme = 'dark',
}: {
  className?: string;
  theme?: AppTheme;
}) => (
  <div className={className}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img
      src={theme === 'light' ? APP_LOGO_LIGHT_PATH : APP_LOGO_PATH}
      alt="Master Lazer Logo"
      width={192}
      height={192}
      decoding="async"
      className="h-full w-full object-contain rounded-full"
    />
  </div>
);

export default function PoolControllerPage() {
  // Navigation / Auth State
  const [activeScreen, setActiveScreen] = useState<'login' | 'register' | 'home' | 'aux' | 'led' | 'timers' | 'solar' | 'setup' | 'share' | 'invite' | 'admin' | 'support' | 'theme'>('login');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authErrorMessage, setAuthErrorMessage] = useState<string>('');
  const [appTheme, setAppTheme] = useState<AppTheme>('dark');
  const [themeSaving, setThemeSaving] = useState(false);

  // Manual API Configuration states
  const [showManualConfig, setShowManualConfig] = useState(false);
  const [showNavMenu, setShowNavMenu] = useState(false);
  const [supportSubject, setSupportSubject] = useState('');
  const [supportDescription, setSupportDescription] = useState('');
  const [supportScreenshot, setSupportScreenshot] = useState<File | null>(null);
  const [supportScreenshotPreview, setSupportScreenshotPreview] = useState<string | null>(null);
  const [supportSending, setSupportSending] = useState(false);
  const [manualUrl, setManualUrl] = useState('');
  const [manualKey, setManualKey] = useState('');
  const [manualSuccessMsg, setManualSuccessMsg] = useState('');

  const SUPPORT_WHATSAPP_NUMBER = '5548996089187';

  // Admin & Owner Dashboard states
  const [adminTab, setAdminTab] = useState<'home' | 'aba1' | 'aba3' | 'aba4' | 'aba5' | 'firmware' | 'production' | 'brand'>('home');
  const [selectedUserForEquip, setSelectedUserForEquip] = useState<string | null>(null);
  const [productionDevices, setProductionDevices] = useState<ProductionDevice[]>([]);
  const [productionStats, setProductionStats] = useState<ProductionModelStats[]>([]);
  const [productionLoading, setProductionLoading] = useState(false);
  const [isScanningProductionQr, setIsScanningProductionQr] = useState(false);
  const [productionQrError, setProductionQrError] = useState<string | null>(null);
  const [productionSearch, setProductionSearch] = useState('');
  const productionQrScannerRef = useRef<any>(null);
  // All devices registered system-wide (owner/admin visibility), with owner email attached
  const [adminAllDevices, setAdminAllDevices] = useState<{
    id: string;
    model: string;
    serial?: string;
    user_id: string | null;
    userEmail: string | null;
  }[]>([]);
  // Audit trail events sourced from Supabase `audit_events`
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFilterSearch, setAuditFilterSearch] = useState('');
  const [auditFilterActor, setAuditFilterActor] = useState('');
  const [auditFilterEntityType, setAuditFilterEntityType] = useState('');
  const [auditFilterEventType, setAuditFilterEventType] = useState('');
  const [auditFilterEntityId, setAuditFilterEntityId] = useState('');
  const [auditFilterSerial, setAuditFilterSerial] = useState('');
  const [auditFilterDateFrom, setAuditFilterDateFrom] = useState('');
  const [auditFilterDateTo, setAuditFilterDateTo] = useState('');
  const [auditFilterSort, setAuditFilterSort] = useState<'desc' | 'asc'>('desc');
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(25);
  const [auditExpandedId, setAuditExpandedId] = useState<string | null>(null);
  const [auditFiltersOpen, setAuditFiltersOpen] = useState(true);
  const [deviceCatalog, setDeviceCatalog] = useState<DeviceCatalogItem[]>([]);
  const [catalogModel, setCatalogModel] = useState('');
  const [catalogMotorCount, setCatalogMotorCount] = useState('2');
  const [catalogHasFilterTimer, setCatalogHasFilterTimer] = useState(true);
  const [catalogHasLedTimer, setCatalogHasLedTimer] = useState(true);
  const [catalogHasHidroTimer, setCatalogHasHidroTimer] = useState(true);
  const [catalogHasSolarHeating, setCatalogHasSolarHeating] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogSaving, setCatalogSaving] = useState(false);

  // Edit state for catalog item
  const [editingCatalogItem, setEditingCatalogItem] = useState<DeviceCatalogItem | null>(null);
  const [editModelName, setEditModelName] = useState('');
  const [editMotorCount, setEditMotorCount] = useState('2');
  const [editHasFilterTimer, setEditHasFilterTimer] = useState(true);
  const [editHasLedTimer, setEditHasLedTimer] = useState(true);
  const [editHasHidroTimer, setEditHasHidroTimer] = useState(true);
  const [editHasSolarHeating, setEditHasSolarHeating] = useState(true);

  // Firmware OTA (.bin) — linked to devices_catalog.model
  const [firmwareList, setFirmwareList] = useState<FirmwareItem[]>([]);
  const [firmwareLoading, setFirmwareLoading] = useState(false);
  const [firmwareSaving, setFirmwareSaving] = useState(false);
  const [firmwareModel, setFirmwareModel] = useState('');
  const [firmwareNome, setFirmwareNome] = useState('');
  const [firmwareVersao, setFirmwareVersao] = useState('');
  const [firmwareFile, setFirmwareFile] = useState<File | null>(null);
  const [firmwareEditingId, setFirmwareEditingId] = useState<string | null>(null);
  const [firmwareUpdatingModel, setFirmwareUpdatingModel] = useState<string | null>(null);

  const handleBackToHome = () => {
    setActiveScreen('home');
  };

  const applyAppTheme = useCallback((theme: AppTheme) => {
    const next = theme === 'light' ? 'light' : 'dark';
    setAppTheme(next);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', next);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', next === 'light' ? '#d8d8de' : '#000000');
    }
    try {
      localStorage.setItem('app_theme', next);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('app_theme');
      if (saved === 'light' || saved === 'dark') {
        applyAppTheme(saved);
      }
    } catch {
      /* ignore */
    }
  }, [applyAppTheme]);

  // Painel admin permanece sempre em dark, sem alterar a preferência salva do usuário
  useEffect(() => {
    if (typeof document === 'undefined') return;

    if (activeScreen === 'admin') {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.setAttribute('data-admin-panel', 'true');
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', '#000000');
      return;
    }

    document.documentElement.removeAttribute('data-admin-panel');
    applyAppTheme(appTheme);
  }, [activeScreen, appTheme, applyAppTheme]);

  const [simUsers, setSimUsers] = useState<any[]>([]);
  const [adminSearchUser, setAdminSearchUser] = useState('');
  const [adminSearchEquip, setAdminSearchEquip] = useState('');
  const [userModalOpen, setUserModalOpen] = useState<'add' | 'edit' | null>(null);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<any | null>(null);
  const [userFormEmail, setUserFormEmail] = useState('');
  const [userFormPassword, setUserFormPassword] = useState('');
  const [userFormRole, setUserFormRole] = useState<'owner' | 'operator'>('operator');
  const [userLogs, setUserLogs] = useState<any[]>([]);

  // Solar sensor readings (from device / UI)
  const [sensorCollectorTemp, setSensorCollectorTemp] = useState<number>(45);
  const [sensorPoolTemp, setSensorPoolTemp] = useState<number>(28);
  const [sensorErrorActive, setSensorErrorActive] = useState<boolean>(false);

  // Solar heating controls
  const [solarWorkMode, setSolarWorkMode] = useState<'off' | 'manual' | 'auto'>('auto');
  const [heatingType, setHeatingType] = useState<'solar' | 'eletrico'>('solar');
  const [solarPoolMax, setSolarPoolMax] = useState<number>(34);
  const [solarDif, setSolarDif] = useState<number>(4);
  const [sensorCollectorError, setSensorCollectorError] = useState<boolean>(false);
  const [sensorPoolError, setSensorPoolError] = useState<boolean>(false);

  // Custom Manufacturer Logo State & Handlers
  const [manufacturerLogo, setManufacturerLogo] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLogo = localStorage.getItem('custom_manufacturer_logo');
      if (savedLogo) {
        setManufacturerLogo(savedLogo);
      }
    }
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast('Arquivo Muito Grande', 'O tamanho máximo recomendado para a imagem é de 2 MB.', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setManufacturerLogo(result);
      if (typeof window !== 'undefined') {
        localStorage.setItem('custom_manufacturer_logo', result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResetLogo = () => {
    setManufacturerLogo('');
    if (typeof window !== 'undefined') {
      localStorage.removeItem('custom_manufacturer_logo');
    }
  };

  // Auth inputs
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  const [supabaseStateLoaded, setSupabaseStateLoaded] = useState(false);



  // MQTT Config State
  const [mqttBroker, setMqttBroker] = useState(DEFAULT_MQTT_BROKER);
  const [mqttPort, setMqttPort] = useState(DEFAULT_MQTT_PORT);
  const [deviceId, setDeviceId] = useState(DEFAULT_DEVICE_ID);
  const [deviceIp, setDeviceIp] = useState('---');
  const [deviceMac, setDeviceMac] = useState('---');
  const [deviceModelo, setDeviceModelo] = useState('---');
  const [deviceSerial, setDeviceSerial] = useState('---');
  const [deviceOnline, setDeviceOnline] = useState<boolean | null>(null); // null = unknown, true = online, false = offline
  const [mqttUser, setMqttUser] = useState('');
  const [mqttPassword, setMqttPassword] = useState('');
  const [mqttConnected, setMqttConnected] = useState(false);
  const [mqttStatusMessage, setMqttStatusMessage] = useState('Desconectado');
  const [mqttErrorMsg, setMqttErrorMsg] = useState('');
  
  // BLE & Equipment IDs and Logs
  const [bleDeviceId, setBleDeviceId] = useState('MLZ-MM12TW-EEA39F-000003');
  const [bleLog, setBleLog] = useState<string[]>([]);

  // Registered Equipments (unique ID for each, with choices of MM12TW, MM03TW, MM08TSW or custom from QR)
  const [registeredEquipments, setRegisteredEquipments] = useState<{ 
    id: string; 
    model: string; 
    serial?: string; 
    manufacturer?: string; 
    userEmail?: string; 
    userPassword?: string;
    access?: 'owner' | 'shared';
    permission?: SharePermission | 'owner';
  }[]>([]);
  const [selectedEquipmentModel, setSelectedEquipmentModel] = useState<string>('MM12TW');
  const activeEquipment = registeredEquipments.find(eq => areDeviceIdsMatching(eq.id, deviceId));
  const activeModel = activeEquipment?.model || 'MM12TW';
  // Shared "control" access must NOT edit names/settings — only "configure" (or owner) may.
  const canConfigureActiveDevice = (() => {
    if (!currentUser?.isSupabase) return true;
    if (!activeEquipment) return false;
    if (activeEquipment.access === 'shared') {
      return activeEquipment.permission === 'configure';
    }
    return true;
  })();
  const activeCatalogItem = deviceCatalog.find(
    item => item.model.trim().toUpperCase() === activeModel.trim().toUpperCase()
  );
  const presetSpec = DEFAULT_PRESET_MODELS[activeModel.trim().toUpperCase()];

  const activeMotorCount = activeCatalogItem?.motor_count ?? (presetSpec?.motor_count ?? 2);
  const hasFilterTimer = activeCatalogItem?.has_filter_timer ?? (presetSpec?.has_filter_timer ?? true);
  const hasLedTimer = activeCatalogItem?.has_led_timer ?? (presetSpec?.has_led_timer ?? true);
  const hasHidroTimer = activeCatalogItem?.has_hidro_timer ?? (presetSpec?.has_hidro_timer ?? true);
  const hasSolarHeating = activeCatalogItem
    ? activeCatalogItem.has_solar_heating === true
    : (presetSpec?.has_solar_heating ?? false);
  const [equipmentSerial, setEquipmentSerial] = useState<string>('');
  const [equipmentManufacturer, setEquipmentManufacturer] = useState<string>('MASTERLAZER');

  // Device sharing
  const [shareDeviceId, setShareDeviceId] = useState<string | null>(null);
  const [sharePermission, setSharePermission] = useState<SharePermission>('control');
  const [shareInvite, setShareInvite] = useState<CreatedInvite | null>(null);
  const [shareMembers, setShareMembers] = useState<DeviceMember[]>([]);
  const [shareBusy, setShareBusy] = useState(false);
  const [pendingInviteToken, setPendingInviteToken] = useState<string | null>(null);
  const [invitePreview, setInvitePreview] = useState<DeviceInvitePreview | null>(null);
  const [inviteAcceptBusy, setInviteAcceptBusy] = useState(false);
  
  // QR Code Scanner States
  const [isScanningQr, setIsScanningQr] = useState(false);
  const [qrScannerError, setQrScannerError] = useState<string | null>(null);
  const [scannedData, setScannedData] = useState<any | null>(null);
  const [confirmDeleteDeviceId, setConfirmDeleteDeviceId] = useState<string | null>(null);
  const qrScannerRef = useRef<any>(null);
  
  // Real-time Controls / Statuses
  const [motorHidro, setMotorHidro] = useState(false);
  const [motorFiltro, setMotorFiltro] = useState(false);
  const [motor3, setMotor3] = useState(false);
  const [motor4, setMotor4] = useState(false);
  const [motor5, setMotor5] = useState(false);
  const [motor6, setMotor6] = useState(false);
  const [motor7, setMotor7] = useState(false);
  const [motor8, setMotor8] = useState(false);
  const [motor1Name, setMotor1Name] = useState('Motor 01');
  const [motor2Name, setMotor2Name] = useState('Motor 02');
  const [motor3Name, setMotor3Name] = useState('Motor 03');
  const [motor4Name, setMotor4Name] = useState('Motor 04');
  const [motor5Name, setMotor5Name] = useState('Motor 05');
  const [motor6Name, setMotor6Name] = useState('Motor 06');
  const [motor7Name, setMotor7Name] = useState('Motor 07');
  const [motor8Name, setMotor8Name] = useState('Motor 08');
  const [motorSettingsSaveState, setMotorSettingsSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const motorNameSaveTimersRef = useRef<Partial<Record<MotorNumber, ReturnType<typeof setTimeout>>>>({});
  const [editingMotorNum, setEditingMotorNum] = useState<MotorNumber | null>(null);
  const [solarErrorBanner, setSolarErrorBanner] = useState<string | null>(null);

  // LED States
  const [ledHue, setLedHueState] = useState(0);
  const ledHueRef = useRef(0);
  const setLedHue = (val: number) => {
    ledHueRef.current = val;
    setLedHueState(val);
  };

  const [ledSat, setLedSatState] = useState(100);
  const ledSatRef = useRef(100);
  const setLedSat = (val: number) => {
    ledSatRef.current = val;
    setLedSatState(val);
  };

  const [ledVal, setLedValState] = useState(100);
  const ledValRef = useRef(100);
  const setLedVal = (val: number) => {
    ledValRef.current = val;
    setLedValState(val);
  };

  const [satMultiplier, setSatMultiplierState] = useState(100);
  const satMultiplierRef = useRef(100);
  const setSatMultiplier = (val: number) => {
    satMultiplierRef.current = val;
    setSatMultiplierState(val);
  };

  const [brightMultiplier, setBrightMultiplierState] = useState(100);
  const brightMultiplierRef = useRef(100);
  const setBrightMultiplier = (val: number) => {
    brightMultiplierRef.current = val;
    setBrightMultiplierState(val);
  };

  const [currentProgram, setCurrentProgramState] = useState<number | '---'>('---');
  const currentProgramRef = useRef<number | '---'>('---');
  const setCurrentProgram = (val: number | '---') => {
    currentProgramRef.current = val;
    setCurrentProgramState(val);
  };

  const currentRgbRef = useRef({ r: 0, g: 0, b: 0 });
  const lastUserColorInteractionRef = useRef<number>(0);
  const lastPublishTimeRef = useRef<number>(0);
  const publishThrottleTimeoutRef = useRef<any>(null);
  const pendingPublishRef = useRef<{ h: number; s: number; v: number; satMult: number; brightMult: number } | null>(null);
  const rgbUpdateTimeoutRef = useRef<any>(null);
  const [iroLoaded, setIroLoaded] = useState(false);

  // Timers States
  const [filterInit, setFilterInit] = useState('08:00');
  const [filterStartHour, setFilterStartHour] = useState('08');
  const [filterStartMinute, setFilterStartMinute] = useState('00');
  const [filterInit1, setFilterInit1] = useState('08');
  const [filterHours1, setFilterHours1] = useState('4');
  const [filterInit2, setFilterInit2] = useState('D');
  const [filterHours2, setFilterHours2] = useState('4');
  const [filterHours, setFilterHours] = useState('4');
  const [filterDays, setFilterDays] = useState<boolean[]>([true, true, true, true, true, true, true]);
  
  const [ledStartHour, setLedStartHour] = useState('20');
  const [ledStartMinute, setLedStartMinute] = useState('00');
  const [ledDuration, setLedDuration] = useState('4');
  const [ledProgram, setLedProgram] = useState('0');

  const [hidroTimerEnabled, setHidroTimerEnabled] = useState(false);
  const [hidroTimerHours, setHidroTimerHours] = useState('D');

  // MQTT instance reference
  const mqttClientRef = useRef<any>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const prevDeviceIdRef = useRef<string>('');
  const iroPickerRef = useRef<any>(null);
  const pickerContainerId = 'iro-color-picker-target';
  const recentOutboundPublishesRef = useRef<Map<string, number>>(new Map());

  const recordOutboundPublish = useCallback((topic: string, payload: string) => {
    if (!topic) return;
    const now = Date.now();
    const cleanTopic = topic.trim();
    const cleanPayload = (payload || '').trim();
    const key = `${cleanTopic}::${cleanPayload}`;
    recentOutboundPublishesRef.current.set(key, now);

    const parts = cleanTopic.split('/');
    if (parts.length >= 2) {
      const relTopic = parts.slice(1).join('/');
      recentOutboundPublishesRef.current.set(`${relTopic}::${cleanPayload}`, now);
    }

    // Prune entries older than 10 seconds
    for (const [k, time] of recentOutboundPublishesRef.current.entries()) {
      if (now - time > 10000) {
        recentOutboundPublishesRef.current.delete(k);
      }
    }
  }, []);

  const [pahoLoaded, setPahoLoaded] = useState(false);
  const [userWantsMqtt, setUserWantsMqttState] = useState(true);
  const userWantsMqttRef = useRef(true);
  const lastMessageTimeRef = useRef<number>(0);
  const consecutiveAutoReconnectsRef = useRef<number>(0);
  const failedAttemptsRef = useRef<number>(0);
  
  const [isUpdatingData, setIsUpdatingData] = useState(false);
  const [showUpdatedMessage, setShowUpdatedMessage] = useState(false);

  // Custom Toast notification system (replaces browser native alerts)
  const [toasts, setToasts] = useState<Array<{
    id: string;
    title: string;
    message?: string;
    type?: 'success' | 'info' | 'warning' | 'error';
  }>>([]);

  const showToast = useCallback((title: string, message?: string, type: 'success' | 'info' | 'warning' | 'error' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const handleSelectTheme = useCallback(async (theme: AppTheme) => {
    applyAppTheme(theme);

    if (!currentUser?.isSupabase || !currentUser?.uid || !isSupabaseConfigured()) {
      return;
    }

    setThemeSaving(true);
    try {
      const updated = await updateProfileTheme(currentUser.uid, theme);
      if (!updated) {
        showToast('Tema', 'Não foi possível salvar no banco. Preferência ficou só neste aparelho.', 'warning');
      }
    } finally {
      setThemeSaving(false);
    }
  }, [applyAppTheme, currentUser?.isSupabase, currentUser?.uid, showToast]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const loadDeviceCatalogFromSupabase = useCallback(async () => {
    const items = await fetchDeviceCatalog();
    setDeviceCatalog(items);
    return items;
  }, []);

  // Owner/admin visibility: every registered device system-wide, with its owner's email attached
  const loadAdminAllDevices = useCallback(async () => {
    const devices = await fetchAllActiveDevices();
    setAdminAllDevices(devices.map((d) => ({
      id: d.id,
      model: d.model,
      serial: d.serial,
      user_id: d.user_id,
      userEmail: d.owner_email ?? null,
    })));
  }, []);

  // Owner/admin visibility: recent audit trail events from Supabase `audit_events`
  const loadAuditEvents = useCallback(async () => {
    setAuditLoading(true);
    try {
      const events = await fetchAuditEvents({ limit: 500, sort: 'desc' });
      setAuditEvents(events);
      setAuditPage(1);
    } finally {
      setAuditLoading(false);
    }
  }, []);

  // Admin equipment panel: resolve the selected user's record and their devices only
  const selectedAdminUserObj = selectedUserForEquip
    ? simUsers.find(u => (u.email || '').toLowerCase().trim() === selectedUserForEquip.toLowerCase().trim())
    : null;
  const adminEquipmentsForSelectedUser = selectedUserForEquip
    ? adminAllDevices.filter((d) => {
        const emailMatch = (d.userEmail || '').toLowerCase().trim() === selectedUserForEquip.toLowerCase().trim();
        const uidMatch = !!selectedAdminUserObj && !!d.user_id && d.user_id === selectedAdminUserObj.uid;
        return emailMatch || uidMatch;
      })
    : [];
  // Devices available to link: anything not already owned by the selected user (unowned or owned by someone else)
  const adminEquipmentsAvailableToLink = selectedUserForEquip
    ? adminAllDevices.filter((d) => !adminEquipmentsForSelectedUser.some((eq) => eq.id === d.id))
    : [];

  // Audit filter options + filtered/paginated view (client-side for instant UX)
  const auditFilterOptions = (() => {
    const base = deriveAuditFilterOptions(auditEvents);
    const fromDevices = adminAllDevices
      .map((d) => (d.serial || d.id || '').trim())
      .filter(Boolean);
    const serials = Array.from(new Set([...base.serials, ...fromDevices])).sort((a, b) =>
      a.localeCompare(b)
    );
    return { ...base, serials };
  })();
  const filteredAuditEvents = (() => {
    const search = auditFilterSearch.trim().toLowerCase();
    const fromTs = auditFilterDateFrom ? new Date(`${auditFilterDateFrom}T00:00:00`).getTime() : null;
    const toTs = auditFilterDateTo ? new Date(`${auditFilterDateTo}T23:59:59.999`).getTime() : null;
    const serialAliases = auditFilterSerial
      ? resolveDeviceSerialAliases(auditFilterSerial, adminAllDevices, auditEvents)
      : [];

    let rows = auditEvents.filter((e) => {
      if (auditFilterActor && (e.actor_email || '') !== auditFilterActor) return false;
      if (auditFilterEntityType && e.entity_type !== auditFilterEntityType) return false;
      if (auditFilterEventType && e.event_type !== auditFilterEventType) return false;
      if (auditFilterEntityId) {
        const needle = auditFilterEntityId.trim().toLowerCase();
        if (!(e.entity_id || '').toLowerCase().includes(needle)) return false;
      }
      if (auditFilterSerial && !auditEventMatchesSerial(e, auditFilterSerial, serialAliases)) return false;
      const created = new Date(e.created_at).getTime();
      if (fromTs != null && !Number.isNaN(fromTs) && created < fromTs) return false;
      if (toTs != null && !Number.isNaN(toTs) && created > toTs) return false;
      if (search) {
        const hay = [
          e.actor_email,
          e.entity_type,
          e.entity_id,
          e.event_type,
          JSON.stringify(e.metadata || {}),
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });

    rows = [...rows].sort((a, b) => {
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();
      return auditFilterSort === 'asc' ? da - db : db - da;
    });

    return rows;
  })();

  const auditTotalPages = Math.max(1, Math.ceil(filteredAuditEvents.length / auditPageSize));
  const auditPageSafe = Math.min(auditPage, auditTotalPages);
  const pagedAuditEvents = filteredAuditEvents.slice(
    (auditPageSafe - 1) * auditPageSize,
    auditPageSafe * auditPageSize
  );

  const clearAuditFilters = () => {
    setAuditFilterSearch('');
    setAuditFilterActor('');
    setAuditFilterEntityType('');
    setAuditFilterEventType('');
    setAuditFilterEntityId('');
    setAuditFilterSerial('');
    setAuditFilterDateFrom('');
    setAuditFilterDateTo('');
    setAuditFilterSort('desc');
    setAuditPage(1);
    setAuditExpandedId(null);
  };

  const auditFiltersActiveCount = [
    auditFilterSearch,
    auditFilterActor,
    auditFilterEntityType,
    auditFilterEventType,
    auditFilterEntityId,
    auditFilterSerial,
    auditFilterDateFrom,
    auditFilterDateTo,
  ].filter(Boolean).length;

  const setUserWantsMqtt = (val: boolean) => {
    userWantsMqttRef.current = val;
    setUserWantsMqttState(val);
  };

  // 1. Initial State Resolution
  useEffect(() => {
    // Resolve states from Storage helper to avoid SSR hydration issues and comply with ESLint constraints
    setTimeout(() => {
      // Auto-migrate legacy cached broker settings to newly updated default hardware broker
      const configVersion = localStorage.getItem('app_config_version');
      let storedBroker = localStorage.getItem('mqtt_broker');
      let storedPort = localStorage.getItem('mqtt_port');

      if (!configVersion || configVersion !== '2026_07_24_v2_mosquitto' || storedBroker === 'broker.emqx.io' || storedBroker === 'broker.hivemq.com') {
        storedBroker = DEFAULT_MQTT_BROKER;
        storedPort = DEFAULT_MQTT_PORT;
        localStorage.setItem('mqtt_broker', DEFAULT_MQTT_BROKER);
        localStorage.setItem('mqtt_port', DEFAULT_MQTT_PORT);
        localStorage.setItem('app_config_version', '2026_07_24_v2_mosquitto');
      }

      let storedDevice = localStorage.getItem('mqtt_device') || DEFAULT_DEVICE_ID;

      const storedMqttUser = localStorage.getItem('mqtt_user') || '';
      const storedMqttPass = localStorage.getItem('mqtt_pass') || '';

      setMqttBroker(storedBroker || DEFAULT_MQTT_BROKER);
      setMqttPort(storedPort || DEFAULT_MQTT_PORT);
      setDeviceId(storedDevice);
      setMqttUser(storedMqttUser);
      setMqttPassword(storedMqttPass);
      setMotor1Name('Motor 01');
      setMotor2Name('Motor 02');
      setMotor3Name('Motor 03');
      setMotor4Name('Motor 04');
      setMotor5Name('Motor 05');
      setMotor6Name('Motor 06');
      setMotor7Name('Motor 07');
      setMotor8Name('Motor 08');

      // Supabase is the single source of truth for authentication when properly configured.
      // If unconfigured or configured with errors, we support local simulated sessions to prevent lock-outs.
      if (isSupabaseConfigured()) {
        localStorage.removeItem('sim_user');
      } else {
        const savedSimUser = localStorage.getItem('sim_user');
        if (savedSimUser) {
          try {
            setCurrentUser(JSON.parse(savedSimUser));
            setActiveScreen('home');
          } catch (e) {
            localStorage.removeItem('sim_user');
          }
        }
      }
      localStorage.removeItem('supabase_url_cache');
      localStorage.removeItem('supabase_anon_key_cache');

      const storedEquips = localStorage.getItem('registered_equipments');
      const deletedIds: string[] = JSON.parse(localStorage.getItem('deleted_device_ids') || '[]');
      const isDefaultDeleted = deletedIds.some(del => areDeviceIdsMatching(del, 'MLZ-MM12TW-EEA39F-000003'));

      if (storedEquips) {
        try {
          const parsed = JSON.parse(storedEquips);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setRegisteredEquipments(parsed);
          } else if (Array.isArray(parsed) && parsed.length === 0 && !isDefaultDeleted) {
            const defaultList = [{
              id: 'MLZ-MM12TW-EEA39F-000003',
              model: 'MM12TW',
              serial: 'MLZ-MM12TW-EEA39F-000003',
              manufacturer: 'MASTERLAZER'
            }];
            setRegisteredEquipments(defaultList);
            localStorage.setItem('registered_equipments', JSON.stringify(defaultList));
          } else if (Array.isArray(parsed)) {
            setRegisteredEquipments(parsed);
          }
        } catch (e) {
          console.error('[Storage] Error loading registered_equipments:', e);
        }
      } else if (!isDefaultDeleted) {
        const defaultList = [{
          id: 'MLZ-MM12TW-EEA39F-000003',
          model: 'MM12TW',
          serial: 'MLZ-MM12TW-EEA39F-000003',
          manufacturer: 'MASTERLAZER'
        }];
        setRegisteredEquipments(defaultList);
        localStorage.setItem('registered_equipments', JSON.stringify(defaultList));
      }

      // Fetch Supabase configuration from server dynamically
      const initAppAndSupabase = async () => {
        try {
          const localUrl = localStorage.getItem('local_supabase_url');
          const localKey = localStorage.getItem('local_supabase_key');
          if (localUrl) setManualUrl(localUrl);
          if (localKey) setManualKey(localKey);

          if (localUrl && localKey) {
            // Already initialized using localStorage in /lib/supabase.ts
            setSupabaseStateLoaded(true);
            return;
          }

          const res = await fetch('/api/supabase-config', { cache: 'no-store' });
          const data = await res.json();
          if (data.supabaseUrl && data.supabaseAnonKey) {
            const success = configureSupabase(data.supabaseUrl, data.supabaseAnonKey);
            if (success) {
              setSupabaseStateLoaded(true);
            }
          }
        } catch (err) {
          console.error("Failed to load Supabase runtime config:", err);
        }
      };

      initAppAndSupabase();

      const storedHidroEnabled = localStorage.getItem('hidro_timer_enabled') === 'true';
      const storedHidroHours = localStorage.getItem('hidro_timer_hours') || '1';
      setHidroTimerEnabled(storedHidroEnabled);
      setHidroTimerHours(storedHidroEnabled ? (storedHidroHours === 'off' ? 'D' : storedHidroHours) : 'D');

      // Load Filtration states
      const storedFilterInit1 = localStorage.getItem('filter_init1') || localStorage.getItem('filter_start_hour') || '08';
      const storedFilterHours1 = localStorage.getItem('filter_hours1') || localStorage.getItem('filter_hours') || '4';
      const storedFilterInit2 = localStorage.getItem('filter_init2') || 'D';
      const storedFilterHours2 = localStorage.getItem('filter_hours2') || '4';

      setFilterInit1(storedFilterInit1);
      setFilterHours1(storedFilterHours1);
      setFilterInit2(storedFilterInit2);
      setFilterHours2(storedFilterHours2);

      // Keep backup state synchronized for legacy readers
      setFilterStartHour(storedFilterInit1 === 'D' ? '08' : storedFilterInit1);
      setFilterHours(storedFilterHours1);
      setFilterInit(`${storedFilterInit1 === 'D' ? '08' : storedFilterInit1}:00`);

      const storedFilterDays = localStorage.getItem('filter_days');
      if (storedFilterDays) {
        try {
          setFilterDays(JSON.parse(storedFilterDays));
        } catch (e) {
          // ignore
        }
      }

      // Load LED timer states
      const storedLedStartHour = localStorage.getItem('led_start_hour') || '20';
      const storedLedStartMinute = localStorage.getItem('led_start_minute') || '00';
      const storedLedDuration = localStorage.getItem('led_duration') || '4';
      const storedLedProgram = localStorage.getItem('led_program') || '0';
      setLedStartHour(storedLedStartHour);
      setLedStartMinute(storedLedStartMinute);
      setLedDuration(storedLedDuration);
      setLedProgram(storedLedProgram);

      // Smoothly hide the high-end PWA splash screen
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          const splash = document.getElementById('pwa-splash-screen');
          if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => {
              splash.style.display = 'none';
            }, 600);
          }
        }, 300); // Short delay to allow visual completion of the introduction
      }
    }, 0);
  }, []);

  // Clock state to show current local time
  const [currentTime, setCurrentTime] = useState('19:13');

  // Update current time every second
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      setCurrentTime(`${hours}:${minutes}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);



  // 1b. Auto-connection on startup / auth resolve-reconnect loop
  useEffect(() => {
    // If we've loaded Paho and have a currentUser logged in, and user wants Mqtt
    if (typeof window !== 'undefined' && window.Paho && currentUser && userWantsMqtt) {
      if (!mqttConnected && !mqttClientRef.current) {
        console.log('Automated connection or reconnection trigger active.');
        connectMQTT();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, pahoLoaded, userWantsMqtt]);

  // 1c. Periodic heartbeat connection resilience check
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const interval = setInterval(() => {
      if (window.Paho && currentUser && userWantsMqtt && !mqttConnected) {
        console.log('Heartbeat monitoring: MQTT offline, triggering auto-reconnect...');
        connectMQTT();
      }
    }, 8000); // Check every 8 seconds to keep connection rock-solid
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, userWantsMqtt, mqttConnected]);

  // 1d. Reconnect MQTT whenever active deviceId changes to update subscriptions
  useEffect(() => {
    if (!deviceId) return;

    if (prevDeviceIdRef.current !== deviceId) {
      setTimeout(() => {
        setIsUpdatingData(true);
        setShowUpdatedMessage(false);
        setDeviceIp('---');
        setDeviceMac('---');
        const matched = registeredEquipments.find(eq => areDeviceIdsMatching(eq.id, deviceId));
        if (matched) {
          setDeviceModelo(matched.model || '---');
          setDeviceSerial(matched.serial || '---');
        } else {
          setDeviceModelo('---');
          setDeviceSerial('---');
        }
        setDeviceOnline(null);
      }, 0);
      lastMessageTimeRef.current = Date.now();

      if (prevDeviceIdRef.current && typeof window !== 'undefined' && window.Paho && currentUser && userWantsMqtt) {
        console.log('Active Device ID changed, reconnecting MQTT to update subscriptions...');
        disconnectMQTT(true);
        const t = setTimeout(() => {
          connectMQTT();
        }, 300);
        prevDeviceIdRef.current = deviceId;
        return () => clearTimeout(t);
      }
      prevDeviceIdRef.current = deviceId;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, registeredEquipments, currentUser, userWantsMqtt]);

  // 1e. Fetch Supabase device settings (e.g. motor names) when active device changes
  useEffect(() => {
    Promise.resolve().then(() => {
      setMotor1Name('Motor 01');
      setMotor2Name('Motor 02');
      setMotor3Name('Motor 03');
      setMotor4Name('Motor 04');
      setMotor5Name('Motor 05');
      setMotor6Name('Motor 06');
      setMotor7Name('Motor 07');
      setMotor8Name('Motor 08');
      setMotorSettingsSaveState('idle');
    });

    const deviceIsRegistered = registeredEquipments.some(
      (eq) => eq.id.toLowerCase() === (deviceId || '').toLowerCase()
    );

    if (isSupabaseConfigured() && currentUser?.isSupabase && deviceId && deviceIsRegistered) {
      const loadDbSettings = async () => {
        try {
          // control-only / soft-deleted: fetch only — ensure INSERT is blocked by RLS
          const settings = canConfigureActiveDevice
            ? await ensureDeviceSettings(deviceId)
            : await fetchDeviceSettings(deviceId);
          if (settings) {
            setMotor1Name(settings.motor1_name ?? 'Motor 01');
            setMotor2Name(settings.motor2_name ?? 'Motor 02');
            setMotor3Name(settings.motor3_name ?? 'Motor 03');
            setMotor4Name(settings.motor4_name ?? 'Motor 04');
            setMotor5Name(settings.motor5_name ?? 'Motor 05');
            setMotor6Name(settings.motor6_name ?? 'Motor 06');
            setMotor7Name(settings.motor7_name ?? 'Motor 07');
            setMotor8Name(settings.motor8_name ?? 'Motor 08');

            // Restore timer config from Supabase (cloud backup; MQTT may still overwrite later)
            if (settings.filter_init1 != null) {
              setFilterInit1(settings.filter_init1);
              setFilterStartHour(settings.filter_init1 === 'D' ? '08' : settings.filter_init1);
              setFilterInit(`${settings.filter_init1 === 'D' ? '08' : settings.filter_init1}:00`);
              localStorage.setItem('filter_init1', settings.filter_init1);
              localStorage.setItem('filter_start_hour', settings.filter_init1 === 'D' ? '08' : settings.filter_init1);
            }
            if (settings.filter_hours1 != null) {
              setFilterHours1(settings.filter_hours1);
              setFilterHours(settings.filter_hours1);
              localStorage.setItem('filter_hours1', settings.filter_hours1);
              localStorage.setItem('filter_hours', settings.filter_hours1);
            }
            if (settings.filter_init2 != null) {
              setFilterInit2(settings.filter_init2);
              localStorage.setItem('filter_init2', settings.filter_init2);
            }
            if (settings.filter_hours2 != null) {
              setFilterHours2(settings.filter_hours2);
              localStorage.setItem('filter_hours2', settings.filter_hours2);
            }
            if (Array.isArray(settings.filter_days) && settings.filter_days.length === 7) {
              setFilterDays(settings.filter_days);
              localStorage.setItem('filter_days', JSON.stringify(settings.filter_days));
            }
            if (settings.led_start_hour != null) {
              setLedStartHour(settings.led_start_hour);
              localStorage.setItem('led_start_hour', settings.led_start_hour);
            }
            if (settings.led_start_minute != null) {
              setLedStartMinute(settings.led_start_minute);
              localStorage.setItem('led_start_minute', settings.led_start_minute);
            }
            if (settings.led_duration != null) {
              setLedDuration(settings.led_duration);
              localStorage.setItem('led_duration', settings.led_duration);
            }
            if (settings.led_program != null) {
              setLedProgram(settings.led_program);
              localStorage.setItem('led_program', settings.led_program);
            }
            if (settings.hidro_timer_hours != null || settings.hidro_timer_enabled != null) {
              const hidroEnabled = settings.hidro_timer_enabled === true;
              const hidroHours = settings.hidro_timer_hours ?? (hidroEnabled ? '1' : 'D');
              setHidroTimerEnabled(hidroEnabled);
              setHidroTimerHours(hidroEnabled ? (hidroHours === 'off' ? 'D' : hidroHours) : 'D');
              localStorage.setItem('hidro_timer_enabled', String(hidroEnabled));
              localStorage.setItem('hidro_timer_hours', hidroEnabled ? hidroHours : 'D');
            }
          }
        } catch (err) {
          console.warn("Error loading device settings from Supabase:", err);
        }
      };
      loadDbSettings();
    }
  }, [deviceId, currentUser, registeredEquipments, canConfigureActiveDevice]);

  useEffect(() => {
    return () => {
      Object.values(motorNameSaveTimersRef.current).forEach((timer) => {
        if (timer) clearTimeout(timer);
      });
      motorNameSaveTimersRef.current = {};
    };
  }, [deviceId]);

  // 1f. Periodic check: if device is marked as online but hasn't sent any message for > 120 seconds (2 minutes), mark it as offline
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const interval = setInterval(() => {
      if (mqttConnected) {
        if (lastMessageTimeRef.current > 0) {
          const silenceDuration = Date.now() - lastMessageTimeRef.current;

          // Mark device as offline if no telemetry message received in 2 minutes
          if (deviceOnline === true && silenceDuration > 120000) {
            console.log('No telemetry received from device in 120 seconds. Marking device as OFFLINE.');
            setDeviceOnline(false);
          }
        }
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [mqttConnected, deviceOnline, userWantsMqtt]);

  // 1g. Backup safety timeout to automatically complete update and unlock if MQTT message doesn't arrive
  useEffect(() => {
    if (isUpdatingData) {
      const timer = setTimeout(() => {
        setIsUpdatingData(false);
        setShowUpdatedMessage(true);
      }, 3500); // 3.5 seconds safety timeout
      return () => clearTimeout(timer);
    }
  }, [isUpdatingData]);

  // 1h. Auto-hide the "Sistema Atualizado!" message after 5 seconds
  useEffect(() => {
    if (showUpdatedMessage) {
      const timer = setTimeout(() => {
        setShowUpdatedMessage(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showUpdatedMessage]);

  // 1i. Recover from mobile background sleep, tab switching, or network recovery using focus, visibilitychange, and online events
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let lastFocusReconnect = 0;
    const handleFocusOrVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (typeof window !== 'undefined' && window.Paho && currentUser && userWantsMqtt) {
          const isConn = mqttClientRef.current && typeof mqttClientRef.current.isConnected === 'function' && mqttClientRef.current.isConnected();
          if (!isConn) {
            const now = Date.now();
            if (now - lastFocusReconnect > 5000) {
              console.log('Tab visibility change detected and MQTT is offline. Connecting...');
              lastFocusReconnect = now;
              connectMQTT();
            }
          }
        }
      }
    };

    const handleNetworkRecovery = () => {
      if (typeof window !== 'undefined' && window.Paho && currentUser && userWantsMqtt) {
        const isConn = mqttClientRef.current && typeof mqttClientRef.current.isConnected === 'function' && mqttClientRef.current.isConnected();
        if (!isConn) {
          console.log('Internet connection restored and MQTT is offline. Connecting...');
          connectMQTT();
        }
      }
    };

    document.addEventListener('visibilitychange', handleFocusOrVisibility);
    window.addEventListener('online', handleNetworkRecovery);
    return () => {
      document.removeEventListener('visibilitychange', handleFocusOrVisibility);
      window.removeEventListener('online', handleNetworkRecovery);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, userWantsMqtt]);

  // Sync equipment from Supabase for logged-in user
  const syncUserDevicesFromSupabase = useCallback(async (userId: string, userEmail?: string) => {
    if (!isSupabaseConfigured() || !userId) return [];

    const dbDevices = await fetchUserDevices(userId);
    let deletedIds: string[] = [];
    try {
      deletedIds = JSON.parse(localStorage.getItem('deleted_device_ids') || '[]');
    } catch {
      deletedIds = [];
    }

    // Cloud is source of truth: if Supabase still has the device as active,
    // purge it from the local deleted blacklist (legacy hard-delete failures left stale IDs).
    const activeDbIds = (dbDevices || []).map((d: any) => String(d.id || '')).filter(Boolean);
    if (activeDbIds.length > 0 && deletedIds.length > 0) {
      const pruned = deletedIds.filter(
        (del) => !activeDbIds.some((id) => areDeviceIdsMatching(del, id))
      );
      if (pruned.length !== deletedIds.length) {
        deletedIds = pruned;
        localStorage.setItem('deleted_device_ids', JSON.stringify(pruned));
      }
    }

    // Prefer Supabase rows; never hide an active cloud device behind localStorage blacklist
    const mappedDb = (dbDevices || []).map((d: any) => ({
      id: d.id,
      model: d.model || 'MM12TW',
      serial: d.serial || d.id,
      pairing_token: d.pairing_token,
      manufacturer: 'MASTERLAZER',
      userEmail: userEmail || '',
      access: d.access === 'shared' ? 'shared' as const : 'owner' as const,
      permission:
        d.access === 'shared'
          ? ((d.permission === 'configure' ? 'configure' : 'control') as SharePermission)
          : ('owner' as const),
    }));

    // Cloud is source of truth for Supabase users. Soft-deleted devices still pass
    // devices SELECT RLS but are excluded from fetchUserDevices — keeping them in
    // localStorage caused ensureDeviceSettings → RLS 42501 spam.
    const combined: any[] = [...mappedDb];

    setRegisteredEquipments(combined);
    localStorage.setItem('registered_equipments', JSON.stringify(combined));

    if (combined.length > 0) {
      const storedDevice = (localStorage.getItem('mqtt_device') || deviceId || '').trim();
      const matched = combined.find((d: any) => areDeviceIdsMatching(d.id, storedDevice));
      const nextDeviceId = matched?.id || combined[0].id;
      setDeviceId(nextDeviceId);
      localStorage.setItem('mqtt_device', nextDeviceId);
    }

    return combined;
  }, [deviceId]);

  // 2. Initialize Supabase Auth state observer
  useEffect(() => {
    if (!supabaseStateLoaded || !isSupabaseConfigured()) return;

    const { data: { subscription } } = onAuthStateChange(async (event: any, session: any) => {
      if (session?.user) {
        // Fetch user profile and role from profiles table
        const profile = await fetchProfile(session.user.id);
        if (profile?.status === 'deleted') {
          console.warn('[Auth] Soft-deleted profile attempted session — signing out');
          await signOut();
          setCurrentUser(null);
          return;
        }
        if (profile) {
          const loggedUser = {
            email: session.user.email,
            uid: session.user.id,
            role: profile.role, // owner, admin, support, operator, installer, factory
            full_name: profile.full_name,
            isSupabase: true
          };
          setCurrentUser(loggedUser);
          if (profile.theme === 'light' || profile.theme === 'dark') {
            applyAppTheme(profile.theme);
          }
          
          // Load devices for the user from Supabase and sync state
          await syncUserDevicesFromSupabase(session.user.id, session.user.email);
          
          if (activeScreen === 'login' || activeScreen === 'register') {
            const hasInvite = !!sessionStorage.getItem(INVITE_STORAGE_KEY);
            setActiveScreen(hasInvite ? 'invite' : 'home');
          }
        } else {
          // No profile exists, show error and logout
          setAuthErrorMessage('Erro: Perfil do usuário não encontrado na tabela "profiles". O administrador precisa liberar o seu acesso.');
          signOut();
          setCurrentUser(null);
          setActiveScreen('login');
        }
      } else {
        setCurrentUser(null);
        setRegisteredEquipments([]);
        const hasInvite = !!sessionStorage.getItem(INVITE_STORAGE_KEY);
        if (activeScreen === 'register') {
          // stay on register
        } else if (hasInvite || activeScreen === 'invite') {
          setActiveScreen('invite');
        } else {
          setActiveScreen('login');
        }
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabaseStateLoaded, activeScreen]);

  // Load device catalog from Supabase (devices_catalog is the source of truth)
  useEffect(() => {
    let cancelled = false;
    setCatalogLoading(true);

    const load = async () => {
      if (!currentUser?.isSupabase || !isSupabaseConfigured()) {
        if (!cancelled) {
          setDeviceCatalog([]);
          setCatalogLoading(false);
        }
        return;
      }

      try {
        await loadDeviceCatalogFromSupabase();
      } catch (err) {
        console.warn('[Catalog] Failed to load devices_catalog:', err);
        if (!cancelled) {
          setDeviceCatalog([]);
          showToast('Catálogo', 'Não foi possível carregar devices_catalog do Supabase.', 'error');
        }
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.uid, currentUser?.isSupabase, loadDeviceCatalogFromSupabase, showToast]);

  // 2b. Load firmware list (published OTA updates) once the user session is known
  useEffect(() => {
    if (!currentUser?.isSupabase) {
      setFirmwareList([]);
      return;
    }

    let cancelled = false;
    setFirmwareLoading(true);

    const loadFirmware =
      currentUser?.role === 'owner' || currentUser?.role === 'admin' || currentUser?.role === 'support'
        ? fetchAllFirmware()
        : fetchActiveFirmware();

    loadFirmware
      .then((items) => {
        if (!cancelled) setFirmwareList(items);
      })
      .catch((err) => {
        console.warn('[Firmware] Failed to load firmware list:', err);
      })
      .finally(() => {
        if (!cancelled) setFirmwareLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser?.uid, currentUser?.isSupabase, currentUser?.role]);

  // 3. Dynamic setup of Iro.js Color picker when active screen is 'led'
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let intervalId: any = null;
    let fallbackTimeoutId: any = null;

    if (activeScreen === 'led') {
      const tryInitPicker = () => {
        const pickerEl = document.getElementById(pickerContainerId);
        if (pickerEl && window.iro) {
          // If already has children and picker is initialized, just finish
          if (pickerEl.children.length > 0 && iroPickerRef.current) {
            if (intervalId) clearInterval(intervalId);
            if (fallbackTimeoutId) clearTimeout(fallbackTimeoutId);
            return;
          }

          if (intervalId) clearInterval(intervalId);
          if (fallbackTimeoutId) clearTimeout(fallbackTimeoutId);
          
          try {
            pickerEl.innerHTML = ''; // Prevent dynamic duplicated elements
            const initialVal = 100; // Always start the value/lightness slider at 100%
            setLedVal(initialVal);
            setSatMultiplier(100);
            setBrightMultiplier(100);
            const picker = new window.iro.ColorPicker(`#${pickerContainerId}`, {
              width: 250,
              color: `hsv(${ledHue}, ${ledSat}, ${initialVal})`,
              borderWidth: 0,
              borderColor: 'transparent',
              wheelLightness: false,
              sliderSize: 12,
              layout: [
                { 
                  component: window.iro.ui.Wheel,
                  options: {
                    borderWidth: 0,
                    wheelLightness: false,
                  }
                },
                {
                  component: window.iro.ui.Slider,
                  options: {
                    sliderType: 'value',
                    borderWidth: 0,
                    sliderSize: 5,
                  }
                }
              ]
            });

            iroPickerRef.current = picker;

            picker.on('color:change', (c: any) => {
              setLedHue(Math.round(c.hsv.h));
              setLedSat(Math.round(c.hsv.s));
              setLedVal(Math.round(c.hsv.v));
            });

            picker.on('input:change', (c: any) => {
              lastUserColorInteractionRef.current = Date.now();
              const h = Math.round(c.hsv.h);
              const s = Math.round(c.hsv.s);
              const v = Math.round(c.hsv.v);
              
              if (currentProgramRef.current === '---') {
                setCurrentProgram(1);
                const cleanId = cleanDeviceId(deviceId).trim() || deviceId.trim();
                publishTopic(`MLZ/${cleanId}/led/ctrl`, "ON");
                publishTopic(`MLZ/${cleanId}/led/pg`, "1");
              }

              if (mqttConnected) {
                throttledPublishColor(h, s, v, satMultiplierRef.current, brightMultiplierRef.current);
              }
            });
          } catch (e) {
            console.error("Iro Picker instantiation failed:", e);
          }
        }
      };

      // Poll periodically to make sure elements are ready
      intervalId = setInterval(tryInitPicker, 150);
      fallbackTimeoutId = setTimeout(tryInitPicker, 50);
    } else {
      // Destroy or clean picker reference when navigation leaves tab
      iroPickerRef.current = null;
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (fallbackTimeoutId) clearTimeout(fallbackTimeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeScreen, iroLoaded]);

  const loadProductionData = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    setProductionLoading(true);
    try {
      const [rows, stats] = await Promise.all([
        fetchProductionDevices(),
        fetchProductionStatsByModel(),
      ]);
      setProductionDevices(rows);
      setProductionStats(stats);
    } finally {
      setProductionLoading(false);
    }
  }, []);

  // 3b. Load all synced user profiles, devices and audit events live from Supabase when administrative tab opens
  useEffect(() => {
    if (activeScreen === 'admin' && isSupabaseConfigured()) {
      const loadProfiles = async () => {
        const profiles = await fetchAllProfiles();
        setSimUsers(profiles.map(p => ({
          uid: p.id,
          email: p.email,
          full_name: p.full_name,
          role: p.role
        })));
      };
      loadProfiles();
      loadAdminAllDevices();
      loadAuditEvents();
      loadProductionData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeScreen]);

  useEffect(() => {
    if (activeScreen === 'admin' && adminTab === 'production' && isSupabaseConfigured()) {
      loadProductionData();
    }
  }, [activeScreen, adminTab, loadProductionData]);

  // 4. Color HSV to RGB Converter Math helper helper
  function hsvToRgb(h: number, s: number, v: number) {
    s = s / 100;
    v = v / 100;
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255)
    };
  }

  // 4b. Color RGB to HSV Converter Math helper helper (for hardware feedback loop)
  function rgbToHsv(r: number, g: number, b: number) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    const s = max === 0 ? 0 : d / max;
    const v = max;

    if (max !== min) {
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      v: Math.round(v * 100)
    };
  }

  function publishColor(h: number, s: number, v: number, satMult: number, brightMult: number) {
    const effectiveSat = (s * satMult) / 100;
    const effectiveVal = (v * brightMult) / 100;
    const rgb = hsvToRgb(h, effectiveSat, effectiveVal);
    const cleanId = cleanDeviceId(deviceId).trim() || deviceId.trim();
    
    // Send single clean RGB PWM values
    publishTopic(`MLZ/${cleanId}/pwm/r`, String(rgb.r));
    publishTopic(`MLZ/${cleanId}/pwm/g`, String(rgb.g));
    publishTopic(`MLZ/${cleanId}/pwm/b`, String(rgb.b));
  }

  function throttledPublishColor(h: number, s: number, v: number, satMult: number, brightMult: number) {
    const now = Date.now();
    const limit = 120; // 120ms throttle limit is perfect for high responsiveness without overloading the MQTT broker
    
    pendingPublishRef.current = { h, s, v, satMult, brightMult };

    const runPublish = () => {
      if (pendingPublishRef.current) {
        const { h, s, v, satMult, brightMult } = pendingPublishRef.current;
        publishColor(h, s, v, satMult, brightMult);
        lastPublishTimeRef.current = Date.now();
        pendingPublishRef.current = null;
      }
      publishThrottleTimeoutRef.current = null;
    };

    if (now - lastPublishTimeRef.current >= limit) {
      if (publishThrottleTimeoutRef.current) {
        clearTimeout(publishThrottleTimeoutRef.current);
        publishThrottleTimeoutRef.current = null;
      }
      runPublish();
    } else {
      if (!publishThrottleTimeoutRef.current) {
        publishThrottleTimeoutRef.current = setTimeout(runPublish, limit - (now - lastPublishTimeRef.current));
      }
    }
  }

  // 5. Authenticator handler
  const handleAuthSubmit = async (mode: 'login' | 'register') => {
    const cleanEmail = (emailInput || '').trim().toLowerCase();
    const cleanPassword = passwordInput || '';

    if (!cleanEmail || cleanPassword.length < 8) {
      setAuthErrorMessage('Insira um e-mail válido e senha de no mínimo 8 caracteres.');
      return;
    }
    setAuthErrorMessage('');
    setIsLoadingAuth(true);

    const configErr = getSupabaseConfigError();
    if (configErr) {
      setAuthErrorMessage(configErr);
      setIsLoadingAuth(false);
      return;
    }

    try {
      if (mode === 'login') {
        const { data, error } = await signInWithPassword(cleanEmail, cleanPassword);
        if (error) throw error;
        if (data?.user) {
          // Fetch profile and role using profileService
          let profile = await fetchProfile(data.user.id);
          if (!profile) {
            // Wait 500ms and retry fetching profile to account for potential replication delay
            await new Promise(resolve => setTimeout(resolve, 500));
            profile = await fetchProfile(data.user.id);
          }

          if (!profile) {
            await signOut();
            throw new Error('Perfil do usuário não encontrado na tabela "profiles". O administrador precisa liberar o seu acesso.');
          }

          if (profile.status === 'deleted') {
            await signOut();
            throw new Error('Esta conta foi desativada. Entre em contato com o administrador.');
          }

          const loggedUser = {
            email: data.user.email,
            uid: data.user.id,
            role: profile.role,
            full_name: profile.full_name,
            isSupabase: true
          };

          setCurrentUser(loggedUser);
          if (profile.theme === 'light' || profile.theme === 'dark') {
            applyAppTheme(profile.theme);
          }

          // Fetch user's registered devices from Supabase & sync
          await syncUserDevicesFromSupabase(data.user.id, data.user.email);

          setActiveScreen('home');
        }
      } else {
        // Register mode
        const { data, error } = await signUp(cleanEmail, cleanPassword, cleanEmail.split('@')[0], 'operator');
        if (error) throw error;
        if (data?.user) {
          setActiveScreen('login');
        }
      }
    } catch (err: any) {
      let errorMsg = err.message || 'Falha na autenticação.';
      if (errorMsg.toLowerCase().includes('email not confirmed') || errorMsg.toLowerCase().includes('email_not_confirmed')) {
        errorMsg = 'E-mail não confirmado! Por favor, confirme o e-mail através do link enviado pelo Supabase ou desative a opção "Confirmar E-mail" (Confirm Email) nas configurações de Authentication do seu console do Supabase.';
      }
      setAuthErrorMessage(`Erro Supabase: ${errorMsg}`);
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const handleResetPasswordSimulated = async () => {
    if (!emailInput) {
      showToast('E-mail necessário', 'Por favor, insira o seu e-mail no campo de login acima.', 'warning');
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(emailInput, {
        redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      });
      if (error) throw error;
    } catch (err: any) {
      showToast('Erro Supabase', err.message, 'error');
    }
  };

  const handleEnterDemoMode = () => {
    const demoUser = {
      email: 'demo@masterlazer.com.br',
      uid: 'demo-user-123',
      role: 'owner',
      full_name: 'Proprietário Demo',
      isSupabase: false
    };
    setCurrentUser(demoUser);
    localStorage.setItem('sim_user', JSON.stringify(demoUser));
    setActiveScreen('home');
    setAuthErrorMessage('');
  };

  const handleLogout = async () => {
    try {
      if (isSupabaseConfigured()) {
        await signOut();
      }
    } catch (err) {
      console.error(err);
    }
    localStorage.removeItem('sim_user');
    setCurrentUser(null);
    setEmailInput('');
    setPasswordInput('');
    setActiveScreen('login');
    disconnectMQTT();
  };

  const resetSupportTicketForm = useCallback(() => {
    setSupportSubject('');
    setSupportDescription('');
    setSupportScreenshot(null);
    setSupportScreenshotPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setSupportSending(false);
  }, []);

  const closeSupportTicket = useCallback(() => {
    resetSupportTicketForm();
    setActiveScreen('home');
  }, [resetSupportTicketForm]);

  const handleSupportScreenshotChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setSupportScreenshotPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
    setSupportScreenshot(file);
  };

  const clearSupportScreenshot = () => {
    setSupportScreenshot(null);
    setSupportScreenshotPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const handleSubmitSupportTicket = async () => {
    const description = supportDescription.trim();
    if (!description) {
      showToast('Descreva o problema', 'Informe o que está acontecendo para abrir o chamado.', 'warning');
      return;
    }

    setSupportSending(true);

    const activeEq = registeredEquipments.find((eq) => areDeviceIdsMatching(eq.id, deviceId));
    const lines = [
      '*Suporte — Master Lazer*',
      '',
      `Assunto: ${supportSubject.trim() || 'Problema no aplicativo'}`,
      `Usuário: ${currentUser?.email || 'não informado'}`,
      `Equipamento: ${activeEq?.model || deviceModelo || '—'}`,
      `Serial/ID: ${activeEq?.serial || deviceSerial || deviceId || '—'}`,
      '',
      '*Descrição do problema:*',
      description,
    ];

    if (supportScreenshot) {
      lines.push('', `Print anexado no formulário: ${supportScreenshot.name}`);
      lines.push('_Por favor, envie também o print nesta conversa._');
    }

    const message = lines.join('\n');
    const whatsappUrl = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

    try {
      // Em dispositivos que suportam share com arquivo, tenta enviar o print junto
      if (
        supportScreenshot &&
        typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function'
      ) {
        const shareData: ShareData = {
          files: [supportScreenshot],
          text: message,
          title: 'Suporte Master Lazer',
        };
        if (navigator.canShare(shareData)) {
          await navigator.share(shareData);
          closeSupportTicket();
          return;
        }
      }
    } catch (err: any) {
      // Usuário cancelou o share — não abrir WhatsApp automaticamente
      if (err?.name === 'AbortError') {
        setSupportSending(false);
        return;
      }
    }

    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    closeSupportTicket();
  };

  // 6. MQTT Client Logic Wrapper
  const connectMQTT = () => {
    if (!window.Paho) {
      setMqttErrorMsg('Biblioteca MQTT não carregada.');
      return;
    }
    setUserWantsMqtt(true); // User wants connectivity, enable auto-rejoin guard
    setMqttStatusMessage('Conectando...');
    setMqttErrorMsg('');

    try {
      // Clear any pending reconnect timers first
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      // If client already exists and is connected, don't create a new one
      if (mqttClientRef.current && mqttClientRef.current.isConnected()) {
        setMqttConnected(true);
        setMqttStatusMessage('Conectado');
        return;
      }

      // standard secure configuration fallback
      const clientId = 'web_masterlazer_' + Math.floor(Math.random() * 1000000);
      const host = (mqttBroker || DEFAULT_MQTT_BROKER).trim();
      const port = parseInt(mqttPort) || parseInt(DEFAULT_MQTT_PORT);
      const isSSL = port === 8081 || port === 8084 || port === 8884 || port === 443 || port === 8883 || (typeof window !== 'undefined' && window.location.protocol === 'https:');

      // Safely disconnect any stale existing client before instantiating
      if (mqttClientRef.current) {
        try {
          if (mqttClientRef.current.isConnected()) {
            mqttClientRef.current.disconnect();
          }
        } catch (e) {
          // ignore cleanup exception
        }
        mqttClientRef.current = null;
      }

      const client = new window.Paho.MQTT.Client(host, port, "/mqtt", clientId);
      mqttClientRef.current = client;

      client.onConnectionLost = (responseObject: any) => {
        const errorMsg = responseObject?.errorMessage || 'Conexão encerrada pelo servidor ou oscilação de rede.';
        console.warn('MQTT Connection lost:', errorMsg, 'Code:', responseObject?.errorCode);
        
        setMqttConnected(false);
        setMqttStatusMessage('Desconectado');
        if (responseObject?.errorCode !== 0 && responseObject?.errorMessage) {
          setMqttErrorMsg(responseObject.errorMessage);
        }

        // Always retry connection if user wants connectivity, regardless of whether errorCode is 0 or not!
        if (userWantsMqttRef.current) {
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('Automated Reconnection onConnectionLost target triggered...');
            connectMQTT();
          }, 3000);
        }
      };

      client.onMessageArrived = (message: any) => {
        const dest = message.destinationName;
        const payload = (message.payloadString || '').trim();

        // 1. Filter out self-echo messages sent by this web application client
        const echoKey = `${dest}::${payload}`;
        const publishedTime = recentOutboundPublishesRef.current.get(echoKey);
        if (publishedTime && Date.now() - publishedTime < 6000) {
          console.log('Ignored self-echo MQTT message from web app:', dest, payload);
          return;
        }

        const relParts = dest.split('/');
        if (relParts.length >= 2) {
          const relTopic = relParts.slice(1).join('/');
          const relEchoKey = `${relTopic}::${payload}`;
          const relPublishedTime = recentOutboundPublishesRef.current.get(relEchoKey);
          if (relPublishedTime && Date.now() - relPublishedTime < 6000) {
            console.log('Ignored self-echo relative MQTT message from web app:', dest, payload);
            return;
          }
        }

        const cleanActiveId = cleanDeviceId(deviceId).toLowerCase();
        const rawActiveId = (deviceId || '').toLowerCase().trim();

        // Identify device and relative topic
        let devicePartOfMessage = '';
        let relativeTopic = dest;

        const activeEquipment = registeredEquipments.find(eq => areDeviceIdsMatching(eq.id, deviceId));
        const parts = dest.split('/');
        
        const p0Upper = (parts[0] || '').toUpperCase();
        const isKnownPrefix = p0Upper === 'MASTERLAZER' || p0Upper === 'MLZ' || 
          (activeEquipment?.manufacturer && p0Upper === activeEquipment.manufacturer.toUpperCase());

        if (parts.length >= 2 && isKnownPrefix) {
          devicePartOfMessage = parts[1];
          relativeTopic = parts.slice(2).join('/');
        } else if (parts.length >= 1) {
          devicePartOfMessage = parts[0];
          relativeTopic = parts.slice(1).join('/');
        }

        const cleanMsgDeviceId = cleanDeviceId(devicePartOfMessage).toLowerCase();
        const rawMsgDeviceId = devicePartOfMessage.toLowerCase().trim();

        // Verify this message is indeed for our current active device context
        const isTargetDevice = (
          areDeviceIdsMatching(devicePartOfMessage, deviceId) ||
          areDeviceIdsMatching(devicePartOfMessage, cleanActiveId) ||
          areDeviceIdsMatching(devicePartOfMessage, rawActiveId) ||
          cleanMsgDeviceId === cleanActiveId || 
          rawMsgDeviceId === rawActiveId || 
          cleanMsgDeviceId === rawActiveId ||
          rawMsgDeviceId === cleanActiveId ||
          (cleanMsgDeviceId && cleanActiveId &&
           cleanMsgDeviceId.toLowerCase().startsWith('mlz-') && cleanActiveId.toLowerCase().startsWith('mlz-') &&
           cleanMsgDeviceId.split('-').slice(0, 3).join('-') === cleanActiveId.split('-').slice(0, 3).join('-'))
        );

        if (!isTargetDevice) {
          // Message belongs to another device or public topic, ignore silently
          return;
        }

        console.log('Received Message From Hardware:', dest, payload);

        // Successfully received target device message, complete the update sequence
        setIsUpdatingData(false);
        setShowUpdatedMessage(true);
        consecutiveAutoReconnectsRef.current = 0; // Reset consecutive reconnects counter on successful message

        const lowerRelative = relativeTopic.toLowerCase();

        // Any telemetry received from the active device indicates it is powered on and sending data
        lastMessageTimeRef.current = Date.now();
        const isExplicitOffline = (lowerRelative === 'status' || lowerRelative === 'state') && 
          (payload === 'offline' || payload === '0' || payload.toUpperCase() === 'OFF');
          
        if (!isExplicitOffline) {
          setDeviceOnline(true);
        }

        // Listening to Alarms
        if (lowerRelative === 'solar/erro') {
          setSolarErrorBanner(payload);
          return;
        }

        // Try to parse payload as JSON since some status updates are nested/grouped
        if (payload.startsWith('{') && payload.endsWith('}')) {
          try {
            const data = JSON.parse(payload);
            console.log('Successfully parsed JSON hardware status update:', data);

            // Motor 1 (Hidromassagem) - AUX Screen Check
            if (data.mt1 !== undefined) {
              setMotorHidro(data.mt1 === 'ON' || data.mt1 === 'LIG' || data.mt1 === 1 || data.mt1 === true || String(data.mt1).toUpperCase() === 'ON');
            } else if (data.motorHidro !== undefined) {
              setMotorHidro(data.motorHidro === true || data.motorHidro === 'ON' || data.motorHidro === 1);
            } else if (data.hidro !== undefined) {
              setMotorHidro(data.hidro === true || data.hidro === 'ON' || data.hidro === 1);
            }

            // Motor 2 (Filtração) - AUX Screen Check
            if (data.mt2 !== undefined) {
              setMotorFiltro(data.mt2 === 'ON' || data.mt2 === 'LIG' || data.mt2 === 1 || data.mt2 === true || String(data.mt2).toUpperCase() === 'ON');
            } else if (data.motorFiltro !== undefined) {
              setMotorFiltro(data.motorFiltro === true || data.motorFiltro === 'ON' || data.motorFiltro === 1);
            } else if (data.filtro !== undefined) {
              setMotorFiltro(data.filtro === true || data.filtro === 'ON' || data.filtro === 1);
            }

            // Motor 3 - AUX Screen Check
            if (data.mt3 !== undefined) {
              setMotor3(data.mt3 === 'ON' || data.mt3 === 'LIG' || data.mt3 === 1 || data.mt3 === true || String(data.mt3).toUpperCase() === 'ON');
            } else if (data.motor3 !== undefined) {
              setMotor3(data.motor3 === true || data.motor3 === 'ON' || data.motor3 === 1);
            }

            // Motor 4 - AUX Screen Check
            if (data.mt4 !== undefined) {
              setMotor4(data.mt4 === 'ON' || data.mt4 === 'LIG' || data.mt4 === 1 || data.mt4 === true || String(data.mt4).toUpperCase() === 'ON');
            } else if (data.motor4 !== undefined) {
              setMotor4(data.motor4 === true || data.motor4 === 'ON' || data.motor4 === 1);
            }

            if (data.mt5 !== undefined) {
              setMotor5(data.mt5 === 'ON' || data.mt5 === 'LIG' || data.mt5 === 1 || data.mt5 === true || String(data.mt5).toUpperCase() === 'ON');
            }
            if (data.mt6 !== undefined) {
              setMotor6(data.mt6 === 'ON' || data.mt6 === 'LIG' || data.mt6 === 1 || data.mt6 === true || String(data.mt6).toUpperCase() === 'ON');
            }
            if (data.mt7 !== undefined) {
              setMotor7(data.mt7 === 'ON' || data.mt7 === 'LIG' || data.mt7 === 1 || data.mt7 === true || String(data.mt7).toUpperCase() === 'ON');
            }
            if (data.mt8 !== undefined) {
              setMotor8(data.mt8 === 'ON' || data.mt8 === 'LIG' || data.mt8 === 1 || data.mt8 === true || String(data.mt8).toUpperCase() === 'ON');
            }

            // LED program - LED Screen Check
            if (data.led_pg !== undefined) {
              const p = parseInt(data.led_pg);
              setCurrentProgram(isNaN(p) ? '---' : p);
            } else if (data.ledProgram !== undefined) {
              const p = parseInt(data.ledProgram);
              setCurrentProgram(isNaN(p) ? '---' : p);
            } else if (data.pg !== undefined) {
              const p = parseInt(data.pg);
              setCurrentProgram(isNaN(p) ? '---' : p);
            } else if (data.prog !== undefined) {
              const p = parseInt(data.prog);
              setCurrentProgram(isNaN(p) ? '---' : p);
            }

            if (data.led_ctrl !== undefined) {
              if (data.led_ctrl === 'DESL' || data.led_ctrl === 'OFF' || data.led_ctrl === false || data.led_ctrl === 0) {
                setCurrentProgram('---');
              }
            } else if (data.led_state !== undefined) {
              if (data.led_state === 'DESL' || data.led_state === 'OFF' || data.led_state === false || data.led_state === 0) {
                setCurrentProgram('---');
              }
            }

            // LED colors (RGB feedback)
            const rVal = data.r !== undefined ? data.r : (data.red !== undefined ? data.red : (data.pwm_r !== undefined ? data.pwm_r : null));
            const gVal = data.g !== undefined ? data.g : (data.green !== undefined ? data.green : (data.pwm_g !== undefined ? data.pwm_g : null));
            const bVal = data.b !== undefined ? data.b : (data.blue !== undefined ? data.blue : (data.pwm_b !== undefined ? data.pwm_b : null));

            if (rVal !== null && gVal !== null && bVal !== null) {
              const rNum = Number(rVal);
              const gNum = Number(gVal);
              const bNum = Number(bVal);
              currentRgbRef.current = { r: rNum, g: gNum, b: bNum };
              const hsv = rgbToHsv(rNum, gNum, bNum);
              setLedHue(hsv.h);
              setLedSat(hsv.s);
              setLedVal(hsv.v);
              if (iroPickerRef.current && Date.now() - lastUserColorInteractionRef.current > 2000) {
                iroPickerRef.current.color.set({ h: hsv.h, s: hsv.s, v: hsv.v });
              }
            }

            if (data.satMultiplier !== undefined) setSatMultiplier(Number(data.satMultiplier));
            if (data.brightMultiplier !== undefined) setBrightMultiplier(Number(data.brightMultiplier));

            // Device IP / MAC / Model / Serial from JSON
            if (data.ip !== undefined) { setDeviceIp(String(data.ip)); setDeviceOnline(true); lastMessageTimeRef.current = Date.now(); }
            else if (data.deviceIp !== undefined) { setDeviceIp(String(data.deviceIp)); setDeviceOnline(true); lastMessageTimeRef.current = Date.now(); }
            if (data.mac !== undefined) { setDeviceMac(String(data.mac)); setDeviceOnline(true); lastMessageTimeRef.current = Date.now(); }
            else if (data.deviceMac !== undefined) { setDeviceMac(String(data.deviceMac)); setDeviceOnline(true); lastMessageTimeRef.current = Date.now(); }
            if (data.modelo !== undefined) setDeviceModelo(String(data.modelo));
            else if (data.model !== undefined) setDeviceModelo(String(data.model));
            if (data.serial !== undefined) setDeviceSerial(String(data.serial));

            return; // processed successfully as JSON
          } catch (e) {
            console.warn('Payload starts/ends with curly braces but is not valid JSON status:', e);
          }
        }

        // 1. Listen for device status (online / offline)
        if (lowerRelative === 'status' || lowerRelative === 'state') {
          const isOnline = payload === 'online' || payload === '1' || payload.toUpperCase() === 'ON';
          setDeviceOnline(isOnline);
          if (!isOnline) {
            lastMessageTimeRef.current = 0; // Device explicitly told us it is offline
          }
          return;
        }

        // 2. Listen for equipment info topics
        if (lowerRelative === 'info/ip' || lowerRelative === 'ip') {
          setDeviceIp(payload);
          setDeviceOnline(true);
          lastMessageTimeRef.current = Date.now();
          return;
        }
        if (lowerRelative === 'info/mac' || lowerRelative === 'mac') {
          setDeviceMac(payload);
          setDeviceOnline(true);
          lastMessageTimeRef.current = Date.now();
          return;
        }
        if (lowerRelative === 'info/modelo' || lowerRelative === 'modelo') {
          setDeviceModelo(payload);
          return;
        }
        if (lowerRelative === 'info/serial' || lowerRelative === 'serial') {
          setDeviceSerial(payload);
          return;
        }
        
        // 3. Listen for Filtration Timer config
        if (lowerRelative === 'ft/cfg') {
          try {
            const timerData = JSON.parse(payload);
            if (timerData.t1_start !== undefined) {
              setFilterInit1(timerData.t1_start);
            } else if (timerData.start) {
              const startPart = timerData.start.split(':')[0] || '08';
              setFilterInit1(startPart === 'D' ? 'D' : startPart);
            }

            if (timerData.t1_hours !== undefined) {
              setFilterHours1(String(timerData.t1_hours));
            } else if (timerData.hours !== undefined) {
              setFilterHours1(String(timerData.hours));
            }

            if (timerData.t2_start !== undefined) {
              setFilterInit2(timerData.t2_start);
            }
            if (timerData.t2_hours !== undefined) {
              setFilterHours2(String(timerData.t2_hours));
            }
          } catch (err) {
            console.warn('Erro ao decodificar ft/cfg JSON:', err);
          }
          return;
        }

        // 4. Listen for LED Timer config
        if (lowerRelative === 'led/tmr/cfg') {
          try {
            const ledTimerData = JSON.parse(payload);
            if (ledTimerData.start) {
              const parts = ledTimerData.start.split(':');
              if (parts.length >= 1) setLedStartHour(parts[0]);
              if (parts.length >= 2) setLedStartMinute(parts[1]);
            }
            if (ledTimerData.hours !== undefined) {
              setLedDuration(String(ledTimerData.hours));
            }
            if (ledTimerData.program !== undefined) {
              setLedProgram(String(ledTimerData.program));
            }
          } catch (err) {
            console.warn('Erro ao decodificar led/tmr/cfg JSON:', err);
          }
          return;
        }

        // 5. Listen for Hidro Timer config
        if (lowerRelative === 'hidro/tmr/cfg') {
          try {
            const hidroTimerData = JSON.parse(payload);
            const isEnabled = hidroTimerData.enabled === true || (hidroTimerData.enabled !== false && hidroTimerData.hours !== 0 && hidroTimerData.hours !== 'D');
            setHidroTimerEnabled(isEnabled);
            if (!isEnabled) {
              setHidroTimerHours('D');
            } else if (hidroTimerData.hours !== undefined) {
              setHidroTimerHours(String(hidroTimerData.hours) === 'off' ? 'D' : String(hidroTimerData.hours));
            }
          } catch (err) {
            console.warn('Erro ao decodificar hidro/tmr/cfg JSON:', err);
          }
          return;
        }

        // Motor 1 / Hidro
        if (lowerRelative === 'mt1' || lowerRelative === 'mt1/state') {
          setMotorHidro(
            payload.toUpperCase() === 'ON' || 
            payload.toUpperCase() === 'LIG' || 
            payload.toUpperCase() === 'TRUE' ||
            payload === '1'
          );
        }
        // Motor 2 / Filtro
        else if (lowerRelative === 'mt2' || lowerRelative === 'mt2/state') {
          setMotorFiltro(
            payload.toUpperCase() === 'ON' || 
            payload.toUpperCase() === 'LIG' || 
            payload.toUpperCase() === 'TRUE' ||
            payload === '1'
          );
        }
        // Motor 3
        else if (lowerRelative === 'mt3' || lowerRelative === 'mt3/state') {
          setMotor3(
            payload.toUpperCase() === 'ON' || 
            payload.toUpperCase() === 'LIG' || 
            payload.toUpperCase() === 'TRUE' ||
            payload === '1'
          );
        }
        // Motor 4
        else if (lowerRelative === 'mt4' || lowerRelative === 'mt4/state') {
          setMotor4(
            payload.toUpperCase() === 'ON' ||
            payload.toUpperCase() === 'LIG' ||
            payload.toUpperCase() === 'TRUE' ||
            payload === '1'
          );
        }
        else if (lowerRelative === 'mt5' || lowerRelative === 'mt5/state') {
          setMotor5(payload.toUpperCase() === 'ON' || payload.toUpperCase() === 'LIG' || payload.toUpperCase() === 'TRUE' || payload === '1');
        }
        else if (lowerRelative === 'mt6' || lowerRelative === 'mt6/state') {
          setMotor6(payload.toUpperCase() === 'ON' || payload.toUpperCase() === 'LIG' || payload.toUpperCase() === 'TRUE' || payload === '1');
        }
        else if (lowerRelative === 'mt7' || lowerRelative === 'mt7/state') {
          setMotor7(payload.toUpperCase() === 'ON' || payload.toUpperCase() === 'LIG' || payload.toUpperCase() === 'TRUE' || payload === '1');
        }
        else if (lowerRelative === 'mt8' || lowerRelative === 'mt8/state') {
          setMotor8(payload.toUpperCase() === 'ON' || payload.toUpperCase() === 'LIG' || payload.toUpperCase() === 'TRUE' || payload === '1');
        }
        // LED program
        else if (lowerRelative === 'led/pg') {
          const pgVal = parseInt(payload);
          if (!isNaN(pgVal)) {
            setCurrentProgram(pgVal);
          } else if (payload === '---' || payload.toUpperCase() === 'DESL' || payload.toUpperCase() === 'OFF' || payload === '0') {
            setCurrentProgram('---');
          }
        }
        // LED Control
        else if (lowerRelative === 'led/ctrl' || lowerRelative === 'led/state') {
          if (payload.toUpperCase() === 'DESL' || payload.toUpperCase() === 'OFF' || payload === '0') {
            setCurrentProgram('---');
          } else if (payload.toUpperCase() === 'LIG' || payload.toUpperCase() === 'ON' || payload === '1') {
            if (currentProgram === '---') {
              setCurrentProgram(0);
            }
          }
        }
        // LED RGB colors feedback
        else if (lowerRelative === 'pwm/r' || lowerRelative === 'led/r') {
          const num = parseInt(payload);
          if (!isNaN(num)) {
            currentRgbRef.current.r = num;
            if (rgbUpdateTimeoutRef.current) clearTimeout(rgbUpdateTimeoutRef.current);
            rgbUpdateTimeoutRef.current = setTimeout(() => {
              const hsv = rgbToHsv(currentRgbRef.current.r, currentRgbRef.current.g, currentRgbRef.current.b);
              setLedHue(hsv.h);
              setLedSat(hsv.s);
              setLedVal(hsv.v);
              if (iroPickerRef.current && Date.now() - lastUserColorInteractionRef.current > 2000) {
                iroPickerRef.current.color.set({ h: hsv.h, s: hsv.s, v: hsv.v });
              }
            }, 60);
          }
        } else if (lowerRelative === 'pwm/g' || lowerRelative === 'led/g') {
          const num = parseInt(payload);
          if (!isNaN(num)) {
            currentRgbRef.current.g = num;
            if (rgbUpdateTimeoutRef.current) clearTimeout(rgbUpdateTimeoutRef.current);
            rgbUpdateTimeoutRef.current = setTimeout(() => {
              const hsv = rgbToHsv(currentRgbRef.current.r, currentRgbRef.current.g, currentRgbRef.current.b);
              setLedHue(hsv.h);
              setLedSat(hsv.s);
              setLedVal(hsv.v);
              if (iroPickerRef.current && Date.now() - lastUserColorInteractionRef.current > 2000) {
                iroPickerRef.current.color.set({ h: hsv.h, s: hsv.s, v: hsv.v });
              }
            }, 60);
          }
        } else if (lowerRelative === 'pwm/b' || lowerRelative === 'led/b') {
          const num = parseInt(payload);
          if (!isNaN(num)) {
            currentRgbRef.current.b = num;
            if (rgbUpdateTimeoutRef.current) clearTimeout(rgbUpdateTimeoutRef.current);
            rgbUpdateTimeoutRef.current = setTimeout(() => {
              const hsv = rgbToHsv(currentRgbRef.current.r, currentRgbRef.current.g, currentRgbRef.current.b);
              setLedHue(hsv.h);
              setLedSat(hsv.s);
              setLedVal(hsv.v);
              if (iroPickerRef.current && Date.now() - lastUserColorInteractionRef.current > 2000) {
                iroPickerRef.current.color.set({ h: hsv.h, s: hsv.s, v: hsv.v });
              }
            }, 60);
          }
        }
      };

      const options: any = {
        useSSL: isSSL,
        cleanSession: true,
        keepAliveInterval: 45, // Send ping every 45 seconds to keep connection rock-solid
        timeout: 10,            // 10s connect timeout
        onSuccess: () => {
          failedAttemptsRef.current = 0;
          console.log('MQTT Connected Successfully to ' + host + ':' + port);
          setMqttConnected(true);
          setMqttStatusMessage('Conectado');
          setMqttErrorMsg('');
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
          }
          
          const activeCleanId = cleanDeviceId(deviceId);
          const activeEquipment = registeredEquipments.find(eq => eq.id.toLowerCase() === deviceId.toLowerCase());

          // Subscribe to target topics to monitor LED and AUX hardware status
          const relativePaths = [
            'status',
            'info/ip',
            'info/mac',
            'info/modelo',
            'info/serial',
            'mt1',
            'mt2',
            'mt3',
            'mt4',
            'mt1/state',
            'mt2/state',
            'mt3/state',
            'mt4/state',
            'led/pg',
            'led/ctrl',
            'led/state',
            'pwm/r',
            'pwm/g',
            'pwm/b',
            'solar/erro',
            'state',
            'ft/cfg',
            'led/tmr/cfg',
            'hidro/tmr/cfg'
          ];

          const idsToProcess = new Set<string>();
          [activeCleanId, deviceId].forEach((id) => {
            if (id) {
              idsToProcess.add(id);
              if (id.toLowerCase().startsWith('mlz-')) {
                const parts = id.split('-');
                if (parts.length >= 3) {
                  idsToProcess.add(parts.slice(0, 3).join('-'));
                }
                idsToProcess.add(id.substring(4));
              } else {
                idsToProcess.add(`MLZ-${id}`);
              }
            }
          });

          registeredEquipments.forEach((eq) => {
            if (eq && eq.id) {
              const cleanEqId = cleanDeviceId(eq.id);
              [cleanEqId, eq.id].forEach((id) => {
                if (id) {
                  idsToProcess.add(id);
                  if (id.toLowerCase().startsWith('mlz-')) {
                    const parts = id.split('-');
                    if (parts.length >= 3) {
                      idsToProcess.add(parts.slice(0, 3).join('-'));
                    }
                    idsToProcess.add(id.substring(4));
                  } else {
                    idsToProcess.add(`MLZ-${id}`);
                  }
                }
              });
            }
          });

          const topicsToSubscribeSet = new Set<string>();
          const idsToSubscribe = Array.from(idsToProcess);

          idsToSubscribe.forEach((id) => {
            if (!id) return;
            const cleanId = cleanDeviceId(id);
            if (cleanId) {
              topicsToSubscribeSet.add(`MLZ/${cleanId}/#`);
            }
            if (id && id !== cleanId) {
              topicsToSubscribeSet.add(`MLZ/${id}/#`);
            }
          });

          const topicsToSubscribe = Array.from(topicsToSubscribeSet);

          topicsToSubscribe.forEach((t) => {
            try {
              client.subscribe(t);
              console.log(`Subscribed to status channel: ${t}`);
            } catch (err) {
              console.warn(`Subscription failed for ${t}:`, err);
            }
          });

          // Send a single query command on connect to request status update from hardware
          const queryTopicsSet = new Set<string>();
          Array.from(idsToProcess).forEach((id) => {
            if (!id) return;
            const cleanId = cleanDeviceId(id);
            if (cleanId) {
              queryTopicsSet.add(`MLZ/${cleanId}/cmd`);
            }
          });

          const queryTopics = Array.from(queryTopicsSet);

          queryTopics.forEach((qt) => {
            try {
              const msg = new window.Paho.MQTT.Message('STATUS');
              msg.destinationName = qt;
              recordOutboundPublish(qt, 'STATUS');
              client.send(msg);
            } catch (err) {
              console.warn(`Initial query failed on ${qt}:`, err);
            }
          });
        },
        onFailure: (err: any) => {
          console.warn('MQTT Connection Failure:', err);
          setMqttConnected(false);
          setMqttStatusMessage('Falha na Conectividade');
          
          let friendlyMsg = 'Não foi possível conectar ao broker.';
          if (err && typeof err === 'object') {
            if (err.errorMessage) {
              friendlyMsg += ` Detalhes: ${err.errorMessage}`;
            } else if (err.message) {
              friendlyMsg += ` Detalhes: ${err.message}`;
            } else {
              try {
                const str = JSON.stringify(err);
                if (str !== '{}') friendlyMsg += ` Detalhes: ${str}`;
              } catch (e) {}
            }
            if (err.errorCode) friendlyMsg += ` (Erro: ${err.errorCode})`;
          } else if (err) {
            friendlyMsg += ` Detalhes: ${err}`;
          }

          failedAttemptsRef.current += 1;

          // Auto-failover broker if connection fails multiple times
          if (failedAttemptsRef.current >= 2) {
            const currentIdx = FALLBACK_BROKERS.findIndex(b => b.broker.toLowerCase() === host.toLowerCase());
            const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % FALLBACK_BROKERS.length : 0;
            const nextBroker = FALLBACK_BROKERS[nextIdx];
            console.warn(`MQTT auto-failover activated. Switching to backup broker: ${nextBroker.broker}:${nextBroker.port}`);
            setMqttBroker(nextBroker.broker);
            setMqttPort(nextBroker.port);
            try {
              localStorage.setItem('mqtt_broker', nextBroker.broker);
              localStorage.setItem('mqtt_port', nextBroker.port);
            } catch (e) {}
            friendlyMsg += ` Alternando automaticamente para servidor reserva (${nextBroker.broker}:${nextBroker.port})...`;
          } else {
            friendlyMsg += ' Reconectando automaticamente...';
          }

          setMqttErrorMsg(friendlyMsg);

          // Retry connection if user wants connectivity
          if (userWantsMqttRef.current) {
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = setTimeout(() => {
              console.log('Automated Reconnection onFailure target triggered...');
              connectMQTT();
            }, 3000);
          }
        }
      };

      if (mqttUser.trim()) {
        options.userName = mqttUser.trim();
      }
      if (mqttPassword.trim()) {
        options.password = mqttPassword.trim();
      }

      client.connect(options);
    } catch (err: any) {
      setMqttConnected(false);
      setMqttStatusMessage('Erro de inicialização');
      setMqttErrorMsg(err.message || 'Erro sintático de broker.');
    }
  };

  const disconnectMQTT = (isTemporary?: boolean | any) => {
    const isTemp = isTemporary === true;
    if (!isTemp) {
      setUserWantsMqtt(false); // User intentionally disconnected
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (mqttClientRef.current) {
      try {
        if (mqttClientRef.current.isConnected()) {
          mqttClientRef.current.disconnect();
        }
      } catch (e) {
        console.warn('Ignored clean disconnect exception:', e);
      }
      mqttClientRef.current = null;
    }
    setMqttConnected(false);
    setMqttStatusMessage(isTemporary ? 'Reconectando...' : 'Desconectado');
  };

  const forceReconnectMQTT = () => {
    console.log('Force reconnecting MQTT to stabilize connection...');
    disconnectMQTT(true);
    setTimeout(() => {
      connectMQTT();
    }, 300);
  };

  function publishTopic(subTopic: string, payload: string, options?: { qos?: number; retained?: boolean }) {
    const isConn = mqttClientRef.current && typeof mqttClientRef.current.isConnected === 'function' && mqttClientRef.current.isConnected();

    if (isConn && subTopic) {
      try {
        const rawId = (deviceId || '').trim();
        const cleanId = cleanDeviceId(deviceId).trim() || rawId;

        let relativePath = subTopic.trim();
        if (relativePath.toUpperCase().startsWith('MASTERLAZER/')) {
          relativePath = relativePath.substring('MASTERLAZER/'.length);
        } else if (relativePath.toUpperCase().startsWith('MLZ/')) {
          relativePath = relativePath.substring('MLZ/'.length);
        }

        // If relative path starts with MLZ- or MASTERLAZER-, strip it
        if (relativePath.toUpperCase().startsWith('MLZ-')) {
          relativePath = relativePath.substring(4);
        } else if (relativePath.toUpperCase().startsWith('MASTERLAZER-')) {
          relativePath = relativePath.substring(12);
        }

        if (rawId && cleanId && rawId !== cleanId) {
          relativePath = relativePath.replace(new RegExp(escapeRegExp(rawId), 'gi'), cleanId);
        }

        const targetTopic = `MLZ/${relativePath}`;

        const message = new window.Paho.MQTT.Message(payload);
        message.destinationName = targetTopic;
        if (typeof options?.qos === 'number') message.qos = options.qos;
        if (typeof options?.retained === 'boolean') message.retained = options.retained;
        recordOutboundPublish(targetTopic, payload);
        mqttClientRef.current.send(message);
        console.log(`MQTT Published topic [${targetTopic}]: ${payload}`);
      } catch (err) {
        console.warn('Publish error:', err);
      }
    } else if (!isConn) {
      console.warn('App Warning: MQTT client is offline. Skipping write operation on topic:', subTopic);
      if (userWantsMqttRef.current && (!mqttClientRef.current || !mqttConnected)) {
        console.log('Publish attempted while offline. Triggering MQTT reconnect...');
        connectMQTT();
      }
    }
  }

  /**
   * Send OTA URL using the SAME publish path as motors/LED/cmd (proven to reach the ESP).
   * Firmware that doesn't handle `/ota` still usually logs everything on `/cmd`.
   */
  function publishOtaUrlToDevice(equipmentId: string, otaUrl: string) {
    const rawId = (equipmentId || '').trim();
    if (!rawId) return;

    const cleanId = cleanDeviceId(rawId).trim() || rawId;
    const opts = { qos: 1 as const, retained: false };

    // 1) /cmd — same channel as STATUS (most likely to appear on Serial Monitor)
    publishTopic(`MLZ/${cleanId}/cmd`, otaUrl, opts);
    publishTopic(`MLZ/${cleanId}/cmd`, `OTA ${otaUrl}`, opts);
    publishTopic(`MLZ/${cleanId}/cmd`, `UPDATE ${otaUrl}`, opts);
    publishTopic(
      `MLZ/${cleanId}/cmd`,
      JSON.stringify({ cmd: 'ota', url: otaUrl }),
      opts
    );

    // 2) Dedicated OTA topics (if firmware already listens for them)
    publishTopic(`MLZ/${cleanId}/ota`, otaUrl, opts);
    publishTopic(`MLZ/${cleanId}/ota/url`, otaUrl, opts);
    publishTopic(`MLZ/${cleanId}/update`, otaUrl, opts);

    console.log(`[OTA] Published to MLZ/${cleanId}/cmd (+ ota topics):`, otaUrl);
  }

  const logUserAction = (actionName: string) => {
    try {
      const email = currentUser?.email || 'anonimo@pool.com';
      const newLog = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        email,
        action: actionName,
        deviceId: deviceId || 'MASTERLAZER'
      };
      const updated = [newLog, ...userLogs].slice(0, 200);
      setUserLogs(updated);
    } catch (e) {
      console.error("Error logging action:", e);
    }
  };

  const handleAddUserAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('Aviso de Cadastro', 'Novos usuários devem cadastrar-se pela tela de Login ("Criar nova conta"). Após cadastrados, altere o nível de acesso abaixo.', 'info');
    setUserModalOpen(null);
  };

  const handleUpdateUserAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForEdit) return;

    const role = userFormRole; // owner, admin, support, operator, installer, factory

    try {
      await updateProfileRole(selectedUserForEdit.uid, role);
      
      // Reload list
      const profiles = await fetchAllProfiles();
      setSimUsers(profiles.map(p => ({
        uid: p.id,
        email: p.email,
        full_name: p.full_name,
        role: p.role
      })));
      
      logUserAction(`Alterou permissão do usuário: ${selectedUserForEdit.email} para ${role}`);
      
      // If edited self, update currentUser state
      if (currentUser && currentUser.uid === selectedUserForEdit.uid) {
        const updatedSelf = { ...currentUser, role };
        setCurrentUser(updatedSelf);
      }

      setSelectedUserForEdit(null);
      setUserFormEmail('');
      setUserFormPassword('');
      setUserFormRole('operator');
      setUserModalOpen(null);
    } catch (err: any) {
      showToast('Erro ao atualizar perfil', err.message, 'error');
    }
  };

  const handleDeleteUserAdmin = async (uid: string) => {
    if (currentUser && currentUser.uid === uid) {
      showToast('Ação Inválida', 'Você não pode remover a si mesmo!', 'warning');
      return;
    }

    const targetUser = simUsers.find(u => u.uid === uid);
    if (!targetUser) return;

    if (targetUser.role === 'owner') {
      showToast('Ação Inválida', 'Contas owner não podem ser desativadas por esta ação.', 'warning');
      return;
    }

    if (!confirm(`Desativar a conta de ${targetUser.email}?\n\nIsso fará soft delete (status=deleted), marcará a data, desativará os equipamentos do usuário e registrará o evento na auditoria.`)) {
      return;
    }

    try {
      const ok = await deleteProfile(uid);
      if (!ok) {
        showToast(
          'Falha ao desativar',
          'Não foi possível desativar a conta no servidor (apenas operators ativos).',
          'error'
        );
        return;
      }

      const profiles = await fetchAllProfiles();
      setSimUsers(profiles.map(p => ({
        uid: p.id,
        email: p.email,
        full_name: p.full_name,
        role: p.role
      })));

      // Refresh admin devices list (operator devices were soft-deleted too)
      await loadAdminAllDevices();
      await loadAuditEvents();

      logUserAction(`Desativou conta (soft delete): ${targetUser.email}`);
    } catch (err: any) {
      showToast('Erro ao remover usuário', err.message, 'error');
    }
  };

  const handleCreateCatalogItem = async () => {
    console.info('[Catalog] handleCreateCatalogItem clicked', {
      role: currentUser?.role,
      isSupabase: currentUser?.isSupabase,
      configured: isSupabaseConfigured(),
      model: catalogModel,
      motors: catalogMotorCount,
    });

    if (currentUser?.role !== 'owner') {
      showToast('Sem permissão', 'Apenas o proprietário (owner) pode cadastrar modelos no catálogo.', 'warning');
      return;
    }
    if (!isSupabaseConfigured() || !currentUser?.isSupabase) {
      showToast('Supabase necessário', 'Conecte-se ao Supabase para gerenciar o catálogo.', 'warning');
      return;
    }

    const model = catalogModel.trim().toUpperCase();
    const motorCount = Number(catalogMotorCount);
    if (!model) {
      showToast('Campo Obrigatório', 'Informe o modelo do equipamento.', 'warning');
      return;
    }
    if (!Number.isInteger(motorCount) || motorCount < 0 || motorCount > 8) {
      showToast('Quantidade Inválida', 'A quantidade de motores deve ser de 0 a 8.', 'warning');
      return;
    }

    setCatalogSaving(true);
    try {
      console.info('[Catalog] Calling createDeviceCatalogItem...');
      await createDeviceCatalogItem(
        model,
        motorCount,
        catalogHasFilterTimer,
        catalogHasLedTimer,
        catalogHasHidroTimer,
        catalogHasSolarHeating
      );

      await loadDeviceCatalogFromSupabase();

      setCatalogModel('');
      setCatalogMotorCount('2');
      setCatalogHasFilterTimer(true);
      setCatalogHasLedTimer(true);
      setCatalogHasHidroTimer(true);
      setCatalogHasSolarHeating(true);

    } catch (err: any) {
      console.error('[Catalog] create failed:', err);
      showToast(
        'Erro ao salvar no Supabase',
        err?.message || err?.error_description || 'Não foi possível adicionar o modelo ao catálogo.',
        'error'
      );
    } finally {
      setCatalogSaving(false);
    }
  };

  const handleStartEditCatalogItem = (item: DeviceCatalogItem) => {
    setEditingCatalogItem(item);
    setEditModelName(item.model);
    setEditMotorCount(String(item.motor_count));
    setEditHasFilterTimer(item.has_filter_timer === true);
    setEditHasLedTimer(item.has_led_timer === true);
    setEditHasHidroTimer(item.has_hidro_timer === true);
    setEditHasSolarHeating(item.has_solar_heating === true);
  };

  const handleSaveEditCatalogItem = async () => {
    if (!editingCatalogItem) return;
    if (!isSupabaseConfigured() || !currentUser?.isSupabase) {
      showToast('Supabase necessário', 'Conecte-se ao Supabase para gerenciar o catálogo.', 'warning');
      return;
    }

    const model = editModelName.trim().toUpperCase();
    const motorCount = Number(editMotorCount);
    if (!model) {
      showToast('Campo Obrigatório', 'Informe o modelo do equipamento.', 'warning');
      return;
    }
    if (!Number.isInteger(motorCount) || motorCount < 0 || motorCount > 8) {
      showToast('Quantidade Inválida', 'A quantidade de motores deve ser de 0 a 8.', 'warning');
      return;
    }

    setCatalogSaving(true);
    try {
      await updateDeviceCatalogItem(
        editingCatalogItem.id,
        model,
        motorCount,
        editHasFilterTimer,
        editHasLedTimer,
        editHasHidroTimer,
        editHasSolarHeating
      );

      await loadDeviceCatalogFromSupabase();
      setEditingCatalogItem(null);
    } catch (err: any) {
      console.error('[Catalog] update failed:', err);
      showToast(
        'Erro ao atualizar no Supabase',
        err?.message || err?.error_description || 'Não foi possível atualizar o modelo.',
        'error'
      );
    } finally {
      setCatalogSaving(false);
    }
  };

  const handleDeleteCatalogItem = async (item: DeviceCatalogItem) => {
    if (currentUser?.role !== 'owner') return;
    if (!isSupabaseConfigured() || !currentUser?.isSupabase) {
      showToast('Supabase necessário', 'Conecte-se ao Supabase para gerenciar o catálogo.', 'warning');
      return;
    }
    if (!confirm(`Remover o modelo ${item.model} do catálogo?`)) return;

    try {
      await deleteDeviceCatalogItem(item.id);
      await loadDeviceCatalogFromSupabase();
    } catch (err: any) {
      showToast(
        'Erro ao Remover Modelo',
        err?.code === '23503'
          ? 'Este modelo não pode ser removido porque existem equipamentos vinculados a ele.'
          : err?.message || 'Não foi possível remover o modelo do catálogo.',
        'error'
      );
    }
  };

  const refreshFirmwareList = async () => {
    setFirmwareLoading(true);
    try {
      const items =
        currentUser?.role === 'owner' || currentUser?.role === 'admin' || currentUser?.role === 'support'
          ? await fetchAllFirmware()
          : await fetchActiveFirmware();
      setFirmwareList(items);
    } finally {
      setFirmwareSaving(false);
      setFirmwareLoading(false);
    }
  };

  const resetFirmwareForm = () => {
    setFirmwareEditingId(null);
    setFirmwareModel('');
    setFirmwareNome('');
    setFirmwareVersao('');
    setFirmwareFile(null);
  };

  const handleUploadFirmware = async () => {
    if (
      currentUser?.role !== 'owner' &&
      currentUser?.role !== 'admin' &&
      currentUser?.role !== 'support'
    ) {
      return;
    }

    const model = firmwareModel.trim().toUpperCase();
    if (!model || !firmwareNome.trim() || !firmwareVersao.trim()) {
      showToast('Campos Obrigatórios', 'Informe modelo, nome e versão do firmware.', 'warning');
      return;
    }
    if (!firmwareFile && !firmwareEditingId) {
      showToast('Arquivo Obrigatório', 'Selecione o arquivo .bin para enviar.', 'warning');
      return;
    }

    setFirmwareSaving(true);
    try {
      if (firmwareEditingId) {
        await updateFirmware({
          id: firmwareEditingId,
          nome: firmwareNome,
          versao: firmwareVersao,
          file: firmwareFile || undefined,
          uploadedBy: currentUser?.uid,
        });
      } else {
        if (!firmwareFile) return;
        await uploadFirmware({
          model,
          nome: firmwareNome,
          versao: firmwareVersao,
          file: firmwareFile,
          uploadedBy: currentUser?.uid,
        });
      }
      resetFirmwareForm();
      await refreshFirmwareList();
    } catch (err: any) {
      showToast('Erro no Firmware', err?.message || 'Não foi possível salvar o firmware.', 'error');
      setFirmwareSaving(false);
    }
  };

  const handleStartEditFirmware = (item: FirmwareItem) => {
    setFirmwareEditingId(item.id);
    setFirmwareModel(item.model);
    setFirmwareNome(item.nome);
    setFirmwareVersao(item.versao);
    setFirmwareFile(null);
    setAdminTab('firmware');
  };

  const handleOperatorFirmwareUpdate = async (item: FirmwareItem) => {
    setFirmwareUpdatingModel(item.model);
    try {
      const modelKey = item.model.trim().toUpperCase();
      const targets = registeredEquipments.filter(
        (eq) => (eq.model || '').trim().toUpperCase() === modelKey
      );

      if (targets.length === 0) {
        showToast('Sem equipamento', `Nenhum equipamento do modelo ${item.model} encontrado.`, 'warning');
        return;
      }

      const isConn =
        mqttClientRef.current &&
        typeof mqttClientRef.current.isConnected === 'function' &&
        mqttClientRef.current.isConnected();

      if (!isConn) {
        showToast('MQTT offline', 'Conecte o MQTT antes de enviar a atualização OTA.', 'warning');
        if (userWantsMqttRef.current) {
          connectMQTT();
        }
        return;
      }

      // Prefer the active device when it matches this firmware model (what you're watching on Serial).
      const activeMatch = targets.find((eq) => areDeviceIdsMatching(eq.id, deviceId));
      const publishTargets = activeMatch
        ? [activeMatch, ...targets.filter((eq) => !areDeviceIdsMatching(eq.id, activeMatch.id))]
        : targets;

      const otaUrl = await createOtaUpdateUrl(item);
      const primaryId = cleanDeviceId(publishTargets[0].id).trim() || publishTargets[0].id;
      console.log('[OTA] URL:', otaUrl, '| primary topic base: MLZ/' + primaryId);

      for (const eq of publishTargets) {
        publishOtaUrlToDevice(eq.id, otaUrl);
      }

      logUserAction(`OTA ${item.model} v${item.versao}`);
    } catch (err: any) {
      showToast('Erro na Atualização', err?.message || 'Não foi possível iniciar o OTA.', 'error');
    } finally {
      setFirmwareUpdatingModel(null);
    }
  };

  const operatorFirmwareUpdates = (() => {
    const userModels = new Set(
      registeredEquipments.map((eq) => (eq.model || '').trim().toUpperCase()).filter(Boolean)
    );
    return firmwareList.filter(
      (fw) => fw.is_active && userModels.has(fw.model.trim().toUpperCase())
    );
  })();

  const setMotorName = (motorNum: MotorNumber, newName: string) => {
    const setters: Record<MotorNumber, React.Dispatch<React.SetStateAction<string>>> = {
      1: setMotor1Name,
      2: setMotor2Name,
      3: setMotor3Name,
      4: setMotor4Name,
      5: setMotor5Name,
      6: setMotor6Name,
      7: setMotor7Name,
      8: setMotor8Name,
    };
    setters[motorNum](newName);
  };

  const persistMotorName = async (motorNum: MotorNumber, newName: string) => {
    if (!isSupabaseConfigured() || !currentUser?.isSupabase || !deviceId) {
      setMotorSettingsSaveState('idle');
      return;
    }

    if (!canConfigureActiveDevice) {
      setMotorSettingsSaveState('error');
      showToast('Sem permissão', 'Você tem acesso só de controle neste equipamento compartilhado.', 'warning');
      return;
    }

    setMotorSettingsSaveState('saving');
    const column = `motor${motorNum}_name` as
      | 'motor1_name'
      | 'motor2_name'
      | 'motor3_name'
      | 'motor4_name'
      | 'motor5_name'
      | 'motor6_name'
      | 'motor7_name'
      | 'motor8_name';
    const savedSettings = await saveDeviceSettings(deviceId, { [column]: newName });
    setMotorSettingsSaveState(savedSettings ? 'saved' : 'error');
  };

  const handleUpdateMotorName = (motorNum: MotorNumber, newName: string) => {
    if (!canConfigureActiveDevice) {
      showToast('Sem permissão', 'Seu acesso é só de controle — não é possível editar nomes.', 'warning');
      return;
    }
    setMotorName(motorNum, newName);
    localStorage.setItem(`${deviceId}_motor${motorNum}_name`, newName);

    const pendingTimer = motorNameSaveTimersRef.current[motorNum];
    if (pendingTimer) clearTimeout(pendingTimer);

    setMotorSettingsSaveState('saving');
    motorNameSaveTimersRef.current[motorNum] = setTimeout(() => {
      delete motorNameSaveTimersRef.current[motorNum];
      void persistMotorName(motorNum, newName);
    }, 500);
  };

  const flushMotorNameUpdate = (motorNum: MotorNumber, newName: string) => {
    if (!canConfigureActiveDevice) return;
    const pendingTimer = motorNameSaveTimersRef.current[motorNum];
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      delete motorNameSaveTimersRef.current[motorNum];
    }
    void persistMotorName(motorNum, newName);
  };

  // 7. Interactive action button tasks
  const handleMotorChange = (motorNum: MotorNumber, checked: boolean) => {
    const setters: Record<MotorNumber, React.Dispatch<React.SetStateAction<boolean>>> = {
      1: setMotorHidro,
      2: setMotorFiltro,
      3: setMotor3,
      4: setMotor4,
      5: setMotor5,
      6: setMotor6,
      7: setMotor7,
      8: setMotor8,
    };
    const names: Record<MotorNumber, string> = {
      1: motor1Name,
      2: motor2Name,
      3: motor3Name,
      4: motor4Name,
      5: motor5Name,
      6: motor6Name,
      7: motor7Name,
      8: motor8Name,
    };

    setters[motorNum](checked);
    const payloadON_OFF = checked ? 'ON' : 'OFF';
    logUserAction(`Togglou ${names[motorNum]} para ${checked ? 'LIGADO' : 'DESLIGADO'}`);

    const cleanId = cleanDeviceId(deviceId).trim() || deviceId.trim();

    // Primary topic expected by ESP32 hardware
    publishTopic(`MLZ/${cleanId}/mt${motorNum}`, payloadON_OFF);
  };

  // LED Commands
  const handleProgramInc = () => {
    let nextProg = 0;
    if (currentProgram === '---') {
      nextProg = 1;
    } else {
      const currentVal = typeof currentProgram === 'number' ? currentProgram : parseInt(String(currentProgram), 10);
      if (isNaN(currentVal)) {
        nextProg = 1;
      } else if (currentVal < 25) {
        nextProg = currentVal + 1;
      } else {
        return; // Cap at 25
      }
    }
    setCurrentProgram(nextProg);
    const cleanId = cleanDeviceId(deviceId).trim() || deviceId.trim();
    publishTopic(`MLZ/${cleanId}/led/ctrl`, "INC");
  };

  const handleProgramDec = () => {
    let prevProg = 0;
    if (currentProgram === '---') {
      prevProg = 0;
    } else {
      const currentVal = typeof currentProgram === 'number' ? currentProgram : parseInt(String(currentProgram), 10);
      if (isNaN(currentVal) || currentVal <= 0) {
        prevProg = 0; // Cap at 0
      } else {
        prevProg = currentVal - 1;
      }
    }
    setCurrentProgram(prevProg);
    const cleanId = cleanDeviceId(deviceId).trim() || deviceId.trim();
    publishTopic(`MLZ/${cleanId}/led/ctrl`, "DEC");
  };

  const handleDirectProgramSelect = (progNum: number) => {
    setCurrentProgram(progNum);
    const cleanId = cleanDeviceId(deviceId).trim() || deviceId.trim();
    publishTopic(`MLZ/${cleanId}/led/pg`, String(progNum));
  };

  const handleProgramOff = () => {
    setCurrentProgram('---');
    const cleanId = cleanDeviceId(deviceId).trim() || deviceId.trim();
    publishTopic(`MLZ/${cleanId}/led/ctrl`, "OFF");
  };

  const handleProgramSave = () => {
    const cleanId = cleanDeviceId(deviceId).trim() || deviceId.trim();
    publishTopic(`MLZ/${cleanId}/led/ctrl`, "SAVE");
  };

  // Save Timers
  const handleSaveFilter = () => {
    localStorage.setItem('filter_init1', filterInit1);
    localStorage.setItem('filter_hours1', filterHours1);
    localStorage.setItem('filter_init2', filterInit2);
    localStorage.setItem('filter_hours2', filterHours2);
    localStorage.setItem('filter_days', JSON.stringify(filterDays));

    // For legacy/backward compatibility:
    localStorage.setItem('filter_start_hour', filterInit1 === 'D' ? '08' : filterInit1);
    localStorage.setItem('filter_hours', filterHours1);

    // Persist to Supabase device_settings (also writes audit_events via DB trigger)
    if (isSupabaseConfigured() && currentUser?.isSupabase && deviceId) {
      void saveDeviceSettings(deviceId, {
        filter_init1: filterInit1,
        filter_hours1: filterHours1,
        filter_init2: filterInit2,
        filter_hours2: filterHours2,
        filter_days: filterDays,
      });
    }

    const isModelMM12TW = activeModel === 'MM12TW';
    const targetMotor = isModelMM12TW ? 'mt2' : 'mt4';

    const formatHour = (val: string) => {
      if (!val || val === 'D' || val === 'off') return 'D';
      return val.includes(':') ? val : `${val.padStart(2, '0')}:00`;
    };

    const t1StartFormatted = formatHour(filterInit1);
    const t2StartFormatted = formatHour(filterInit2);

    // Build core JSON with Timer 1 & Timer 2 parameters
    const coreJson = {
      t1_start: t1StartFormatted,
      t1_hours: filterInit1 === 'D' ? 0 : parseInt(filterHours1) || 4,
      t2_start: t2StartFormatted,
      t2_hours: filterInit2 === 'D' ? 0 : parseInt(filterHours2) || 4,
      start: t1StartFormatted,
      hours: filterInit1 === 'D' ? 0 : parseInt(filterHours1) || 4,
      target_motor: targetMotor
    };

    const dayLabels = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
    const selectedDaysList = filterDays
      .map((active, index) => (active ? dayLabels[index] : ''))
      .filter(Boolean)
      .join(',');
    const daysBinary = filterDays.map(d => d ? '1' : '0').join('');

    const extendedData = {
      ...coreJson,
      inicio: t1StartFormatted,
      horas: filterInit1 === 'D' ? 0 : parseInt(filterHours1) || 4,
      duration: filterInit1 === 'D' ? 0 : parseInt(filterHours1) || 4,
      days: filterDays,
      days_binary: daysBinary,
      active_days_str: selectedDaysList
    };

    const cleanId = cleanDeviceId(deviceId).trim() || deviceId.trim();

    const jsonString = JSON.stringify(extendedData);

    // 1. JSON configuration sent to filter topic AND target motor timer topic (mt2/timer/cfg or mt4/timer/cfg)
    publishTopic(`MLZ/${cleanId}/ft/cfg`, jsonString);
    publishTopic(`MLZ/${cleanId}/${targetMotor}/timer/cfg`, jsonString);

    // 2. Individual parameter topics for maximum ESP32 firmware compatibility
    publishTopic(`MLZ/${cleanId}/ft/t1/start`, t1StartFormatted);
    publishTopic(`MLZ/${cleanId}/ft/t1/hours`, String(filterInit1 === 'D' ? 0 : parseInt(filterHours1) || 4));
    publishTopic(`MLZ/${cleanId}/ft/t2/start`, t2StartFormatted);
    publishTopic(`MLZ/${cleanId}/ft/t2/hours`, String(filterInit2 === 'D' ? 0 : parseInt(filterHours2) || 4));
    publishTopic(`MLZ/${cleanId}/ft/days/binary`, daysBinary);

    publishTopic(`MLZ/${cleanId}/${targetMotor}/timer/t1/start`, t1StartFormatted);
    publishTopic(`MLZ/${cleanId}/${targetMotor}/timer/t1/hours`, String(filterInit1 === 'D' ? 0 : parseInt(filterHours1) || 4));
    publishTopic(`MLZ/${cleanId}/${targetMotor}/timer/t2/start`, t2StartFormatted);
    publishTopic(`MLZ/${cleanId}/${targetMotor}/timer/t2/hours`, String(filterInit2 === 'D' ? 0 : parseInt(filterHours2) || 4));
    publishTopic(`MLZ/${cleanId}/${targetMotor}/timer/days/binary`, daysBinary);

    // Also update current legacy state for reactivity in other components
    const legacyStart = filterInit1 === 'D' ? 'D' : `${filterInit1.padStart(2, '0')}:00`;
    setFilterInit(legacyStart);
    setFilterHours(filterHours1);

    logUserAction(`Configurou Filtração: T1: ${filterInit1}h(${filterHours1}h), T2: ${filterInit2}h(${filterHours2}h), Dias: ${selectedDaysList || 'Nenhum'}`);
  };

  const handleSaveLedTimer = () => {
    localStorage.setItem('led_start_hour', ledStartHour);
    localStorage.setItem('led_start_minute', ledStartMinute);
    localStorage.setItem('led_duration', ledDuration);
    localStorage.setItem('led_program', ledProgram);

    if (isSupabaseConfigured() && currentUser?.isSupabase && deviceId) {
      void saveDeviceSettings(deviceId, {
        led_start_hour: ledStartHour,
        led_start_minute: ledStartMinute,
        led_duration: ledDuration,
        led_program: ledProgram,
      });
    }

    const formattedHour = ledStartHour.padStart(2, '0');
    const formattedMinute = ledStartMinute.padStart(2, '0');
    const startingTime = `${formattedHour}:${formattedMinute}`;

    // Detailed JSON options supporting multi-language keys
    const data = {
      start: startingTime,
      hours: parseInt(ledDuration) || 4,
      program: parseInt(ledProgram) || 0
    };

    const cleanId = cleanDeviceId(deviceId).trim() || deviceId.trim();
    publishTopic(`MLZ/${cleanId}/led/tmr/cfg`, JSON.stringify(data));

    logUserAction(`Configurou Timer LED: Início ${startingTime}, Duração: ${ledDuration}h, Programa: ${ledProgram}`);
  };

  const handleSaveHidroTimer = () => {
    const isEnabled = hidroTimerHours !== 'D' && hidroTimerHours !== 'off';
    const hoursVal = isEnabled ? hidroTimerHours : 'D';

    setHidroTimerEnabled(isEnabled);

    localStorage.setItem('hidro_timer_enabled', String(isEnabled));
    localStorage.setItem('hidro_timer_hours', hoursVal);

    if (isSupabaseConfigured() && currentUser?.isSupabase && deviceId) {
      void saveDeviceSettings(deviceId, {
        hidro_timer_enabled: isEnabled,
        hidro_timer_hours: hoursVal,
      });
    }

    const data = {
      enabled: isEnabled,
      hours: isEnabled ? parseInt(hoursVal, 10) || 1 : 0,
      bomba: 'mt1'
    };

    const cleanId = cleanDeviceId(deviceId).trim() || deviceId.trim();
    const jsonStr = JSON.stringify(data);

    publishTopic(`MLZ/${cleanId}/hidro/tmr/cfg`, jsonStr);
    publishTopic(`MLZ/${cleanId}/mt1/timer/cfg`, jsonStr);
    publishTopic(`MLZ/${cleanId}/hidro/tmr/hours`, String(data.hours));
    publishTopic(`MLZ/${cleanId}/mt1/timer/hours`, String(data.hours));

    logUserAction(`Configurou Timer Hidro (${motor1Name}): ${isEnabled ? `Ativo (${hoursVal}h)` : 'Desligado'}`);
  };

  // Start the QR Code Scanner camera
  const startQrScanner = async () => {
    setQrScannerError(null);
    setScannedData(null);
    setIsScanningQr(true);

    try {
      const { Html5Qrcode } = await import('html5-qrcode');

      // Wait for the #qr-reader element to mount
      await new Promise((resolve) => setTimeout(resolve, 300));

      const scannerElement = document.getElementById('qr-reader');
      if (!scannerElement) {
        setQrScannerError('Elemento de visualização da câmera não encontrado.');
        setIsScanningQr(false);
        return;
      }

      // Stop any previous scanner instance before starting a new one
      if (qrScannerRef.current) {
        try {
          await qrScannerRef.current.stop();
        } catch {
          // ignore
        }
        qrScannerRef.current = null;
      }

      let cameras: Array<{ id: string; label: string }> = [];
      try {
        cameras = await Html5Qrcode.getCameras();
      } catch {
        cameras = [];
      }

      if (!cameras || cameras.length === 0) {
        setQrScannerError(
          'Nenhuma câmera encontrada neste dispositivo. Conecte uma webcam ou use um celular com câmera para escanear o QR Code.'
        );
        setIsScanningQr(false);
        return;
      }

      // Prefer back/environment camera; otherwise use the first available device
      const preferred =
        cameras.find((cam) => /back|rear|traseira|environment|posterior/i.test(cam.label)) ||
        cameras[cameras.length - 1] ||
        cameras[0];

      const html5QrCode = new Html5Qrcode('qr-reader');
      qrScannerRef.current = html5QrCode;

      const config = {
        fps: 10,
        qrbox: (width: number, height: number) => {
          const size = Math.min(width, height) * 0.7;
          return { width: size, height: size };
        },
        aspectRatio: 1.0,
      };

      const onSuccess = (decodedText: string) => {
        handleQrCodeScanned(decodedText);
      };
      const onFailure = () => {
        // ignore frame-level decode misses
      };

      try {
        await html5QrCode.start(preferred.id, config, onSuccess, onFailure);
      } catch (primaryErr) {
        // Fallback: try facingMode variants when deviceId start fails
        const errText = String(primaryErr);
        const isMissingDevice =
          errText.includes('NotFoundError') ||
          errText.includes('Requested device not found') ||
          errText.includes('OverconstrainedError');

        if (!isMissingDevice) {
          throw primaryErr;
        }

        let started = false;
        for (const cameraConfig of [{ facingMode: 'environment' }, { facingMode: 'user' }, cameras[0].id] as const) {
          try {
            await html5QrCode.start(cameraConfig as any, config, onSuccess, onFailure);
            started = true;
            break;
          } catch {
            // try next option
          }
        }

        if (!started) {
          throw primaryErr;
        }
      }
    } catch (err) {
      const errText = String(err);
      let userFriendlyMsg = 'Erro ao acessar a câmera. Verifique as permissões do navegador.';

      if (errText.includes('NotAllowedError') || errText.includes('Permission')) {
        userFriendlyMsg =
          'Permissão de câmera negada. Ative a câmera nas configurações do navegador e tente novamente.';
      } else if (
        errText.includes('NotFoundError') ||
        errText.includes('Requested device not found') ||
        errText.includes('OverconstrainedError')
      ) {
        userFriendlyMsg =
          'Nenhuma câmera compatível encontrada. Use um dispositivo com câmera ou conecte uma webcam.';
      } else if (errText.includes('NotReadableError') || errText.includes('TrackStartError')) {
        userFriendlyMsg =
          'A câmera está em uso por outro aplicativo. Feche-o e tente novamente.';
      }

      setQrScannerError(userFriendlyMsg);
      setIsScanningQr(false);
      qrScannerRef.current = null;
    }
  };

  // Stop the QR Code Scanner camera
  const stopQrScanner = async () => {
    if (qrScannerRef.current) {
      try {
        await qrScannerRef.current.stop();
      } catch (e) {
        console.warn('Erro ao parar o scanner:', e);
      }
      qrScannerRef.current = null;
    }
    setIsScanningQr(false);
  };

  const stopProductionQrScanner = async () => {
    if (productionQrScannerRef.current) {
      try {
        await productionQrScannerRef.current.stop();
      } catch (e) {
        console.warn('Erro ao parar o scanner de produção:', e);
      }
      productionQrScannerRef.current = null;
    }
    setIsScanningProductionQr(false);
  };

  const handleProductionQrScanned = async (text: string) => {
    const payload = parseProductionQrPayload(text);
    if (!payload) {
      setProductionQrError('QR inválido. Esperado JSON com serial, provision e model.');
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(100);
    }

    await stopProductionQrScanner();
    setProductionQrError(null);

    const result = await registerProductionDeviceFromQr(payload);
    if (!result.ok) {
      const msg =
        result.error === 'unknown_model'
          ? `Modelo ${result.model || payload.model} não existe no catálogo. Cadastre-o em devices_catalog.`
          : result.error === 'forbidden'
            ? 'Sem permissão para cadastrar produção (owner/admin/factory).'
            : result.error === 'unauthenticated'
              ? 'Sessão expirada. Faça login novamente.'
              : `Falha ao cadastrar: ${result.error}`;
      setProductionQrError(msg);
      showToast('Produção', msg, 'error');
      return;
    }

    await loadProductionData();
  };

  const startProductionQrScanner = async () => {
    setProductionQrError(null);
    setIsScanningProductionQr(true);

    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      await new Promise((resolve) => setTimeout(resolve, 300));

      const scannerElement = document.getElementById('qr-reader-production');
      if (!scannerElement) {
        setProductionQrError('Elemento de visualização da câmera não encontrado.');
        setIsScanningProductionQr(false);
        return;
      }

      if (productionQrScannerRef.current) {
        try {
          await productionQrScannerRef.current.stop();
        } catch {
          // ignore
        }
        productionQrScannerRef.current = null;
      }

      let cameras: Array<{ id: string; label: string }> = [];
      try {
        cameras = await Html5Qrcode.getCameras();
      } catch {
        cameras = [];
      }

      if (!cameras || cameras.length === 0) {
        setProductionQrError('Nenhuma câmera encontrada neste dispositivo.');
        setIsScanningProductionQr(false);
        return;
      }

      const preferred =
        cameras.find((cam) => /back|rear|traseira|environment|posterior/i.test(cam.label)) ||
        cameras[cameras.length - 1] ||
        cameras[0];

      const html5QrCode = new Html5Qrcode('qr-reader-production');
      productionQrScannerRef.current = html5QrCode;

      const config = {
        fps: 10,
        qrbox: (width: number, height: number) => {
          const size = Math.min(width, height) * 0.7;
          return { width: size, height: size };
        },
        aspectRatio: 1.0,
      };

      const onSuccess = (decodedText: string) => {
        handleProductionQrScanned(decodedText);
      };

      try {
        await html5QrCode.start(preferred.id, config, onSuccess, () => {});
      } catch (primaryErr) {
        let started = false;
        for (const cameraConfig of [{ facingMode: 'environment' }, { facingMode: 'user' }, cameras[0].id] as const) {
          try {
            await html5QrCode.start(cameraConfig as any, config, onSuccess, () => {});
            started = true;
            break;
          } catch {
            // try next
          }
        }
        if (!started) throw primaryErr;
      }
    } catch (err) {
      const errText = String(err);
      let userFriendlyMsg = 'Erro ao acessar a câmera. Verifique as permissões do navegador.';
      if (errText.includes('NotAllowedError') || errText.includes('Permission')) {
        userFriendlyMsg = 'Permissão de câmera negada.';
      }
      setProductionQrError(userFriendlyMsg);
      setIsScanningProductionQr(false);
      productionQrScannerRef.current = null;
    }
  };

  // Handle scanned text
  const handleQrCodeScanned = (text: string) => {
    try {
      const cleanJsonStr = text.trim();
      const parsed = JSON.parse(cleanJsonStr);
      
      // Handle the new custom QR code standard (v, serial, token, local)
      if (parsed && typeof parsed === 'object') {
        // Discard 'local' property as requested (only used for equipment installation)
        if ('local' in parsed) {
          delete parsed.local;
        }

        // Map token/provision to pairing_token if present
        if (parsed.token && !parsed.pairing_token) {
          parsed.pairing_token = parsed.token;
        }
        if (parsed.provision && !parsed.pairing_token) {
          parsed.pairing_token = parsed.provision;
        }

        if (parsed.serial && !parsed.deviceId) {
          // Use serial as the deviceId internally
          parsed.deviceId = parsed.serial;
          
          // Prefer explicit model from production QR; else extract from serial
          if (parsed.model) {
            parsed.model = String(parsed.model).toUpperCase();
          } else {
            const modelMatch = parsed.serial.match(/(MM\d+T?S?W?)/i);
            if (modelMatch) {
              parsed.model = modelMatch[1].toUpperCase();
            } else {
              parsed.model = 'MM12TW';
            }
          }
          
          if (!parsed.manufacturer) {
            parsed.manufacturer = 'MASTERLAZER';
          }
        }
      }

      // Dynamically build deviceId if not explicitly provided but model and serial are present (legacy fallback)
      if (!parsed.deviceId && parsed.model && parsed.serial) {
        parsed.deviceId = `${parsed.model}-${parsed.serial}`;
      }
      
      if (!parsed.deviceId) {
        throw new Error('JSON lido não possui a chave "deviceId" nem "serial" para montá-lo.');
      }

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(100);
      }

      setScannedData(parsed);
      
      // Auto-populate form
      setBleDeviceId(parsed.deviceId);
      
      let finalModel = 'MM12TW';
      if (parsed.model) {
        finalModel = parsed.model;
      } else {
        const matchedModel = parsed.deviceId.match(/(MM\d+T?S?W?)/i);
        if (matchedModel) {
          finalModel = matchedModel[1].toUpperCase();
        }
      }
      setSelectedEquipmentModel(finalModel);
      
      if (parsed.serial) {
        setEquipmentSerial(parsed.serial);
      } else {
        setEquipmentSerial('');
      }
      
      if (parsed.manufacturer) {
        setEquipmentManufacturer(parsed.manufacturer);
      } else {
        setEquipmentManufacturer('MASTERLAZER');
      }

      // Automatically save and activate the device immediately
      handleSaveEquipment(
        parsed.deviceId, 
        finalModel, 
        parsed.serial || '', 
        parsed.manufacturer || 'MASTERLAZER',
        parsed.pairing_token || parsed.provision || parsed.token || ''
      );

      stopQrScanner();
    } catch (err) {
      console.warn('O QR Code escaneado não é um JSON válido. Tentando texto puro...', err);
      
      const matchedModel = text.match(/(MM\d+T?S?W?)/i);
      if (matchedModel && text.length >= 5) {
        // Plain serial without factory provision cannot be claimed
        setQrScannerError(getUnrecognizedDeviceMessage());
        showToast('Erro', getUnrecognizedDeviceMessage(), 'error');
        stopQrScanner();
      } else {
        setQrScannerError('Formato inválido. O QR Code deve conter o JSON de cadastro do equipamento ou serial válido.');
      }
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (qrScannerRef.current) {
        qrScannerRef.current.stop().catch(() => {});
      }
      if (productionQrScannerRef.current) {
        productionQrScannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // Capture invite token from URL (?invite=...) or sessionStorage → open invite screen
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get('invite');
      const fromStorage = sessionStorage.getItem(INVITE_STORAGE_KEY);
      const token = (fromUrl || fromStorage || '').trim();
      if (!token) return;

      setPendingInviteToken(token);
      sessionStorage.setItem(INVITE_STORAGE_KEY, token);

      if (fromUrl) {
        params.delete('invite');
        const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`;
        window.history.replaceState(window.history.state, '', next);
      }

      setActiveScreen('invite');

      void peekDeviceInvite(token).then((preview) => {
        setInvitePreview(preview);
        if (preview.status !== 'pending') {
          sessionStorage.removeItem(INVITE_STORAGE_KEY);
        }
      });
    } catch (e) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismissInviteScreen = useCallback(() => {
    setPendingInviteToken(null);
    setInvitePreview(null);
    try {
      sessionStorage.removeItem(INVITE_STORAGE_KEY);
    } catch (e) {}
    setActiveScreen(currentUser?.isSupabase ? 'home' : 'login');
  }, [currentUser]);

  const clearPendingInvite = useCallback(() => {
    setPendingInviteToken(null);
    setInvitePreview(null);
    try {
      sessionStorage.removeItem(INVITE_STORAGE_KEY);
    } catch (e) {}
  }, []);

  const handleAcceptPendingInvite = useCallback(async () => {
    if (!pendingInviteToken || !currentUser?.isSupabase) return;
    setInviteAcceptBusy(true);
    try {
      const result = await acceptDeviceInvite(pendingInviteToken);
      if (!result.ok) {
        showToast('Convite', result.error, 'warning');
        return;
      }
      clearPendingInvite();
      await syncUserDevicesFromSupabase(currentUser.uid, currentUser.email);
      setDeviceId(result.device_id);
      localStorage.setItem('mqtt_device', result.device_id);
      setActiveScreen('aux');
    } finally {
      setInviteAcceptBusy(false);
    }
  }, [pendingInviteToken, currentUser, clearPendingInvite, syncUserDevicesFromSupabase, showToast]);

  // Refresh invite preview after login if needed
  useEffect(() => {
    if (!pendingInviteToken) return;
    if (invitePreview) return;
    void peekDeviceInvite(pendingInviteToken).then((preview) => setInvitePreview(preview));
  }, [currentUser, pendingInviteToken, invitePreview]);

  // Device sharing: open/close share panel + invite/member management
  const openSharePanel = useCallback(async (deviceIdToShare: string) => {
    setShareDeviceId(deviceIdToShare);
    setShareInvite(null);
    setSharePermission('control');
    setShareMembers([]);
    setActiveScreen('share');
    setShareBusy(true);
    try {
      const members = await listDeviceMembers(deviceIdToShare);
      setShareMembers(members);
    } finally {
      setShareBusy(false);
    }
  }, []);

  const closeSharePanel = useCallback(() => {
    setShareInvite(null);
    setShareMembers([]);
    setShareDeviceId(null);
    setActiveScreen('setup');
  }, []);

  useEffect(() => {
    if (activeScreen === 'share' && !shareDeviceId) {
      // Recover if share was opened without a device (e.g. stale state after refresh).
      setActiveScreen('setup');
    }
  }, [activeScreen, shareDeviceId]);

  // Hide/leave solar screen when catalog disables aquecimento solar for the active model
  useEffect(() => {
    if (activeScreen === 'solar' && !hasSolarHeating) {
      setActiveScreen('home');
    }
  }, [activeScreen, hasSolarHeating]);

  const handleCreateShareInvite = useCallback(async () => {
    if (!shareDeviceId) return;
    setShareBusy(true);
    try {
      const { invite, error } = await createDeviceInvite(shareDeviceId, sharePermission);
      if (!invite) {
        showToast('Compartilhar', error || 'Não foi possível criar o convite.', 'warning');
        return;
      }
      setShareInvite(invite);
    } finally {
      setShareBusy(false);
    }
  }, [shareDeviceId, sharePermission, showToast]);

  const handleRevokeMember = useCallback(async (memberUserId: string) => {
    if (!shareDeviceId) return;
    setShareBusy(true);
    try {
      const result = await revokeDeviceMember(shareDeviceId, memberUserId);
      if (!result.ok) {
        showToast('Revogar', result.error || 'Falha ao revogar.', 'warning');
        return;
      }
      setShareMembers((prev) => prev.filter((m) => m.user_id !== memberUserId));
    } finally {
      setShareBusy(false);
    }
  }, [shareDeviceId, showToast]);

  const handleLeaveShared = useCallback(async (eqId: string) => {
    if (!currentUser?.isSupabase) return;
    setShareBusy(true);
    try {
      const result = await leaveSharedDevice(eqId);
      if (!result.ok) {
        showToast('Sair', result.error || 'Não foi possível sair.', 'warning');
        return;
      }
      await syncUserDevicesFromSupabase(currentUser.uid, currentUser.email);
    } finally {
      setShareBusy(false);
    }
  }, [currentUser, syncUserDevicesFromSupabase, showToast]);

  // Save specific equipment
  async function handleSaveEquipment(idOverride?: string, modelOverride?: string, serialOverride?: string, manufacturerOverride?: string, pairingTokenOverride?: string) {
    const finalId = idOverride || bleDeviceId;
    const finalModel = modelOverride || selectedEquipmentModel;
    const finalSerial = serialOverride !== undefined ? serialOverride : equipmentSerial;
    const finalManufacturer = manufacturerOverride !== undefined ? manufacturerOverride : equipmentManufacturer;
    
    const trimmedId = finalId.trim();
    const normalizedModel = finalModel.trim().toUpperCase();
    if (!trimmedId) {
      showToast('ID Inválido', 'Por favor, digite um ID de equipamento válido.', 'warning');
      return;
    }

    if (isSupabaseConfigured() && currentUser?.isSupabase) {
      const availableCatalog =
        deviceCatalog.length > 0 ? deviceCatalog : await fetchDeviceCatalog();

      if (deviceCatalog.length === 0 && availableCatalog.length > 0) {
        setDeviceCatalog(availableCatalog);
      }

      if (!availableCatalog.some((item) => item.model.toUpperCase() === normalizedModel)) {
        setQrScannerError(
          `O modelo ${normalizedModel} não está cadastrado em devices_catalog. Cadastre o modelo no catálogo antes de associar o equipamento.`
        );
        return;
      }

      const provision =
        (pairingTokenOverride || '').trim() ||
        (typeof scannedData?.pairing_token === 'string' ? scannedData.pairing_token.trim() : '') ||
        (typeof scannedData?.provision === 'string' ? scannedData.provision.trim() : '') ||
        (typeof scannedData?.token === 'string' ? scannedData.token.trim() : '');

      if (!provision) {
        const msg = getUnrecognizedDeviceMessage();
        setQrScannerError(msg);
        showToast('Erro', msg, 'error');
        return;
      }

      const registeredDevice = await registerDevice(
        trimmedId,
        normalizedModel as any,
        currentUser.uid,
        finalSerial || trimmedId,
        provision
      );

      if (!registeredDevice) {
        const msg = getUnrecognizedDeviceMessage();
        setQrScannerError(msg);
        showToast('Erro', msg, 'error');
        return;
      }

      await ensureDeviceSettings(trimmedId);

      // Wait for Supabase confirmation before declaring the device registered.
      // Previously this ran in the background, so the empty state could remain visible
      // (or a later auth refresh could overwrite the optimistic local list).
    }

    // Retrieve currently logged-in user's email
    const userEmail = currentUser?.email || '';
    
    const newItem = {
      id: trimmedId,
      model: normalizedModel,
      serial: finalSerial,
      pairing_token: pairingTokenOverride,
      manufacturer: finalManufacturer,
      userEmail
    };

    // Functional update always uses the latest list and immediately removes the
    // "Nenhum equipamento cadastrado" state.
    setRegisteredEquipments((current) => {
      const exists = current.some((eq) => areDeviceIdsMatching(eq.id, trimmedId));

      const nextList = !exists
        ? [...current, newItem]
        : current.map((eq) => {
            const isMatch = areDeviceIdsMatching(eq.id, trimmedId);
            return isMatch ? { ...eq, ...newItem } : eq;
          });

      localStorage.setItem('registered_equipments', JSON.stringify(nextList));

      // Remove from deleted_device_ids in localStorage if re-registering
      try {
        const deletedIds: string[] = JSON.parse(localStorage.getItem('deleted_device_ids') || '[]');
        const updatedDeleted = deletedIds.filter(d => !areDeviceIdsMatching(d, trimmedId));
        localStorage.setItem('deleted_device_ids', JSON.stringify(updatedDeleted));
      } catch (e) {}

      return nextList;
    });
    
    // Also make this the active device under control!
    setDeviceId(trimmedId);
    localStorage.setItem('mqtt_device', trimmedId);
    setScannedData(null);
    setQrScannerError(null);
    setActiveScreen('aux');
    
    // Log registration info in the Equipment terminal console
    setBleLog(prev => [
      ...prev,
      `[REGISTRO] Equipamento salvo: ${normalizedModel}`,
      `[REGISTRO] ID único: ${trimmedId}`,
      `[REGISTRO] Número de Série: ${finalSerial || 'N/A'}`,
      `[REGISTRO] Fabricante: ${finalManufacturer || 'N/A'}`,
      `[REGISTRO] Associado ao Usuário: ${userEmail || 'Nenhum'}`,
      `[REGISTRO] Equipamento configurado como ATIVO no broker MQTT.`
    ]);
  };

  // Save Advanced Developer Config
  const handleSaveDevConfig = () => {
    localStorage.setItem('mqtt_broker', mqttBroker);
    localStorage.setItem('mqtt_port', mqttPort);
    localStorage.setItem('mqtt_device', deviceId);
    localStorage.setItem('mqtt_user', mqttUser);
    localStorage.setItem('mqtt_pass', mqttPassword);
    localStorage.setItem('app_config_version', '2026_07_24_v2_mosquitto');

    if (userWantsMqtt) {
      forceReconnectMQTT();
    }
  };

  const handleResetToDefaultConfig = () => {
    setMqttBroker(DEFAULT_MQTT_BROKER);
    setMqttPort(DEFAULT_MQTT_PORT);
    setMqttUser('');
    setMqttPassword('');
    localStorage.setItem('mqtt_broker', DEFAULT_MQTT_BROKER);
    localStorage.setItem('mqtt_port', DEFAULT_MQTT_PORT);
    localStorage.removeItem('mqtt_user');
    localStorage.removeItem('mqtt_pass');
    localStorage.setItem('app_config_version', '2026_07_24_v2_mosquitto');
  };

  const isCurrentlyAdmin = activeScreen === 'admin';
  const hasRegisteredEquipment = registeredEquipments.length > 0;

  // Shared empty-state shown on HOME/BOMBAS/LED/TIMERS when no equipment is registered
  const renderNoEquipmentScreen = (key: string, featureLabel: string) => (
    <motion.div
      key={key}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center h-full text-center px-6 py-10 gap-4"
    >
      <div className="w-14 h-14 rounded-2xl bg-[#4398fa]/10 border border-[#4398fa]/20 flex items-center justify-center">
        <QrCode className="w-7 h-7 text-[#4398fa]" />
      </div>
      <h3 className="text-sm font-bold text-white">Nenhum equipamento cadastrado</h3>
      <p className="text-xs text-slate-400 leading-relaxed max-w-[280px]">
        Para acessar {featureLabel}, cadastre primeiro o seu equipamento escaneando o QR Code.
      </p>
      <button
        type="button"
        onClick={() => setActiveScreen('setup')}
        className="mt-2 px-5 py-2.5 bg-gradient-to-r from-[#0055CC] to-[#0077EE] hover:brightness-110 active:scale-95 text-white text-xs font-bold rounded-xl shadow-lg shadow-[#4398fa]/20 transition-all flex items-center gap-2"
      >
        <QrCode className="w-4 h-4" />
        Cadastrar Equipamento
      </button>
    </motion.div>
  );
  const motorControls: Array<{
    number: MotorNumber;
    name: string;
    on: boolean;
    icon: 'droplet' | 'filter' | 'power';
  }> = [
    { number: 1, name: motor1Name, on: motorHidro, icon: 'droplet' },
    { number: 2, name: motor2Name, on: motorFiltro, icon: 'filter' },
    { number: 3, name: motor3Name, on: motor3, icon: 'power' },
    { number: 4, name: motor4Name, on: motor4, icon: 'power' },
    { number: 5, name: motor5Name, on: motor5, icon: 'power' },
    { number: 6, name: motor6Name, on: motor6, icon: 'power' },
    { number: 7, name: motor7Name, on: motor7, icon: 'power' },
    { number: 8, name: motor8Name, on: motor8, icon: 'power' },
  ];
  const visibleMotorControls = motorControls.slice(0, activeMotorCount);

  return (
    <div
      className={`relative w-full ${isCurrentlyAdmin ? 'max-w-7xl px-4 md:px-8 py-6' : 'max-w-[440px] p-0 sm:p-4 h-full min-h-0 sm:h-auto sm:min-h-0'} mx-auto select-none ${isCurrentlyAdmin ? 'overflow-visible' : 'overflow-hidden'}`}
      id="pool-controller-app"
      data-admin={isCurrentlyAdmin ? 'true' : 'false'}
    >
      <Script 
        src="https://cdnjs.cloudflare.com/ajax/libs/paho-mqtt/1.0.1/mqttws31.min.js" 
        strategy="afterInteractive" 
        onLoad={() => {
          console.log('Paho MQTT Client loaded');
          setPahoLoaded(true);
        }}
      />
      <Script 
        src="https://cdn.jsdelivr.net/npm/@jaames/iro@5" 
        strategy="afterInteractive" 
        onLoad={() => {
          console.log('Iro.js Color picker loaded');
          setIroLoaded(true);
        }}
      />


      {/* iPhone Bezel Virtual Frame Mockup for Desktop, immersive fluid on Mobile */}
      <div className={`app-shell w-full bg-[#0d1117]/90 backdrop-blur-xl border-0 sm:border border-white/10 ${isCurrentlyAdmin ? 'rounded-2xl min-h-[85vh] h-auto p-4 md:p-6' : 'rounded-none sm:rounded-[32px] h-full min-h-0 sm:h-[820px] sm:max-h-[92vh]'} shadow-2xl flex flex-col relative z-20 ${isCurrentlyAdmin ? 'overflow-visible' : 'overflow-hidden'}`}>
        
        {/* Notch & Status Indicators */}
        {!isCurrentlyAdmin && (
          <div className="flex w-full bg-black/25 justify-between items-center px-4 relative z-50 border-b border-white/5 pt-[env(safe-area-inset-top,0px)] shrink-0">
            <div className="flex h-7 w-full justify-between items-center">
            <span className="text-[10px] sm:text-[11px] font-sans text-slate-300 font-bold tracking-tight">{currentTime}</span>
            {/* Virtual Notch / Status Center - Hidden on mobile, shown on desktop */}
            {activeScreen === 'home' && (isUpdatingData || showUpdatedMessage) ? (
              isUpdatingData ? (
                <span className="absolute left-1/2 transform -translate-x-1/2 text-[9.5px] font-extrabold text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1 z-[60] animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping shrink-0" />
                  Atualizando...
                </span>
              ) : (
                <span className="absolute left-1/2 transform -translate-x-1/2 text-[9.5px] font-extrabold text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1 z-[60] shadow-sm">
                  <Check className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                  Sistema Atualizado!
                </span>
              )
            ) : (
              <div className="hidden sm:block absolute top-0 left-1/2 transform -translate-x-1/2 w-28 h-4 bg-black/20 rounded-b-xl border-b border-l border-r border-white/5" />
            )}
            <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-sans text-slate-300">
            {mqttConnected ? (
              <span className="flex items-center gap-1 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/25 text-emerald-400 font-extrabold text-[9px] scale-90">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                CONECTADO
              </span>
            ) : mqttStatusMessage === 'Conectando...' ? (
              <span className="flex items-center gap-1 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/25 text-amber-400 font-extrabold text-[9px] scale-90">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></span>
                CONECTANDO
              </span>
            ) : (
              <span className="flex items-center gap-1 bg-rose-500/15 px-2 py-0.5 rounded-full border border-rose-500/25 text-rose-400 font-extrabold text-[9px] scale-90">
                <span className="w-1.5 h-1.5 bg-rose-500 rounded-full"></span>
                OFFLINE
              </span>
            )}
            </div>
            </div>
          </div>
        )}

        {/* Master App Screen Display Frame */}
        <div className={`flex-1 min-h-0 bg-transparent flex flex-col relative ${isCurrentlyAdmin ? 'overflow-visible' : 'overflow-hidden'}`}>
          
          {/* Header Bar (Hidden for Login / Register / Setup / Share / Invite sheets) */}
          {activeScreen !== 'login' && activeScreen !== 'register' && activeScreen !== 'setup' && activeScreen !== 'share' && activeScreen !== 'invite' && activeScreen !== 'admin' && activeScreen !== 'support' && activeScreen !== 'theme' && (
            <header className="border-b border-white/10 bg-white/5 backdrop-blur-md sticky top-0 z-40">
              {/* Row 1: Brand & Settings */}
              <div className="px-5 pt-3.5 pb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img 
                    src={manufacturerLogo || "https://www.masterlazer.com.br/images/icon.jpg"} 
                    alt="Master Lazer Logo" 
                    className="w-7 h-7 object-contain rounded-md" 
                  />
                  <div>
                    <h1 className="text-xs font-bold tracking-tight text-[#4398fa] m-1 leading-none">MASTER LAZER</h1>
                    <p className="text-[8px] text-[#4398fa] font-mono tracking-widest uppercase mt-2 leading-none">
                      AUTO • {registeredEquipments.find(eq => areDeviceIdsMatching(eq.id, deviceId))?.model || 'MM12TW'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {currentUser && (currentUser.role === 'owner' || currentUser.role === 'admin' || currentUser.role === 'support' || currentUser.role === 'factory') && (
                    <button
                      type="button"
                      onClick={() => setActiveScreen('admin')}
                      className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 hover:text-amber-300 transition-all hover:bg-amber-500/20 active:scale-95"
                      title="Painel de Administração (Proprietário)"
                    >
                      <Shield className="w-4 h-4" />
                    </button>
                  )}

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowNavMenu((open) => !open)}
                      className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-200 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
                      title="Menu"
                      aria-label="Abrir menu"
                      aria-expanded={showNavMenu}
                    >
                      <Menu className="w-5 h-5" />
                    </button>

                    {showNavMenu && (
                      <>
                        <div
                          className="fixed inset-0 z-[70]"
                          onClick={() => setShowNavMenu(false)}
                          aria-hidden="true"
                        />
                        <div className="absolute right-0 top-11 z-[80] w-52 rounded-2xl border border-white/10 bg-[#0f172a]/95 backdrop-blur-xl shadow-2xl shadow-black/40 overflow-hidden">
                          <div className="px-3.5 py-2.5 border-b border-white/10">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Menu</p>
                            <p className="text-[11px] text-slate-300 truncate mt-0.5">
                              {currentUser?.email || 'Conta'}
                            </p>
                          </div>

                          <div className="p-1.5 space-y-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                setShowNavMenu(false);
                                setActiveScreen('setup');
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs font-bold text-slate-200 hover:bg-white/10 transition-colors"
                            >
                              <Settings className="w-4 h-4 text-[#4398fa]" />
                              Configurações
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setShowNavMenu(false);
                                setActiveScreen('theme');
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs font-bold text-slate-200 hover:bg-white/10 transition-colors"
                            >
                              <Palette className="w-4 h-4 text-violet-400" />
                              Aparência
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setShowNavMenu(false);
                                setActiveScreen('support');
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs font-bold text-slate-200 hover:bg-white/10 transition-colors"
                            >
                              <Headset className="w-4 h-4 text-emerald-400" />
                              Ajuda / Suporte
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setShowNavMenu(false);
                                handleLogout();
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs font-bold text-rose-400 hover:bg-rose-500/10 transition-colors"
                            >
                              <LogOut className="w-4 h-4" />
                              Sair da conta
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 2: Navigation Icons HOME, BOMBAS, LED, TIMERS, (SOLAR if catalog enables it) */}
              <div className="px-3.5 pb-3 pt-1">
                <div className={`grid gap-1 p-1 bg-black/20 rounded-xl border-2 border-white/10 ${hasSolarHeating ? 'grid-cols-5' : 'grid-cols-4'}`}>
                  <button 
                    id="tab-home"
                    onClick={() => setActiveScreen('home')}
                    className={`flex flex-col items-center justify-center gap-1 py-2 sm:py-2.5 rounded-lg text-[10px] sm:text-[12px] font-extrabold tracking-wider transition-all ${
                      activeScreen === 'home' 
                        ? 'text-[#4398fa] bg-white/12 shadow-inner border border-white/10' 
                        : 'text-slate-400 hover:text-white border border-transparent'
                    }`}
                  >
                    <Tv className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                    <span>HOME</span>
                  </button>

                  <button 
                    id="tab-aux"
                    onClick={() => setActiveScreen('aux')}
                    className={`flex flex-col items-center justify-center gap-1 py-2 sm:py-2.5 rounded-lg text-[10px] sm:text-[12px] font-extrabold tracking-wider transition-all ${
                      activeScreen === 'aux' 
                        ? 'text-[#4398fa] bg-white/12 shadow-inner border border-white/10' 
                        : 'text-slate-400 hover:text-white border border-transparent'
                    }`}
                  >
                    <Sliders className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                    <span>BOMBAS</span>
                  </button>

                  <button 
                    id="tab-led"
                    onClick={() => setActiveScreen('led')}
                    className={`flex flex-col items-center justify-center gap-1 py-2 sm:py-2.5 rounded-lg text-[10px] sm:text-[12px] font-extrabold tracking-wider transition-all ${
                      activeScreen === 'led' 
                        ? 'text-[#4398fa] bg-white/12 shadow-inner border border-white/10' 
                        : 'text-slate-400 hover:text-white border border-transparent'
                    }`}
                  >
                    <Flame className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                    <span>LED</span>
                  </button>

                  <button 
                    id="tab-piscina"
                    onClick={() => setActiveScreen('timers')}
                    className={`flex flex-col items-center justify-center gap-1 py-2 sm:py-2.5 rounded-lg text-[10px] sm:text-[12px] font-extrabold tracking-wider transition-all ${
                      activeScreen === 'timers' 
                        ? 'text-[#4398fa] bg-white/12 shadow-inner border border-white/10' 
                        : 'text-slate-400 hover:text-white border border-transparent'
                    }`}
                  >
                    <Clock className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                    <span>TIMERS</span>
                  </button>

                  {hasSolarHeating && (
                    <button 
                      id="tab-solar"
                      onClick={() => setActiveScreen('solar')}
                      className={`flex flex-col items-center justify-center gap-1 py-2 sm:py-2.5 rounded-lg text-[10px] sm:text-[12px] font-extrabold tracking-wider transition-all ${
                        activeScreen === 'solar' 
                          ? 'text-[#4398fa] bg-white/12 shadow-inner border border-white/10' 
                          : 'text-slate-400 hover:text-white border border-transparent'
                      }`}
                    >
                      <Sun className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                      <span>AQUEC</span>
                    </button>
                  )}
                </div>
              </div>
            </header>
          )}

          {/* Alarm Banner */}
          {solarErrorBanner && activeScreen !== 'login' && activeScreen !== 'register' && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-rose-500 text-white px-4 py-2 flex items-center gap-2 text-xs font-semibold shadow-inner"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 animate-ping absolute" />
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="flex-1 truncate">⚠️ ERRO: {solarErrorBanner}</span>
              <button 
                onClick={() => setSolarErrorBanner(null)} 
                className="text-[10px] uppercase font-bold bg-black/20 hover:bg-black/40 px-1.5 py-0.5 rounded"
              >
                Ignorar
              </button>
            </motion.div>
          )}

          {/* Dynamic Screen Contents inside Screen Containers */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 custom-scrollbar flex flex-col relative">
            
            <AnimatePresence initial={false}>
              
              {/* Screen: Login */}
              {activeScreen === 'login' && (
                <motion.div
                  key="login-screen"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="flex flex-col h-full justify-between py-6"
                >
                  <div className="text-center mt-6 flex flex-col items-center">
                    <div className="mb-4">
                      <MasterLazerLogo
                        theme={appTheme}
                        className={`w-[192px] h-[192px] hover:scale-105 transition-all duration-300 ${
                          appTheme === 'light'
                            ? 'drop-shadow-[0_6px_18px_rgba(0,0,0,0.22)]'
                            : 'drop-shadow-[0_8px_24px_rgba(0,0,0,0.45)]'
                        }`}
                      />
                    </div>
                    <h2 className="text-xl font-bold tracking-tight text-white mb-1">Acesso Master</h2>
                    
                    <div className="mt-2 flex flex-col items-center gap-2 px-6 w-full max-w-[340px]">
                      {getSupabaseConfigError() ? (
                        <div className="flex flex-col items-center gap-2 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center w-full shadow-lg shadow-rose-950/20">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-rose-500/25 text-rose-300 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                            Chave Inválida / Erro de API
                          </span>
                          <p className="text-[10.5px] text-slate-300 leading-normal">
                            A chave configurada nos Secrets do AI Studio começa com <code className="bg-rose-950 px-1 py-0.5 rounded text-rose-300 font-mono font-semibold">sb_publishable_</code>, que é um token de outro serviço (Stack Auth), inviabilizando a comunicação real com o Supabase.
                          </p>
                          <p className="text-[10.5px] text-emerald-400 font-bold leading-normal bg-emerald-950/25 p-1.5 rounded border border-emerald-500/20">
                            Acesse seu painel do Supabase → Settings → API, copie a chave <strong>&apos;anon&apos; &apos;public&apos;</strong> (que começa com <strong>eyJ...</strong>) e cadastre-a como <strong>NEXT_PUBLIC_SUPABASE_ANON_KEY</strong> nos Secrets do AI Studio.
                          </p>

                          <div className="mt-2 pt-2 border-t border-rose-500/20 w-full flex flex-col gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setShowManualConfig(!showManualConfig);
                                setManualSuccessMsg('');
                              }}
                              className="text-[11px] font-bold text-rose-400 hover:text-rose-300 flex items-center justify-center gap-1 transition-all"
                            >
                              <Settings className="w-3.5 h-3.5 animate-spin-slow" />
                              {showManualConfig ? 'Ocultar Ajuste Manual' : 'Configurar Chave Manualmente'}
                            </button>

                            {showManualConfig && (
                              <div className="flex flex-col gap-2 text-left bg-black/40 p-2.5 rounded-lg border border-white/5">
                                <label className="text-[10px] font-bold text-slate-400 block">URL do Supabase:</label>
                                <input
                                  type="text"
                                  placeholder="https://xxxx.supabase.co"
                                  value={manualUrl}
                                  onChange={(e) => setManualUrl(e.target.value)}
                                  className="w-full text-xs bg-slate-900 border border-white/10 rounded px-2 py-1 text-white focus:outline-none focus:border-orange-500"
                                />
                                <label className="text-[10px] font-bold text-slate-400 block mt-1">Chave Anon (Public Key):</label>
                                <textarea
                                  placeholder="eyJ..."
                                  rows={2}
                                  value={manualKey}
                                  onChange={(e) => setManualKey(e.target.value)}
                                  className="w-full text-[11px] font-mono bg-slate-900 border border-white/10 rounded px-2 py-1 text-white focus:outline-none focus:border-orange-500 resize-none"
                                />

                                <div className="flex gap-2 mt-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!manualUrl || !manualKey) {
                                        showToast('Campos Obrigatórios', 'Por favor, preencha ambos os campos.', 'warning');
                                        return;
                                      }
                                      const success = saveLocalConfig(manualUrl, manualKey);
                                      if (success) {
                                        setManualSuccessMsg('Configuração salva! Recarregando...');
                                        setTimeout(() => {
                                          window.location.reload();
                                        }, 1200);
                                      } else {
                                        showToast('Dados Inválidos', 'Verifique se a chave começa com "eyJ" e tem formato de JWT.', 'error');
                                      }
                                    }}
                                    className="flex-1 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-[10.5px] text-center transition-all"
                                  >
                                    Salvar & Conectar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      clearLocalConfig();
                                      setManualUrl('');
                                      setManualKey('');
                                      setManualSuccessMsg('Redefinido para o padrão! Recarregando...');
                                      setTimeout(() => {
                                        window.location.reload();
                                      }, 1200);
                                    }}
                                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded text-[10.5px] text-center transition-all"
                                    title="Restaurar valores do AI Studio"
                                  >
                                    Limpar
                                  </button>
                                </div>
                                {manualSuccessMsg && (
                                  <span className="text-[10px] text-emerald-400 text-center font-bold animate-pulse mt-1 block">
                                    {manualSuccessMsg}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        !isSupabaseConfigured() && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
                            <Shield className="w-3 h-3 text-amber-400" />
                            CARREGANDO CONEXÃO CLOUD...
                          </span>
                        )
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 my-auto">
                    {authErrorMessage && (
                      <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">
                        {authErrorMessage}
                      </div>
                    )}

                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="email"
                        placeholder="E-mail"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-orange-500 focus:bg-white/10 transition-all"
                      />
                    </div>

                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="password"
                        placeholder="Senha"
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-orange-500 focus:bg-white/10 transition-all"
                      />
                    </div>

                    <button
                      onClick={() => handleAuthSubmit('login')}
                      disabled={isLoadingAuth}
                      className="w-full py-3 bg-gradient-to-r from-[#0055CC] to-[#4398fa] hover:brightness-110 disabled:bg-slate-800 text-white rounded-xl text-sm font-bold shadow-lg shadow-[#4398fa]/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      {isLoadingAuth ? 'Verificando...' : 'Entrar'}
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    
                    <button
                      type="button"
                      onClick={handleResetPasswordSimulated}
                      className="w-full text-center text-xs text-slate-400 hover:text-[#4398fa] transition-all py-1 mt-2"
                    >
                      Esqueci minha senha
                    </button>


                  </div>

                  <div className="text-center pt-4 border-t border-white/10">
                    <p className="text-xs text-slate-400">
                      Não tem cadastro?{' '}
                      <button
                        onClick={() => setActiveScreen('register')}
                        className="text-[#4398fa] hover:underline font-bold"
                      >
                        Criar nova conta
                      </button>
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Screen: Register */}
              {activeScreen === 'register' && (
                <motion.div
                  key="register-screen"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="flex flex-col h-full justify-between py-6"
                >
                  <div className="text-center mt-6">
                    <div className="w-16 h-16 mx-auto mb-4 bg-[#4398fa]/10 rounded-2xl flex items-center justify-center border border-[#4398fa]/25 shadow-lg">
                      <User className="w-8 h-8 text-[#4398fa]" />
                    </div>
                    <h2 className="text-xl font-bold tracking-tight text-white mb-1">Novo Usuário</h2>
                    <p className="text-xs text-slate-400">Cadastre-se para gerenciar seus sistemas</p>
                    
                    <div className="mt-2 flex flex-col items-center gap-1.5 px-6">
                      {getSupabaseConfigError() ? (
                        <div className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center max-w-[340px]">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-rose-500/25 text-rose-300 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                            Chave Inválida / Erro de API
                          </span>
                        </div>
                      ) : isSupabaseConfigured() ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm shadow-emerald-500/5">
                          <Database className="w-3 h-3 text-emerald-400 animate-pulse" />
                          CLOUD ATIVO
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
                          <Shield className="w-3 h-3 text-amber-400" />
                          CARREGANDO CONEXÃO CLOUD...
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 my-auto">
                    {authErrorMessage && (
                      <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">
                        {authErrorMessage}
                      </div>
                    )}

                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="email"
                        placeholder="E-mail"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-orange-500 focus:bg-white/10 transition-all"
                      />
                    </div>

                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="password"
                        placeholder="Senha (mínimo 8 caracteres)"
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-orange-500 focus:bg-white/10 transition-all"
                      />
                    </div>

                    <button
                      onClick={() => handleAuthSubmit('register')}
                      disabled={isLoadingAuth}
                      className="w-full py-3 bg-gradient-to-r from-emerald-600 to-emerald-400 hover:brightness-110 disabled:bg-slate-800 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      {isLoadingAuth ? 'Registrando...' : 'Cadastrar'}
                      <Check className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="text-center pt-4 border-t border-white/10">
                    <p className="text-xs text-slate-400">
                      Já é cadastrado?{' '}
                      <button
                        onClick={() => setActiveScreen('login')}
                        className="text-[#4398fa] hover:underline font-bold"
                      >
                        Voltar para o Login
                      </button>
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Screen: Home (Remote MQTT sync) */}
              {activeScreen === 'home' && !hasRegisteredEquipment &&
                renderNoEquipmentScreen('home-screen-empty', 'o painel do equipamento')}

              {activeScreen === 'home' && hasRegisteredEquipment && (
                <motion.div
                  key="home-screen"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-3"
                >
                  {/* LED & TIMERS Status Indicators */}
                  <div className="grid grid-cols-2 gap-2">
                      {/* Left: LED Status Indicator */}
                      <button
                        id="home-status-led"
                        onClick={() => setActiveScreen('led')}
                        className="p-3 bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 rounded-xl backdrop-blur-sm cursor-pointer transition-all active:scale-[0.98] text-left flex flex-col justify-between h-[72px] focus:outline-none focus:ring-1 focus:ring-[#4398fa]/50"
                        title="Ver controle do LED / Iluminação"
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-1.5">
                            <Flame className={`w-3.5 h-3.5 ${currentProgram !== '---' ? 'text-emerald-400' : 'text-rose-500'}`} />
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">LED</span>
                          </div>
                          <span className={`w-1.5 h-1.5 rounded-full ${currentProgram !== '---' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
                        </div>
                        
                        <div className="mt-1">
                          <p className="text-[11px] text-white font-bold truncate">
                            {currentProgram !== '---' ? `Prog: ${currentProgram}` : 'Sem Programa'}
                          </p>
                          <p className="text-[9px] text-slate-400 font-medium">
                            Status: <span className={currentProgram !== '---' ? 'text-emerald-400 font-bold' : 'text-rose-500 font-bold'}>
                              {currentProgram !== '---' ? 'LIGADO' : 'DESLIGADO'}
                            </span>
                          </p>
                        </div>
                      </button>

                      {/* Right: Timers Status Indicator */}
                      <button
                        id="home-status-timers"
                        onClick={() => setActiveScreen('timers')}
                        className="p-3 bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 rounded-xl backdrop-blur-sm cursor-pointer transition-all active:scale-[0.98] text-left flex flex-col justify-between h-[72px] focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                        title="Ver Programação de Timers / Automação"
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-cyan-400" />
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">TIMERS</span>
                          </div>
                          <span className={`w-1.5 h-1.5 rounded-full ${filterInit1 !== 'D' || filterInit2 !== 'D' || ledDuration !== '0' || (hidroTimerHours !== 'D' && hidroTimerHours !== 'off') ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
                        </div>
                        
                        <div className="mt-1">
                          <p className="text-[11px] text-white font-bold truncate">
                            {hasFilterTimer && (filterInit1 !== 'D' || filterInit2 !== 'D') ? (
                              `${activeMotorCount <= 2 ? motor2Name : motor4Name}: ${filterInit1 !== 'D' ? `T1 ${filterInit1}h(${filterHours1}h)` : ''}${filterInit1 !== 'D' && filterInit2 !== 'D' ? ' / ' : ''}${filterInit2 !== 'D' ? `T2 ${filterInit2}h(${filterHours2}h)` : ''}`
                            ) : (
                              `${hasFilterTimer ? (activeMotorCount <= 2 ? motor2Name : motor4Name) + ': Inativo' : 'Sem Filtragem Programada'}`
                            )}
                          </p>
                          <p className="text-[9px] text-slate-400 font-medium truncate flex items-center gap-1.5">
                            {hasLedTimer && (
                              <span>LED: <span className={ledDuration !== '0' ? 'text-emerald-400 font-bold' : 'text-rose-500 font-bold'}>{ledDuration !== '0' ? `${ledStartHour}h (${ledDuration}h)` : 'Inativo'}</span></span>
                            )}
                            {hasHidroTimer && hidroTimerHours !== 'D' && hidroTimerHours !== 'off' && (
                              <>
                                {hasLedTimer && <span>•</span>}
                                <span className="truncate">{motor1Name}: <span className="text-emerald-400 font-bold">{hidroTimerHours}h</span></span>
                              </>
                            )}
                          </p>
                        </div>
                      </button>
                    </div>

                    {/* Quick Status Block */}
                    <div className="grid grid-cols-2 gap-2 text-left">
                      {visibleMotorControls.map(({ number, name, on }) => (
                      <button
                          key={number}
                          id={`home-status-motor${number}`}
                        onClick={() => setActiveScreen('aux')}
                        className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl backdrop-blur-sm cursor-pointer transition-all active:scale-[0.98] h-[72px] flex flex-col justify-between focus:outline-none focus:ring-1 focus:ring-[#4398fa]/50"
                          title={`Ver controle: ${name}`}
                      >
                        <div className="flex items-center justify-between w-full">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate max-w-[80%]">{name}</span>
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${on ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
                        </div>
                        <div className="mt-1">
                            <p className={`text-xs font-bold ${on ? 'text-emerald-400' : 'text-rose-500'}`}>
                              {on ? 'LIGADO' : 'DESLIGADO'}
                          </p>
                        </div>
                      </button>
                      ))}
                    </div>
                </motion.div>
              )}

              {/* Screen: AUX (Motor Control) */}
              {activeScreen === 'aux' && !hasRegisteredEquipment &&
                renderNoEquipmentScreen('aux-screen-empty', 'o controle de motores')}

              {activeScreen === 'aux' && hasRegisteredEquipment && (
                <motion.div
                  key="aux-screen"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  <div className="p-4 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl shadow-lg">
                    <div className="mb-3 pb-1.5 border-b border-white/10 flex items-center justify-between gap-2">
                      <h3 className="text-xs font-bold text-[#4398fa] tracking-wider uppercase flex items-center gap-1">
                        <Sliders className="w-3.5 h-3.5" /> CONTROLE DE MOTORES ({activeMotorCount})
                      </h3>
                      <span className={`shrink-0 text-[9px] font-bold px-2 py-0.5 rounded-lg border ${
                        motorSettingsSaveState === 'saving'
                          ? 'text-amber-300 bg-amber-500/10 border-amber-500/20'
                          : motorSettingsSaveState === 'saved'
                            ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
                            : motorSettingsSaveState === 'error'
                              ? 'text-rose-300 bg-rose-500/10 border-rose-500/20'
                              : 'text-slate-500 bg-white/5 border-white/10'
                      }`}>
                        {motorSettingsSaveState === 'saving'
                          ? 'Salvando...'
                          : motorSettingsSaveState === 'saved'
                            ? 'Salvo'
                            : motorSettingsSaveState === 'error'
                              ? 'Erro'
                              : ''}
                      </span>
                    </div>

                    <div className="space-y-3 my-2 max-h-[62vh] overflow-y-auto pr-1">
                      {catalogLoading && (
                        <p className="py-6 text-center text-xs text-slate-400">Carregando configuração do modelo...</p>
                      )}
                      {!catalogLoading && !activeCatalogItem && (
                        <p className="py-6 text-center text-xs text-rose-300">
                          O modelo {activeModel} não possui configuração em devices_catalog.
                        </p>
                      )}
                      {visibleMotorControls.map(({ number, name, on, icon }) => (
                        <div key={number} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all shrink-0 ${on ? 'bg-[#4398fa]/10 border-[#4398fa]/20 text-[#4398fa]' : 'bg-white/5 border-white/10 text-slate-400'}`}>
                              {icon === 'droplet' ? <Droplet className="w-4 h-4" /> : icon === 'filter' ? <FolderSync className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                            </div>
                            <div className="flex flex-col min-w-0">
                              {editingMotorNum === number ? (
                                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => handleUpdateMotorName(number, e.target.value)}
                                    onBlur={() => {
                                      flushMotorNameUpdate(number, name);
                                      setEditingMotorNum(null);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        flushMotorNameUpdate(number, name);
                                        setEditingMotorNum(null);
                                      }
                                    }}
                                    autoFocus
                                    maxLength={30}
                                    className="text-xs font-bold text-white bg-white/10 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-[#4398fa] w-32 border border-white/20"
                                  />
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      flushMotorNameUpdate(number, name);
                                      setEditingMotorNum(null);
                                    }}
                                    className="text-emerald-400 hover:text-emerald-300 p-0.5"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 group min-w-0">
                                  <p className="text-xs font-bold text-white truncate">{name}</p>
                                  {canConfigureActiveDevice && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingMotorNum(number);
                                      }}
                                      title="Editar nome"
                                      className="text-slate-400 hover:text-white transition-colors shrink-0"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer shrink-0">
                            <input
                              type="checkbox"
                              checked={on}
                              disabled={!mqttConnected}
                              onChange={(e) => handleMotorChange(number, e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-10 h-6 bg-white/10 border border-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#4398fa] peer-checked:border-[#4398fa] peer-checked:shadow-[0_0_12px_rgba(0,102,221,0.4)]"></div>
                          </label>
                        </div>
                      ))}
                    </div>

                    {!mqttConnected && (
                      <p className="text-[10px] text-[#e8fa00]/90 leading-snug mt-3 flex items-start gap-1 bg-[#e8fa00]/10 p-2 rounded-xl border border-[#e8fa00]/25">
                        <Info className="w-3.5 h-3.5 shrink-0" />
                        Aviso: Para acionar os motores, certifique-se de realizar a conexão com o sistema remoto IoT na aba HOME.
                      </p>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Screen: LED Controller */}
              {activeScreen === 'led' && !hasRegisteredEquipment &&
                renderNoEquipmentScreen('led-screen-empty', 'o controle de iluminação LED')}

              {activeScreen === 'led' && hasRegisteredEquipment && (
                <motion.div
                  key="led-screen"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-2"
                >
                  {/* Dynamic Color Wheel element Target */}
                  <div className="p-2 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl flex flex-col items-center">
                    <div id={pickerContainerId} className="flex justify-center my-0.5" />
                  </div>

                  <div className="p-2.5 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl shadow-sm space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="w-[70px] text-[11px] font-bold text-slate-300 whitespace-nowrap">Saturação</div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={satMultiplier}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          lastUserColorInteractionRef.current = Date.now();
                          setSatMultiplier(val);
                          if (currentProgramRef.current === '---') {
                            setCurrentProgram(1);
                            const cleanId = cleanDeviceId(deviceId).trim() || deviceId.trim();
                            publishTopic(`MLZ/${cleanId}/led/ctrl`, "ON");
                            publishTopic(`MLZ/${cleanId}/led/pg`, "1");
                          }
                          if (mqttConnected) {
                            throttledPublishColor(ledHueRef.current, ledSatRef.current, ledValRef.current, val, brightMultiplierRef.current);
                          }
                        }}
                        className="flex-1 accent-blue-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                      />
                      <span className="w-10 text-right font-mono text-[11px] text-blue-400">{satMultiplier}%</span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="w-[70px] text-[11px] font-bold text-slate-300 whitespace-nowrap">Brilho</div>
                      <input  type="range"
                        min="0"
                        max="100"
                        value={brightMultiplier}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          lastUserColorInteractionRef.current = Date.now();
                          setBrightMultiplier(val);
                          if (currentProgramRef.current === '---') {
                            setCurrentProgram(1);
                            const cleanId = cleanDeviceId(deviceId).trim() || deviceId.trim();
                            publishTopic(`MLZ/${cleanId}/led/ctrl`, "ON");
                            publishTopic(`MLZ/${cleanId}/led/pg`, "1");
                          }
                          if (mqttConnected) {
                            throttledPublishColor(ledHueRef.current, ledSatRef.current, ledValRef.current, satMultiplierRef.current, val);
                          }
                        }}
                        className="flex-1 accent-blue-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                      />
                      <span className="w-10 text-right font-mono text-[11px] text-blue-400">{brightMultiplier}%</span>
                    </div>
                  </div>

                  {/* Program selection block */}
                  <div className="p-3 sm:p-4 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl space-y-3 -mx-3 sm:mx-0">
                    <div className="flex items-center justify-between px-1 py-0.5">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[11px] text-slate-300 font-bold uppercase tracking-wider">PROGRAMA ATUAL: </p>
                        <span className="text-[18px] font-black text-[#4398fa] font-mono">
                          {currentProgram === '---' ? '---' : currentProgram}
                        </span>
                      </div>
                      <select
                        value={currentProgram === '---' ? '---' : String(currentProgram)}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '---') {
                            handleProgramOff();
                          } else {
                            handleDirectProgramSelect(parseInt(val, 10));
                          }
                        }}
                        className="bg-slate-950/65 hover:bg-slate-900/80 transition-colors border border-white/10 text-[#4398fa] text-[11px] font-bold rounded-lg px-2 py-1 focus:outline-none"
                      >
                        <option value="---">---</option>
                        {Array.from({ length: 25 }, (_, i) => String(i + 1)).map((p) => (
                          <option key={p} value={p}>Programa {p}</option>
                        ))}
                      </select>
                    </div>

                    {/* Led Buttons control action rail - in a line (voltar, avançar, salvar, desligar) */}
                    <div className="grid grid-cols-4 gap-1.5">
                      <button
                        id="led-btn-voltar"
                        onClick={handleProgramDec}
                        className="py-2.5 bg-[#007AFF] hover:bg-[#4398fa] text-white rounded-xl text-[10.5px] sm:text-xs font-bold transition-all active:scale-95 text-center px-1 w-full"
                      >
                        Voltar
                      </button>
                      <button
                        id="led-btn-avancar"
                        onClick={handleProgramInc}
                        className="py-2.5 bg-[#007AFF] hover:bg-[#4398fa] text-white rounded-xl text-[10.5px] sm:text-xs font-bold transition-all active:scale-95 text-center px-1 w-full"
                      >
                        Avançar
                      </button>
                      <button
                        id="led-btn-salvar"
                        onClick={handleProgramSave}
                        className="py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10.5px] sm:text-xs font-bold transition-all active:scale-95 text-center px-1 w-full"
                      >
                        Salvar
                      </button>
                      <button
                        id="led-btn-desligar"
                        onClick={handleProgramOff}
                        className="py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-[10.5px] sm:text-xs font-bold transition-all active:scale-95 text-center px-1 w-full"
                      >
                        Desligar
                      </button>
                    </div>


                  </div>
                </motion.div>
              )}

              {/* Screen: Timers / Automação (Filtro & LED) */}
              {activeScreen === 'timers' && !hasRegisteredEquipment &&
                renderNoEquipmentScreen('timers-screen-empty', 'a programação de timers')}

              {activeScreen === 'timers' && hasRegisteredEquipment && (
                <motion.div
                  key="timers-screen"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  {!hasFilterTimer && !hasLedTimer && !hasHidroTimer && !hasSolarHeating && (
                    <div className="p-5 bg-white/5 border border-white/10 rounded-2xl text-center space-y-2">
                      <Clock className="w-8 h-8 text-slate-400 mx-auto" />
                      <p className="text-xs font-bold text-white">Nenhum Timer Habilitado</p>
                      <p className="text-[10px] text-slate-400">
                        O modelo <span className="text-[#4398fa] font-bold">{activeModel}</span> não possui timers (filtragem, iluminação ou hidro) habilitados.
                      </p>
                    </div>
                  )}

                  {/* FILTRAGEM Card */}
                  {hasFilterTimer && (
                    <div className="p-4 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl space-y-4">
                      <h3 className="text-xs font-bold text-[#4398fa] tracking-wider uppercase pb-1.5 border-b border-white/10 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> {activeMotorCount <= 2 ? motor2Name.toUpperCase() : motor4Name.toUpperCase()}
                      </h3>

                    <div className="space-y-4">
                      {/* TIMER 1 CONFIG */}
                      <div className="bg-white/5 p-3 rounded-xl border border-white/5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-extrabold text-[#4398fa] uppercase tracking-wider">Timer 1</span>
                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold border ${filterInit1 !== 'D' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-500 border-rose-500/30'}`}>
                            {filterInit1 !== 'D' ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-300 font-bold block">Início</label>
                            <select
                              value={filterInit1}
                              onChange={(e) => setFilterInit1(e.target.value)}
                              className="w-full bg-slate-900/80 border border-white/10 text-[#4398fa] text-xs font-bold rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#4398fa]"
                            >
                              <option value="D" className="bg-slate-950 text-slate-400 font-bold">D (Desligado)</option>
                              {Array.from({ length: 24 }, (_, i) => String(i)).map(h => (
                                <option key={h} value={h} className="bg-slate-950 text-[#4398fa] font-bold">{h}h</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-300 font-bold block">Qtd Horas</label>
                            <select
                              value={filterHours1}
                              onChange={(e) => setFilterHours1(e.target.value)}
                              disabled={filterInit1 === 'D'}
                              className={`w-full bg-slate-900/80 border border-white/10 text-xs font-bold rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#4398fa] ${filterInit1 === 'D' ? 'opacity-40 cursor-not-allowed text-slate-505' : 'text-[#4398fa]'}`}
                            >
                              {Array.from({ length: 12 }, (_, i) => String(i + 1)).map(h => (
                                <option key={h} value={h} className="bg-slate-950 text-[#4398fa] font-bold">{h}h</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* TIMER 2 CONFIG */}
                      <div className="bg-white/5 p-3 rounded-xl border border-white/5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-extrabold text-[#4398fa] uppercase tracking-wider">Timer 2</span>
                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold border ${filterInit2 !== 'D' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-500 border-rose-500/30'}`}>
                            {filterInit2 !== 'D' ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-300 font-bold block">Início</label>
                            <select
                              value={filterInit2}
                              onChange={(e) => setFilterInit2(e.target.value)}
                              className="w-full bg-slate-900/80 border border-white/10 text-[#4398fa] text-xs font-bold rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#4398fa]"
                            >
                              <option value="D" className="bg-slate-950 text-slate-400 font-bold">D (Desligado)</option>
                              {Array.from({ length: 24 }, (_, i) => String(i)).map(h => (
                                <option key={h} value={h} className="bg-slate-950 text-[#4398fa] font-bold">{h}h</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-300 font-bold block">Qtd Horas</label>
                            <select
                              value={filterHours2}
                              onChange={(e) => setFilterHours2(e.target.value)}
                              disabled={filterInit2 === 'D'}
                              className={`w-full bg-slate-900/80 border border-white/10 text-xs font-bold rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#4398fa] ${filterInit2 === 'D' ? 'opacity-40 cursor-not-allowed text-slate-505' : 'text-[#4398fa]'}`}
                            >
                              {Array.from({ length: 12 }, (_, i) => String(i + 1)).map(h => (
                                <option key={h} value={h} className="bg-slate-950 text-[#4398fa] font-bold">{h}h</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Seleção de Dias da Semana (DSTQQSS) */}
                    <div className="py-2.5 space-y-2 border-t border-white/5 select-none">
                      <div className="flex justify-between items-center px-0.5">
                        <label className="text-xs font-semibold text-slate-300">Dias de Funcionamento</label>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => setFilterDays([true, true, true, true, true, true, true])}
                            className="text-[9px] font-bold text-[#4398fa] bg-[#4398fa]/10 hover:bg-[#4398fa]/20 px-1.5 py-0.5 rounded transition-all"
                          >
                            Todos
                          </button>
                          <button
                            type="button"
                            onClick={() => setFilterDays([false, false, false, false, false, false, false])}
                            className="text-[9px] font-bold text-slate-400 bg-white/5 hover:bg-white/10 px-1.5 py-0.5 rounded transition-all"
                          >
                            Nenhum
                          </button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-7 gap-1 bg-white/5 p-2 rounded-xl border border-white/5">
                        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, idx) => {
                          const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                const copy = [...filterDays];
                                copy[idx] = !copy[idx];
                                setFilterDays(copy);
                              }}
                              className="flex flex-col items-center gap-1.5 py-1 focus:outline-none focus:ring-0 group"
                              title={dayNames[idx]}
                            >
                              <span className={`text-[11px] font-extrabold transition-colors ${filterDays[idx] ? 'text-[#4398fa]' : 'text-slate-400 group-hover:text-slate-300'}`}>
                                {day}
                              </span>
                              
                              {/* Custom Radio Button-Style Indicator */}
                              <div 
                                className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                                  filterDays[idx]
                                    ? 'border-[#4398fa] bg-[#4398fa]/20 shadow-[0_0_6px_rgba(0,102,221,0.4)]'
                                    : 'border-white/20 bg-transparent group-hover:border-slate-500'
                                }`}
                              >
                                {filterDays[idx] && (
                                  <div className="w-1.5 h-1.5 rounded-full bg-[#4398fa]" />
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      onClick={handleSaveFilter}
                      className="w-full py-2 bg-[#007AFF] hover:bg-[#4398fa] active:scale-95 text-xs text-white font-bold rounded-lg transition-all shadow-md shadow-[#007AFF]/20"
                    >
                      Salvar {activeMotorCount <= 2 ? motor2Name : motor4Name}
                    </button>
                  </div>
                  )}

                  {/* TIMER ILUMINAÇÃO Card */}
                  {hasLedTimer && (
                    <div className="p-4 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl space-y-3">
                    <h3 className="text-xs font-bold text-[#4398fa] tracking-wider uppercase pb-1.5 border-b border-white/10 flex items-center gap-1">
                      <SlidersHorizontal className="w-3.5 h-3.5" /> TIMER ILUMINAÇÃO
                    </h3>

                    <div className="flex items-center justify-between py-1">
                      <label className="text-xs font-medium text-slate-300">Hora Inicial</label>
                      <select
                        value={ledStartHour}
                        onChange={(e) => setLedStartHour(e.target.value)}
                        className="bg-white/5 hover:bg-white/10 px-2 py-1.5 rounded-lg border border-white/10 text-[#4398fa] text-xs font-bold focus:outline-none"
                      >
                        {['18','19','20','21','22','23'].map(h => (
                          <option key={h} value={h} className="bg-slate-950 text-[#4398fa] font-bold">{h}h</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center justify-between py-1">
                      <label className="text-xs font-medium text-slate-300">Qtd Horas</label>
                      <select
                        value={ledDuration}
                        onChange={(e) => setLedDuration(e.target.value)}
                        className="bg-white/5 hover:bg-white/10 px-2 py-1.5 rounded-lg border border-white/10 text-[#4398fa] text-xs font-bold focus:outline-none"
                      >
                        <option value="0">0 (Desligado)</option>
                        {[1,2,3,4,5,6,7,8,9,10,11,12].map(duration => (
                          <option key={duration} value={String(duration)}>{duration}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center justify-between py-1">
                      <label className="text-xs font-medium text-slate-300">Programação</label>
                      <select
                        value={ledProgram}
                        onChange={(e) => setLedProgram(e.target.value)}
                        className="bg-white/5 hover:bg-white/10 px-2 py-1.5 rounded-lg border border-white/10 text-[#4398fa] text-xs font-bold focus:outline-none"
                      >
                        {/* 0 to 25 */}
                        {Array.from({ length: 26 }, (_, i) => String(i)).map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                        <option value="ciano" className="text-[#00CED1] font-semibold">Ciano</option>
                        <option value="purpura" className="text-[#800080] font-semibold">Púrpura</option>
                        <option value="laranja" className="text-[#FF8C00] font-semibold">Laranja</option>
                      </select>
                    </div>

                    <button
                      onClick={handleSaveLedTimer}
                      className="w-full py-2 bg-[#007AFF] hover:bg-[#4398fa] active:scale-95 text-xs text-white font-bold rounded-lg transition-all shadow-md shadow-[#007AFF]/20"
                    >
                      Salvar Timer LED
                    </button>
                  </div>
                  )}

                  {/* TIMER HIDRO Card */}
                  {hasHidroTimer && (
                    <div className="p-4 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl space-y-3">
                    <h3 className="text-xs font-bold text-[#4398fa] tracking-wider uppercase pb-1.5 border-b border-white/10 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> TIMER {motor1Name.toUpperCase()}
                    </h3>

                    <form 
                      onSubmit={(e) => { 
                        e.preventDefault(); 
                        handleSaveHidroTimer(); 
                      }} 
                      className="space-y-3"
                    >
                      <div className="flex items-center justify-between py-1">
                        <label className="text-xs font-medium text-slate-300">Tempo de Duração</label>
                        <select
                          value={hidroTimerHours || 'D'}
                          onChange={(e) => setHidroTimerHours(e.target.value)}
                          className="bg-white/5 hover:bg-white/10 px-2 py-1.5 rounded-lg border border-white/10 text-[#4398fa] text-xs font-bold focus:outline-none"
                        >
                          <option value="D" className="bg-slate-950 text-slate-300 font-bold">D (Desligado)</option>
                          {Array.from({ length: 23 }, (_, i) => i + 1).map(h => (
                            <option key={h} value={String(h)} className="bg-slate-950 text-[#4398fa] font-bold">{h} {h === 1 ? 'Hora' : 'Horas'}</option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2 bg-[#007AFF] hover:bg-[#4398fa] active:scale-95 text-xs text-white font-bold rounded-lg transition-all shadow-md shadow-[#007AFF]/20"
                      >
                        Salvar Timer {motor1Name}
                      </button>
                    </form>
                  </div>
                  )}
                </motion.div>
              )}

              {/* Screen: SOLAR (Aquecimento Solar) */}
              {activeScreen === 'solar' && !hasRegisteredEquipment &&
                renderNoEquipmentScreen('solar-screen-empty', 'o controle de aquecimento solar')}

              {activeScreen === 'solar' && hasRegisteredEquipment && (
                <motion.div
                  key="solar-screen"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  {!hasSolarHeating ? (
                    <div className="p-5 bg-white/5 border border-white/10 rounded-2xl text-center space-y-2">
                      <Sun className="w-8 h-8 text-slate-400 mx-auto" />
                      <p className="text-xs font-bold text-white">Aquecimento Solar Desabilitado</p>
                      <p className="text-[10px] text-slate-400">
                        O modelo <span className="text-[#4398fa] font-bold">{activeModel}</span> não possui o recurso de aquecimento solar habilitado no catálogo de equipamentos.
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl space-y-4 shadow-lg text-left">
                      {/* Solar Header */}
                      <div className="pb-2 border-b border-white/10 flex items-center justify-between">
                        <h3 className="text-xs font-bold text-[#4398fa] tracking-wider uppercase flex items-center gap-1.5">
                          <Thermometer className="w-4 h-4 text-amber-400" /> SISTEMA DE AQUECIMENTO 
                        </h3>
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                          (sensorCollectorError || sensorPoolError || sensorErrorActive)
                            ? 'bg-rose-500/10 border-rose-500/20 text-rose-300' 
                            : solarWorkMode === 'off'
                              ? 'bg-white/5 border-white/10 text-slate-400'
                              : (sensorCollectorTemp - sensorPoolTemp >= solarDif)
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300 animate-pulse'
                                : 'bg-white/5 border-white/10 text-amber-300'
                        }`}>
                          {(sensorCollectorError || sensorPoolError || sensorErrorActive)
                            ? 'ALERTA DE ERRO' 
                            : solarWorkMode === 'off'
                              ? 'DESLIGADO'
                              : (sensorCollectorTemp - sensorPoolTemp >= solarDif)
                                ? 'CIRCULAÇÃO ATIVA'
                                : 'EM ESPERA'}
                        </span>
                      </div>

                      {/* Sensor Errors Banner (Item 4) */}
                      {(sensorCollectorError || sensorErrorActive || sensorPoolError) && (
                        <div className="space-y-2">
                          {(sensorCollectorError || sensorErrorActive) && (
                            <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl flex items-center gap-2.5 text-rose-300 animate-pulse">
                              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                              <div className="flex-1 text-xs font-bold">
                                Erro1: Sensor1 Coletor
                              </div>
                            </div>
                          )}
                          {sensorPoolError && (
                            <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl flex items-center gap-2.5 text-rose-300 animate-pulse">
                              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                              <div className="flex-1 text-xs font-bold">
                                Erro2: Sensor2 Piscina
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Seleção do Tipo de Sistema de Aquecimento (Solar / Elétrico) */}
                      <div className="p-3 bg-white/5 border border-white/10 rounded-xl space-y-2">
                        <label className="text-[11px] font-bold text-slate-300 block uppercase tracking-wider">
                          Tipo de Sistema de Aquecimento
                        </label>
                        <div className="grid grid-cols-2 gap-2.5">
                          <label 
                            onClick={() => setHeatingType('solar')}
                            className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all select-none ${
                              heatingType === 'solar'
                                ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 shadow-sm'
                                : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/10'
                            }`}
                          >
                            <input
                              type="radio"
                              name="heatingType"
                              value="solar"
                              checked={heatingType === 'solar'}
                              onChange={() => setHeatingType('solar')}
                              className="sr-only"
                            />
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all shrink-0 ${
                              heatingType === 'solar' ? 'border-amber-400 bg-amber-400/20 shadow-[0_0_8px_rgba(251,191,36,0.3)]' : 'border-white/30 bg-transparent'
                            }`}>
                              {heatingType === 'solar' && <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                            </div>
                            <div className="flex items-center text-xs font-bold truncate">
                              <span>Aquec. Solar</span>
                            </div>
                          </label>

                          <label 
                            onClick={() => setHeatingType('eletrico')}
                            className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all select-none ${
                              heatingType === 'eletrico'
                                ? 'bg-[#4398fa]/15 border-[#4398fa]/50 text-[#4398fa] shadow-sm'
                                : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/10'
                            }`}
                          >
                            <input
                              type="radio"
                              name="heatingType"
                              value="eletrico"
                              checked={heatingType === 'eletrico'}
                              onChange={() => setHeatingType('eletrico')}
                              className="sr-only"
                            />
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all shrink-0 ${
                              heatingType === 'eletrico' ? 'border-[#4398fa] bg-[#4398fa]/20 shadow-[0_0_8px_rgba(67,152,250,0.3)]' : 'border-white/30 bg-transparent'
                            }`}>
                              {heatingType === 'eletrico' && <div className="w-1.5 h-1.5 rounded-full bg-[#4398fa]" />}
                            </div>
                            <div className="flex items-center text-xs font-bold truncate">
                              <span>Trocador/Elétrico</span>
                            </div>
                          </label>
                        </div>
                      </div>

                      {/* TEMPERATURE GAUGE (Item 1 - Speedometer Style) */}
                      <div className="p-4 bg-black/25 border border-white/10 rounded-2xl flex flex-col items-center justify-center space-y-1 relative">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Temperatura Atual da Piscina
                        </span>

                        {/* Gauge SVG (Speedometer style: 25°C to 40°C) */}
                        {(() => {
                          const minTemp = 25;
                          const maxTemp = 40;
                          const displayTemp = sensorPoolError ? minTemp : Math.max(minTemp, Math.min(maxTemp, sensorPoolTemp));
                          const ratio = (displayTemp - minTemp) / (maxTemp - minTemp);
                          const needleAngleDeg = 180 - ratio * 180;
                          const needleRad = (needleAngleDeg * Math.PI) / 180;
                          const cx = 120;
                          const cy = 125;
                          const R_arc = 86;
                          const R_ticks = 70;
                          const R_label = 104;

                          // Needle Tapered Path calculation
                          const needleLength = 72;
                          const baseWidth = 5;
                          const tipX = cx + needleLength * Math.cos(needleRad);
                          const tipY = cy - needleLength * Math.sin(needleRad);
                          const perpAngle = needleRad + Math.PI / 2;
                          const b1x = cx + baseWidth * Math.cos(perpAngle);
                          const b1y = cy - baseWidth * Math.sin(perpAngle);
                          const b2x = cx - baseWidth * Math.cos(perpAngle);
                          const b2y = cy + baseWidth * Math.sin(perpAngle);

                          // Angles for 10 segment dividers
                          const dividerAngles = Array.from({ length: 11 }, (_, i) => 180 - (i * 18));

                          // Tick marks (31 ticks: 0 to 30)
                          const tickMarks = Array.from({ length: 31 }, (_, i) => {
                            const deg = 180 - i * 6;
                            const isMajor = i % 6 === 0;
                            return { deg, isMajor };
                          });

                          // Numeric labels: 25, 28, 31, 34, 37, 40
                          const labels = [
                            { val: 25, deg: 180 },
                            { val: 28, deg: 144 },
                            { val: 31, deg: 108 },
                            { val: 34, deg: 72 },
                            { val: 37, deg: 36 },
                            { val: 40, deg: 0 },
                          ];

                          return (
                            <div className="relative w-full max-w-[280px] flex flex-col items-center">
                              <svg viewBox="0 0 240 160" className="w-full overflow-visible">
                                {/* 1. Segmented Outer Arc (Green 25-34°C, Yellow 34-37°C, Red 37-40°C) */}
                                {/* Green Arc: 180° to 72° */}
                                <path
                                  d={`M ${cx - R_arc} ${cy} A ${R_arc} ${R_arc} 0 0 1 ${cx + R_arc * Math.cos(72 * Math.PI / 180)} ${cy - R_arc * Math.sin(72 * Math.PI / 180)}`}
                                  fill="none"
                                  stroke="#22c55e"
                                  strokeWidth="16"
                                  strokeLinecap="round"
                                />

                                {/* Yellow Arc: 72° to 36° */}
                                <path
                                  d={`M ${cx + R_arc * Math.cos(72 * Math.PI / 180)} ${cy - R_arc * Math.sin(72 * Math.PI / 180)} A ${R_arc} ${R_arc} 0 0 1 ${cx + R_arc * Math.cos(36 * Math.PI / 180)} ${cy - R_arc * Math.sin(36 * Math.PI / 180)}`}
                                  fill="none"
                                  stroke="#eab308"
                                  strokeWidth="16"
                                />

                                {/* Red Arc: 36° to 0° */}
                                <path
                                  d={`M ${cx + R_arc * Math.cos(36 * Math.PI / 180)} ${cy - R_arc * Math.sin(36 * Math.PI / 180)} A ${R_arc} ${R_arc} 0 0 1 ${cx + R_arc} ${cy}`}
                                  fill="none"
                                  stroke="#ef4444"
                                  strokeWidth="16"
                                  strokeLinecap="round"
                                />

                                {/* 2. Crisp Divider Gaps cutting through the Arc */}
                                {dividerAngles.map((deg) => {
                                  const rad = (deg * Math.PI) / 180;
                                  const x1 = cx + (R_arc - 10) * Math.cos(rad);
                                  const y1 = cy - (R_arc - 10) * Math.sin(rad);
                                  const x2 = cx + (R_arc + 10) * Math.cos(rad);
                                  const y2 = cy - (R_arc + 10) * Math.sin(rad);
                                  return (
                                    <line
                                      key={deg}
                                      x1={x1}
                                      y1={y1}
                                      x2={x2}
                                      y2={y2}
                                      stroke="#1e293b"
                                      strokeWidth="3"
                                    />
                                  );
                                })}

                                {/* 3. Inner Tick Track (Fine Speedometer Ticks) */}
                                {tickMarks.map(({ deg, isMajor }) => {
                                  const rad = (deg * Math.PI) / 180;
                                  const rInner = isMajor ? R_ticks - 8 : R_ticks - 4;
                                  const rOuter = R_ticks;
                                  const x1 = cx + rInner * Math.cos(rad);
                                  const y1 = cy - rInner * Math.sin(rad);
                                  const x2 = cx + rOuter * Math.cos(rad);
                                  const y2 = cy - rOuter * Math.sin(rad);
                                  return (
                                    <line
                                      key={deg}
                                      x1={x1}
                                      y1={y1}
                                      x2={x2}
                                      y2={y2}
                                      stroke="currentColor"
                                      strokeWidth={isMajor ? 1.8 : 1}
                                      className={isMajor ? 'gauge-tick-major' : 'gauge-tick-minor'}
                                      opacity={isMajor ? 1 : 0.55}
                                    />
                                  );
                                })}

                                {/* 4. Outer Numeric Labels (25, 28, 31, 34, 37, 40) */}
                                {labels.map(({ val, deg }) => {
                                  const rad = (deg * Math.PI) / 180;
                                  const lx = cx + R_label * Math.cos(rad);
                                  const ly = cy - R_label * Math.sin(rad) + 4;
                                  return (
                                    <text
                                      key={val}
                                      x={lx}
                                      y={ly}
                                      fontSize="11"
                                      fontWeight="bold"
                                      textAnchor="middle"
                                      className="gauge-temp-label font-mono drop-shadow-sm select-none"
                                    >
                                      {val}
                                    </text>
                                  );
                                })}

                                {/* 5. Tapered Needle (Black/Dark with White Accent) */}
                                {!sensorPoolError && (
                                  <>
                                    <polygon
                                      points={`${b1x},${b1y} ${b2x},${b2y} ${tipX},${tipY}`}
                                      fill="#0f172a"
                                      stroke="#ffffff"
                                      strokeWidth="1.5"
                                      className="drop-shadow-lg"
                                    />
                                    {/* Pivot Center Hub */}
                                    <circle cx={cx} cy={cy} r="9" fill="#0f172a" stroke="#ffffff" strokeWidth="2.5" />
                                    <circle cx={cx} cy={cy} r="3.5" fill="#ffffff" />
                                  </>
                                )}

                                {/* 6. Bottom Digital Readout */}
                                <text
                                  x={cx}
                                  y={cy + 26}
                                  textAnchor="middle"
                                  fontSize="20"
                                  fontWeight="900"
                                  className="gauge-temp-readout font-mono tracking-tight drop-shadow-md"
                                >
                                  {sensorPoolError ? 'ERR' : `${sensorPoolTemp} °C`}
                                </text>
                              </svg>
                            </div>
                          );
                        })()}

                        {/* Min and Max Summary Footer */}
                        <div className="w-full flex items-center justify-between pt-1 px-4 text-xs font-bold font-mono">
                          <div className="text-left space-y-0.5">
                            <span className="text-[10px] text-slate-400 block uppercase font-sans">Min</span>
                            <span className="text-emerald-400 font-extrabold">25ºC</span>
                          </div>
                          {heatingType === 'solar' && (
                            <div className="text-center text-[10px] text-slate-400 font-normal">
                              Coletor: <span className="text-amber-300 font-bold font-mono">{sensorCollectorError || sensorErrorActive ? 'ERR' : `${sensorCollectorTemp}°C`}</span>
                            </div>
                          )}
                          <div className="text-right space-y-0.5">
                            <span className="text-[10px] text-slate-400 block uppercase font-sans">Máx</span>
                            <span className="text-rose-400 font-extrabold">40ºC</span>
                          </div>
                        </div>
                      </div>

                      {/* MODO DE TRABALHO (Item 2) */}
                      <div className="p-3.5 bg-white/5 border border-white/10 rounded-xl space-y-2">
                        <label className="text-[11px] font-bold text-slate-300 block uppercase tracking-wider">
                          Modo de trabalho
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSolarWorkMode('off');
                            }}
                            className={`py-2.5 px-2 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                              solarWorkMode === 'off'
                                ? 'bg-rose-500/20 border-rose-500 text-rose-300 shadow-md'
                                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            <PowerOff className="w-4 h-4" />
                            <span>Desligado</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSolarWorkMode('manual');
                            }}
                            className={`py-2.5 px-2 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                              solarWorkMode === 'manual'
                                ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-md'
                                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            <Sliders className="w-4 h-4" />
                            <span>Manual</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSolarWorkMode('auto');
                            }}
                            className={`py-2.5 px-2 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                              solarWorkMode === 'auto'
                                ? 'bg-[#4398fa]/20 border-[#4398fa] text-[#4398fa] shadow-md'
                                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            <Cpu className="w-4 h-4" />
                            <span>Automático</span>
                          </button>
                        </div>
                      </div>

                      {/* PARÂMETROS DE CONFIGURAÇÃO (Item 3) */}
                      <div className="p-3.5 bg-white/5 border border-white/10 rounded-xl space-y-3">
                        <label className="text-[11px] font-bold text-slate-300 block uppercase tracking-wider">
                          Parâmetros de configuração
                        </label>

                        {/* Parameter 1: Piscina MAX (25 a 40°C, default 34°C) */}
                        <div className="p-3 bg-black/20 border border-white/10 rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white">Piscina MAX</span>
                            <span className="text-sm font-mono font-black text-amber-400">{solarPoolMax}°C</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSolarPoolMax(prev => Math.max(25, prev - 1))}
                              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center transition-all active:scale-95"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <input
                              type="range"
                              min="25"
                              max="40"
                              value={solarPoolMax}
                              onChange={(e) => setSolarPoolMax(parseInt(e.target.value))}
                              className="flex-1 accent-amber-400 cursor-pointer"
                            />
                            <button
                              type="button"
                              onClick={() => setSolarPoolMax(prev => Math.min(40, prev + 1))}
                              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center transition-all active:scale-95"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Parameter 2: DIF (2 a 20°C, default 4°C) - Only for Solar */}
                        {heatingType === 'solar' && (
                          <div className="p-3 bg-black/20 border border-white/10 rounded-xl space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-white">DIF (Diferencial de Temperatura)</span>
                              <span className="text-sm font-mono font-black text-[#4398fa]">{solarDif}°C</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setSolarDif(prev => Math.max(2, prev - 1))}
                                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center transition-all active:scale-95"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <input
                                type="range"
                                min="2"
                                max="20"
                                value={solarDif}
                                onChange={(e) => setSolarDif(parseInt(e.target.value))}
                                className="flex-1 accent-[#4398fa] cursor-pointer"
                              />
                              <button
                                type="button"
                                onClick={() => setSolarDif(prev => Math.min(20, prev + 1))}
                                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center transition-all active:scale-95"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* DIAGNÓSTICO E TESTE DE ERROS DE SENSORES */}
                      <div className="p-3.5 bg-white/5 border border-white/10 rounded-xl space-y-2">
                        <label className="text-[11px] font-bold text-slate-300 block uppercase tracking-wider">
                          Simulação / Diagnóstico de Erros
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const nextState = !sensorCollectorError;
                              setSensorCollectorError(nextState);
                              setSensorErrorActive(nextState);
                            }}
                            className={`py-2 px-2.5 rounded-xl border text-[11px] font-bold transition-all text-left flex items-center justify-between ${
                              sensorCollectorError || sensorErrorActive
                                ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                            }`}
                          >
                            <span>Simular Erro1 (Coletor)</span>
                            <span className="text-[10px] uppercase font-mono">{sensorCollectorError || sensorErrorActive ? 'ON' : 'OFF'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const nextState = !sensorPoolError;
                              setSensorPoolError(nextState);
                            }}
                            className={`py-2 px-2.5 rounded-xl border text-[11px] font-bold transition-all text-left flex items-center justify-between ${
                              sensorPoolError
                                ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                            }`}
                          >
                            <span>Simular Erro2 (Piscina)</span>
                            <span className="text-[10px] uppercase font-mono">{sensorPoolError ? 'ON' : 'OFF'}</span>
                          </button>
                        </div>
                      </div>

                    </div>
                  )}
                </motion.div>
              )}

              {/* Screen: Advanced Settings Configuration */}
              {activeScreen === 'setup' && (
                <motion.div
                  key="setup-screen"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="space-y-4 py-2"
                >
                  {/* SISTEMA REMOTO BLOCK PLACE AT THE TOP */}
                  <div className="app-setup-panel p-5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 shadow-xl py-5 text-left">
                    <h3 className="text-sm font-bold text-white mb-3">Sistema Remoto</h3>

                    {mqttErrorMsg && (
                      <div className="mb-3 px-3 py-2 bg-rose-500/10 rounded-lg text-[10px] text-rose-400 font-mono text-left max-h-16 overflow-y-auto border border-rose-500/20">
                        Erro MQTT: {mqttErrorMsg}
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-4 mt-2">
                      <div className="flex gap-2">
                        {!mqttConnected ? (
                          <button
                            onClick={connectMQTT}
                            className="px-5 py-2.5 bg-gradient-to-r from-[#0055CC] to-[#0077EE] hover:brightness-110 active:scale-95 text-white text-xs font-bold rounded-xl shadow-lg shadow-[#4398fa]/20 transition-all flex items-center gap-1.5"
                          >
                            Conectar Sistema
                          </button>
                        ) : (
                          <button
                            onClick={disconnectMQTT}
                            className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-rose-400 hover:text-white text-xs font-bold rounded-xl border border-white/10 transition-colors"
                          >
                            Desconectar
                          </button>
                        )}
                      </div>

                      {/* WiFi indicator aligned to the right of the button */}
                      <div className="w-10 h-10 bg-[#4398fa]/10 rounded-full flex items-center justify-center border border-[#4398fa]/20 shrink-0">
                        <Wifi className={`w-5 h-5 ${mqttConnected ? 'text-[#4398fa]' : 'text-slate-400'}`} />
                      </div>
                    </div>
                  </div>

                  {/* EQUIPMENT REGISTRATION BLOCK */}
                  <div id="equipment-registration-block" className="app-setup-panel p-5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 shadow-xl text-left space-y-4">
                    <h3 className="text-sm font-bold text-white pb-1.5 border-b border-white/10 flex items-center justify-between">
                      <span>Equipamentos</span>
                    </h3>

                    <div className="space-y-3.5">
                      {/* QR Code Scan Controls */}
                      {!isScanningQr && (
                        <div className="space-y-2">
                          <button
                            type="button"
                            onClick={startQrScanner}
                            className="w-full py-2.5 bg-gradient-to-r from-blue-600/20 to-cyan-600/20 hover:from-blue-600/35 hover:to-cyan-600/35 border border-cyan-500/20 hover:border-cyan-500/40 text-cyan-200 hover:text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <QrCode className="w-4 h-4 text-cyan-400 animate-pulse" />
                            <span>Escanear QR Code do Equipamento</span>
                          </button>
                          {qrScannerError && (
                            <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-[10px] text-red-400 font-semibold text-center leading-normal">
                              {qrScannerError}
                            </div>
                          )}
                        </div>
                      )}

                      {isScanningQr && (
                        <div className="relative overflow-hidden bg-black/40 border border-cyan-500/30 rounded-xl p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-400">
                              <Camera className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                              <span>Escaneando QR Code...</span>
                            </div>
                            <button
                              type="button"
                              onClick={stopQrScanner}
                              className="p-1 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-all cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="relative overflow-hidden rounded-lg bg-slate-950 aspect-square w-full max-w-[240px] mx-auto border border-white/5 shadow-inner flex items-center justify-center">
                            <div id="qr-reader" className="w-full h-full overflow-hidden [&_video]:object-cover" />
                            
                            {/* Visual Scanner Guide Frame */}
                            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                              {/* Laser Line */}
                              <div className="absolute w-[80%] h-[2px] bg-cyan-500 shadow-[0_0_12px_#22d3ee] animate-bounce" />
                              
                              {/* Glowing Corners */}
                              <div className="absolute w-36 h-36 border border-cyan-500/15 rounded-xl flex items-center justify-center">
                                <div className="absolute top-0 left-0 w-3.5 h-3.5 border-t-2 border-l-2 border-cyan-400" />
                                <div className="absolute top-0 right-0 w-3.5 h-3.5 border-t-2 border-r-2 border-cyan-400" />
                                <div className="absolute bottom-0 left-0 w-3.5 h-3.5 border-b-2 border-l-2 border-cyan-400" />
                                <div className="absolute bottom-0 right-0 w-3.5 h-3.5 border-b-2 border-r-2 border-cyan-400" />
                              </div>
                            </div>
                          </div>

                          {qrScannerError && (
                            <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-[10px] text-red-400 font-semibold text-center leading-normal">
                              {qrScannerError}
                            </div>
                          )}

                          <div className="text-[9px] text-slate-400 text-center font-medium leading-normal">
                            Aponte a câmera para o QR Code impresso no equipamento
                          </div>
                        </div>
                      )}

                      {scannedData && (
                        <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-xs space-y-2.5 animate-fadeIn text-left">
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-cyan-300 text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              Equipamento Detectado
                            </span>
                            <button 
                              onClick={() => setScannedData(null)}
                              className="text-[9px] text-slate-400 hover:text-white transition-all underline"
                            >
                              Limpar
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[10px] font-semibold bg-slate-950/45 p-2.5 rounded-lg border border-cyan-500/5">
                            <div>
                              <span className="text-slate-400 block font-normal text-[8.5px] uppercase tracking-wider">ID do Equipamento</span>
                              <span className="text-cyan-200 font-mono">{scannedData.deviceId}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block font-normal text-[8.5px] uppercase tracking-wider">Modelo</span>
                              <span className="text-cyan-200">{scannedData.model || 'Não especificado'}</span>
                            </div>
                            {scannedData.serial && (
                              <div>
                                <span className="text-slate-400 block font-normal text-[8.5px] uppercase tracking-wider">Número de Série</span>
                                <span className="text-cyan-200 font-mono">{scannedData.serial}</span>
                              </div>
                            )}
                            {scannedData.manufacturer && (
                              <div>
                                <span className="text-slate-400 block font-normal text-[8.5px] uppercase tracking-wider">Fabricante</span>
                                <span className="text-cyan-200">{scannedData.manufacturer}</span>
                              </div>
                            )}
                          </div>
                          
                          <button
                            type="button"
                            onClick={() => {
                              handleSaveEquipment(
                                scannedData.deviceId,
                                scannedData.model,
                                scannedData.serial,
                                scannedData.manufacturer,
                                scannedData.pairing_token || scannedData.provision || scannedData.token
                              );
                              setScannedData(null);
                            }}
                            className="w-full py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-[10px] font-bold rounded-lg shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>Confirmar e Ativar Equipamento</span>
                          </button>
                        </div>
                      )}



                      {/* Technical logging screen / Terminal output console */}
                      {bleLog.length > 0 && (
                        <div className="bg-black/40 border border-white/10 rounded-xl p-3 space-y-1.5">
                          <label className="text-[9px] text-[#007AFF] font-extrabold flex items-center justify-between gap-1.5 pb-1.5 border-b border-white/5">
                            <span className="flex items-center gap-1.5">
                              <Terminal className="w-3.5 h-3.5 text-blue-400" />
                              <span>CONSOLE DE REGISTRO DO EQUIPAMENTO</span>
                            </span>
                          </label>
                          <div className="max-h-24 overflow-y-auto font-mono text-[9px] text-slate-350 space-y-1 leading-normal pr-1 select-text">
                            {bleLog.map((line, idx) => (
                              <div key={idx} className={line.includes('Erro') || line.includes('[ERRO]') ? 'text-red-400 font-bold' : line.includes('sucesso') || line.includes('Sucesso') || line.includes('[SUCESSO]') ? 'text-emerald-400 font-bold' : ''}>
                                {line}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Registered Equipment List below QR Code scanner */}
                      <div className="pt-3 border-t border-white/10 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] text-cyan-300 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Equipamentos Cadastrados</span>
                          </label>
                          <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-bold border border-cyan-500/30">
                            {registeredEquipments.length} {registeredEquipments.length === 1 ? 'equipamento' : 'equipamentos'}
                          </span>
                        </div>

                        {registeredEquipments.length === 0 ? (
                          <div className="app-device-empty p-4 rounded-xl bg-slate-900/40 border border-white/5 text-center space-y-1">
                            <p className="text-xs text-slate-300 font-medium">Nenhum equipamento cadastrado ainda.</p>
                            <p className="text-[10px] text-slate-500">Escaneie o QR Code acima para vincular e gerenciar seu equipamento.</p>
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                            {registeredEquipments.map((eq) => {
                              const isActive = areDeviceIdsMatching(eq.id, deviceId);

                              return (
                                <div 
                                  key={eq.id} 
                                  className={`app-device-card flex items-center justify-between p-3 rounded-xl transition-all border ${
                                    isActive 
                                      ? 'app-device-card--active bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-cyan-500/15 border-emerald-500/40 shadow-lg shadow-emerald-500/10' 
                                      : 'app-device-card--idle bg-slate-900/60 border-white/10 hover:border-white/20 hover:bg-slate-900/80'
                                  }`}
                                >
                                  <div className="min-w-0 flex-1 pr-2">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-mono text-xs font-extrabold text-white break-all select-all">{eq.id}</span>
                                      <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-[9px] font-extrabold text-cyan-300 border border-cyan-500/30">{eq.model}</span>
                                      {eq.access === 'shared' && (
                                        <span className="px-1.5 py-0.5 rounded bg-violet-500/20 text-[9px] font-extrabold text-violet-300 border border-violet-500/30">
                                          Compartilhado{eq.permission === 'configure' ? ' • config' : ' • ctrl'}
                                        </span>
                                      )}
                                      {isActive ? (
                                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[9px] font-bold border border-emerald-500/30 flex items-center gap-1">
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                          Ativo
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[9px] font-bold border border-slate-700">
                                          Inativo
                                        </span>
                                      )}
                                    </div>

                                    <div className="mt-1 flex flex-col gap-0.5 text-left">
                                      <p className="text-[10px] text-slate-300 font-medium break-all">
                                        Série: <span className="font-mono text-white font-bold select-all">{eq.serial || eq.id}</span> • Fab: <span className="text-slate-200">{eq.manufacturer || 'MASTERLAZER'}</span>
                                      </p>
                                      {eq.userEmail && (
                                        <p className="text-[9px] text-cyan-400/90 font-medium flex items-center gap-1">
                                          Usuário: <span className="font-mono text-cyan-300">{eq.userEmail}</span>
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  {/* Action Controls: Ativar/Desativar, Compartilhar & Excluir */}
                                  <div className="flex items-center gap-2 shrink-0">
                                    {eq.access !== 'shared' && currentUser?.isSupabase && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          void openSharePanel(eq.id);
                                        }}
                                        className="p-1.5 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 rounded-lg transition-all cursor-pointer"
                                        title="Compartilhar acesso"
                                        aria-label="Compartilhar"
                                      >
                                        <Share2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    {isActive ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setDeviceId('');
                                          localStorage.removeItem('mqtt_device');
                                        }}
                                        className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-200 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                                        title="Desativar equipamento ativo"
                                      >
                                        <PowerOff className="w-3 h-3 text-amber-400" />
                                        <span>Desativar</span>
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setDeviceId(eq.id);
                                          localStorage.setItem('mqtt_device', eq.id);
                                        }}
                                        className="px-2.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-[10px] font-bold shadow-md transition-all flex items-center gap-1 cursor-pointer"
                                        title="Ativar equipamento para controle"
                                      >
                                        <CheckCircle2 className="w-3 h-3" />
                                        <span>Ativar</span>
                                      </button>
                                    )}

                                    {eq.access === 'shared' ? (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          void handleLeaveShared(eq.id);
                                        }}
                                        className="p-1.5 px-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                                        title="Sair deste equipamento compartilhado"
                                        aria-label="Sair"
                                      >
                                        <UserMinus className="w-3.5 h-3.5" />
                                        <span>Sair</span>
                                      </button>
                                    ) : confirmDeleteDeviceId === eq.id ? (
                                      <div className="flex items-center gap-1.5 animate-fadeIn">
                                        <button
                                          type="button"
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            const targetRaw = eq.id.toLowerCase();
                                            const targetClean = cleanDeviceId(eq.id).toLowerCase();
                                            const targetNoMlz = targetRaw.startsWith('mlz-') ? targetRaw.substring(4) : targetRaw;

                                            let cloudOk = true;
                                            if (isSupabaseConfigured() && currentUser?.isSupabase) {
                                              const userIdentifier = currentUser?.uid || currentUser?.id;
                                              cloudOk = await deleteDevice(eq.id, userIdentifier);
                                              if (!cloudOk) {
                                                showToast(
                                                  'Falha ao remover',
                                                  'Não foi possível desativar o equipamento no servidor. Tente novamente.',
                                                  'error'
                                                );
                                                setConfirmDeleteDeviceId(null);
                                                return;
                                              }
                                              logUserAction(`Desativou equipamento (soft delete): ${eq.id}`);
                                            }

                                            const filtered = registeredEquipments.filter(item => !areDeviceIdsMatching(item.id, eq.id));
                                            setRegisteredEquipments(filtered);
                                            localStorage.setItem('registered_equipments', JSON.stringify(filtered));

                                            try {
                                              const existingDeleted: string[] = JSON.parse(localStorage.getItem('deleted_device_ids') || '[]');
                                              const newDeleted = Array.from(new Set([
                                                ...existingDeleted,
                                                targetRaw,
                                                targetClean,
                                                targetNoMlz,
                                                `mlz-${targetNoMlz}`
                                              ].filter(Boolean)));
                                              localStorage.setItem('deleted_device_ids', JSON.stringify(newDeleted));
                                            } catch (err) {}

                                            setConfirmDeleteDeviceId(null);

                                            if (isActive) {
                                              const nextId = filtered.length > 0 ? filtered[0].id : '';
                                              setDeviceId(nextId);
                                              if (nextId) {
                                                localStorage.setItem('mqtt_device', nextId);
                                              } else {
                                                localStorage.removeItem('mqtt_device');
                                              }
                                            }
                                          }}
                                          className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-lg text-[10px] font-bold shadow-md transition-all flex items-center gap-1 cursor-pointer animate-pulse"
                                          title="Confirmar exclusão deste equipamento"
                                        >
                                          <Trash2 className="w-3 h-3 text-white" />
                                          <span>Confirmar?</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setConfirmDeleteDeviceId(null);
                                          }}
                                          className="p-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                                          title="Cancelar"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setConfirmDeleteDeviceId(eq.id);
                                        }}
                                        className="p-1.5 px-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 text-red-400 hover:text-red-300 rounded-lg transition-all flex items-center gap-1 text-[10px] font-bold cursor-pointer"
                                        title="Excluir equipamento"
                                      >
                                        <Trash2 className="w-3 h-3 text-rose-400" />
                                        <span>Excluir</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Firmware updates — only for models the user has registered */}
                  {operatorFirmwareUpdates.length > 0 && (
                    <div className="p-5 rounded-2xl bg-white/10 backdrop-blur-md border border-amber-400/20 shadow-xl text-left space-y-3">
                      <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          <RefreshCw className="w-4 h-4 text-amber-400" />
                          Atualização de Firmware
                        </h3>
                      </div>
                      <div className="space-y-2">
                        {operatorFirmwareUpdates.map((fw) => (
                          <div
                            key={fw.id}
                            className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-900/50 border border-white/10"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white">
                                {fw.model} • v{fw.versao}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate">{fw.nome}</p>
                            </div>
                            <button
                              type="button"
                              disabled={firmwareUpdatingModel === fw.model}
                              onClick={() => handleOperatorFirmwareUpdate(fw)}
                              className="shrink-0 px-3 py-2 bg-amber-400 hover:bg-amber-500 disabled:opacity-50 text-black text-[10px] font-bold rounded-xl flex items-center gap-1.5"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              {firmwareUpdatingModel === fw.model ? 'Enviando OTA...' : 'Atualizar'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Device Sync Info Summary */}
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2 text-xs backdrop-blur-sm">
                    <div className="flex justify-between items-center pb-2 border-b border-white/10">
                      <span className="text-slate-300">Identificação (ID)</span>
                      <span className="font-mono font-bold text-[#4398fa]">{deviceId || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-white/5">
                      <span className="text-slate-300">Status do Equipamento</span>
                      <span className={`font-bold transition-all px-2 py-0.5 rounded text-[10px] ${deviceOnline === true ? 'text-emerald-400 bg-emerald-500/10' : deviceOnline === false ? 'text-rose-400 bg-rose-500/10' : 'text-slate-400 bg-white/5'}`}>
                        {deviceOnline === true ? '● ONLINE' : deviceOnline === false ? '● OFFLINE' : '● AGUARDANDO...'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-white/5">
                      <span className="text-slate-300">Endereço IP</span>
                      <span className="font-mono font-semibold text-slate-450">{deviceIp || '---'}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-white/5">
                      <span className="text-slate-300">Endereço MAC</span>
                      <span className="font-mono font-semibold text-slate-450">{deviceMac || '---'}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-white/5">
                      <span className="text-slate-300">Modelo</span>
                      <span className="font-semibold text-slate-400">{deviceModelo || '---'}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-white/5">
                      <span className="text-slate-300">Serial</span>
                      <span className="font-mono font-semibold text-slate-400">{deviceSerial || '---'}</span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-slate-300">Conexão Ativa</span>
                      <span className={`font-semibold ${mqttConnected ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {mqttStatusMessage}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-slate-300">Servidor MQTT</span>
                      <span className="font-mono text-[10px] text-emerald-400 font-semibold">Servidor Central (Protegido)</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleBackToHome}
                      className="w-full py-2.5 bg-[#4398fa] text-white hover:bg-[#0055CC] text-xs font-bold rounded-xl shadow-lg shadow-[#4398fa]/20 active:scale-95 transition-all"
                    >
                      Voltar para o App
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Screen: Theme / Appearance */}
              {activeScreen === 'theme' && (
                <motion.div
                  key="theme-screen"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="flex flex-col h-full py-2 text-left space-y-4"
                >
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleBackToHome}
                      className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 active:bg-white/10"
                      aria-label="Voltar"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/25 flex items-center justify-center shrink-0">
                        <Palette className="w-4 h-4 text-violet-400" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-sm font-bold text-white leading-tight">Aparência</h2>
                        <p className="text-[10px] text-slate-400 truncate">Escolha o tema do aplicativo</p>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed px-0.5">
                    A preferência é salva na sua conta e sincroniza entre dispositivos.
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={themeSaving}
                      onClick={() => void handleSelectTheme('dark')}
                      className={`relative flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all active:scale-[0.98] disabled:opacity-60 ${
                        appTheme === 'dark'
                          ? 'border-[#007AFF] bg-[#007AFF]/10 shadow-lg shadow-[#007AFF]/10'
                          : 'border-white/10 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div className="w-full h-20 rounded-xl bg-black border border-[#38383A] flex items-center justify-center overflow-hidden">
                        <div className="w-[70%] h-[75%] rounded-lg bg-[#1C1C1E] border border-[#38383A] p-1.5 space-y-1">
                          <div className="h-1.5 w-1/2 rounded bg-[#0A84FF]" />
                          <div className="h-1 w-full rounded bg-white/15" />
                          <div className="h-1 w-3/4 rounded bg-white/15" />
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Moon className="w-3.5 h-3.5 text-slate-300" />
                        <span className="text-xs font-bold text-white">Escuro</span>
                      </div>
                      {appTheme === 'dark' && (
                        <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-[#007AFF] flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={themeSaving}
                      onClick={() => void handleSelectTheme('light')}
                      className={`relative flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all active:scale-[0.98] disabled:opacity-60 ${
                        appTheme === 'light'
                          ? 'border-[#007AFF] bg-[#007AFF]/10 shadow-lg shadow-[#007AFF]/10'
                          : 'border-white/10 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div className="w-full h-20 rounded-xl bg-[#F2F2F7] border border-[#C6C6C8] flex items-center justify-center overflow-hidden">
                        <div className="w-[70%] h-[75%] rounded-lg bg-white border border-[#C6C6C8] p-1.5 space-y-1 shadow-sm">
                          <div className="h-1.5 w-1/2 rounded bg-[#007AFF]" />
                          <div className="h-1 w-full rounded bg-[#E5E5EA]" />
                          <div className="h-1 w-3/4 rounded bg-[#E5E5EA]" />
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Sun className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-xs font-bold text-white">Claro</span>
                      </div>
                      {appTheme === 'light' && (
                        <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-[#007AFF] flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </span>
                      )}
                    </button>
                  </div>

                  {themeSaving && (
                    <p className="text-[10px] text-slate-400 text-center animate-pulse">Salvando preferência...</p>
                  )}

                  <div className="mt-auto pt-2">
                    <button
                      type="button"
                      onClick={handleBackToHome}
                      className="w-full py-2.5 bg-[#4398fa] text-white hover:bg-[#0055CC] text-xs font-bold rounded-xl shadow-lg shadow-[#4398fa]/20 active:scale-95 transition-all"
                    >
                      Voltar para o App
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Screen: Help / Support ticket */}
              {activeScreen === 'support' && (
                <motion.div
                  key="support-screen"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="flex flex-col h-full py-2 text-left space-y-4"
                >
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={closeSupportTicket}
                      className="app-btn-secondary p-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 active:bg-white/10"
                      aria-label="Voltar"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center shrink-0 app-help-icon">
                        <Headset className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-sm font-bold text-white leading-tight">Ajuda / Suporte</h2>
                        <p className="text-[10px] text-slate-400 truncate">Abra um chamado com a assistência</p>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed px-0.5">
                    Descreva o problema que está enfrentando.
                  </p>

                  <div className="app-help-panel p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wide">Assunto</label>
                      <input
                        type="text"
                        value={supportSubject}
                        onChange={(e) => setSupportSubject(e.target.value)}
                        placeholder="Ex.: Timer não liga, LED travado..."
                        maxLength={80}
                        className="app-field w-full px-3.5 py-2.5 bg-black/30 border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400/50"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wide">
                        Descrição do problema *
                      </label>
                      <textarea
                        value={supportDescription}
                        onChange={(e) => setSupportDescription(e.target.value)}
                        placeholder="Conte o que acontece, quando começou e se aparece alguma mensagem de erro..."
                        rows={5}
                        maxLength={1200}
                        className="app-field w-full px-3.5 py-2.5 bg-black/30 border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400/50 resize-none leading-relaxed"
                      />
                      <p className="text-[9px] text-slate-500 text-right">{supportDescription.length}/1200</p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wide">
                        Print / captura de tela
                      </label>

                      {supportScreenshotPreview ? (
                        <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black/40">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={supportScreenshotPreview}
                            alt="Preview do print"
                            className="w-full max-h-48 object-contain bg-black/50"
                          />
                          <button
                            type="button"
                            onClick={clearSupportScreenshot}
                            className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/70 border border-white/15 text-slate-200 hover:text-white"
                            aria-label="Remover print"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                          <p className="px-3 py-2 text-[10px] text-slate-400 truncate border-t border-white/10">
                            {supportScreenshot?.name}
                          </p>
                        </div>
                      ) : (
                        <label className="app-help-upload flex flex-col items-center justify-center gap-2 w-full min-h-[96px] px-4 py-4 rounded-2xl border border-dashed border-emerald-400/30 bg-emerald-400/5 hover:bg-emerald-400/10 cursor-pointer transition-colors">
                          <ImagePlus className="w-5 h-5 text-emerald-400" />
                          <span className="text-[11px] font-bold text-slate-200">Anexar print do problema</span>
                          <span className="text-[9px] text-slate-500">JPG, PNG ou WEBP</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleSupportScreenshotChange}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1 pb-2 mt-auto">
                    <button
                      type="button"
                      onClick={closeSupportTicket}
                      className="app-btn-secondary flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-xs font-bold active:bg-white/10"
                    >
                      Voltar
                    </button>
                    <button
                      type="button"
                      disabled={supportSending || !supportDescription.trim()}
                      onClick={() => void handleSubmitSupportTicket()}
                      className="flex-[1.4] py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold shadow-lg shadow-emerald-900/30 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {supportSending ? 'Abrindo...' : 'Enviar no WhatsApp'}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Screen: Share device access (create invite / manage members) */}
              {activeScreen === 'share' && shareDeviceId && (
                <motion.div
                  key="share-screen"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4 py-2 text-left"
                >
                  <div className="flex items-center gap-2">
                    <div className="min-w-0">
                      <h2 className="text-sm font-bold text-white flex items-center gap-2">
                        <Share2 className="w-4 h-4 text-sky-400 shrink-0" />
                        Compartilhar
                      </h2>
                      <p className="text-[10px] text-slate-400 font-mono truncate">{shareDeviceId}</p>
                    </div>
                  </div>

                  {(() => {
                    const shareEq = registeredEquipments.find((e) => e.id === shareDeviceId);
                    return shareEq ? (
                      <div className="p-3 rounded-xl bg-white/10 border border-white/10">
                        <p className="text-xs font-bold text-white">{shareEq.model}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Série: <span className="font-mono text-slate-200">{shareEq.serial || shareEq.id}</span>
                        </p>
                      </div>
                    ) : null;
                  })()}

                  <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 space-y-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Permissão do convite</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => { setSharePermission('control'); setShareInvite(null); }}
                        className={`text-left p-3 rounded-xl border transition-all ${
                          sharePermission === 'control'
                            ? 'border-sky-500/50 bg-sky-500/10'
                            : 'border-white/10 bg-white/5'
                        }`}
                      >
                        <p className="text-[11px] font-bold text-white leading-tight">Só controlar</p>
                        <p className="text-[9px] text-slate-400 mt-1 leading-snug">Motores e LED </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => { setSharePermission('configure'); setShareInvite(null); }}
                        className={`text-left p-3 rounded-xl border transition-all ${
                          sharePermission === 'configure'
                            ? 'border-sky-500/50 bg-sky-500/10'
                            : 'border-white/10 bg-white/5'
                        }`}
                      >
                        <p className="text-[11px] font-bold text-white leading-tight">Controlar + Configurar</p>
                        <p className="text-[9px] text-slate-400 mt-1 leading-snug">Editar timers, nomes e configurações</p>
                      </button>
                    </div>

                    {!shareInvite ? (
                      <button
                        type="button"
                        disabled={shareBusy}
                        onClick={() => void handleCreateShareInvite()}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 active:scale-[0.98] text-white text-xs font-bold disabled:opacity-50"
                      >
                        {shareBusy ? 'Gerando...' : 'Gerar link'}
                      </button>
                    ) : (
                      <div className="space-y-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
                        <p className="text-[11px] text-emerald-200 font-medium">Convite pronto</p>
                        <p className="text-[10px] text-emerald-200/80">Válido por 24 horas — uso único</p>
                        <a
                          href={buildWhatsAppShareUrl(
                            buildInviteUrl(shareInvite.token),
                            registeredEquipments.find((e) => e.id === shareDeviceId)?.model || 'MM12TW',
                            registeredEquipments.find((e) => e.id === shareDeviceId)?.serial || shareDeviceId,
                            shareInvite.permission
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full py-3 rounded-xl bg-[#25D366] active:bg-[#1ebe57] text-white text-xs font-bold text-center"
                        >
                          Enviar no WhatsApp
                        </a>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(buildInviteUrl(shareInvite.token));
                            } catch {
                              showToast('Link', buildInviteUrl(shareInvite.token), 'info');
                            }
                          }}
                          className="w-full py-2.5 rounded-xl bg-white/10 active:bg-white/15 border border-white/10 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          Copiar link
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 space-y-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Quem tem acesso</p>
                    {shareBusy && shareMembers.length === 0 ? (
                      <p className="text-[11px] text-slate-500">Carregando...</p>
                    ) : shareMembers.length === 0 ? (
                      <p className="text-[11px] text-slate-500">Ninguém além de você.</p>
                    ) : (
                      <div className="space-y-2">
                        {shareMembers.map((m) => (
                          <div key={m.id} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-900/50 border border-white/10">
                            <div className="min-w-0">
                              <p className="text-[11px] font-bold text-white truncate">{m.full_name || m.email || m.user_id}</p>
                              {m.email && m.full_name && (
                                <p className="text-[10px] text-slate-400 truncate">{m.email}</p>
                              )}
                              <p className="text-[9px] text-sky-300 mt-0.5">
                                {m.permission === 'configure' ? 'Controlar + configurar' : 'Só controlar'}
                              </p>
                            </div>
                            <button
                              type="button"
                              disabled={shareBusy}
                              onClick={() => void handleRevokeMember(m.user_id)}
                              className="px-2.5 py-1.5 rounded-lg bg-red-500/15 active:bg-red-500/25 border border-red-500/30 text-red-300 text-[10px] font-bold shrink-0"
                            >
                              Revogar
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={closeSharePanel}
                    className="w-full py-2.5 bg-white/5 border border-white/10 text-slate-300 active:bg-white/10 text-xs font-semibold rounded-xl"
                  >
                    Voltar
                  </button>
                </motion.div>
              )}

              {/* Screen: Accept shared equipment invite */}
              {activeScreen === 'invite' && (
                <motion.div
                  key="invite-screen"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="flex flex-col h-full py-4 text-left"
                >
                  <div className="flex items-center gap-2 mb-5">
                    <button
                      type="button"
                      onClick={dismissInviteScreen}
                      className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 active:bg-white/10"
                      aria-label="Voltar"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div>
                      <h2 className="text-sm font-bold text-white flex items-center gap-2">
                        <Share2 className="w-4 h-4 text-sky-400" />
                        Convite
                      </h2>
                      <p className="text-[10px] text-slate-400">Acesso compartilhado a um equipamento</p>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col gap-4">
                    {!invitePreview ? (
                      <div className="p-5 rounded-2xl bg-white/10 border border-white/10 text-center">
                        <p className="text-xs text-slate-300">Carregando convite...</p>
                      </div>
                    ) : invitePreview.status === 'pending' ? (
                      <>
                        <div className="p-5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 space-y-3">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Equipamento</p>
                          <p className="text-base font-bold text-white">{invitePreview.model || 'Equipamento'}</p>
                          <p className="text-[11px] text-slate-300 font-mono break-all">
                            {invitePreview.serial || invitePreview.device_id}
                          </p>
                          <div className="pt-2 border-t border-white/10">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Permissão</p>
                            <p className="text-xs text-sky-300 font-semibold">
                              {invitePreview.permission === 'configure'
                                ? 'Controlar + configurar'
                                : 'Só controlar'}
                            </p>
                            <p className="text-[10px] text-slate-500 mt-1">
                              {invitePreview.permission === 'configure'
                                ? 'Você poderá acionar o equipamento e editar nomes.'
                                : 'Você poderá acionar motores, LED e timers — sem editar nomes.'}
                            </p>
                            <p className="text-[10px] text-slate-500 mt-2">Este link expira em 24 horas se não for aceito.</p>
                          </div>
                        </div>

                        {currentUser?.isSupabase ? (
                          <button
                            type="button"
                            disabled={inviteAcceptBusy}
                            onClick={() => void handleAcceptPendingInvite()}
                            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 active:scale-[0.98] text-white text-sm font-bold disabled:opacity-50 shadow-lg shadow-sky-900/30"
                          >
                            {inviteAcceptBusy ? 'Aceitando...' : 'Aceitar convite'}
                          </button>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-[11px] text-slate-300 text-center px-2">
                              Entre na sua conta (ou crie uma) para aceitar este convite.
                            </p>
                            <button
                              type="button"
                              onClick={() => setActiveScreen('login')}
                              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 active:scale-[0.98] text-white text-sm font-bold"
                            >
                              Entrar
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveScreen('register')}
                              className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-slate-200 text-xs font-bold active:bg-white/10"
                            >
                              Criar conta
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-3">
                        <p className="text-sm font-bold text-amber-100">
                          {invitePreview.status === 'accepted'
                            ? 'Este convite já foi usado.'
                            : invitePreview.status === 'expired'
                            ? 'Este convite expirou (válido por 24 horas). Peça um novo link ao dono.'
                            : invitePreview.status === 'revoked'
                            ? 'Este convite foi revogado.'
                            : 'Convite inválido ou expirado.'}
                        </p>
                        <button
                          type="button"
                          onClick={dismissInviteScreen}
                          className="w-full py-3 rounded-xl bg-white/10 border border-white/10 text-white text-xs font-bold"
                        >
                          Continuar
                        </button>
                      </div>
                    )}
                  </div>

                  {invitePreview?.status === 'pending' && (
                    <button
                      type="button"
                      onClick={dismissInviteScreen}
                      className="mt-4 w-full py-2.5 bg-transparent text-slate-400 text-xs font-semibold"
                    >
                      Agora não
                    </button>
                  )}
                </motion.div>
              )}

              {/* Screen: PC Administration & Owner Dashboard */}
              {activeScreen === 'admin' && (
                <motion.div
                  key="admin-screen"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="flex-1 flex flex-col space-y-6 text-left"
                >
                  {/* Dashboard Header Panel */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
                        <Shield className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-white tracking-tight">Painel Administrativo do Proprietário</h2>
                        <p className="text-xs text-slate-400">Acesso restrito para gerenciamento de usuários e equipamentos.</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          if (adminTab === 'home') {
                            setActiveScreen('home');
                          } else {
                            setAdminTab('home');
                          }
                        }}
                        className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 hover:text-amber-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-md shadow-amber-500/5"
                      >
                        {adminTab === 'home' ? (
                          <>
                            <Sliders className="w-4 h-4" />
                            Voltar para o App
                          </>
                        ) : (
                          <>
                            <ChevronRight className="w-4 h-4 rotate-180" />
                            Voltar para Home Admin
                          </>
                        )}
                      </button>
                      <button
                        onClick={handleLogout}
                        className="px-4 py-2 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-bold transition-all active:scale-95"
                      >
                        Sair do App
                      </button>
                    </div>
                  </div>

                  {/* Tab Selector bar */}
                  <div className="flex border-b border-white/10 overflow-x-auto pb-px gap-1">
                    <button
                      onClick={() => setAdminTab('home')}
                      className={`px-5 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
                        adminTab === 'home'
                          ? 'border-amber-400 text-amber-400 bg-white/5'
                          : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/2'
                      }`}
                    >
                      <Home className="w-4 h-4" />
                      Home Admin
                    </button>
                    <button
                      onClick={() => setAdminTab('aba1')}
                      className={`px-5 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
                        adminTab === 'aba1'
                          ? 'border-amber-400 text-amber-400 bg-white/5'
                          : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/2'
                      }`}
                    >
                      <Users className="w-4 h-4" />
                      Usuários & Equipamentos
                    </button>
                    <button
                      onClick={() => setAdminTab('firmware')}
                      className={`px-5 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
                        adminTab === 'firmware'
                          ? 'border-amber-400 text-amber-400 bg-white/5'
                          : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/2'
                      }`}
                    >
                      <Upload className="w-4 h-4" />
                      Atualizações de Firmware
                    </button>
                    <button
                      onClick={() => setAdminTab('aba3')}
                      className={`px-5 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
                        adminTab === 'aba3'
                          ? 'border-amber-400 text-amber-400 bg-white/5'
                          : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/2'
                      }`}
                    >
                      <Activity className="w-4 h-4" />
                      Logs & Auditoria
                    </button>
                    <button
                      onClick={() => setAdminTab('aba4')}
                      className={`px-5 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
                        adminTab === 'aba4'
                          ? 'border-amber-400 text-amber-400 bg-white/5'
                          : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/2'
                      }`}
                    >
                      <Database className="w-4 h-4" />
                      Info Técnica & MQTT
                    </button>
                    <button
                      onClick={() => setAdminTab('aba5')}
                      className={`px-5 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
                        adminTab === 'aba5'
                          ? 'border-amber-400 text-amber-400 bg-white/5'
                          : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/2'
                      }`}
                    >
                      <SlidersHorizontal className="w-4 h-4" />
                      Catálogo de Dispositivos
                    </button>
                    <button
                      onClick={() => setAdminTab('production')}
                      className={`px-5 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
                        adminTab === 'production'
                          ? 'border-amber-400 text-amber-400 bg-white/5'
                          : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/2'
                      }`}
                    >
                      <Factory className="w-4 h-4" />
                      Produção
                    </button>
                    <button
                      onClick={() => setAdminTab('brand')}
                      className={`px-5 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
                        adminTab === 'brand'
                          ? 'border-amber-400 text-amber-400 bg-white/5'
                          : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/2'
                      }`}
                    >
                      <Upload className="w-4 h-4" />
                      Logo do Fabricante
                    </button>
                  </div>

                  {/* Tab Body Contents */}
                  <div className="flex-1 min-h-[400px]">
                    
                    {/* Tab Home: Admin Panel Hub */}
                    {adminTab === 'home' && (
                      <div className="space-y-6">
                        {/* Welcome banner & Stats Overview */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div className="p-5 bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20 rounded-2xl flex flex-col justify-between">
                            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Usuários Operadores</span>
                            <div className="flex items-baseline gap-2 mt-2">
                              <span className="text-3xl font-extrabold text-white">{simUsers.filter(u => u.role === 'operator').length}</span>
                              <span className="text-xs text-amber-400 font-semibold">Ativos</span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2 font-medium">Contas de instaladores / residências cadastradas.</p>
                          </div>

                          <div className="p-5 bg-gradient-to-br from-[#007AFF]/10 to-[#4398fa]/5 border border-[#007AFF]/20 rounded-2xl flex flex-col justify-between">
                            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Equipamentos Totais</span>
                            <div className="flex items-baseline gap-2 mt-2">
                              <span className="text-3xl font-extrabold text-white">{adminAllDevices.length}</span>
                              <span className="text-xs text-[#4398fa] font-semibold">Dispositivos</span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2 font-medium">Equipamentos cadastrados em todo o sistema.</p>
                          </div>

                          <div className="p-5 bg-gradient-to-br from-purple-500/10 to-pink-500/5 border border-purple-500/20 rounded-2xl flex flex-col justify-between">
                            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Eventos de Auditoria</span>
                            <div className="flex items-baseline gap-2 mt-2">
                              <span className="text-3xl font-extrabold text-white">{auditEvents.length}</span>
                              <span className="text-xs text-purple-400 font-semibold">Registros</span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2 font-medium">Eventos gravados em audit_events (Supabase).</p>
                          </div>

                          <div className="p-5 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/20 rounded-2xl flex flex-col justify-between">
                            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Modelos no Catálogo</span>
                            <div className="flex items-baseline gap-2 mt-2">
                              <span className="text-3xl font-extrabold text-white">{deviceCatalog.length}</span>
                              <span className="text-xs text-emerald-400 font-semibold">Modelos</span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2 font-medium">Modelos de equipamento cadastrados no catálogo.</p>
                          </div>
                        </div>

                        {/* Quick Access Grid */}
                        <div className="space-y-4">
                          <h3 className="text-xs font-bold text-amber-400 uppercase tracking-widest text-left">Navegação Administrativa</h3>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Card 1 */}
                            <button
                              onClick={() => setAdminTab('aba1')}
                              className="p-5 bg-white/5 border border-white/10 hover:border-amber-400/50 hover:bg-white/10 rounded-2xl text-left transition-all group flex gap-4 items-start active:scale-[0.99]"
                            >
                              <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl group-hover:scale-110 transition-transform">
                                <Users className="w-5 h-5" />
                              </div>
                              <div className="space-y-1">
                                <h4 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors font-sans">Usuários & Equipamentos</h4>
                                <p className="text-xs text-slate-400 leading-relaxed">Cadastre e edite operadores, vincule e gerencie equipamentos residenciais em tempo real.</p>
                              </div>
                            </button>

                            {/* Card 2 */}
                            <button
                              onClick={() => setAdminTab('aba3')}
                              className="p-5 bg-white/5 border border-white/10 hover:border-amber-400/50 hover:bg-white/10 rounded-2xl text-left transition-all group flex gap-4 items-start active:scale-[0.99]"
                            >
                              <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl group-hover:scale-110 transition-transform">
                                <Activity className="w-5 h-5" />
                              </div>
                              <div className="space-y-1">
                                <h4 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors font-sans">Logs & Auditoria</h4>
                                <p className="text-xs text-slate-400 leading-relaxed">Monitore os eventos registrados em audit_events, com KPIs e histórico detalhado.</p>
                              </div>
                            </button>

                            {/* Card 3 */}
                            <button
                              onClick={() => setAdminTab('firmware')}
                              className="p-5 bg-white/5 border border-white/10 hover:border-amber-400/50 hover:bg-white/10 rounded-2xl text-left transition-all group flex gap-4 items-start active:scale-[0.99]"
                            >
                              <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl group-hover:scale-110 transition-transform">
                                <Upload className="w-5 h-5" />
                              </div>
                              <div className="space-y-1">
                                <h4 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors font-sans">Atualizações de Firmware</h4>
                                <p className="text-xs text-slate-400 leading-relaxed">Publique e gerencie versões de firmware OTA por modelo de equipamento.</p>
                              </div>
                            </button>

                            {/* Card 4 */}
                            <button
                              onClick={() => setAdminTab('aba5')}
                              className="p-5 bg-white/5 border border-white/10 hover:border-amber-400/50 hover:bg-white/10 rounded-2xl text-left transition-all group flex gap-4 items-start active:scale-[0.99]"
                            >
                              <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl group-hover:scale-110 transition-transform">
                                <SlidersHorizontal className="w-5 h-5" />
                              </div>
                              <div className="space-y-1">
                                <h4 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors font-sans">Catálogo de Dispositivos</h4>
                                <p className="text-xs text-slate-400 leading-relaxed">Gerencie os modelos disponíveis e suas capacidades (motores, timers, aquecimento solar).</p>
                              </div>
                            </button>

                            {/* Card production */}
                            <button
                              onClick={() => setAdminTab('production')}
                              className="p-5 bg-white/5 border border-white/10 hover:border-amber-400/50 hover:bg-white/10 rounded-2xl text-left transition-all group flex gap-4 items-start active:scale-[0.99]"
                            >
                              <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl group-hover:scale-110 transition-transform">
                                <Factory className="w-5 h-5" />
                              </div>
                              <div className="space-y-1">
                                <h4 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors font-sans">Produção (Whitelist)</h4>
                                <p className="text-xs text-slate-400 leading-relaxed">
                                  Cadastre aparelhos fabricados via QR e veja quantos usuários têm cada modelo instalado.
                                </p>
                              </div>
                            </button>

                            {/* Card 5 */}
                            <button
                              onClick={() => setAdminTab('aba4')}
                              className="p-5 bg-white/5 border border-white/10 hover:border-amber-400/50 hover:bg-white/10 rounded-2xl text-left transition-all group flex gap-4 items-start active:scale-[0.99]"
                            >
                              <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl group-hover:scale-110 transition-transform">
                                <Database className="w-5 h-5" />
                              </div>
                              <div className="space-y-1">
                                <h4 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors font-sans">Configurações de Conexão MQTT</h4>
                                <p className="text-xs text-slate-400 leading-relaxed">Configure endereços do broker, portas, tópicos customizados, credenciais e info técnica.</p>
                              </div>
                            </button>

                            {/* Card 6 */}
                            <button
                              onClick={() => setAdminTab('brand')}
                              className="p-5 bg-white/5 border border-white/10 hover:border-amber-400/50 hover:bg-white/10 rounded-2xl text-left transition-all group flex gap-4 items-start active:scale-[0.99]"
                            >
                              <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl group-hover:scale-110 transition-transform">
                                <Upload className="w-5 h-5" />
                              </div>
                              <div className="space-y-1">
                                <h4 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors font-sans">Logo do Fabricante & Identidade</h4>
                                <p className="text-xs text-slate-400 leading-relaxed">Personalize a logomarca do fabricante exibida no cabeçalho principal do aplicativo.</p>
                              </div>
                            </button>
                          </div>
                        </div>

                        {/* Últimos eventos preview */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-sm font-bold text-white">Últimos Eventos</h3>
                              <p className="text-[10px] text-slate-400">5 eventos mais recentes de audit_events</p>
                            </div>
                            <button
                              onClick={() => setAdminTab('aba3')}
                              className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 hover:text-amber-300 text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
                            >
                              Ver Todos
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="divide-y divide-white/5">
                            {auditEvents.slice(0, 5).map((event) => (
                              <div key={event.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                                <div className="min-w-0 flex-1">
                                  <p className="text-white font-semibold truncate">{formatAuditEventType(event.event_type)}</p>
                                  <p className="text-[10px] text-slate-400 truncate">
                                    {event.actor_email || '—'} · {event.entity_type}/{event.entity_id}
                                    {' · '}
                                    {formatAuditMetadata(event.metadata, event.event_type)}
                                  </p>
                                </div>
                                <span className="text-[10px] text-slate-500 font-mono whitespace-nowrap">
                                  {new Date(event.created_at).toLocaleString('pt-BR')}
                                </span>
                              </div>
                            ))}
                            {auditEvents.length === 0 && (
                              <p className="py-4 text-center text-xs text-slate-500">
                                {auditLoading ? 'Carregando eventos...' : 'Nenhum evento em audit_events ainda.'}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Back to App */}
                        <div className="flex justify-center pt-2">
                          <button
                            onClick={() => setActiveScreen('home')}
                            className="px-6 py-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 hover:text-amber-300 rounded-xl text-xs font-bold transition-all flex items-center gap-2 active:scale-95 shadow-lg shadow-amber-500/5"
                          >
                            <Sliders className="w-4 h-4" />
                            Voltar ao App
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {/* Tab 1: Users & Equipments */}
                    {adminTab === 'aba1' && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                          
                          {/* Users panel */}
                          <div className="lg:col-span-7 bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="text-sm font-bold text-white">Usuários Cadastrados</h3>
                                <p className="text-[10px] text-slate-400">Total de {simUsers.length} usuários registrados neste navegador</p>
                              </div>
                              <button
                                onClick={() => {
                                  setSelectedUserForEdit(null);
                                  setUserFormEmail('');
                                  setUserFormPassword('');
                                  setUserFormRole('operator');
                                  setUserModalOpen('add');
                                }}
                                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold rounded-lg transition-all flex items-center gap-1"
                              >
                                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                                Novo Usuário
                              </button>
                            </div>

                            {/* Inline Modal Form Container (Avoid overlays, stays inside layout) */}
                            {userModalOpen && (
                              <form
                                onSubmit={userModalOpen === 'add' ? handleAddUserAdmin : handleUpdateUserAdmin}
                                className="p-4 rounded-xl bg-white/10 border border-amber-500/20 space-y-3"
                              >
                                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                                  {userModalOpen === 'add' ? 'Cadastrar Novo Usuário' : 'Editar Usuário'}
                                </h4>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-300">E-mail (Não editável)</label>
                                    <input
                                      type="email"
                                      disabled
                                      value={userFormEmail}
                                      className="w-full px-2.5 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs text-slate-400 focus:outline-none cursor-not-allowed"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-300">Nível de Acesso (Role)</label>
                                    <select
                                      value={userFormRole}
                                      onChange={(e: any) => setUserFormRole(e.target.value)}
                                      className="w-full px-2.5 py-1.5 bg-black/20 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-amber-400 transition-colors"
                                    >
                                      <option value="owner" className="bg-[#121824]">Proprietário (owner)</option>
                                      <option value="admin" className="bg-[#121824]">Administrador (admin)</option>
                                      <option value="support" className="bg-[#121824]">Suporte (support)</option>
                                      <option value="operator" className="bg-[#121824]">Operador (operator)</option>
                                      <option value="installer" className="bg-[#121824]">Instalador (installer)</option>
                                      <option value="factory" className="bg-[#121824]">Fábrica (factory)</option>
                                    </select>
                                  </div>
                                </div>

                                <div className="flex justify-end gap-2 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => setUserModalOpen(null)}
                                    className="px-3 py-1.5 bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 text-xs font-semibold rounded-lg"
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    type="submit"
                                    className="px-4 py-1.5 bg-amber-400 hover:bg-amber-500 text-black text-xs font-bold rounded-lg shadow-lg shadow-amber-400/10"
                                  >
                                    {userModalOpen === 'add' ? 'Salvar Usuário' : 'Atualizar'}
                                  </button>
                                </div>
                              </form>
                            )}

                            {/* Users Search */}
                            <div className="relative">
                              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                              <input
                                type="text"
                                placeholder="Filtrar usuários por e-mail..."
                                value={adminSearchUser}
                                onChange={(e) => setAdminSearchUser(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
                              />
                            </div>

                            {/* Users List Data Table */}
                            <div className="overflow-x-auto rounded-xl border border-white/10">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="bg-black/20 text-slate-400 border-b border-white/10 text-left">
                                    <th className="p-3">E-mail</th>
                                    <th className="p-3">Autenticação</th>
                                    <th className="p-3">Acesso</th>
                                    <th className="p-3 text-right">Ações</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {simUsers
                                    .filter(u => (u.email || '').toLowerCase().includes(adminSearchUser.toLowerCase()))
                                    .map((u) => {
                                      const isRoot = u.role === 'owner';
                                      const isSelf = currentUser && currentUser.email === u.email;
                                      const isSelected = selectedUserForEquip === u.email;
                                      return (
                                        <tr 
                                          key={u.uid || u.email} 
                                          onClick={() => {
                                            if (selectedUserForEquip === u.email) {
                                              setSelectedUserForEquip(null);
                                            } else {
                                              setSelectedUserForEquip(u.email);
                                            }
                                            setAdminSearchEquip('');
                                          }}
                                          className={`border-b border-white/5 transition-colors cursor-pointer hover:bg-amber-400/5 ${
                                            isSelected ? 'bg-amber-400/10 border-l-2 border-l-amber-400' : ''
                                          }`}
                                        >
                                          <td className="p-3 font-semibold text-white">
                                            <div className="flex items-center gap-1.5 font-sans">
                                              <span>{u.email}</span>
                                              {isSelf && (
                                                <span className="text-[8px] bg-sky-500/15 text-sky-400 px-1 py-0.2 rounded border border-sky-500/20 font-bold">VOCÊ</span>
                                              )}
                                            </div>
                                          </td>
                                          <td className="p-3 font-mono text-emerald-400 text-[10px] font-semibold flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                            Ativo (Supabase)
                                          </td>
                                          <td className="p-3">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                              u.role === 'owner' 
                                                ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20' 
                                                : u.role === 'admin'
                                                  ? 'bg-blue-400/10 text-blue-400 border border-blue-400/20'
                                                  : 'bg-slate-400/15 text-slate-300 border border-white/5'
                                            }`}>
                                              {u.role === 'owner' 
                                                ? 'Proprietário' 
                                                : u.role === 'admin' 
                                                  ? 'Administrador' 
                                                  : u.role === 'support'
                                                    ? 'Suporte'
                                                    : u.role === 'operator'
                                                      ? 'Operador'
                                                      : u.role === 'installer'
                                                        ? 'Instalador'
                                                        : u.role === 'factory'
                                                          ? 'Fábrica'
                                                          : u.role}
                                            </span>
                                          </td>
                                          <td className="p-3 text-right">
                                            <div className="flex justify-end gap-1.5">
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setSelectedUserForEdit(u);
                                                  setUserFormEmail(u.email);
                                                  setUserFormPassword('');
                                                  setUserFormRole(u.role || 'operator');
                                                  setUserModalOpen('edit');
                                                }}
                                                title="Editar Usuário"
                                                className="p-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg transition-colors"
                                              >
                                                <Edit2 className="w-3.5 h-3.5" />
                                              </button>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleDeleteUserAdmin(u.uid);
                                                }}
                                                disabled={isRoot || isSelf}
                                                title={isRoot ? 'Usuário proprietário não pode ser removido' : isSelf ? 'Você não pode se deletar' : 'Desativar conta (soft delete)'}
                                                className={`p-1.5 rounded-lg border transition-colors ${
                                                  isRoot || isSelf
                                                    ? 'bg-black/10 border-transparent text-slate-600 cursor-not-allowed'
                                                    : 'bg-rose-500/10 border-rose-500/20 hover:bg-rose-500/25 text-rose-400'
                                                }`}
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Equipments Panel */}
                          <div className="lg:col-span-5 bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                            <div>
                              <h3 className="text-sm font-bold text-white">
                                {selectedUserForEquip ? 'Equipamentos do Usuário' : 'Equipamentos'}
                              </h3>
                              <p className="text-[10px] text-slate-400">
                                {selectedUserForEquip
                                  ? `${adminEquipmentsForSelectedUser.length} ${adminEquipmentsForSelectedUser.length === 1 ? 'equipamento vinculado a' : 'equipamentos vinculados a'} ${selectedUserForEquip}`
                                  : `Total de ${adminAllDevices.length} dispositivos cadastrados no sistema`}
                              </p>
                            </div>

                            {selectedUserForEquip && (
                              <div className="relative">
                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                                <input
                                  type="text"
                                  placeholder="Buscar por ID ou modelo..."
                                  value={adminSearchEquip}
                                  onChange={(e) => setAdminSearchEquip(e.target.value)}
                                  className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
                                />
                              </div>
                            )}

                             <div className="space-y-2.5">
                              {!selectedUserForEquip ? (
                                <div className="p-6 text-center bg-white/5 border border-dashed border-white/15 rounded-xl">
                                  <Users className="w-6 h-6 text-slate-500 mx-auto mb-2" />
                                  <p className="text-xs text-slate-400 leading-relaxed">
                                    Selecione um usuário à esquerda para ver os equipamentos dele.
                                  </p>
                                </div>
                              ) : (
                                <>
                                  {adminEquipmentsForSelectedUser
                                    .filter(eq =>
                                      eq.id.toLowerCase().includes(adminSearchEquip.toLowerCase()) ||
                                      eq.model.toLowerCase().includes(adminSearchEquip.toLowerCase())
                                    )
                                    .map((eq) => {
                                      const isActive = areDeviceIdsMatching(deviceId, eq.id);
                                      return (
                                        <div
                                          key={eq.id}
                                          className={`p-4 rounded-xl border transition-all text-left flex justify-between items-center ${
                                            isActive
                                              ? 'bg-[#4398fa]/10 border-[#4398fa] shadow-lg shadow-[#4398fa]/5'
                                              : 'bg-amber-500/10 border-amber-400/50'
                                          }`}
                                        >
                                          <div className="space-y-1">
                                            <div className="flex items-center gap-1.5 font-sans">
                                              <span className="font-mono text-xs font-bold text-white">{eq.id}</span>
                                              {isActive && (
                                                <span className="text-[8px] bg-[#4398fa]/20 text-[#4398fa] border border-[#4398fa]/30 px-1.5 py-0.2 rounded-full font-black uppercase tracking-wider">ATIVO</span>
                                              )}
                                            </div>
                                            <div className="text-[10px] text-slate-400">
                                              Modelo: <span className="text-slate-200 font-semibold">{eq.model}</span>
                                            </div>
                                          </div>

                                          {!isActive && (
                                            <button
                                              onClick={() => {
                                                setDeviceId(eq.id);
                                                localStorage.setItem('mqtt_device', eq.id);
                                                logUserAction(`Ativou equipamento ID: ${eq.id}`);
                                              }}
                                              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 hover:text-white rounded-lg text-[10px] font-bold text-slate-300 transition-all"
                                            >
                                              Ativar
                                            </button>
                                          )}
                                        </div>
                                      );
                                    })}

                                  {adminEquipmentsForSelectedUser.length === 0 && (
                                    <div className="p-4 bg-rose-500/10 border border-rose-500/25 rounded-xl text-left space-y-2 mt-2">
                                      <p className="text-xs font-semibold text-rose-300">Este usuário ({selectedUserForEquip}) não tem nenhum equipamento vinculado.</p>
                                      <div className="flex flex-col gap-1.5 pt-1">
                                        <span className="text-[10px] text-slate-400 font-bold">Vincular equipamento disponível:</span>
                                        <select
                                          value=""
                                          onChange={async (e) => {
                                            const eqId = e.target.value;
                                            if (!eqId) return;

                                            const targetUser = simUsers.find(u => u.email === selectedUserForEquip);
                                            if (!targetUser) {
                                              showToast('Usuário não encontrado', 'Usuário selecionado não foi localizado.', 'error');
                                              return;
                                            }

                                            if (isSupabaseConfigured()) {
                                              await updateDeviceOwner(eqId, targetUser.uid);
                                              await loadAdminAllDevices();
                                            }
                                          }}
                                          className="w-full px-2 py-1.5 bg-black border border-white/10 rounded text-xs text-white focus:outline-none focus:border-amber-400"
                                        >
                                          <option value="">Selecione um equipamento...</option>
                                          {adminEquipmentsAvailableToLink.map(eq => (
                                            <option key={eq.id} value={eq.id}>
                                              {eq.id} ({eq.model}){eq.userEmail ? ` — atual: ${eq.userEmail}` : ' — sem dono'}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>

                        </div>

                        {/* Back to main screen button */}
                        <div className="flex justify-center pt-2">
                          <button
                            onClick={() => setAdminTab('home')}
                            className="px-6 py-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 hover:text-amber-300 rounded-xl text-xs font-bold transition-all flex items-center gap-2 active:scale-95 shadow-lg shadow-amber-500/5"
                          >
                            <ChevronRight className="w-4 h-4 rotate-180" />
                            Voltar para a Tela Inicial
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Tab 3: Logs & Auditoria profissional (audit_events) */}
                    {adminTab === 'aba3' && (
                      <div className="space-y-5">

                        {/* Header */}
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                              <Activity className="w-4 h-4 text-amber-400" />
                              Logs & Auditoria
                            </h3>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              Trilha de auditoria da tabela <span className="font-mono text-amber-300">audit_events</span>
                              {' · '}
                              {filteredAuditEvents.length} de {auditEvents.length} eventos
                              {auditFiltersActiveCount > 0 ? ` · ${auditFiltersActiveCount} filtro(s) ativo(s)` : ''}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setAuditFiltersOpen((v) => !v)}
                              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
                            >
                              <Filter className="w-3.5 h-3.5 text-amber-400" />
                              Filtros
                              {auditFiltersActiveCount > 0 && (
                                <span className="ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-400 text-black text-[10px] font-black flex items-center justify-center">
                                  {auditFiltersActiveCount}
                                </span>
                              )}
                              {auditFiltersOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => exportAuditEventsCsv(filteredAuditEvents)}
                              disabled={filteredAuditEvents.length === 0}
                              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-40"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Exportar CSV
                            </button>
                            <button
                              type="button"
                              onClick={() => loadAuditEvents()}
                              disabled={auditLoading}
                              className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 hover:text-amber-300 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${auditLoading ? 'animate-spin' : ''}`} />
                              Atualizar
                            </button>
                          </div>
                        </div>

                        {/* KPI strip */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                          <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-left">
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Total carregado</span>
                            <div className="text-xl font-black text-white font-mono mt-1">{auditEvents.length}</div>
                          </div>
                          <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-left">
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Após filtros</span>
                            <div className="text-xl font-black text-[#4398fa] font-mono mt-1">{filteredAuditEvents.length}</div>
                          </div>
                          <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-left">
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Atores distintos</span>
                            <div className="text-xl font-black text-emerald-400 font-mono mt-1">{auditFilterOptions.actors.length}</div>
                          </div>
                          <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-left">
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Tipos de evento</span>
                            <div className="text-xl font-black text-amber-400 font-mono mt-1">{auditFilterOptions.eventTypes.length}</div>
                          </div>
                        </div>

                        {/* Filter panel */}
                        {auditFiltersOpen && (
                          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Painel de Filtros</span>
                              <button
                                type="button"
                                onClick={clearAuditFilters}
                                className="text-[10px] font-bold text-slate-400 hover:text-white underline-offset-2 hover:underline"
                              >
                                Limpar filtros
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                              <div className="space-y-1 sm:col-span-2">
                                <label className="text-[10px] font-bold text-slate-300">Busca livre</label>
                                <div className="relative">
                                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                                  <input
                                    type="text"
                                    value={auditFilterSearch}
                                    onChange={(e) => { setAuditFilterSearch(e.target.value); setAuditPage(1); }}
                                    placeholder="Usuário, entidade, evento, metadata..."
                                    className="w-full pl-9 pr-3 py-2 bg-black/30 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                                  />
                                </div>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-300">Usuário (actor)</label>
                                <select
                                  value={auditFilterActor}
                                  onChange={(e) => { setAuditFilterActor(e.target.value); setAuditPage(1); }}
                                  className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                                >
                                  <option value="">Todos os usuários</option>
                                  {auditFilterOptions.actors.map((email) => (
                                    <option key={email} value={email}>{email}</option>
                                  ))}
                                </select>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-300">Tipo de entidade</label>
                                <select
                                  value={auditFilterEntityType}
                                  onChange={(e) => { setAuditFilterEntityType(e.target.value); setAuditPage(1); }}
                                  className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                                >
                                  <option value="">Todas</option>
                                  {['profile', 'device', ...auditFilterOptions.entityTypes.filter((t) => t !== 'profile' && t !== 'device')].map((t) => (
                                    <option key={t} value={t}>{t}</option>
                                  ))}
                                </select>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-300">Tipo de evento</label>
                                <select
                                  value={auditFilterEventType}
                                  onChange={(e) => { setAuditFilterEventType(e.target.value); setAuditPage(1); }}
                                  className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                                >
                                  <option value="">Todos os eventos</option>
                                  {auditFilterOptions.eventTypes.map((t) => (
                                    <option key={t} value={t}>{formatAuditEventType(t)}</option>
                                  ))}
                                </select>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-300">ID da entidade</label>
                                <input
                                  type="text"
                                  value={auditFilterEntityId}
                                  onChange={(e) => { setAuditFilterEntityId(e.target.value); setAuditPage(1); }}
                                  placeholder="UUID / device id..."
                                  className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-300">Serial do equipamento</label>
                                <input
                                  type="text"
                                  list="audit-serial-options"
                                  value={auditFilterSerial}
                                  onChange={(e) => { setAuditFilterSerial(e.target.value); setAuditPage(1); }}
                                  placeholder="Ex: MLZ-MM12TW-..."
                                  className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                                />
                                <datalist id="audit-serial-options">
                                  {auditFilterOptions.serials.map((serial) => (
                                    <option key={serial} value={serial} />
                                  ))}
                                </datalist>
                                <p className="text-[9px] text-slate-500 leading-snug">
                                  Mostra cadastro, timers, nomes e exclusões desse dispositivo.
                                </p>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-300">Data inicial</label>
                                <input
                                  type="date"
                                  value={auditFilterDateFrom}
                                  onChange={(e) => { setAuditFilterDateFrom(e.target.value); setAuditPage(1); }}
                                  className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-300">Data final</label>
                                <input
                                  type="date"
                                  value={auditFilterDateTo}
                                  onChange={(e) => { setAuditFilterDateTo(e.target.value); setAuditPage(1); }}
                                  className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-300">Ordenação</label>
                                <select
                                  value={auditFilterSort}
                                  onChange={(e) => { setAuditFilterSort(e.target.value as 'asc' | 'desc'); setAuditPage(1); }}
                                  className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                                >
                                  <option value="desc">Mais recentes primeiro</option>
                                  <option value="asc">Mais antigos primeiro</option>
                                </select>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-300">Itens por página</label>
                                <select
                                  value={auditPageSize}
                                  onChange={(e) => { setAuditPageSize(Number(e.target.value)); setAuditPage(1); }}
                                  className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                                >
                                  <option value={25}>25</option>
                                  <option value={50}>50</option>
                                  <option value={100}>100</option>
                                </select>
                              </div>
                            </div>

                            {/* Quick chips for event types */}
                            {auditFilterOptions.eventTypes.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                <button
                                  type="button"
                                  onClick={() => { setAuditFilterEventType(''); setAuditPage(1); }}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                                    !auditFilterEventType
                                      ? 'bg-amber-400/15 border-amber-400/40 text-amber-300'
                                      : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                                  }`}
                                >
                                  Todos
                                </button>
                                {auditFilterOptions.eventTypes.map((t) => (
                                  <button
                                    key={t}
                                    type="button"
                                    onClick={() => {
                                      setAuditFilterEventType(auditFilterEventType === t ? '' : t);
                                      setAuditPage(1);
                                    }}
                                    className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                                      auditFilterEventType === t
                                        ? 'bg-amber-400/15 border-amber-400/40 text-amber-300'
                                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                                    }`}
                                    title={t}
                                  >
                                    {formatAuditEventType(t)}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Results table */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                          <div className="px-4 py-3 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Registro de Eventos</h4>
                              <p className="text-[10px] text-slate-400">
                                Página {auditPageSafe} de {auditTotalPages}
                                {' · '}
                                exibindo {pagedAuditEvents.length} item(ns)
                              </p>
                            </div>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left min-w-[860px]">
                              <thead>
                                <tr className="bg-black/30 text-slate-400 border-b border-white/10">
                                  <th className="p-3 w-8"></th>
                                  <th className="p-3">Data/Hora</th>
                                  <th className="p-3">Usuário</th>
                                  <th className="p-3">Entidade</th>
                                  <th className="p-3">Evento</th>
                                  <th className="p-3">Resumo</th>
                                </tr>
                              </thead>
                              <tbody>
                                {pagedAuditEvents.map((event) => {
                                  const expanded = auditExpandedId === event.id;
                                  return (
                                    <React.Fragment key={event.id}>
                                      <tr
                                        className={`border-b border-white/5 hover:bg-white/[0.03] text-[11px] cursor-pointer ${expanded ? 'bg-white/[0.04]' : ''}`}
                                        onClick={() => setAuditExpandedId(expanded ? null : event.id)}
                                      >
                                        <td className="p-3 text-slate-500">
                                          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                        </td>
                                        <td className="p-3 font-mono text-slate-400 whitespace-nowrap">
                                          {new Date(event.created_at).toLocaleString('pt-BR')}
                                        </td>
                                        <td className="p-3 font-semibold text-white">
                                          {event.actor_email || <span className="text-slate-500">—</span>}
                                        </td>
                                        <td className="p-3">
                                          <div className="flex flex-col gap-0.5">
                                            <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">{event.entity_type}</span>
                                            <span className="font-mono text-slate-300 truncate max-w-[180px]" title={event.entity_id}>{event.entity_id}</span>
                                          </div>
                                        </td>
                                        <td className="p-3">
                                          <span
                                            className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-bold ${auditEventBadgeClass(event.event_type)}`}
                                            title={event.event_type}
                                          >
                                            {formatAuditEventType(event.event_type)}
                                          </span>
                                        </td>
                                        <td className="p-3 text-slate-400 max-w-[260px] truncate" title={formatAuditMetadata(event.metadata, event.event_type)}>
                                          {formatAuditMetadata(event.metadata, event.event_type)}
                                        </td>
                                      </tr>
                                      {expanded && (
                                        <tr className="border-b border-white/10 bg-black/20">
                                          <td colSpan={6} className="p-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                                              <div className="space-y-1.5">
                                                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Identificação</p>
                                                <p><span className="text-slate-500">Event ID:</span> <span className="font-mono text-slate-300">{event.id}</span></p>
                                                <p><span className="text-slate-500">Actor UID:</span> <span className="font-mono text-slate-300">{event.actor_user_id || '—'}</span></p>
                                                <p><span className="text-slate-500">Actor email:</span> <span className="text-white">{event.actor_email || '—'}</span></p>
                                                <p><span className="text-slate-500">Created at:</span> <span className="font-mono text-slate-300">{event.created_at}</span></p>
                                              </div>
                                              <div className="space-y-1.5">
                                                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Metadata (JSON)</p>
                                                <pre className="p-3 rounded-xl bg-black/40 border border-white/10 text-[10px] font-mono text-emerald-300 overflow-x-auto max-h-40 whitespace-pre-wrap break-all">
                                                  {JSON.stringify(event.metadata || {}, null, 2)}
                                                </pre>
                                              </div>
                                            </div>
                                          </td>
                                        </tr>
                                      )}
                                    </React.Fragment>
                                  );
                                })}

                                {pagedAuditEvents.length === 0 && (
                                  <tr>
                                    <td colSpan={6} className="p-10 text-center text-slate-500">
                                      {auditLoading
                                        ? 'Carregando eventos...'
                                        : auditEvents.length === 0
                                          ? 'Nenhum evento em audit_events ainda.'
                                          : 'Nenhum evento corresponde aos filtros atuais.'}
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>

                          {/* Pagination */}
                          <div className="px-4 py-3 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
                            <span className="text-[10px] text-slate-400">
                              {filteredAuditEvents.length === 0
                                ? 'Sem resultados'
                                : `Mostrando ${(auditPageSafe - 1) * auditPageSize + 1}–${Math.min(auditPageSafe * auditPageSize, filteredAuditEvents.length)} de ${filteredAuditEvents.length}`}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={auditPageSafe <= 1}
                                onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                                className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-xs font-bold text-slate-300 disabled:opacity-40 hover:bg-white/10"
                              >
                                Anterior
                              </button>
                              <span className="text-[11px] font-mono text-slate-400 px-2">
                                {auditPageSafe}/{auditTotalPages}
                              </span>
                              <button
                                type="button"
                                disabled={auditPageSafe >= auditTotalPages}
                                onClick={() => setAuditPage((p) => Math.min(auditTotalPages, p + 1))}
                                className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-xs font-bold text-slate-300 disabled:opacity-40 hover:bg-white/10"
                              >
                                Próxima
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-center pt-1">
                          <button
                            onClick={() => setAdminTab('home')}
                            className="px-6 py-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 hover:text-amber-300 rounded-xl text-xs font-bold transition-all flex items-center gap-2 active:scale-95 shadow-lg shadow-amber-500/5"
                          >
                            <ChevronRight className="w-4 h-4 rotate-180" />
                            Voltar para a Tela Inicial
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Tab 4: Technical Info & MQTT Config */}
                    {adminTab === 'aba4' && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                        
                        {/* MQTT Broker Config */}
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleSaveDevConfig();
                            logUserAction('Editou configurações de conexão MQTT via painel Admin');
                          }}
                          className="md:col-span-6 bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4 text-left"
                        >
                          <div>
                            <h3 className="text-sm font-bold text-white">Servidor Mqtt (Broker)</h3>
                            <p className="text-[10px] text-slate-400">Defina os parâmetros do Broker para onde os comandos são encaminhados.</p>
                          </div>

                          <div className="grid grid-cols-3 gap-3">
                            <div className="col-span-2 space-y-1">
                              <label className="text-[10px] font-bold text-slate-300">Host Broker</label>
                              <input
                                type="text"
                                required
                                value={mqttBroker}
                                onChange={(e) => setMqttBroker(e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-300">Porta (WSS)</label>
                              <input
                                type="text"
                                required
                                value={mqttPort}
                                onChange={(e) => setMqttPort(e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-300">Usuário Mqtt (Opcional)</label>
                              <input
                                type="text"
                                placeholder="sem usuário"
                                value={mqttUser}
                                onChange={(e) => setMqttUser(e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-300">Senha Mqtt (Opcional)</label>
                              <input
                                type="password"
                                placeholder="sem senha"
                                value={mqttPassword}
                                onChange={(e) => setMqttPassword(e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
                              />
                            </div>
                          </div>

                          <div className="p-3 bg-black/20 rounded-xl border border-white/5 flex items-center justify-between text-xs">
                            <span className="text-slate-400">Estado da Conexão</span>
                            <span className={`font-bold transition-all px-2.5 py-0.5 rounded text-[10px] ${
                              mqttConnected 
                                ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' 
                                : mqttStatusMessage === 'Conectando...'
                                  ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                                  : 'text-slate-400 bg-white/5 border border-white/5'
                            }`}>
                              {mqttConnected ? 'CONECTADO' : mqttStatusMessage === 'Conectando...' ? 'CONECTANDO' : 'OFFLINE'}
                            </span>
                          </div>

                          <div className="flex justify-end gap-2 pt-2">
                            <button
                              type="button"
                              onClick={handleResetToDefaultConfig}
                              className="px-3 py-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 rounded-xl text-xs font-semibold transition-all"
                              title="Restaurar endereço padrão do hardware (test.mosquitto.org:8081)"
                            >
                              Restaurar Padrão
                            </button>

                            {mqttConnected ? (
                              <button
                                type="button"
                                onClick={disconnectMQTT}
                                className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-bold transition-all"
                              >
                                Desconectar Broker
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={connectMQTT}
                                className="px-3.5 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold transition-all"
                              >
                                Forçar Conexão
                              </button>
                            )}

                            <button
                              type="submit"
                              className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-black text-xs font-bold rounded-xl transition-all shadow-md shadow-amber-400/10"
                            >
                              Salvar Conexão
                            </button>
                          </div>
                        </form>

                        {/* Database Sandboxing & Firebase Config info */}
                        <div className="md:col-span-6 bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4 text-left">
                          <div>
                            <h3 className="text-sm font-bold text-white">Banco de Dados & Autenticação</h3>
                            <p className="text-[10px] text-slate-400">Informações técnicas sobre o barramento persistente do aplicativo.</p>
                          </div>

                          <div className="p-4 rounded-xl bg-black/20 border border-white/10 space-y-3">
                            <div className="flex justify-between items-center text-xs pb-2 border-b border-white/5">
                              <span className="text-slate-400 font-semibold">Motor de Persistência</span>
                              <span className="font-mono text-white">LocalStorage Sandbox + Firebase Auth</span>
                            </div>
                            
                            <div className="flex justify-between items-center text-xs pb-2 border-b border-white/5">
                              <span className="text-slate-400 font-semibold">Tamanho Ocupado no Banco</span>
                              <span className="font-mono text-emerald-400 font-bold">
                                {(() => {
                                  try {
                                    let totalChars = 0;
                                    for (let x in localStorage) {
                                      if (localStorage.hasOwnProperty(x)) {
                                        totalChars += (localStorage[x] || '').length + x.length;
                                      }
                                    }
                                    return `${(totalChars / 1024).toFixed(2)} KB`;
                                  } catch (e) {
                                    return '0.00 KB';
                                  }
                                })()}
                              </span>
                            </div>

                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-400 font-semibold">Conexão Supabase Real</span>
                              <span className={`font-black uppercase text-[9px] px-2 py-0.5 rounded ${
                                getSupabaseConfigError()
                                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                  : isSupabaseConfigured() 
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              }`}>
                                {getSupabaseConfigError() ? 'Chave Inválida' : isSupabaseConfigured() ? 'Ativo (Real)' : 'Não Configurado'}
                              </span>
                            </div>
                          </div>

                          <div className="p-3.5 bg-white/5 border border-white/10 rounded-xl text-[11px] text-slate-300 leading-relaxed font-sans">
                            <strong className="text-white block mb-1">Notas do Projeto:</strong>
                            Este painel simula totalmente a comunicação serial Modbus do hardware através de barramentos JSON estruturados via MQTT. 
                            Quando as credenciais Supabase estão configuradas, as coleções de dados são sincronizadas de forma distribuída na nuvem.
                          </div>
                        </div>

                      </div>

                      {/* Back to main screen button */}
                      <div className="flex justify-center pt-2">
                        <button
                          onClick={() => setAdminTab('home')}
                          className="px-6 py-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 hover:text-amber-300 rounded-xl text-xs font-bold transition-all flex items-center gap-2 active:scale-95 shadow-lg shadow-amber-500/5"
                        >
                          <ChevronRight className="w-4 h-4 rotate-180" />
                          Voltar para a Tela Inicial
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Tab 5: Device catalog */}
                  {adminTab === 'aba5' && (
                    <div className="space-y-6">
                      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                        <div>
                          <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider">Gerenciar Catálogo de Modelos</h3>
                          <p className="text-[10px] text-slate-400">
                            Gerencie a tabela <span className="font-mono text-amber-300">devices_catalog</span> no Supabase: modelo, quantidade de motores e acessórios/timers (filtragem, LED, hidro, solar).
                          </p>
                        </div>

                        {currentUser?.role === 'owner' && (
                          <form
                            onSubmit={(event) => {
                              event.preventDefault();
                              handleCreateCatalogItem();
                            }}
                            className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-4"
                          >
                            <div className="flex items-center justify-between pb-2 border-b border-white/10">
                              <span className="text-xs font-bold text-amber-300">Cadastrar Novo Modelo</span>
                              <span className="text-[10px] text-slate-400">Modelos Globais / Catálogo</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-300">Nome do Modelo</label>
                                <input
                                  value={catalogModel}
                                  onChange={(event) => setCatalogModel(event.target.value.toUpperCase())}
                                  placeholder="Ex.: MM12TW, MM08TW, MM14TW"
                                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-mono text-white uppercase focus:outline-none focus:border-amber-400"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-300">Quantidade de Motores (0 a 8)</label>
                                <select
                                  value={catalogMotorCount}
                                  onChange={(event) => setCatalogMotorCount(event.target.value)}
                                  className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-400"
                                >
                                  {Array.from({ length: 9 }, (_, i) => String(i)).map(n => (
                                    <option key={n} value={n}>{n === '0' ? '0 Motores (Sem Motor)' : `${n} ${n === '1' ? 'Motor' : 'Motores'}`}</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {/* Timers selection checkboxes */}
                            <div className="space-y-1.5 pt-1">
                              <label className="text-[10px] font-bold text-slate-300 block">Acessórios / Timers Habilitados</label>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                                <label className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${catalogHasFilterTimer ? 'bg-amber-400/10 border-amber-400/40 text-amber-300' : 'bg-white/5 border-white/10 text-slate-400'}`}>
                                  <input
                                    type="checkbox"
                                    checked={catalogHasFilterTimer}
                                    onChange={(e) => setCatalogHasFilterTimer(e.target.checked)}
                                    className="accent-amber-400 rounded"
                                  />
                                  <span className="font-semibold text-[11px]">Timer Filtragem</span>
                                </label>

                                <label className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${catalogHasLedTimer ? 'bg-amber-400/10 border-amber-400/40 text-amber-300' : 'bg-white/5 border-white/10 text-slate-400'}`}>
                                  <input
                                    type="checkbox"
                                    checked={catalogHasLedTimer}
                                    onChange={(e) => setCatalogHasLedTimer(e.target.checked)}
                                    className="accent-amber-400 rounded"
                                  />
                                  <span className="font-semibold text-[11px]">Timer Iluminação</span>
                                </label>

                                <label className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${catalogHasHidroTimer ? 'bg-amber-400/10 border-amber-400/40 text-amber-300' : 'bg-white/5 border-white/10 text-slate-400'}`}>
                                  <input
                                    type="checkbox"
                                    checked={catalogHasHidroTimer}
                                    onChange={(e) => setCatalogHasHidroTimer(e.target.checked)}
                                    className="accent-amber-400 rounded"
                                  />
                                  <span className="font-semibold text-[11px]">Timer Hidro</span>
                                </label>

                                <label className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${catalogHasSolarHeating ? 'bg-amber-400/10 border-amber-400/40 text-amber-300' : 'bg-white/5 border-white/10 text-slate-400'}`}>
                                  <input
                                    type="checkbox"
                                    checked={catalogHasSolarHeating}
                                    onChange={(e) => setCatalogHasSolarHeating(e.target.checked)}
                                    className="accent-amber-400 rounded"
                                  />
                                  <span className="font-semibold text-[11px]">Aquecimento Solar</span>
                                </label>
                              </div>
                            </div>

                            <button
                              type="submit"
                              disabled={catalogSaving}
                              className="w-full py-2.5 bg-amber-400 hover:bg-amber-500 active:scale-95 disabled:opacity-50 text-black text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-400/10 transition-all"
                            >
                              <Plus className="w-4 h-4" />
                              {catalogSaving ? 'Salvando...' : 'Cadastrar Modelo no Catálogo'}
                            </button>
                          </form>
                        )}
                      </div>

                      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between gap-3">
                          <span className="text-xs font-bold text-white">Modelos em devices_catalog</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                if (!currentUser?.isSupabase || !isSupabaseConfigured()) return;
                                setCatalogLoading(true);
                                try {
                                  await loadDeviceCatalogFromSupabase();
                                } catch (err: any) {
                                  showToast('Catálogo', err?.message || 'Falha ao atualizar do Supabase.', 'error');
                                } finally {
                                  setCatalogLoading(false);
                                }
                              }}
                              className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white rounded-lg text-[10px] font-bold flex items-center gap-1"
                            >
                              <RefreshCw className="w-3 h-3" />
                              Atualizar
                            </button>
                            <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full font-mono text-slate-300">{deviceCatalog.length} modelos</span>
                          </div>
                        </div>

                        {catalogLoading ? (
                          <p className="p-6 text-center text-xs text-slate-400">Carregando catálogo...</p>
                        ) : deviceCatalog.length === 0 ? (
                          <p className="p-6 text-center text-xs text-slate-400">Nenhum modelo cadastrado.</p>
                        ) : (
                          <div className="divide-y divide-white/5">
                            {deviceCatalog.map((item) => {
                              const isEditing = editingCatalogItem?.id === item.id;
                              return (
                                <div key={item.id} className="p-4 transition-all hover:bg-white/2">
                                  {isEditing ? (
                                    <div className="space-y-3 bg-white/5 p-4 rounded-xl border border-amber-400/40">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-amber-400">Editando Modelo: {item.model}</span>
                                        <span className="text-[9px] text-slate-400 font-mono">ID: {item.id}</span>
                                      </div>
                                      
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                          <label className="text-[10px] font-bold text-slate-300">Nome do Modelo</label>
                                          <input
                                            type="text"
                                            value={editModelName}
                                            onChange={(e) => setEditModelName(e.target.value.toUpperCase())}
                                            className="w-full px-3 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs font-mono text-white uppercase focus:outline-none focus:border-amber-400"
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <label className="text-[10px] font-bold text-slate-300">Qtd. de Motores (0 a 8)</label>
                                          <select
                                            value={editMotorCount}
                                            onChange={(e) => setEditMotorCount(e.target.value)}
                                            className="w-full px-3 py-1.5 bg-slate-900 border border-white/10 rounded-lg text-xs font-bold text-white focus:outline-none focus:border-amber-400"
                                          >
                                            {Array.from({ length: 9 }, (_, i) => String(i)).map(n => (
                                              <option key={n} value={n}>{n === '0' ? '0 Motores (Sem Motor)' : `${n} ${n === '1' ? 'Motor' : 'Motores'}`}</option>
                                            ))}
                                          </select>
                                        </div>
                                      </div>

                                      <div className="space-y-1 pt-1">
                                        <label className="text-[10px] font-bold text-slate-300 block">Acessórios / Timers Habilitados</label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                                          <label className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-all ${editHasFilterTimer ? 'bg-amber-400/10 border-amber-400/40 text-amber-300' : 'bg-white/5 border-white/10 text-slate-400'}`}>
                                            <input
                                              type="checkbox"
                                              checked={editHasFilterTimer}
                                              onChange={(e) => setEditHasFilterTimer(e.target.checked)}
                                              className="accent-amber-400 rounded"
                                            />
                                            <span className="font-semibold text-[10px]">Timer Filtragem</span>
                                          </label>

                                          <label className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-all ${editHasLedTimer ? 'bg-amber-400/10 border-amber-400/40 text-amber-300' : 'bg-white/5 border-white/10 text-slate-400'}`}>
                                            <input
                                              type="checkbox"
                                              checked={editHasLedTimer}
                                              onChange={(e) => setEditHasLedTimer(e.target.checked)}
                                              className="accent-amber-400 rounded"
                                            />
                                            <span className="font-semibold text-[10px]">Timer Iluminação</span>
                                          </label>

                                          <label className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-all ${editHasHidroTimer ? 'bg-amber-400/10 border-amber-400/40 text-amber-300' : 'bg-white/5 border-white/10 text-slate-400'}`}>
                                            <input
                                              type="checkbox"
                                              checked={editHasHidroTimer}
                                              onChange={(e) => setEditHasHidroTimer(e.target.checked)}
                                              className="accent-amber-400 rounded"
                                            />
                                            <span className="font-semibold text-[10px]">Timer Hidro</span>
                                          </label>

                                          <label className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-all ${editHasSolarHeating ? 'bg-amber-400/10 border-amber-400/40 text-amber-300' : 'bg-white/5 border-white/10 text-slate-400'}`}>
                                            <input
                                              type="checkbox"
                                              checked={editHasSolarHeating}
                                              onChange={(e) => setEditHasSolarHeating(e.target.checked)}
                                              className="accent-amber-400 rounded"
                                            />
                                            <span className="font-semibold text-[10px]">Aquecimento Solar</span>
                                          </label>
                                        </div>
                                      </div>

                                      <div className="flex justify-end gap-2 pt-2">
                                        <button
                                          type="button"
                                          onClick={() => setEditingCatalogItem(null)}
                                          className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-lg text-xs font-semibold"
                                        >
                                          Cancelar
                                        </button>
                                        <button
                                          type="button"
                                          onClick={handleSaveEditCatalogItem}
                                          disabled={catalogSaving}
                                          className="px-4 py-1.5 bg-amber-400 hover:bg-amber-500 text-black rounded-lg text-xs font-bold shadow-md shadow-amber-400/10"
                                        >
                                          {catalogSaving ? 'Salvando...' : 'Salvar Alterações'}
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm font-extrabold text-white font-mono">{item.model}</span>
                                          <span className="text-[10px] bg-white/10 border border-white/10 px-2 py-0.5 rounded-full text-amber-300 font-bold">
                                            {item.motor_count === 0 ? '0 Motores (Sem Motor)' : `${item.motor_count} ${item.motor_count === 1 ? 'Motor' : 'Motores'}`}
                                          </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                          <span className={`text-[9px] px-2 py-0.5 rounded-md font-semibold border ${item.has_filter_timer === true ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-white/5 border-white/10 text-slate-500 line-through'}`}>
                                            Timer Filtragem
                                          </span>
                                          <span className={`text-[9px] px-2 py-0.5 rounded-md font-semibold border ${item.has_led_timer === true ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-300' : 'bg-white/5 border-white/10 text-slate-500 line-through'}`}>
                                            Timer Iluminação
                                          </span>
                                          <span className={`text-[9px] px-2 py-0.5 rounded-md font-semibold border ${item.has_hidro_timer === true ? 'bg-blue-500/10 border-blue-500/20 text-blue-300' : 'bg-white/5 border-white/10 text-slate-500 line-through'}`}>
                                            Timer Hidro
                                          </span>
                                          <span className={`text-[9px] px-2 py-0.5 rounded-md font-semibold border ${item.has_solar_heating === true ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' : 'bg-white/5 border-white/10 text-slate-500 line-through'}`}>
                                            Aquecimento Solar
                                          </span>
                                        </div>
                                      </div>

                                      {currentUser?.role === 'owner' && (
                                        <div className="flex items-center gap-1.5 self-end sm:self-auto">
                                          <button
                                            type="button"
                                            onClick={() => handleStartEditCatalogItem(item)}
                                            className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-amber-300 hover:text-amber-200 rounded-lg transition-colors text-xs font-semibold flex items-center gap-1"
                                            title="Editar parâmetros do modelo"
                                          >
                                            <Edit2 className="w-3.5 h-3.5" />
                                            <span>Editar</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteCatalogItem(item)}
                                            className="p-1.5 text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 rounded-lg transition-colors"
                                            title="Excluir modelo"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tab: Produção / whitelist de fábrica */}
                  {adminTab === 'production' && (
                    <div className="space-y-6">
                      <div className="bg-white/5 border border-amber-400/30 rounded-2xl p-5 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                              <Factory className="w-4 h-4 text-amber-400" />
                              Cadastro de Produção via QR
                            </h3>
                            <p className="text-[10px] text-slate-400 mt-1 max-w-xl">
                              Escaneie o QR de fábrica (serial, provision, model, hw, fw, date). O aparelho só poderá ser vinculado por usuários depois de entrar nesta whitelist.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => loadProductionData()}
                            className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-[10px] font-bold flex items-center gap-1.5"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${productionLoading ? 'animate-spin' : ''}`} />
                            Atualizar
                          </button>
                        </div>

                        {!isScanningProductionQr ? (
                          <button
                            type="button"
                            onClick={startProductionQrScanner}
                            className="w-full sm:w-auto px-4 py-3 bg-amber-400 hover:bg-amber-500 text-black text-xs font-bold rounded-xl flex items-center justify-center gap-2 active:scale-[0.99]"
                          >
                            <QrCode className="w-4 h-4" />
                            Escanear QR de Produção
                          </button>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                                <Camera className="w-3.5 h-3.5 animate-pulse" />
                                Aponte para o QR de fábrica
                              </span>
                              <button
                                type="button"
                                onClick={stopProductionQrScanner}
                                className="px-3 py-1.5 bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[10px] font-bold rounded-lg"
                              >
                                Parar
                              </button>
                            </div>
                            <div className="rounded-xl overflow-hidden border border-white/10 bg-black aspect-square max-w-sm mx-auto">
                              <div id="qr-reader-production" className="w-full h-full overflow-hidden [&_video]:object-cover" />
                            </div>
                          </div>
                        )}

                        {productionQrError && (
                          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-200">
                            {productionQrError}
                          </div>
                        )}
                      </div>

                      {/* Stats by model */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {productionStats.map((stat) => (
                          <div
                            key={stat.model}
                            className="p-4 bg-gradient-to-br from-emerald-500/10 to-teal-600/5 border border-emerald-500/20 rounded-2xl"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-extrabold text-white font-mono">{stat.model}</span>
                              <Cpu className="w-4 h-4 text-emerald-400" />
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                              <div>
                                <span className="text-slate-400 block">Produzidos</span>
                                <span className="text-white font-bold text-lg">{stat.produced}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block">Usuários c/ modelo</span>
                                <span className="text-emerald-300 font-bold text-lg">{stat.unique_users}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block">Instalados</span>
                                <span className="text-cyan-300 font-semibold">{stat.claimed}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block">Disponíveis</span>
                                <span className="text-amber-300 font-semibold">{stat.available}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                        {productionStats.length === 0 && !productionLoading && (
                          <div className="sm:col-span-2 lg:col-span-3 p-6 text-center text-xs text-slate-500 border border-dashed border-white/10 rounded-2xl">
                            Nenhum aparelho na whitelist ainda. Escaneie o primeiro QR de produção.
                          </div>
                        )}
                      </div>

                      {/* List */}
                      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                        <div className="px-5 py-3 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <span className="text-xs font-bold text-white">
                            Aparelhos em production_devices ({productionDevices.length})
                          </span>
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                              value={productionSearch}
                              onChange={(e) => setProductionSearch(e.target.value)}
                              placeholder="Buscar serial / modelo / e-mail..."
                              className="pl-8 pr-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-[11px] text-white w-full sm:w-64 focus:outline-none focus:border-amber-400"
                            />
                          </div>
                        </div>

                        <div className="divide-y divide-white/5 max-h-[420px] overflow-y-auto">
                          {productionDevices
                            .filter((row) => {
                              const q = productionSearch.trim().toLowerCase();
                              if (!q) return true;
                              return (
                                row.serial.toLowerCase().includes(q) ||
                                row.model.toLowerCase().includes(q) ||
                                (row.owner_email || '').toLowerCase().includes(q)
                              );
                            })
                            .map((row) => (
                              <div
                                key={row.serial}
                                className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                              >
                                <div className="min-w-0 space-y-1">
                                  <p className="font-mono text-cyan-200 font-semibold truncate">{row.serial}</p>
                                  <p className="text-[10px] text-slate-400">
                                    {row.model}
                                    {row.hw ? ` · hw ${row.hw}` : ''}
                                    {row.fw ? ` · fw ${row.fw}` : ''}
                                    {row.owner_email ? ` · ${row.owner_email}` : ''}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span
                                    className={`px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider ${
                                      row.status === 'claimed'
                                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20'
                                        : row.status === 'available'
                                          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
                                          : 'bg-slate-500/15 text-slate-300 border border-slate-500/20'
                                    }`}
                                  >
                                    {row.status === 'claimed'
                                      ? 'Instalado'
                                      : row.status === 'available'
                                        ? 'Disponível'
                                        : 'Desativado'}
                                  </span>
                                  {row.status !== 'disabled' && (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        const ok = await setProductionDeviceStatus(row.serial, 'disabled');
                                        if (ok) {
                                          loadProductionData();
                                        } else {
                                          showToast('Produção', 'Não foi possível desativar.', 'error');
                                        }
                                      }}
                                      className="px-2 py-1 text-[9px] font-bold text-rose-300 border border-rose-500/20 rounded-lg hover:bg-rose-500/10"
                                    >
                                      Desativar
                                    </button>
                                  )}
                                  {row.status === 'disabled' && (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        const ok = await setProductionDeviceStatus(row.serial, 'available');
                                        if (ok) {
                                          loadProductionData();
                                        }
                                      }}
                                      className="px-2 py-1 text-[9px] font-bold text-emerald-300 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/10"
                                    >
                                      Reativar
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          {productionLoading && (
                            <p className="py-8 text-center text-xs text-slate-500">Carregando produção...</p>
                          )}
                          {!productionLoading && productionDevices.length === 0 && (
                            <p className="py-8 text-center text-xs text-slate-500">Lista vazia.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {adminTab === 'firmware' && (
                    <div className="space-y-6">
                      <div className="bg-white/5 border border-amber-400/30 rounded-2xl p-5 space-y-4">
                        <div>
                          <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <Upload className="w-4 h-4 text-amber-400" />
                            Upload Firmware (.bin)
                          </h3>
                          <p className="text-[10px] text-slate-400 mt-1">
                            Cadastre um novo .bin ou atualize uma versão existente. Cada modelo do catálogo tem seu próprio software.
                          </p>
                        </div>

                        {(currentUser?.role === 'owner' || currentUser?.role === 'admin' || currentUser?.role === 'support') ? (
                          <form
                            onSubmit={(event) => {
                              event.preventDefault();
                              handleUploadFirmware();
                            }}
                            className="space-y-4"
                          >
                            {deviceCatalog.length === 0 && (
                              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-200">
                                Cadastre um modelo em <button type="button" className="underline font-bold" onClick={() => setAdminTab('aba5')}>Catálogo de Dispositivos</button> antes de enviar o .bin.
                              </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-300">Modelo do equipamento *</label>
                                <select
                                  value={firmwareModel}
                                  onChange={(event) => setFirmwareModel(event.target.value)}
                                  disabled={!!firmwareEditingId}
                                  required
                                  className="w-full px-3 py-2.5 bg-slate-950 border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400 disabled:opacity-60"
                                >
                                  <option value="" className="bg-slate-900">Selecione o modelo...</option>
                                  {deviceCatalog.map((item) => (
                                    <option key={item.id} value={item.model} className="bg-slate-900">
                                      {item.model}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-300">Nome do firmware *</label>
                                <input
                                  value={firmwareNome}
                                  onChange={(event) => setFirmwareNome(event.target.value)}
                                  placeholder="Ex.: MM12TW Stable"
                                  required
                                  className="w-full px-3 py-2.5 bg-slate-950 border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-300">Versão *</label>
                                <input
                                  value={firmwareVersao}
                                  onChange={(event) => setFirmwareVersao(event.target.value)}
                                  placeholder="Ex.: 1.2.0"
                                  required
                                  className="w-full px-3 py-2.5 bg-slate-950 border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-slate-300">Arquivo .bin *</label>
                              <label className="flex flex-col items-center justify-center gap-2 w-full min-h-[110px] px-4 py-5 rounded-2xl border border-dashed border-amber-400/40 bg-amber-400/5 hover:bg-amber-400/10 cursor-pointer transition-colors">
                                <Upload className="w-6 h-6 text-amber-400" />
                                <span className="text-xs font-bold text-white">
                                  {firmwareFile ? firmwareFile.name : 'Clique para selecionar o arquivo .bin'}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {firmwareFile
                                    ? `${(firmwareFile.size / 1024).toFixed(1)} KB`
                                    : 'Apenas arquivos .bin • até 16 MB'}
                                </span>
                                <input
                                  type="file"
                                  accept=".bin,application/octet-stream"
                                  onChange={(event) => setFirmwareFile(event.target.files?.[0] || null)}
                                  className="hidden"
                                />
                              </label>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <button
                                type="submit"
                                disabled={firmwareSaving || deviceCatalog.length === 0}
                                className="px-5 py-2.5 bg-amber-400 hover:bg-amber-500 disabled:opacity-50 text-black text-xs font-extrabold rounded-xl flex items-center gap-2 shadow-lg shadow-amber-400/20"
                              >
                                <Upload className="w-4 h-4" />
                                {firmwareSaving
                                  ? 'Enviando...'
                                  : firmwareEditingId
                                    ? 'Atualizar'
                                    : 'Publicar'}
                              </button>
                              {firmwareEditingId && (
                                <button
                                  type="button"
                                  onClick={resetFirmwareForm}
                                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold rounded-xl"
                                >
                                  Cancelar edição
                                </button>
                              )}
                            </div>
                          </form>
                        ) : (
                          <p className="text-xs text-slate-400">Apenas o proprietário pode cadastrar firmware.</p>
                        )}
                      </div>

                      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
                          <span className="text-xs font-bold text-white">Firmware publicado</span>
                          <span className="text-[10px] text-slate-400">
                            {firmwareList.filter((f) => f.is_active).length} ativo(s)
                          </span>
                        </div>

                        {firmwareLoading ? (
                          <p className="p-6 text-center text-xs text-slate-400">Carregando firmware...</p>
                        ) : firmwareList.length === 0 ? (
                          <p className="p-6 text-center text-xs text-slate-400">Nenhum firmware publicado.</p>
                        ) : (
                          <div className="divide-y divide-white/5">
                            {firmwareList.map((item) => (
                              <div key={item.id} className="px-5 py-3 flex items-center justify-between gap-4">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-xs font-bold text-white">
                                      {item.model} • v{item.versao}
                                    </p>
                                    {item.is_active ? (
                                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-bold border border-emerald-500/30">
                                        Ativo
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 text-[9px] font-bold">
                                        Histórico
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-slate-400 truncate">{item.nome}</p>
                                  <p className="text-[9px] text-slate-500">
                                    {item.file_size ? `${(item.file_size / 1024).toFixed(1)} KB • ` : ''}
                                    {new Date(item.data_upload).toLocaleString('pt-BR')}
                                  </p>
                                </div>
                                {currentUser?.role === 'owner' && (
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditFirmware(item)}
                                    className="p-2 text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                                    title="Editar / substituir .bin"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tab: Logo do Fabricante / Identidade Visual */}
                  {adminTab === 'brand' && (
                    <div className="p-6 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md space-y-6 text-left">
                      <div className="flex items-center justify-between pb-4 border-b border-white/10">
                        <div>
                          <h3 className="text-base font-bold text-white flex items-center gap-2">
                            <Upload className="w-5 h-5 text-amber-400" />
                            Logo do Fabricante (Área Administrativa)
                          </h3>
                          <p className="text-xs text-slate-400 mt-1">
                            Configure a logomarca do fabricante exibida no cabeçalho principal de todos os usuários.
                          </p>
                        </div>
                        {manufacturerLogo && (
                          <button
                            type="button"
                            onClick={handleResetLogo}
                            className="px-3.5 py-2 text-xs font-bold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl transition-colors flex items-center gap-1.5"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Restaurar Logo Padrão
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                        {/* Seção de Upload & Preview */}
                        <div className="p-5 bg-black/30 border border-white/10 rounded-2xl space-y-4">
                          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                            Visualização Atual do Logo:
                          </span>
                          <div className="w-full h-24 rounded-xl bg-slate-900 border border-white/15 flex items-center justify-center p-3 overflow-hidden shadow-inner relative group">
                            <img
                              src={manufacturerLogo || "https://www.masterlazer.com.br/images/icon.jpg"}
                              alt="Logo Fabricante"
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="block text-xs font-bold text-slate-300">
                              Selecione uma imagem do computador para alterar:
                            </label>
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp,image/svg+xml"
                              onChange={handleLogoUpload}
                              className="block w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-amber-500/20 file:text-amber-300 hover:file:bg-amber-500/30 file:cursor-pointer cursor-pointer border border-white/10 rounded-xl p-2 bg-black/20"
                            />
                          </div>
                        </div>

                        {/* Informações e Especificações Recomendadas */}
                        <div className="p-5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-slate-300 space-y-3">
                          <p className="font-bold text-amber-300 text-sm flex items-center gap-1.5">
                            <Info className="w-4 h-4 text-amber-400 shrink-0" />
                            Especificações Recomendadas para o Logo
                          </p>
                          <p className="text-slate-300 text-xs leading-relaxed">
                            Para garantir a melhor qualidade e proporção visual na barra superior do aplicativo:
                          </p>
                          <ul className="list-disc list-inside space-y-2 pl-1 text-slate-200 text-xs">
                            <li>
                              <strong className="text-white">Proporção e Tamanho ideal:</strong> 200 × 60 pixels (altura entre 30px e 60px).
                            </li>
                            <li>
                              <strong className="text-white">Formatos/Extensões aceitas:</strong> PNG (com fundo transparente), SVG, WEBP ou JPG.
                            </li>
                            <li>
                              <strong className="text-white">Fundo Transparente:</strong> Formatos PNG ou SVG com transparência são altamente recomendados.
                            </li>
                            <li>
                              <strong className="text-white">Tamanho Máximo do Arquivo:</strong> Até 2 MB.
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  </div>

                  {/* Copyright and signature inside dashboard */}
                  <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-500">
                    <span>Master Lazer App Administration Suite v1.5.0</span>
                    <span>Copyright 2026 • Todos os direitos reservados</span>
                  </div>

                </motion.div>
              )}

            </AnimatePresence>

          </div>



          {/* Subheader / Copyright Info (matches copyright requirements) */}
          <div className="py-2 text-center bg-black/10 border-t border-white/2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shrink-0">
            <span className="text-[8px] tracking-widest text-slate-400 font-sans uppercase">
              Copyright 2026 • Master Lazer Systems
            </span>
          </div>

        </div>

        {/* Simulative iPhone Bottom Home Bar Accent */}
        <div className="hidden sm:flex h-4 bg-black/10 w-full justify-center items-start">
          <div className="w-32 h-1 bg-white/15 rounded-full" />
        </div>

      </div>

      {/* Fixed Custom Toast Notifications Overlay */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        <AnimatePresence>
          {toasts.map((toast) => {
            const bgBorder =
              toast.type === 'success'
                ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-100 shadow-emerald-950/50'
                : toast.type === 'error'
                ? 'bg-rose-950/95 border-rose-500/50 text-rose-100 shadow-rose-950/50'
                : toast.type === 'warning'
                ? 'bg-amber-950/95 border-amber-500/50 text-amber-100 shadow-amber-950/50'
                : 'bg-cyan-950/95 border-cyan-500/50 text-cyan-100 shadow-cyan-950/50';

            const Icon =
              toast.type === 'success'
                ? CheckCircle2
                : toast.type === 'error'
                ? AlertCircle
                : toast.type === 'warning'
                ? AlertTriangle
                : Info;

            const iconColor =
              toast.type === 'success'
                ? 'text-emerald-400'
                : toast.type === 'error'
                ? 'text-rose-400'
                : toast.type === 'warning'
                ? 'text-amber-400'
                : 'text-cyan-400';

            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border backdrop-blur-md shadow-2xl ${bgBorder}`}
              >
                <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${iconColor}`} />
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold leading-snug">{toast.title}</h4>
                  {toast.message && (
                    <p className="text-[11px] opacity-90 mt-0.5 leading-relaxed break-words">{toast.message}</p>
                  )}
                </div>
                <button
                  onClick={() => removeToast(toast.id)}
                  className="p-1 opacity-60 hover:opacity-100 transition-opacity rounded-lg hover:bg-white/10 shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

    </div>
  );
}
