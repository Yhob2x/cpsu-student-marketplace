// Count suppression is applied to every small analytics metric, including review queues.
export function suppressSmallCount(value: number, minimum = 5): number | string {
  if (!Number.isInteger(value) || value < 0) throw new RangeError('Count must be a nonnegative integer');
  return value > 0 && value < minimum ? `<${minimum}` : value;
}
