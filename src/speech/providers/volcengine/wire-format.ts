import protobuf from 'protobufjs';
import { ClientMessageType, ServerMessageType } from './protocol';

const protoBasePath = 'src/speech/providers/volcengine/protos';
const protoEntryPath = `${protoBasePath}/products/understanding/ast/ast_service.proto`;
const websocketEndpoint = '/api/v4/ast/v2/translate';
const websocketResourceId = 'volc.service_type.10053';

let cachedRootPromise: Promise<protobuf.Root> | null = null;

type AstTypes = {
  translateRequest: protobuf.Type;
  translateResponse: protobuf.Type;
  eventType: protobuf.Enum;
};

type DecodedResponse = {
  event?: number;
  text?: string;
  start_time?: number;
  end_time?: number;
  muted_duration_ms?: number;
  response_meta?: {
    status_code?: number;
    message?: string;
    session_id?: string;
  };
};

export async function getVolcengineWebSocketUrl(): Promise<string> {
  return `wss://openspeech.bytedance.com${websocketEndpoint}`;
}

export function getVolcengineResourceId(): string {
  return websocketResourceId;
}

async function loadProtoText(relativePath: string): Promise<string> {
  const response = await fetch(chrome.runtime.getURL(relativePath));
  if (!response.ok) {
    throw new Error(`Failed to load proto: ${relativePath}`);
  }
  return response.text();
}

async function loadRoot(): Promise<protobuf.Root> {
  if (!cachedRootPromise) {
    cachedRootPromise = (async () => {
      const root = new protobuf.Root();
      const loaded = new Set<string>();

      const loadRecursively = async (relativePath: string) => {
        if (loaded.has(relativePath)) {
          return;
        }
        loaded.add(relativePath);

        const source = await loadProtoText(relativePath);
        const parsed = protobuf.parse(source, root, {
          keepCase: true,
          alternateCommentMode: true,
        });

        const imports = [...(parsed.imports ?? []), ...(parsed.weakImports ?? [])]
          .filter(Boolean)
          .map((item) => item.replace(/^\/+/, ''));

        for (const imported of imports) {
          await loadRecursively(`${protoBasePath}/${imported}`);
        }
      };

      await loadRecursively(protoEntryPath);
      root.resolveAll();
      return root;
    })();
  }

  return cachedRootPromise;
}

async function getAstTypes(): Promise<AstTypes> {
  const root = await loadRoot();
  return {
    translateRequest: root.lookupType('data.speech.ast.TranslateRequest'),
    translateResponse: root.lookupType('data.speech.ast.TranslateResponse'),
    eventType: root.lookupEnum('data.speech.event.Type'),
  };
}

function getEventId(eventType: protobuf.Enum, name: keyof typeof ClientMessageType | keyof typeof ServerMessageType | string): number {
  const value = eventType.values[name];
  if (typeof value !== 'number') {
    throw new Error(`Unknown event type: ${name}`);
  }
  return value;
}

export async function createClientReadyMessage(
  sourceLanguage: string,
  targetLanguage: string,
  sessionId: string,
): Promise<Uint8Array> {
  const { translateRequest, eventType } = await getAstTypes();
  const payload = {
    request_meta: {
      session_id: sessionId,
    },
    event: getEventId(eventType, 'StartSession'),
    user: {
      uid: 'chatbrowserx-user',
      platform: 'chrome-extension',
    },
    source_audio: {
      format: 'wav',
      codec: 'raw',
      rate: 16000,
      bits: 16,
      channel: 1,
    },
    request: {
      mode: 's2t',
      source_language: sourceLanguage,
      target_language: targetLanguage || 'en',
    },
  };

  const verified = translateRequest.verify(payload);
  if (verified) {
    throw new Error(verified);
  }

  return translateRequest.encode(translateRequest.fromObject(payload)).finish();
}

export async function createAudioDataMessage(sequence: number, data: ArrayBuffer): Promise<Uint8Array> {
  const { translateRequest, eventType } = await getAstTypes();
  const payload = {
    event: getEventId(eventType, 'TaskRequest'),
    request_meta: {
      sequence,
    },
    source_audio: {
      binary_data: new Uint8Array(data),
    },
  };

  const verified = translateRequest.verify(payload);
  if (verified) {
    throw new Error(verified);
  }

  return translateRequest.encode(translateRequest.fromObject(payload)).finish();
}

export async function createClientFinishMessage(sequence: number): Promise<Uint8Array> {
  const { translateRequest, eventType } = await getAstTypes();
  const payload = {
    event: getEventId(eventType, 'FinishSession'),
    request_meta: {
      sequence,
    },
  };

  const verified = translateRequest.verify(payload);
  if (verified) {
    throw new Error(verified);
  }

  return translateRequest.encode(translateRequest.fromObject(payload)).finish();
}

export async function decodeServerMessage(data: ArrayBuffer): Promise<DecodedResponse> {
  const { translateResponse } = await getAstTypes();
  const decoded = translateResponse.decode(new Uint8Array(data));
  return translateResponse.toObject(decoded, {
    longs: Number,
    enums: Number,
    defaults: false,
    arrays: false,
    objects: false,
  }) as DecodedResponse;
}

export function isServerReady(message: DecodedResponse): boolean {
  return message.event === 150;
}

export function isSourceSubtitle(message: DecodedResponse): boolean {
  return message.event === 650 || message.event === 651 || message.event === 652;
}

export function isTranslationSubtitle(message: DecodedResponse): boolean {
  return message.event === 653 || message.event === 654 || message.event === 655;
}

export function isServerError(message: DecodedResponse): boolean {
  return message.event === 153 || (message.response_meta?.status_code ?? 0) >= 400;
}

export function toSubtitlePayload(message: DecodedResponse) {
  return {
    utterance_id: `${message.start_time ?? 0}-${message.end_time ?? 0}`,
    text: message.text ?? '',
    start_time: message.start_time ?? 0,
    end_time: message.end_time ?? 0,
  };
}
