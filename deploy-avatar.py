#!/usr/bin/env python3
"""
Automated deployment script for avatar branch
Uses paramiko for SSH connection with password
"""
import paramiko
import sys
import time

# Server configuration
SERVER_HOST = "43.245.226.24"
SERVER_USER = "root"
SERVER_PASS = "Yd2Vc_Wejus0DlNB"
APP_DIR = "/opt/newava"
BRANCH = "avatar"

# Deployment script
DEPLOY_SCRIPT = f"""set -e
cd {APP_DIR}

# Initialize git if needed
if [ ! -d .git ]; then
    echo "Initializing git repository..."
    git init
    git remote add origin https://github.com/luckyit-test/AI-Avatar.git 2>/dev/null || git remote set-url origin https://github.com/luckyit-test/AI-Avatar.git
fi

# Update from avatar branch
echo "Fetching latest changes from avatar branch..."
git fetch origin

# Checkout avatar branch
echo "Checking out avatar branch..."
if git show-ref --verify --quiet refs/heads/{BRANCH}; then
    git checkout {BRANCH}
else
    git checkout -b {BRANCH} origin/{BRANCH}
fi

# Pull latest changes
echo "Pulling latest changes..."
git pull origin {BRANCH}

echo ""
echo "========================================="
echo "Code updated successfully!"
echo "Current branch: $(git branch --show-current)"
echo "Current commit: $(git rev-parse --short HEAD)"
echo "========================================="
echo ""

# Rebuild containers if docker-compose.yml exists
if [ -f "docker-compose.yml" ]; then
    echo "Rebuilding and restarting containers..."
    docker compose up -d --build
    echo ""
    echo "Deployment complete! Containers restarted."
    docker compose ps
else
    echo "Warning: docker-compose.yml not found. Code updated but containers not restarted."
fi
"""

def deploy():
    print("=" * 50)
    print("Deploying avatar branch to production")
    print("=" * 50)
    print()
    
    try:
        # Create SSH client
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        print(f"Connecting to {SERVER_USER}@{SERVER_HOST}...")
        ssh.connect(
            hostname=SERVER_HOST,
            username=SERVER_USER,
            password=SERVER_PASS,
            timeout=30
        )
        print("Connected successfully!")
        print()
        
        # Execute deployment script
        print("Executing deployment commands...")
        stdin, stdout, stderr = ssh.exec_command(DEPLOY_SCRIPT)
        
        # Print output in real-time
        for line in stdout:
            print(line.rstrip())
        
        # Check for errors
        error_output = stderr.read().decode()
        if error_output:
            print("Errors:", file=sys.stderr)
            print(error_output, file=sys.stderr)
        
        exit_status = stdout.channel.recv_exit_status()
        
        if exit_status == 0:
            print()
            print("=" * 50)
            print("✅ Deployment completed successfully!")
            print("=" * 50)
        else:
            print()
            print("=" * 50)
            print(f"❌ Deployment failed with exit code {exit_status}")
            print("=" * 50)
            sys.exit(1)
        
        ssh.close()
        
    except Exception as e:
        print(f"❌ Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    deploy()

