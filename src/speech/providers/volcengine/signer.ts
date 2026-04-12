/**
 * Volcengine API signature utilities (browser-compatible)
 * Based on official SDK implementation
 * Reference: https://github.com/volcengine/volc-sdk-nodejs
 */

import HmacSHA256 from 'crypto-js/hmac-sha256';
import SHA256 from 'crypto-js/sha256';

interface SignatureParams {
  accessKey: string;
  secretKey: string;
  region?: string;
  service?: string;
}

/**
 * Generates signed WebSocket URL for Volcengine Speech Translation API
 * Implements the same algorithm as official SDK but browser-compatible
 */
export function getSignedWebSocketUrl(params: SignatureParams): string {
  const {
    accessKey,
    secretKey,
    region = 'cn-north-1',
    service = 'translate',
  } = params;

  const method = 'GET';
  const pathname = '/api/translate/speech/v1/';

  // Build initial query params
  const queryParams: Record<string, string> = {
    Action: 'SpeechTranslate',
    Version: '2020-06-01',
  };

  // Get datetime in format: YYYYMMDDTHHMMSSZ
  const now = new Date();
  const datetime = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
  const date = datetime.substr(0, 8);

  // Build credential scope
  const credentialScope = `${date}/${region}/${service}/request`;

  // Add signature-related params
  queryParams['X-Date'] = datetime;
  queryParams['X-NotSignBody'] = '';
  queryParams['X-Credential'] = `${accessKey}/${credentialScope}`;
  queryParams['X-Algorithm'] = 'HMAC-SHA256';
  queryParams['X-SignedHeaders'] = '';

  // Sort params for canonical request
  const sortedParams = sortParams(queryParams);
  const queryString = queryParamsToString(sortedParams);

  // Build canonical request
  const canonicalRequest = [
    method,
    pathname,
    queryString,
    '\n', // empty canonical headers
    '', // empty signed headers
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', // SHA256 of empty string
  ].join('\n');

  // Build string to sign
  const canonicalRequestHash = SHA256(canonicalRequest).toString();
  const stringToSign = [
    'HMAC-SHA256',
    datetime,
    credentialScope,
    canonicalRequestHash,
  ].join('\n');

  // Calculate signature (same as SDK)
  const kDate = HmacSHA256(date, secretKey);
  const kRegion = HmacSHA256(region, kDate);
  const kService = HmacSHA256(service, kRegion);
  const kSigning = HmacSHA256('request', kService);
  const signature = HmacSHA256(stringToSign, kSigning).toString();

  // Add signature params
  sortedParams['X-SignedQueries'] = Object.keys(sortedParams).sort().join(';');
  sortedParams['X-Signature'] = signature;

  const finalQueryString = queryParamsToString(sortedParams);
  return `wss://translate.volces.com${pathname}?${finalQueryString}`;
}

/**
 * Sort params by key
 */
function sortParams(params: Record<string, string>): Record<string, string> {
  const sorted: Record<string, string> = {};
  Object.keys(params)
    .filter(key => params[key] !== undefined && params[key] !== null)
    .sort()
    .forEach(key => {
      sorted[key] = params[key];
    });
  return sorted;
}

/**
 * Convert params to query string (same as SDK's uriEscape)
 */
function uriEscape(str: string): string {
  return encodeURIComponent(str)
    .replace(/[^A-Za-z0-9_.~\-%]+/g, escape)
    .replace(/[*]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
}

/**
 * Convert params object to query string
 */
function queryParamsToString(params: Record<string, string>): string {
  return Object.keys(params)
    .map(key => {
      const val = params[key];
      if (typeof val === 'undefined' || val === null) {
        return;
      }
      const escapedKey = uriEscape(key);
      if (!escapedKey) {
        return;
      }
      return `${escapedKey}=${uriEscape(val)}`;
    })
    .filter(v => v)
    .join('&');
}
