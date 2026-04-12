import type {
    ChatProviderId,
    ModelSettings,
    Settings,
    UiLanguage,
    SpeechSettings,
    SourceLanguage,
    TargetLanguage
} from '../types/settings';

export const defaultSettings: Settings = {
    model: {
        provider: 'openai',
        model: '',
        systemPrompt: 'You are ChatBrowserX, a helpful browser agent assistant.',
        maxHistory: 50,
        tavilyApiKey: '',
        openai: {
            apiKey: '',
            model: '',
            baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
        },
        codex: {
            accessToken: '',
            model: 'gpt-5.4',
            baseUrl: 'https://chatgpt.com/backend-api',
        },
    },
    general: {
        uiLanguage: 'zh',
    },
    speech: {
        provider: 'volcengine',
        sourceLanguage: 'auto',
        targetLanguage: 'none',
        volcengine: {
            accessKeyId: '',
            secretAccessKey: '',
        },
    },
};

function readString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
}

function readNonEmptyString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value : undefined;
}

function readPositiveNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

function resolveProvider(value: unknown): ChatProviderId {
    return value === 'openai' || value === 'codex' ? value : defaultSettings.model.provider;
}

function normalizeModelSettings(raw: Partial<any> | undefined): ModelSettings {
    const model = raw ?? {};
    const provider = resolveProvider(model.provider);
    const openaiBaseUrl =
        readNonEmptyString(model.openai?.baseUrl) ??
        (provider === 'openai' ? readNonEmptyString(model.baseUrl) : undefined) ??
        defaultSettings.model.openai.baseUrl;
    const codexBaseUrl =
        readNonEmptyString(model.codex?.baseUrl) ??
        (provider === 'codex' ? readNonEmptyString(model.baseUrl) : undefined) ??
        defaultSettings.model.codex.baseUrl;
    const systemPrompt = readNonEmptyString(model.systemPrompt) ?? defaultSettings.model.systemPrompt;
    const maxHistory = readPositiveNumber(model.maxHistory) ?? defaultSettings.model.maxHistory;
    const tavilyApiKey = readString(model.tavilyApiKey) ?? defaultSettings.model.tavilyApiKey;
    const openaiApiKey = readString(model.openai?.apiKey) ?? readString(model.apiKey) ?? defaultSettings.model.openai.apiKey;
    const openaiModelName =
        readString(model.openai?.model) ??
        (provider === 'openai' ? readString(model.model) : undefined) ??
        defaultSettings.model.openai.model;
    const codexAccessToken =
        readString(model.codex?.accessToken) ??
        readString(model.accessToken) ??
        (provider === 'codex' ? readString(model.apiKey) : undefined) ??
        defaultSettings.model.codex.accessToken;
    const codexModelName =
        readString(model.codex?.model) ??
        (provider === 'codex' ? readString(model.model) : undefined) ??
        defaultSettings.model.codex.model;
    const aliasModelName = provider === 'openai' ? openaiModelName : codexModelName;

    return {
        provider,
        model: aliasModelName,
        systemPrompt,
        maxHistory,
        tavilyApiKey,
        openai: {
            apiKey: openaiApiKey,
            model: openaiModelName,
            baseUrl: openaiBaseUrl,
        },
        codex: {
            accessToken: codexAccessToken,
            model: codexModelName,
            baseUrl: codexBaseUrl,
        },
    };
}

function normalizeSpeechSettings(raw: Partial<any> | undefined): SpeechSettings {
    const speech = raw ?? {};
    const sourceLanguage: SourceLanguage =
        speech.sourceLanguage === 'auto' ||
        speech.sourceLanguage === 'zh' ||
        speech.sourceLanguage === 'en' ||
        speech.sourceLanguage === 'ja'
            ? speech.sourceLanguage
            : defaultSettings.speech.sourceLanguage;
    const targetLanguage: TargetLanguage =
        speech.targetLanguage === 'none' ||
        speech.targetLanguage === 'zh' ||
        speech.targetLanguage === 'en' ||
        speech.targetLanguage === 'ja'
            ? speech.targetLanguage
            : defaultSettings.speech.targetLanguage;

    return {
        provider: 'volcengine',
        sourceLanguage,
        targetLanguage,
        volcengine: {
            accessKeyId: readString(speech.volcengine?.accessKeyId) ?? defaultSettings.speech.volcengine.accessKeyId,
            secretAccessKey: readString(speech.volcengine?.secretAccessKey) ?? defaultSettings.speech.volcengine.secretAccessKey,
        },
    };
}

export function normalizeSettings(settings: Partial<Settings> | undefined): Settings {
    return {
        model: normalizeModelSettings(settings?.model),
        general: {
            uiLanguage:
                settings?.general?.uiLanguage === 'system' ||
                settings?.general?.uiLanguage === 'zh' ||
                settings?.general?.uiLanguage === 'en' ||
                settings?.general?.uiLanguage === 'ja'
                    ? (settings.general.uiLanguage as UiLanguage)
                    : defaultSettings.general.uiLanguage,
        },
        speech: normalizeSpeechSettings(settings?.speech),
    };
}
