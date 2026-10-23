/** Caregiver vs care-receiver surfaces — keep URLs and chrome distinct. */

export function isCareReceiverPath(pathname: string): boolean {
  return (
    pathname.startsWith("/recipient") ||
    pathname.startsWith("/home") ||
    pathname.startsWith("/doorsense") ||
    pathname.startsWith("/tv")
  );
}

/** Doorbell audio sink — not caregiver, not Mom’s tablet. */
export function isDoorbellPath(pathname: string): boolean {
  return pathname.startsWith("/doorbell");
}

/** Living-room TV DoorSense overlay (web on TV / Fire browser). */
export function isTvPath(pathname: string): boolean {
  return pathname.startsWith("/tv");
}

/** Alexa bridge / simulator — no caregiver chrome or live-assist pollers. */
export function isAlexaPath(pathname: string): boolean {
  return pathname.startsWith("/alexa");
}

export function isCaregiverPath(pathname: string): boolean {
  return (
    !isCareReceiverPath(pathname) &&
    !pathname.startsWith("/cam") &&
    !isDoorbellPath(pathname) &&
    !isAlexaPath(pathname)
  );
}
