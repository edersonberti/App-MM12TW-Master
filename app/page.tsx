'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
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
  Trash2,
  Search,
  MapPin,
  Compass
} from 'lucide-react';

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
const DEFAULT_MQTT_PORT = '8081'; // 8081 is secure WebSockets over SSL (wss://) essential for HTTPS
const DEFAULT_DEVICE_ID = 'MM12TW-000123'; // Matches new dynamic hardware architecture prefix

// Strips off any hex/efuse MAC suffix if present (e.g., "MM12TW-000123-7c9ebd1a" -> "MM12TW-000123")
function cleanDeviceId(id: string): string {
  if (!id) return '';
  const parts = id.trim().split('-');
  // If there are 3 parts or more, the last part is the EfuseMac hex suffix
  if (parts.length >= 3) {
    return parts.slice(0, parts.length - 1).join('-');
  }
  return id;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Official logo component using the exact image from the official Master Lazer website (scaled to 1.5x default):
const MasterLazerLogo = ({ className = "w-[168px] h-[168px]" }: { className?: string }) => (
  <div className={`relative ${className}`}>
    <Image 
      src="https://www.masterlazer.com.br/images/icon.jpg"
      alt="Master Lazer Logo"
      fill
      sizes="168px"
      className="object-contain rounded-2xl"
      referrerPolicy="no-referrer"
      priority
    />
  </div>
);

export default function PoolControllerPage() {
  // Navigation / Auth State
  const [activeScreen, setActiveScreen] = useState<'login' | 'register' | 'home' | 'aux' | 'led' | 'timers' | 'setup' | 'admin'>('login');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authErrorMessage, setAuthErrorMessage] = useState<string>('');

  // Admin & Owner Dashboard states
  const [adminTab, setAdminTab] = useState<'home' | 'aba1' | 'aba2' | 'aba3' | 'aba4'>('home');
  const [selectedUserForEquip, setSelectedUserForEquip] = useState<string | null>(null);

  const handleBackToHome = () => {
    if (currentUser?.role === 'owner') {
      setActiveScreen('admin');
      setAdminTab('home');
    } else {
      setActiveScreen('home');
    }
  };

  const [simUsers, setSimUsers] = useState<any[]>([]);
  const [adminSearchUser, setAdminSearchUser] = useState('');
  const [adminSearchEquip, setAdminSearchEquip] = useState('');
  const [userModalOpen, setUserModalOpen] = useState<'add' | 'edit' | null>(null);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<any | null>(null);
  const [userFormEmail, setUserFormEmail] = useState('');
  const [userFormPassword, setUserFormPassword] = useState('');
  const [userFormRole, setUserFormRole] = useState<'owner' | 'operator'>('operator');
  const [userLogs, setUserLogs] = useState<any[]>([]);
  const [showConfirmClearLogs, setShowConfirmClearLogs] = useState(false);

  // Sensors simulator (Aba 2)
  const [sensorCollectorTemp, setSensorCollectorTemp] = useState<number>(45);
  const [sensorPoolTemp, setSensorPoolTemp] = useState<number>(28);
  const [sensorErrorActive, setSensorErrorActive] = useState<boolean>(false);
  const [flowErrorActive, setFlowErrorActive] = useState<boolean>(false);

  // Individual telemetry search & data state
  const [telemetrySearchId, setTelemetrySearchId] = useState('');
  const [deviceTelemetryMap, setDeviceTelemetryMap] = useState<Record<string, {
    mostUsedLedProgram: string;
    maxFilteringTime: number;
    minFilteringTime: number;
    hydroTimerUsageMinutes: number;
    latitude: number;
    longitude: number;
  }>>({});

  const getDeviceTelemetry = (id: string) => {
    const key = id.toUpperCase();
    if (deviceTelemetryMap[key]) {
      return deviceTelemetryMap[key];
    }
    // Return deterministic stable defaults based on the key to prevent blank states
    const latBase = -23.5505;
    const lngBase = -46.6333;
    let charSum = 0;
    for (let i = 0; i < key.length; i++) {
      charSum += key.charCodeAt(i);
    }
    const offsetLat = ((charSum % 100) - 50) / 200; // between -0.25 and +0.25
    const offsetLng = (((charSum * 3) % 100) - 50) / 200;
    
    const ledPrograms = ['Arco-Íris Dinâmico', 'Azul Real Fixo', 'Verde Relax', 'Cromoterapia Suave', 'Festa Estroboscópica', 'Lilás Zen'];
    const chosenLed = ledPrograms[charSum % ledPrograms.length];
    
    return {
      mostUsedLedProgram: chosenLed,
      maxFilteringTime: 4 + (charSum % 7), // 4h to 10h
      minFilteringTime: 1 + (charSum % 3), // 1h to 3h
      hydroTimerUsageMinutes: 15 * (1 + (charSum % 4)), // 15, 30, 45, 60
      latitude: Number((latBase + offsetLat).toFixed(4)),
      longitude: Number((lngBase + offsetLng).toFixed(4))
    };
  };

  const updateDeviceTelemetry = (id: string, updatedFields: Partial<{
    mostUsedLedProgram: string;
    maxFilteringTime: number;
    minFilteringTime: number;
    hydroTimerUsageMinutes: number;
    latitude: number;
    longitude: number;
  }>) => {
    const key = id.toUpperCase();
    const current = getDeviceTelemetry(id);
    const newMap = {
      ...deviceTelemetryMap,
      [key]: { ...current, ...updatedFields }
    };
    setDeviceTelemetryMap(newMap);
    localStorage.setItem('device_telemetry_map', JSON.stringify(newMap));
  };
  
  // Auth inputs
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);

  // Firebase Config State (allows customized credential binding matching user requirement)
  const [firebaseConfig, setFirebaseConfig] = useState({
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: ''
  });
  const [firebaseInitialized, setFirebaseInitialized] = useState(false);
  const authRef = useRef<any>(null);

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
  const [bleDeviceId, setBleDeviceId] = useState('MM12TW-000123');
  const [bleLog, setBleLog] = useState<string[]>([]);

  // Registered Equipments (unique ID for each, with choices of MM12TW, MM03TW, MM08TSW or custom from QR)
  const [registeredEquipments, setRegisteredEquipments] = useState<{ 
    id: string; 
    model: string; 
    serial?: string; 
    manufacturer?: string; 
    userEmail?: string; 
    userPassword?: string;
  }[]>([]);
  const [selectedEquipmentModel, setSelectedEquipmentModel] = useState<string>('MM12TW');
  const activeEquipment = registeredEquipments.find(eq => eq.id.toLowerCase() === deviceId.toLowerCase());
  const activeModel = activeEquipment?.model || 'MM12TW';
  const searchedEquip = registeredEquipments.find(eq => eq.id.toLowerCase() === telemetrySearchId.trim().toLowerCase());
  const telemetry = searchedEquip ? getDeviceTelemetry(searchedEquip.id) : null;
  const [equipmentSerial, setEquipmentSerial] = useState<string>('');
  const [equipmentManufacturer, setEquipmentManufacturer] = useState<string>('MASTERLAZER');
  
  // QR Code Scanner States
  const [isScanningQr, setIsScanningQr] = useState(false);
  const [qrScannerError, setQrScannerError] = useState<string | null>(null);
  const [scannedData, setScannedData] = useState<any | null>(null);
  const qrScannerRef = useRef<any>(null);
  
  // Real-time Controls / Statuses
  const [motorHidro, setMotorHidro] = useState(false);
  const [motorFiltro, setMotorFiltro] = useState(false);
  const [motor3, setMotor3] = useState(false);
  const [motor4, setMotor4] = useState(false);
  const [motor1Name, setMotor1Name] = useState('Motor 01');
  const [motor2Name, setMotor2Name] = useState('Motor 02');
  const [motor3Name, setMotor3Name] = useState('Motor 03');
  const [motor4Name, setMotor4Name] = useState('Motor 04');
  const [isEditingM1, setIsEditingM1] = useState(false);
  const [isEditingM2, setIsEditingM2] = useState(false);
  const [isEditingM3, setIsEditingM3] = useState(false);
  const [isEditingM4, setIsEditingM4] = useState(false);
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
  const iroPickerRef = useRef<any>(null);
  const pickerContainerId = 'iro-color-picker-target';

  const [pahoLoaded, setPahoLoaded] = useState(false);
  const [firebaseAppLoaded, setFirebaseAppLoaded] = useState(false);
  const [userWantsMqtt, setUserWantsMqttState] = useState(true);
  const userWantsMqttRef = useRef(true);
  const lastMessageTimeRef = useRef<number>(0);
  
  const setUserWantsMqtt = (val: boolean) => {
    userWantsMqttRef.current = val;
    setUserWantsMqttState(val);
  };

  // 1. Initial State Resolution
  useEffect(() => {
    // Resolve states from Storage helper to avoid SSR hydration issues and comply with ESLint constraints
    setTimeout(() => {
      const storedBroker = localStorage.getItem('mqtt_broker') || DEFAULT_MQTT_BROKER;
      const storedPort = localStorage.getItem('mqtt_port') || DEFAULT_MQTT_PORT;
      let storedDevice = localStorage.getItem('mqtt_device') || DEFAULT_DEVICE_ID;

      const storedMqttUser = localStorage.getItem('mqtt_user') || '';
      const storedMqttPass = localStorage.getItem('mqtt_pass') || '';
      const storedMotor1Name = localStorage.getItem('motor1_name') || 'Motor 01';
      const storedMotor2Name = localStorage.getItem('motor2_name') || 'Motor 02';
      const storedMotor3Name = localStorage.getItem('motor3_name') || 'Motor 03';
      const storedMotor4Name = localStorage.getItem('motor4_name') || 'Motor 04';

      setMqttBroker(storedBroker);
      setMqttPort(storedPort);
      setDeviceId(storedDevice);
      setMqttUser(storedMqttUser);
      setMqttPassword(storedMqttPass);
      setMotor1Name(storedMotor1Name);
      setMotor2Name(storedMotor2Name);
      setMotor3Name(storedMotor3Name);
      setMotor4Name(storedMotor4Name);

      const storedEquips = localStorage.getItem('registered_equipments');
      if (storedEquips) {
        try {
          const parsed = JSON.parse(storedEquips);
          const hasOp1 = parsed.some((e: any) => e.userEmail === 'operador.suporte@lazer.com');
          const hasOp2 = parsed.some((e: any) => e.userEmail === 'visitante.pool@lazer.com');
          if (!hasOp1 || !hasOp2) {
            const updatedParsed = parsed.map((e: any) => {
              if (e.id === 'MM12TW-000123' && !e.userEmail) {
                return { ...e, userEmail: 'operador.suporte@lazer.com', userPassword: '12345678' };
              }
              if (e.id === 'MM03TW-1002' && !e.userEmail) {
                return { ...e, userEmail: 'visitante.pool@lazer.com', userPassword: '12345678' };
              }
              return e;
            });
            setRegisteredEquipments(updatedParsed);
            localStorage.setItem('registered_equipments', JSON.stringify(updatedParsed));
          } else {
            setRegisteredEquipments(parsed);
          }
        } catch (e) {
          console.error(e);
        }
      } else {
        const initialEquips = [
          { id: 'MM12TW-000123', model: 'MM12TW' as const, userEmail: 'operador.suporte@lazer.com', userPassword: '12345678' },
          { id: 'MM03TW-1002', model: 'MM03TW' as const, userEmail: 'visitante.pool@lazer.com', userPassword: '12345678' },
          { id: 'MM08TSW-20045', model: 'MM08TSW' as const }
        ];
        setRegisteredEquipments(initialEquips);
        localStorage.setItem('registered_equipments', JSON.stringify(initialEquips));
      }

      const storedTelemetry = localStorage.getItem('device_telemetry_map');
      if (storedTelemetry) {
        try {
          setDeviceTelemetryMap(JSON.parse(storedTelemetry));
        } catch (e) {
          console.error(e);
        }
      } else {
        const initialTelemetry = {
          'MM12TW-000123': {
            mostUsedLedProgram: 'Arco-Íris Dinâmico',
            maxFilteringTime: 6,
            minFilteringTime: 2,
            hydroTimerUsageMinutes: 30,
            latitude: -23.5505,
            longitude: -46.6333
          },
          'MM03TW-1002': {
            mostUsedLedProgram: 'Azul Fixo',
            maxFilteringTime: 4,
            minFilteringTime: 1,
            hydroTimerUsageMinutes: 15,
            latitude: -22.9068,
            longitude: -43.1729
          },
          'MM08TSW-20045': {
            mostUsedLedProgram: 'Cromoterapia Relax',
            maxFilteringTime: 8,
            minFilteringTime: 3,
            hydroTimerUsageMinutes: 45,
            latitude: -30.0346,
            longitude: -51.2177
          }
        };
        setDeviceTelemetryMap(initialTelemetry);
        localStorage.setItem('device_telemetry_map', JSON.stringify(initialTelemetry));
      }

      const conf = {
        apiKey: localStorage.getItem('fb_api_key') || '',
        authDomain: localStorage.getItem('fb_auth_domain') || '',
        projectId: localStorage.getItem('fb_project_id') || '',
        storageBucket: localStorage.getItem('fb_storage_bucket') || '',
        messagingSenderId: localStorage.getItem('fb_messaging_sender_id') || '',
        appId: localStorage.getItem('fb_app_id') || ''
      };
      setFirebaseConfig(conf);

      // Pre-seed simulated users database so they always have admin@admin.com and owners' emails ready on load
      try {
        const storedUsers = JSON.parse(localStorage.getItem('sim_users') || '[]');
        const defaultUsers = [
          { email: 'admin@admin.com', password: '12345678', uid: 'sim-admin-id', role: 'owner' },
          { email: 'edersonbatistabertirs@gmail.com', password: '12345678', uid: 'sim-user-id', role: 'owner' },
          { email: 'operador.suporte@lazer.com', password: '12345678', uid: 'sim-op-id', role: 'operator' },
          { email: 'visitante.pool@lazer.com', password: '12345678', uid: 'sim-visit-id', role: 'operator' }
        ];
        
        let updatedUsersList = [...storedUsers];
        defaultUsers.forEach(defUser => {
          const exists = updatedUsersList.find(u => (u.email || '').toLowerCase().trim() === defUser.email);
          if (!exists) {
            updatedUsersList.push(defUser);
          } else if (!exists.role) {
            exists.role = defUser.role;
          }
        });
        localStorage.setItem('sim_users', JSON.stringify(updatedUsersList));
        setSimUsers(updatedUsersList);
      } catch (e) {
        console.error("Error pre-seeding users:", e);
      }

      // Pre-seed logs for beautiful stats graphs
      try {
        if (!localStorage.getItem('sim_user_logs')) {
          const dummyLogs = [
            { id: 'log-1', timestamp: new Date(Date.now() - 5 * 60000).toISOString(), email: 'edersonbatistabertirs@gmail.com', action: 'Ligou Motor Hidro (M1)', deviceId: 'MM12TW-000123' },
            { id: 'log-2', timestamp: new Date(Date.now() - 25 * 60000).toISOString(), email: 'admin@admin.com', action: 'Configurou Timer do LED', deviceId: 'MM12TW-000123' },
            { id: 'log-3', timestamp: new Date(Date.now() - 40 * 60000).toISOString(), email: 'edersonbatistabertirs@gmail.com', action: 'Alterou Cor do LED (H:240, S:100, V:100)', deviceId: 'MM12TW-000123' },
            { id: 'log-4', timestamp: new Date(Date.now() - 120 * 60000).toISOString(), email: 'operador.suporte@lazer.com', action: 'Salvou Configuração de Filtração', deviceId: 'MM12TW-000123' },
            { id: 'log-5', timestamp: new Date(Date.now() - 180 * 60000).toISOString(), email: 'visitante.pool@lazer.com', action: 'Ligou Motor de Filtro (M2)', deviceId: 'MM03TW-1002' },
            { id: 'log-6', timestamp: new Date(Date.now() - 300 * 60000).toISOString(), email: 'edersonbatistabertirs@gmail.com', action: 'Desligou Motor Hidro (M1)', deviceId: 'MM12TW-000123' },
            { id: 'log-7', timestamp: new Date(Date.now() - 420 * 60000).toISOString(), email: 'admin@admin.com', action: 'Ligou Motor 3 (M3)', deviceId: 'MM08TSW-20045' },
            { id: 'log-8', timestamp: new Date(Date.now() - 600 * 60000).toISOString(), email: 'operador.suporte@lazer.com', action: 'Configurou Timer de Hidro', deviceId: 'MM12TW-000123' },
            { id: 'log-9', timestamp: new Date(Date.now() - 820 * 60000).toISOString(), email: 'edersonbatistabertirs@gmail.com', action: 'Alterou Cor do LED (H:120, S:100, V:100)', deviceId: 'MM12TW-000123' },
            { id: 'log-10', timestamp: new Date(Date.now() - 1000 * 60000).toISOString(), email: 'admin@admin.com', action: 'Salvou Configurações do Broker MQTT', deviceId: 'MM12TW-000123' },
            { id: 'log-11', timestamp: new Date(Date.now() - 1200 * 60000).toISOString(), email: 'visitante.pool@lazer.com', action: 'Ligou Motor 4 (M4)', deviceId: 'MM12TW-000123' },
            { id: 'log-12', timestamp: new Date(Date.now() - 1500 * 60000).toISOString(), email: 'edersonbatistabertirs@gmail.com', action: 'Configurou Timer de Hidro', deviceId: 'MM12TW-000123' },
            { id: 'log-13', timestamp: new Date(Date.now() - 1800 * 60000).toISOString(), email: 'admin@admin.com', action: 'Ligou Motor Hidro (M1)', deviceId: 'MM03TW-1002' },
            { id: 'log-14', timestamp: new Date(Date.now() - 2200 * 60000).toISOString(), email: 'operador.suporte@lazer.com', action: 'Desligou Motor 3 (M3)', deviceId: 'MM08TSW-20045' },
            { id: 'log-15', timestamp: new Date(Date.now() - 2800 * 60000).toISOString(), email: 'edersonbatistabertirs@gmail.com', action: 'Ligou Motor de Filtro (M2)', deviceId: 'MM12TW-000123' }
          ];
          localStorage.setItem('sim_user_logs', JSON.stringify(dummyLogs));
        }
        const logs = JSON.parse(localStorage.getItem('sim_user_logs') || '[]');
        setUserLogs(logs);
      } catch (e) {
        console.error("Error pre-seeding logs:", e);
      }

      const simUser = localStorage.getItem('sim_user');
      if (simUser) {
        try {
          const parsed = JSON.parse(simUser);
          setCurrentUser(parsed);
          const emailLower = (parsed.email || '').toLowerCase().trim();
          const isOwner = emailLower === 'admin@admin.com' || emailLower === 'edersonbatistabertirs@gmail.com' || parsed.role === 'owner';
          if (isOwner) {
            setActiveScreen('admin');
          } else {
            setActiveScreen('home');
          }
        } catch (e) {
          // ignore
        }
      }

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
    // Reset device specific metrics on ID change to avoid showing old values wrapped in setTimeout to prevent cascading render error
    setTimeout(() => {
      setDeviceIp('---');
      setDeviceMac('---');
      const matched = registeredEquipments.find(eq => eq.id.toLowerCase() === deviceId.toLowerCase());
      if (matched) {
        setDeviceModelo(matched.model || '---');
        setDeviceSerial(matched.serial || '---');
      } else {
        setDeviceModelo('---');
        setDeviceSerial('---');
      }
      setDeviceOnline(null);
    }, 0);
    lastMessageTimeRef.current = 0;

    if (typeof window !== 'undefined' && window.Paho && currentUser && userWantsMqtt) {
      console.log('Active Device ID changed, reconnecting MQTT to update subscriptions...');
      disconnectMQTT();
      const t = setTimeout(() => {
        connectMQTT();
      }, 300);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, registeredEquipments]);

  // 1e. Periodic check: if device is marked as online but hasn't sent any message for > 15 seconds, mark it as offline
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const interval = setInterval(() => {
      if (mqttConnected && deviceOnline === true && lastMessageTimeRef.current > 0) {
        if (Date.now() - lastMessageTimeRef.current > 15000) {
          console.log('No telemetry received from device in 15 seconds. Marking device as OFFLINE.');
          setDeviceOnline(false);
        }
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [mqttConnected, deviceOnline]);

  // 2. Initialize Firebase SDK once scripts/config resolved
  const initRealFirebase = () => {
    if (typeof window === 'undefined' || !window.firebase || !firebaseConfig.apiKey) {
      return; // Not configured yet, fall back to robust local simulator
    }
    try {
      const fb = window.firebase;
      let app;
      if (fb.apps.length === 0) {
        app = fb.initializeApp(firebaseConfig);
      } else {
        app = fb.app();
      }
      
      const auth = fb.auth();
      authRef.current = auth;
      
      // Wrap synchronously called state updates in a timeout to avoid synchronous cascading renders
      setTimeout(() => {
        setFirebaseInitialized(true);
      }, 0);

      auth.onAuthStateChanged((usr: any) => {
        if (usr) {
          setCurrentUser(usr);
          setActiveScreen('home');
        } else {
          setCurrentUser(null);
          if (activeScreen !== 'register') {
            setActiveScreen('login');
          }
        }
      });
    } catch (err: any) {
      console.warn("Real Firebase Boot Failed, defaulting to robust local sandbox auth flow:", err);
    }
  };

  const isFirebaseAvailable = typeof window !== 'undefined' && !!window.firebase;
  useEffect(() => {
    if (firebaseConfig.apiKey && isFirebaseAvailable) {
      initRealFirebase();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseConfig, isFirebaseAvailable]);

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
              width: 210,
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
                publishTopic(`MASTERLAZER/${deviceId}/led/ctrl`, "ON");
                publishTopic(`MASTERLAZER/${deviceId}/led/pg`, "1");
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
    
    // Core command channels
    publishTopic(`MASTERLAZER/${deviceId}/pwm/r`, String(rgb.r));
    publishTopic(`MASTERLAZER/${deviceId}/pwm/g`, String(rgb.g));
    publishTopic(`MASTERLAZER/${deviceId}/pwm/b`, String(rgb.b));

    // Fallbacks
    publishTopic(`${deviceId}/pwm/r`, String(rgb.r));
    publishTopic(`${deviceId}/pwm/g`, String(rgb.g));
    publishTopic(`${deviceId}/pwm/b`, String(rgb.b));
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

    // If real Firebase configured, route there:
    if (firebaseInitialized && authRef.current) {
      try {
        if (mode === 'login') {
          await authRef.current.signInWithEmailAndPassword(cleanEmail, cleanPassword);
        } else {
          await authRef.current.createUserWithEmailAndPassword(cleanEmail, cleanPassword);
          alert('Conta cadastrada com sucesso!');
          setActiveScreen('home');
        }
      } catch (err: any) {
        setAuthErrorMessage(`Erro: ${err.message || 'Falha na autenticação.'}`);
      } finally {
        setIsLoadingAuth(false);
      }
      return;
    }

    // Dynamic Mock Auth Fallback Mode
    setTimeout(() => {
      setIsLoadingAuth(false);
      if (mode === 'login') {
        const storedUsers = JSON.parse(localStorage.getItem('sim_users') || '[]');
        const matched = storedUsers.find((u: any) => {
          const uEmail = (u.email || '').trim().toLowerCase();
          return uEmail === cleanEmail && u.password === cleanPassword;
        });
        
        const isOwner = cleanEmail === 'admin@admin.com' || cleanEmail === 'edersonbatistabertirs@gmail.com' || matched?.role === 'owner';
        
        if (matched || (cleanEmail === 'admin@admin.com' && cleanPassword === '12345678') || (cleanEmail === 'edersonbatistabertirs@gmail.com' && cleanPassword === '12345678')) { // default dev shortcuts
          const loggedUser = { 
            email: cleanEmail, 
            password: cleanPassword, 
            uid: matched?.uid || (cleanEmail === 'admin@admin.com' ? 'sim-admin-id' : 'sim-user-id'),
            role: isOwner ? 'owner' : (matched?.role || 'operator')
          };
          localStorage.setItem('sim_user', JSON.stringify(loggedUser));
          setCurrentUser(loggedUser);
          if (isOwner) {
            setActiveScreen('admin');
          } else {
            setActiveScreen('home');
          }
        } else {
          setAuthErrorMessage('Senha incorreta ou e-mail não cadastrado neste navegador.');
        }
      } else {
        const storedUsers = JSON.parse(localStorage.getItem('sim_users') || '[]');
        const existingIdx = storedUsers.findIndex((u: any) => (u.email || '').trim().toLowerCase() === cleanEmail);
        
        const isOwner = cleanEmail === 'admin@admin.com' || cleanEmail === 'edersonbatistabertirs@gmail.com';
        const role = isOwner ? 'owner' : 'operator';

        if (existingIdx !== -1) {
          // If the profile matches a default preseeded user profile with '12345678', we'll allow registering over it with a custom password!
          if (storedUsers[existingIdx].password === '12345678') {
            storedUsers[existingIdx].password = cleanPassword;
            storedUsers[existingIdx].role = role;
            localStorage.setItem('sim_users', JSON.stringify(storedUsers));
            const loggedUser = { email: cleanEmail, password: cleanPassword, uid: storedUsers[existingIdx].uid, role };
            localStorage.setItem('sim_user', JSON.stringify(loggedUser));
            setCurrentUser(loggedUser);
            alert('Sua conta pré-cadastrada foi personalizada e ativada com sucesso!');
            if (isOwner) {
              setActiveScreen('admin');
            } else {
              setActiveScreen('home');
            }
            return;
          }
          setAuthErrorMessage('E-mail já cadastrado.');
          return;
        }
        const newUser = { email: cleanEmail, password: cleanPassword, role, uid: 'sim-' + Math.random().toString(36).substr(2, 9) };
        storedUsers.push(newUser);
        localStorage.setItem('sim_users', JSON.stringify(storedUsers));
        
        const loggedUser = { email: cleanEmail, password: cleanPassword, role, uid: newUser.uid };
        localStorage.setItem('sim_user', JSON.stringify(loggedUser));
        setCurrentUser(loggedUser);
        alert('Conta criada com sucesso no sistema local!');
        if (isOwner) {
          setActiveScreen('admin');
        } else {
          setActiveScreen('home');
        }
      }
    }, 800);
  };

  const handleResetPasswordSimulated = async () => {
    if (!emailInput) {
      alert('Por favor, insira o seu e-mail no campo de login acima.');
      return;
    }
    
    if (firebaseInitialized && authRef.current) {
      try {
        await authRef.current.sendPasswordResetEmail(emailInput);
        alert('E-mail de redefinição enviado com sucesso para o seu Firebase Auth!');
      } catch (err: any) {
        alert(`Erro Firebase: ${err.message}`);
      }
      return;
    }

    alert(`Instruções de recuperação de senha enviadas para o email: ${emailInput} (Simulação: sandbox limpo).`);
  };

  const handleLogout = async () => {
    if (firebaseInitialized && authRef.current) {
      try {
        await authRef.current.signOut();
      } catch (err) {
        console.error(err);
      }
    }
    localStorage.removeItem('sim_user');
    setCurrentUser(null);
    setEmailInput('');
    setPasswordInput('');
    setActiveScreen('login');
    disconnectMQTT();
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
      const host = mqttBroker || DEFAULT_MQTT_BROKER;
      const port = parseInt(mqttPort) || parseInt(DEFAULT_MQTT_PORT);
      const isSSL = port === 8081 || port === 443;

      const client = new window.Paho.MQTT.Client(host, port, clientId);
      mqttClientRef.current = client;

      client.onConnectionLost = (responseObject: any) => {
        if (responseObject.errorCode !== 0) {
          console.warn('MQTT Connection lost:', responseObject.errorMessage);
          setMqttConnected(false);
          setMqttStatusMessage('Desconectado');
          setMqttErrorMsg(responseObject.errorMessage);

          // Retry connection if user wants connectivity
          if (userWantsMqttRef.current) {
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = setTimeout(() => {
              console.log('Automated Reconnection onConnectionLost target triggered...');
              connectMQTT();
            }, 3000);
          }
        }
      };

      client.onMessageArrived = (message: any) => {
        const dest = message.destinationName;
        const payload = (message.payloadString || '').trim();
        console.log('Received Message From Hardware:', dest, payload);

        const cleanActiveId = cleanDeviceId(deviceId).toLowerCase();
        const rawActiveId = (deviceId || '').toLowerCase().trim();

        // Identify device and relative topic
        let devicePartOfMessage = '';
        let relativeTopic = dest;

        const activeEquipment = registeredEquipments.find(eq => eq.id.toLowerCase() === deviceId.toLowerCase());
        const parts = dest.split('/');
        
        if (parts.length >= 2 && (
          parts[0].toUpperCase() === 'MASTERLAZER' || 
          (activeEquipment?.manufacturer && parts[0].toUpperCase() === activeEquipment.manufacturer.toUpperCase())
        )) {
          devicePartOfMessage = parts[1];
          relativeTopic = parts.slice(2).join('/');
        } else {
          if (parts.length >= 1) {
            devicePartOfMessage = parts[0];
            relativeTopic = parts.slice(1).join('/');
          }
        }

        const cleanMsgDeviceId = cleanDeviceId(devicePartOfMessage).toLowerCase();
        const rawMsgDeviceId = devicePartOfMessage.toLowerCase().trim();

        // Verify this message is indeed for our current active device context
        const isTargetDevice = (
          cleanMsgDeviceId === cleanActiveId || 
          rawMsgDeviceId === rawActiveId || 
          cleanMsgDeviceId === rawActiveId ||
          rawMsgDeviceId === cleanActiveId
        );

        if (!isTargetDevice) {
          // Message belongs to another device sequence, ignore
          return;
        }

        const lowerRelative = relativeTopic.toLowerCase();

        // Any telemetry received from the active device indicates it is powered on and sending data
        lastMessageTimeRef.current = Date.now();
        if (lowerRelative !== 'status' && lowerRelative !== 'state') {
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
        if (lowerRelative === 'info/ip') {
          setDeviceIp(payload);
          return;
        }
        if (lowerRelative === 'info/mac') {
          setDeviceMac(payload);
          return;
        }
        if (lowerRelative === 'info/modelo') {
          setDeviceModelo(payload);
          return;
        }
        if (lowerRelative === 'info/serial') {
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
        keepAliveInterval: 20, // Send ping every 20 seconds to keep connection alive on mobile/cellular
        timeout: 8,            // 8s connect timeout
        onSuccess: () => {
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

          const topicsToSubscribeSet = new Set<string>();
          [activeCleanId, deviceId].forEach((id) => {
            if (!id) return;
            relativePaths.forEach((path) => {
              topicsToSubscribeSet.add(`${id}/${path}`);
              topicsToSubscribeSet.add(`MASTERLAZER/${id}/${path}`);
              if (activeEquipment?.manufacturer) {
                topicsToSubscribeSet.add(`${activeEquipment.manufacturer}/${id}/${path}`);
              }
            });
          });

          const topicsToSubscribe = Array.from(topicsToSubscribeSet);

          topicsToSubscribe.forEach((t) => {
            try {
              client.subscribe(t);
              console.log(`Subscribed to status channel: ${t}`);
            } catch (err) {
              console.error(`Subscription failed for ${t}:`, err);
            }
          });

          // Send query commands to request immediate status update from hardware
          const queryTopicsSet = new Set<string>();
          [activeCleanId, deviceId].forEach((id) => {
            if (!id) return;
            ['get', 'cmd', 'status/get'].forEach((cmdPath) => {
              queryTopicsSet.add(`${id}/${cmdPath}`);
              queryTopicsSet.add(`MASTERLAZER/${id}/${cmdPath}`);
              if (activeEquipment?.manufacturer) {
                queryTopicsSet.add(`${activeEquipment.manufacturer}/${id}/${cmdPath}`);
              }
            });
          });

          const queryTopics = Array.from(queryTopicsSet);

          queryTopics.forEach((qt) => {
            try {
              // Send various common MQTT request patterns to ensure compatibility
              const msgStatus = new window.Paho.MQTT.Message("STATUS");
              msgStatus.destinationName = qt;
              client.send(msgStatus);

              const msgGet = new window.Paho.MQTT.Message("GET");
              msgGet.destinationName = qt;
              client.send(msgGet);

              const msgRead = new window.Paho.MQTT.Message("read");
              msgRead.destinationName = qt;
              client.send(msgRead);
            } catch (err) {
              console.warn(`Initial query failed on ${qt}:`, err);
            }
          });
        },
        onFailure: (err: any) => {
          console.error('MQTT Connection Failure:', err);
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

          friendlyMsg += ' Dica: Se o Mosquitto falhar, tente usar presets (HiveMQ ou EMQX) nas Definições!';
          setMqttErrorMsg(friendlyMsg);

          // Retry connection if user wants connectivity
          if (userWantsMqttRef.current) {
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = setTimeout(() => {
              console.log('Automated Reconnection onFailure target triggered...');
              connectMQTT();
            }, 5000);
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

  const disconnectMQTT = () => {
    setUserWantsMqtt(false); // User intentionally disconnected
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
    setMqttStatusMessage('Desconectado');
  };

  function publishTopic(subTopic: string, payload: string) {
    if (mqttClientRef.current && mqttClientRef.current.isConnected()) {
      try {
        const rawId = (deviceId || '').trim();
        const cleanId = cleanDeviceId(deviceId).trim();

        const uniqueTopics = new Set<string>();

        // 1. Add original subTopic to our list of targets
        uniqueTopics.add(subTopic);

        // 2. If rawId and cleanId differ, we generate respective alternate versions
        if (rawId && cleanId && rawId.toLowerCase() !== cleanId.toLowerCase()) {
          const replacedWithClean = subTopic.replace(new RegExp(escapeRegExp(rawId), 'gi'), cleanId);
          uniqueTopics.add(replacedWithClean);

          const replacedWithRaw = subTopic.replace(new RegExp(escapeRegExp(cleanId), 'gi'), rawId);
          uniqueTopics.add(replacedWithRaw);
        }

        // 3. For each topic, ensure we send with standard, custom manufacturer, and no prefix
        const activeEquipment = registeredEquipments.find(eq => eq.id.toLowerCase() === deviceId.toLowerCase());
        const topicsToSend = new Set<string>();
        uniqueTopics.forEach((t) => {
          topicsToSend.add(t);
          
          let relativePart = t;
          if (t.startsWith('MASTERLAZER/')) {
            relativePart = t.substring('MASTERLAZER/'.length);
          } else if (activeEquipment?.manufacturer && t.toUpperCase().startsWith(activeEquipment.manufacturer.toUpperCase() + '/')) {
            relativePart = t.substring(activeEquipment.manufacturer.length + 1);
          }
          
          topicsToSend.add(relativePart);
          topicsToSend.add(`MASTERLAZER/${relativePart}`);
          if (activeEquipment?.manufacturer) {
            topicsToSend.add(`${activeEquipment.manufacturer}/${relativePart}`);
          }
        });

        // 4. Send the messages to all computed topic targets
        topicsToSend.forEach((t) => {
          try {
            const message = new window.Paho.MQTT.Message(payload);
            message.destinationName = t;
            mqttClientRef.current.send(message);
            console.log(`MQTT Published topic [${t}]: ${payload}`);
          } catch (innerErr) {
            console.warn(`MQTT individual send failed on [${t}]:`, innerErr);
          }
        });
      } catch (err) {
        console.error('Publish error:', err);
      }
    } else {
      console.warn('MQTT client is offline. Skipping write operation on topic:', subTopic);
    }
  }

  const logUserAction = (actionName: string) => {
    try {
      const email = currentUser?.email || 'anonimo@pool.com';
      const storedLogs = JSON.parse(localStorage.getItem('sim_user_logs') || '[]');
      const newLog = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        email,
        action: actionName,
        deviceId: deviceId || 'MASTERLAZER'
      };
      const updated = [newLog, ...storedLogs].slice(0, 200);
      localStorage.setItem('sim_user_logs', JSON.stringify(updated));
      setUserLogs(updated);
    } catch (e) {
      console.error("Error logging action:", e);
    }
  };

  const handleAddUserAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    const email = userFormEmail.trim().toLowerCase();
    const password = userFormPassword;
    const role = userFormRole;

    if (!email || password.length < 8) {
      alert('Preencha um e-mail válido e senha com no mínimo 8 caracteres.');
      return;
    }

    const currentUsersList = JSON.parse(localStorage.getItem('sim_users') || '[]');
    if (currentUsersList.some((u: any) => (u.email || '').trim().toLowerCase() === email)) {
      alert('Usuário com este e-mail já existe!');
      return;
    }

    const newUser = {
      email,
      password,
      role,
      uid: 'sim-' + Math.random().toString(36).substr(2, 9)
    };

    const updated = [...currentUsersList, newUser];
    localStorage.setItem('sim_users', JSON.stringify(updated));
    setSimUsers(updated);
    logUserAction(`Criou usuário: ${email} (${role === 'owner' ? 'Proprietário' : 'Operador'})`);

    // Reset Form
    setUserFormEmail('');
    setUserFormPassword('');
    setUserFormRole('operator');
    setUserModalOpen(null);
    alert('Usuário cadastrado com sucesso!');
  };

  const handleUpdateUserAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForEdit) return;

    const email = userFormEmail.trim().toLowerCase();
    const password = userFormPassword;
    const role = userFormRole;

    if (!email || password.length < 8) {
      alert('Preencha um e-mail válido e senha com no mínimo 8 caracteres.');
      return;
    }

    const currentUsersList = JSON.parse(localStorage.getItem('sim_users') || '[]');
    const idx = currentUsersList.findIndex((u: any) => u.uid === selectedUserForEdit.uid);
    if (idx === -1) {
      alert('Usuário não encontrado!');
      return;
    }

    // Check email uniqueness if changed
    if (currentUsersList[idx].email.toLowerCase().trim() !== email) {
      if (currentUsersList.some((u: any) => (u.email || '').trim().toLowerCase() === email)) {
        alert('E-mail já está sendo usado por outro usuário!');
        return;
      }
    }

    currentUsersList[idx].email = email;
    currentUsersList[idx].password = password;
    currentUsersList[idx].role = role;

    localStorage.setItem('sim_users', JSON.stringify(currentUsersList));
    setSimUsers(currentUsersList);
    logUserAction(`Editou usuário: ${email} (${role === 'owner' ? 'Proprietário' : 'Operador'})`);

    // If edited self, update currentUser state
    if (currentUser && currentUser.uid === selectedUserForEdit.uid) {
      const updatedSelf = { ...currentUser, email, password, role };
      localStorage.setItem('sim_user', JSON.stringify(updatedSelf));
      setCurrentUser(updatedSelf);
    }

    // Reset Form
    setSelectedUserForEdit(null);
    setUserFormEmail('');
    setUserFormPassword('');
    setUserFormRole('operator');
    setUserModalOpen(null);
    alert('Usuário atualizado com sucesso!');
  };

  const handleDeleteUserAdmin = (uid: string) => {
    if (currentUser && currentUser.uid === uid) {
      alert('Você não pode excluir a si mesmo enquanto estiver logado!');
      return;
    }

    const targetUser = simUsers.find(u => u.uid === uid);
    if (!targetUser) return;

    if (targetUser.email === 'admin@admin.com' || targetUser.email === 'edersonbatistabertirs@gmail.com') {
      alert('Estes usuários de sistema padrão (proprietários raiz) não podem ser excluídos!');
      return;
    }

    if (!confirm(`Tem certeza que deseja excluir o usuário ${targetUser.email}?`)) {
      return;
    }

    const currentUsersList = JSON.parse(localStorage.getItem('sim_users') || '[]');
    const updated = currentUsersList.filter((u: any) => u.uid !== uid);
    localStorage.setItem('sim_users', JSON.stringify(updated));
    setSimUsers(updated);
    logUserAction(`Excluiu usuário: ${targetUser.email}`);
    alert('Usuário excluído!');
  };

  // 7. Interactive action button tasks
  const handleMotorChange = (motorType: 'hidro' | 'filtro' | 'motor3' | 'motor4', checked: boolean) => {
    let num = '1';
    if (motorType === 'hidro') {
      num = '1';
      setMotorHidro(checked);
    } else if (motorType === 'filtro') {
      num = '2';
      setMotorFiltro(checked);
    } else if (motorType === 'motor3') {
      num = '3';
      setMotor3(checked);
    } else if (motorType === 'motor4') {
      num = '4';
      setMotor4(checked);
    }

    const payloadON_OFF = checked ? 'ON' : 'OFF';

    const labelName = motorType === 'hidro' ? motor1Name : motorType === 'filtro' ? motor2Name : motorType === 'motor3' ? motor3Name : motor4Name;
    logUserAction(`Togglou ${labelName} para ${checked ? 'LIGADO' : 'DESLIGADO'}`);

    // Core brand commands
    publishTopic(`MASTERLAZER/${deviceId}/mt${num}`, payloadON_OFF);

    // Fallbacks
    publishTopic(`${deviceId}/mt${num}`, payloadON_OFF);
    publishTopic(`MASTERLAZER/${deviceId}/mt${num}/state`, payloadON_OFF);
    publishTopic(`${deviceId}/mt${num}/state`, payloadON_OFF);
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
    
    // Única publicação necessária
    publishTopic(`MASTERLAZER/${deviceId}/led/ctrl`, "INC");
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
    
    // Única publicação necessária
    publishTopic(`MASTERLAZER/${deviceId}/led/ctrl`, "DEC");
  };

  const handleDirectProgramSelect = (progNum: number) => {
    setCurrentProgram(progNum);
    
    // Única publicação necessária
    publishTopic(`MASTERLAZER/${deviceId}/led/pg`, String(progNum));
  };

  const handleProgramOff = () => {
    setCurrentProgram('---');
    
    publishTopic(`MASTERLAZER/${deviceId}/led/ctrl`, "OFF");
    publishTopic(`MASTERLAZER/${deviceId}/led/ctrl`, "DESL");
    publishTopic(`MASTERLAZER/${deviceId}/led/ctrl`, "0");
    publishTopic(`MASTERLAZER/${deviceId}/led/pg`, "0");
    publishTopic(`MASTERLAZER/${deviceId}/led/cmd`, "OFF");
  };

  const handleProgramSave = () => {
    publishTopic(`MASTERLAZER/${deviceId}/led/ctrl`, "SAVE");
    publishTopic(`MASTERLAZER/${deviceId}/led/ctrl`, "SALVAR");
    publishTopic(`MASTERLAZER/${deviceId}/led/cmd`, "SAVE");
    alert('Configuração de LED persistida em memória interna!');
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

    const isModelMM12TW = activeModel === 'MM12TW';
    const targetMotor = isModelMM12TW ? 'mt2' : 'mt4';
    const activeMotorName = isModelMM12TW ? motor2Name : motor4Name;

    // Build core JSON with Timer 1 & Timer 2 parameters
    const coreJson = {
      t1_start: filterInit1,
      t1_hours: filterInit1 === 'D' ? 0 : parseInt(filterHours1) || 4,
      t2_start: filterInit2,
      t2_hours: filterInit2 === 'D' ? 0 : parseInt(filterHours2) || 4,
      start: filterInit1 === 'D' ? 'D' : `${filterInit1.padStart(2, '0')}:00`,
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
      inicio: filterInit1 === 'D' ? 'D' : `${filterInit1.padStart(2, '0')}:00`,
      horas: filterInit1 === 'D' ? 0 : parseInt(filterHours1) || 4,
      duration: filterInit1 === 'D' ? 0 : parseInt(filterHours1) || 4,
      days: filterDays,
      days_binary: daysBinary,
      active_days_str: selectedDaysList
    };

    // 1. General FT (Filtration Timer) topics
    publishTopic(`MASTERLAZER/${deviceId}/ft/cfg`, JSON.stringify(coreJson));
    publishTopic(`${deviceId}/ft/cfg`, JSON.stringify(extendedData));

    // Individual standard topics for T1 and T2
    publishTopic(`MASTERLAZER/${deviceId}/ft/t1/start`, filterInit1);
    publishTopic(`MASTERLAZER/${deviceId}/ft/t1/hours`, filterHours1);
    publishTopic(`MASTERLAZER/${deviceId}/ft/t2/start`, filterInit2);
    publishTopic(`MASTERLAZER/${deviceId}/ft/t2/hours`, filterHours2);
    publishTopic(`MASTERLAZER/${deviceId}/ft/days/binary`, daysBinary);
    publishTopic(`MASTERLAZER/${deviceId}/ft/days/str`, selectedDaysList);
    publishTopic(`MASTERLAZER/${deviceId}/ft/days`, daysBinary);

    publishTopic(`${deviceId}/ft/t1/start`, filterInit1);
    publishTopic(`${deviceId}/ft/t1/hours`, filterHours1);
    publishTopic(`${deviceId}/ft/t2/start`, filterInit2);
    publishTopic(`${deviceId}/ft/t2/hours`, filterHours2);
    publishTopic(`${deviceId}/ft/days/binary`, daysBinary);
    publishTopic(`${deviceId}/ft/days/str`, selectedDaysList);
    publishTopic(`${deviceId}/ft/days`, daysBinary);

    // Keep legacy single-timer topics for backward-compatible devices
    const legacyStart = filterInit1 === 'D' ? 'D' : `${filterInit1.padStart(2, '0')}:00`;
    publishTopic(`MASTERLAZER/${deviceId}/ft/start`, legacyStart);
    publishTopic(`MASTERLAZER/${deviceId}/ft/hours`, filterHours1);
    publishTopic(`${deviceId}/ft/start`, legacyStart);
    publishTopic(`${deviceId}/ft/hours`, filterHours1);

    // 2. Motor-specific direct timer topics
    publishTopic(`MASTERLAZER/${deviceId}/${targetMotor}/timer/cfg`, JSON.stringify(coreJson));
    publishTopic(`${deviceId}/${targetMotor}/timer/cfg`, JSON.stringify(extendedData));

    publishTopic(`MASTERLAZER/${deviceId}/${targetMotor}/timer/t1/start`, filterInit1);
    publishTopic(`MASTERLAZER/${deviceId}/${targetMotor}/timer/t1/hours`, filterHours1);
    publishTopic(`MASTERLAZER/${deviceId}/${targetMotor}/timer/t2/start`, filterInit2);
    publishTopic(`MASTERLAZER/${deviceId}/${targetMotor}/timer/t2/hours`, filterHours2);
    publishTopic(`MASTERLAZER/${deviceId}/${targetMotor}/timer/days/binary`, daysBinary);
    publishTopic(`MASTERLAZER/${deviceId}/${targetMotor}/timer/days/str`, selectedDaysList);
    publishTopic(`MASTERLAZER/${deviceId}/${targetMotor}/timer/days`, daysBinary);

    publishTopic(`${deviceId}/${targetMotor}/timer/t1/start`, filterInit1);
    publishTopic(`${deviceId}/${targetMotor}/timer/t1/hours`, filterHours1);
    publishTopic(`${deviceId}/${targetMotor}/timer/t2/start`, filterInit2);
    publishTopic(`${deviceId}/${targetMotor}/timer/t2/hours`, filterHours2);
    publishTopic(`${deviceId}/${targetMotor}/timer/days/binary`, daysBinary);
    publishTopic(`${deviceId}/${targetMotor}/timer/days/str`, selectedDaysList);
    publishTopic(`${deviceId}/${targetMotor}/timer/days`, daysBinary);

    // Also update current legacy state for reactivity in other components
    setFilterInit(legacyStart);
    setFilterHours(filterHours1);

    const activeText = selectedDaysList ? `\nDias: [ ${selectedDaysList} ]` : `\nDias: Nenhum selecionado`;
    const t1Text = filterInit1 === 'D' ? 'Timer 1: Desligado' : `Timer 1: ${filterInit1}h (Ativo por ${filterHours1}h)`;
    const t2Text = filterInit2 === 'D' ? 'Timer 2: Desligado' : `Timer 2: ${filterInit2}h (Ativo por ${filterHours2}h)`;
    
    logUserAction(`Configurou Filtração: T1: ${filterInit1}h(${filterHours1}h), T2: ${filterInit2}h(${filterHours2}h), Dias: ${selectedDaysList || 'Nenhum'}`);
    alert(`Programação de filtragem enviada para ${activeMotorName} (${targetMotor.toUpperCase()})!\n\n${t1Text}\n${t2Text}${activeText}`);
  };

  const handleSaveLedTimer = () => {
    localStorage.setItem('led_start_hour', ledStartHour);
    localStorage.setItem('led_start_minute', ledStartMinute);
    localStorage.setItem('led_duration', ledDuration);
    localStorage.setItem('led_program', ledProgram);

    const formattedHour = ledStartHour.padStart(2, '0');
    const formattedMinute = ledStartMinute.padStart(2, '0');
    const startingTime = `${formattedHour}:${formattedMinute}`;

    // Detailed JSON options supporting multi-language keys
    const data = {
      start: startingTime,
      hours: parseInt(ledDuration) || 4,
      program: parseInt(ledProgram) || 0
    };

    // 1. Publish precise requested topic style
    publishTopic(`MASTERLAZER/${deviceId}/led/tmr/cfg`, JSON.stringify(data));

    // 2. Publish compatibility formats
    publishTopic(`${deviceId}/led/tmr/cfg`, JSON.stringify(data));

    // Publish individual parameters to simplify Arduino / ESP logic
    
    // Hour/Start Topics
    publishTopic(`MASTERLAZER/${deviceId}/led/tmr/start`, startingTime);
    publishTopic(`MASTERLAZER/${deviceId}/led/tmr/start_hour`, ledStartHour);
    publishTopic(`${deviceId}/led/tmr/start`, startingTime);
    publishTopic(`${deviceId}/led/tmr/start_hour`, ledStartHour);

    // Duration/Hours Topics
    publishTopic(`MASTERLAZER/${deviceId}/led/tmr/hours`, String(ledDuration));
    publishTopic(`MASTERLAZER/${deviceId}/led/tmr/duration`, String(ledDuration));
    publishTopic(`${deviceId}/led/tmr/hours`, String(ledDuration));
    publishTopic(`${deviceId}/led/tmr/duration`, String(ledDuration));

    // Program Topics
    publishTopic(`MASTERLAZER/${deviceId}/led/tmr/program`, String(ledProgram));
    publishTopic(`MASTERLAZER/${deviceId}/led/tmr/prog`, String(ledProgram));
    publishTopic(`${deviceId}/led/tmr/program`, String(ledProgram));
    publishTopic(`${deviceId}/led/tmr/prog`, String(ledProgram));



    logUserAction(`Configurou Timer LED: Início ${startingTime}, Duração: ${ledDuration}h, Programa: ${ledProgram}`);
    alert(`Programação do Timer LED enviada!\nInício: ${startingTime}\nDuração: ${ledDuration} horas\nPrograma: ${ledProgram}.`);
  };

  const handleSaveHidroTimer = () => {
    const isEnabled = hidroTimerHours !== 'D' && hidroTimerHours !== 'off';
    const hoursVal = isEnabled ? hidroTimerHours : 'D';

    setHidroTimerEnabled(isEnabled);

    localStorage.setItem('hidro_timer_enabled', String(isEnabled));
    localStorage.setItem('hidro_timer_hours', hoursVal);

    const data = {
      enabled: isEnabled,
      hours: isEnabled ? parseInt(hoursVal, 10) || 1 : 0,
      bomba: 'mt1'
    };

    // 1. Publish core brand style config
    publishTopic(`MASTERLAZER/${deviceId}/hidro/tmr/cfg`, JSON.stringify(data));
    publishTopic(`${deviceId}/hidro/tmr/cfg`, JSON.stringify(data));

    // mt1 direct timer config
    publishTopic(`MASTERLAZER/${deviceId}/mt1/timer/cfg`, JSON.stringify(data));
    publishTopic(`${deviceId}/mt1/timer/cfg`, JSON.stringify(data));

    // 2. Publish individual parameter topics (active/status and hours/duration)
    const activePayload = isEnabled ? '1' : '0';
    
    // hidro tmr paths
    publishTopic(`MASTERLAZER/${deviceId}/hidro/tmr/active`, activePayload);
    publishTopic(`${deviceId}/hidro/tmr/active`, activePayload);
    publishTopic(`MASTERLAZER/${deviceId}/hidro/tmr/hours`, String(hoursVal));
    publishTopic(`${deviceId}/hidro/tmr/hours`, String(hoursVal));
    publishTopic(`MASTERLAZER/${deviceId}/hidro/tmr/duration`, String(hoursVal));
    publishTopic(`${deviceId}/hidro/tmr/duration`, String(hoursVal));

    // mt1 direct paths
    publishTopic(`MASTERLAZER/${deviceId}/mt1/timer/active`, activePayload);
    publishTopic(`${deviceId}/mt1/timer/active`, activePayload);
    publishTopic(`MASTERLAZER/${deviceId}/mt1/timer/hours`, String(hoursVal));
    publishTopic(`${deviceId}/mt1/timer/hours`, String(hoursVal));
    publishTopic(`MASTERLAZER/${deviceId}/mt1/timer/duration`, String(hoursVal));
    publishTopic(`${deviceId}/mt1/timer/duration`, String(hoursVal));

    logUserAction(`Configurou Timer Hidro (${motor1Name}): ${isEnabled ? `Ativo (${hoursVal}h)` : 'Desligado'}`);
    alert(`Programação do Timer ${motor1Name} enviada!\nStatus: ${isEnabled ? `Ativo (${hoursVal}h)` : 'Desligado (D)'}`);
  };

  // Start the QR Code Scanner camera
  const startQrScanner = async () => {
    setQrScannerError(null);
    setScannedData(null);
    setIsScanningQr(true);

    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      
      setTimeout(() => {
        const scannerElement = document.getElementById('qr-reader');
        if (!scannerElement) {
          setQrScannerError('Elemento de visualização da câmera não encontrado.');
          return;
        }

        const html5QrCode = new Html5Qrcode('qr-reader');
        qrScannerRef.current = html5QrCode;

        html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: (width, height) => {
              const size = Math.min(width, height) * 0.7;
              return { width: size, height: size };
            },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            handleQrCodeScanned(decodedText);
          },
          () => {
            // ignore verbose log
          }
        ).catch((err) => {
          console.error('Erro ao iniciar a câmera:', err);
          let userFriendlyMsg = 'Erro ao acessar a câmera. Verifique as permissões.';
          if (String(err).includes('NotAllowedError')) {
            userFriendlyMsg = 'Permissão de câmera negada. Ative as permissões nas configurações do seu navegador.';
          } else if (String(err).includes('NotFoundError')) {
            userFriendlyMsg = 'Nenhuma câmera traseira compatível encontrada no seu dispositivo.';
          }
          setQrScannerError(userFriendlyMsg);
        });
      }, 300);
    } catch (e) {
      console.error('Falha ao importar o scanner:', e);
      setQrScannerError('Falha ao carregar a biblioteca do scanner.');
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

  // Handle scanned text
  const handleQrCodeScanned = (text: string) => {
    try {
      const cleanJsonStr = text.trim();
      const parsed = JSON.parse(cleanJsonStr);
      
      // Dynamically build deviceId if not explicitly provided but model and serial are present
      if (!parsed.deviceId && parsed.model && parsed.serial) {
        parsed.deviceId = `${parsed.model}-${parsed.serial}`;
      }
      
      if (!parsed.deviceId) {
        throw new Error('JSON lido não possui a chave "deviceId" nem campos suficientes para montá-lo.');
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
        const matchedModel = parsed.deviceId.match(/^(MM\d+T?S?W?)/i);
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
      handleSaveEquipment(parsed.deviceId, finalModel, parsed.serial || '', parsed.manufacturer || 'MASTERLAZER');

      stopQrScanner();
    } catch (err) {
      console.warn('O QR Code escaneado não é um JSON válido. Tentando texto puro...', err);
      
      const matchedModel = text.match(/^(MM\d+T?S?W?)/i);
      if (matchedModel && text.length >= 5) {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(100);
        }
        let finalModel = 'MM12TW';
        const matched = text.match(/^(MM\d+T?S?W?)/i);
        if (matched) {
          finalModel = matched[1].toUpperCase();
        }

        const simulatedJson = {
          deviceId: text.trim(),
          model: finalModel,
          serial: text.split('-')[1] || '',
          manufacturer: 'MASTERLAZER'
        };
        setScannedData(simulatedJson);
        setBleDeviceId(simulatedJson.deviceId);
        setSelectedEquipmentModel(simulatedJson.model);
        setEquipmentSerial(simulatedJson.serial);
        setEquipmentManufacturer(simulatedJson.manufacturer);

        // Automatically save and activate the device immediately
        handleSaveEquipment(simulatedJson.deviceId, simulatedJson.model, simulatedJson.serial, simulatedJson.manufacturer);

        stopQrScanner();
      } else {
        setQrScannerError('Formato inválido. O QR Code deve conter o JSON de cadastro do equipamento.');
      }
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (qrScannerRef.current) {
        qrScannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // Save specific equipment
  function handleSaveEquipment(idOverride?: string, modelOverride?: string, serialOverride?: string, manufacturerOverride?: string) {
    const finalId = idOverride || bleDeviceId;
    const finalModel = modelOverride || selectedEquipmentModel;
    const finalSerial = serialOverride !== undefined ? serialOverride : equipmentSerial;
    const finalManufacturer = manufacturerOverride !== undefined ? manufacturerOverride : equipmentManufacturer;
    
    const trimmedId = finalId.trim();
    if (!trimmedId) {
      alert("Por favor, digite um ID de equipamento válido.");
      return;
    }
    
    // Retrieve currently logged-in user's email and password
    const userEmail = currentUser?.email || '';
    const userPassword = currentUser?.password || '';
    
    // Check if equipment is already in registered list
    const exists = registeredEquipments.some(eq => eq.id.toLowerCase() === trimmedId.toLowerCase());
    let updated = [...registeredEquipments];
    
    const newItem = {
      id: trimmedId,
      model: finalModel,
      serial: finalSerial,
      manufacturer: finalManufacturer,
      userEmail,
      userPassword
    };
    
    if (!exists) {
      updated.push(newItem);
    } else {
      // Update existing entry for this ID
      updated = updated.map(eq => eq.id.toLowerCase() === trimmedId.toLowerCase() ? { ...eq, ...newItem } : eq);
    }
    
    setRegisteredEquipments(updated);
    localStorage.setItem('registered_equipments', JSON.stringify(updated));
    
    // Also make this the active device under control!
    setDeviceId(trimmedId);
    localStorage.setItem('mqtt_device', trimmedId);
    
    // Log registration info in the Equipment terminal console
    setBleLog(prev => [
      ...prev,
      `[REGISTRO] Equipamento salvo: ${finalModel}`,
      `[REGISTRO] ID único: ${trimmedId}`,
      `[REGISTRO] Número de Série: ${finalSerial || 'N/A'}`,
      `[REGISTRO] Fabricante: ${finalManufacturer || 'N/A'}`,
      `[REGISTRO] Associado ao Usuário: ${userEmail || 'Nenhum'}`,
      `[REGISTRO] Equipamento configurado como ATIVO no broker MQTT.`
    ]);
    
    alert(`Equipamento ${finalModel} com ID "${trimmedId}" salvo com sucesso e associado ao usuário "${userEmail}"!`);
  };

  // Save Advanced Developer Config
  const handleSaveDevConfig = () => {
    localStorage.setItem('mqtt_broker', mqttBroker);
    localStorage.setItem('mqtt_port', mqttPort);
    localStorage.setItem('mqtt_device', deviceId);
    localStorage.setItem('mqtt_user', mqttUser);
    localStorage.setItem('mqtt_pass', mqttPassword);
    
    localStorage.setItem('fb_api_key', firebaseConfig.apiKey);
    localStorage.setItem('fb_auth_domain', firebaseConfig.authDomain);
    localStorage.setItem('fb_project_id', firebaseConfig.projectId);
    localStorage.setItem('fb_storage_bucket', firebaseConfig.storageBucket);
    localStorage.setItem('fb_messaging_sender_id', firebaseConfig.messagingSenderId);
    localStorage.setItem('fb_app_id', firebaseConfig.appId);

    alert('Configurações armazenadas com sucesso no navegador! Conecte novamente.');
    setActiveScreen('home');
  };

  const isCurrentlyAdmin = activeScreen === 'admin';

  return (
    <div className={`relative w-full ${isCurrentlyAdmin ? 'max-w-7xl px-4 md:px-8 py-6' : 'max-w-[440px] p-0 sm:p-4 h-[100dvh] sm:h-auto'} mx-auto select-none ${isCurrentlyAdmin ? 'overflow-visible' : 'overflow-hidden'}`} id="pool-controller-app">
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
      <Script 
        src="https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js"
        strategy="afterInteractive"
        onLoad={() => {
          console.log('Firebase App Compat loaded');
          setFirebaseAppLoaded(true);
        }}
      />
      {firebaseAppLoaded && (
        <Script 
          src="https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js"
          strategy="afterInteractive"
          onLoad={() => {
            console.log('Firebase Auth Compat loaded');
            if (typeof window !== 'undefined' && window.firebase && firebaseConfig.apiKey) {
              initRealFirebase();
            }
          }}
        />
      )}

      {/* iPhone Bezel Virtual Frame Mockup for Desktop, immersive fluid on Mobile */}
      <div className={`w-full bg-[#0d1117]/90 backdrop-blur-xl border-0 sm:border border-white/10 ${isCurrentlyAdmin ? 'rounded-2xl min-h-[85vh] h-auto p-4 md:p-6' : 'rounded-none sm:rounded-[32px] h-[100dvh] sm:h-[820px] max-h-[100dvh] sm:max-h-[92vh]'} shadow-2xl flex flex-col relative z-20 ${isCurrentlyAdmin ? 'overflow-visible' : 'overflow-hidden'}`}>
        
        {/* Notch & Status Indicators */}
        {!isCurrentlyAdmin && (
          <div className="flex h-7 w-full bg-black/25 justify-between items-center px-4 relative z-50 border-b border-white/5">
            <span className="text-[10px] sm:text-[11px] font-sans text-slate-300 font-bold tracking-tight">{currentTime}</span>
            {/* Virtual Notch - Hidden on mobile, shown on desktop */}
            <div className="hidden sm:block absolute top-0 left-1/2 transform -translate-x-1/2 w-28 h-4 bg-black/20 rounded-b-xl border-b border-l border-r border-white/5" />
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
        )}

        {/* Master App Screen Display Frame */}
        <div className={`flex-1 bg-transparent flex flex-col relative ${isCurrentlyAdmin ? 'overflow-visible' : 'overflow-hidden'}`}>
          
          {/* Header Bar (Hidden for Login / Register / Setup sheets) */}
          {activeScreen !== 'login' && activeScreen !== 'register' && activeScreen !== 'setup' && activeScreen !== 'admin' && (
            <header className="border-b border-white/10 bg-white/5 backdrop-blur-md sticky top-0 z-40">
              {/* Row 1: Brand & Settings */}
              <div className="px-5 pt-3.5 pb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Image 
                    src="https://www.masterlazer.com.br/images/icon.jpg" 
                    alt="Master Lazer Logo" 
                    width={28}
                    height={28}
                    className="object-contain rounded-md" 
                    referrerPolicy="no-referrer"
                    priority
                  />
                  <div>
                    <h1 className="text-xs font-bold tracking-tight text-[#4398fa] m-1 leading-none">MASTER LAZER</h1>
                    <p className="text-[8px] text-[#4398fa] font-mono tracking-widest uppercase mt-2 leading-none">
                      AUTO • {registeredEquipments.find(eq => eq.id.toLowerCase() === deviceId.toLowerCase())?.model || 'MM12TW'}
                    </p>
                  </div>
                </div>

                {/* Connection Status Indicator */}
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 shadow-sm">
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    mqttConnected 
                      ? 'bg-[#4398fa] animate-pulse' 
                      : mqttStatusMessage === 'Conectando...' 
                        ? 'bg-amber-400 animate-pulse' 
                        : 'bg-slate-400'
                  }`} />
                  <span className={`text-[9px] font-black tracking-wider uppercase ${
                    mqttConnected 
                      ? 'text-[#4398fa]' 
                      : mqttStatusMessage === 'Conectando...' 
                        ? 'text-amber-400' 
                        : 'text-slate-400'
                  }`}>
                    {mqttConnected 
                      ? 'CONECTADO' 
                      : mqttStatusMessage === 'Conectando...' 
                        ? 'CONECTANDO' 
                        : 'OFFLINE'
                    }
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {currentUser && (currentUser.email === 'admin@admin.com' || currentUser.email === 'edersonbatistabertirs@gmail.com' || currentUser.role === 'owner') && (
                    <button 
                      onClick={() => setActiveScreen('admin')} 
                      className="w-7 h-7 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 hover:text-amber-300 transition-all hover:bg-amber-500/20 active:scale-95"
                      title="Painel de Administração (Proprietário)"
                    >
                      <Shield className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button 
                    onClick={() => setActiveScreen('setup')} 
                    className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-all hover:bg-white/10"
                    title="Configurações Avançadas"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Row 2: Navigation Icons HOME, BOMBAS, LED, TIMERS */}
              <div className="px-3.5 pb-3 pt-1">
                <div className="grid grid-cols-4 gap-1.5 p-1 bg-black/20 rounded-xl border-2 border-white/10">
                  <button 
                    id="tab-home"
                    onClick={() => setActiveScreen('home')}
                    className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-2.5 sm:py-3.5 rounded-lg text-[11px] sm:text-[13.5px] font-extrabold tracking-wider transition-all ${
                      activeScreen === 'home' 
                        ? 'text-[#4398fa] bg-white/12 shadow-inner border border-white/10' 
                        : 'text-slate-400 hover:text-white border border-transparent'
                    }`}
                  >
                    <Tv className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                    <span>HOME</span>
                  </button>

                  <button 
                    id="tab-aux"
                    onClick={() => setActiveScreen('aux')}
                    className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-2.5 sm:py-3.5 rounded-lg text-[11px] sm:text-[13.5px] font-extrabold tracking-wider transition-all ${
                      activeScreen === 'aux' 
                        ? 'text-[#4398fa] bg-white/12 shadow-inner border border-white/10' 
                        : 'text-slate-400 hover:text-white border border-transparent'
                    }`}
                  >
                    <Sliders className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                    <span>BOMBAS</span>
                  </button>

                  <button 
                    id="tab-led"
                    onClick={() => setActiveScreen('led')}
                    className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-2.5 sm:py-3.5 rounded-lg text-[11px] sm:text-[13.5px] font-extrabold tracking-wider transition-all ${
                      activeScreen === 'led' 
                        ? 'text-[#4398fa] bg-white/12 shadow-inner border border-white/10' 
                        : 'text-slate-400 hover:text-white border border-transparent'
                    }`}
                  >
                    <Flame className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                    <span>LED</span>
                  </button>

                  <button 
                    id="tab-piscina"
                    onClick={() => setActiveScreen('timers')}
                    className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-2.5 sm:py-3.5 rounded-lg text-[11px] sm:text-[13.5px] font-extrabold tracking-wider transition-all ${
                      activeScreen === 'timers' 
                        ? 'text-[#4398fa] bg-white/12 shadow-inner border border-white/10' 
                        : 'text-slate-400 hover:text-white border border-transparent'
                    }`}
                  >
                    <Clock className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                    <span>TIMERS</span>
                  </button>
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
          <div className="flex-1 overflow-y-auto px-4 py-3 custom-scrollbar flex flex-col">
            
            <AnimatePresence mode="wait">
              
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
                      <MasterLazerLogo className="w-[168px] h-[168px] hover:scale-105 transition-all duration-300 drop-shadow-[0_8px_8px_rgba(0,0,0,0.5)]" />
                    </div>
                    <h2 className="text-xl font-bold tracking-tight text-white mb-1">Acesso Master</h2>
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
                      className="w-full text-center text-xs text-slate-400 hover:text-[#4398fa] transition-all py-1"
                    >
                      Esqueci minha senha
                    </button>

                    {/* FAST LOGIN SHORTCUTS FOR MOCK AUTH */}
                    {!firebaseInitialized && (
                      <div className="pt-3 border-t border-white/5 space-y-2 mt-4">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block text-center">
                          Acesso Rápido Simulado
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEmailInput('admin@admin.com');
                              setPasswordInput('12345678');
                              setAuthErrorMessage('');
                            }}
                            className="bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 rounded-xl p-2 text-left transition-all duration-200"
                          >
                            <span className="text-[10px] font-bold text-[#4398fa] block">Admin</span>
                            <span className="text-[8px] text-slate-400 font-mono truncate block">admin@admin.com</span>
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => {
                              setEmailInput('edersonbatistabertirs@gmail.com');
                              setPasswordInput('12345678');
                              setAuthErrorMessage('');
                            }}
                            className="bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 rounded-xl p-2 text-left transition-all duration-200"
                          >
                            <span className="text-[10px] font-bold text-emerald-400 block">Proprietário</span>
                            <span className="text-[8px] text-slate-400 font-mono truncate block">edersonbatistaber...</span>
                          </button>
                        </div>
                        <p className="text-[8px] text-slate-500 leading-normal text-center">
                          Toque em uma conta pré-salva acima para auto-preencher! Senha padrão: <span className="font-mono text-slate-400 font-bold">12345678</span>
                        </p>
                      </div>
                    )}
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
              {activeScreen === 'home' && (
                <motion.div
                  key="home-screen"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4 flex flex-col flex-1 justify-between"
                >
                  <div className="space-y-3">
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
                            <Flame className={`w-3.5 h-3.5 ${currentProgram !== '---' ? 'text-[#4398fa]' : 'text-slate-500'}`} />
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">LED</span>
                          </div>
                          <span className={`w-1.5 h-1.5 rounded-full ${currentProgram !== '---' ? 'bg-[#4398fa] animate-pulse' : 'bg-slate-500'}`} />
                        </div>
                        
                        <div className="mt-1">
                          <p className="text-[11px] text-white font-bold truncate">
                            {currentProgram !== '---' ? `Prog: ${currentProgram}` : 'Sem Programa'}
                          </p>
                          <p className="text-[9px] text-slate-400 font-medium">
                            Status: <span className={currentProgram !== '---' ? 'text-[#4398fa] font-bold' : 'text-slate-500 font-bold'}>
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
                          <span className={`w-1.5 h-1.5 rounded-full ${filterInit1 !== 'D' || filterInit2 !== 'D' || ledDuration !== '0' || (hidroTimerHours !== 'D' && hidroTimerHours !== 'off') ? 'bg-cyan-400 animate-pulse' : 'bg-slate-500'}`} />
                        </div>
                        
                        <div className="mt-1">
                          <p className="text-[11px] text-white font-bold truncate">
                            {filterInit1 !== 'D' || filterInit2 !== 'D' ? (
                              `${activeModel === 'MM12TW' ? motor2Name : motor4Name}: ${filterInit1 !== 'D' ? `T1 ${filterInit1}h(${filterHours1}h)` : ''}${filterInit1 !== 'D' && filterInit2 !== 'D' ? ' / ' : ''}${filterInit2 !== 'D' ? `T2 ${filterInit2}h(${filterHours2}h)` : ''}`
                            ) : (
                              `${activeModel === 'MM12TW' ? motor2Name : motor4Name}: Inativo`
                            )}
                          </p>
                          <p className="text-[9px] text-slate-400 font-medium truncate flex items-center gap-1.5">
                            <span>LED: <span className={ledDuration !== '0' ? 'text-cyan-400 font-bold' : 'text-slate-500 font-bold'}>{ledDuration !== '0' ? `${ledStartHour}h (${ledDuration}h)` : 'Inativo'}</span></span>
                            {hidroTimerHours !== 'D' && hidroTimerHours !== 'off' && (
                              <>
                                <span className="text-slate-600">|</span>
                                <span className="truncate">{motor1Name}: <span className="text-cyan-400 font-bold">{hidroTimerHours}h</span></span>
                              </>
                            )}
                          </p>
                        </div>
                      </button>
                    </div>

                    {/* Quick Status Block */}
                    <div className="grid grid-cols-2 gap-2 text-left">
                      <button
                        id="home-status-hidro"
                        onClick={() => setActiveScreen('aux')}
                        className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl backdrop-blur-sm cursor-pointer transition-all active:scale-[0.98] h-[72px] flex flex-col justify-between focus:outline-none focus:ring-1 focus:ring-[#4398fa]/50"
                        title={`Ver controle: ${motor1Name}`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate max-w-[80%]">{motor1Name}</span>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${motorHidro ? 'bg-[#4398fa] animate-pulse' : 'bg-slate-500'}`} />
                        </div>
                        <div className="mt-1">
                          <p className={`text-xs font-bold ${motorHidro ? 'text-[#4398fa]' : 'text-slate-500'}`}>
                            {motorHidro ? 'LIGADO' : 'DESLIGADO'}
                          </p>
                        </div>
                      </button>
                      <button
                        id="home-status-filtro"
                        onClick={() => setActiveScreen('aux')}
                        className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl backdrop-blur-sm cursor-pointer transition-all active:scale-[0.98] h-[72px] flex flex-col justify-between focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                        title={`Ver controle: ${motor2Name}`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate max-w-[80%]">{motor2Name}</span>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${motorFiltro ? 'bg-cyan-400 animate-pulse' : 'bg-slate-500'}`} />
                        </div>
                        <div className="mt-1">
                          <p className={`text-xs font-bold ${motorFiltro ? 'text-[#4398fa]' : 'text-slate-500'}`}>
                            {motorFiltro ? 'LIGADO' : 'DESLIGADO'}
                          </p>
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="pt-2">
                    <div className="grid grid-cols-2 gap-2 text-center">
                      {/* Connection Status Column */}
                      {mqttConnected ? (
                        <div className="p-3 bg-white/10 backdrop-blur-md border border-white/10 rounded-xl flex flex-col justify-center items-center shadow-md shadow-[#4398fa]/5">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">SISTEMA</p>
                          <p className="text-xs font-bold text-emerald-400 mt-1 flex items-center gap-1 justify-center">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            CONECTADO
                          </p>
                        </div>
                      ) : (
                        <div className="p-3 bg-white/5 border border-white/10 rounded-xl flex flex-col justify-center items-center">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">SISTEMA</p>
                          <p className="text-xs font-bold text-slate-500 mt-1 flex items-center gap-1 justify-center">
                            <span className="h-2 w-2 rounded-full bg-slate-500"></span>
                            OFFLINE
                          </p>
                        </div>
                      )}

                      {/* Logout Button Column */}
                      <button
                        onClick={handleLogout}
                        className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl flex flex-col justify-center items-center active:scale-95 transition-all text-center"
                      >
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">LOGOUT</p>
                        <p className="text-xs font-bold text-rose-400 mt-1 flex items-center gap-1 justify-center">
                          <LogOut className="w-3.5 h-3.5" />
                          SAIR
                        </p>
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Screen: AUX (Motor Control) */}
              {activeScreen === 'aux' && (
                <motion.div
                  key="aux-screen"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  <div className="p-4 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl shadow-lg">
                    <h3 className="text-xs font-bold text-[#4398fa] tracking-wider uppercase mb-3 pb-1.5 border-b border-white/10 flex items-center gap-1">
                      <Sliders className="w-3.5 h-3.5" /> CONTROLE DE MOTORES
                    </h3>

                    <div className="space-y-4 my-2">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all ${motorHidro ? 'bg-[#4398fa]/10 border-[#4398fa]/20 text-[#4398fa]' : 'bg-white/5 border-white/10 text-slate-400'}`}>
                            <Droplet className="w-4 h-4" />
                          </div>
                          <div className="flex flex-col">
                            {isEditingM1 ? (
                              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="text"
                                  value={motor1Name}
                                  onChange={(e) => {
                                    setMotor1Name(e.target.value);
                                    localStorage.setItem('motor1_name', e.target.value);
                                  }}
                                  onBlur={() => setIsEditingM1(false)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') setIsEditingM1(false);
                                  }}
                                  autoFocus
                                  maxLength={30}
                                  className="text-xs font-bold text-white bg-white/10 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-[#4398fa] w-32 border border-white/20"
                                />
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setIsEditingM1(false);
                                  }} 
                                  className="text-emerald-400 hover:text-emerald-300 p-0.5"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 group">
                                <p className="text-xs font-bold text-white">{motor1Name}</p>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setIsEditingM1(true);
                                  }}
                                  title="Editar nome"
                                  className="text-slate-400 hover:text-white transition-colors"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={motorHidro}
                            disabled={!mqttConnected}
                            onChange={(e) => handleMotorChange('hidro', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-10 h-6 bg-white/10 border border-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:height-4 after:h-4 after:w-4 after:transition-all peer-checked:bg-[#4398fa] peer-checked:border-[#4398fa] shadow-[0_0_10px_rgba(0,102,221,0)] peer-checked:shadow-[0_0_12px_rgba(0,102,221,0.4)]"></div>
                        </label>
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all ${motorFiltro ? 'bg-[#4398fa]/10 border-[#4398fa]/20 text-[#4398fa]' : 'bg-white/5 border-white/10 text-slate-400'}`}>
                            <FolderSync className="w-4 h-4" />
                          </div>
                          <div className="flex flex-col">
                            {isEditingM2 ? (
                              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="text"
                                  value={motor2Name}
                                  onChange={(e) => {
                                    setMotor2Name(e.target.value);
                                    localStorage.setItem('motor2_name', e.target.value);
                                  }}
                                  onBlur={() => setIsEditingM2(false)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') setIsEditingM2(false);
                                  }}
                                  autoFocus
                                  maxLength={30}
                                  className="text-xs font-bold text-white bg-white/10 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-[#4398fa] w-32 border border-white/20"
                                />
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setIsEditingM2(false);
                                  }} 
                                  className="text-emerald-400 hover:text-emerald-300 p-0.5"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 group">
                                <p className="text-xs font-bold text-white">{motor2Name}</p>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setIsEditingM2(true);
                                  }}
                                  title="Editar nome"
                                  className="text-slate-400 hover:text-white transition-colors"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={motorFiltro}
                            disabled={!mqttConnected}
                            onChange={(e) => handleMotorChange('filtro', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-10 h-6 bg-white/10 border border-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:height-4 after:h-4 after:w-4 after:transition-all peer-checked:bg-[#4398fa] peer-checked:border-[#4398fa] shadow-[0_0_10px_rgba(6,182,212,0)] peer-checked:shadow-[0_0_12px_rgba(6,182,212,0.4)]"></div>
                        </label>
                      </div>

                      {/* Motor 3 */}
                      <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all ${motor3 ? 'bg-[#4398fa]/10 border-[#4398fa]/20 text-[#4398fa]' : 'bg-white/5 border-white/10 text-slate-400'}`}>
                            <Power className="w-4 h-4" />
                          </div>
                          <div className="flex flex-col">
                            {isEditingM3 ? (
                              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="text"
                                  value={motor3Name}
                                  onChange={(e) => {
                                    setMotor3Name(e.target.value);
                                    localStorage.setItem('motor3_name', e.target.value);
                                  }}
                                  onBlur={() => setIsEditingM3(false)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') setIsEditingM3(false);
                                  }}
                                  autoFocus
                                  maxLength={30}
                                  className="text-xs font-bold text-white bg-white/10 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-[#4398fa] w-32 border border-white/20"
                                />
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setIsEditingM3(false);
                                  }} 
                                  className="text-emerald-400 hover:text-emerald-300 p-0.5"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 group">
                                <p className="text-xs font-bold text-white">{motor3Name}</p>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setIsEditingM3(true);
                                  }}
                                  title="Editar nome"
                                  className="text-slate-400 hover:text-white transition-colors"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={motor3}
                            disabled={!mqttConnected}
                            onChange={(e) => handleMotorChange('motor3', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-10 h-6 bg-white/10 border border-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:height-4 after:h-4 after:w-4 after:transition-all peer-checked:bg-[#4398fa] peer-checked:border-[#4398fa] shadow-[0_0_10px_rgba(0,102,221,0)] peer-checked:shadow-[0_0_12px_rgba(0,102,221,0.4)]"></div>
                        </label>
                      </div>

                      {/* Motor 4 */}
                      <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all ${motor4 ? 'bg-[#4398fa]/10 border-[#4398fa]/20 text-[#4398fa]' : 'bg-white/5 border-white/10 text-slate-400'}`}>
                            <Power className="w-4 h-4" />
                          </div>
                          <div className="flex flex-col">
                            {isEditingM4 ? (
                              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="text"
                                  value={motor4Name}
                                  onChange={(e) => {
                                    setMotor4Name(e.target.value);
                                    localStorage.setItem('motor4_name', e.target.value);
                                  }}
                                  onBlur={() => setIsEditingM4(false)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') setIsEditingM4(false);
                                  }}
                                  autoFocus
                                  maxLength={30}
                                  className="text-xs font-bold text-white bg-white/10 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-[#4398fa] w-32 border border-white/20"
                                />
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setIsEditingM4(false);
                                  }} 
                                  className="text-emerald-400 hover:text-emerald-300 p-0.5"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 group">
                                <p className="text-xs font-bold text-white">{motor4Name}</p>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setIsEditingM4(true);
                                  }}
                                  title="Editar nome"
                                  className="text-slate-400 hover:text-white transition-colors"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={motor4}
                            disabled={!mqttConnected}
                            onChange={(e) => handleMotorChange('motor4', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-10 h-6 bg-white/10 border border-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:height-4 after:h-4 after:w-4 after:transition-all peer-checked:bg-[#4398fa] peer-checked:border-[#4398fa] shadow-[0_0_10px_rgba(0,102,221,0)] peer-checked:shadow-[0_0_12px_rgba(0,102,221,0.4)]"></div>
                        </label>
                      </div>
                    </div>

                    {!mqttConnected && (
                      <p className="text-[10px] text-[#4398fa]/90 leading-snug mt-3 flex items-start gap-1 bg-[#4398fa]/10 p-2 rounded-xl border border-[#4398fa]/25">
                        <Info className="w-3.5 h-3.5 shrink-0" />
                        Aviso: Para acionar os motores, certifique-se de realizar a conexão com o sistema remoto IoT na aba HOME.
                      </p>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Screen: LED Controller */}
              {activeScreen === 'led' && (
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

                  {activeModel !== 'MM12TW' && (
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
                              publishTopic(`MASTERLAZER/${deviceId}/led/ctrl`, "ON");
                              publishTopic(`MASTERLAZER/${deviceId}/led/pg`, "1");
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
                              publishTopic(`MASTERLAZER/${deviceId}/led/ctrl`, "ON");
                              publishTopic(`MASTERLAZER/${deviceId}/led/pg`, "1");
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
                  )}

                  {/* Program selection block */}
                  <div className="p-2.5 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between px-1 py-0.5">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[11px] text-slate-300 font-bold uppercase tracking-wider">PROGRAMA ATUAL:</p>
                        <span className="text-[12px] font-black text-[#4398fa] font-mono">
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
                          <option key={p} value={p}>Prog {p}</option>
                        ))}
                      </select>
                    </div>

                    {/* Led Buttons control action rail - in a line (voltar, avançar, salvar, desligar) */}
                    <div className="grid grid-cols-4 gap-1.5">
                      <button
                        id="led-btn-voltar"
                        onClick={handleProgramDec}
                        className="py-2 bg-[#007AFF] hover:bg-[#4398fa] text-white rounded-xl text-xs font-bold transition-all active:scale-95 text-center px-1.5 w-full"
                      >
                        Voltar
                      </button>
                      <button
                        id="led-btn-avancar"
                        onClick={handleProgramInc}
                        className="py-2 bg-[#007AFF] hover:bg-[#4398fa] text-white rounded-xl text-xs font-bold transition-all active:scale-95 text-center px-1.5 w-full"
                      >
                        Avançar
                      </button>
                      <button
                        id="led-btn-salvar"
                        onClick={handleProgramSave}
                        className="py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all active:scale-95 text-center px-1.5 w-full"
                      >
                        Salvar
                      </button>
                      <button
                        id="led-btn-desligar"
                        onClick={handleProgramOff}
                        className="py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all active:scale-95 text-center px-1.5 w-full"
                      >
                        Desligar
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Screen: Timers / Automação (Filtro & LED) */}
              {activeScreen === 'timers' && (
                <motion.div
                  key="timers-screen"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  {/* FILTRAGEM Card */}
                  <div className="p-4 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl space-y-4">
                    <h3 className="text-xs font-bold text-[#4398fa] tracking-wider uppercase pb-1.5 border-b border-white/10 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {activeModel === 'MM12TW' ? motor2Name.toUpperCase() : motor4Name.toUpperCase()}
                    </h3>

                    <div className="space-y-4">
                      {/* TIMER 1 CONFIG */}
                      <div className="bg-white/5 p-3 rounded-xl border border-white/5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-extrabold text-[#4398fa] uppercase tracking-wider">Timer 1</span>
                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${filterInit1 !== 'D' ? 'bg-[#4398fa]/20 text-[#4398fa]' : 'bg-slate-500/20 text-slate-400'}`}>
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
                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${filterInit2 !== 'D' ? 'bg-[#4398fa]/20 text-[#4398fa]' : 'bg-slate-500/20 text-slate-400'}`}>
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
                      Salvar {activeModel === 'MM12TW' ? motor2Name : motor4Name}
                    </button>
                  </div>

                  {/* TIMER ILUMINAÇÃO Card */}
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

                  {/* TIMER HIDRO Card */}
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
                  <div className="p-5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 shadow-xl py-5 text-left">
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
                  <div id="equipment-registration-block" className="p-5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 shadow-xl text-left space-y-4">
                    <h3 className="text-sm font-bold text-white pb-1.5 border-b border-white/10 flex items-center justify-between">
                      <span>Equipamentos</span>
                    </h3>

                    <div className="space-y-3.5">
                      {/* QR Code Scan Controls */}
                      {!isScanningQr && (
                        <button
                          type="button"
                          onClick={startQrScanner}
                          className="w-full py-2.5 bg-gradient-to-r from-blue-600/20 to-cyan-600/20 hover:from-blue-600/35 hover:to-cyan-600/35 border border-cyan-500/20 hover:border-cyan-500/40 text-cyan-200 hover:text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <QrCode className="w-4 h-4 text-cyan-400 animate-pulse" />
                          <span>Escanear QR Code do Equipamento</span>
                        </button>
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
                              handleSaveEquipment(scannedData.deviceId, scannedData.model, scannedData.serial, scannedData.manufacturer);
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

                      {/* List of registered equipment if exists */}
                      {registeredEquipments.length > 0 && (
                        <div className="pt-2.5 border-t border-white/5 space-y-2">
                          <label className="text-[10px] text-slate-300 font-extrabold block uppercase tracking-wider">Meus Equipamentos Cadastrados</label>
                          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                            {registeredEquipments.map((eq) => {
                              const isActive = eq.id.toLowerCase() === deviceId.toLowerCase();
                              return (
                                <div 
                                  key={eq.id} 
                                  className={`flex items-center justify-between p-2 rounded-xl transition-all border ${
                                    isActive 
                                      ? 'bg-gradient-to-r from-[#007AFF]/10 to-[#4398fa]/10 border-[#007AFF]/30 shadow-sm' 
                                      : 'bg-white/5 border-transparent hover:bg-white/10'
                                  }`}
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-mono text-xs font-bold text-white truncate">{eq.id}</span>
                                      <span className="px-1.5 py-0.5 rounded bg-white/10 text-[8px] font-extrabold text-[#4398fa]">{eq.model}</span>
                                    </div>
                                    <div className="mt-1 flex flex-col gap-0.5 text-left">
                                      {(eq.serial || eq.manufacturer) && (
                                        <p className="text-[9px] text-slate-400 font-semibold">
                                          Série: <span className="font-mono text-slate-300">{eq.serial || 'N/A'}</span> • Fab: <span className="text-slate-300">{eq.manufacturer || 'N/A'}</span>
                                        </p>
                                      )}
                                      {eq.userEmail && (
                                        <p className="text-[8.5px] text-cyan-400/90 font-semibold flex items-center gap-1">
                                          <span className="inline-block w-1 h-1 rounded-full bg-emerald-400 animate-pulse"></span>
                                          Usuário: <span className="font-mono text-cyan-300">{eq.userEmail}</span> 
                                          {eq.userPassword ? ' (Credenciais OK)' : ''}
                                        </p>
                                      )}
                                      <p className="text-[9px] text-slate-500 font-semibold mt-0.5">
                                        {isActive ? 'Equipamento selecionado' : 'Conexão offline/disponível'}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {!isActive && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setDeviceId(eq.id);
                                          localStorage.setItem('mqtt_device', eq.id);
                                        }}
                                        className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[9px] font-bold transition-all cursor-pointer"
                                      >
                                        Ativar
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const filtered = registeredEquipments.filter(item => item.id !== eq.id);
                                        setRegisteredEquipments(filtered);
                                        localStorage.setItem('registered_equipments', JSON.stringify(filtered));
                                        if (isActive && filtered.length > 0) {
                                          setDeviceId(filtered[0].id);
                                          localStorage.setItem('mqtt_device', filtered[0].id);
                                        }
                                      }}
                                      className="p-1 px-2 text-slate-400 hover:text-rose-400 transition-colors font-bold text-xs cursor-pointer"
                                      title="Excluir equipamento"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

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
                      <span className="text-slate-300">Broker</span>
                      <span className="font-mono text-[10px] text-slate-400">{mqttBroker}</span>
                    </div>
                  </div>

                  <div className="p-4 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl space-y-3">
                    <h3 className="text-xs font-extrabold text-[#4398fa] tracking-wider uppercase pb-1 border-b border-white/10 flex items-center justify-between">
                      <span>SERVIÇOS DE REDE (MQTT)</span>
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                    </h3>

                    <div className="space-y-3">
                      {/* Presets Row */}
                                     <div className="space-y-1">
                        <label className="text-[10px] text-slate-300 font-bold block">Broker Host (Endereço)</label>
                        <input
                          type="text"
                          value={mqttBroker}
                          onChange={(e) => setMqttBroker(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-[#4398fa] focus:bg-white/10 transition-all"
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-300 font-bold block">Porta WebSocket</label>
                          <input
                            type="text"
                            value={mqttPort}
                            onChange={(e) => setMqttPort(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-[#4398fa] focus:bg-white/10 transition-all"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-300 font-bold block">ID Dispositivo (Prefixo)</label>
                          <input
                            type="text"
                            value={deviceId}
                            onChange={(e) => setDeviceId(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-[#4398fa] focus:bg-white/10 transition-all"
                          />
                        </div>
                      </div>

                      {/* Username / Password credentials row */}
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/5">
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-300 font-bold block">Usuário (Opcional)</label>
                          <input
                            type="text"
                            placeholder="sem usuário"
                            value={mqttUser}
                            onChange={(e) => setMqttUser(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-[#4398fa] focus:bg-white/10 transition-all"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-300 font-bold block">Senha (Opcional)</label>
                          <input
                            type="password"
                            placeholder="sem senha"
                            value={mqttPassword}
                            onChange={(e) => setMqttPassword(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-[#4398fa] focus:bg-white/10 transition-all"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleBackToHome}
                      className="flex-1 py-2.5 bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 text-xs font-semibold rounded-xl transition-all"
                    >
                      Voltar
                    </button>
                    <button
                      onClick={handleSaveDevConfig}
                      className="flex-1 py-2.5 bg-[#4398fa] text-white hover:bg-[#0055CC] text-xs font-bold rounded-xl shadow-lg shadow-[#4398fa]/20 active:scale-95 transition-all"
                    >
                      Salvar Tudo
                    </button>
                  </div>
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
                        <p className="text-xs text-slate-400">Acesso restrito para gerenciamento de usuários, equipamentos e telemetria.</p>
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
                        onClick={() => {
                          localStorage.removeItem('sim_user');
                          setCurrentUser(null);
                          setActiveScreen('login');
                        }}
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
                      onClick={() => setAdminTab('aba2')}
                      className={`px-5 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
                        adminTab === 'aba2'
                          ? 'border-amber-400 text-amber-400 bg-white/5'
                          : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/2'
                      }`}
                    >
                      <Terminal className="w-4 h-4" />
                      Simulador & Telemetria
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
                      Estatísticas de Uso
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
                            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Equipamentos Cadastrados</span>
                            <div className="flex items-baseline gap-2 mt-2">
                              <span className="text-3xl font-extrabold text-white">{registeredEquipments.length}</span>
                              <span className="text-xs text-[#4398fa] font-semibold">Dispositivos</span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2 font-medium">Equipamentos instalados nas residências.</p>
                          </div>

                          <div className="p-5 bg-gradient-to-br from-purple-500/10 to-pink-500/5 border border-purple-500/20 rounded-2xl flex flex-col justify-between">
                            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Histórico de Eventos</span>
                            <div className="flex items-baseline gap-2 mt-2">
                              <span className="text-3xl font-extrabold text-white">{userLogs.length}</span>
                              <span className="text-xs text-purple-400 font-semibold">Logs</span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2 font-medium">Ações de comando e auditoria registradas.</p>
                          </div>

                          <div className="p-5 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/20 rounded-2xl flex flex-col justify-between">
                            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Conexão MQTT Broker</span>
                            <div className="flex items-center gap-2 mt-2">
                              <span className={`inline-block w-2.5 h-2.5 rounded-full ${mqttConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
                              <span className="text-base font-bold text-white truncate max-w-full font-mono">{mqttBroker || 'broker.hivemq.com'}</span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2 font-medium">Porta de escuta configurada em {mqttPort || '8000'}.</p>
                          </div>
                        </div>

                        {/* Quick Access Grid */}
                        <div className="space-y-4">
                          <h3 className="text-xs font-bold text-amber-400 uppercase tracking-widest text-left">Navegação Administrativa</h3>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Card 1 */}
                            <button
                              onClick={() => setAdminTab('aba1')}
                              className="p-5 bg-white/5 border border-white/10 hover:border-amber-400/50 hover:bg-white/10 rounded-2xl text-left transition-all group flex gap-4 items-start active:scale-[0.99]"
                            >
                              <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl group-hover:scale-110 transition-transform">
                                <Users className="w-5 h-5" />
                              </div>
                              <div className="space-y-1">
                                <h4 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors font-sans">Controle de Usuários & Equipamentos</h4>
                                <p className="text-xs text-slate-400 leading-relaxed">Cadastre e edite operadores, vincule e gerencie equipamentos residenciais em tempo real.</p>
                              </div>
                            </button>

                            {/* Card 2 */}
                            <button
                              onClick={() => setAdminTab('aba2')}
                              className="p-5 bg-white/5 border border-white/10 hover:border-amber-400/50 hover:bg-white/10 rounded-2xl text-left transition-all group flex gap-4 items-start active:scale-[0.99]"
                            >
                              <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl group-hover:scale-110 transition-transform">
                                <Terminal className="w-5 h-5" />
                              </div>
                              <div className="space-y-1">
                                <h4 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors font-sans">Simulador de Telemetria</h4>
                                <p className="text-xs text-slate-400 leading-relaxed">Injete telemetrias de sensores e simule cenários de erro para testar a robustez do painel.</p>
                              </div>
                            </button>

                            {/* Card 3 */}
                            <button
                              onClick={() => setAdminTab('aba3')}
                              className="p-5 bg-white/5 border border-white/10 hover:border-amber-400/50 hover:bg-white/10 rounded-2xl text-left transition-all group flex gap-4 items-start active:scale-[0.99]"
                            >
                              <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl group-hover:scale-110 transition-transform">
                                <Activity className="w-5 h-5" />
                              </div>
                              <div className="space-y-1">
                                <h4 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors font-sans">Logs & Auditoria</h4>
                                <p className="text-xs text-slate-400 leading-relaxed">Monitore as ações dos operadores, com filtros de busca avançada e limpeza de histórico.</p>
                              </div>
                            </button>

                            {/* Card 4 */}
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
                          </div>
                        </div>

                        {/* Operator View CTA Section */}
                        <div className="p-6 bg-gradient-to-r from-amber-500/10 to-[#007AFF]/10 border border-white/10 rounded-2xl text-left flex flex-col md:flex-row justify-between items-center gap-4">
                          <div className="space-y-1.5 max-w-xl">
                            <h4 className="text-sm font-bold text-white font-sans">Interface de Operação de Piscinas</h4>
                            <p className="text-xs text-slate-400 leading-relaxed">Deseja simular ou testar a interface de uso final (controle de bombas, LED, temporizadores e aquecimento) que o operador vê no celular?</p>
                          </div>
                          <button
                            onClick={() => setActiveScreen('home')}
                            className="px-5 py-3 bg-amber-400 hover:bg-amber-500 text-black rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-amber-400/10 whitespace-nowrap font-sans"
                          >
                            <Sliders className="w-4 h-4" />
                            Acessar o App
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
                                
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-300">E-mail</label>
                                    <input
                                      type="email"
                                      required
                                      placeholder="usuario@email.com"
                                      value={userFormEmail}
                                      onChange={(e) => setUserFormEmail(e.target.value)}
                                      className="w-full px-2.5 py-1.5 bg-black/20 border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-300">Senha</label>
                                    <input
                                      type="text"
                                      required
                                      placeholder="min. 8 caracteres"
                                      value={userFormPassword}
                                      onChange={(e) => setUserFormPassword(e.target.value)}
                                      className="w-full px-2.5 py-1.5 bg-black/20 border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-300">Acesso</label>
                                    <select
                                      value={userFormRole}
                                      onChange={(e: any) => setUserFormRole(e.target.value)}
                                      className="w-full px-2.5 py-1.5 bg-black/20 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-amber-400 transition-colors"
                                    >
                                      <option value="operator" className="bg-[#121824]">Operador (Básico)</option>
                                      <option value="owner" className="bg-[#121824]">Proprietário (Admin)</option>
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
                                    <th className="p-3">Senha</th>
                                    <th className="p-3">Acesso</th>
                                    <th className="p-3 text-right">Ações</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {simUsers
                                    .filter(u => (u.email || '').toLowerCase().includes(adminSearchUser.toLowerCase()))
                                    .map((u) => {
                                      const isRoot = u.email === 'admin@admin.com' || u.email === 'edersonbatistabertirs@gmail.com';
                                      const isSelf = currentUser && currentUser.email === u.email;
                                      const isSelected = selectedUserForEquip === u.email;
                                      return (
                                        <tr 
                                          key={u.uid || u.email} 
                                          onClick={() => {
                                            if (u.role === 'operator') {
                                              const emailLower = (u.email || '').toLowerCase().trim();
                                              if (selectedUserForEquip === u.email) {
                                                setSelectedUserForEquip(null);
                                                setAdminSearchEquip('');
                                              } else {
                                                setSelectedUserForEquip(u.email);
                                                const associatedEquip = registeredEquipments.find(
                                                  eq => (eq.userEmail || '').toLowerCase().trim() === emailLower
                                                );
                                                if (associatedEquip) {
                                                  setAdminSearchEquip(associatedEquip.id);
                                                } else {
                                                  setAdminSearchEquip('');
                                                }
                                              }
                                            } else {
                                              setSelectedUserForEquip(null);
                                              setAdminSearchEquip('');
                                            }
                                          }}
                                          className={`border-b border-white/5 transition-colors cursor-pointer ${
                                            u.role === 'operator' ? 'hover:bg-amber-400/5' : 'hover:bg-white/2'
                                          } ${isSelected ? 'bg-amber-400/10 border-l-2 border-l-amber-400' : ''}`}
                                        >
                                          <td className="p-3 font-semibold text-white">
                                            <div className="flex items-center gap-1.5 font-sans">
                                              <span>{u.email}</span>
                                              {isSelf && (
                                                <span className="text-[8px] bg-sky-500/15 text-sky-400 px-1 py-0.2 rounded border border-sky-500/20 font-bold">VOCÊ</span>
                                              )}
                                            </div>
                                          </td>
                                          <td className="p-3 font-mono text-slate-400">{u.password}</td>
                                          <td className="p-3">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                              u.role === 'owner' 
                                                ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20' 
                                                : 'bg-slate-400/15 text-slate-300 border border-white/5'
                                            }`}>
                                              {u.role === 'owner' ? 'Proprietário' : 'Operador'}
                                            </span>
                                          </td>
                                          <td className="p-3 text-right">
                                            <div className="flex justify-end gap-1.5">
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setSelectedUserForEdit(u);
                                                  setUserFormEmail(u.email);
                                                  setUserFormPassword(u.password);
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
                                                title={isRoot ? 'Usuário padrão raiz não pode ser removido' : isSelf ? 'Você não pode se deletar' : 'Deletar Usuário'}
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
                              <h3 className="text-sm font-bold text-white">Equipamentos Disponíveis</h3>
                              <p className="text-[10px] text-slate-400">Total de {registeredEquipments.length} dispositivos cadastrados neste perfil</p>
                            </div>

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

                             <div className="space-y-2.5">
                              {registeredEquipments
                                .filter(eq => 
                                  eq.id.toLowerCase().includes(adminSearchEquip.toLowerCase()) || 
                                  eq.model.toLowerCase().includes(adminSearchEquip.toLowerCase()) ||
                                  (eq.userEmail || '').toLowerCase().includes(adminSearchEquip.toLowerCase())
                                )
                                .map((eq) => {
                                  const isActive = deviceId.toLowerCase() === eq.id.toLowerCase();
                                  const isUserEquip = selectedUserForEquip && (eq.userEmail || '').toLowerCase().trim() === selectedUserForEquip.toLowerCase().trim();
                                  return (
                                    <div
                                      key={eq.id}
                                      className={`p-4 rounded-xl border transition-all text-left flex justify-between items-center ${
                                        isUserEquip
                                          ? 'bg-amber-500/10 border-amber-400 shadow-lg shadow-amber-500/10'
                                          : isActive
                                          ? 'bg-[#4398fa]/10 border-[#4398fa] shadow-lg shadow-[#4398fa]/5'
                                          : 'bg-white/5 border-white/10 hover:bg-white/10'
                                      }`}
                                    >
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-1.5 font-sans">
                                          <span className="font-mono text-xs font-bold text-white">{eq.id}</span>
                                          {isUserEquip && (
                                            <span className="text-[8px] bg-amber-400 text-black px-1.5 py-0.2 rounded-full font-black uppercase tracking-wider">🏠 DO OPERADOR SELECIONADO</span>
                                          )}
                                          {isActive && !isUserEquip && (
                                            <span className="text-[8px] bg-[#4398fa]/20 text-[#4398fa] border border-[#4398fa]/30 px-1.5 py-0.2 rounded-full font-black uppercase tracking-wider">ATIVO</span>
                                          )}
                                        </div>
                                        <div className="text-[10px] text-slate-400">
                                          Modelo: <span className="text-slate-200 font-semibold">{eq.model}</span>
                                        </div>
                                        {eq.userEmail && (
                                          <div className="text-[9px] text-cyan-400 font-semibold">
                                            Vinculado: <span className="font-mono text-cyan-300">{eq.userEmail}</span>
                                          </div>
                                        )}
                                      </div>

                                      {!isActive && (
                                        <button
                                          onClick={() => {
                                            setDeviceId(eq.id);
                                            localStorage.setItem('mqtt_device', eq.id);
                                            logUserAction(`Ativou equipamento ID: ${eq.id}`);
                                            alert(`Dispositivo ${eq.id} ativado com sucesso!`);
                                          }}
                                          className="px-3 py-1.5 bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 hover:text-white rounded-lg text-[10px] font-bold text-slate-300 transition-all"
                                        >
                                          Ativar
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}

                              {selectedUserForEquip && !registeredEquipments.some(eq => (eq.userEmail || '').toLowerCase().trim() === selectedUserForEquip.toLowerCase().trim()) && (
                                <div className="p-4 bg-rose-500/10 border border-rose-500/25 rounded-xl text-left space-y-2 mt-2">
                                  <p className="text-xs font-semibold text-rose-300">Este operador ({selectedUserForEquip}) não tem nenhum equipamento instalado na residência.</p>
                                  <div className="flex flex-col gap-1.5 pt-1">
                                    <span className="text-[10px] text-slate-400 font-bold">Vincular equipamento disponível:</span>
                                    <select 
                                      onChange={(e) => {
                                        const eqId = e.target.value;
                                        if (!eqId) return;
                                        const updated = registeredEquipments.map(eq => 
                                          eq.id === eqId ? { ...eq, userEmail: selectedUserForEquip, userPassword: '12345678' } : eq
                                        );
                                        setRegisteredEquipments(updated);
                                        localStorage.setItem('registered_equipments', JSON.stringify(updated));
                                        setAdminSearchEquip(eqId);
                                        alert(`Equipamento ${eqId} vinculado ao operador ${selectedUserForEquip} com sucesso!`);
                                      }}
                                      className="w-full px-2 py-1.5 bg-black border border-white/10 rounded text-xs text-white focus:outline-none focus:border-amber-400"
                                    >
                                      <option value="">Selecione um equipamento...</option>
                                      {registeredEquipments.filter(eq => !eq.userEmail).map(eq => (
                                        <option key={eq.id} value={eq.id}>{eq.id} ({eq.model})</option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
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

                    {/* Tab 2: Sensors Simulator / Telemetry Search */}
                    {adminTab === 'aba2' && !searchedEquip && (
                      <div className="space-y-6 max-w-xl mx-auto py-8">
                        <div className="text-center space-y-2">
                          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/5">
                            <Compass className="w-8 h-8 text-amber-400" />
                          </div>
                          <h3 className="text-lg font-bold text-white mt-4">Consulta de Telemetria por Dispositivo</h3>
                          <p className="text-xs text-slate-400 max-w-sm mx-auto">
                            Insira um Device ID cadastrado para visualizar relatórios individuais de hardware, localização e tempos de uso.
                          </p>
                        </div>

                        {/* Search Input Box */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4 shadow-xl">
                          <div className="relative">
                            <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                            <input
                              type="text"
                              placeholder="Insira o ID do Equipamento (Ex: MM12TW-000123)"
                              value={telemetrySearchId}
                              onChange={(e) => setTelemetrySearchId(e.target.value)}
                              className="w-full pl-10 pr-4 py-3 bg-black/40 border border-white/10 focus:border-amber-400/50 rounded-xl text-xs font-mono text-white placeholder-slate-500 transition-colors focus:outline-none"
                            />
                            {telemetrySearchId && (
                              <button 
                                onClick={() => setTelemetrySearchId('')}
                                className="absolute right-3 top-3.5 text-slate-400 hover:text-white"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                const found = registeredEquipments.find(
                                  eq => eq.id.toLowerCase() === telemetrySearchId.trim().toLowerCase()
                                );
                                if (found) {
                                  setTelemetrySearchId(found.id);
                                } else {
                                  alert('Nenhum dispositivo cadastrado com este ID. Selecione um dos atalhos abaixo para carregar rapidamente.');
                                }
                              }}
                              className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold rounded-xl transition-colors active:scale-95 shadow-lg shadow-amber-500/20"
                            >
                              Consultar Telemetria
                            </button>
                          </div>
                        </div>

                        {/* Suggestions List */}
                        <div className="space-y-3">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block text-center">
                            Dispositivos Cadastrados (Clique para Consultar)
                          </span>
                          <div className="grid grid-cols-1 gap-2.5">
                            {registeredEquipments.map((eq) => {
                              const isSelected = telemetrySearchId.trim().toLowerCase() === eq.id.toLowerCase();
                              return (
                                <button
                                  key={eq.id}
                                  onClick={() => {
                                    setTelemetrySearchId(eq.id);
                                    setDeviceId(eq.id);
                                    localStorage.setItem('mqtt_device', eq.id);
                                  }}
                                  className={`p-3.5 rounded-xl border text-left flex justify-between items-center transition-all ${
                                    isSelected
                                      ? 'bg-amber-500/10 border-amber-500 text-amber-400 shadow-lg shadow-amber-500/5'
                                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                                  }`}
                                >
                                  <div className="space-y-0.5">
                                    <div className="text-xs font-bold font-mono">{eq.id}</div>
                                    <div className="text-[10px] opacity-70">Modelo: {eq.model} • Fabricante: MASTERLAZER</div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[8px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-bold uppercase">Online</span>
                                    <ChevronRight className="w-4 h-4 text-slate-500" />
                                  </div>
                                </button>
                              );
                            })}
                            {registeredEquipments.length === 0 && (
                              <div className="text-center py-4 text-xs text-slate-500 bg-white/5 border border-dashed border-white/10 rounded-xl">
                                Nenhum equipamento cadastrado. Adicione um na aba de Usuários e Equipamentos.
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Back to main screen button */}
                        <div className="flex justify-center pt-4">
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

                    {/* Validated Telemetry & Simulator View */}
                    {adminTab === 'aba2' && searchedEquip && telemetry && (
                      <div className="space-y-6">
                        {/* Header banner */}
                        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4">
                          <div className="flex items-center gap-3 text-left">
                            <div className="p-2 bg-amber-500/20 rounded-xl text-amber-400">
                              <Compass className="w-5 h-5 animate-spin" style={{ animationDuration: '6s' }} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-bold text-white font-mono">{searchedEquip.id}</h3>
                                <span className="text-[8px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded font-black tracking-wider uppercase">VALIDADO</span>
                              </div>
                              <p className="text-[10px] text-slate-400">
                                Modelo: <span className="text-slate-200 font-semibold">{searchedEquip.model}</span> • 
                                Fabricante: <span className="text-slate-200 font-semibold">MASTERLAZER</span> • 
                                Simulador de hardware sincronizado.
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => setTelemetrySearchId('')}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5"
                          >
                            <Search className="w-3.5 h-3.5" />
                            Consultar Outro ID
                          </button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                          
                          {/* LEFT COLUMN: INDIVIDUAL TELEMETRY DETAILS */}
                          <div className="lg:col-span-6 space-y-6">
                            
                            {/* Most Used LED Program */}
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4 text-left">
                              <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                  <h4 className="text-sm font-bold text-white">Programa de LED Mais Utilizado</h4>
                                  <p className="text-[10px] text-slate-400">Padrão de iluminação com maior tempo acumulado de ativação no dispositivo.</p>
                                </div>
                                <div className="p-2 bg-purple-500/10 rounded-xl text-purple-400">
                                  <Tv className="w-4 h-4" />
                                </div>
                              </div>

                              <div className="p-4 rounded-xl bg-black/30 border border-white/5 flex items-center justify-between">
                                <div className="space-y-1">
                                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Programa Atual de Pico</div>
                                  <div className="text-sm font-black text-amber-400 flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-rose-500 via-green-500 to-blue-500 animate-pulse"></span>
                                    {telemetry.mostUsedLedProgram}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="text-xs font-mono font-bold text-emerald-400">58% das ativações</span>
                                  <div className="text-[8px] text-slate-500">Total: 184 ativações</div>
                                </div>
                              </div>

                              {/* Selector to change simulated most used program */}
                              <div className="space-y-2">
                                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                                  Alterar Programa de Pico (Simulação)
                                </label>
                                <select
                                  value={telemetry.mostUsedLedProgram}
                                  onChange={(e) => updateDeviceTelemetry(searchedEquip.id, { mostUsedLedProgram: e.target.value })}
                                  className="w-full bg-black/40 border border-white/10 text-xs text-white rounded-xl p-2.5 focus:outline-none focus:border-amber-400"
                                >
                                  <option value="Arco-Íris Dinâmico">Arco-Íris Dinâmico</option>
                                  <option value="Azul Real Fixo">Azul Real Fixo</option>
                                  <option value="Verde Relax">Verde Relax</option>
                                  <option value="Cromoterapia Suave">Cromoterapia Suave</option>
                                  <option value="Festa Estroboscópica">Festa Estroboscópica</option>
                                  <option value="Lilás Zen">Lilás Zen</option>
                                </select>
                              </div>

                              {/* Simulated progress breakdown */}
                              <div className="space-y-2 pt-1">
                                <div className="flex justify-between text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                                  <span>Distribuição Histórica</span>
                                  <span>Tempo de Uso (%)</span>
                                </div>
                                <div className="space-y-1.5">
                                  <div>
                                    <div className="flex justify-between text-[10px] text-slate-300 font-mono">
                                      <span>{telemetry.mostUsedLedProgram}</span>
                                      <span>58%</span>
                                    </div>
                                    <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                                      <div className="bg-amber-400 h-full rounded-full" style={{ width: '58%' }}></div>
                                    </div>
                                  </div>
                                  <div>
                                    <div className="flex justify-between text-[10px] text-slate-300 font-mono">
                                      <span>Azul Clássico</span>
                                      <span>24%</span>
                                    </div>
                                    <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                                      <div className="bg-blue-400 h-full rounded-full" style={{ width: '24%' }}></div>
                                    </div>
                                  </div>
                                  <div>
                                    <div className="flex justify-between text-[10px] text-slate-300 font-mono">
                                      <span>Vermelho Festivo</span>
                                      <span>18%</span>
                                    </div>
                                    <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                                      <div className="bg-rose-400 h-full rounded-full" style={{ width: '18%' }}></div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Min and Max Filtration Times */}
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4 text-left">
                              <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                  <h4 className="text-sm font-bold text-white">Configuração de Filtragem Individual</h4>
                                  <p className="text-[10px] text-slate-400">Tempos limites de segurança e preservação ambiental para este equipamento.</p>
                                </div>
                                <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400">
                                  <Droplet className="w-4 h-4" />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                {/* Min filtration card */}
                                <div className="p-3.5 bg-black/30 border border-white/5 rounded-xl space-y-2">
                                  <span className="text-[9px] text-[#4398fa] font-bold uppercase tracking-wider block">Tempo Mínimo</span>
                                  <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-mono font-black text-white">{telemetry.minFilteringTime}</span>
                                    <span className="text-xs text-slate-400">horas/dia</span>
                                  </div>
                                  <p className="text-[8px] text-slate-400">Evita estagnação da água e acúmulo de microrganismos.</p>
                                  
                                  <div className="flex gap-1.5 pt-1">
                                    <button
                                      onClick={() => {
                                        const nextVal = Math.max(1, telemetry.minFilteringTime - 1);
                                        updateDeviceTelemetry(searchedEquip.id, { minFilteringTime: nextVal });
                                      }}
                                      className="flex-1 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-white font-mono font-bold"
                                    >
                                      -
                                    </button>
                                    <button
                                      onClick={() => {
                                        const nextVal = Math.min(telemetry.maxFilteringTime, telemetry.minFilteringTime + 1);
                                        updateDeviceTelemetry(searchedEquip.id, { minFilteringTime: nextVal });
                                      }}
                                      className="flex-1 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-white font-mono font-bold"
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>

                                {/* Max filtration card */}
                                <div className="p-3.5 bg-black/30 border border-white/5 rounded-xl space-y-2">
                                  <span className="text-[9px] text-rose-400 font-bold uppercase tracking-wider block">Tempo Máximo</span>
                                  <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-mono font-black text-white">{telemetry.maxFilteringTime}</span>
                                    <span className="text-xs text-slate-400">horas/dia</span>
                                  </div>
                                  <p className="text-[8px] text-slate-400">Previsão contra desgaste do motor da bomba por sobrecarga.</p>

                                  <div className="flex gap-1.5 pt-1">
                                    <button
                                      onClick={() => {
                                        const nextVal = Math.max(telemetry.minFilteringTime, telemetry.maxFilteringTime - 1);
                                        updateDeviceTelemetry(searchedEquip.id, { maxFilteringTime: nextVal });
                                      }}
                                      className="flex-1 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-white font-mono font-bold"
                                    >
                                      -
                                    </button>
                                    <button
                                      onClick={() => {
                                        const nextVal = Math.min(24, telemetry.maxFilteringTime + 1);
                                        updateDeviceTelemetry(searchedEquip.id, { maxFilteringTime: nextVal });
                                      }}
                                      className="flex-1 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-white font-mono font-bold"
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Hydro Massage Timer usage */}
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4 text-left">
                              <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                  <h4 className="text-sm font-bold text-white">Timer de Hidromassagem Recorrente</h4>
                                  <p className="text-[10px] text-slate-400">Histórico e configuração do temporizador de segurança da hidromassagem.</p>
                                </div>
                                <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
                                  <Clock className="w-4 h-4" />
                                </div>
                              </div>

                              <div className="p-4 rounded-xl bg-black/30 border border-white/5 flex items-center justify-between">
                                <div className="space-y-1">
                                  <span className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold block">Duração de Uso por Ciclo</span>
                                  <div className="text-lg font-black text-emerald-400 font-mono">
                                    {telemetry.hydroTimerUsageMinutes} minutos
                                  </div>
                                  <p className="text-[8px] text-slate-500">O motor desliga sozinho após este intervalo.</p>
                                </div>

                                <div className="flex flex-wrap gap-1 max-w-[150px]">
                                  {[15, 30, 45, 60].map((mins) => {
                                    const isActive = telemetry.hydroTimerUsageMinutes === mins;
                                    return (
                                      <button
                                        key={mins}
                                        onClick={() => updateDeviceTelemetry(searchedEquip.id, { hydroTimerUsageMinutes: mins })}
                                        className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-colors ${
                                          isActive
                                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                                            : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                                        }`}
                                      >
                                        {mins}m
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="flex justify-between items-center text-[10px] text-slate-400 px-1 pt-1">
                                <span>Uso Total Acumulado:</span>
                                <span className="text-slate-200 font-mono font-bold">128 ciclos (64 horas de funcionamento)</span>
                              </div>
                            </div>

                            {/* Device Location & Map Coordinates */}
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4 text-left">
                              <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                  <h4 className="text-sm font-bold text-white">Localização Geográfica do Equipamento</h4>
                                  <p className="text-[10px] text-slate-400">Visualização de coordenadas GPS e rastreamento de instalação ativa.</p>
                                </div>
                                <div className="p-2 bg-rose-500/10 rounded-xl text-rose-400">
                                  <MapPin className="w-4 h-4" />
                                </div>
                              </div>

                              {/* Coordinate Inputs */}
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-[9px] text-slate-400 font-bold uppercase block mb-1">Latitude</label>
                                  <input
                                    type="number"
                                    step="0.0001"
                                    value={telemetry.latitude}
                                    onChange={(e) => updateDeviceTelemetry(searchedEquip.id, { latitude: parseFloat(e.target.value) || -23.5505 })}
                                    className="w-full bg-black/40 border border-white/10 text-xs font-mono text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-rose-400"
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] text-slate-400 font-bold uppercase block mb-1">Longitude</label>
                                  <input
                                    type="number"
                                    step="0.0001"
                                    value={telemetry.longitude}
                                    onChange={(e) => updateDeviceTelemetry(searchedEquip.id, { longitude: parseFloat(e.target.value) || -46.6333 })}
                                    className="w-full bg-black/40 border border-white/10 text-xs font-mono text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-rose-400"
                                  />
                                </div>
                              </div>

                              {/* Quick Teleport buttons */}
                              <div className="space-y-1.5">
                                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Simular Locais de Instalação:</span>
                                <div className="flex flex-wrap gap-1.5">
                                  {[
                                    { name: 'São Paulo - SP', lat: -23.5505, lng: -46.6333 },
                                    { name: 'Rio de Janeiro - RJ', lat: -22.9068, lng: -43.1729 },
                                    { name: 'Porto Alegre - RS', lat: -30.0346, lng: -51.2177 },
                                    { name: 'Belo Horizonte - MG', lat: -19.9173, lng: -43.9345 },
                                  ].map((loc) => {
                                    const isActive = Math.abs(telemetry.latitude - loc.lat) < 0.01 && Math.abs(telemetry.longitude - loc.lng) < 0.01;
                                    return (
                                      <button
                                        key={loc.name}
                                        onClick={() => updateDeviceTelemetry(searchedEquip.id, { latitude: loc.lat, longitude: loc.lng })}
                                        className={`px-2.5 py-1 text-[9px] rounded-lg border transition-all ${
                                          isActive
                                            ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                                            : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                                        }`}
                                      >
                                        {loc.name}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Map Embed Frame */}
                              <div className="overflow-hidden rounded-xl border border-white/10 bg-black/40 h-[200px] relative">
                                <iframe
                                  title="Google Maps Coordinates"
                                  width="100%"
                                  height="200"
                                  style={{ border: 0, filter: 'grayscale(0.6) invert(0.9) contrast(1.2)' }}
                                  src={`https://maps.google.com/maps?q=${telemetry.latitude},${telemetry.longitude}&t=&z=13&ie=UTF8&iwloc=&output=embed`}
                                  allowFullScreen
                                  referrerPolicy="no-referrer"
                                />
                              </div>

                              <div className="flex justify-end pt-1">
                                <a
                                  href={`https://www.google.com/maps/search/?api=1&query=${telemetry.latitude},${telemetry.longitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 hover:text-rose-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95"
                                >
                                  <Compass className="w-3.5 h-3.5" />
                                  Ver no Google Maps Real
                                </a>
                              </div>
                            </div>

                          </div>

                          {/* RIGHT COLUMN: HARDWARE SIMULATOR & MQTT LOGS */}
                          <div className="lg:col-span-6 space-y-6">
                            
                            {/* Hardware Simulation Panel */}
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-6 text-left">
                              <div>
                                <h3 className="text-sm font-bold text-white">Central de Simulação de Hardware</h3>
                                <p className="text-[10px] text-slate-400">Altere os parâmetros abaixo para testar as reações do aplicativo e das proteções em tempo real para este dispositivo.</p>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                
                                {/* Temp Collector */}
                                <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-300">Sensor Coletor Solar</span>
                                    <span className="text-sm font-mono font-black text-rose-400">{sensorErrorActive ? '---' : `${sensorCollectorTemp}°C`}</span>
                                  </div>
                                  <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    disabled={sensorErrorActive}
                                    value={sensorCollectorTemp}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value);
                                      setSensorCollectorTemp(val);
                                      publishTopic(`MASTERLAZER/${searchedEquip.id}/telemetry/temp_collector`, String(val));
                                    }}
                                    className="w-full accent-rose-500 cursor-pointer disabled:opacity-30"
                                  />
                                  <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                                    <span>0°C</span>
                                    <span>50°C</span>
                                    <span>100°C</span>
                                  </div>
                                </div>

                                {/* Temp Pool */}
                                <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-300">Sensor Piscina</span>
                                    <span className="text-sm font-mono font-black text-[#4398fa]">{sensorPoolTemp}°C</span>
                                  </div>
                                  <input
                                    type="range"
                                    min="0"
                                    max="50"
                                    value={sensorPoolTemp}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value);
                                      setSensorPoolTemp(val);
                                      publishTopic(`MASTERLAZER/${searchedEquip.id}/telemetry/temp_pool`, String(val));
                                    }}
                                    className="w-full accent-[#4398fa] cursor-pointer"
                                  />
                                  <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                                    <span>0°C</span>
                                    <span>25°C</span>
                                    <span>50°C</span>
                                  </div>
                                </div>

                              </div>

                              {/* Simulated Delta calculation */}
                              <div className="p-4 rounded-xl bg-black/20 border border-white/10 flex items-center justify-between">
                                <div className="space-y-0.5">
                                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Delta Diferencial (T1 - T2)</span>
                                  <div className="text-xs text-slate-300">Diferença de temperatura para circulação solar</div>
                                </div>
                                <div className="text-right">
                                  <span className={`text-xl font-mono font-black ${sensorCollectorTemp - sensorPoolTemp >= 8 ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`}>
                                    {sensorErrorActive ? 'Erro Sensor' : `${(sensorCollectorTemp - sensorPoolTemp).toFixed(0)}°C`}
                                  </span>
                                  <div className="text-[8px] text-slate-400 uppercase tracking-widest mt-1">
                                    {sensorCollectorTemp - sensorPoolTemp >= 8 ? 'Circulação Ativa' : 'Aguardando Delta'}
                                  </div>
                                </div>
                              </div>

                              {/* Fault Injection */}
                              <div className="space-y-3">
                                <span className="text-xs font-bold text-slate-300 block">Simulação de Falhas & Diagnósticos</span>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <button
                                    onClick={() => {
                                      const newVal = !sensorErrorActive;
                                      setSensorErrorActive(newVal);
                                      publishTopic(`MASTERLAZER/${searchedEquip.id}/telemetry/sensor_error`, newVal ? '1' : '0');
                                      logUserAction(`Simulou Erro de Sensor Coletor Solar para ${searchedEquip.id}: ${newVal ? 'ATIVADO' : 'DESATIVADO'}`);
                                    }}
                                    className={`p-3.5 rounded-xl border text-left flex justify-between items-center transition-all ${
                                      sensorErrorActive
                                        ? 'bg-rose-500/10 border-rose-500 text-rose-400'
                                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                                    }`}
                                  >
                                    <div className="space-y-0.5">
                                      <div className="text-xs font-bold">Erro no Sensor Coletor</div>
                                      <div className="text-[9px] opacity-70">Sensor de temperatura aberto</div>
                                    </div>
                                    <AlertTriangle className="w-4 h-4" />
                                  </button>

                                  <button
                                    onClick={() => {
                                      const newVal = !flowErrorActive;
                                      setFlowErrorActive(newVal);
                                      publishTopic(`MASTERLAZER/${searchedEquip.id}/telemetry/flow_error`, newVal ? '1' : '0');
                                      logUserAction(`Simulou Erro de Fluxo de Água para ${searchedEquip.id}: ${newVal ? 'ATIVADO' : 'DESATIVADO'}`);
                                    }}
                                    className={`p-3.5 rounded-xl border text-left flex justify-between items-center transition-all ${
                                      flowErrorActive
                                        ? 'bg-rose-500/10 border-rose-500 text-rose-400'
                                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                                    }`}
                                  >
                                    <div className="space-y-0.5">
                                      <div className="text-xs font-bold">Sem Fluxo de Água</div>
                                      <div className="text-[9px] opacity-70">Bomba ligada sem vazão</div>
                                    </div>
                                    <AlertTriangle className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>

                            </div>

                            {/* Telemetry Log panel */}
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4 flex flex-col justify-between text-left">
                              <div className="space-y-4">
                                <div>
                                  <h3 className="text-sm font-bold text-white">Central de Logs Mqtt</h3>
                                  <p className="text-[10px] text-slate-400">Mensagens enviadas em formato bruto para depuração técnica do dispositivo selecionado.</p>
                                </div>

                                <div className="space-y-2.5 font-mono text-[10px]">
                                  <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1 text-slate-300">
                                    <div className="text-amber-400 font-bold">{"// Tópicos Publicados Recorrentes:"}</div>
                                    <div>Topic: <span className="text-[#4398fa]">MASTERLAZER/{searchedEquip.id}/temp_coll</span></div>
                                    <div>Payload: <span className="text-emerald-400">{sensorErrorActive ? 'ERR' : sensorCollectorTemp}</span></div>
                                  </div>

                                  <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1 text-slate-300">
                                    <div>Topic: <span className="text-[#4398fa]">MASTERLAZER/{searchedEquip.id}/temp_pool</span></div>
                                    <div>Payload: <span className="text-emerald-400">{sensorPoolTemp}</span></div>
                                  </div>

                                  <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1 text-slate-300">
                                    <div>Topic: <span className="text-[#4398fa]">MASTERLAZER/{searchedEquip.id}/flow_state</span></div>
                                    <div>Payload: <span className="text-emerald-400">{flowErrorActive ? 'FAIL' : 'OK'}</span></div>
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-2 pt-2">
                                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Seeding de Testes</span>
                                <button
                                  onClick={() => {
                                    try {
                                      const list = JSON.parse(localStorage.getItem('sim_user_logs') || '[]');
                                      const actions = [
                                        'Ligou Motor 3 (M3)', 'Desligou Motor 3 (M3)', 
                                        `Alterou LED para ${telemetry.mostUsedLedProgram}`, 
                                        'Desligou Motor de Filtro (M2)', 'Ligou Motor Hidro (M1)', 
                                        'Configurou Timer do LED'
                                      ];
                                      const emails = ['edersonbatistabertirs@gmail.com', 'admin@admin.com', 'operador.suporte@lazer.com', 'visitante.pool@lazer.com'];
                                      
                                      const generated: any[] = [];
                                      for (let i = 0; i < 5; i++) {
                                        generated.push({
                                          id: 'seeded-' + Math.random().toString(36).substr(2, 9),
                                          timestamp: new Date(Date.now() - (Math.random() * 24 * 60 * 60 * 1000)).toISOString(),
                                          email: emails[Math.floor(Math.random() * emails.length)],
                                          action: actions[Math.floor(Math.random() * actions.length)],
                                          deviceId: searchedEquip.id
                                        });
                                      }

                                      const combined = [...generated, ...list].slice(0, 200);
                                      localStorage.setItem('sim_user_logs', JSON.stringify(combined));
                                      setUserLogs(combined);
                                      alert(`5 Logs de teste inseridos para o dispositivo ${searchedEquip.id}!`);
                                    } catch (e) {}
                                  }}
                                  className="w-full py-2 bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-bold rounded-xl border border-white/10 transition-colors"
                                >
                                  Inserir Logs de Uso Fictícios para este Dispositivo
                                </button>
                              </div>

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

                    {/* Tab 3: Usage Statistics */}
                    {adminTab === 'aba3' && (
                      <div className="space-y-6">
                        
                        {/* KPI Block */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          
                          <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-left space-y-1">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ações Gravadas</span>
                            <div className="text-2xl font-black text-[#4398fa] font-mono">{userLogs.length}</div>
                            <span className="text-[9px] text-slate-500">Histórico de ações neste navegador</span>
                          </div>

                          <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-left space-y-1">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Usuário Mais Ativo</span>
                            <div className="text-sm font-bold text-emerald-400 truncate mt-1">
                              {(() => {
                                if (userLogs.length === 0) return 'Nenhum';
                                const counts: any = {};
                                userLogs.forEach(l => { counts[l.email] = (counts[l.email] || 0) + 1; });
                                let maxUser = 'Nenhum';
                                let maxVal = 0;
                                Object.keys(counts).forEach(k => {
                                  if (counts[k] > maxVal) { maxVal = counts[k]; maxUser = k; }
                                });
                                return `${maxUser} (${maxVal})`;
                              })()}
                            </div>
                            <span className="text-[9px] text-slate-500">Com maior número de disparos</span>
                          </div>

                          <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-left space-y-1">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Comando Predominante</span>
                            <div className="text-sm font-bold text-amber-400 mt-1">
                              {(() => {
                                if (userLogs.length === 0) return 'Nenhum';
                                let motors = 0, led = 0, timer = 0;
                                userLogs.forEach(l => {
                                  const act = l.action.toLowerCase();
                                  if (act.includes('motor') || act.includes('togglou')) motors++;
                                  else if (act.includes('led') || act.includes('cor')) led++;
                                  else if (act.includes('timer') || act.includes('configurou')) timer++;
                                });
                                const max = Math.max(motors, led, timer);
                                if (max === motors) return `Motores & Bombas (${motors})`;
                                if (max === led) return `LED Iluminação (${led})`;
                                return `Configuração de Timers (${timer})`;
                              })()}
                            </div>
                            <span className="text-[9px] text-slate-500">Grupo mais comandado</span>
                          </div>

                        </div>

                        {/* Interactive Responsive SVG Charts */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          
                          {/* Bar chart panel */}
                          <div className="p-5 bg-white/5 border border-white/10 rounded-2xl space-y-4 text-left">
                            <div>
                              <h4 className="text-xs font-black text-white uppercase tracking-wider">Ações por Usuário</h4>
                              <p className="text-[10px] text-slate-400">Total de disparos efetuados por e-mail de usuário</p>
                            </div>

                            <div className="h-44 flex items-end justify-between gap-2 border-b border-white/10 pb-2 relative z-10 pt-4">
                              {(() => {
                                const counts: any = {};
                                userLogs.forEach(l => { counts[l.email] = (counts[l.email] || 0) + 1; });
                                const users = Object.keys(counts).slice(0, 5);
                                if (users.length === 0) {
                                  return <div className="text-xs text-slate-500 m-auto">Sem dados de telemetria suficientes</div>;
                                }
                                const maxVal = Math.max(...users.map(u => counts[u]));
                                return users.map((u, i) => {
                                  const val = counts[u];
                                  const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
                                  const emailPrefix = u.split('@')[0];
                                  return (
                                    <div key={u} className="flex-1 flex flex-col items-center group relative cursor-pointer">
                                      {/* Bar trigger tooltip */}
                                      <div className="absolute -top-7 scale-0 group-hover:scale-100 bg-[#4398fa] text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded shadow-lg transition-transform pointer-events-none whitespace-nowrap z-30">
                                        {val} ações
                                      </div>
                                      <div
                                        style={{ height: `${Math.max(pct, 12)}%` }}
                                        className={`w-8 rounded-t-md transition-all duration-500 group-hover:brightness-125 ${
                                          i === 0 ? 'bg-gradient-to-t from-[#0055CC] to-[#4398fa]' :
                                          i === 1 ? 'bg-gradient-to-t from-amber-600 to-amber-400' :
                                          i === 2 ? 'bg-gradient-to-t from-emerald-600 to-emerald-400' :
                                          'bg-gradient-to-t from-slate-600 to-slate-400'
                                        }`}
                                      />
                                      <span className="text-[8px] font-mono font-medium text-slate-400 truncate w-full text-center mt-2" title={u}>
                                        {emailPrefix}
                                      </span>
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                          </div>

                          {/* Pie chart / Donut Breakdown */}
                          <div className="p-5 bg-white/5 border border-white/10 rounded-2xl space-y-4 text-left">
                            <div>
                              <h4 className="text-xs font-black text-white uppercase tracking-wider">Breakdown de Comandos</h4>
                              <p className="text-[10px] text-slate-400">Classificação percentual das interações registradas</p>
                            </div>

                            <div className="h-44 flex items-center justify-around gap-2">
                              {(() => {
                                let m = 0, l = 0, t = 0;
                                userLogs.forEach(log => {
                                  const act = log.action.toLowerCase();
                                  if (act.includes('motor') || act.includes('togglou')) m++;
                                  else if (act.includes('led') || act.includes('cor')) l++;
                                  else if (act.includes('timer') || act.includes('configurou')) t++;
                                });
                                const total = m + l + t;
                                if (total === 0) {
                                  return <div className="text-xs text-slate-500">Sem logs suficientes para cálculo</div>;
                                }
                                const mPct = ((m / total) * 100).toFixed(0);
                                const lPct = ((l / total) * 100).toFixed(0);
                                const tPct = ((t / total) * 100).toFixed(0);

                                return (
                                  <>
                                    {/* Simulated Circular Donut Layout using SVG */}
                                    <div className="w-24 h-24 relative flex items-center justify-center">
                                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                        <path
                                          className="text-white/5"
                                          strokeWidth="3.5"
                                          stroke="currentColor"
                                          fill="none"
                                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                        />
                                        <path
                                          className="text-[#4398fa]"
                                          strokeDasharray={`${mPct}, 100`}
                                          strokeWidth="3.8"
                                          strokeLinecap="round"
                                          stroke="currentColor"
                                          fill="none"
                                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                        />
                                        <path
                                          className="text-amber-400"
                                          strokeDasharray={`${lPct}, 100`}
                                          strokeDashoffset={`-${mPct}`}
                                          strokeWidth="3.8"
                                          strokeLinecap="round"
                                          stroke="currentColor"
                                          fill="none"
                                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                        />
                                        <path
                                          className="text-emerald-400"
                                          strokeDasharray={`${tPct}, 100`}
                                          strokeDashoffset={`-${parseInt(mPct) + parseInt(lPct)}`}
                                          strokeWidth="3.8"
                                          strokeLinecap="round"
                                          stroke="currentColor"
                                          fill="none"
                                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                        />
                                      </svg>
                                      <div className="absolute flex flex-col text-center">
                                        <span className="text-xs font-mono font-black text-white">{total}</span>
                                        <span className="text-[7px] text-slate-400 font-bold uppercase tracking-widest leading-none">AÇÕES</span>
                                      </div>
                                    </div>

                                    {/* Custom legend */}
                                    <div className="space-y-1.5 text-[10px] font-semibold text-slate-300">
                                      <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded bg-[#4398fa] inline-block"></span>
                                        <span>Motores: {mPct}%</span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded bg-amber-400 inline-block"></span>
                                        <span>Iluminação: {lPct}%</span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded bg-emerald-400 inline-block"></span>
                                        <span>Timers/Filtr.: {tPct}%</span>
                                      </div>
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </div>

                        </div>

                        {/* Search and logs history */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                            <div>
                              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Histórico Detalhado de Operações</h4>
                              <p className="text-[10px] text-slate-400">Relação completa de todos os gatilhos gerados</p>
                            </div>
                            {!showConfirmClearLogs ? (
                              <button
                                onClick={() => setShowConfirmClearLogs(true)}
                                className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 hover:text-rose-300 text-xs font-bold rounded-lg transition-colors text-center"
                              >
                                Limpar Todos os Logs
                              </button>
                            ) : (
                              <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 rounded-lg p-1.5 animate-fadeIn">
                                <span className="text-[10px] text-rose-300 font-medium px-1">Confirmar limpeza?</span>
                                <button
                                  onClick={() => {
                                    localStorage.setItem('sim_user_logs', '[]');
                                    setUserLogs([]);
                                    setShowConfirmClearLogs(false);
                                  }}
                                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold rounded transition-colors"
                                >
                                  Sim
                                </button>
                                <button
                                  onClick={() => setShowConfirmClearLogs(false)}
                                  className="px-2.5 py-1 bg-white/10 text-slate-300 hover:text-white text-[10px] font-bold rounded transition-colors"
                                >
                                  Não
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="overflow-x-auto rounded-xl border border-white/10">
                            <table className="w-full text-xs text-left">
                              <thead>
                                <tr className="bg-black/20 text-slate-400 border-b border-white/10">
                                  <th className="p-3">Data & Hora</th>
                                  <th className="p-3">Usuário</th>
                                  <th className="p-3">Equipamento</th>
                                  <th className="p-3">Comando Executado</th>
                                </tr>
                              </thead>
                              <tbody>
                                {userLogs.slice(0, 45).map((log) => (
                                  <tr key={log.id} className="border-b border-white/5 hover:bg-white/2 text-[11px]">
                                    <td className="p-3 font-mono text-slate-400">
                                      {new Date(log.timestamp).toLocaleString('pt-BR')}
                                    </td>
                                    <td className="p-3 font-semibold text-white">{log.email}</td>
                                    <td className="p-3 font-mono text-slate-400">{log.deviceId}</td>
                                    <td className="p-3">
                                      <span className="px-2 py-0.5 bg-white/5 border border-white/5 rounded text-slate-200">
                                        {log.action}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                                {userLogs.length === 0 && (
                                  <tr>
                                    <td colSpan={4} className="p-8 text-center text-slate-500">Nenhum comando disparado ainda. Use o app e alterne os motores para popular os registros!</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
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
                              <span className="text-slate-400 font-semibold">Conexão Firebase Real</span>
                              <span className={`font-black uppercase text-[9px] px-2 py-0.5 rounded ${
                                firebaseInitialized 
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              }`}>
                                {firebaseInitialized ? 'Ativo (Real)' : 'Simulado (Nativo)'}
                              </span>
                            </div>
                          </div>

                          <div className="p-3.5 bg-white/5 border border-white/10 rounded-xl text-[11px] text-slate-300 leading-relaxed font-sans">
                            <strong className="text-white block mb-1">Notas do Projeto:</strong>
                            Este painel simula totalmente a comunicação serial Modbus do hardware através de barramentos JSON estruturados via MQTT. 
                            Quando as credenciais Firebase são preenchidas nas Configurações Avançadas, as coleções de dados são sincronizadas de forma distribuída na nuvem.
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
          <div className="py-2.0 text-center bg-black/10 border-t border-white/2">
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
    </div>
  );
}
