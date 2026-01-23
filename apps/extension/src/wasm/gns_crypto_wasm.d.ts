/* tslint:disable */
/* eslint-disable */

/**
 * Create a signed breadcrumb
 * Returns breadcrumb as JSON string
 */
export function create_signed_breadcrumb(private_key_hex: string, latitude: number, longitude: number): string;

/**
 * Create a signed and encrypted envelope
 * Returns envelope as JSON string
 */
export function create_signed_envelope(sender_private_key_hex: string, recipient_public_key_hex: string, recipient_encryption_key_hex: string, payload_type: string, payload: Uint8Array): string;

/**
 * Decrypt data sent to us
 * Returns plaintext bytes
 */
export function decrypt_message(private_key_hex: string, encrypted_json: string): Uint8Array;

/**
 * Encrypt data for a recipient
 * Returns JSON: { ephemeral_public_key, nonce, ciphertext } (all hex)
 */
export function encrypt_for_recipient(plaintext: Uint8Array, recipient_encryption_key_hex: string): any;

/**
 * Generate a new identity
 * Returns JSON: { public_key, encryption_key, private_key }
 */
export function generate_identity(): any;

/**
 * Initialize panic hook for better error messages
 */
export function init(): void;

/**
 * Open (verify and decrypt) an envelope
 * Returns JSON: { from_public_key, payload_type, payload, signature_valid }
 */
export function open_signed_envelope(recipient_private_key_hex: string, envelope_json: string): any;

/**
 * Restore identity from private key hex
 * Returns JSON: { public_key, encryption_key }
 */
export function restore_identity(private_key_hex: string): any;

/**
 * Sign a message
 * Returns signature as hex string
 */
export function sign_message(private_key_hex: string, message: Uint8Array): string;

/**
 * Verify a breadcrumb signature
 */
export function verify_breadcrumb(breadcrumb_json: string): boolean;

/**
 * Verify a signature
 * Returns true if valid
 */
export function verify_signature(public_key_hex: string, message: Uint8Array, signature_hex: string): boolean;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly create_signed_breadcrumb: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly create_signed_envelope: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number) => void;
  readonly decrypt_message: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly encrypt_for_recipient: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly generate_identity: (a: number) => void;
  readonly init: () => void;
  readonly open_signed_envelope: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly restore_identity: (a: number, b: number, c: number) => void;
  readonly sign_message: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly verify_breadcrumb: (a: number, b: number, c: number) => void;
  readonly verify_signature: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
  readonly __wbindgen_export: (a: number, b: number) => number;
  readonly __wbindgen_export2: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_export3: (a: number) => void;
  readonly __wbindgen_export4: (a: number, b: number, c: number) => void;
  readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
