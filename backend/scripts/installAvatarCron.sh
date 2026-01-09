#!/bin/bash

# Avatar Cron Job Installation Script
# This script sets up automatic avatar updates for the Mielo platform

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CRON_SCRIPT="$SCRIPT_DIR/avatarCronJob.ts"
WRAPPER_SCRIPT="$SCRIPT_DIR/avatar-cron-wrapper.sh"
LOG_DIR="$PROJECT_ROOT/logs/avatar-cron"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Mielo Avatar Cron Job Installer${NC}"
echo "=================================================="

# Check if we're in the right directory
if [[ ! -f "$PROJECT_ROOT/package.json" ]]; then
    echo -e "${RED}❌ Error: This script must be run from the Mielo backend directory${NC}"
    exit 1
fi

# Check if Node.js and npm are installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Error: Node.js is not installed${NC}"
    exit 1
fi

if ! command -v npx &> /dev/null; then
    echo -e "${RED}❌ Error: npx is not available${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js and npx are available${NC}"

# Create log directory
mkdir -p "$LOG_DIR"
echo -e "${GREEN}✅ Created log directory: $LOG_DIR${NC}"

# Create wrapper script for cron
cat > "$WRAPPER_SCRIPT" << 'EOL'
#!/bin/bash

# Avatar Cron Job Wrapper
# This wrapper sets up the proper environment for the avatar cron job

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Change to project directory
cd "$PROJECT_ROOT"

# Set up environment
export NODE_ENV=production
export PATH="$PATH:$PROJECT_ROOT/node_modules/.bin"

# Add timestamp to output
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting avatar cron job..."

# Run the TypeScript cron job
npx ts-node "$SCRIPT_DIR/avatarCronJob.ts" 2>&1

# Log completion
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Avatar cron job completed."
EOL

# Make wrapper script executable
chmod +x "$WRAPPER_SCRIPT"
echo -e "${GREEN}✅ Created wrapper script: $WRAPPER_SCRIPT${NC}"

# Function to install cron job
install_cron_job() {
    local schedule="$1"
    local description="$2"

    # Remove existing cron job if it exists
    crontab -l 2>/dev/null | grep -v "avatarCronJob.ts\|avatar-cron-wrapper.sh" | crontab -

    # Add new cron job
    (crontab -l 2>/dev/null; echo "$schedule $WRAPPER_SCRIPT >> $LOG_DIR/cron.log 2>&1") | crontab -

    echo -e "${GREEN}✅ Installed cron job: $description${NC}"
    echo "   Schedule: $schedule"
    echo "   Script: $WRAPPER_SCRIPT"
    echo "   Logs: $LOG_DIR/cron.log"
}

# Show installation options
echo ""
echo -e "${YELLOW}🕒 Choose cron schedule:${NC}"
echo "1) Every 2 hours (recommended for active updates)"
echo "2) Every 4 hours (balanced approach)"
echo "3) Every 6 hours (conservative)"
echo "4) Daily at 3 AM (minimal impact)"
echo "5) Custom schedule"
echo "6) Test run (run once now)"
echo "7) View current cron jobs"
echo "8) Uninstall cron job"

read -p "Enter your choice (1-8): " choice

case $choice in
    1)
        install_cron_job "0 */2 * * *" "Every 2 hours"
        ;;
    2)
        install_cron_job "0 */4 * * *" "Every 4 hours"
        ;;
    3)
        install_cron_job "0 */6 * * *" "Every 6 hours"
        ;;
    4)
        install_cron_job "0 3 * * *" "Daily at 3 AM"
        ;;
    5)
        read -p "Enter custom cron schedule (e.g., '0 */3 * * *'): " custom_schedule
        install_cron_job "$custom_schedule" "Custom: $custom_schedule"
        ;;
    6)
        echo -e "${YELLOW}🧪 Running test avatar update...${NC}"
        cd "$PROJECT_ROOT"
        npx ts-node "$CRON_SCRIPT"
        echo -e "${GREEN}✅ Test completed. Check logs for results.${NC}"
        ;;
    7)
        echo -e "${BLUE}📋 Current cron jobs:${NC}"
        crontab -l 2>/dev/null || echo "No cron jobs found."
        ;;
    8)
        crontab -l 2>/dev/null | grep -v "avatarCronJob.ts\|avatar-cron-wrapper.sh" | crontab -
        echo -e "${GREEN}✅ Avatar cron job removed${NC}"
        ;;
    *)
        echo -e "${RED}❌ Invalid choice${NC}"
        exit 1
        ;;
esac

# Show final status
if [[ $choice =~ ^[1-5]$ ]]; then
    echo ""
    echo -e "${GREEN}🎉 Avatar cron job installation completed!${NC}"
    echo ""
    echo "📋 What happens now:"
    echo "• Avatar updates will run automatically based on your schedule"
    echo "• Logs are saved to: $LOG_DIR/"
    echo "• Only streamers without avatars will be processed"
    echo "• The job will respect rate limits and timeouts"
    echo ""
    echo "🔍 Monitoring:"
    echo "• Check cron logs: tail -f $LOG_DIR/cron.log"
    echo "• Check avatar logs: ls -la $LOG_DIR/"
    echo "• View current cron: crontab -l"
    echo ""
    echo "⚙️ Configuration:"
    echo "• Edit settings: $SCRIPT_DIR/avatar-cron-config.json"
    echo "• Reinstall: bash $0"
    echo "• Uninstall: bash $0 (choose option 8)"
fi

echo ""
echo -e "${BLUE}📚 Useful commands:${NC}"
echo "• View cron jobs: crontab -l"
echo "• Edit cron jobs: crontab -e"
echo "• Test run now: npx ts-node $CRON_SCRIPT"
echo "• View logs: tail -f $LOG_DIR/*.log"

echo ""
echo -e "${GREEN}✨ Setup complete!${NC}"