import { db } from './src/utils/database';

async function createTestChat() {
  console.log('🧪 Creating test chat with streamers...\n');

  try {
    // 1. Get the first user
    const user = await db.user.findFirst();
    if (!user) {
      console.error('❌ No users found in database');
      return;
    }
    console.log(`✅ Found user: ${user.email}`);

    // 2. Get some streamers for testing
    const streamers = await db.streamer.findMany({
      where: {
        platform: 'TWITCH'
      },
      take: 5
    });

    if (streamers.length === 0) {
      console.error('❌ No streamers found in database');
      return;
    }
    console.log(`✅ Found ${streamers.length} streamers for testing`);

    // 3. Create a conversation
    const conversation = await db.conversation.create({
      data: {
        userId: user.id,
        title: 'Test: 5 Twitch streamers for gaming'
      }
    });
    console.log(`✅ Created conversation: ${conversation.id}`);

    // 4. Create a chat message with linked streamers
    const message = await db.chatMessage.create({
      data: {
        userId: user.id,
        conversationId: conversation.id,
        message: 'Show me 5 Twitch streamers',
        response: `Found ${streamers.length} Twitch streamers. Check the table below.`,
        streamersReturned: streamers.map(s => s.id),
        processingTime: 1500,
        timestamp: new Date(),
        // THIS IS THE KEY PART - linking streamers via relation
        streamers: {
          connect: streamers.map(s => ({ id: s.id }))
        }
      }
    });
    console.log(`✅ Created message: ${message.id}`);

    // 5. Verify the streamers are linked
    const retrieved = await db.chatMessage.findUnique({
      where: { id: message.id },
      include: {
        streamers: {
          select: {
            id: true,
            username: true,
            displayName: true,
            platform: true
          }
        }
      }
    });

    console.log(`\n✅ Message retrieved with ${retrieved?.streamers.length} streamers:`);
    retrieved?.streamers.forEach(s => {
      console.log(`   - ${s.displayName} (@${s.username}) [${s.platform}]`);
    });

    console.log('\n✅ ✅ ✅ TEST CHAT CREATED SUCCESSFULLY! ✅ ✅ ✅');
    console.log(`\nConversation ID: ${conversation.id}`);
    console.log('Now refresh the UI and click on the conversation to see the results!');

  } catch (error) {
    console.error('❌ Error creating test chat:', error);
  } finally {
    await db.$disconnect();
  }
}

createTestChat();
