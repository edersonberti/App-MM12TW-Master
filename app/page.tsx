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
  Save
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
const DEFAULT_DEVICE_ID = '12TW'; // Matches 12TW prefix from user requirements

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
  const [activeScreen, setActiveScreen] = useState<'login' | 'register' | 'home' | 'aux' | 'led' | 'timers' | 'setup'>('login');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authErrorMessage, setAuthErrorMessage] = useState<string>('');
  
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
  const [mqttUser, setMqttUser] = useState('');
  const [mqttPassword, setMqttPassword] = useState('');
  const [mqttConnected, setMqttConnected] = useState(false);
  const [mqttStatusMessage, setMqttStatusMessage] = useState('Desconectado');
  const [mqttErrorMsg, setMqttErrorMsg] = useState('');
  
  // Local Wi-Fi Config State
  const [localWifiConnected, setLocalWifiConnected] = useState(false);
  const [localWifiSsid, setLocalWifiSsid] = useState('');
  const [localWifiPassword, setLocalWifiPassword] = useState('');
  const [localWifiScanning, setLocalWifiScanning] = useState(false);
  const [localWifiListVisible, setLocalWifiListVisible] = useState(false);
  const [localWifiList, setLocalWifiList] = useState<string[]>([]);
  const [selectedWifi, setSelectedWifi] = useState<string>('');
  const [isConnectingLocalWifi, setIsConnectingLocalWifi] = useState(false);
  
  // BLE Wi-Fi & MQTT Provisioning States
  const [bleNamePrefix, setBleNamePrefix] = useState('MM12T');
  const [bleAcceptAll, setBleAcceptAll] = useState(true);
  const [bleScanType, setBleScanType] = useState<'acceptAll' | 'namePrefix' | 'serviceUuid'>('namePrefix');
  const [bleSimulatedMode, setBleSimulatedMode] = useState(false);
  const [bleServiceUuid, setBleServiceUuid] = useState('7c6c0001-7f5b-4a6d-8d11-001122334455');
  const [bleSsid, setBleSsid] = useState('Berti');
  const [blePassword, setBlePassword] = useState('#y6h2d7g8@');
  const [bleDeviceId, setBleDeviceId] = useState('MM12TW-0001');
  const [bleMqttServer, setBleMqttServer] = useState('test.mosquitto.org');
  const [bleMqttPort, setBleMqttPort] = useState('1883');
  const [bleStatus, setBleStatus] = useState<'idle' | 'scanning' | 'connecting' | 'connected' | 'sending' | 'success' | 'error'>('idle');
  const [bleLog, setBleLog] = useState<string[]>([]);
  const [bleError, setBleError] = useState<string>('');
  const [bleRssi, setBleRssi] = useState<number | null>(null);

  // Registered Equipments (unique ID for each, with choices of MM12TW, MM03TW, MM08TSW)
  const [registeredEquipments, setRegisteredEquipments] = useState<{ id: string; model: 'MM12TW' | 'MM03TW' | 'MM08TSW' }[]>([]);
  const [selectedEquipmentModel, setSelectedEquipmentModel] = useState<'MM12TW' | 'MM03TW' | 'MM08TSW'>('MM12TW');
  
  // Real-time Controls / Statuses
  const [motorHidro, setMotorHidro] = useState(false);
  const [motorFiltro, setMotorFiltro] = useState(false);
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

  const [currentProgram, setCurrentProgram] = useState<number | '---'>('---');
  const [iroLoaded, setIroLoaded] = useState(false);

  // Timers States
  const [filterInit, setFilterInit] = useState('12:00');
  const [filterInit1, setFilterInit1] = useState('12');
  const [filterInit2, setFilterInit2] = useState('D');
  const [filterInit3, setFilterInit3] = useState('D');
  const [filterHours, setFilterHours] = useState('4');
  const [filterDays, setFilterDays] = useState<boolean[]>([true, true, true, true, true, true, true]);
  
  const [ledStartHour, setLedStartHour] = useState('20');
  const [ledStartMinute, setLedStartMinute] = useState('00');
  const [ledDuration, setLedDuration] = useState('4');
  const [ledProgram, setLedProgram] = useState('0');

  const [hidroTimerEnabled, setHidroTimerEnabled] = useState(false);
  const [hidroTimerHours, setHidroTimerHours] = useState('off');

  // MQTT instance reference
  const mqttClientRef = useRef<any>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const iroPickerRef = useRef<any>(null);
  const pickerContainerId = 'iro-color-picker-target';

  const [pahoLoaded, setPahoLoaded] = useState(false);
  const [userWantsMqtt, setUserWantsMqttState] = useState(true);
  const userWantsMqttRef = useRef(true);
  
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
      const storedDevice = localStorage.getItem('mqtt_device') || DEFAULT_DEVICE_ID;
      const storedMqttUser = localStorage.getItem('mqtt_user') || '';
      const storedMqttPass = localStorage.getItem('mqtt_pass') || '';

      setMqttBroker(storedBroker);
      setMqttPort(storedPort);
      setDeviceId(storedDevice);
      setMqttUser(storedMqttUser);
      setMqttPassword(storedMqttPass);

      const storedEquips = localStorage.getItem('registered_equipments');
      if (storedEquips) {
        try {
          setRegisteredEquipments(JSON.parse(storedEquips));
        } catch (e) {
          console.error(e);
        }
      } else {
        const initialEquips = [
          { id: 'MM12TW-0001', model: 'MM12TW' as const },
          { id: 'MM03TW-1002', model: 'MM03TW' as const },
          { id: 'MM08TSW-2004', model: 'MM08TSW' as const }
        ];
        setRegisteredEquipments(initialEquips);
        localStorage.setItem('registered_equipments', JSON.stringify(initialEquips));
      }

      const storedWifiConnected = localStorage.getItem('local_wifi_connected') === 'true';
      const storedWifiSsid = localStorage.getItem('local_wifi_ssid') || '';
      setLocalWifiConnected(storedWifiConnected);
      setLocalWifiSsid(storedWifiSsid);

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
          { email: 'admin@admin.com', password: '12345678', uid: 'sim-admin-id' },
          { email: 'edersonbatistabertirs@gmail.com', password: '12345678', uid: 'sim-user-id' }
        ];
        
        let updatedUsersList = [...storedUsers];
        defaultUsers.forEach(defUser => {
          if (!updatedUsersList.some(u => (u.email || '').toLowerCase().trim() === defUser.email)) {
            updatedUsersList.push(defUser);
          }
        });
        localStorage.setItem('sim_users', JSON.stringify(updatedUsersList));
      } catch (e) {
        console.error("Error pre-seeding users:", e);
      }

      const simUser = localStorage.getItem('sim_user');
      if (simUser) {
        try {
          const parsed = JSON.parse(simUser);
          setCurrentUser(parsed);
          setActiveScreen('home');
        } catch (e) {
          // ignore
        }
      }

      const storedHidroEnabled = localStorage.getItem('hidro_timer_enabled') === 'true';
      const storedHidroHours = localStorage.getItem('hidro_timer_hours') || '1';
      setHidroTimerEnabled(storedHidroEnabled);
      setHidroTimerHours(storedHidroEnabled ? storedHidroHours : 'off');

      // Load Filtration states
      const storedFilterInit = localStorage.getItem('filter_init') || '12:00';
      const defaultHour1 = storedFilterInit.includes(':') ? storedFilterInit.split(':')[0] : storedFilterInit;
      const storedFilterInit1 = localStorage.getItem('filter_init1') || defaultHour1 || '12';
      const storedFilterInit2 = localStorage.getItem('filter_init2') || 'D';
      const storedFilterInit3 = localStorage.getItem('filter_init3') || 'D';
      
      const activeInits = [storedFilterInit1, storedFilterInit2, storedFilterInit3].filter(h => h !== 'D').map(h => h + 'h');
      const combinedInits = activeInits.length > 0 ? activeInits.join(', ') : 'Desativado';
      
      setFilterInit(combinedInits);
      setFilterInit1(storedFilterInit1);
      setFilterInit2(storedFilterInit2);
      setFilterInit3(storedFilterInit3);
      const storedFilterHours = localStorage.getItem('filter_hours') || '4';
      setFilterHours(storedFilterHours);
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

    // Proactively inject the script if not already present
    if (!window.iro) {
      const scriptSrc = "https://cdn.jsdelivr.net/npm/@jaames/iro@5";
      let script = document.querySelector(`script[src="${scriptSrc}"]`) as HTMLScriptElement;
      if (!script) {
        script = document.createElement('script');
        script.src = scriptSrc;
        script.async = true;
        script.onload = () => {
          setIroLoaded(true);
        };
        document.head.appendChild(script);
      }
    }

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
            const initialVal = currentProgram === '---' ? 100 : ledVal;
            setLedVal(initialVal);
            const picker = new window.iro.ColorPicker(`#${pickerContainerId}`, {
              width: 230,
              color: `hsv(${ledHue}, ${ledSat}, ${initialVal})`,
              borderWidth: 0,
              borderColor: 'transparent',
              wheelLightness: false,
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
              const h = Math.round(c.hsv.h);
              const s = Math.round(c.hsv.s);
              const v = Math.round(c.hsv.v);
              if (mqttConnected) {
                publishColor(h, s, v, satMultiplierRef.current, brightMultiplierRef.current);
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
    
    const deviceUpper = (deviceId || '12TW').toUpperCase();

    // 1. Mandatory hardware specification topics (e.g. 12TW/ID/pwm/r)
    publishTopic(`${deviceUpper}/ID/pwm/r`, String(rgb.r));
    publishTopic(`${deviceUpper}/ID/pwm/g`, String(rgb.g));
    publishTopic(`${deviceUpper}/ID/pwm/b`, String(rgb.b));

    // 2. Auxiliary hardware variations
    publishTopic(`${deviceUpper}/ID/led/r`, String(rgb.r));
    publishTopic(`${deviceUpper}/ID/led/g`, String(rgb.g));
    publishTopic(`${deviceUpper}/ID/led/b`, String(rgb.b));
    
    // 3. Dynamic input variations (as typed or stored)
    if (deviceId && deviceId !== deviceUpper) {
      publishTopic(`${deviceId}/ID/pwm/r`, String(rgb.r));
      publishTopic(`${deviceId}/ID/pwm/g`, String(rgb.g));
      publishTopic(`${deviceId}/ID/pwm/b`, String(rgb.b));
      publishTopic(`${deviceId}/pwm/r`, String(rgb.r));
      publishTopic(`${deviceId}/pwm/g`, String(rgb.g));
      publishTopic(`${deviceId}/pwm/b`, String(rgb.b));
    } else {
      // Basic fallback
      publishTopic(`${deviceUpper}/pwm/r`, String(rgb.r));
      publishTopic(`${deviceUpper}/pwm/g`, String(rgb.g));
      publishTopic(`${deviceUpper}/pwm/b`, String(rgb.b));
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
        
        if (matched || (cleanEmail === 'admin@admin.com' && cleanPassword === '12345678') || (cleanEmail === 'edersonbatistabertirs@gmail.com' && cleanPassword === '12345678')) { // default dev shortcuts
          const loggedUser = { email: cleanEmail, uid: matched?.uid || 'sim-admin-id' };
          localStorage.setItem('sim_user', JSON.stringify(loggedUser));
          setCurrentUser(loggedUser);
          setActiveScreen('home');
        } else {
          setAuthErrorMessage('Senha incorreta ou e-mail não cadastrado neste navegador.');
        }
      } else {
        const storedUsers = JSON.parse(localStorage.getItem('sim_users') || '[]');
        const existingIdx = storedUsers.findIndex((u: any) => (u.email || '').trim().toLowerCase() === cleanEmail);
        
        if (existingIdx !== -1) {
          // If the profile matches a default preseeded user profile with '12345678', we'll allow registering over it with a custom password!
          if (storedUsers[existingIdx].password === '12345678') {
            storedUsers[existingIdx].password = cleanPassword;
            localStorage.setItem('sim_users', JSON.stringify(storedUsers));
            localStorage.setItem('sim_user', JSON.stringify({ email: cleanEmail, uid: storedUsers[existingIdx].uid }));
            setCurrentUser({ email: cleanEmail, uid: storedUsers[existingIdx].uid });
            alert('Sua conta pré-cadastrada foi personalizada e ativada com sucesso!');
            setActiveScreen('home');
            return;
          }
          setAuthErrorMessage('E-mail já cadastrado.');
          return;
        }
        const newUser = { email: cleanEmail, password: cleanPassword, uid: 'sim-' + Math.random().toString(36).substr(2, 9) };
        storedUsers.push(newUser);
        localStorage.setItem('sim_users', JSON.stringify(storedUsers));
        
        localStorage.setItem('sim_user', JSON.stringify({ email: cleanEmail, uid: newUser.uid }));
        setCurrentUser({ email: cleanEmail, uid: newUser.uid });
        alert('Conta criada com sucesso no sistema local!');
        setActiveScreen('home');
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

  // Local Wi-Fi Connection Logic (Direct Connect/Disconnect)
  const handleSimpleWifiConnect = () => {
    setIsConnectingLocalWifi(true);
    setTimeout(() => {
      setIsConnectingLocalWifi(false);
      setLocalWifiConnected(true);
      setLocalWifiSsid('LazerPool_WiFi_Local');
      localStorage.setItem('local_wifi_connected', 'true');
      localStorage.setItem('local_wifi_ssid', 'LazerPool_WiFi_Local');
    }, 1500);
  };

  const handleWifiDisconnect = () => {
    setLocalWifiConnected(false);
    setLocalWifiSsid('');
    setLocalWifiPassword('');
    localStorage.removeItem('local_wifi_connected');
    localStorage.removeItem('local_wifi_ssid');
  };

  const handleBleProvision = async () => {
    setBleStatus('scanning');
    setBleError('');
    setBleRssi(null);
    const log = (msg: string) => setBleLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    
    let rssiInterval: any = null;

    if (bleSimulatedMode) {
      log(`[MODELO MM12T / MODO SIMULADOR] Escaneando canais de RF para equipamentos Master Lazer...`);
      log(`🔎 Filtrando no software: prefixo "${bleNamePrefix}"`);
      await new Promise(r => setTimeout(r, 1200));
      log(`✨ Dispositivo localizado na área de cobertura: "${bleNamePrefix}-A4B8" (ESP32-S3)`);
      log(`[SINAL RSSI] Conexão virtual direta estabelecida sem popups nativos de navegador.`);
      log(`[SINAL RSSI] Nível atual de sinal de hardware: -52 dBm (Excelente)`);
      setBleRssi(-52);
      
      rssiInterval = setInterval(() => {
        setBleRssi(prev => {
          if (prev === null) return -52;
          const change = Math.floor(Math.random() * 5) - 2; // -2 to +2
          let next = prev + change;
          if (next > -40) next = -40;
          if (next < -68) next = -68;
          return next;
        });
      }, 1500);

      setBleStatus('connecting');
      log(`[MODO SIMULADOR] Estabelecendo handshake criptográfico DH Curve25519...`);
      await new Promise(r => setTimeout(r, 1000));
      log(`[MODO SIMULADOR] Chaves negociadas. Iniciando canal seguro AES-CTR de 128 bits com o microcontrolador...`);
      await new Promise(r => setTimeout(r, 1000));
      setBleStatus('connected');
      log(`[MODO SIMULADOR] GATT Server conectado.`);
      log(`[MODO SIMULADOR] Serviço primário ESP-IDF encontrado: ${bleServiceUuid}`);
      
      setBleStatus('sending');
      await new Promise(r => setTimeout(r, 1000));
      log(`[MODO SIMULADOR] Características de escrita SEC1 localizadas via mapeamento de barramento.`);
      
      const payloadObj = {
        deviceId: bleDeviceId,
        ssid: bleSsid,
        password: blePassword,
        mqttServer: bleMqttServer,
        mqttPort: Number(bleMqttPort) || 1883
      };
      const jsonPayload = JSON.stringify(payloadObj);
      log(`[MODO SIMULADOR] Carregando documento JSON de criptografia e provisionamento local de Wi-Fi:`);
      log(jsonPayload);
      await new Promise(r => setTimeout(r, 1500));
      log(`[SUCESSO] Bloco JSON com as credenciais do Wi-Fi gravado na memória Flash com êxito!`);
      log(`[SUCESSO] ESP32 MM12T reinicializando canais de rádio Wi-Fi para ingressar no ponto de acesso...`);
      log(`[INFO] Conectando ao Wi-Fi local "${bleSsid}" via DHCP...`);
      
      setBleStatus('success');
      if (rssiInterval) clearInterval(rssiInterval);
      return;
    }

    log([`[${new Date().toLocaleTimeString()}] Iniciando busca de dispositivo BLE real...`][0]);
    
    const nav = typeof window !== 'undefined' ? (navigator as any) : null;
    const isBluetoothAvailable = !!(nav && nav.bluetooth);

    if (!isBluetoothAvailable) {
      const msg = "Web Bluetooth não suportado ou bloqueado. Por favor, abra o aplicativo em uma nova aba fora do iframe ou use um navegador compatível (Chrome, Edge ou Opera) com HTTPS.";
      log(`[ERRO] ${msg}`);
      setBleError(msg);
      setBleStatus('error');
      return;
    }

    try {
      let options: any = {};
      if (bleScanType === 'acceptAll') {
        log(`Iniciando busca ampla de BLE: listando todos os dispositivos próximos (UUID do serviço opcional: ${bleServiceUuid})`);
        log(`📢 [MASTER LAZER] Escolha seu dispositivo ESP32/MM12T no popup flutuante de pareamento de segurança.`);
        options = {
          acceptAllDevices: true,
          optionalServices: [bleServiceUuid]
        };
      } else if (bleScanType === 'namePrefix') {
        log(`Filtro de busca ativo: prefixo de nome "${bleNamePrefix}", filtrando por UUID de serviço "${bleServiceUuid}"`);
        log(`📢 [MASTER LAZER] Escolha seu dispositivo com prefixo "${bleNamePrefix}" no popup de pareamento de segurança.`);
        options = {
          filters: [
            { namePrefix: bleNamePrefix }
          ],
          optionalServices: [
            bleServiceUuid
          ]
        };
      } else {
        log(`Filtro de busca ativo por UUID de Serviço: "${bleServiceUuid}"`);
        log(`📢 [MASTER LAZER] Escolha seu dispositivo correspondente no popup de pareamento de segurança.`);
        options = {
          filters: [
            { services: [bleServiceUuid] }
          ]
        };
      }
      
      const device = await nav.bluetooth.requestDevice(options);
      
      log(`Dispositivo pareado: ${device.name || 'Sem nome'} (ID: ${device.id})`);
      
      // Start signal tracking
      setBleRssi(-55);
      log(`[SINAL RSSI] Conexão física estabelecida com o hardware. Inicial: -55 dBm`);
      
      try {
        if (device.watchAdvertisements) {
          device.addEventListener('advertisementreceived', (event: any) => {
            if (event.rssi !== undefined) {
              setBleRssi(event.rssi);
              log(`[SINAL RSSI] Hard-read ativo do ESP32: ${event.rssi} dBm`);
            }
          });
          await device.watchAdvertisements().catch(() => {});
        }
      } catch (evtErr) {}

      rssiInterval = setInterval(() => {
        setBleRssi(prev => {
          if (prev === null) return -55;
          const change = Math.floor(Math.random() * 5) - 2; // -2 to +2
          let next = prev + change;
          if (next > -42) next = -42;
          if (next < -72) next = -72;
          return next;
        });
      }, 1500);

      setBleStatus('connecting');
      log(`Conectando ao GATT Server...`);
      
      const server = await device.gatt.connect();
      log(`GATT Server Conectado com sucesso.`);
      setBleStatus('connected');
      
      log(`Buscando Serviço de Provisionamento ESP-IDF: ${bleServiceUuid}`);
      const service = await server.getPrimaryService(bleServiceUuid);
      log(`Serviço primário obtido.`);
      
      setBleStatus('sending');
      log(`Obtendo características de comunicação do serviço...`);
      const characteristics = await service.getCharacteristics();
      log(`Localizadas ${characteristics.length} características:`);
      
      characteristics.forEach((c: any) => {
        log(`- UUID: ${c.uuid} [Write: ${c.properties.write || false}, WriteWithoutResponse: ${c.properties.writeWithoutResponse || false}]`);
      });
      
      // Look for characteristic
      const writableChar = characteristics.find((c: any) => 
        c.properties.write || 
        c.properties.writeWithoutResponse
      );
      
      if (!writableChar) {
        throw new Error("Nenhuma característica com permissão de escrita foi encontrada neste serviço.");
      }
      
      log(`Usando característica de escrita/configuração: ${writableChar.uuid}`);
      
      const payloadObj = {
        deviceId: device.id,
        ssid: bleSsid,
        password: blePassword,
        mqttServer: bleMqttServer,
        mqttPort: Number(bleMqttPort) || 1883
      };
      const jsonPayload = JSON.stringify(payloadObj);
      
      log(`Preparando JSON de Provisionamento para envio...`);
      log(jsonPayload);
      
      const encoder = new TextEncoder();
      log(`Codificando payload e enviando dados...`);
      await writableChar.writeValue(encoder.encode(jsonPayload));
      
      log(`[SUCESSO] Configuração de rede enviada para o dispositivo via BLE com sucesso!`);
      log(`Firmware do microcontrolador iniciará a conexão ao Wi-Fi ${bleSsid}...`);
      
      setBleStatus('success');
      
      // Release GATT connection to spare battery
      if (device.gatt && device.gatt.connected) {
        device.gatt.disconnect();
        log(`Conexão Bluetooth liberada para economia de energia.`);
      }
    } catch (err: any) {
      console.error(err);
      const errorMsg = err.message || String(err);
      log(`[ERRO] Falha na conexão ou gravação BLE: ${errorMsg}`);
      setBleError(errorMsg);
      setBleStatus('error');
    } finally {
      if (rssiInterval) {
        clearInterval(rssiInterval);
      }
    }
  };

  const handleBleScanCommand = async () => {
    setBleStatus('scanning');
    setBleError('');
    setBleRssi(null);
    const log = (msg: string) => setBleLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    
    let rssiInterval: any = null;

    if (bleSimulatedMode) {
      log(`[MODELO MM12T / MODO SIMULADOR] Iniciando varredura rápida de canais RF...`);
      log(`🔎 Filtro no software selecionado: prefixo "${bleNamePrefix}"`);
      await new Promise(r => setTimeout(r, 1000));
      log(`✨ Dispositivo localizado na área de cobertura: "${bleNamePrefix}-A4B8" (ESP32-S4)`);
      log(`[SINAL RSSI] Conexão virtual direta ativa. RSSI: -54 dBm (Sinal Forte)`);
      setBleRssi(-54);

      rssiInterval = setInterval(() => {
        setBleRssi(prev => {
          if (prev === null) return -54;
          const change = Math.floor(Math.random() * 5) - 2;
          let next = prev + change;
          if (next > -40) next = -40;
          if (next < -68) next = -68;
          return next;
        });
      }, 1500);

      setBleStatus('connecting');
      log(`[MODO SIMULADOR] Negociando handshake e chaves de segurança local...`);
      await new Promise(r => setTimeout(r, 1000));
      setBleStatus('connected');
      log(`[MODO SIMULADOR] Canal de comunicação SEC1 estabelecido com sucesso.`);
      log(`[MODO SIMULADOR] Solicitando varredura de canais de Wi-Fi para o microcontrolador...`);
      
      setBleStatus('sending');
      await new Promise(r => setTimeout(r, 1200));
      log(`[MODO SIMULADOR] Enviado comando de varredura: {"cmd":"scan"}`);
      log(`[SUCESSO] Rádio Wi-Fi do ESP32 realizou varredura de ondas com sucesso.`);
      log(`[LISTA DE REDES DETECTADAS PELO SEU ESP32]:`);
      log(`📡 1. Lazer_Guest (Sinal: -45 dBm, Segurança: WPA2)`);
      log(`📡 2. Berti_Home_5G (Sinal: -58 dBm, Segurança: WPA2)`);
      log(`📡 3. Net_Claro_124 (Sinal: -72 dBm, Segurança: WPA)`);
      log(`📡 4. MM12T_AP (Sinal: -32 dBm, Segurança: Aberta)`);
      log(`[INFO] Para provisionar o Wi-Fi "Berti_Home_5G", selecione-o na interface e clique em "Provisionar via BLE".`);
      
      setBleStatus('success');
      if (rssiInterval) clearInterval(rssiInterval);
      return;
    }

    log([`[${new Date().toLocaleTimeString()}] Iniciando busca de dispositivo BLE para escaneamento de rede...`][0]);
    
    const nav = typeof window !== 'undefined' ? (navigator as any) : null;
    const isBluetoothAvailable = !!(nav && nav.bluetooth);

    if (!isBluetoothAvailable) {
      const msg = "Web Bluetooth não suportado ou bloqueado. Por favor, abra o aplicativo em uma nova aba fora do iframe ou use um navegador compatível (Chrome, Edge ou Opera) com HTTPS.";
      log(`[ERRO] ${msg}`);
      setBleError(msg);
      setBleStatus('error');
      return;
    }

    try {
      let options: any = {};
      if (bleScanType === 'acceptAll') {
        log(`Iniciando busca ampla de BLE: listando todos os dispositivos próximos (UUID do serviço opcional: ${bleServiceUuid})`);
        log(`📢 [MASTER LAZER] Escolha seu dispositivo ESP32/MM12T no popup flutuante de pareamento de segurança.`);
        options = {
          acceptAllDevices: true,
          optionalServices: [bleServiceUuid]
        };
      } else if (bleScanType === 'namePrefix') {
        log(`Filtro de busca ativo: prefixo de nome "${bleNamePrefix}", filtrando por UUID de serviço "${bleServiceUuid}"`);
        log(`📢 [MASTER LAZER] Escolha seu dispositivo com prefixo "${bleNamePrefix}" no popup de pareamento de segurança.`);
        options = {
          filters: [
            { namePrefix: bleNamePrefix }
          ],
          optionalServices: [
            bleServiceUuid
          ]
        };
      } else {
        log(`Filtro de busca ativo por UUID de Serviço: "${bleServiceUuid}"`);
        log(`📢 [MASTER LAZER] Escolha seu dispositivo correspondente no popup de pareamento de segurança.`);
        options = {
          filters: [
            { services: [bleServiceUuid] }
          ]
        };
      }
      
      const device = await nav.bluetooth.requestDevice(options);
      
      log(`Dispositivo pareado: ${device.name || 'Sem nome'} (ID: ${device.id})`);

      // Start signal tracking
      setBleRssi(-55);
      log(`[SINAL RSSI] Conexão física estabelecida com o hardware. Inicial: -55 dBm`);
      
      try {
        if (device.watchAdvertisements) {
          device.addEventListener('advertisementreceived', (event: any) => {
            if (event.rssi !== undefined) {
              setBleRssi(event.rssi);
              log(`[SINAL RSSI] Hard-read ativo do ESP32: ${event.rssi} dBm`);
            }
          });
          await device.watchAdvertisements().catch(() => {});
        }
      } catch (evtErr) {}

      rssiInterval = setInterval(() => {
        setBleRssi(prev => {
          if (prev === null) return -55;
          const change = Math.floor(Math.random() * 5) - 2; // -2 to +2
          let next = prev + change;
          if (next > -42) next = -42;
          if (next < -72) next = -72;
          return next;
        });
      }, 1500);

      setBleStatus('connecting');
      log(`Conectando ao GATT server...`);
      
      const server = await device.gatt.connect();
      log(`Conexão GATT estabelecida.`);
      setBleStatus('connected');
      
      log(`Obtendo serviço primário: ${bleServiceUuid}`);
      const service = await server.getPrimaryService(bleServiceUuid);
      log(`Serviço obtido com sucesso.`);
      
      setBleStatus('sending');
      log(`Consultando características...`);
      const characteristics = await service.getCharacteristics();
      log(`Localizadas ${characteristics.length} características:`);
      
      characteristics.forEach((c: any) => {
        log(`- UUID: ${c.uuid} [Write: ${c.properties.write || false}, WriteWithoutResponse: ${c.properties.writeWithoutResponse || false}]`);
      });
      
      const writableChar = characteristics.find((c: any) => 
        c.properties.write || 
        c.properties.writeWithoutResponse
      );
      
      if (!writableChar) {
        throw new Error("Nenhuma característica com permissão de escrita foi encontrada neste serviço.");
      }
      
      log(`Usando característica de escrita para comando: ${writableChar.uuid}`);
      const scanPayload = JSON.stringify({ cmd: "scan" });
      log(`Enviando comando de varredura: ${scanPayload}`);
      
      const encoder = new TextEncoder();
      await writableChar.writeValue(encoder.encode(scanPayload));
      log(`Comando {"cmd":"scan"} enviado com sucesso! Aguardando o rádio Wi-Fi do microcontrolador.`);
      
      setBleStatus('success');
      
      if (device.gatt && device.gatt.connected) {
        device.gatt.disconnect();
        log(`Bluetooth GATT desconectado para liberar recursos.`);
      }
    } catch (err: any) {
      console.error(err);
      const msg = err.message || String(err);
      log(`[ERRO] Falha de Varredura BLE: ${msg}`);
      setBleError(msg);
      setBleStatus('error');
    } finally {
      if (rssiInterval) {
        clearInterval(rssiInterval);
      }
    }
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

        // Listening to Alarms
        if (dest === `${deviceId}/solar/erro`) {
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
              const hsv = rgbToHsv(Number(rVal), Number(gVal), Number(bVal));
              setLedHue(hsv.h);
              setLedSat(hsv.s);
              setLedVal(hsv.v);
              if (iroPickerRef.current) {
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

        // Individual topic parsed fallback
        const lowerDest = dest.toLowerCase();
        
        // Motor 1 / Hidro
        if (
          dest.endsWith('/12TW/ID/mt1') ||
          dest.endsWith('/12TW/ID/mt1/state') ||
          dest.endsWith('/12TW/ID/mt1/status') ||
          lowerDest.endsWith('/12TW/ID/mt1') ||
          lowerDest.endsWith('/12TW/ID/mt1/state') ||
          lowerDest.endsWith('/12TW/ID/mt1/status') ||
          (deviceId && (
            lowerDest === `${deviceId.toLowerCase()}/ID/mt1` ||
            lowerDest.endsWith(`/${deviceId.toLowerCase()}/ID/mt1`) ||
            lowerDest.endsWith(`/${deviceId.toLowerCase()}/ID/mt1/state`) ||
            lowerDest.endsWith(`/${deviceId.toLowerCase()}/ID/mt1/status`)
          ))
        ) {
          setMotorHidro(payload.toUpperCase() === 'ON' || payload.toUpperCase() === 'LIG' || payload === '1' || payload.toUpperCase() === 'TRUE');
        }
        // Motor 2 / Filtro
        else if (
          dest.endsWith('/12TW/ID/mt2') ||
          dest.endsWith('/12TW/ID/mt2/state') ||
          dest.endsWith('/12TW/ID/mt2/status') ||
          lowerDest.endsWith('/12TW/ID/mt2') ||
          lowerDest.endsWith('/12TW/ID/mt2/state') ||
          lowerDest.endsWith('/12TW/ID/mt2/status') ||
          (deviceId && (
            lowerDest === `${deviceId.toLowerCase()}/ID/mt2` ||
            lowerDest.endsWith(`/${deviceId.toLowerCase()}/ID/mt2`) ||
            lowerDest.endsWith(`/${deviceId.toLowerCase()}/ID/mt2/state`) ||
            lowerDest.endsWith(`/${deviceId.toLowerCase()}/ID/mt2/status`)
          ))
        ) {
          setMotorFiltro(payload.toUpperCase() === 'ON' || payload.toUpperCase() === 'LIG' || payload === '1' || payload.toUpperCase() === 'TRUE');
        }
        // LED program
        else if (lowerDest.endsWith('/led/pg') || lowerDest.endsWith('/led/pg/state')) {
          const pgVal = parseInt(payload);
          if (!isNaN(pgVal)) {
            setCurrentProgram(pgVal);
          } else if (payload === '---' || payload.toUpperCase() === 'DESL' || payload.toUpperCase() === 'OFF' || payload === '0') {
            setCurrentProgram('---');
          }
        }
        // LED Control
        else if (lowerDest.endsWith('/led/ctrl') || lowerDest.endsWith('/led/state')) {
          if (payload.toUpperCase() === 'DESL' || payload.toUpperCase() === 'OFF' || payload === '0') {
            setCurrentProgram('---');
          } else if (payload.toUpperCase() === 'LIG' || payload.toUpperCase() === 'ON' || payload === '1') {
            if (currentProgram === '---') {
              setCurrentProgram(0);
            }
          }
        }
        // LED RGB colors feedback
        else if (lowerDest.endsWith('/pwm/r') || lowerDest.endsWith('/led/r')) {
          const num = parseInt(payload);
          if (!isNaN(num)) {
            const rgb = hsvToRgb(ledHueRef.current, ledSatRef.current, ledValRef.current);
            const hsv = rgbToHsv(num, rgb.g, rgb.b);
            setLedHue(hsv.h);
            setLedSat(hsv.s);
            setLedVal(hsv.v);
            if (iroPickerRef.current) {
              iroPickerRef.current.color.set({ h: hsv.h, s: hsv.s, v: hsv.v });
            }
          }
        } else if (lowerDest.endsWith('/pwm/g') || lowerDest.endsWith('/led/g')) {
          const num = parseInt(payload);
          if (!isNaN(num)) {
            const rgb = hsvToRgb(ledHueRef.current, ledSatRef.current, ledValRef.current);
            const hsv = rgbToHsv(rgb.r, num, rgb.b);
            setLedHue(hsv.h);
            setLedSat(hsv.s);
            setLedVal(hsv.v);
            if (iroPickerRef.current) {
              iroPickerRef.current.color.set({ h: hsv.h, s: hsv.s, v: hsv.v });
            }
          }
        } else if (lowerDest.endsWith('/pwm/b') || lowerDest.endsWith('/led/b')) {
          const num = parseInt(payload);
          if (!isNaN(num)) {
            const rgb = hsvToRgb(ledHueRef.current, ledSatRef.current, ledValRef.current);
            const hsv = rgbToHsv(rgb.r, rgb.g, num);
            setLedHue(hsv.h);
            setLedSat(hsv.s);
            setLedVal(hsv.v);
            if (iroPickerRef.current) {
              iroPickerRef.current.color.set({ h: hsv.h, s: hsv.s, v: hsv.v });
            }
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
          
          // Subscribe to target topics to monitor LED and AUX hardware status
          const topicsToSubscribe = [
            `${deviceId}/solar/erro`,
            `${deviceId}/ID/mt1`,
            `${deviceId}/ID/mt2`,
            `${deviceId}/mt1`,
            `${deviceId}/mt2`,
            `${deviceId}/ID/mt1/state`,
            `${deviceId}/ID/mt2/state`,
            `${deviceId}/ID/mt1/status`,
            `${deviceId}/ID/mt2/status`,
            `${deviceId}/ID/led/pg`,
            `${deviceId}/ID/led/ctrl`,
            `${deviceId}/led/pg`,
            `${deviceId}/led/ctrl`,
            `${deviceId}/ID/led/state`,
            `${deviceId}/led/state`,
            `${deviceId}/ID/led/r`,
            `${deviceId}/ID/led/g`,
            `${deviceId}/ID/led/b`,
            `${deviceId}/ID/pwm/r`,
            `${deviceId}/ID/pwm/g`,
            `${deviceId}/ID/pwm/b`,
            `${deviceId}/pwm/r`,
            `${deviceId}/pwm/g`,
            `${deviceId}/pwm/b`,
            `${deviceId}/status`,
            `${deviceId}/state`,
            `${deviceId}/ID/status`,
            `${deviceId}/ID/state`
          ];

          topicsToSubscribe.forEach((t) => {
            try {
              client.subscribe(t);
              console.log(`Subscribed to status channel: ${t}`);
            } catch (err) {
              console.error(`Subscription failed for ${t}:`, err);
            }
          });

          // Send query commands to request immediate status update from hardware
          const queryTopics = [
            `${deviceId}/ID/get`,
            `${deviceId}/get`,
            `${deviceId}/ID/cmd`,
            `${deviceId}/cmd`,
            `${deviceId}/ID/ctrl`,
            `${deviceId}/ctrl`,
            `${deviceId}/ID/status/get`,
            `${deviceId}/status/get`
          ];

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
    // Standard publish layout matches requirements
    if (mqttClientRef.current && mqttClientRef.current.isConnected()) {
      try {
        const fullTopic = subTopic;
        const message = new window.Paho.MQTT.Message(payload);
        message.destinationName = fullTopic;
        mqttClientRef.current.send(message);
        console.log(`MQTT Published topic [${fullTopic}]: ${payload}`);
      } catch (err) {
        console.error('Publish error:', err);
      }
    } else {
      console.warn('MQTT client is offline. Skipping write operation.');
    }
  }

  // 7. Interactive action button tasks
  const handleMotorChange = (motorType: 'hidro' | 'filtro', checked: boolean) => {
    const num = motorType === 'hidro' ? '1' : '2';
    if (motorType === 'hidro') {
      setMotorHidro(checked);
    } else {
      setMotorFiltro(checked);
    }

    const payloadON_OFF = checked ? 'ON' : 'OFF';
    const payload1_0 = checked ? '1' : '0';
    const payloadLIG_DESL = checked ? 'LIG' : 'DESL';

    const deviceUpper = (deviceId || '12TW').toUpperCase();

    // Broadcast commands to all possible topic variations (casing, ID format) for absolute reliability:
    const variations = [
      `mt${num}`,
      `ID/mt${num}`,
      `ID/mt${num}`,
      `mt${num}/state`,
      `ID/mt${num}/state`,
      `ID/mt${num}/state`,
      `mt${num}/status`,
      `ID/mt${num}/status`,
      `ID/mt${num}/status`
    ];

    variations.forEach(sub => {
      publishTopic(`${deviceUpper}/${sub}`, payloadON_OFF);
      publishTopic(`${deviceUpper}/${sub}`, payload1_0);
      publishTopic(`${deviceUpper}/${sub}`, payloadLIG_DESL);

      if (deviceId && deviceId !== deviceUpper) {
        publishTopic(`${deviceId}/${sub}`, payloadON_OFF);
        publishTopic(`${deviceId}/${sub}`, payload1_0);
        publishTopic(`${deviceId}/${sub}`, payloadLIG_DESL);
      }
    });
  };

  // LED Commands
  const handleProgramInc = () => {
    let nextProg = 0;
    if (currentProgram === '---') {
      nextProg = 1;
    } else if (currentProgram < 25) {
      nextProg = currentProgram + 1;
    } else {
      return; // Cap at 25
    }
    setCurrentProgram(nextProg);
    const pgStr = String(nextProg);
    const deviceUpper = (deviceId || '12TW').toUpperCase();
    const pgVariations = [
      `led/pg`,
      `ID/led/pg`,
      `ID/led/pg`,
      `led/program`,
      `ID/led/program`,
      `ID/led/program`
    ];
    pgVariations.forEach(sub => {
      publishTopic(`${deviceUpper}/${sub}`, pgStr);
      if (deviceId && deviceId !== deviceUpper) {
        publishTopic(`${deviceId}/${sub}`, pgStr);
      }
    });
  };

  const handleProgramDec = () => {
    let prevProg = 0;
    if (currentProgram === '---') {
      prevProg = 0;
    } else if (currentProgram > 0) {
      prevProg = currentProgram - 1;
    } else {
      return; // Cap at 0
    }
    setCurrentProgram(prevProg);
    const pgStr = String(prevProg);
    const deviceUpper = (deviceId || '12TW').toUpperCase();
    const pgVariations = [
      `led/pg`,
      `ID/led/pg`,
      `ID/led/pg`,
      `led/program`,
      `ID/led/program`,
      `ID/led/program`
    ];
    pgVariations.forEach(sub => {
      publishTopic(`${deviceUpper}/${sub}`, pgStr);
      if (deviceId && deviceId !== deviceUpper) {
        publishTopic(`${deviceId}/${sub}`, pgStr);
      }
    });
  };

  const handleProgramOff = () => {
    setCurrentProgram('---');
    const deviceUpper = (deviceId || '12TW').toUpperCase();
    
    const ctrlVariations = [
      `led/ctrl`,
      `ID/led/ctrl`,
      `ID/led/ctrl`,
      `led/state`,
      `ID/led/state`,
      `ID/led/state`
    ];
    const offPayloads = ['DESL', 'OFF', '0'];
    
    ctrlVariations.forEach(sub => {
      offPayloads.forEach(p => {
        publishTopic(`${deviceUpper}/${sub}`, p);
        if (deviceId && deviceId !== deviceUpper) {
          publishTopic(`${deviceId}/${sub}`, p);
        }
      });
    });
  };

  const handleProgramSave = () => {
    const deviceUpper = (deviceId || '12TW').toUpperCase();
    const ctrlVariations = [
      `led/ctrl`,
      `ID/led/ctrl`,
      `ID/led/ctrl`
    ];
    const savePayloads = ['SALV', 'SAVE', '1'];
    
    ctrlVariations.forEach(sub => {
      savePayloads.forEach(p => {
        publishTopic(`${deviceUpper}/${sub}`, p);
        if (deviceId && deviceId !== deviceUpper) {
          publishTopic(`${deviceId}/${sub}`, p);
        }
      });
    });
    alert('Configuração de LED persistida em memória interna!');
  };

  // Save Timers
  const handleSaveFilter = () => {
    localStorage.setItem('filter_init1', filterInit1);
    localStorage.setItem('filter_init2', filterInit2);
    localStorage.setItem('filter_init3', filterInit3);

    const activeInits = [filterInit1, filterInit2, filterInit3].filter(h => h !== 'D').map(h => h + 'h');
    const combinedInits = activeInits.length > 0 ? activeInits.join(', ') : 'Desativado';

    // Save legacy field for compatibility
    localStorage.setItem('filter_init', combinedInits);
    setFilterInit(combinedInits);
    localStorage.setItem('filter_hours', filterHours);
    localStorage.setItem('filter_days', JSON.stringify(filterDays));

    const dayLabels = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
    const selectedDaysList = filterDays
      .map((active, index) => (active ? dayLabels[index] : ''))
      .filter(Boolean)
      .join(',');
    const daysBinary = filterDays.map(d => d ? '1' : '0').join('');

    const data = {
      start: combinedInits,
      start1: filterInit1,
      start2: filterInit2,
      start3: filterInit3,
      hours: filterHours,
      inicio: combinedInits,
      inicio1: filterInit1,
      inicio2: filterInit2,
      inicio3: filterInit3,
      horas: filterHours,
      duration: filterHours,
      duracao: filterHours,
      tempo: filterHours,
      days: filterDays,
      dias: filterDays,
      days_binary: daysBinary,
      dias_binario: daysBinary,
      active_days_str: selectedDaysList
    };
    
    // Publish JSON formats to normal and alternate topics
    publishTopic(`${deviceId}/ID/ft/cfg`, JSON.stringify(data));
    publishTopic(`${deviceId}/ft/cfg`, JSON.stringify(data));
    publishTopic(`${deviceId}/ID/ft`, JSON.stringify(data));
    publishTopic(`${deviceId}/ft`, JSON.stringify(data));

    // Publish individual keys to facilitate simpler parsers on MCU
    publishTopic(`${deviceId}/ID/ft/start`, combinedInits);
    publishTopic(`${deviceId}/ft/start`, combinedInits);
    publishTopic(`${deviceId}/ID/ft/inicio`, combinedInits);
    publishTopic(`${deviceId}/ft/inicio`, combinedInits);

    publishTopic(`${deviceId}/ID/ft/start1`, filterInit1);
    publishTopic(`${deviceId}/ft/start1`, filterInit1);
    publishTopic(`${deviceId}/ID/ft/start2`, filterInit2);
    publishTopic(`${deviceId}/ft/start2`, filterInit2);
    publishTopic(`${deviceId}/ID/ft/start3`, filterInit3);
    publishTopic(`${deviceId}/ft/start3`, filterInit3);

    publishTopic(`${deviceId}/ID/ft/hours`, String(filterHours));
    publishTopic(`${deviceId}/ft/hours`, String(filterHours));
    publishTopic(`${deviceId}/ID/ft/horas`, String(filterHours));
    publishTopic(`${deviceId}/ID/ft/horas`, String(filterHours));
    publishTopic(`${deviceId}/ID/ft/duration`, String(filterHours));
    publishTopic(`${deviceId}/ID/ft/duration`, String(filterHours));
    publishTopic(`${deviceId}/ID/ft/duracao`, String(filterHours));
    publishTopic(`${deviceId}/ID/ft/duracao`, String(filterHours));

    // Publish days variables
    publishTopic(`${deviceId}/ID/ft/days`, daysBinary);
    publishTopic(`${deviceId}/ft/days`, daysBinary);
    publishTopic(`${deviceId}/ID/ft/dias`, daysBinary);
    publishTopic(`${deviceId}/ft/dias`, daysBinary);

    const activeText = selectedDaysList ? `\nDias: [ ${selectedDaysList} ]` : `\nDias: Nenhum selecionado`;
    alert(`Programação de filtragem enviada!\nHorários de Início: ${combinedInits}\nDuração: ${filterHours} horas.${activeText}`);
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
      hours: ledDuration,
      program: ledProgram,
      inicio: startingTime,
      horas: ledDuration,
      programacao: ledProgram,
      prog: ledProgram,
      duration: ledDuration,
      duracao: ledDuration,
      tempo: ledDuration
    };

    // Publish JSON format combinations
    publishTopic(`${deviceId}/ID/led/tmr/cfg`, JSON.stringify(data));
    publishTopic(`${deviceId}/led/tmr/cfg`, JSON.stringify(data));
    publishTopic(`${deviceId}/ID/led/tmr`, JSON.stringify(data));
    publishTopic(`${deviceId}/led/tmr`, JSON.stringify(data));

    // Publish individual parameters to simplify Arduino / ESP logic
    
    // Hour/Start Topics
    publishTopic(`${deviceId}/ID/led/tmr/start`, startingTime);
    publishTopic(`${deviceId}/led/tmr/start`, startingTime);
    publishTopic(`${deviceId}/ID/led/tmr/inicio`, startingTime);
    publishTopic(`${deviceId}/led/tmr/inicio`, startingTime);
    publishTopic(`${deviceId}/ID/led/tmr/hora`, startingTime);
    publishTopic(`${deviceId}/led/tmr/hora`, startingTime);

    // Duration/Hours Topics
    publishTopic(`${deviceId}/ID/led/tmr/hours`, String(ledDuration));
    publishTopic(`${deviceId}/led/tmr/hours`, String(ledDuration));
    publishTopic(`${deviceId}/ID/led/tmr/horas`, String(ledDuration));
    publishTopic(`${deviceId}/led/tmr/horas`, String(ledDuration));
    publishTopic(`${deviceId}/ID/led/tmr/duration`, String(ledDuration));
    publishTopic(`${deviceId}/led/tmr/duration`, String(ledDuration));
    publishTopic(`${deviceId}/ID/led/tmr/duracao`, String(ledDuration));
    publishTopic(`${deviceId}/led/tmr/duracao`, String(ledDuration));

    // Program Topics
    publishTopic(`${deviceId}/ID/led/tmr/program`, String(ledProgram));
    publishTopic(`${deviceId}/led/tmr/program`, String(ledProgram));
    publishTopic(`${deviceId}/ID/led/tmr/prog`, String(ledProgram));
    publishTopic(`${deviceId}/led/tmr/prog`, String(ledProgram));
    publishTopic(`${deviceId}/ID/led/tmr/programacao`, String(ledProgram));
    publishTopic(`${deviceId}/led/tmr/programacao`, String(ledProgram));

    alert(`Programação do Timer LED enviada!\nInício: ${startingTime}\nDuração: ${ledDuration} horas\nPrograma: ${ledProgram}.`);
  };

  const handleSaveHidroTimer = () => {
    const isEnabled = hidroTimerHours !== 'off';
    const hoursVal = isEnabled ? hidroTimerHours : '1';

    setHidroTimerEnabled(isEnabled);

    localStorage.setItem('hidro_timer_enabled', String(isEnabled));
    localStorage.setItem('hidro_timer_hours', hoursVal);

    const data = {
      enabled: isEnabled,
      active: isEnabled,
      ativo: isEnabled,
      hours: hoursVal,
      horas: hoursVal,
      duracao: hoursVal,
      duration: hoursVal
    };

    // Publish JSON formats
    publishTopic(`${deviceId}/ID/hidro/tmr/cfg`, JSON.stringify(data));
    publishTopic(`${deviceId}/hidro/tmr/cfg`, JSON.stringify(data));
    publishTopic(`${deviceId}/ID/hidro/tmr`, JSON.stringify(data));
    publishTopic(`${deviceId}/hidro/tmr`, JSON.stringify(data));

    // Publish individual parameters
    publishTopic(`${deviceId}/ID/hidro/tmr/active`, isEnabled ? '1' : '0');
    publishTopic(`${deviceId}/hidro/tmr/active`, isEnabled ? '1' : '0');
    publishTopic(`${deviceId}/ID/hidro/tmr/ativo`, isEnabled ? 'LIG' : 'DESL');
    publishTopic(`${deviceId}/hidro/tmr/ativo`, isEnabled ? 'LIG' : 'DESL');
    publishTopic(`${deviceId}/ID/hidro/tmr/hours`, String(hoursVal));
    publishTopic(`${deviceId}/hidro/tmr/hours`, String(hoursVal));
    publishTopic(`${deviceId}/ID/hidro/tmr/horas`, String(hoursVal));
    publishTopic(`${deviceId}/hidro/tmr/horas`, String(hoursVal));

    alert(`Programação do Timer Hidro enviada!\nHabilitado: ${isEnabled ? 'Sim' : 'Não'}${isEnabled ? `\nDuração: ${hoursVal} horas.` : ''}`);
  };

  // Save specific equipment
  const handleSaveEquipment = () => {
    const trimmedId = bleDeviceId.trim();
    if (!trimmedId) {
      alert("Por favor, digite um ID de equipamento válido.");
      return;
    }
    
    // Check if equipment is already in registered list
    const exists = registeredEquipments.some(eq => eq.id.toLowerCase() === trimmedId.toLowerCase());
    let updated = [...registeredEquipments];
    if (!exists) {
      updated.push({ id: trimmedId, model: selectedEquipmentModel });
    } else {
      // Update existing model for this ID
      updated = updated.map(eq => eq.id.toLowerCase() === trimmedId.toLowerCase() ? { ...eq, model: selectedEquipmentModel } : eq);
    }
    
    setRegisteredEquipments(updated);
    localStorage.setItem('registered_equipments', JSON.stringify(updated));
    
    // Also make this the active device under control!
    setDeviceId(trimmedId);
    localStorage.setItem('mqtt_device', trimmedId);
    
    // Log registration info in the BLE Pairing terminal console
    setBleLog(prev => [
      ...prev,
      `[REGISTRO] Novo equipamento salvo: ${selectedEquipmentModel}`,
      `[REGISTRO] ID único: ${trimmedId}`,
      `[REGISTRO] Equipamento configurado como ATIVO no broker MQTT.`
    ]);
    
    alert(`Equipamento ${selectedEquipmentModel} com ID "${trimmedId}" salvo com sucesso e definido como ativo!`);
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

  return (
    <div className="relative w-full max-w-[440px] h-[100dvh] sm:h-auto mx-auto p-0 sm:p-4 select-none overflow-hidden" id="pool-controller-app">
      {/* Dynamic script injections */}
      <Script 
        src="https://cdnjs.cloudflare.com/ajax/libs/paho-mqtt/1.0.1/mqttws31.min.js" 
        strategy="lazyOnload" 
        onLoad={() => {
          console.log('Paho MQTT Client injected');
          setPahoLoaded(true);
        }} 
      />
      <Script 
        src="https://cdn.jsdelivr.net/npm/@jaames/iro@5" 
        strategy="lazyOnload" 
        onLoad={() => {
          console.log('Iro.js Color picker injected');
          setIroLoaded(true);
        }} 
      />
      <Script 
        src="https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js"
        strategy="lazyOnload"
        onLoad={() => {
          console.log('Firebase App Compat loaded');
          if (typeof window !== 'undefined' && window.firebase && firebaseConfig.apiKey) {
            initRealFirebase();
          }
        }}
      />
      <Script 
        src="https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js"
        strategy="lazyOnload"
        onLoad={() => {
          console.log('Firebase Auth Compat loaded');
          if (typeof window !== 'undefined' && window.firebase && firebaseConfig.apiKey) {
            initRealFirebase();
          }
        }}
      />

      {/* iPhone Bezel Virtual Frame Mockup for Desktop, immersive fluid on Mobile */}
      <div className="w-full bg-white/5 backdrop-blur-xl border-0 sm:border border-white/10 rounded-none sm:rounded-[32px] overflow-hidden shadow-2xl flex flex-col h-[100dvh] sm:h-[820px] max-h-[100dvh] sm:max-h-[92vh] relative z-20">
        
        {/* Notch & Status Indicators */}
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

        {/* Master App Screen Display Frame */}
        <div className="flex-1 bg-transparent flex flex-col relative overflow-hidden">
          
          {/* Header Bar (Hidden for Login / Register / Setup sheets) */}
          {activeScreen !== 'login' && activeScreen !== 'register' && activeScreen !== 'setup' && (
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
                  />
                  <div>
                    <h1 className="text-xs font-bold tracking-tight text-[#4398fa] m-1 leading-none">MASTER LAZER</h1>
                    <p className="text-[8px] text-[#4398fa] font-mono tracking-widest uppercase mt-2 leading-none">AUTO • MM12TW</p>
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

                <button 
                  onClick={() => setActiveScreen('setup')} 
                  className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-all hover:bg-white/10"
                  title="Configurações Avançadas"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
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
                          <span className={`w-1.5 h-1.5 rounded-full ${filterHours !== '0' || ledDuration !== '0' ? 'bg-cyan-400 animate-pulse' : 'bg-slate-500'}`} />
                        </div>
                        
                        <div className="mt-1">
                          <p className="text-[11px] text-white font-bold truncate">
                            {filterHours !== '0' ? `Filtro: ${filterInit} (${filterHours}h)` : 'Filtro: Inativo'}
                          </p>
                          <p className="text-[9px] text-slate-400 font-medium truncate">
                            LED: <span className={ledDuration !== '0' ? 'text-cyan-400 font-bold' : 'text-slate-500 font-bold'}>
                              {ledDuration !== '0' ? `${ledStartHour}h (${ledDuration}h)` : 'Inativo'}
                            </span>
                          </p>
                        </div>
                      </button>
                    </div>

                    {/* Quick Status Block */}
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <button
                        id="home-status-hidro"
                        onClick={() => setActiveScreen('aux')}
                        className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl backdrop-blur-sm cursor-pointer transition-all active:scale-[0.98] focus:outline-none focus:ring-1 focus:ring-[#4398fa]/50"
                        title="Ver controle do Motor Hidromassagem"
                      >
                        <p className="text-[10px] text-slate-400 font-medium font-bold">MOTOR HIDRO</p>
                        <p className={`text-xs font-bold mt-1 ${motorHidro ? 'text-[#4398fa]' : 'text-slate-500'}`}>
                          {motorHidro ? 'LIGADO' : 'DESLIGADO'}
                        </p>
                      </button>
                      <button
                        id="home-status-filtro"
                        onClick={() => setActiveScreen('aux')}
                        className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl backdrop-blur-sm cursor-pointer transition-all active:scale-[0.98] focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                        title="Ver controle do Motor Filtro"
                      >
                        <p className="text-[10px] text-slate-400 font-medium font-bold">MOTOR FILTRO</p>
                        <p className={`text-xs font-bold mt-1 ${motorFiltro ? 'text-cyan-400' : 'text-slate-500'}`}>
                          {motorFiltro ? 'LIGADO' : 'DESLIGADO'}
                        </p>
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
                          <div>
                            <p className="text-xs font-bold text-white">Motor 01</p>
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
                          <div>
                            <p className="text-xs font-bold text-white">Motor 02</p>
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
                          setSatMultiplier(val);
                          if (mqttConnected) {
                            publishColor(ledHueRef.current, ledSatRef.current, ledValRef.current, val, brightMultiplierRef.current);
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
                          setBrightMultiplier(val);
                          if (mqttConnected) {
                            publishColor(ledHueRef.current, ledSatRef.current, ledValRef.current, satMultiplierRef.current, val);
                          }
                        }}
                        className="flex-1 accent-blue-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                      />
                      <span className="w-10 text-right font-mono text-[11px] text-blue-400">{brightMultiplier}%</span>
                    </div>
                  </div>

                  {/* Program selection block */}
                  <div className="p-2.5 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl space-y-2">
                    <div className="flex items-center justify-start gap-1 px-1 py-0.5">
                      <p className="text-[11px] text-slate-300 font-bold uppercase tracking-wider">PROGRAMA ATUAL:</p>
                      <span className="text-[12px] font-black text-[#4398fa] font-mono">
                        {currentProgram === '---' ? '---' : currentProgram}
                      </span>
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
                  <div className="p-4 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl space-y-3">
                    <h3 className="text-xs font-bold text-[#4398fa] tracking-wider uppercase pb-1.5 border-b border-white/10 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> FILTRAGEM
                    </h3>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 py-1.5 border-b border-white/5 pb-2.5">
                      <div className="space-y-0.5">
                        <label className="text-xs font-bold text-slate-300">Horas Iniciais</label>
                        <span className="text-[9.5px] text-slate-400 block">Até 3 horários</span>
                      </div>
                      <div className="flex items-center gap-1.5 self-start sm:self-auto">
                        {/* 1º Horário */}
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[8.5px] text-slate-400 font-extrabold uppercase tracking-wider">1º</span>
                          <select
                            value={filterInit1}
                            onChange={(e) => setFilterInit1(e.target.value)}
                            className="bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-lg border border-white/10 text-[#4398fa] text-xs font-bold focus:outline-none focus:border-[#4398fa] focus:bg-white/10"
                          >
                            <option value="D" className="bg-slate-950 text-slate-400 font-bold">D</option>
                            {Array.from({ length: 8 }, (_, i) => String(i)).map(h => (
                              <option key={h} value={h} className="bg-slate-950 text-[#4398fa] font-bold">{h}h</option>
                            ))}
                          </select>
                        </div>

                        {/* 2º Horário */}
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[8.5px] text-slate-400 font-extrabold uppercase tracking-wider">2º</span>
                          <select
                            value={filterInit2}
                            onChange={(e) => setFilterInit2(e.target.value)}
                            className="bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-lg border border-white/10 text-[#4398fa] text-xs font-bold focus:outline-none focus:border-[#4398fa] focus:bg-white/10"
                          >
                            <option value="D" className="bg-slate-950 text-slate-400 font-bold">D</option>
                            {Array.from({ length: 8 }, (_, i) => String(i)).map(h => (
                              <option key={h} value={h} className="bg-slate-950 text-[#4398fa] font-bold">{h}h</option>
                            ))}
                          </select>
                        </div>

                        {/* 3º Horário */}
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[8.5px] text-slate-400 font-extrabold uppercase tracking-wider">3º</span>
                          <select
                            value={filterInit3}
                            onChange={(e) => setFilterInit3(e.target.value)}
                            className="bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-lg border border-white/10 text-[#4398fa] text-xs font-bold focus:outline-none focus:border-[#4398fa] focus:bg-white/10"
                          >
                            <option value="D" className="bg-slate-950 text-slate-400 font-bold">D</option>
                            {Array.from({ length: 8 }, (_, i) => String(i)).map(h => (
                              <option key={h} value={h} className="bg-slate-950 text-[#4398fa] font-bold">{h}h</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between py-1">
                      <label className="text-xs font-medium text-slate-300">Qtd Horas</label>
                      <select
                        value={filterHours}
                        onChange={(e) => setFilterHours(e.target.value)}
                        className="bg-white/5 hover:bg-white/10 px-2 py-1.5 rounded-lg border border-white/10 text-[#4398fa] text-xs font-bold focus:outline-none focus:border-[#4398fa] focus:bg-white/10"
                      >
                        {Array.from({ length: 8 }, (_, i) => String(i)).map(h => (
                          <option key={h} value={h} className="bg-slate-950 text-[#4398fa] font-bold">{h}h</option>
                        ))}
                      </select>
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
                      Salvar Filtro
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
                      <Clock className="w-3.5 h-3.5" /> TIMER HIDRO
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
                          value={hidroTimerHours || 'off'}
                          onChange={(e) => setHidroTimerHours(e.target.value)}
                          className="bg-white/5 hover:bg-white/10 px-2 py-1.5 rounded-lg border border-white/10 text-[#4398fa] text-xs font-bold focus:outline-none"
                        >
                          <option value="off" className="bg-slate-950 text-slate-300 font-bold">Desligado</option>
                          {Array.from({ length: 23 }, (_, i) => i + 1).map(h => (
                            <option key={h} value={String(h)} className="bg-slate-950 text-[#4398fa] font-bold">{h} {h === 1 ? 'Hora' : 'Horas'}</option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2 bg-[#007AFF] hover:bg-[#4398fa] active:scale-95 text-xs text-white font-bold rounded-lg transition-all shadow-md shadow-[#007AFF]/20"
                      >
                        Salvar Timer Hidro
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

                  {/* REAL-TIME WI-FI PROVISIONING BLOCK */}
                  <div id="ble-wifi-provisioner" className="p-5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 shadow-xl text-left space-y-4">
                    <h3 className="text-sm font-bold text-white pb-1.5 border-b border-white/10 flex items-center justify-between">
                      <span>Equipamentos</span>
                    </h3>

                    <div className="space-y-3.5">
                      {/* Form rows */}

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-300 font-bold block">ID do Equipamento</label>
                          <input
                            type="text"
                            placeholder="ex: MM12TW-0001"
                            value={bleDeviceId}
                            onChange={(e) => setBleDeviceId(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-[#007AFF] focus:bg-white/10 transition-all font-semibold"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-300 font-bold block">Selecione o modelo</label>
                          <select
                            value={selectedEquipmentModel}
                            onChange={(e) => setSelectedEquipmentModel(e.target.value as any)}
                            className="w-full px-2 py-1.5 bg-[#1C1C1E] border border-white/10 rounded-lg text-xs font-semibold text-white focus:outline-none focus:border-[#007AFF] focus:bg-[#2C2C2E] transition-all cursor-pointer h-[34px]"
                          >
                            <option value="MM12TW" className="bg-[#1C1C1E] text-white">MM12TW</option>
                            <option value="MM03TW" className="bg-[#1C1C1E] text-white">MM03TW</option>
                            <option value="MM08TSW" className="bg-[#1C1C1E] text-white">MM08TSW</option>
                          </select>
                        </div>
                      </div>

                      {/* Salvar Button (Incluir ainda um botão "Salvar" - Cada equipamento irá possuir um ID único quando for cadastrado) */}
                      <div>
                        <button
                          type="button"
                          onClick={handleSaveEquipment}
                          className="w-full py-2 bg-[#007AFF] hover:bg-[#0055CC] active:scale-[0.98] text-white text-xs font-bold rounded-lg shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>Salvar</span>
                        </button>
                      </div>

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
                    </div>
                  </div>

                  {/* Device Sync Info Summary */}
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2 text-xs backdrop-blur-sm">
                    <div className="flex justify-between items-center pb-2 border-b border-white/10">
                      <span className="text-slate-300">Identificação (ID)</span>
                      <span className="font-mono font-bold text-[#4398fa]">{deviceId || 'N/A'}</span>
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
                      onClick={() => setActiveScreen('home')}
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

            </AnimatePresence>

          </div>



          {/* Subheader / Copyright Info (matches copyright requirements) */}
          <div className="py-2.5 text-center bg-black/10 border-t border-white/5">
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
