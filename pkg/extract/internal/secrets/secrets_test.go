package secrets

import "testing"

func TestHardcoded(t *testing.T) {
	cases := []struct {
		key, value string
		want       bool
	}{
		{"POSTGRES_PASSWORD", "supersecret", true},
		{"JWT_SECRET_KEY", "abc", true},
		{"api_key", "sk_live_123", true},
		{"POSTGRES_PASSWORD", "${DB_PASSWORD}", false},
		{"POSTGRES_PASSWORD", "$DB_PASSWORD", false},
		{"POSTGRES_PASSWORD", "", false},
		{"POSTGRES_PASSWORD_FILE", "/run/secrets/db", false},
		{"TOKEN_FILE", "token.txt", false},
		{"DATABASE_URL", "postgres://app:s3cret@db:5432/app", true},
		{"DATABASE_URL", "postgres://app:${PW}@db:5432/app", false},
		{"DATABASE_URL", "postgres://app@db:5432/app", false},
		{"LOG_LEVEL", "debug", false},
	}
	for _, c := range cases {
		if got := Hardcoded(c.key, c.value); got != c.want {
			t.Errorf("Hardcoded(%q, %q) = %v, want %v", c.key, c.value, got, c.want)
		}
	}
}
