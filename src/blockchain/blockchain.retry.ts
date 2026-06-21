export async function conReintentos<T>(
  fn: () => Promise<T>,
  maxReintentos: number,
  delayMs: number,
): Promise<T> {
  let ultimoError: unknown;
  for (let intento = 0; intento < maxReintentos; intento++) {
    try {
      return await fn();
    } catch (error) {
      ultimoError = error;
      if (intento < maxReintentos - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw ultimoError;
}
