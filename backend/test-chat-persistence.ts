import { db } from './src/utils/database';

async function testChatPersistence() {
  console.log('🧪 Testing chat persistence with streamers...\n');

  try {
    // 1. Get the first user
    const user = await db.user.findFirst();
    if (!user) {
      console.error('❌ No users found in database');
      return;
    }
    console.log(`✅ Found user: ${user.email}`);

    // 2. Find an existing conversation with messages
    const conversations = await db.conversation.findMany({
      where: { userId: user.id },
      include: {
        messages: {
          include: {
            streamers: {
              select: {
                id: true,
                username: true,
                displayName: true,
                platform: true
              }
            }
          },
          take: 5
        }
      },
      take: 3
    });

    console.log(`\n📊 Found ${conversations.length} conversations for user ${user.email}`);

    if (conversations.length === 0) {
      console.log('⚠️  No conversations found. Please create one in the UI first.');
      return;
    }

    // 3. Display conversation details
    conversations.forEach((conv, idx) => {
      console.log(`\n📝 Conversation ${idx + 1}: ${conv.title}`);
      console.log(`   ID: ${conv.id}`);
      console.log(`   Messages: ${conv.messages.length}`);

      conv.messages.forEach((msg, msgIdx) => {
        console.log(`\n   Message ${msgIdx + 1}:`);
        console.log(`      User Query: ${msg.message}`);
        console.log(`      AI Response: ${msg.response?.substring(0, 60)}...`);
        console.log(`      Streamer IDs stored: ${msg.streamersReturned.length}`);
        console.log(`      Streamers relation: ${msg.streamers.length} streamers`);

        if (msg.streamers.length > 0) {
          console.log(`      ✅ Streamers properly linked:`);
          msg.streamers.slice(0, 3).forEach(s => {
            console.log(`         - ${s.displayName} (@${s.username}) [${s.platform}]`);
          });
          if (msg.streamers.length > 3) {
            console.log(`         ... and ${msg.streamers.length - 3} more`);
          }
        } else if (msg.streamersReturned.length > 0) {
          console.log(`      ⚠️  Has ${msg.streamersReturned.length} streamer IDs but no relation linkage`);
        } else {
          console.log(`      ℹ️  No streamers in this message`);
        }
      });
    });

    // 4. Test retrieval like the frontend does
    const testConv = conversations[0];
    console.log(`\n\n🔍 Testing frontend-style retrieval for conversation: ${testConv.title}`);

    const retrieved = await db.conversation.findFirst({
      where: {
        id: testConv.id,
        userId: user.id
      },
      include: {
        messages: {
          orderBy: { timestamp: 'asc' },
          include: {
            streamers: {
              select: {
                id: true,
                username: true,
                displayName: true,
                platform: true,
                avatarUrl: true,
                followers: true,
                isLive: true,
                currentViewers: true
              }
            }
          }
        }
      }
    });

    if (retrieved) {
      console.log(`✅ Successfully retrieved conversation`);
      const totalStreamers = retrieved.messages.reduce((acc, msg) => acc + msg.streamers.length, 0);
      console.log(`   Total messages: ${retrieved.messages.length}`);
      console.log(`   Total streamers across all messages: ${totalStreamers}`);

      if (totalStreamers > 0) {
        console.log('\n✅ ✅ ✅ CHAT PERSISTENCE TEST PASSED! ✅ ✅ ✅');
        console.log('Streamers are properly stored and retrieved with chat messages.');
      } else {
        console.log('\n⚠️  Messages exist but no streamers are linked.');
        console.log('This might be from old messages before the fix.');
        console.log('Try creating a new chat message in the UI to test.');
      }
    } else {
      console.log('❌ Failed to retrieve conversation');
    }

  } catch (error) {
    console.error('❌ Error during test:', error);
  } finally {
    await db.$disconnect();
  }
}

testChatPersistence();
