#!/bin/bash

SERVER="43.245.226.24"
USER="root"
PASSWORD="Yd2Vc_Wejus0DlNB"

expect << EOF
set timeout 30
spawn ssh -o StrictHostKeyChecking=no ${USER}@${SERVER}
expect {
    "password:" {
        send "${PASSWORD}\r"
    }
    "yes/no" {
        send "yes\r"
        expect "password:"
        send "${PASSWORD}\r"
    }
}
expect "# "
send "pwdx 21393 2>/dev/null || ls -la /proc/21393/cwd 2>/dev/null | tail -1\r"
expect "# "
send "cd /root && pwd && ls -la | grep -E 'AI-Avatar|newava|app'\r"
expect "# "
send "docker ps -a | head -10\r"
expect "# "
send "exit\r"
expect eof
EOF

