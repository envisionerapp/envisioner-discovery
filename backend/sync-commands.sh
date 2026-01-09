#!/bin/bash

# Simple scripts for syncing local DB to production

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROD_API="https://api.miela.cc"
LOCAL_API="http://localhost:8080"

echo -e "${BLUE}🔄 Mielo Database Sync Tools${NC}"
echo "=============================="

# Function: Check status
check_status() {
    echo -e "${YELLOW}📊 Checking database status...${NC}"

    # Get local count
    LOCAL_COUNT=$(curl -s "$LOCAL_API/api/streamers/stats" | jq '.data.total')

    # Get production count
    PROD_COUNT=$(curl -s "$PROD_API/api/streamers/stats" | jq '.data.total')

    echo "Local streamers:      $LOCAL_COUNT"
    echo "Production streamers: $PROD_COUNT"
    echo "Difference:           $((LOCAL_COUNT - PROD_COUNT))"

    if [ "$LOCAL_COUNT" -eq "$PROD_COUNT" ]; then
        echo -e "${GREEN}✅ Databases are in sync!${NC}"
    else
        echo -e "${YELLOW}⚠️  Databases are out of sync${NC}"
    fi
}

# Function: Sync all data
sync_all() {
    echo -e "${YELLOW}🚀 Starting full sync to production...${NC}"

    # Run the Node.js sync script
    node export-and-sync-to-prod.js

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Sync completed successfully!${NC}"
    else
        echo -e "${RED}❌ Sync failed!${NC}"
    fi
}

# Function: Export to CSV
export_csv() {
    echo -e "${YELLOW}📄 Exporting current data to CSV...${NC}"

    # Get all streamers and convert to CSV
    curl -s "$LOCAL_API/api/streamers?limit=15000" | \
    jq -r '.data[] | [.platform, .username, .displayName, .followers, .region, .language] | @csv' > \
    "export_$(date +%Y%m%d_%H%M%S).csv"

    echo -e "${GREEN}✅ Export completed: export_$(date +%Y%m%d_%H%M%S).csv${NC}"
}

# Menu system
show_menu() {
    echo ""
    echo "Available commands:"
    echo "1) status  - Check sync status"
    echo "2) sync    - Sync all data to production"
    echo "3) export  - Export current data to CSV"
    echo "4) quit    - Exit"
    echo ""
}

# Main menu loop
if [ $# -eq 0 ]; then
    # Interactive mode
    while true; do
        show_menu
        read -p "Enter command (1-4): " choice

        case $choice in
            1|status)
                check_status
                ;;
            2|sync)
                sync_all
                ;;
            3|export)
                export_csv
                ;;
            4|quit)
                echo -e "${BLUE}👋 Goodbye!${NC}"
                exit 0
                ;;
            *)
                echo -e "${RED}❌ Invalid option. Please try again.${NC}"
                ;;
        esac
    done
else
    # Command line mode
    case $1 in
        status)
            check_status
            ;;
        sync)
            sync_all
            ;;
        export)
            export_csv
            ;;
        *)
            echo "Usage: $0 [status|sync|export]"
            exit 1
            ;;
    esac
fi