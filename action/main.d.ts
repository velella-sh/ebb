export function shouldFail(status: string, threshold?: string): boolean;
export function formatAnnotation(status: string, label: string, details: string): string;
export function runAction(
  env?: Record<string, string | undefined>,
  io?: { stdout: { write(str: string): unknown }; stderr: { write(str: string): unknown } },
): number;
