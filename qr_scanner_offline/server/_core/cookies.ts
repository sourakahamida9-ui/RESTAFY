import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const hostname = req.hostname;
  
  // Déterminer le domaine pour les cookies cross-subdomain
  // Production: .restafy.shop
  // Développement local: pas de domaine (cookies locaux)
  let domain: string | undefined = undefined;

  if (hostname && !LOCAL_HOSTS.has(hostname) && !isIpAddress(hostname)) {
    // Production ou staging: utiliser le domaine parent avec point (cross-subdomain)
    // Ex: scan.restafy.shop + app.restafy.shop partagent le cookie via .restafy.shop
    if (hostname.includes('.')) {
      const parts = hostname.split('.');
      // Pour restafy.shop, utiliser .restafy.shop
      // Pour staging.restafy.shop, utiliser .staging.restafy.shop
      if (parts.length >= 2) {
        domain = `.${parts.slice(-2).join('.')}`;
      }
    }
  }

  return {
    httpOnly: true,
    path: "/",
    domain,
    sameSite: "none",
    secure: isSecureRequest(req),
  };
}
