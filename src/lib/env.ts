/**
 * Central configuration.
 *
 * Every external integration is written behind a function that returns a
 * hardcoded response by default. Flipping `USE_REAL_APIS=true` (or a
 * per-provider override) switches that single function to the live call, so
 * shipping real keys is a config change rather than a code change.
 */

function readBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function readString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export type ProviderName =
  | "addisAi"
  | "whisperflow"
  | "elevenlabs"
  | "ocr"
  | "telebirr"
  | "sms"
  | "supabase";

export type ProviderMode = "mock" | "live";

export interface AppConfig {
  useRealApis: boolean;
  modes: Record<ProviderName, ProviderMode>;
  addisAi: {
    baseUrl: string;
    apiKey?: string;
    model: string;
  };
  whisperflow: {
    baseUrl: string;
    apiKey?: string;
  };
  elevenlabs: {
    baseUrl: string;
    apiKey?: string;
    voiceId: string;
    modelId: string;
  };
  ocr: {
    /** `google-vision` first, falling back to local Tesseract when it fails. */
    googleVisionApiKey?: string;
    googleVisionEndpoint: string;
    tesseractLanguages: string;
    allowTesseractFallback: boolean;
  };
  telebirr: {
    baseUrl: string;
    appId?: string;
    appKey?: string;
    shortCode?: string;
    publicKey?: string;
    notifyUrl?: string;
    returnUrl?: string;
  };
  sms: {
    baseUrl: string;
    username: string;
    apiKey?: string;
    senderId?: string;
  };
  supabase: {
    url?: string;
    anonKey?: string;
    serviceRoleKey?: string;
    storageBucket: string;
  };
  storage: {
    /** Local directory used by the filesystem storage driver. */
    dir: string;
  };
  db: {
    /** JSON file the in-memory repository hydrates from and persists to. */
    file?: string;
  };
  pricing: {
    formFillBirr: number;
    errandPlatformFeeBirr: number;
    currency: string;
  };
}

function providerMode(
  envVar: string | undefined,
  globalReal: boolean,
  hasCredentials: boolean,
): ProviderMode {
  // An explicit per-provider override always wins.
  if (envVar !== undefined && envVar !== "") {
    return readBool(envVar, false) ? "live" : "mock";
  }
  // Otherwise follow the global switch, but never pretend to be live without
  // credentials -- a half-configured provider should degrade to the mock
  // instead of throwing at request time.
  return globalReal && hasCredentials ? "live" : "mock";
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const useRealApis = readBool(env.USE_REAL_APIS, false);

  const addisAiKey = readString(env.ADDIS_AI_API_KEY);
  const whisperflowKey = readString(env.WHISPERFLOW_API_KEY);
  const elevenlabsKey = readString(env.ELEVENLABS_API_KEY);
  const visionKey = readString(env.GOOGLE_VISION_API_KEY);
  const telebirrAppId = readString(env.TELEBIRR_APP_ID);
  const telebirrAppKey = readString(env.TELEBIRR_APP_KEY);
  const smsKey = readString(env.AFRICAS_TALKING_API_KEY);
  const supabaseUrl = readString(env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseServiceKey = readString(env.SUPABASE_SERVICE_ROLE_KEY);

  return {
    useRealApis,
    modes: {
      addisAi: providerMode(env.USE_REAL_ADDIS_AI, useRealApis, !!addisAiKey),
      whisperflow: providerMode(
        env.USE_REAL_WHISPERFLOW,
        useRealApis,
        !!whisperflowKey,
      ),
      elevenlabs: providerMode(
        env.USE_REAL_ELEVENLABS,
        useRealApis,
        !!elevenlabsKey,
      ),
      ocr: providerMode(env.USE_REAL_OCR, useRealApis, !!visionKey),
      telebirr: providerMode(
        env.USE_REAL_TELEBIRR,
        useRealApis,
        !!(telebirrAppId && telebirrAppKey),
      ),
      sms: providerMode(env.USE_REAL_SMS, useRealApis, !!smsKey),
      supabase: providerMode(
        env.USE_REAL_SUPABASE,
        useRealApis,
        !!(supabaseUrl && supabaseServiceKey),
      ),
    },
    addisAi: {
      baseUrl: readString(env.ADDIS_AI_BASE_URL) ?? "https://api.addisai.com/v1",
      apiKey: addisAiKey,
      model: readString(env.ADDIS_AI_MODEL) ?? "addis-am-instruct",
    },
    whisperflow: {
      baseUrl:
        readString(env.WHISPERFLOW_BASE_URL) ?? "https://api.whisperflow.ai/v1",
      apiKey: whisperflowKey,
    },
    elevenlabs: {
      baseUrl:
        readString(env.ELEVENLABS_BASE_URL) ?? "https://api.elevenlabs.io/v1",
      apiKey: elevenlabsKey,
      voiceId: readString(env.ELEVENLABS_VOICE_ID) ?? "21m00Tcm4TlvDq8ikWAM",
      modelId: readString(env.ELEVENLABS_MODEL_ID) ?? "eleven_multilingual_v2",
    },
    ocr: {
      googleVisionApiKey: visionKey,
      googleVisionEndpoint:
        readString(env.GOOGLE_VISION_ENDPOINT) ??
        "https://vision.googleapis.com/v1/images:annotate",
      tesseractLanguages: readString(env.TESSERACT_LANGUAGES) ?? "amh+eng",
      allowTesseractFallback: readBool(env.OCR_TESSERACT_FALLBACK, true),
    },
    telebirr: {
      baseUrl:
        readString(env.TELEBIRR_BASE_URL) ?? "https://api.ethiotelecom.et/v1",
      appId: telebirrAppId,
      appKey: telebirrAppKey,
      shortCode: readString(env.TELEBIRR_SHORT_CODE),
      publicKey: readString(env.TELEBIRR_PUBLIC_KEY),
      notifyUrl: readString(env.TELEBIRR_NOTIFY_URL),
      returnUrl: readString(env.TELEBIRR_RETURN_URL),
    },
    sms: {
      baseUrl:
        readString(env.AFRICAS_TALKING_BASE_URL) ??
        "https://api.africastalking.com/version1",
      username: readString(env.AFRICAS_TALKING_USERNAME) ?? "sandbox",
      apiKey: smsKey,
      senderId: readString(env.AFRICAS_TALKING_SENDER_ID),
    },
    supabase: {
      url: supabaseUrl,
      anonKey: readString(env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      serviceRoleKey: supabaseServiceKey,
      storageBucket: readString(env.SUPABASE_STORAGE_BUCKET) ?? "kebele-files",
    },
    storage: {
      dir: readString(env.KN_STORAGE_DIR) ?? ".data/storage",
    },
    db: {
      file: readString(env.KN_DB_FILE) ?? ".data/db.json",
    },
    pricing: {
      formFillBirr: Number(readString(env.PRICE_FORM_FILL_BIRR) ?? "75"),
      errandPlatformFeeBirr: Number(
        readString(env.PRICE_ERRAND_PLATFORM_FEE_BIRR) ?? "25",
      ),
      currency: "ETB",
    },
  };
}

let cached: AppConfig | undefined;

export function config(): AppConfig {
  if (!cached) cached = loadConfig();
  return cached;
}

/** Test helper: drop the memoised config so a new env can be picked up. */
export function resetConfigCache(): void {
  cached = undefined;
}

export function isLive(provider: ProviderName): boolean {
  return config().modes[provider] === "live";
}
