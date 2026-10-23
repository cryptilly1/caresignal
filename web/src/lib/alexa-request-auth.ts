import { createVerify, X509Certificate } from "node:crypto";
import { rootCertificates } from "node:tls";

const CERTIFICATE_CACHE_MS = 5 * 60 * 1000;
const MAX_CERTIFICATE_BYTES = 64 * 1024;
const MAX_CERTIFICATE_COUNT = 8;
const MAX_CACHED_CERTIFICATES = 16;
const TIMESTAMP_TOLERANCE_MS = 150_000;

const trustedRoots = new Map(
  rootCertificates.map((pem) => {
    const certificate = new X509Certificate(pem);
    return [certificate.fingerprint256, certificate] as const;
  }),
);
const certificateCache = new Map<
  string,
  { certificate: X509Certificate; expiresAt: number }
>();

function isCurrentlyValid(certificate: X509Certificate): boolean {
  const now = Date.now();
  return (
    Date.parse(certificate.validFrom) <= now &&
    Date.parse(certificate.validTo) >= now
  );
}

function hasTrustedIssuerPath(
  certificate: X509Certificate,
  issuers: X509Certificate[],
  visited = new Set<string>(),
  depth = 0,
): boolean {
  if (trustedRoots.has(certificate.fingerprint256)) return true;
  if (depth >= MAX_CERTIFICATE_COUNT || visited.has(certificate.fingerprint256)) {
    return false;
  }

  const nextVisited = new Set(visited).add(certificate.fingerprint256);
  for (const issuer of issuers) {
    if (
      !issuer.ca ||
      !isCurrentlyValid(issuer) ||
      nextVisited.has(issuer.fingerprint256)
    ) {
      continue;
    }
    try {
      if (
        certificate.checkIssued(issuer) &&
        certificate.verify(issuer.publicKey) &&
        hasTrustedIssuerPath(issuer, issuers, nextVisited, depth + 1)
      ) {
        return true;
      }
    } catch {
      continue;
    }
  }
  return false;
}

function parseCertificateChain(pem: string): X509Certificate[] | null {
  const pattern = /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g;
  const blocks = [...pem.matchAll(pattern)].map(([block]) => block);
  if (
    blocks.length === 0 ||
    blocks.length > MAX_CERTIFICATE_COUNT ||
    pem.replace(pattern, "").trim()
  ) {
    return null;
  }
  try {
    return blocks.map((block) => new X509Certificate(block));
  } catch {
    return null;
  }
}

function validCertificateUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (
      url.origin !== "https://s3.amazonaws.com" ||
      !/^\/echo\.api\/echo-api-cert-\d+\.pem$/.test(url.pathname) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

async function getAlexaCertificate(
  value: string,
): Promise<X509Certificate | null> {
  const url = validCertificateUrl(value);
  if (!url) return null;

  const cached = certificateCache.get(url.href);
  if (
    cached &&
    cached.expiresAt > Date.now() &&
    isCurrentlyValid(cached.certificate)
  ) {
    return cached.certificate;
  }

  const response = await fetch(url, {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) {
    throw new Error(`Alexa certificate fetch returned HTTP ${response.status}.`);
  }
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_CERTIFICATE_BYTES) {
    return null;
  }
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_CERTIFICATE_BYTES) return null;

  const chain = parseCertificateChain(new TextDecoder().decode(bytes));
  const leaf = chain?.[0];
  if (
    !chain ||
    !leaf ||
    leaf.ca ||
    leaf.checkHost("echo-api.amazon.com") !== "echo-api.amazon.com" ||
    leaf.publicKey.asymmetricKeyType !== "rsa" ||
    !chain.every(isCurrentlyValid) ||
    !hasTrustedIssuerPath(leaf, [...chain.slice(1), ...trustedRoots.values()])
  ) {
    return null;
  }

  certificateCache.set(url.href, {
    certificate: leaf,
    expiresAt: Date.now() + CERTIFICATE_CACHE_MS,
  });
  if (certificateCache.size > MAX_CACHED_CERTIFICATES) {
    const oldest = certificateCache.keys().next().value;
    if (oldest) certificateCache.delete(oldest);
  }
  return leaf;
}

export async function verifyAlexaRequest(
  rawBody: Uint8Array,
  certificateUrl: string | null,
  signature: string | null,
  timestamp: string | undefined,
): Promise<boolean> {
  if (
    !certificateUrl ||
    certificateUrl.length > 512 ||
    !signature ||
    signature.length > 4096 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(signature) ||
    !timestamp
  ) {
    return false;
  }
  const timestampMs = Date.parse(timestamp);
  if (
    !Number.isFinite(timestampMs) ||
    Math.abs(Date.now() - timestampMs) > TIMESTAMP_TOLERANCE_MS
  ) {
    return false;
  }

  const certificate = await getAlexaCertificate(certificateUrl);
  if (!certificate) return false;
  try {
    const verifier = createVerify("RSA-SHA1");
    verifier.update(rawBody);
    verifier.end();
    return verifier.verify(certificate.publicKey, Buffer.from(signature, "base64"));
  } catch {
    return false;
  }
}
