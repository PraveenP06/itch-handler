type CountInput = { target: number; progress: number }

export function countAt({ target, progress }: CountInput): number {
  const clamped = Math.min(Math.max(progress, 0), 1)
  return target * (1 - (1 - clamped) ** 3)
}
