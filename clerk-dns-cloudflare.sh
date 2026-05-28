#!/usr/bin/env bash
# Adds (or updates) the 5 Clerk production DNS records for matthewferoz.com in Cloudflare.
# All records are created DNS-only (NOT proxied), which Clerk requires for cert issuance.
#
# Usage:
#   1. Create a Cloudflare API token: dash.cloudflare.com → My Profile → API Tokens →
#      Create Token → "Edit zone DNS" template → Zone Resources: Specific zone →
#      matthewferoz.com → Create. Copy the token.
#   2. export CF_API_TOKEN=<your-token>
#   3. bash clerk-dns-cloudflare.sh
#
# Contains NO secrets (token comes from the environment). Safe to delete after use.
set -euo pipefail
: "${CF_API_TOKEN:?Set CF_API_TOKEN to a Cloudflare token with Zone:DNS Edit for matthewferoz.com}"

ZONE="matthewferoz.com"
API="https://api.cloudflare.com/client/v4"
AUTH=(-H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json")

zone_id=$(curl -s "${AUTH[@]}" "$API/zones?name=$ZONE" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);r=d.get("result") or [];print(r[0]["id"] if r else "")')
[ -n "$zone_id" ] || { echo "ERROR: could not resolve zone $ZONE (check token perms)"; exit 1; }
echo "Zone $ZONE -> $zone_id"
echo

upsert() {
  local name="$1" content="$2" fqdn="$1.$ZONE"
  local rec_id
  rec_id=$(curl -s "${AUTH[@]}" "$API/zones/$zone_id/dns_records?type=CNAME&name=$fqdn" \
    | python3 -c 'import sys,json;d=json.load(sys.stdin);r=d.get("result") or [];print(r[0]["id"] if r else "")')
  local body
  body=$(printf '{"type":"CNAME","name":"%s","content":"%s","proxied":false,"ttl":1}' "$fqdn" "$content")
  local resp ok
  if [ -n "$rec_id" ]; then
    resp=$(curl -s -X PUT "${AUTH[@]}" "$API/zones/$zone_id/dns_records/$rec_id" -d "$body")
    action="updated"
  else
    resp=$(curl -s -X POST "${AUTH[@]}" "$API/zones/$zone_id/dns_records" -d "$body")
    action="created"
  fi
  ok=$(echo "$resp" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("success"))')
  if [ "$ok" = "True" ]; then
    printf "  %-8s %-24s -> %s  (DNS-only)\n" "$action" "$fqdn" "$content"
  else
    printf "  ERROR    %-24s : %s\n" "$fqdn" "$resp"
  fi
}

upsert accounts        accounts.clerk.services
upsert clerk           frontend-api.clerk.services
upsert clk._domainkey  dkim1.5x2mfuyst4dm.clerk.services
upsert clk2._domainkey dkim2.5x2mfuyst4dm.clerk.services
upsert clkmail         mail.5x2mfuyst4dm.clerk.services

echo
echo "Done. Go back to Clerk → Domains and re-run verification / Deploy certificates."
</content>
