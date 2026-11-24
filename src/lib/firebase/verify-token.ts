import { createRemoteJWKSet, jwtVerify } from "jose";

const FIREBASE_JWKS_URL = new URL(
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
);

const JWKS = createRemoteJWKSet(FIREBASE_JWKS_URL);

export class AuthVerifyError extends Error {
  readonly status: 401 | 500;

  constructor(message: string, status: 401 | 500) {
    super(message);
    this.name = "AuthVerifyError";
    this.status = status;
  }
}

export interface VerifiedFirebaseUser {
  uid: string;
  email?: string;
}

/**
 * Verifies a Firebase Auth ID token supplied in the request's Authorization Bearer header
 * against Google's public securetoken JWKS endpoint.
 */
export async function verifyFirebaseRequest(
  request: Request
): Promise<VerifiedFirebaseUser> {
  const authHeader = request.headers.get("authorization");
  const trimmedHeader = authHeader?.trim() ?? "";
  const match = /^bearer\s+(\S+)$/i.exec(trimmedHeader);
  const token = match?.[1]?.trim();

  if (!token) {
    throw new AuthVerifyError(
      "Missing or invalid Authorization header.",
      401
    );
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  if (!projectId) {
    throw new AuthVerifyError(
      "Firebase project ID is not configured on the server.",
      500
    );
  }

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });

    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      throw new AuthVerifyError(
        "Invalid or expired Firebase ID token.",
        401
      );
    }

    return {
      uid: payload.sub,
      email: typeof payload.email === "string" ? payload.email : undefined,
    };
  } catch (err) {
    if (err instanceof AuthVerifyError) {
      throw err;
    }
    throw new AuthVerifyError("Invalid or expired Firebase ID token.", 401);
  }
}
