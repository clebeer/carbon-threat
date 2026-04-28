#!/bin/sh
set -e

SECRETS_FILE="/app/secrets/.env.secrets"
SECRETS_DIR=$(dirname "$SECRETS_FILE")

# Create volume dir mapped in compose if missing
if [ ! -d "$SECRETS_DIR" ]; then
  mkdir -p "$SECRETS_DIR"
fi

# Function to check if a var needs generating
needs_generation() {
  local var_name="$1"
  # Use eval to nicely check variable dynamic values
  local var_value=$(eval echo \$${var_name})
  if [ -z "$var_value" ] || echo "$var_value" | grep -q "GENERATE_openssl"; then
      return 0
  elif echo "$var_value" | grep -q "GENERATE_32_chars"; then
      return 0
  fi
  return 1
}

# If secrets file does not exist, let's create the base configuration
if [ ! -f "$SECRETS_FILE" ]; then
  echo "# Auto-generated secrets for initial boot" > "$SECRETS_FILE"
  
  # Generate Model Encryption Key (64 hex characters / 32 bytes)
  export ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  echo "ENCRYPTION_KEY=${ENCRYPTION_KEY}" >> "$SECRETS_FILE"

  # Generate JWT Keys (48 base64 chars minimum usually)
  export ENCRYPTION_JWT_SIGNING_KEY=$(node -e "console.log(require('crypto').randomBytes(36).toString('base64'))")
  echo "ENCRYPTION_JWT_SIGNING_KEY=${ENCRYPTION_JWT_SIGNING_KEY}" >> "$SECRETS_FILE"

  export ENCRYPTION_JWT_REFRESH_SIGNING_KEY=$(node -e "console.log(require('crypto').randomBytes(36).toString('base64'))")
  echo "ENCRYPTION_JWT_REFRESH_SIGNING_KEY=${ENCRYPTION_JWT_REFRESH_SIGNING_KEY}" >> "$SECRETS_FILE"

  # Generate Legacy Encryption Keys (32 exact characters limit)
  ENC_VAL=$(node -e "console.log(require('crypto').randomBytes(24).toString('base64').substring(0,32))")
  export ENCRYPTION_KEYS="[{\"isPrimary\": true, \"id\": 0, \"value\": \"${ENC_VAL}\"}]"
  echo "ENCRYPTION_KEYS='${ENCRYPTION_KEYS}'" >> "$SECRETS_FILE"
fi

# Source secrets (This will override current process env natively after eval check)
# First we read them explicitly into process variables so node receives them.
while IFS='=' read -r key val; do
  # Skip comments and empty lines
  case "$key" in
      \#*|"") continue ;;
  esac
  
  # Remove quotes around value if any
  val=$(echo "$val" | sed -e "s/^'//" -e "s/'$//")
  
  # If the current container ENV for this key points to a mock value or is empty
  # we inject from the persistent secret file
  if needs_generation "$key"; then
      export "$key=$val"
  fi
done < "$SECRETS_FILE"

# Make sure node gets executed properly
exec "$@"
