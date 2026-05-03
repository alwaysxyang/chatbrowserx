import {
    CHAT_PROVIDER_OPTIONS,
    CODEX_REASONING_EFFORT_OPTIONS,
    SOURCE_LANGUAGE_OPTIONS,
    TARGET_LANGUAGE_OPTIONS,
    UI_LANGUAGE_OPTIONS,
} from '../types/settings';
import type {
    ChatProviderId,
    CodexReasoningEffort,
    ModelSettings,
    Settings,
    UiLanguage,
    SpeechSettings,
    SourceLanguage,
    TargetLanguage,
} from '../types/settings';

type RawObject = Record<string, unknown>;

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
            effort: 'high',
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

/**
 * Reads a string without trimming so credentials can preserve exact input.
 *
 * @param value - Unknown persisted value.
 * @returns The string value when present.
 */
function readString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
}

/**
 * Reads a non-empty string for fields where blank values should fall back.
 *
 * @param value - Unknown persisted value.
 * @returns A non-empty string when present.
 */
function readNonEmptyString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value : undefined;
}

/**
 * Reads a positive finite number.
 *
 * @param value - Unknown persisted value.
 * @returns A positive number when present.
 */
function readPositiveNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

/**
 * Reads an object-like value as a generic record.
 *
 * @param value - Unknown persisted value.
 * @returns A record when the value is a plain object.
 */
function readObject(value: unknown): RawObject | undefined {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as RawObject : undefined;
}

/**
 * Reads a nested object from a record.
 *
 * @param source - The source record.
 * @param key - The object field to read.
 * @returns A nested record when present.
 */
function readNestedObject(source: RawObject, key: string): RawObject {
    return readObject(source[key]) ?? {};
}

/**
 * Reads a string enum value with a fallback.
 *
 * @param value - Unknown persisted value.
 * @param options - Allowed string values.
 * @param fallback - Fallback value.
 * @returns The persisted enum value or the fallback.
 */
function readEnum<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
    return typeof value === 'string' && options.includes(value as T) ? value as T : fallback;
}

/**
 * Uses a legacy top-level provider value only when that provider is active.
 *
 * @param activeProvider - Persisted active provider.
 * @param provider - Provider that owns the legacy value.
 * @param value - Already parsed legacy value.
 * @returns The legacy value only for the active provider.
 */
function readActiveProviderAlias<T>(
    activeProvider: ChatProviderId,
    provider: ChatProviderId,
    value: T | undefined,
): T | undefined {
    return activeProvider === provider ? value : undefined;
}

/**
 * Normalizes model settings and preserves legacy top-level provider aliases.
 *
 * @param raw - Unknown persisted model settings.
 * @returns Complete model settings.
 */
function normalizeModelSettings(raw: unknown): ModelSettings {
    const model = readObject(raw) ?? {};
    const openai = readNestedObject(model, 'openai');
    const codex = readNestedObject(model, 'codex');
    const provider = readEnum<ChatProviderId>(model.provider, CHAT_PROVIDER_OPTIONS, defaultSettings.model.provider);
    const legacyBaseUrl = readNonEmptyString(model.baseUrl);
    const legacyModelName = readString(model.model);
    const openaiBaseUrl =
        readNonEmptyString(openai.baseUrl) ??
        readActiveProviderAlias(provider, 'openai', legacyBaseUrl) ??
        defaultSettings.model.openai.baseUrl;
    const codexBaseUrl =
        readNonEmptyString(codex.baseUrl) ??
        readActiveProviderAlias(provider, 'codex', legacyBaseUrl) ??
        defaultSettings.model.codex.baseUrl;
    const systemPrompt = readNonEmptyString(model.systemPrompt) ?? defaultSettings.model.systemPrompt;
    const maxHistory = readPositiveNumber(model.maxHistory) ?? defaultSettings.model.maxHistory;
    const tavilyApiKey = readString(model.tavilyApiKey) ?? defaultSettings.model.tavilyApiKey;
    const openaiApiKey = readString(openai.apiKey) ?? readString(model.apiKey) ?? defaultSettings.model.openai.apiKey;
    const openaiModelName =
        readString(openai.model) ??
        readActiveProviderAlias(provider, 'openai', legacyModelName) ??
        defaultSettings.model.openai.model;
    const codexAccessToken =
        readString(codex.accessToken) ??
        readString(model.accessToken) ??
        readActiveProviderAlias(provider, 'codex', readString(model.apiKey)) ??
        defaultSettings.model.codex.accessToken;
    const codexModelName =
        readString(codex.model) ??
        readActiveProviderAlias(provider, 'codex', legacyModelName) ??
        defaultSettings.model.codex.model;
    const codexEffort = readEnum<CodexReasoningEffort>(
        codex.effort ?? model.effort,
        CODEX_REASONING_EFFORT_OPTIONS,
        defaultSettings.model.codex.effort,
    );
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
            effort: codexEffort,
        },
    };
}

/**
 * Normalizes speech settings for the current Volcengine-only provider scope.
 *
 * @param raw - Unknown persisted speech settings.
 * @returns Complete speech settings.
 */
function normalizeSpeechSettings(raw: unknown): SpeechSettings {
    const speech = readObject(raw) ?? {};
    const volcengine = readNestedObject(speech, 'volcengine');
    const sourceLanguage = readEnum<SourceLanguage>(
        speech.sourceLanguage,
        SOURCE_LANGUAGE_OPTIONS,
        defaultSettings.speech.sourceLanguage,
    );
    const targetLanguage = readEnum<TargetLanguage>(
        speech.targetLanguage,
        TARGET_LANGUAGE_OPTIONS,
        defaultSettings.speech.targetLanguage,
    );

    return {
        provider: 'volcengine',
        sourceLanguage,
        targetLanguage,
        volcengine: {
            accessKeyId: readString(volcengine.accessKeyId) ?? defaultSettings.speech.volcengine.accessKeyId,
            secretAccessKey: readString(volcengine.secretAccessKey) ?? defaultSettings.speech.volcengine.secretAccessKey,
        },
    };
}

/**
 * Normalizes all persisted settings into the current complete settings shape.
 *
 * @param settings - Partial or missing persisted settings.
 * @returns Complete settings with defaults and legacy aliases applied.
 */
export function normalizeSettings(settings: Partial<Settings> | undefined): Settings {
    const general = readObject(settings?.general) ?? {};

    return {
        model: normalizeModelSettings(settings?.model),
        general: {
            uiLanguage: readEnum<UiLanguage>(
                general.uiLanguage,
                UI_LANGUAGE_OPTIONS,
                defaultSettings.general.uiLanguage,
            ),
        },
        speech: normalizeSpeechSettings(settings?.speech),
    };
}
