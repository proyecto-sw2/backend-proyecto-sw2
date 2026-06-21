export class FirmaResultado {
  /** Hash SHA-256 del contenido (hex, 64 chars, sin 0x). */
  hash: string;
  /** Hash de la transacción en Ethereum Sepolia (0x…). */
  txHash: string;
  /** Momento del registro en ISO 8601. */
  timestamp: string;
}
