// Package secrets decides whether configuration values look like
// credentials committed in plain text. Extractors share it so compose and
// Terraform agree on what "hardcoded" means.
package secrets

import (
	"net/url"
	"regexp"
	"strings"
)

var (
	secretKey  = regexp.MustCompile(`(?i)(PASSWORD|PASSWD|SECRET(_?KEY)?|TOKEN|API_?KEY|PRIVATE_?KEY|ACCESS_?KEY|CREDENTIALS?)$`)
	urlInValue = regexp.MustCompile(`[a-zA-Z][a-zA-Z0-9+.-]*://[^\s"']+`)
)

// IsSecretKey reports whether a setting name suggests a credential.
// "*_FILE" settings point at a secret instead of holding one.
func IsSecretKey(key string) bool {
	return secretKey.MatchString(key) && !strings.HasSuffix(strings.ToUpper(key), "_FILE")
}

// IsReference reports whether a value defers to something else at runtime:
// an interpolation, a variable, or a mounted secret file.
func IsReference(value string) bool {
	return strings.Contains(value, "${") || strings.HasPrefix(value, "$") || strings.HasPrefix(value, "/run/secrets/")
}

// Hardcoded reports whether key=value is a literal credential: either a
// secret-looking key with a literal value, or a URL with an embedded
// password.
func Hardcoded(key, value string) bool {
	if value == "" || IsReference(value) {
		return false
	}
	if IsSecretKey(key) {
		return true
	}
	for _, raw := range urlInValue.FindAllString(value, -1) {
		if u, err := url.Parse(raw); err == nil {
			if pw, ok := u.User.Password(); ok && pw != "" && !strings.Contains(pw, "$") {
				return true
			}
		}
	}
	return false
}

// URLs returns the URLs found in a value.
func URLs(value string) []string {
	return urlInValue.FindAllString(value, -1)
}
