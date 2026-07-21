#!/bin/bash
set -e

# Farben für die Ausgabe
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Devion On-Premise Plattform Installation ===${NC}"

# 1. Zielverzeichnisse definieren und erstellen
BASE_DIR="/opt/devion"
echo "Erstelle System-Verzeichnisse unter $BASE_DIR..."

sudo mkdir -p "$BASE_DIR/traefik/dynamic"
sudo mkdir -p "$BASE_DIR/certs"
sudo mkdir -p "$BASE_DIR/backups"

# 2. Rechte für Let's Encrypt Datei einschränken 
# (Traefik verweigert den Start, wenn acme.json zu offene Rechte hat)
sudo touch "$BASE_DIR/certs/acme.json"
sudo chmod 600 "$BASE_DIR/certs/acme.json"

echo -e "${GREEN}=== System-Verzeichnisse erfolgreich eingerichtet! ===${NC}"
echo "Pfadstruktur auf dem Server:"
echo " -> $BASE_DIR/traefik/dynamic  (Für dynamische Router-Dateien)"
echo " -> $BASE_DIR/certs            (Für SSL-Zertifikate)"
echo " -> $BASE_DIR/backups          (Für Datenbank-Backups)"