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
  FolderSync
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
      src="https://www.masterlazer.com.br/images/logo1.png"
      alt="Master Lazer Logo"
      fill
      sizes="168px"
      className="object-contain"
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
  const [filterHours, setFilterHours] = useState('4');
  
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

      const conf = {
        apiKey: localStorage.getItem('fb_api_key') || '',
        authDomain: localStorage.getItem('fb_auth_domain') || '',
        projectId: localStorage.getItem('fb_project_id') || '',
        storageBucket: localStorage.getItem('fb_storage_bucket') || '',
        messagingSenderId: localStorage.getItem('fb_messaging_sender_id') || '',
        appId: localStorage.getItem('fb_app_id') || ''
      };
      setFirebaseConfig(conf);

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
      const storedFilterHours = localStorage.getItem('filter_hours') || '4';
      setFilterInit(storedFilterInit);
      setFilterHours(storedFilterHours);

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

  useEffect(() => {
    if (typeof window !== 'undefined' && window.firebase && firebaseConfig.apiKey) {
      initRealFirebase();
    }
  }, [firebaseConfig, typeof window !== 'undefined' && window.firebase]);

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
    
    // Standard topics
    publishTopic(`${deviceId}/pwm/r`, String(rgb.r));
    publishTopic(`${deviceId}/pwm/g`, String(rgb.g));
    publishTopic(`${deviceId}/pwm/b`, String(rgb.b));

    // ID-prefixed topics (consistent with output buttons e.g. deviceId/ID/mt1)
    publishTopic(`${deviceId}/ID/pwm/r`, String(rgb.r));
    publishTopic(`${deviceId}/ID/pwm/g`, String(rgb.g));
    publishTopic(`${deviceId}/ID/pwm/b`, String(rgb.b));

    // LED specific subpaths
    publishTopic(`${deviceId}/ID/led/r`, String(rgb.r));
    publishTopic(`${deviceId}/ID/led/g`, String(rgb.g));
    publishTopic(`${deviceId}/ID/led/b`, String(rgb.b));
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
        
        if (matched || cleanEmail === 'admin@admin.com') { // default dev shortcut
          const loggedUser = { email: cleanEmail, uid: matched?.uid || 'sim-admin-id' };
          localStorage.setItem('sim_user', JSON.stringify(loggedUser));
          setCurrentUser(loggedUser);
          setActiveScreen('home');
        } else {
          setAuthErrorMessage('Senha incorreta ou e-mail não cadastrado neste navegador.');
        }
      } else {
        const storedUsers = JSON.parse(localStorage.getItem('sim_users') || '[]');
        if (storedUsers.some((u: any) => (u.email || '').trim().toLowerCase() === cleanEmail)) {
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
        if (lowerDest.endsWith('/mt1') || lowerDest.endsWith('/mt1/state') || lowerDest.endsWith('/mt1/status')) {
          setMotorHidro(payload.toUpperCase() === 'ON' || payload.toUpperCase() === 'LIG' || payload === '1' || payload.toUpperCase() === 'TRUE');
        }
        // Motor 2 / Filtro
        else if (lowerDest.endsWith('/mt2') || lowerDest.endsWith('/mt2/state') || lowerDest.endsWith('/mt2/status')) {
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
    if (motorType === 'hidro') {
      setMotorHidro(checked);
      publishTopic(`${deviceId}/ID/mt1`, checked ? 'ON' : 'OFF'); // matches precisely user path
    } else {
      setMotorFiltro(checked);
      publishTopic(`${deviceId}/ID/mt2`, checked ? 'ON' : 'OFF'); // matches precisely user path
    }
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
    publishTopic(`${deviceId}/ID/led/pg`, String(nextProg));
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
    publishTopic(`${deviceId}/ID/led/pg`, String(prevProg));
  };

  const handleProgramOff = () => {
    setCurrentProgram('---');
    publishTopic(`${deviceId}/ID/led/ctrl`, 'DESL');
  };

  const handleProgramSave = () => {
    publishTopic(`${deviceId}/ID/led/ctrl`, 'SALV');
    alert('Configuração de LED persistida em memória interna!');
  };

  // Save Timers
  const handleSaveFilter = () => {
    localStorage.setItem('filter_init', filterInit);
    localStorage.setItem('filter_hours', filterHours);

    const data = {
      start: filterInit,
      hours: filterHours,
      inicio: filterInit,
      horas: filterHours,
      duration: filterHours,
      duracao: filterHours,
      tempo: filterHours
    };
    
    // Publish JSON formats to normal and alternate topics
    publishTopic(`${deviceId}/ID/ft/cfg`, JSON.stringify(data));
    publishTopic(`${deviceId}/ft/cfg`, JSON.stringify(data));
    publishTopic(`${deviceId}/ID/ft`, JSON.stringify(data));
    publishTopic(`${deviceId}/ft`, JSON.stringify(data));

    // Publish individual keys to facilitate simpler parsers on MCU
    publishTopic(`${deviceId}/ID/ft/start`, filterInit);
    publishTopic(`${deviceId}/ft/start`, filterInit);
    publishTopic(`${deviceId}/ID/ft/inicio`, filterInit);
    publishTopic(`${deviceId}/ft/inicio`, filterInit);
    publishTopic(`${deviceId}/ID/ft/hours`, String(filterHours));
    publishTopic(`${deviceId}/ft/hours`, String(filterHours));
    publishTopic(`${deviceId}/ID/ft/horas`, String(filterHours));
    publishTopic(`${deviceId}/ID/ft/horas`, String(filterHours));
    publishTopic(`${deviceId}/ID/ft/duration`, String(filterHours));
    publishTopic(`${deviceId}/ID/ft/duration`, String(filterHours));
    publishTopic(`${deviceId}/ID/ft/duracao`, String(filterHours));
    publishTopic(`${deviceId}/ID/ft/duracao`, String(filterHours));

    alert(`Programação de filtragem enviada!\nInício: ${filterInit}\nDuração: ${filterHours} horas.`);
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
                  <img 
                    src="https://masterlazer.com.br/images/logoazul.png" 
                    alt="Master Lazer Logo" 
                    className="w-7 h-7 object-contain" 
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <h1 className="text-xs font-bold tracking-tight text-white m-0 leading-none">MASTER LAZER</h1>
                    <p className="text-[8px] text-orange-400 font-mono tracking-widest uppercase mt-0.5 leading-none">AUTO • MM12TW</p>
                  </div>
                </div>

                {/* Connection Status Indicator */}
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 shadow-sm">
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    mqttConnected 
                      ? 'bg-orange-500 animate-pulse' 
                      : mqttStatusMessage === 'Conectando...' 
                        ? 'bg-amber-400 animate-pulse' 
                        : 'bg-slate-400'
                  }`} />
                  <span className={`text-[9px] font-black tracking-wider uppercase ${
                    mqttConnected 
                      ? 'text-orange-400' 
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
                        ? 'text-orange-400 bg-white/12 shadow-inner border border-white/10' 
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
                        ? 'text-orange-400 bg-white/12 shadow-inner border border-white/10' 
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
                        ? 'text-orange-400 bg-white/12 shadow-inner border border-white/10' 
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
                        ? 'text-orange-400 bg-white/12 shadow-inner border border-white/10' 
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
                      className="w-full py-3 bg-gradient-to-r from-orange-600 to-orange-400 hover:brightness-110 disabled:bg-slate-800 text-white rounded-xl text-sm font-bold shadow-lg shadow-orange-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      {isLoadingAuth ? 'Verificando...' : 'Entrar'}
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    
                    <button
                      type="button"
                      onClick={handleResetPasswordSimulated}
                      className="w-full text-center text-xs text-slate-400 hover:text-orange-400 transition-all py-1"
                    >
                      Esqueci minha senha
                    </button>
                  </div>

                  <div className="text-center pt-4 border-t border-white/10">
                    <p className="text-xs text-slate-400">
                      Não tem cadastro?{' '}
                      <button
                        onClick={() => setActiveScreen('register')}
                        className="text-orange-400 hover:underline font-bold"
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
                    <div className="w-16 h-16 mx-auto mb-4 bg-orange-500/10 rounded-2xl flex items-center justify-center border border-orange-500/25 shadow-lg">
                      <User className="w-8 h-8 text-orange-400" />
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
                        className="text-orange-400 hover:underline font-bold"
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
                    {/* LED Status Indicator */}
                    <div className="p-3 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg ${currentProgram !== '---' ? 'bg-orange-500/10 border border-orange-500/20' : 'bg-white/5 border border-white/5'}`}>
                          <Flame className={`w-4 h-4 ${currentProgram !== '---' ? 'text-orange-400' : 'text-slate-500'}`} />
                        </div>
                        <div className="text-left">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">LED</p>
                          <p className="text-[11px] text-slate-300 font-semibold">
                            {currentProgram !== '---' ? `Programa: ${currentProgram}` : 'Sem Programa'}
                          </p>
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${currentProgram !== '---' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20 animate-pulse' : 'bg-white/5 text-slate-500 border border-white/5'}`}>
                        {currentProgram !== '---' ? 'LIGADO' : 'DESLIGADO'}
                      </span>
                    </div>

                    {/* Quick Status Block */}
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="p-3 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm">
                        <p className="text-[10px] text-slate-400 font-medium font-bold">MOTOR HIDRO</p>
                        <p className={`text-xs font-bold mt-1 ${motorHidro ? 'text-orange-400' : 'text-slate-500'}`}>
                          {motorHidro ? 'LIGADO' : 'DESLIGADO'}
                        </p>
                      </div>
                      <div className="p-3 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm">
                        <p className="text-[10px] text-slate-400 font-medium font-bold">MOTOR FILTRO</p>
                        <p className={`text-xs font-bold mt-1 ${motorFiltro ? 'text-cyan-400' : 'text-slate-500'}`}>
                          {motorFiltro ? 'LIGADO' : 'DESLIGADO'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <div className="grid grid-cols-2 gap-2 text-center">
                      {/* Connection Status Column */}
                      {mqttConnected ? (
                        <div className="p-3 bg-white/10 backdrop-blur-md border border-white/10 rounded-xl flex flex-col justify-center items-center shadow-md shadow-orange-500/5">
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
                    <h3 className="text-xs font-bold text-orange-400 tracking-wider uppercase mb-3 pb-1.5 border-b border-white/10 flex items-center gap-1">
                      <Sliders className="w-3.5 h-3.5" /> CONTROLE DE MOTORES
                    </h3>

                    <div className="space-y-4 my-2">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all ${motorHidro ? 'bg-orange-500/10 border-orange-500/20 text-orange-400' : 'bg-white/5 border-white/10 text-slate-400'}`}>
                            <Droplet className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white">Motor Hidromassagem</p>
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
                          <div className="w-10 h-6 bg-white/10 border border-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:height-4 after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500 peer-checked:border-orange-600 shadow-[0_0_10px_rgba(249,115,22,0)] peer-checked:shadow-[0_0_12px_rgba(249,115,22,0.4)]"></div>
                        </label>
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all ${motorFiltro ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' : 'bg-white/5 border-white/10 text-slate-400'}`}>
                            <FolderSync className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white">Motor Filtro Principal</p>
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
                          <div className="w-10 h-6 bg-white/10 border border-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:height-4 after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500 peer-checked:border-cyan-600 shadow-[0_0_10px_rgba(6,182,212,0)] peer-checked:shadow-[0_0_12px_rgba(6,182,212,0.4)]"></div>
                        </label>
                      </div>
                    </div>

                    {!mqttConnected && (
                      <p className="text-[10px] text-orange-400/90 leading-snug mt-3 flex items-start gap-1 bg-orange-500/10 p-2 rounded-xl border border-orange-500/25">
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
                      <input
                        type="range"
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
                      <span className="text-[12px] font-black text-orange-400 font-mono">
                        {currentProgram === '---' ? '---' : currentProgram}
                      </span>
                    </div>

                    {/* Led Buttons control action rail - side by side */}
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={handleProgramDec}
                        className="py-2 bg-[#007AFF] hover:bg-[#0066DD] text-white rounded-lg text-[11px] font-bold transition-all active:bg-emerald-500 active:scale-95 text-center"
                      >
                         Voltar
                      </button>
                      <button
                        onClick={handleProgramOff}
                        className="py-2 bg-[#007AFF] hover:bg-[#0066DD] text-white rounded-lg text-[11px] font-bold transition-all active:bg-emerald-500 active:scale-95 text-center"
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
                    <h3 className="text-xs font-bold text-orange-400 tracking-wider uppercase pb-1.5 border-b border-white/10 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> FILTRAGEM
                    </h3>

                    <div className="flex items-center justify-between py-1">
                      <label className="text-xs font-medium text-slate-300">Hora Inicial</label>
                      <input
                        type="time"
                        value={filterInit}
                        onChange={(e) => setFilterInit(e.target.value)}
                        className="bg-white/5 px-2 py-1 rounded-lg border border-white/10 text-orange-400 text-xs font-bold focus:outline-none focus:border-orange-500 focus:bg-white/10"
                      />
                    </div>

                    <div className="flex items-center justify-between py-1">
                      <label className="text-xs font-medium text-slate-300">Qtd Horas</label>
                      <select
                        value={filterHours}
                        onChange={(e) => setFilterHours(e.target.value)}
                        className="bg-white/5 hover:bg-white/10 px-2 py-1.5 rounded-lg border border-white/10 text-orange-400 text-xs font-bold focus:outline-none focus:border-orange-500 focus:bg-white/10"
                      >
                        {Array.from({ length: 25 }, (_, i) => String(i)).map(h => (
                          <option key={h} value={h} className="bg-slate-950 text-orange-400 font-bold">{h}h</option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={handleSaveFilter}
                      className="w-full py-2 bg-[#007AFF] hover:bg-[#0066DD] active:scale-95 text-xs text-white font-bold rounded-lg transition-all shadow-md shadow-[#007AFF]/20"
                    >
                      Salvar Filtro
                    </button>
                  </div>

                  {/* TIMER ILUMINAÇÃO Card */}
                  <div className="p-4 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl space-y-3">
                    <h3 className="text-xs font-bold text-orange-400 tracking-wider uppercase pb-1.5 border-b border-white/10 flex items-center gap-1">
                      <SlidersHorizontal className="w-3.5 h-3.5" /> TIMER ILUMINAÇÃO
                    </h3>

                    <div className="flex items-center justify-between py-1">
                      <label className="text-xs font-medium text-slate-300">Hora Inicial</label>
                      <select
                        value={ledStartHour}
                        onChange={(e) => setLedStartHour(e.target.value)}
                        className="bg-white/5 hover:bg-white/10 px-2 py-1.5 rounded-lg border border-white/10 text-orange-400 text-xs font-bold focus:outline-none"
                      >
                        {['18','19','20','21','22','23'].map(h => (
                          <option key={h} value={h} className="bg-slate-950 text-orange-400 font-bold">{h}h</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center justify-between py-1">
                      <label className="text-xs font-medium text-slate-300">Qtd Horas</label>
                      <select
                        value={ledDuration}
                        onChange={(e) => setLedDuration(e.target.value)}
                        className="bg-white/5 hover:bg-white/10 px-2 py-1.5 rounded-lg border border-white/10 text-orange-400 text-xs font-bold focus:outline-none"
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
                        className="bg-white/5 hover:bg-white/10 px-2 py-1.5 rounded-lg border border-white/10 text-orange-400 text-xs font-bold focus:outline-none"
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
                      className="w-full py-2 bg-[#007AFF] hover:bg-[#0066DD] active:scale-95 text-xs text-white font-bold rounded-lg transition-all shadow-md shadow-[#007AFF]/20"
                    >
                      Salvar Timer LED
                    </button>
                  </div>

                  {/* TIMER HIDRO Card */}
                  <div className="p-4 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl space-y-3">
                    <h3 className="text-xs font-bold text-orange-400 tracking-wider uppercase pb-1.5 border-b border-white/10 flex items-center gap-1">
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
                          className="bg-white/5 hover:bg-white/10 px-2 py-1.5 rounded-lg border border-white/10 text-orange-400 text-xs font-bold focus:outline-none"
                        >
                          <option value="off" className="bg-slate-950 text-slate-300 font-bold">Desligado</option>
                          {Array.from({ length: 23 }, (_, i) => i + 1).map(h => (
                            <option key={h} value={String(h)} className="bg-slate-950 text-orange-400 font-bold">{h} {h === 1 ? 'Hora' : 'Horas'}</option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2 bg-[#007AFF] hover:bg-[#0066DD] active:scale-95 text-xs text-white font-bold rounded-lg transition-all shadow-md shadow-[#007AFF]/20"
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
                            className="px-5 py-2.5 bg-gradient-to-r from-orange-600 to-orange-400 hover:brightness-110 active:scale-95 text-white text-xs font-bold rounded-xl shadow-lg shadow-orange-500/20 transition-all flex items-center gap-1.5"
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
                      <div className="w-10 h-10 bg-orange-500/10 rounded-full flex items-center justify-center border border-orange-500/20 shrink-0">
                        <Wifi className={`w-5 h-5 ${mqttConnected ? 'text-orange-400 animate-pulse' : 'text-slate-400'}`} />
                      </div>
                    </div>
                  </div>

                  {/* Device Sync Info Summary */}
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2 text-xs backdrop-blur-sm">
                    <div className="flex justify-between items-center pb-2 border-b border-white/10">
                      <span className="text-slate-300">Identificação (ID)</span>
                      <span className="font-mono font-bold text-orange-400">{deviceId || 'N/A'}</span>
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
                    <h3 className="text-xs font-extrabold text-orange-400 tracking-wider uppercase pb-1 border-b border-white/10 flex items-center justify-between">
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
                          className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-orange-500 focus:bg-white/10 transition-all"
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-300 font-bold block">Porta WebSocket</label>
                          <input
                            type="text"
                            value={mqttPort}
                            onChange={(e) => setMqttPort(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-orange-500 focus:bg-white/10 transition-all"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-300 font-bold block">ID Dispositivo (Prefixo)</label>
                          <input
                            type="text"
                            value={deviceId}
                            onChange={(e) => setDeviceId(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-orange-500 focus:bg-white/10 transition-all"
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
                            className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 focus:bg-white/10 transition-all"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-300 font-bold block">Senha (Opcional)</label>
                          <input
                            type="password"
                            placeholder="sem senha"
                            value={mqttPassword}
                            onChange={(e) => setMqttPassword(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 focus:bg-white/10 transition-all"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl space-y-3">
                    <h3 className="text-xs font-extrabold text-emerald-400 tracking-wider uppercase pb-1 border-b border-white/10 flex items-center justify-between">
                      <span>FIREBASE CREDENCIAIS</span>
                      <Tv className="w-3.5 h-3.5" />
                    </h3>
                    <p className="text-[10px] text-slate-350 leading-normal">
                      Insira sua chave de API e config para persistir e acionar a autenticação do seu próprio console Firebase.
                    </p>

                    <div className="space-y-2 text-xs">
                      <div className="space-y-0.5">
                        <label className="text-[9px] text-slate-400">API Key</label>
                        <input
                          type="text"
                          placeholder="AIzaSy..."
                          value={firebaseConfig.apiKey}
                          onChange={(e) => setFirebaseConfig({...firebaseConfig, apiKey: e.target.value})}
                          className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded text-xs text-white focus:outline-none focus:border-emerald-500 focus:bg-white/10 transition-all"
                        />
                      </div>
                      <div className="space-y-0.5">
                        <label className="text-[9px] text-slate-400">Project / Auth Domain</label>
                        <input
                          type="text"
                          placeholder="exemplo.firebaseapp.com"
                          value={firebaseConfig.authDomain}
                          onChange={(e) => setFirebaseConfig({...firebaseConfig, authDomain: e.target.value})}
                          className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded text-xs text-white focus:outline-none focus:border-emerald-500 focus:bg-white/10 transition-all"
                        />
                      </div>
                      <div className="space-y-0.5">
                        <label className="text-[9px] text-slate-400">Project ID</label>
                        <input
                          type="text"
                          placeholder="pool-tw12"
                          value={firebaseConfig.projectId}
                          onChange={(e) => setFirebaseConfig({...firebaseConfig, projectId: e.target.value})}
                          className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded text-xs text-white focus:outline-none focus:border-emerald-500 focus:bg-white/10 transition-all"
                        />
                      </div>
                      <div className="space-y-0.5">
                        <label className="text-[9px] text-slate-400">App ID</label>
                        <input
                          type="text"
                          placeholder="1:1234:web:1234..."
                          value={firebaseConfig.appId}
                          onChange={(e) => setFirebaseConfig({...firebaseConfig, appId: e.target.value})}
                          className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded text-xs text-white focus:outline-none focus:border-emerald-500 focus:bg-white/10 transition-all"
                        />
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
                      className="flex-1 py-2.5 bg-orange-500 text-white hover:bg-orange-600 text-xs font-bold rounded-xl shadow-lg shadow-orange-500/20 active:scale-95 transition-all"
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
