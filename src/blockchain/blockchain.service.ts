import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { ethers } from 'ethers';
import { conReintentos } from './blockchain.retry';
import { FirmaResultado } from './dto/firma-resultado.dto';

const ABI = [
  'function registrar(bytes32 _hash, string calldata _tipo) external',
  'function verificar(bytes32 _hash) external view returns (bool existe, uint256 timestamp)',
];

export type TipoRegistro = 'INCIDENTE' | 'EMERGENCIA';

@Injectable()
export class BlockchainService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainService.name);
  private readonly provider: ethers.JsonRpcProvider;
  private readonly wallet: ethers.Wallet;
  private contrato: ethers.Contract | null = null;
  private readonly maxReintentos: number;
  private readonly delayMs: number;

  constructor(private readonly config: ConfigService) {
    const rpcUrl = config.get<string>('SEPOLIA_RPC_URL');
    const privateKey = config.get<string>('WALLET_PRIVATE_KEY');

    if (!rpcUrl || !privateKey) {
      this.logger.warn(
        'SEPOLIA_RPC_URL o WALLET_PRIVATE_KEY no configurados. El módulo blockchain estará inactivo.',
      );
      return;
    }

    this.maxReintentos = parseInt(config.get('BLOCKCHAIN_MAX_RETRIES') ?? '3');
    this.delayMs = parseInt(config.get('BLOCKCHAIN_RETRY_DELAY_MS') ?? '5000');

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
  }

  onModuleInit() {
    if (!this.wallet) return;

    const address = this.config.get<string>('CONTRACT_ADDRESS');
    if (!address) {
      this.logger.warn(
        'CONTRACT_ADDRESS no configurado. Ejecuta el deploy primero. ' +
          'Los registros blockchain quedarán pendientes hasta configurarlo.',
      );
      return;
    }
    this.contrato = new ethers.Contract(address, ABI, this.wallet);
    this.logger.log(`Contrato RegistroHash listo en Sepolia: ${address}`);
  }

  get disponible(): boolean {
    return this.contrato !== null;
  }

  /**
   * Calcula el SHA-256 del contenido y lo registra en Sepolia.
   * Usa reintentos automáticos (máx 3x por defecto).
   */
  async firmar(contenido: string, tipo: TipoRegistro): Promise<FirmaResultado> {
    if (!this.contrato) {
      throw new ServiceUnavailableException(
        'Contrato blockchain no configurado. Configura CONTRACT_ADDRESS en .env',
      );
    }

    const hash = createHash('sha256').update(contenido, 'utf8').digest('hex');
    const hashBytes32 = ('0x' + hash) as `0x${string}`;

    const tx: ethers.ContractTransactionResponse = await conReintentos(
      () => (this.contrato as ethers.Contract).registrar(hashBytes32, tipo),
      this.maxReintentos,
      this.delayMs,
    );

    const receipt = await tx.wait(1);
    const txHash = (receipt as ethers.ContractTransactionReceipt).hash;

    this.logger.log(`Hash registrado | sha256=${hash} | tx=${txHash} | tipo=${tipo}`);

    return { hash, txHash, timestamp: new Date().toISOString() };
  }

  async verificar(hash: string): Promise<{ existe: boolean; timestamp: number }> {
    if (!this.contrato) {
      throw new ServiceUnavailableException('Contrato blockchain no configurado.');
    }
    const hashBytes32 = ('0x' + hash) as `0x${string}`;
    const [existe, timestamp] = await (this.contrato as ethers.Contract).verificar(hashBytes32);
    return { existe, timestamp: Number(timestamp) };
  }

  async consultarTransaccion(txHash: string) {
    if (!this.provider) {
      throw new ServiceUnavailableException('Proveedor blockchain no configurado.');
    }
    const receipt = await this.provider.getTransactionReceipt(txHash);
    if (!receipt) {
      return { estado: 'pendiente', txHash };
    }
    return {
      estado: receipt.status === 1 ? 'confirmada' : 'fallida',
      txHash,
      bloque: receipt.blockNumber,
      confirmaciones: await receipt.confirmations(),
      etherscan: `https://sepolia.etherscan.io/tx/${txHash}`,
    };
  }
}
