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
send "find / -name 'docker-compose.yml' -o -name 'docker-compose.yaml' 2>/dev/null | grep -v overlay | head -5\r"
expect "# "
send "find / -name 'Dockerfile*' 2>/dev/null | grep -v overlay | head -5\r"
expect "# "
send "docker exec newava_backend pwd 2>/dev/null\r"
expect "# "
send "docker exec newava_backend ls -la /app 2>/dev/null | head -10\r"
expect "# "
send "exit\r"
expect eof
EOF

