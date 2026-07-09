# 📚 DOCUMENTAÇÃO COMPLETA - SISTEMA CONTROLADOR DE PISCINA MM12TW

**Data**: 2026-07-09  
**Versão**: 1.0.0  
**Aplicação**: AI Studio App - Pool Controller  

---

## 📋 ÍNDICE

1. [Visão Geral da Arquitetura](#-visão-geral-da-arquitetura)
2. [Stack Tecnológico](#-stack-tecnológico)
3. [Estrutura de Pastas](#-estrutura-de-pastas)
4. [Telas/Módulos da Aplicação](#-telas--módulos-da-aplicação)
5. [Banco de Dados - Schema](#-banco-de-dados---schema)
6. [Serviços Backend](#-serviços-backend)
7. [Endpoints da API](#-endpoints-da-api)
8. [Protocolos MQTT](#-protocolos-mqtt-comunicação-iot)
9. [Fluxos de Comunicação](#-fluxos-de-comunicação)
10. [Autenticação e Autorização](#-autenticação-e-autorização)
11. [Funcionalidades Completas](#-funcionalidades-completas)
12. [Integrações Externas](#-integrações-externas)
13. [Variáveis de Ambiente](#-variáveis-de-ambiente)
14. [Guia de Uso](#-guia-de-uso)

---

## 🏗️ VISÃO GERAL DA ARQUITETURA

O sistema é uma **aplicação web de controle IoT para piscinas (pools)** desenvolvida com tecnologia moderna. Permite gerenciar dispositivos inteligentes (motores, iluminação LED, temporizadores) através de uma interface intuitiva e reativa.

### Características Principais:
- ✅ **Controle em tempo real** de motores, LEDs e temporizadores
- ✅ **Autenticação multiusuário** com papéis (proprietário/operador)
- ✅ **Comunicação MQTT** bidirecional com hardware IoT
- ✅ **Painéis de administração** para gestão de usuários e equipamentos
- ✅ **Progressive Web App (PWA)** - funciona offline
- ✅ **Responsivo** - funciona em desktop, tablet e mobile

### Arquitetura em Camadas:

```
┌─────────────────────────────────────┐
│     CAMADA DE APRESENTAÇÃO          │
│  React 19 + Next.js 15 + Tailwind   │
│  (Home, Aux, Led, Timers, Setup)    │
└────────────────┬────────────────────┘
                 │
┌────────────────▼────────────────────┐
│     CAMADA DE LÓGICA DE NEGÓCIO     │
│  Services (Auth, Device, Profile)   │
│  Hooks customizados                 │
│  Gerenciamento de estado (React)    │
└────────────────┬────────────────────┘
                 │
┌────────────────▼────────────────────┐
│     CAMADA DE COMUNICAÇÃO           │
│  MQTT (Paho Client)                 │
│  HTTP (Fetch API)                   │
│  Supabase (Real-time DB)            │
└────────────────┬────────────────────┘
                 │
┌────────────────▼────────────────────┐
│     CAMADA DE DADOS                 │
│  PostgreSQL (Supabase)              │
│  localStorage (Client)              │
│  MQTT Broker (test.mosquitto.org)   │
└─────────────────────────────────────┘
```

---

## 🛠️ STACK TECNOLÓGICO

### Frontend
| Tecnologia | Versão | Propósito |
|-----------|--------|----------|
| **Next.js** | 15.4.9 | Framework React com SSR |
| **React** | 19.2.1 | UI component library |
| **TypeScript** | 5.9.3 | Type safety |
| **Tailwind CSS** | 4.1.11 | Styling utilities |
| **Framer Motion** | 12.23.24 | Animações suaves |
| **Lucide React** | 0.553.0 | Ícones SVG |
| **html5-qrcode** | 2.3.8 | Scanner de QR code |

### Backend/Dados
| Tecnologia | Propósito |
|-----------|----------|
| **Supabase** | PostgreSQL + Auth + Real-time |
| **MQTT** | Comunicação IoT |
| **Paho MQTT** | Cliente WebSocket |

### DevTools
| Ferramenta | Versão | Propósito |
|-----------|--------|----------|
| **ESLint** | 9.39.1 | Linting |
| **Node.js** | Recomendado: 18+ | Runtime |
| **npm** | Latest | Gerenciador de pacotes |

---

## 📁 ESTRUTURA DE PASTAS

```
App-MM12TW-Master/
├── app/                           # Next.js app directory
│   ├── page.tsx                  # Main component (todas as telas)
│   ├── layout.tsx                # Root layout
│   ├── globals.css               # Estilos globais
│   └── api/
│       └── supabase-config/
│           └── route.ts          # Endpoint GET /api/supabase-config
├── services/                      # Backend services (Supabase operations)
│   ├── authService.ts            # Autenticação e sessão
│   ├── deviceService.ts          # Gerenciamento de dispositivos
│   ├── profileService.ts         # Perfis de usuários
│   └── settingsService.ts        # Configurações de dispositivos
├── lib/                           # Utilidades e configurações
│   ├── supabase.ts               # Cliente Supabase (lazy-loaded)
│   ├── supabaseSync.ts           # Sincronização com DB
│   └── utils.ts                  # Funções auxiliares
├── hooks/                         # React custom hooks
│   └── use-mobile.ts             # Detecção de device mobile
├── assets/                        # Recursos estáticos
│   └── .aistudio/                # Configuração AI Studio
├── public/                        # Arquivos estáticos
│   ├── manifest.json             # PWA manifest
│   ├── sw.js                     # Service Worker
│   └── logo.png                  # Logo Master Lazer
├── package.json                  # Dependências e scripts
├── next.config.ts                # Configuração Next.js
├── tsconfig.json                 # Configuração TypeScript
├── eslint.config.mjs             # Configuração ESLint
└── postcss.config.mjs            # Configuração PostCSS
```

---

## 📱 TELAS / MÓDULOS DA APLICAÇÃO

A aplicação possui **8 telas principais**, gerenciadas por um componente central (`page.tsx`).

### 1️⃣ TELA DE LOGIN (`activeScreen: 'login'`)

**Propósito**: Autenticação de usuários

**Componentes**:
- Campo de email
- Campo de senha
- Botão "Entrar"
- Link para Registro
- Modo Demo (sem autenticação)

**Funcionalidades**:
- Validação de credenciais via Supabase Auth
- Detecção automática de sessão ativa
- Fallback para demo mode se Supabase não configurado
- Mensagens de erro descritivas

**Data Flow**:
```
Usuário → Email + Senha → signInWithPassword()
→ Supabase Auth → Session token → currentUser state
```

---

### 2️⃣ TELA DE REGISTRO (`activeScreen: 'register'`)

**Propósito**: Criar novos usuários

**Campos**:
- Email
- Senha
- Nome completo
- Papel (owner/operator)

**Funcionalidades**:
- Criação de conta com Supabase Auth
- Atribuição de papel
- Confirmação por email
- Validação de dados

**Data Flow**:
```
Usuário → Dados → signUp() → Supabase
→ Email de confirmação → Perfil criado
```

---

### 3️⃣ TELA HOME (`activeScreen: 'home'`)

**Propósito**: Dashboard principal com status dos equipamentos

**Layout**:
```
┌─────────────────────────────────┐
│  Logo Master Lazer              │
│  Status: [Online/Offline]       │
├─────────────────────────────────┤
│  Device: MM12TW-000123          │
│  Owner: João Silva              │
├─────────────────────────────────┤
│  ⚡ ATALHOS RÁPIDOS             │
│  [MT1 ON/OFF]  [MT2 ON/OFF]    │
│  [MT3 ON/OFF]  [MT4 ON/OFF]    │
│  [LED ON/OFF]  [LED CORES]     │
├─────────────────────────────────┤
│  TEMPERATURA:                   │
│  🌡️ Coletor: 45°C | Pool: 28°C │
│  ⚠️ Erros: Solar, Flow          │
├─────────────────────────────────┤
│  MENU LATERAL:                  │
│  [Aux]  [Led]  [Timers]        │
│  [Setup] [Admin] [Logout]      │
└─────────────────────────────────┘
```

**Widgets**:
- **Device Info**: Exibe ID, modelo, proprietário
- **Status Online**: Indicador de conexão MQTT
- **Motor Quick-Toggle**: Botões para ligar/desligar motores
- **LED Quick-Start**: Iniciação rápida de LED
- **Sensor Display**: Temperatura coletor + piscina
- **Error Alerts**: Avisos de erros do sistema

**MQTT Subscriptions**:
```
MASTERLAZER/{deviceId}/mt{1-4}/state
MASTERLAZER/{deviceId}/pwm/{r|g|b}
MASTERLAZER/{deviceId}/led/state
{deviceId}/status
```

---

### 4️⃣ TELA AUX (`activeScreen: 'aux'`)

**Propósito**: Controle detalhado de motores

**Funcionalidades**:
- Controle on/off de 4 motores (MT1-MT4)
- Nomeação customizável de motores
- Simulação de erros de sensor/fluxo
- Histórico de comandos

**Layout**:
```
┌─────────────────────────────────┐
│  CONTROLE DE MOTORES            │
├─────────────────────────────────┤
│  MT1: Hydromassagem             │
│  Nome: [_______________]  ✏️    │
│  [ON]  [OFF]  Status: OFF       │
├─────────────────────────────────┤
│  MT2: Filtração                 │
│  Nome: [_______________]  ✏️    │
│  [ON]  [OFF]  Status: ON        │
├─────────────────────────────────┤
│  MT3: (Customizável)            │
│  Nome: [_______________]  ✏️    │
│  [ON]  [OFF]  Status: OFF       │
├─────────────────────────────────┤
│  MT4: (Customizável)            │
│  Nome: [_______________]  ✏️    │
│  [ON]  [OFF]  Status: OFF       │
├─────────────────────────────────┤
│  ⚠️ SIMULADOR DE ERROS          │
│  [☐] Erro de Sensor             │
│  [☐] Erro de Fluxo              │
└─────────────────────────────────┘
```

**Dados Persistidos**: localStorage
```javascript
{
  motor1_name: "Hydromassagem",
  motor2_name: "Filtração",
  motor3_name: "Custom",
  motor4_name: "Custom"
}
```

---

### 5️⃣ TELA LED (`activeScreen: 'led'`)

**Propósito**: Controle avançado de iluminação LED com cores e programas

**Componentes**:
- **Color Picker (HSV)**: Seletor visual de cores
- **Program Selector**: Escolha de programas (0-N)
- **Brightness Multiplier**: 0-100%
- **Saturation Multiplier**: 0-100%
- **Real-time RGB Feedback**: Mostra cores atual do hardware

**Layout**:
```
┌─────────────────────────────────┐
│  CONTROLE LED AVANÇADO          │
├─────────────────────────────────┤
│  Status: ON                     │
│  [ON] [OFF] [INC] [DEC] [SAVE] │
├─────────────────────────────────┤
│  SELETOR DE COR (HSV):          │
│  ┌───────────────────────────┐  │
│  │                           │  │
│  │   [Interactive Picker]    │  │
│  │   (iro.js)                │  │
│  │                           │  │
│  └───────────────────────────┘  │
│  Cor Atual: #FF5733            │
├─────────────────────────────────┤
│  PROGRAMA:                      │
│  Programa: [________] (0-N)     │
│  Descrição: Arco-Íris Dinâmico  │
├─────────────────────────────────┤
│  MULTIPLICADORES:               │
│  Brilho: |████████__| 80%       │
│  Saturação: |██████____| 60%    │
├─────────────────────────────────┤
│  FEEDBACK DO HARDWARE:          │
│  R: [████████__] 200            │
│  G: [███████___] 180            │
│  B: [█████_____] 150            │
└─────────────────────────────────┘
```

**MQTT Operations**:
```
PUBLISH: MASTERLAZER/{deviceId}/pwm/r → "200"
PUBLISH: MASTERLAZER/{deviceId}/pwm/g → "180"
PUBLISH: MASTERLAZER/{deviceId}/pwm/b → "150"
PUBLISH: MASTERLAZER/{deviceId}/led/pg → "5"
PUBLISH: MASTERLAZER/{deviceId}/led/ctrl → "ON"

SUBSCRIBE: MASTERLAZER/{deviceId}/pwm/{r|g|b}
```

**Otimização**: Throttle de 120ms entre publicações de cor

---

### 6️⃣ TELA TIMERS (`activeScreen: 'timers'`)

**Propósito**: Configurar automações e temporizadores

**Sub-seções**:

#### A) Filtration Timer (FT)
Duas programações independentes (t1, t2)

```
┌─────────────────────────────────┐
│  TIMER DE FILTRAÇÃO             │
├─────────────────────────────────┤
│  TIMER 1                        │
│  Início: [HH] (ex: 08)          │
│  Duração: [___] horas           │
│  Dias: [Seg][Ter][Qua][Qui][Sex]│
│        [Sab][Dom]               │
│  [Salvar]                       │
├─────────────────────────────────┤
│  TIMER 2                        │
│  Início: [HH] (ex: 14)          │
│  Duração: [___] horas           │
│  Dias: [Seg][Ter][Qua][Qui][Sex]│
│        [Sab][Dom]               │
│  [Salvar]                       │
└─────────────────────────────────┘
```

**Data Format**:
```javascript
{
  filter_init1: "08",           // Hora início (HH ou "D" = disabled)
  filter_hours1: "4",           // Duração em horas
  filter_init2: "14",
  filter_hours2: "6",
  filter_days: "1111111"        // Binary: 1=ativo, 0=inativo
}
```

**MQTT Topics**:
```
MASTERLAZER/{deviceId}/ft/cfg
MASTERLAZER/{deviceId}/ft/t1/start → "08"
MASTERLAZER/{deviceId}/ft/t1/hours → "4"
MASTERLAZER/{deviceId}/ft/t2/start → "14"
MASTERLAZER/{deviceId}/ft/t2/hours → "6"
MASTERLAZER/{deviceId}/ft/days/binary → "1111111"
MASTERLAZER/{deviceId}/ft/days/str → "Mon,Tue,Wed,..."
```

#### B) LED Timer
Agenda para ativação automática de LED

```
┌─────────────────────────────────┐
│  TIMER LED                      │
├─────────────────────────────────┤
│  Início: [HH]:[MM]              │
│  Duração: [___] horas           │
│  Programa: [________] (0-N)     │
│  [Salvar]                       │
└─────────────────────────────────┘
```

**Data Format**:
```javascript
{
  led_start_hour: "19",
  led_start_minute: "30",
  led_duration: "8",
  led_program: "3"
}
```

**MQTT Topics**:
```
MASTERLAZER/{deviceId}/led/tmr/start → "19:30"
MASTERLAZER/{deviceId}/led/tmr/hours → "8"
MASTERLAZER/{deviceId}/led/tmr/program → "3"
```

#### C) Hydro/Motor1 Timer
Timer para motor de hidromassagem

```
┌─────────────────────────────────┐
│  TIMER HYDRO (MT1)              │
├─────────────────────────────────┤
│  [☑] Ativar Timer               │
│  Duração: [___] horas           │
│  [Salvar]                       │
└─────────────────────────────────┘
```

**Data Format**:
```javascript
{
  hidro_timer_enabled: true,
  hidro_timer_hours: "2"
}
```

**MQTT Topics**:
```
MASTERLAZER/{deviceId}/hidro/tmr/active → "true"
MASTERLAZER/{deviceId}/hidro/tmr/hours → "2"
```

---

### 7️⃣ TELA SETUP (`activeScreen: 'setup'`)

**Propósito**: Configuração de conexão MQTT e dispositivos

**Funcionalidades**:
- Configuração de broker MQTT
- QR code scanner para registrar dispositivos
- Gerenciamento de credenciais MQTT
- Visualização de informações do dispositivo

**Layout**:
```
┌─────────────────────────────────┐
│  CONFIGURAÇÃO DO SISTEMA        │
├─────────────────────────────────┤
│  MQTT BROKER                    │
│  Host: [________________]       │
│  Porta: [________]              │
│  Usuário: [________________]    │
│  Senha: [________________]      │
│  Status: Connected ✅           │
│  [Reconectar]                   │
├─────────────────────────────────┤
│  DEVICE ID:                     │
│  ID: MM12TW-000123              │
│  [Alterar]                      │
├─────────────────────────────────┤
│  REGISTRO DE DISPOSITIVO        │
│  [📱 Escanear QR]               │
│  ou                             │
│  Manual ID: [________________]  │
│  Modelo: [MM12TW/MM03TW/MM08]  │
│  [Registrar]                    │
├─────────────────────────────────┤
│  INFO DO DEVICE                 │
│  IP: 192.168.1.100              │
│  MAC: 7C:9E:BD:1A:XX:XX         │
│  Modelo: MM12TW                 │
│  Serial: ABC123XYZ              │
└─────────────────────────────────┘
```

**Dados Persistidos**:
```javascript
localStorage: {
  mqtt_broker: "test.mosquitto.org",
  mqtt_port: "8081",
  mqtt_device: "MM12TW-000123",
  mqtt_user: "",
  mqtt_pass: ""
}
```

---

### 8️⃣ TELA ADMIN (`activeScreen: 'admin'`)

**Propósito**: Gerenciamento de usuários, dispositivos e auditoria

**Acesso**: Apenas para usuários com papel `owner`

**Abas**:

#### ABA 1: Home Admin
Visão geral e estatísticas

```
┌─────────────────────────────────┐
│  DASHBOARD ADMINISTRATIVO       │
├─────────────────────────────────┤
│  Total Usuários: 15             │
│  Total Dispositivos: 23         │
│  Online Agora: 18               │
│  Última Atividade: 2 min atrás  │
└─────────────────────────────────┘
```

#### ABA 2: Gerenciar Usuários
CRUD de usuários

```
┌─────────────────────────────────┐
│  GERENCIAR USUÁRIOS             │
├─────────────────────────────────┤
│  [+ Novo Usuário]               │
│  Buscar: [________________]      │
├─────────────────────────────────┤
│  Email              │ Role   │ ... │
│  joao@email.com     │ owner  │ ✏️ 🗑 │
│  maria@email.com    │ operator│ ✏️ 🗑 │
│  pedro@email.com    │ operator│ ✏️ 🗑 │
└─────────────────────────────────┘
```

**Operações**:
- Criar usuário (email, senha, nome, papel)
- Editar usuário (nome, papel)
- Deletar usuário (com confirmação)
- Alterar papel (owner ↔ operator)

**Services**:
```typescript
fetchAllProfiles()           // Listar todos
updateProfileRole(id, role)  // Alterar papel
deleteProfile(id)            // Deletar
```

#### ABA 3: Inventário de Equipamento
Gerenciar dispositivos

```
┌─────────────────────────────────┐
│  INVENTÁRIO DE EQUIPAMENTOS     │
├─────────────────────────────────┤
│  [+ Novo Dispositivo]           │
│  Buscar: [________________]      │
├─────────────────────────────────┤
│  Device ID          │ Modelo │ Owner │
│  MM12TW-000123      │ MM12TW │ João  │
│  MM12TW-000456      │ MM12TW │ Maria │
│  MM03TW-000789      │ MM03TW │ Pedro │
└─────────────────────────────────┘
```

**Operações**:
- Transferir propriedade (reassign owner)
- Deletar dispositivo
- Ver detalhes

**Services**:
```typescript
fetchUserDevices(userId)
registerDevice(id, model, userId, token)
deleteDevice(deviceId)
updateDeviceOwner(deviceId, userId)
```

#### ABA 4: Telemetria e Logs
Auditoria e análise

```
┌─────────────────────────────────┐
│  TELEMETRIA E LOGS              │
├─────────────────────────────────┤
│  BUSCAR TELEMETRIA:             │
│  Device ID: [MM12TW-000123___]  │
│  [Buscar]                       │
│  ────────────────────────────   │
│  Programa LED mais usado:       │
│    Arco-Íris Dinâmico           │
│  Tempo filtração máx:  10h      │
│  Tempo filtração mín:   2h      │
│  Uso hidro timer:     180 min   │
│  Localização (GPS):             │
│    Latitude:  -23.5505          │
│    Longitude: -46.6333          │
├─────────────────────────────────┤
│  LOGS DE AÇÕES DO USUÁRIO       │
│  [Limpar Logs]                  │
│  ────────────────────────────   │
│  2026-07-09 14:32:15            │
│  joao@email.com - LED ON        │
│  Device: MM12TW-000123          │
│                                 │
│  2026-07-09 14:15:42            │
│  maria@email.com - MT1 OFF      │
│  Device: MM12TW-000123          │
└─────────────────────────────────┘
```

**Dados de Telemetria**:
```javascript
{
  [deviceId]: {
    mostUsedLedProgram: "Arco-Íris Dinâmico",
    maxFilteringTime: 10,      // horas
    minFilteringTime: 2,       // horas
    hydroTimerUsageMinutes: 180,
    latitude: -23.5505,
    longitude: -46.6333
  }
}
```

---

## 🗄️ BANCO DE DADOS - SCHEMA

### PostgreSQL via Supabase

#### Tabela: `profiles`
Armazena informações de usuários

```sql
CREATE TABLE profiles (
  id              UUID PRIMARY KEY (DEFAULT auth.uid()),
  email           VARCHAR(255) UNIQUE NOT NULL,
  full_name       VARCHAR(255),
  role            VARCHAR(50) CHECK (role IN ('owner', 'operator')),
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Campos**:
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | ID do usuário (sincronizado com auth) |
| `email` | VARCHAR | Email único |
| `full_name` | VARCHAR | Nome completo |
| `role` | VARCHAR | 'owner' ou 'operator' |
| `created_at` | TIMESTAMP | Data de criação |
| `updated_at` | TIMESTAMP | Última atualização |

**Índices**:
```sql
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_role ON profiles(role);
```

---

#### Tabela: `devices`
Equipamentos gerenciados

```sql
CREATE TABLE devices (
  id                VARCHAR(50) PRIMARY KEY,
  model             VARCHAR(50) NOT NULL,
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pairing_token     VARCHAR(255),
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Campos**:
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | VARCHAR | ID do dispositivo (ex: MM12TW-000123) |
| `model` | VARCHAR | Modelo (MM12TW, MM03TW, MM08TSW) |
| `user_id` | UUID | Proprietário (FK → profiles) |
| `pairing_token` | VARCHAR | Token de emparelhamento |
| `created_at` | TIMESTAMP | Data de registro |
| `updated_at` | TIMESTAMP | Última atualização |

**Índices**:
```sql
CREATE INDEX idx_devices_user_id ON devices(user_id);
CREATE INDEX idx_devices_model ON devices(model);
```

---

#### Tabela: `device_settings`
Configurações específicas de cada dispositivo

```sql
CREATE TABLE device_settings (
  id              SERIAL PRIMARY KEY,
  device_id       VARCHAR(50) NOT NULL UNIQUE REFERENCES devices(id) ON DELETE CASCADE,
  motor1_name     VARCHAR(100) DEFAULT 'Hydromassagem',
  motor2_name     VARCHAR(100) DEFAULT 'Filtração',
  motor3_name     VARCHAR(100),
  motor4_name     VARCHAR(100),
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Campos**:
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `device_id` | VARCHAR | Referência ao dispositivo |
| `motor1_name` | VARCHAR | Nome customizável do motor 1 |
| `motor2_name` | VARCHAR | Nome customizável do motor 2 |
| `motor3_name` | VARCHAR | Nome customizável do motor 3 |
| `motor4_name` | VARCHAR | Nome customizável do motor 4 |

---

### localStorage - Dados do Cliente

Armazena configurações e preferências locais:

```javascript
// MQTT Configuration
localStorage.mqtt_broker        // "test.mosquitto.org"
localStorage.mqtt_port          // "8081"
localStorage.mqtt_device        // "MM12TW-000123"
localStorage.mqtt_user          // Username (if auth required)
localStorage.mqtt_pass          // Password (if auth required)

// Filtration Timer
localStorage.filter_init1       // "08" (hora)
localStorage.filter_hours1      // "4"
localStorage.filter_init2       // "14"
localStorage.filter_hours2      // "6"
localStorage.filter_days        // "1111111" (binary)

// LED Timer
localStorage.led_start_hour     // "19"
localStorage.led_start_minute   // "30"
localStorage.led_duration       // "8"
localStorage.led_program        // "3"

// Hydro Timer
localStorage.hidro_timer_enabled // "true"
localStorage.hidro_timer_hours   // "2"

// Telemetry
localStorage.device_telemetry_map // JSON stringified map

// Demo Mode
localStorage.sim_user           // Email para modo demo

// Manual Supabase Override
localStorage.local_supabase_url       // URL customizada
localStorage.local_supabase_key       // Chave customizada
```

---

## 🔧 SERVIÇOS BACKEND

### 1. authService.ts
Gerencia autenticação e sessões

```typescript
import { supabase } from '../lib/supabase';

// Login com email e senha
export async function signInWithPassword(
  email: string,
  password: string
): Promise<AuthResponse> {
  return await supabase.auth.signInWithPassword({ email, password });
}
// Retorna: { data: { session }, error }
```

**Exemplo de Uso**:
```typescript
const { data, error } = await signInWithPassword('user@example.com', 'password123');
if (error) {
  console.error('Login failed:', error.message);
} else {
  setCurrentUser(data.session.user);
}
```

---

```typescript
// Registrar novo usuário
export async function signUp(
  email: string,
  password: string,
  fullName: string,
  role: 'owner' | 'operator'
): Promise<AuthResponse> {
  return await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role: role,
      },
    },
  });
}
// Envia email de confirmação
```

**Exemplo de Uso**:
```typescript
const { data, error } = await signUp(
  'newuser@example.com',
  'securePass123!',
  'João Silva',
  'operator'
);
```

---

```typescript
// Logout (destruir sessão)
export async function signOut(): Promise<void> {
  return await supabase.auth.signOut();
}
```

---

```typescript
// Obter sessão atual
export async function getSession(): Promise<Session | null> {
  const { data: { session }, error } = await supabase.auth.getSession();
  return session;
}
```

---

```typescript
// Ouvir mudanças de autenticação
export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void
) {
  return supabase.auth.onAuthStateChange(callback);
}
// Eventos: 'SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED'
```

---

### 2. deviceService.ts
Gerencia dispositivos IoT

```typescript
interface SupabaseDevice {
  id: string;              // MM12TW-000123
  model: string;           // MM12TW
  user_id: string;         // UUID
  pairing_token?: string;  // TOKEN-ABC123
}

// Buscar todos os dispositivos do usuário
export async function fetchUserDevices(
  userId: string
): Promise<SupabaseDevice[]> {
  const { data, error } = await supabase
    .from('devices')
    .select('*')
    .eq('user_id', userId);
  
  if (error) {
    console.error('[DeviceService] Error:', error.message);
    return [];
  }
  return data || [];
}
```

**Exemplo de Uso**:
```typescript
const devices = await fetchUserDevices(user.id);
console.log(devices);
// [
//   { id: 'MM12TW-000123', model: 'MM12TW', user_id: '...', pairing_token: 'TOKEN-ABC123' },
//   { id: 'MM12TW-000456', model: 'MM12TW', user_id: '...', pairing_token: 'TOKEN-DEF456' }
// ]
```

---

```typescript
// Registrar novo dispositivo
export async function registerDevice(
  deviceId: string,
  model: string,
  userId: string,
  pairingToken: string = ''
): Promise<SupabaseDevice | null> {
  const { data, error } = await supabase
    .from('devices')
    .upsert({
      id: deviceId,
      model: model,
      pairing_token: pairingToken || 'TOKEN-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      user_id: userId,
    })
    .select()
    .single();
  
  if (error) {
    console.error('[DeviceService] Error:', error.message);
    return null;
  }
  return data;
}
```

**Exemplo de Uso**:
```typescript
const device = await registerDevice(
  'MM12TW-000123',
  'MM12TW',
  userId,
  'TOKEN-ABC123'
);
// Retorna: { id: 'MM12TW-000123', model: 'MM12TW', user_id: '...', pairing_token: 'TOKEN-ABC123' }
```

---

```typescript
// Deletar dispositivo
export async function deleteDevice(deviceId: string): Promise<boolean> {
  const { error } = await supabase
    .from('devices')
    .delete()
    .eq('id', deviceId);
  
  if (error) {
    console.error('[DeviceService] Error:', error.message);
    return false;
  }
  return true;
}
```

---

```typescript
// Transferir propriedade de dispositivo
export async function updateDeviceOwner(
  deviceId: string,
  userId: string
): Promise<SupabaseDevice | null> {
  const { data, error } = await supabase
    .from('devices')
    .update({ user_id: userId })
    .eq('id', deviceId)
    .select()
    .single();
  
  if (error) {
    console.error('[DeviceService] Error:', error.message);
    return null;
  }
  return data;
}
```

---

### 3. profileService.ts
Gerencia perfis de usuários

```typescript
interface SupabaseProfile {
  id: string;          // UUID
  email: string;       // Email único
  full_name: string;   // Nome completo
  role: string;        // 'owner' | 'operator'
}

// Buscar um perfil por ID
export async function fetchProfile(userId: string): Promise<SupabaseProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('id', userId)
    .maybeSingle();
  
  if (error) {
    console.error('[ProfileService] Error:', error.message);
    return null;
  }
  return data;
}
```

---

```typescript
// Atualizar perfil (nome)
export async function updateProfile(
  userId: string,
  fullName: string
): Promise<SupabaseProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ full_name: fullName })
    .eq('id', userId)
    .select()
    .single();
  
  if (error) {
    console.error('[ProfileService] Error:', error.message);
    return null;
  }
  return data;
}
```

---

```typescript
// Listar todos os perfis (admin only)
export async function fetchAllProfiles(): Promise<SupabaseProfile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role');
  
  if (error) {
    console.error('[ProfileService] Error:', error.message);
    return [];
  }
  return data || [];
}
```

---

```typescript
// Alterar papel de um usuário
export async function updateProfileRole(
  userId: string,
  role: 'owner' | 'operator'
): Promise<SupabaseProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId)
    .select()
    .single();
  
  if (error) {
    console.error('[ProfileService] Error:', error.message);
    return null;
  }
  return data;
}
```

---

```typescript
// Deletar um perfil (admin only)
export async function deleteProfile(userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('id', userId);
  
  if (error) {
    console.error('[ProfileService] Error:', error.message);
    return false;
  }
  return true;
}
```

---

### 4. settingsService.ts
Gerencia configurações de dispositivos

```typescript
interface SupabaseDeviceSettings {
  device_id: string;
  motor1_name?: string;
  motor2_name?: string;
  motor3_name?: string;
  motor4_name?: string;
}

// Buscar configurações de um dispositivo
export async function fetchDeviceSettings(
  deviceId: string
): Promise<SupabaseDeviceSettings | null> {
  const { data, error } = await supabase
    .from('device_settings')
    .select('*')
    .eq('device_id', deviceId)
    .maybeSingle();
  
  if (error) {
    console.error('[SettingsService] Error:', error.message);
    return null;
  }
  return data;
}
```

---

```typescript
// Salvar/atualizar configurações
export async function saveDeviceSettings(
  deviceId: string,
  settings: {
    motor1_name?: string;
    motor2_name?: string;
    motor3_name?: string;
    motor4_name?: string;
  }
): Promise<SupabaseDeviceSettings | null> {
  const { data, error } = await supabase
    .from('device_settings')
    .upsert({
      device_id: deviceId,
      ...settings,
    })
    .select()
    .single();
  
  if (error) {
    console.error('[SettingsService] Error:', error.message);
    return null;
  }
  return data;
}
```

**Exemplo de Uso**:
```typescript
await saveDeviceSettings('MM12TW-000123', {
  motor1_name: 'Hidromassagem Premium',
  motor2_name: 'Bomba de Filtração',
  motor3_name: 'Aquecedor',
  motor4_name: 'Circulação'
});
```

---

## 🌐 ENDPOINTS DA API

### GET `/api/supabase-config`

**Propósito**: Fornecer credenciais do Supabase ao cliente em runtime

**Método**: GET  
**Autenticação**: Nenhuma (Public)  
**Rate Limiting**: Nenhum  

**Request**:
```bash
curl -X GET http://localhost:3000/api/supabase-config
```

**Response (200 OK)**:
```json
{
  "supabaseUrl": "https://bjkjyaejzlatdclpcdjs.supabase.co",
  "supabaseAnonKey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (Fallback - se config inválida)**:
```json
{
  "supabaseUrl": "https://bjkjyaejzlatdclpcdjs.supabase.co",
  "supabaseAnonKey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Validações**:
- Verifica se `NEXT_PUBLIC_SUPABASE_URL` é válida
- Verifica se `NEXT_PUBLIC_SUPABASE_ANON_KEY` é um JWT válido (starts with `eyJ`, 3 parts)
- Retorna defaults se falhar validação

**Exemplo de Uso no Frontend**:
```typescript
const response = await fetch('/api/supabase-config');
const { supabaseUrl, supabaseAnonKey } = await response.json();
configureSupabase(supabaseUrl, supabaseAnonKey);
```

---

## 📡 PROTOCOLOS MQTT - COMUNICAÇÃO IOT

### Configuração MQTT

**Broker**: `test.mosquitto.org`  
**Port**: `8081` (WebSocket Secure - wss://)  
**Protocol**: MQTT v3.1.1  
**Client Library**: Paho MQTT JavaScript  

### Estratégia de Publicação

O sistema utiliza **dual-publish** para máxima compatibilidade:

```
Cada comando é publicado em 2 tópicos:
1. MASTERLAZER/{deviceId}/...   (formato padrão)
2. {deviceId}/...                (fallback simples)
```

---

### TÓPICOS MQTT COMPLETOS

#### 🔴 CONTROLE DE MOTORES (MT1-MT4)

**Comando (Publish)**:
```
Tópico: MASTERLAZER/{deviceId}/mt{1-4}
Payload: ON | OFF | 1 | 0

Exemplos:
MASTERLAZER/MM12TW-000123/mt1        → "ON"
MASTERLAZER/MM12TW-000123/mt2        → "OFF"
MASTERLAZER/MM12TW-000123/mt3        → "1"
MASTERLAZER/MM12TW-000123/mt4        → "0"

Fallback:
MM12TW-000123/mt1                    → "ON"
```

**Feedback (Subscribe)**:
```
Tópico: MASTERLAZER/{deviceId}/mt{1-4}/state
Payload: ON | OFF | LIG | 1 | 0

Exemplos:
MASTERLAZER/MM12TW-000123/mt1/state  → "LIG" (ligado)
MASTERLAZER/MM12TW-000123/mt2/state  → "OFF" (desligado)

Fallback:
MM12TW-000123/mt1/state              → "ON"
```

---

#### 🟡 CONTROLE LED

**Comando - Controle Básico (Publish)**:
```
Tópico: MASTERLAZER/{deviceId}/led/ctrl
Payload: ON | OFF | INC | DEC | SAVE | DESL

ON    = Ligar LED
OFF   = Desligar LED
INC   = Aumentar brilho
DEC   = Diminuir brilho
SAVE  = Salvar configuração
DESL  = Desligar (alias OFF)

Exemplos:
MASTERLAZER/MM12TW-000123/led/ctrl   → "ON"
MASTERLAZER/MM12TW-000123/led/ctrl   → "INC"
```

**Seleção de Programa (Publish)**:
```
Tópico: MASTERLAZER/{deviceId}/led/pg
Payload: 0-N (número do programa)

Exemplos:
MASTERLAZER/MM12TW-000123/led/pg     → "0"  (Arco-Íris)
MASTERLAZER/MM12TW-000123/led/pg     → "5"  (Festa)

Fallback:
MM12TW-000123/led/cmd                → "PROG:3"
```

**Feedback (Subscribe)**:
```
Tópico: MASTERLAZER/{deviceId}/led/state
Payload: ON | OFF | LIG

Exemplos:
MASTERLAZER/MM12TW-000123/led/state  → "LIG"
MASTERLAZER/MM12TW-000123/led/state  → "OFF"
```

---

#### 🟣 CORES LED (RGB/PWM)

**Publicar Cores (Publish)**:
```
Tópico: MASTERLAZER/{deviceId}/pwm/{r|g|b}
Payload: 0-255

Exemplos:
MASTERLAZER/MM12TW-000123/pwm/r      → "255"  (Vermelho máximo)
MASTERLAZER/MM12TW-000123/pwm/g      → "128"  (Verde 50%)
MASTERLAZER/MM12TW-000123/pwm/b      → "0"    (Azul desligado)

Fallback:
MM12TW-000123/pwm/r                  → "255"
MM12TW-000123/pwm/g                  → "128"
MM12TW-000123/pwm/b                  → "0"

Throttling: Máximo 120ms entre publicações
```

**Receber Cores (Subscribe)**:
```
Tópico: MASTERLAZER/{deviceId}/pwm/{r|g|b}
Payload: 0-255

Feedback:
MASTERLAZER/MM12TW-000123/pwm/r      → "200"
MASTERLAZER/MM12TW-000123/pwm/g      → "180"
MASTERLAZER/MM12TW-000123/pwm/b      → "150"
```

---

#### 🟢 TIMER DE FILTRAÇÃO (FT)

**Configuração Completa (Publish)**:
```
Tópico: MASTERLAZER/{deviceId}/ft/cfg
Payload: JSON
{
  "t1_start": "08",      // Hora de início (HH ou "D" = disabled)
  "t1_hours": "4",       // Duração em horas
  "t2_start": "14",      // Segundo timer
  "t2_hours": "6",
  "days": "1111111"      // Bits: 1=ativo, 0=inativo
}

Exemplo:
{
  "t1_start": "08",
  "t1_hours": "4",
  "t2_start": "14",
  "t2_hours": "6",
  "days": "1111111"
}
```

**Configuração Individual (Publish)**:
```
MASTERLAZER/{deviceId}/ft/t1/start    → "08"
MASTERLAZER/{deviceId}/ft/t1/hours    → "4"
MASTERLAZER/{deviceId}/ft/t2/start    → "14"
MASTERLAZER/{deviceId}/ft/t2/hours    → "6"
MASTERLAZER/{deviceId}/ft/days/binary → "1111111"
MASTERLAZER/{deviceId}/ft/days/str    → "Mon,Tue,Wed,Thu,Fri,Sat,Sun"

Fallback:
MM12TW-000123/ft/t1/start             → "08"
MM12TW-000123/ft/t2/hours             → "6"
```

**Formato de Dias**:
```
Binary (1 bit por dia):
"1111111" = Segunda a domingo ativados
"1111100" = Seg-Sex (sábado/domingo desativados)
"0100000" = Apenas segunda

String:
"Mon,Tue,Wed,Thu,Fri,Sat,Sun"
"Mon,Tue,Wed"
```

---

#### 🔵 TIMER LED (led/tmr)

**Configuração Completa (Publish)**:
```
Tópico: MASTERLAZER/{deviceId}/led/tmr/cfg
Payload: JSON
{
  "start": "19:30",      // HH:MM
  "hours": "8",          // Duração
  "program": "3"         // Número do programa
}
```

**Configuração Individual (Publish)**:
```
MASTERLAZER/{deviceId}/led/tmr/start     → "19:30"
MASTERLAZER/{deviceId}/led/tmr/hours     → "8"
MASTERLAZER/{deviceId}/led/tmr/program   → "3"
MASTERLAZER/{deviceId}/led/tmr/prog      → "3"  (alias)

Fallback:
MM12TW-000123/led/tmr/start              → "19:30"
MM12TW-000123/led/tmr/hours              → "8"
```

---

#### 🟠 TIMER HYDRO/MT1 (Hidromassagem)

**Configuração Completa (Publish)**:
```
Tópico: MASTERLAZER/{deviceId}/hidro/tmr/cfg
Payload: JSON
{
  "enabled": true,       // Ativar/desativar
  "hours": "2"           // Duração em horas
}
```

**Configuração Individual (Publish)**:
```
MASTERLAZER/{deviceId}/hidro/tmr/active  → "true" | "false"
MASTERLAZER/{deviceId}/hidro/tmr/hours   → "2"

Alternativa (MT1):
MASTERLAZER/{deviceId}/mt1/timer/cfg     → JSON completo
MASTERLAZER/{deviceId}/mt1/timer/active  → "true"

Fallback:
MM12TW-000123/hidro/tmr/active           → "true"
MM12TW-000123/mt1/timer/active           → "false"
```

---

#### ℹ️ INFORMAÇÕES DO DISPOSITIVO (Info)

**Publish (Device → Cloud)**:
```
MASTERLAZER/{deviceId}/info/ip           → "192.168.1.100"
MASTERLAZER/{deviceId}/info/mac          → "7C:9E:BD:1A:XX:XX"
MASTERLAZER/{deviceId}/info/modelo       → "MM12TW"
MASTERLAZER/{deviceId}/info/serial       → "ABC123XYZ"
```

**Status Online/Offline (Subscribe)**:
```
MASTERLAZER/{deviceId}/status            → "online" | "offline"
MASTERLAZER/{deviceId}/solar/erro        → "Error message" | ""
```

---

### Fluxo Completo de Exemplo

**Cenário**: Usuário ativa o motor 1 e muda LED para cor vermelha

```
┌─────────────────────────────────────────────┐
│          INTERFACE REACT                    │
│  Usuário clica: [MT1 ON]                    │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│    EVENT HANDLER                            │
│  onClick={() => publishTopic(...)}          │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│    publishTopic() FUNCTION                  │
│  Valida payload, aplica throttle            │
└────────────────┬────────────────────────────┘
                 │
         ┌───────┴───────┐
         ▼               ▼
┌──────────────────┐  ┌──────────────────┐
│ MQTT Publish #1  │  │ MQTT Publish #2  │
│ Topic:           │  │ Topic:           │
│ MASTERLAZER/.../ │  │ MM12TW-000123/   │
│ mt1              │  │ mt1              │
│ Payload: "ON"    │  │ Payload: "ON"    │
└────────┬─────────┘  └────────┬─────────┘
         │                      │
         └──────────┬───────────┘
                    ▼
    ┌───────────────────────────────┐
    │ MQTT BROKER                   │
    │ test.mosquitto.org:8081       │
    │ (WebSocket Secure - wss://)   │
    └───────────────┬───────────────┘
                    │
                    ▼
    ┌───────────────────────────────┐
    │ IOT HARDWARE DEVICE           │
    │ MM12TW-000123                 │
    │                               │
    │ [RECV] MASTERLAZER/MM12TW-... │
    │ → Ativa Motor 1               │
    │ [SEND] Status: LIG            │
    └───────────────┬───────────────┘
                    │
                    ▼
    ┌───────────────────────────────┐
    │ MQTT BROKER (Publish)         │
    │ Topic: .../mt1/state          │
    │ Payload: "LIG"                │
    └───────────────┬───────────────┘
                    │
                    ▼
    ┌───────────────────────────────┐
    │ APP MQTT CLIENT               │
    │ onMessageArrived()            │
    │ → Parse message               │
    │ → Update state (MT1 = ON)     │
    └───────────────┬───────────────┘
                    │
                    ▼
    ┌───────────────────────────────┐
    │ REACT STATE UPDATE            │
    │ setMotor1State('ON')          │
    │ → Re-render UI                │
    │ → [MT1 ON] botão fica verde   │
    └───────────────────────────────┘
```

---

## 🔄 FLUXOS DE COMUNICAÇÃO

### 1. Fluxo de Autenticação

```
┌──────────┐
│   USER   │
└─────┬────┘
      │ [email, password]
      ▼
┌──────────────────────────┐
│  LOGIN SCREEN            │
│  signInWithPassword()    │
└─────┬────────────────────┘
      │
      ▼
┌──────────────────────────┐
│  SUPABASE AUTH           │
│  Verifica credenciais    │
│  Gera JWT token          │
└─────┬────────────────────┘
      │
      ├─── Sucesso ──────────┐
      │                      │
      ▼                      ▼
┌───────────────┐      ┌────────────────┐
│ SESSION OK    │      │ ERROR MESSAGE  │
│ Usuário       │      │ E-mail/senha   │
│ autenticado   │      │ inválidos      │
│ setCurrentUser│      │ setAuthError   │
│ → HOME SCREEN│      │ → RETRY FORM   │
└───────────────┘      └────────────────┘
```

### 2. Fluxo de Controle de Motor

```
┌──────────────┐
│  HOME PAGE   │
│  [MT1 ON]    │
└──────┬───────┘
       │ Clique
       ▼
┌──────────────────────┐
│  publishTopic()      │
│  topic: .../mt1      │
│  payload: "ON"       │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────────────────┐
│  PAHO MQTT CLIENT                │
│  client.send(topic, payload)     │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│  MQTT BROKER (mosquitto)         │
│  Armazena mensagem               │
│  Roteia para dispositivo         │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│  IOT DEVICE (MM12TW)             │
│  Recebe "ON" em /mt1             │
│  Ativa motor 1                   │
│  Publica status: "LIG"           │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│  MQTT BROKER                     │
│  topic: .../mt1/state            │
│  payload: "LIG"                  │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│  APP MQTT CLIENT                 │
│  onMessageArrived(topic, msg)    │
│  Parse: motor1State = "ON"       │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│  REACT STATE                     │
│  setMotor1State("ON")            │
│  Re-render HOME PAGE             │
│  [MT1] botão muda para verde     │
└──────────────────────────────────┘
```

### 3. Fluxo de Configuração de Timer

```
┌─────────────────────────┐
│  TIMERS PAGE            │
│  Usuário configura:     │
│  t1_start: 08:00        │
│  t1_hours: 4            │
│  days: 1111111          │
└──────┬──────────────────┘
       │ [Salvar]
       ▼
┌─────────────────────────┐
│  saveDeviceSettings()   │
│  Salva em localStorage  │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  publishTopic()                 │
│  topic: .../ft/t1/start         │
│  payload: "08"                  │
│  (publica cada sub-tópico)      │
└──────┬──────────────────────────┘
       │
   ┌───┴───┬─────────┬─────────┐
   ▼       ▼         ▼         ▼
MQTT1   MQTT2     MQTT3     MQTT4
/ft/t1/start  /ft/t1/hours  /ft/days/*
   │       │         │         │
   └───┬───┴─────────┴─────────┘
       ▼
┌─────────────────────────────────┐
│  MQTT BROKER                    │
│  Armazena configurações         │
└─────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  IOT DEVICE                     │
│  Recebe todas as configs        │
│  Programa filtração             │
└─────────────────────────────────┘
```

---

## 🔐 AUTENTICAÇÃO E AUTORIZAÇÃO

### Estratégia de Autenticação

```
┌────────────────────────────────────────────┐
│  AUTENTICAÇÃO (Authentication)             │
│                                            │
│  O QUÊ: Verificar identidade do usuário   │
│  COMO: Email + Senha via Supabase Auth    │
│  RESULTADO: JWT Token de sessão           │
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│  AUTORIZAÇÃO (Authorization)              │
│                                            │
│  O QUÊ: Verificar permissões do usuário  │
│  COMO: Campo 'role' na tabela profiles   │
│  RESULTADO: Acesso a telas/recursos      │
└────────────────────────────────────────────┘
```

### Papéis (Roles)

| Papel | Permissões | Acesso |
|-------|-----------|---------|
| **owner** | Todas | Home, Aux, Led, Timers, Setup, Admin (full) |
| **operator** | Limitadas | Home, Aux, Led, Timers, Setup (sem admin) |

### Fluxo de Autorização

```
┌──────────────┐
│  USER LOGIN  │
│  JWT Token   │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────┐
│  SUPABASE CHECKS:            │
│  1. Token válido?            │
│  2. Não expirado?            │
│  3. User ativo?              │
└──────┬───────────────────────┘
       │
       ├─ Não ──────────────────────┐
       │                            │
       ▼                            ▼
┌──────────────────┐      ┌─────────────────┐
│ SESSION OK       │      │ SESSION INVALID │
│ Busca profiles   │      │ Redireciona     │
│ Lê campo 'role'  │      │ para LOGIN      │
└──────┬───────────┘      └─────────────────┘
       │
       ├─── owner ────────┐
       │                  │
       ▼                  ▼
   ┌────────────┐     ┌──────────┐
   │ FULL APP   │     │ LIMITED  │
   │ + ADMIN    │     │ APP      │
   └────────────┘     └──────────┘
```

### Segurança - Best Practices Implementadas

1. **JWT Tokens**: Supabase fornece JWT assinado
2. **HTTPS Only**: Configuração MQTT em wss:// (WebSocket Secure)
3. **Credenciais Protegidas**: 
   - Chave Supabase é pública (anon key)
   - Row-level security (RLS) protege dados
4. **LocalStorage Limpeza**: Dados sensíveis não persistem
5. **Session Management**: Detecção automática de sessão

---

## ⚙️ FUNCIONALIDADES COMPLETAS

### 1. Autenticação & Autorização ✅
- [x] Login com email/senha (Supabase Auth)
- [x] Registro de novo usuário
- [x] Confirmação por email
- [x] Logout seguro
- [x] Detecção automática de sessão
- [x] Fallback para modo demo
- [x] Papéis: owner, operator

### 2. Gerenciamento de Dispositivos ✅
- [x] Multi-dispositivo por usuário
- [x] Registro de novo dispositivo (manual + QR code)
- [x] Modelos suportados: MM12TW, MM03TW, MM08TSW
- [x] Token de emparelhamento
- [x] Deletar dispositivo
- [x] Transferir propriedade
- [x] Status online/offline em tempo real

### 3. Controle de Motores ✅
- [x] 4 motores independentes (MT1-MT4)
- [x] Comando on/off
- [x] Feedback de estado em tempo real
- [x] Nomeação customizável (Hydromassagem, Filtração, etc)
- [x] Simulador de erros

### 4. Sistema LED Avançado ✅
- [x] Color picker interativo (HSV)
- [x] Seleção de programa (0-N)
- [x] Controle RGB individual (0-255)
- [x] Multiplicadores de brilho e saturação
- [x] Feedback de cor do hardware
- [x] Comandos: ON, OFF, INC, DEC, SAVE

### 5. Temporizadores ✅
- [x] **Filtration Timer**: 2 cronogramas independentes
  - Hora de início
  - Duração
  - Dias da semana
- [x] **LED Timer**: Ativação automática
- [x] **Hydro Timer**: Motor 1 agendado
- [x] Persistência em localStorage

### 6. Gerenciam ento de Usuários (Admin) ✅
- [x] CRUD de usuários
- [x] Atribuição de papel (owner/operator)
- [x] Busca de usuários
- [x] Deletar usuário
- [x] Alterar papel

### 7. Inventário de Equipamentos (Admin) ✅
- [x] Listar todos os dispositivos
- [x] Transferir propriedade
- [x] Deletar dispositivo
- [x] Ver detalhes do dispositivo
- [x] Buscar por ID

### 8. Telemetria & Analytics (Admin) ✅
- [x] Programa LED mais usado
- [x] Tempo de filtração (máx/mín)
- [x] Uso de timer hydro
- [x] Coordenadas GPS (latitude/longitude)
- [x] Log de ações de usuários
- [x] Timestamp de cada ação
- [x] Limpar logs

### 9. PWA & Offline ✅
- [x] Service Worker (sw.js)
- [x] Manifest.json
- [x] Cache de assets
- [x] Funciona offline (parcialmente)

### 10. Integrações Externas ✅
- [x] Supabase (Auth + DB)
- [x] MQTT (Paho)
- [x] Color Picker (iro.js)
- [x] QR Scanner (html5-qrcode)
- [x] Google Generative AI (Gemini)
- [x] Firebase (opcional)

---

## 📦 INTEGRAÇÕES EXTERNAS

### 1. Supabase (@supabase/supabase-js v2.110.0)

**Propósito**: Backend PostgreSQL + Autenticação

**Componentes Usados**:
- Auth (login, signup, sessions)
- Database (CRUD)
- Real-time (websockets)

**Configuração**:
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://bjkjyaejzlatdclpcdjs.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
);
```

---

### 2. MQTT/Paho (HTML/JS via CDN)

**Propósito**: Comunicação IoT bidirecional

**Setup**:
```html
<script src="https://cdn.jsdelivr.net/npm/paho-mqtt@1.1.0/mqtt.min.js"></script>
```

**Uso**:
```typescript
const client = new Paho.MQTT.Client(broker, port, clientId);
client.onMessageArrived = (message) => { /* ... */ };
client.subscribe('MASTERLAZER/MM12TW-000123/#');
client.send(new Paho.MQTT.Message('ON', topic, 1));
```

---

### 3. iro.js Color Picker (CDN)

**Propósito**: Seletor de cores HSV interativo

**Setup**:
```html
<script src="https://iro.js.org/dist/iro.min.js"></script>
```

**Uso**:
```typescript
const colorPicker = new iro.ColorPicker("#picker", {
  width: 250,
  color: "#FF5733"
});

colorPicker.on("color:change", (color) => {
  const rgb = { r: color.rgb.r, g: color.rgb.g, b: color.rgb.b };
  publishRGBColor(rgb);
});
```

---

### 4. html5-qrcode (npm)

**Propósito**: Scanner de QR code no navegador

**Setup**:
```typescript
import { Html5QrcodeScanner } from 'html5-qrcode';

const scanner = new Html5QrcodeScanner('reader', {
  fps: 10,
  qrbox: 250,
});

scanner.render(onScanSuccess, onScanError);
```

---

### 5. Framer Motion (motion v12.23.24)

**Propósito**: Animações suaves de transição

**Uso**:
```typescript
import { motion, AnimatePresence } from 'motion/react';

<AnimatePresence>
  {activeScreen === 'home' && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Conteúdo */}
    </motion.div>
  )}
</AnimatePresence>
```

---

### 6. Lucide React Icons (v0.553.0)

**Propósito**: 50+ ícones SVG otimizados

**Uso**:
```typescript
import { Power, Settings, Home, Wifi } from 'lucide-react';

<Power size={24} color="red" />
```

---

### 7. Tailwind CSS v4.1.11

**Propósito**: Styling utility-first

**Uso**:
```tsx
<div className="bg-blue-500 text-white p-4 rounded-lg shadow-lg">
  Botão
</div>
```

---

### 8. Google Gemini AI (@google/genai v2.4.0)

**Propósito**: Integração com IA (opcional)

**Setup**:
```typescript
import { GoogleGenerativeAI } from '@google/genai';
```

---

## 🌍 VARIÁVEIS DE AMBIENTE

### .env.local (Desenvolvimento)

```bash
# GEMINI API KEY (Opcional)
GEMINI_API_KEY=your_gemini_api_key_here

# SUPABASE CREDENTIALS
NEXT_PUBLIC_SUPABASE_URL=https://bjkjyaejzlatdclpcdjs.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# AI STUDIO (Opcional)
DISABLE_HMR=true
```

### .env.production

```bash
NEXT_PUBLIC_SUPABASE_URL=https://bjkjyaejzlatdclpcdjs.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Variáveis em Runtime (localStorage)

```javascript
// MQTT
localStorage.mqtt_broker = "test.mosquitto.org"
localStorage.mqtt_port = "8081"
localStorage.mqtt_device = "MM12TW-000123"
localStorage.mqtt_user = ""
localStorage.mqtt_pass = ""

// Timers (Filtration)
localStorage.filter_init1 = "08"
localStorage.filter_hours1 = "4"
localStorage.filter_init2 = "14"
localStorage.filter_hours2 = "6"
localStorage.filter_days = "1111111"

// Timers (LED)
localStorage.led_start_hour = "19"
localStorage.led_start_minute = "30"
localStorage.led_duration = "8"
localStorage.led_program = "3"

// Timers (Hydro)
localStorage.hidro_timer_enabled = "true"
localStorage.hidro_timer_hours = "2"

// Telemetry
localStorage.device_telemetry_map = "{...JSON...}"

// Demo
localStorage.sim_user = "demo@example.com"
```

---

## 📖 GUIA DE USO

### Instalação e Execução

#### 1. Clonar o Repositório
```bash
git clone <repository-url>
cd App-MM12TW-Master
```

#### 2. Instalar Dependências
```bash
npm install
```

#### 3. Configurar Variáveis de Ambiente
```bash
cp .env.local.example .env.local
# Editar .env.local com suas credenciais
```

#### 4. Iniciar Servidor de Desenvolvimento
```bash
npm run dev
```

A aplicação estará disponível em `http://localhost:3000`

---

### Fluxos de Uso Comum

#### Cenário 1: Novo Usuário - Login e Primeira Conexão

```
1. Abrir app: http://localhost:3000
2. Tela de Login aparece
3. Clicar em "Modo Demo" (sem Supabase)
4. Usar email demo: demo@example.com
5. Dashboard (Home) carrega
6. Ir para Setup
7. Inserir Device ID: MM12TW-000123
8. Conectar ao MQTT: test.mosquitto.org:8081
9. Dispositivo aparece e conecta
```

#### Cenário 2: Controlar Motor via MQTT

```
1. Na tela Home
2. Clicar [MT1 ON]
3. App publica: MASTERLAZER/MM12TW-000123/mt1 → "ON"
4. Hardware recebe e ativa motor
5. Hardware publica: MASTERLAZER/MM12TW-000123/mt1/state → "LIG"
6. UI atualiza: [MT1] fica verde/ativado
```

#### Cenário 3: Configurar Timer de Filtração

```
1. Ir para tela Timers
2. Configurar Timer 1:
   - Início: 08:00
   - Duração: 4 horas
   - Dias: Seg-Dom
3. Clicar [Salvar]
4. App publica tópicos MQTT:
   - .../ft/t1/start → "08"
   - .../ft/t1/hours → "4"
   - .../ft/days/binary → "1111111"
5. Hardware recebe e agenda filtração
```

#### Cenário 4: Mudança de Cor LED

```
1. Ir para tela Led
2. Usar Color Picker para selecionar vermelho (#FF0000)
3. App publica:
   - .../pwm/r → "255"
   - .../pwm/g → "0"
   - .../pwm/b → "0"
4. Hardware atualiza cor em tempo real
5. LED fica vermelho
```

#### Cenário 5: Administração - Criar Novo Usuário

```
1. Login como owner
2. Ir para Admin tab
3. Aba "Gerenciar Usuários"
4. Clicar [+ Novo Usuário]
5. Preencher:
   - Email: novo@email.com
   - Senha: securePass123!
   - Nome: João Silva
   - Papel: operator
6. Clicar [Criar]
7. Usuário criado no Supabase
8. Email de confirmação enviado
```

---

### Troubleshooting

#### Problema: MQTT não conecta

**Solução**:
```
1. Verificar broker: test.mosquitto.org:8081
2. Verificar porta: 8081 (WebSocket Secure)
3. Verificar Device ID está correto
4. Check browser console para erros
5. Tentar reconectar via Setup
```

#### Problema: Supabase credentials inválidas

**Solução**:
```
1. Ir para Setup
2. Inserir URL manualmente:
   https://bjkjyaejzlatdclpcdjs.supabase.co
3. Inserir Anon Key (começa com "eyJ")
4. Clicar [Salvar]
5. Ou usar Modo Demo
```

#### Problema: Timer não está funcionando

**Solução**:
```
1. Verificar se MQTT está conectado
2. Verificar localStorage (DevTools → Application)
3. Verificar se dias estão selecionados
4. Salvar novamente
5. Aguardar próximo horário agendado
```

---

## 📊 RESUMO EXECUTIVO

| Aspecto | Detalhes |
|---------|----------|
| **Tipo de App** | Progressive Web App (PWA) |
| **Frontend Framework** | Next.js 15 + React 19 |
| **Backend** | Supabase (PostgreSQL) + MQTT |
| **Telas** | 8 principais (login, home, aux, led, timers, setup, admin) |
| **Dispositivos** | 3 modelos (MM12TW, MM03TW, MM08TSW) |
| **Tópicos MQTT** | 108+ (dual-publish) |
| **Usuários** | Multiusuário com 2 papéis |
| **Autenticação** | Email/Senha via Supabase Auth |
| **Banco de Dados** | 3 tabelas + localStorage |
| **Segurança** | JWT + RLS + HTTPS/WSS |
| **Performance** | Throttle 120ms (cores), Lazy loading |
| **Offline** | Service Worker + PWA |

---

## 📞 CONTATO & SUPORTE

**Aplicação**: MM12TW Master Lazer Pool Controller  
**Versão**: 1.0.0  
**Última Atualização**: 2026-07-09  
**Status**: ✅ Em Produção  

Para dúvidas ou bugs, abrir issue no repositório.

---

**FIM DA DOCUMENTAÇÃO**
