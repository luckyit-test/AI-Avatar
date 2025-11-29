#!/usr/bin/expect -f

set timeout 30
set SERVER_HOST "43.245.226.24"
set SERVER_USER "root"
set SERVER_PASS "Yd2Vc_Wejus0DlNB"
set PUB_KEY "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQC+hDm6qoU9CL0C2nJ0Kjo5yRT0G2agibbwG5bjKUcmqip/n27agnQfQFl16+JVCFqV+iJcEwZzAVsBH1OYjGkmOkXl+0UIl0b2CnQTWUd6xioRyV3bIOHKelh042w08x3SYqNFJvMk12pOsxr1Vfb2jk+dyGlw37uvdWI0UnqXv127vzBPjzsdGKz3vzUF9d5D1tHsSuFbZtLlSPKnzYUefH5aPD5FikS347T/KRPtyHbT3UddFnF2dCfHzm/dwSgciefZEwLcxJoIVATknPju5aTmBNGCn/kYpOOI7b0WOSrKmVZuyIXxfmn7iy8/gP4kmxYzIzeghOPtatsyrqK5AkDCggNCH9pwDzvJMZx4+qKdPxN4eDS7e0Hs28M1avumM8tSNg/3K4W9dnBAIKFleh29mPqzZ8XUIh7TrB0CaISgeX2b6FqQuF4ErphvmdmFRbmNc8LfimWfQWoifiZpfOwSoOviPt2EEzzazwnummhmXFSwxgo81yvPeAonW9EBVu4CtHK1PJZpUdbk281bF9JqshEx23bc6bR/J86s/iXbjutcU4ymKpg4bqbi+7o0G4D1+IKYegB7SMk16iXFqWqs6Nl8t/RKxaAOPK5xJYInfc4P9g6i+FGTwtuJNHFhH+1hJUZtpaq8sNF6TZeou4XBiZyNSXuHud2EDD/pGQ== user@DESKTOP-O7AH1P2"

puts "Adding SSH key to server..."
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "mkdir -p ~/.ssh && echo '$PUB_KEY' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && chmod 700 ~/.ssh"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

puts "SSH key added successfully!"

