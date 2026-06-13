/**
 * SAML 2.0 configuration for enterprise SSO.
 *
 * Tested against:
 *   - Azure AD (Microsoft Entra ID)
 *   - Okta
 *   - Google Workspace SAML
 *
 * Required environment variables:
 *   SAML_ENTRY_POINT   — IdP SSO URL
 *                        Azure: https://login.microsoftonline.com/<tenant>/saml2
 *                        Okta:  https://<org>.okta.com/app/<app>/sso/saml
 *   SAML_ISSUER        — SP Entity ID (must match what you registered with the IdP)
 *                        e.g. https://carbonthreat.example.com
 *   SAML_CERT          — IdP X.509 certificate (PEM, newlines as \n)
 *                        From Azure: App Registrations → Certificates & secrets → Federation metadata
 *   SAML_CALLBACK_URL  — ACS (Assertion Consumer Service) URL
 *                        e.g. https://carbonthreat.example.com/api/auth/sso/saml/callback
 *
 * Optional:
 *   SAML_WANT_ASSERTIONS_SIGNED  — default 'true'
 *   SAML_SIGNATURE_ALGORITHM     — default 'sha256'
 */

const required = (key) => {
    const val = process.env[key];
    if (!val) {throw new Error(`Required env var for SAML is not set: ${key}`);}
    return val;
};

export function getSamlConfig() {
    return {
        entryPoint:         required('SAML_ENTRY_POINT'),
        issuer:             required('SAML_ISSUER'),
        cert:               required('SAML_CERT').replace(/\\n/g, '\n'),
        callbackUrl:        required('SAML_CALLBACK_URL'),
        wantAssertionsSigned: process.env.SAML_WANT_ASSERTIONS_SIGNED !== 'false',
        // Require the top-level SAML Response to be signed as well, not just the
        // assertion — defends against assertion-wrapping attacks. Override only
        // if your IdP genuinely cannot sign the response.
        wantAuthnResponseSigned: process.env.SAML_WANT_RESPONSE_SIGNED !== 'false',
        // Track InResponseTo so a captured SAML Response cannot be replayed.
        validateInResponseTo: 'always',
        // Restrict which SP the assertion is valid for (audience restriction).
        // Defaults to the SP entityId (issuer) unless explicitly overridden.
        audience:           process.env.SAML_AUDIENCE ?? required('SAML_ISSUER'),
        // Bound clock skew tolerance for NotBefore / NotOnOrAfter checks.
        acceptedClockSkewMs: parseInt(process.env.SAML_CLOCK_SKEW_MS ?? '5000', 10),
        signatureAlgorithm: process.env.SAML_SIGNATURE_ALGORITHM ?? 'sha256',
        // Disable XML encryption — encryption is handled at the transport layer (TLS).
        // Enable if your IdP requires assertion-level encryption.
        decryptionPvk:      process.env.SAML_DECRYPTION_PVK ?? undefined,
    };
}

/**
 * Returns true if SAML is configured (all required env vars are present).
 * Used by the frontend config endpoint to show/hide the SSO login button.
 */
export function isSamlEnabled() {
    const vars = ['SAML_ENTRY_POINT', 'SAML_ISSUER', 'SAML_CERT', 'SAML_CALLBACK_URL'];
    return vars.every((v) => Boolean(process.env[v]));
}
