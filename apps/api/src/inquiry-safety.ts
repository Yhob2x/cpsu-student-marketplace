/** Only open inquiry threads may receive new messages, regardless of entry route. */
export function inquiryAllowsMessage(status: string): boolean {
  return status === 'open';
}
